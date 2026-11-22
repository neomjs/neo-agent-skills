#!/usr/bin/env node
/**
 * @summary Default-deny publish lint for a public spoke. `docs/public-manifest.json` names every guide the hub may
 * publish; this lint fails closed on any guide, route or line that would publish what it must not. Each public spoke's
 * CI runs it, and the hub materializes only what passed.
 *
 * **Structure.** The manifest declares `schema`, `spoke`, `treeFile`, `entries` and exactly one mount shape:
 *   - `treeMount`, one folder the hub creates. Leaf ids are spoke-local, so a leaf's route is
 *     `/learn/<treeMount.id>/<leaf id>`.
 *   - `treeMounts`, folders the spoke's own tree holds. Leaf ids are already site paths, so a leaf's route is
 *     `/learn/<leaf id>`, and each mount must match one of those folder nodes.
 * Tree leaves and manifest entries match 1:1. Each entry's file is a normalized `learn/<leaf id>.md` on disk, outside
 * every `excludedDirs` prefix, and its route is unique. Every tree node has a unique string id, a string name, and a
 * parent that is a folder of the tree.
 *
 * **Content,** for every admitted guide: no real host path (`/Users/<name>/`, `/home/<name>/`, `C:\Users\<name>\`, or
 * a `file://` URL to one), no private-repository identifier, no forbidden term, and no relative link outside code that
 * misses the admitted set. A link may leave `learn/` only into a `sourceLinkRoots` directory, and only to a path git
 * tracks there: a file on disk may be a local overlay the hub never receives.
 *
 * **Forbidden terms** are client names, so no public repository can hold them. They arrive comma-separated in
 * `NEO_PUBLIC_DOCS_FORBIDDEN_TERMS`. A finding names a term by its position in that list, never by its text, and every
 * run prints how many terms it checked, so a run that checked none says so.
 */

import {execFileSync}                                     from 'node:child_process';
import {existsSync, readFileSync, realpathSync, statSync} from 'node:fs';
import path                                               from 'node:path';
import process                                            from 'node:process';
import {fileURLToPath}                                    from 'node:url';
import {parseArgs}                                        from 'node:util';

/**
 * The manifest schema this lint reads.
 * @member {String} SCHEMA
 */
export const SCHEMA = 'public-manifest.v1';

/**
 * The environment variable that carries the forbidden terms.
 * @member {String} FORBIDDEN_TERMS_ENV
 */
export const FORBIDDEN_TERMS_ENV = 'NEO_PUBLIC_DOCS_FORBIDDEN_TERMS';

const
    // A real home directory, root-anchored or inside a `file://` URL. Placeholders (`<you>`, `{user}`, `you`, `user`,
    // `username`) and repo-relative segments such as `view/home/MainContainer.mjs` pass.
    HOST_PATHS = [
        [/(?:^|[\s`'"(=:]|file:\/\/)(\/(?:Users|home)\/(?![<{]|(?:you|user|username)(?:\/|\b))[A-Za-z0-9._-]+\/[^\s`'")>\]]*)/g, 'host filesystem path'],
        [/(?:^|[\s`'"(=:]|file:\/\/\/?)([A-Za-z]:[\\/]Users[\\/](?![<{]|(?:you|user|username)(?:[\\/]|\b))[A-Za-z0-9._-]+[\\/][^\s`'")>\]]*)/g, 'Windows host filesystem path']
    ],
    PRIVATE_REPO = /\bneomjs\/(?:business|neo-stage|neo-pro)\b/gi,
    INLINE_CODE  = /`[^`\n]+`/g,
    // No bracket or parenthesis inside a target, so a match never runs into the next `](`: one read per character
    LINK_TARGET  = /\]\(([^()[\]\s]+)\)/g,
    EXTERNAL     = /^(?:https?:|mailto:)/i,
    FENCE        = /^ {0,3}(`{3,}|~{3,})/;

/**
 * @param {*} value
 * @returns {Boolean} a normalized relative path that stays inside the repository
 */
const isNormalizedPath = value => typeof value === 'string' && value !== '' && value !== '.' && !value.startsWith('/') &&
    value !== '..' && !value.startsWith('../') && path.posix.normalize(value) === value;

/**
 * @param {String} dir
 * @returns {String} `dir` with one trailing slash, so `ai/` never matches `aix/`
 */
const asDirPrefix = dir => dir.endsWith('/') ? dir : `${dir}/`;

/**
 * @summary The lines of a Markdown text with fenced code blanked, so a finding keeps its line number. A fence closes on
 * the character that opened it, at least as long.
 * @param {String} markdown
 * @returns {String[]}
 */
export function proseLines(markdown) {
    let fence = null;

    return String(markdown).split('\n').map(raw => {
        const line  = raw.replace(/\r$/, ''),
              match = FENCE.exec(line);

        if (fence) {
            if (match && match[1][0] === fence[0] && match[1].length >= fence.length) fence = null;

            return ''
        }

        if (match) {
            fence = match[1];

            return ''
        }

        return line
    })
}

/**
 * @summary The forbidden terms an environment carries: comma-separated, trimmed, empty ones dropped.
 * @param {Object} [env=process.env]
 * @returns {String[]}
 */
export function forbiddenTermsFrom(env = process.env) {
    return (env[FORBIDDEN_TERMS_ENV] ?? '').split(',').map(term => term.trim()).filter(Boolean)
}

/**
 * @summary The reasons a manifest header cannot be read further. Empty when it can.
 * @param {Object} manifest
 * @param {String} spoke the `owner/name` this repository is
 * @returns {String[]}
 */
export function checkHeader(manifest, spoke) {
    const errors                  = [],
          {treeMount, treeMounts} = manifest ?? {};

    if (manifest?.schema !== SCHEMA) errors.push(`schema must be "${SCHEMA}" (got ${JSON.stringify(manifest?.schema)})`);
    if (manifest?.spoke !== spoke) errors.push(`spoke must be "${spoke}" (got ${JSON.stringify(manifest?.spoke)})`);
    if (!isNormalizedPath(manifest?.treeFile)) errors.push('treeFile must be a normalized relative path');

    if ((treeMount === undefined) === (treeMounts === undefined)) {
        errors.push('declare exactly one of treeMount and treeMounts')
    } else if (treeMount !== undefined && !(isNormalizedPath(treeMount?.id) && !treeMount.id.endsWith('/') && typeof treeMount.name === 'string')) {
        errors.push('treeMount must declare a normalized string id and a string name')
    } else if (treeMounts !== undefined && !(Array.isArray(treeMounts) && treeMounts.length > 0 &&
        treeMounts.every(mount => typeof mount?.id === 'string' && typeof mount.name === 'string'))) {
        errors.push('treeMounts must be a non-empty array of {parentId, id, name}')
    }

    if (!Array.isArray(manifest?.entries) || manifest.entries.length === 0) errors.push('entries must be a non-empty array');

    for (const [field, insideLearn] of [['excludedDirs', true], ['sourceLinkRoots', false]]) {
        const dirs = manifest?.[field];

        if (dirs !== undefined && !(Array.isArray(dirs) && dirs.every(dir => isNormalizedPath(dir) && asDirPrefix(dir).startsWith('learn/') === insideLearn))) {
            errors.push(`${field} must be an array of normalized directories ${insideLearn ? 'inside' : 'outside'} learn/`)
        }
    }

    return errors
}

/**
 * @summary The tree's node shape and hierarchy, and each `treeMounts` entry's match to a folder node.
 * @param {Object[]} nodes the tree's `data`
 * @param {Object[]|undefined} mounts the manifest's `treeMounts`
 * @param {String} treeFile how findings name the tree
 * @returns {{errors: String[], leafIdByFile: Map<String, String>}}
 */
export function checkTree(nodes, mounts, treeFile) {
    const errors       = [],
          byId         = new Map(),
          leafIdByFile = new Map();

    nodes.forEach((node, index) => {
        if (typeof node?.id !== 'string' || typeof node.name !== 'string') {
            errors.push(`${treeFile}: data[${index}] needs a string id and name`)
        } else if (byId.has(node.id)) {
            errors.push(`${treeFile}: duplicate node id "${node.id}"`)
        } else {
            byId.set(node.id, node);

            if (node.isLeaf !== false) leafIdByFile.set(`learn/${node.id}.md`, node.id)
        }
    });

    for (const node of byId.values()) {
        if (node.parentId != null && byId.get(node.parentId)?.isLeaf !== false) {
            errors.push(`${treeFile}: node "${node.id}" names parentId "${node.parentId}", which is no folder of the tree`)
        }
    }

    for (const mount of mounts ?? []) {
        const node = byId.get(mount.id);

        if (node?.isLeaf !== false || node.parentId !== mount.parentId || node.name !== mount.name) {
            errors.push(`treeMounts entry "${mount.id}" matches no folder node of ${treeFile} with the same parentId and name`)
        }
    }

    return {errors, leafIdByFile}
}

/**
 * @summary A lazy test of what git tracks under `root`: each tracked file, and each directory holding one. Only a link
 * into a source root asks it, so a spoke without such links runs without git.
 * @param {String} root
 * @returns {Function} `repoRelativePath => Boolean`. It throws when `root` is not a git checkout.
 */
function trackedPaths(root) {
    let paths = null;

    return relative => {
        if (!paths) {
            paths = new Set();

            const listing = execFileSync('git', ['ls-files', '-z'], {cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});

            for (const file of listing.split('\0').filter(Boolean)) {
                paths.add(file);

                for (let slash = file.indexOf('/'); slash !== -1; slash = file.indexOf('/', slash + 1)) paths.add(file.slice(0, slash))
            }
        }

        return paths.has(relative)
    }
}

/**
 * @summary Every finding for one spoke checkout: the manifest header, its tree, each entry, and the content of every
 * guide the manifest admits.
 * @param {Object} options
 * @param {String} options.root the spoke checkout
 * @param {String} options.spoke the `owner/name` the manifest must declare
 * @param {String} [options.manifestFile='docs/public-manifest.json'] relative to `root`
 * @param {String[]} [options.forbiddenTerms=[]] matched case-insensitively at word boundaries
 * @returns {{errors: String[], entryCount: Number, routes: String[]}}
 */
export function lintPublicDocs({root, spoke, manifestFile = 'docs/public-manifest.json', forbiddenTerms = []}) {
    const read = (file, label) => {
        if (!existsSync(path.resolve(root, file))) return {error: `missing ${label} ${file}`};

        try {
            return {value: JSON.parse(readFileSync(path.resolve(root, file), 'utf8'))}
        } catch (error) {
            return {error: `${file} is not valid JSON: ${error.message}`}
        }
    };

    const manifest = read(manifestFile, 'manifest');

    if (manifest.error) return {errors: [manifest.error], entryCount: 0, routes: []};

    const header = checkHeader(manifest.value, spoke);

    if (header.length > 0) return {errors: header.map(error => `${manifestFile}: ${error}`), entryCount: 0, routes: []};

    const {entries, excludedDirs = [], sourceLinkRoots = [], treeFile, treeMount, treeMounts} = manifest.value,
          tree = read(treeFile, 'treeFile');

    if (tree.error) return {errors: [tree.error], entryCount: 0, routes: []};
    if (!Array.isArray(tree.value?.data)) return {errors: [`${treeFile} needs a top-level "data" array`], entryCount: 0, routes: []};

    const {errors, leafIdByFile} = checkTree(tree.value.data, treeMounts, treeFile),
          prefix                 = treeMount ? `/learn/${treeMount.id}/` : '/learn/',
          excluded               = excludedDirs.map(asDirPrefix),
          sourceRoots            = sourceLinkRoots.map(asDirPrefix),
          files                  = new Set(),
          routes                 = new Set(),
          admitted               = new Map();

    entries.forEach((entry, index) => {
        const label = `entries[${index}]`;

        if (typeof entry?.file !== 'string' || typeof entry.route !== 'string') {
            errors.push(`${label}: needs a string "file" and "route"`);
            return
        }

        const {file, route} = entry,
              leafId        = leafIdByFile.get(file),
              absolute      = path.resolve(root, file);

        if (!isNormalizedPath(file) || !file.startsWith('learn/') || !file.endsWith('.md')) {
            errors.push(`${label}: file "${file}" must be a normalized "learn/<path>.md"`);
            return
        }

        if (excluded.some(dir => file.startsWith(dir))) errors.push(`${label}: "${file}" is an excluded internal record and cannot be published`);
        if (files.has(file)) errors.push(`${label}: duplicate file "${file}"`);
        files.add(file);

        if (!route.startsWith(prefix) || route.endsWith('/') || route.endsWith('.md') || route.includes('..')) {
            errors.push(`${label}: invalid route "${route}" (must start with "${prefix}", without a trailing "/" or ".md")`)
        } else if (leafId !== undefined && route !== `${prefix}${leafId}`) {
            errors.push(`${label}: route "${route}" does not match the tree's route "${prefix}${leafId}"`)
        }

        if (routes.has(route)) errors.push(`${label}: duplicate route "${route}"`);
        routes.add(route);

        if (existsSync(absolute) && statSync(absolute).isFile()) admitted.set(absolute, file);
        else errors.push(`${label}: missing Markdown file "${file}"`)
    });

    for (const file of leafIdByFile.keys()) {
        if (!files.has(file)) errors.push(`${treeFile}: leaf "${file}" is missing from ${manifestFile}`)
    }

    for (const file of files) {
        if (!leafIdByFile.has(file)) errors.push(`${manifestFile}: "${file}" is not a leaf in ${treeFile}`)
    }

    const terms     = forbiddenTerms.map(term => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')),
          isTracked = trackedPaths(root),
          allowed   = sourceRoots.length > 0 ? `a manifest-admitted guide or a tracked path under ${sourceRoots.join(', ')}` : 'a manifest-admitted guide';

    for (const [absolute, file] of admitted) {
        const markdown = readFileSync(absolute, 'utf8');

        markdown.split('\n').forEach((line, index) => {
            const at = `${file}:${index + 1}`;

            for (const [pattern, kind] of HOST_PATHS) {
                for (const {1: token} of line.matchAll(pattern)) errors.push(`${at}: forbidden ${kind} "${token}"`)
            }

            for (const {0: token} of line.matchAll(PRIVATE_REPO)) errors.push(`${at}: forbidden private-repository reference "${token}"`);

            terms.forEach((pattern, position) => {
                for (let hits = [...line.matchAll(pattern)].length; hits > 0; hits--) {
                    errors.push(`${at}: forbidden term ${position + 1} of ${FORBIDDEN_TERMS_ENV}`)
                }
            })
        });

        proseLines(markdown).forEach((line, index) => {
            for (const {1: raw} of line.replace(INLINE_CODE, code => ' '.repeat(code.length)).matchAll(LINK_TARGET)) {
                const target = raw.split(/[?#]/)[0];

                if (!target || EXTERNAL.test(raw) || raw.startsWith('#') || raw.startsWith('/')) continue;

                const resolved = path.resolve(path.dirname(absolute), target);

                if (admitted.has(resolved) || admitted.has(`${resolved}.md`)) continue;

                const relative = path.relative(root, resolved).split(path.sep).join('/');

                if (sourceRoots.some(dir => `${relative}/`.startsWith(dir)) && isTracked(relative)) continue;

                errors.push(`${file}:${index + 1}: broken relative Markdown link "${target}" (must resolve to ${allowed})`)
            }
        })
    }

    return {errors, entryCount: entries.length, routes: [...routes]}
}

/**
 * @summary Runs the lint and reports it. Returns the exit code instead of exiting, so tests drive it directly.
 * @param {Object} [options={}]
 * @param {String} options.spoke
 * @param {String} [options.root=process.cwd()]
 * @param {String} [options.manifest] relative to `root`; defaults to `docs/public-manifest.json`
 * @param {String[]} [options.forbiddenTerms] defaults to the environment's
 * @returns {{exitCode: Number, errors: String[], entryCount: Number, routes: String[]}}
 */
export function runLint({spoke, root = process.cwd(), manifest, forbiddenTerms = forbiddenTermsFrom()} = {}) {
    const result  = lintPublicDocs({root: path.resolve(root), spoke, manifestFile: manifest, forbiddenTerms}),
          summary = `[public-docs] ${spoke}: ${result.entryCount} guide(s), ${forbiddenTerms.length} forbidden term(s) checked`;

    if (result.errors.length === 0) {
        console.log(`${summary}: OK`);

        return {exitCode: 0, ...result}
    }

    for (const error of result.errors) console.error(`  ✗ ${error}`);

    console.error(`${summary}: FAILED, ${result.errors.length} finding(s)`);

    return {exitCode: 1, ...result}
}

/**
 * @summary Parses the CLI. `--spoke` is required unless `--help` is asked, and an unknown flag is refused.
 * @param {String[]} [argv=process.argv.slice(2)]
 * @returns {{spoke?: String, root?: String, manifest?: String, help?: Boolean}}
 */
export function readArgs(argv = process.argv.slice(2)) {
    const {values} = parseArgs({args: argv, options: {
        spoke   : {type: 'string'},
        root    : {type: 'string'},
        manifest: {type: 'string'},
        help    : {type: 'boolean', short: 'h'}
    }});

    if (!values.help && !values.spoke) throw new Error('--spoke <owner/name> is required');

    return {...values}
}

const USAGE = [
    'Usage: neo-agent-skills-public-docs --spoke <owner/name> [--root <dir>] [--manifest <path>]',
    '  Lints docs/public-manifest.json, its tree, and every guide it admits; fails closed on what must not publish.',
    '  --spoke <owner/name>  the repository the manifest must declare (required).',
    '  --root <dir>          the spoke checkout (default: the working directory).',
    '  --manifest <path>     the manifest, relative to the root (default: docs/public-manifest.json).',
    `  ${FORBIDDEN_TERMS_ENV}  comma-separated forbidden terms, such as client names.`
].join('\n');

// `--preserve-symlinks-main` keeps the link path in import.meta.url, so both sides are resolved before comparing
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    let options;

    try {
        options = readArgs()
    } catch (error) {
        console.error(`[public-docs] ${error.message}`);
        process.exit(2)
    }

    if (options.help) {
        console.log(USAGE);
        process.exit(0)
    }

    try {
        process.exit(runLint(options).exitCode)
    } catch (error) {
        console.error(`[public-docs] ${error.message}`);
        process.exit(2)
    }
}
