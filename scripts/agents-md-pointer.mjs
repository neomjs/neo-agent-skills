#!/usr/bin/env node
/**
 * @summary The pointer git keeps in a consumer's `AGENTS.md`, and the git filter that keeps it there.
 *
 * A consumer writes its generated rules into `AGENTS.md`, the path every coding agent reads, with
 * `neo-agent-skills-agents-md --pointer`. Git keeps only a pointer: `.gitattributes` routes `/AGENTS.md` through the
 * {@link AGENTS_MD_FILTER} filter, whose clean command runs this module's CLI when present (or answers the index's
 * pointer when the package is not installed) and answers any working copy with the pointer. The filter is required, so
 * a clean command that cannot run makes git refuse to store the file, never store it raw. Required binds the checkout
 * direction too, so its smudge writes the stored pointer unchanged. A clone that never installed shows the pointer,
 * which tells its reader where the rules come from: Git LFS's pattern.
 */

import {spawnSync}                from 'node:child_process';
import {existsSync, realpathSync} from 'node:fs';
import {join}                     from 'node:path';
import {fileURLToPath}            from 'node:url';
import {parseArgs}                from 'node:util';

/**
 * @summary The git filter driver a consumer's `.gitattributes` names for `/AGENTS.md`.
 * @member {String} AGENTS_MD_FILTER
 */
export const AGENTS_MD_FILTER = 'neo-agents-md';

/**
 * @summary The filtered path, relative to the top of the working tree.
 * @member {String} AGENTS_MD_PATH
 */
export const AGENTS_MD_PATH = 'AGENTS.md';

/**
 * @summary The pointer's first line, so a tool can tell the pointer from the generated rules.
 * @member {String} POINTER_MARKER
 */
export const POINTER_MARKER = '<!-- neo-agents-md: pointer -->';

/**
 * @summary The filter's `smudge` command: a checkout writes the stored pointer unchanged.
 * @member {String} SMUDGE_COMMAND
 */
export const SMUDGE_COMMAND = 'cat';

/**
 * @summary Refuses a repository name that would not survive as a word in the clean command git runs through `sh`.
 * @param {String} repo
 * @returns {String}
 */
function checkRepo(repo) {
    if (typeof repo !== 'string' || !/^[\w.-]+$/.test(repo)) {
        throw new Error(`agents-md-pointer: --repo must name one repository, found '${repo}'`)
    }

    return repo
}

/**
 * @summary The committed content of a consumer's `AGENTS.md`.
 * @param {String} repo The consumer's repository, which the fork contributor's command names
 * @returns {String}
 */
export function pointerFor(repo) {
    return [
        POINTER_MARKER,
        'IMPORTANT: this file is generated. `npm install` writes the agent rules here and materializes the agent skills into `.agents/skills/`.',
        `Contributing from a fork without installing? \`npx -p neo-agent-skills neo-agent-skills-agents-md --repo ${checkRepo(repo)} --audience contributor\` prints the rules you follow.`,
        ''
    ].join('\n')
}

/**
 * @summary The filter's `clean` command. Git runs it from the top of the working tree, where `node_modules/.bin` is
 * not on its path, so it names this module by path when present, or drains stdin and answers the pointer the index
 * already holds when the module is absent.
 * @param {String} repo
 * @returns {String}
 */
export function cleanCommand(repo) {
    return `if [ -f node_modules/neo-agent-skills/scripts/agents-md-pointer.mjs ]; then node node_modules/neo-agent-skills/scripts/agents-md-pointer.mjs --repo ${checkRepo(repo)}; else cat >/dev/null; git cat-file blob :AGENTS.md; fi`
}

/**
 * @summary Runs git in `root` and answers its exit status and trimmed stdout. A git that cannot be launched answers
 * status `null`. Module-private: every caller names its own subcommand, so no argument from outside chooses one.
 * @param {String} root
 * @param {String[]} args
 * @returns {{status: Number|null, stdout: String}}
 * @private
 */
function runGit(root, args) {
    const {error, status, stdout} = spawnSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});

    return {status: error ? null : status, stdout: (stdout ?? '').trim()}
}

/**
 * @summary Makes sure the filter is registered, with its smudge, and required, before the rules are written. A
 * registration that cannot be established throws before `AGENTS.md` is touched. A root that is not a git checkout has
 * nothing to register.
 * @param {Object} options
 * @param {String} options.root The top of the working tree
 * @param {String} options.repo
 * @param {Function} [options.git] `args => {status, stdout}` in `root`
 * @returns {String|null} `'present'` or `'registered'`, or `null` outside a checkout.
 */
export function ensureFilter({root, repo, git = args => runGit(root, args)}) {
    if (!existsSync(join(root, '.git'))) {
        return null
    }

    const
        wanted  = {
            [`filter.${AGENTS_MD_FILTER}.clean`]   : cleanCommand(repo),
            [`filter.${AGENTS_MD_FILTER}.smudge`]  : SMUDGE_COMMAND,
            [`filter.${AGENTS_MD_FILTER}.required`]: 'true'
        },
        missing = () => Object.entries(wanted).filter(([key, value]) => git(['config', '--local', '--get', key]).stdout !== value);

    if (missing().length < 1) {
        return 'present'
    }

    missing().forEach(([key, value]) => git(['config', '--local', key, value]));

    const unset = missing().map(([key]) => key);

    if (unset.length > 0) {
        throw new Error(`agents-md-pointer: cannot register ${new Intl.ListFormat('en').format(unset)}, so AGENTS.md is left as it is: without the filter git would store the generated rules`)
    }

    return 'registered'
}

/**
 * @summary Lets the index re-read the regenerated `AGENTS.md` through the filter, so `git status` stays clean,
 * without ever writing file content to the index. Git trusts a changed size without reading the file, so the entry
 * is first re-set to its own blob with its cached stat cleared; the refresh then compares the file through the
 * filter and records the stat only if it matches. A failing filter leaves the index as it was and throws.
 * @param {Object} options
 * @param {String} options.root The top of the working tree
 * @param {Function} [options.git] `args => {status, stdout}` in `root`
 * @returns {Number|null} The refresh's exit status, or `null` when there is nothing to refresh.
 */
export function refresh({root, git = args => runGit(root, args)}) {
    if (!existsSync(join(root, '.git'))) {
        return null
    }

    const [mode, blob, stage] = git(['ls-files', '--stage', '--', AGENTS_MD_PATH]).stdout.split(/\s+/);

    // Untracked here, or mid-merge: there is no single entry to refresh
    if (!blob || stage !== '0') {
        return null
    }

    git(['update-index', '--cacheinfo', `${mode},${blob},${AGENTS_MD_PATH}`]);

    const {status} = git(['update-index', '-q', '--refresh']);

    if (status !== 0) {
        throw new Error(`agents-md-pointer: git could not run the ${AGENTS_MD_FILTER} filter (update-index exited ${status}); the index keeps the pointer, and git shows AGENTS.md as changed until the filter runs`)
    }

    return status
}

// The clean filter. Git writes the working copy to stdin: drain it, so git never meets a closed pipe, then answer
// the pointer. Canonicalized on both sides, as in generate-agents-md.mjs.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    const {repo} = parseArgs({options: {repo: {type: 'string'}}, strict: true}).values,
          pointer = pointerFor(repo);

    process.stdin.resume();
    process.stdin.on('end', () => process.stdout.write(pointer))
}
