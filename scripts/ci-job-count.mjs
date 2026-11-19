/**
 * @summary Estimates how many runner jobs a repository's workflows start on a pull request or a push.
 *
 * The org's CI has 20 concurrent runner jobs, and a full Engine pull request already starts more than that. The
 * estimate exists so a diff that starts more jobs is seen before it merges. It counts each job of a workflow that a
 * `pull_request`, `pull_request_target` or `push` event triggers, times its matrix: a literal list, a block list or
 * the fallback list of a `fromJSON(… || '[…]')`. A dynamic matrix counts once, and a job's `if:` is ignored. That
 * only has to be consistent, since a base is compared with its head under the same rules.
 *
 * Line-based on purpose: the package carries no YAML parser, and workflow structure keys sit at fixed indents.
 * @module scripts/ci-job-count
 */
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join}                   from 'node:path';

const
    EVENTS        = ['pull_request', 'pull_request_target', 'push'],
    WORKFLOW_FILE = /\.ya?ml$/,
    indentOf      = line => line.length - line.trimStart().length,
    isContent     = line => line.trim() !== '' && !line.trim().startsWith('#');

/**
 * @summary A YAML value without its trailing comment: everything before the first `#` that opens the value or follows
 * whitespace. A scan, not a regular expression, so a long run of spaces costs linear time.
 * @param {String} value
 * @returns {String}
 */
function stripComment(value) {
    for (let index = 0; index < value.length; index++) {
        if (value[index] === '#' && (index === 0 || value[index - 1] === ' ' || value[index - 1] === '\t')) {
            return value.slice(0, index).trim()
        }
    }

    return value.trim()
}

/**
 * @summary The lines of a top-level block, such as `jobs:`, without the key line itself.
 * @param {String[]} lines
 * @param {RegExp}   key A top-level key line, e.g. /^jobs:\s*$/
 * @returns {String[]}
 */
function blockOf(lines, key) {
    const start = lines.findIndex(line => key.test(line));

    if (start === -1) {
        return []
    }

    const end = lines.findIndex((line, index) => index > start && isContent(line) && indentOf(line) === 0);

    return lines.slice(start + 1, end === -1 ? lines.length : end)
}

/**
 * @summary The direct children of a block, as `{key, value, lines}`, keyed at the block's first content indent.
 * @param {String[]} lines
 * @returns {Object[]}
 */
function childrenOf(lines) {
    const first = lines.find(isContent);

    if (!first) {
        return []
    }

    const indent   = indentOf(first),
          children = [];

    for (const line of lines) {
        const match = isContent(line) && indentOf(line) === indent && line.match(/^\s*['"]?([A-Za-z0-9_-]+)['"]?:(.*)/);

        if (match) {
            children.push({key: match[1], value: stripComment(match[2]), lines: []})
        } else if (children.length && (!isContent(line) || indentOf(line) > indent)) {
            children.at(-1).lines.push(line)
        }
    }

    return children
}

/**
 * @summary How many entries a matrix dimension's value holds.
 * @param {Object} child `{value, lines}` from childrenOf()
 * @returns {Number}
 */
function dimensionSize({value, lines}) {
    const items = list => list.split(',').map(item => item.trim()).filter(Boolean).length;

    if (value.startsWith('[')) {
        return items(value.slice(1, value.lastIndexOf(']')))
    }

    if (value.startsWith('${{')) {
        const literals = [...value.matchAll(/['"]\[([^\]]*)\]['"]/g)];

        return literals.length ? items(literals.at(-1)[1]) : 1
    }

    if (value === '') {
        const entries = lines.filter(isContent),
              indent  = entries.length && indentOf(entries[0]);

        return entries.filter(line => indentOf(line) === indent && line.trim().startsWith('- ')).length || 1
    }

    return 1
}

/**
 * @summary The runner jobs one workflow starts on a pull request or a push, per job id.
 * @param {String} text The workflow's YAML
 * @returns {Object<String, Number>} Job id → runner jobs; empty when no counted event triggers the workflow
 */
export function workflowJobs(text) {
    const lines  = String(text).split('\n'),
          onLine = lines.find(line => /^['"]?on['"]?:/.test(line)) ?? '',
          inline = stripComment(onLine.slice(onLine.indexOf(':') + 1)),
          events = inline
              ? inline.replace(/^\[|\]$/g, '').split(',').map(event => event.trim())
              : childrenOf(blockOf(lines, /^['"]?on['"]?:\s*(#.*)?$/)).map(child => child.key);

    if (!events.some(event => EVENTS.includes(event))) {
        return {}
    }

    const jobs = {};

    for (const job of childrenOf(blockOf(lines, /^jobs:\s*(#.*)?$/))) {
        const strategy = childrenOf(job.lines).find(child => child.key === 'strategy'),
              matrix   = strategy && childrenOf(strategy.lines).find(child => child.key === 'matrix'),
              dims     = matrix ? childrenOf(matrix.lines).filter(child => child.key !== 'exclude') : [],
              include  = dims.find(child => child.key === 'include'),
              axes     = dims.filter(child => child.key !== 'include');

        if (matrix?.value.startsWith('${{')) {
            jobs[job.key] = dimensionSize(matrix)
        } else if (axes.length) {
            jobs[job.key] = axes.reduce((product, axis) => product * dimensionSize(axis), 1)
        } else {
            jobs[job.key] = include ? dimensionSize(include) : 1
        }
    }

    return jobs
}

/**
 * @summary Every workflow's runner jobs, keyed `file#job`.
 * @param {Object<String, String>} files Workflow file name → YAML
 * @returns {Object<String, Number>}
 */
export function runnerJobs(files) {
    const all = {};

    for (const [file, text] of Object.entries(files)) {
        for (const [job, count] of Object.entries(workflowJobs(text))) {
            all[`${file}#${job}`] = count
        }
    }

    return all
}

/**
 * @summary The runner jobs a base and a head start, and each entry that grew.
 * @param {Object<String, String>} base Workflow file name → YAML at the base
 * @param {Object<String, String>} head The same at the head
 * @returns {{base: Number, head: Number, grown: Object[]}} `grown` holds `{key, from, to}` for each `file#job` that
 * starts more runner jobs at the head, a new one with `from: 0`
 */
export function compareRunnerJobs(base, head) {
    const before = runnerJobs(base),
          after  = runnerJobs(head),
          total  = jobs => Object.values(jobs).reduce((sum, count) => sum + count, 0);

    return {
        base : total(before),
        head : total(after),
        grown: Object.entries(after)
            .filter(([key, count]) => count > (before[key] ?? 0))
            .map(([key, to]) => ({key, from: before[key] ?? 0, to}))
    }
}

/**
 * @summary A repository's workflow files, at a git ref or in the working tree.
 *
 * Only an absent `.github/workflows` reads as no files, since such a tree starts no jobs. Any other failure throws:
 * an unread side would compare as zero jobs and pass.
 * @param {Object} options
 * @param {String} [options.root=process.cwd()] The repository root
 * @param {String} [options.ref] A commit-ish to read from; omitted, the working tree
 * @returns {Object<String, String>} File name → YAML
 * @throws {Error} When `ref` is not a commit, or a workflow cannot be read
 */
export function readWorkflows({root = process.cwd(), ref} = {}) {
    const dir   = '.github/workflows',
          files = {};

    if (ref) {
        const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8', maxBuffer: 2 ** 26});

        git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);

        if (spawnSync('git', ['cat-file', '-e', `${ref}:${dir}`], {cwd: root}).status !== 0) {
            return files
        }

        for (const name of git('ls-tree', '--name-only', `${ref}:${dir}`).split('\n').filter(name => WORKFLOW_FILE.test(name))) {
            files[name] = git('show', `${ref}:${dir}/${name}`)
        }

        return files
    }

    if (!existsSync(join(root, dir))) {
        return files
    }

    for (const name of readdirSync(join(root, dir)).filter(name => WORKFLOW_FILE.test(name))) {
        files[name] = readFileSync(join(root, dir, name), 'utf8')
    }

    return files
}
