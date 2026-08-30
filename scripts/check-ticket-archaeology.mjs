#!/usr/bin/env node
/**
 * @summary Rejects tracking and review archaeology in durable JavaScript comments.
 *
 * The command runs in a consuming repository, not in this package checkout. It scans every selected
 * tracked `.mjs` file in full so touching a file also retires older archaeology in that file.
 * String literals remain valid homes for executable fixtures and URLs; comments and JSDoc must
 * describe current behavior instead of the process that produced it.
 */

import {parse}                         from 'acorn';
import {execFileSync}                  from 'node:child_process';
import {readFileSync, realpathSync}    from 'node:fs';
import {isAbsolute, relative, resolve} from 'node:path';
import process                         from 'node:process';
import {parseArgs}                     from 'node:util';
import {fileURLToPath}                 from 'node:url';

export const DEFAULT_IGNORES = Object.freeze([
    '.git', 'coverage', 'dist', 'dist-artifacts', 'node_modules'
]);

const
    NAMED_TRACKING_PATTERNS = Object.freeze([
        /\b(?:issue|ticket|bug|PR|pull[ -]request|Epic|Discussion)\s*(?:[:=]\s*)?#?\s*\d+\b/i,
        /\bADR[-\s]?\d+\b/i
    ]),
    REVIEW_ARCHAEOLOGY_PATTERNS = Object.freeze([
        /\bRA[-\s]?\d+\b/i,
        /\b(?:review|PR)\s+(?:round|cycle)\s*#?\d+\b/i,
        /\b(?:first|second|third|previous|prior)\s+review\s+(?:round|cycle)\b/i,
        /\bround\s*#?\d+\s+(?:review|reviewer|approval|disposition|requested?\s+changes?)\b/i,
        /\bround\s*#?\d+\b[^\n]{0,100}\b(?:approved|reviewed|shipped|stayed\s+green)\b/i,
        /\b(?:earlier|previous|prior)\s+rounds?\b/i
    ]),
    NUMERIC_REF_RE = /#(\d+)(?![A-Za-z0-9_])/g,
    CSS_COLOR_ESCAPE_RE = /#(\d{3}|\d{4}|\d{6}|\d{8})\s*\[not-ticket-ref:\s*css-color\]/gi,
    CSS_COLOR_CONTEXT_RE = /(?:\bCSS\s+color\b|\b(?:background(?:-color)?|border(?:-color)?|color|fill|stroke)\s*(?::|=))\s*$/i,
    ANY_TYPED_ESCAPE_RE = /\[not-ticket-ref:[^\]]*\]/gi,
    LEGACY_ESCAPE_RE = /\bticket-ref-ok\b/i,
    __filename = fileURLToPath(import.meta.url);

/** @summary Exact numeric hashes carrying the typed CSS-color escape on the same token. */
function escapedColorOffsets(comment) {
    const offsets = new Set();

    CSS_COLOR_ESCAPE_RE.lastIndex = 0;
    for (const match of comment.matchAll(CSS_COLOR_ESCAPE_RE)) {
        if (CSS_COLOR_CONTEXT_RE.test(comment.slice(Math.max(0, match.index - 48), match.index))) {
            offsets.add(match.index)
        }
    }

    return offsets
}

/** @summary Every typed false-positive marker, valid or not, on one comment row. */
function typedEscapeMarkers(comment) {
    ANY_TYPED_ESCAPE_RE.lastIndex = 0;

    return [...comment.matchAll(ANY_TYPED_ESCAPE_RE)]
}

/** @summary JavaScript comments and JSDoc parsed from syntax rather than inferred punctuation. */
function extractJavaScriptComments(content) {
    const rows = [];

    parse(content, {
        allowHashBang: true,
        ecmaVersion  : 'latest',
        locations    : true,
        sourceType   : 'module',
        onComment(block, text, start, end, startLoc) {
            text.split('\n').forEach((value, offset) => rows.push({line: startLoc.line + offset, text: value}))
        }
    });

    return rows
}

/**
 * @summary Finds decay-prone tracking or review anchors in comment and JSDoc context.
 * @param {String} content
 * @returns {{line: Number, text: String, kinds: String[]}[]}
 */
export function findArchaeology(content) {
    const hits = [];

    extractJavaScriptComments(content).forEach(row => {
        const comment = row.text,
              kinds   = new Set(),
              escaped = escapedColorOffsets(comment),
              markers = typedEscapeMarkers(comment);

        if (!comment) return;

        if (NAMED_TRACKING_PATTERNS.some(pattern => pattern.test(comment))) kinds.add('tracking-reference');
        if (REVIEW_ARCHAEOLOGY_PATTERNS.some(pattern => pattern.test(comment))) kinds.add('review-archaeology');
        if (LEGACY_ESCAPE_RE.test(comment) || markers.length !== escaped.size) kinds.add('invalid-escape');

        NUMERIC_REF_RE.lastIndex = 0;
        for (const match of comment.matchAll(NUMERIC_REF_RE)) {
            if (!escaped.has(match.index)) kinds.add('tracking-reference')
        }

        if (kinds.size) hits.push({line: row.line, text: comment.trim(), kinds: [...kinds]})
    });

    return hits
}

/** @summary Whether a repository-relative path belongs to a generated or projected tree. */
export function isIgnoredPath(file, ignores = DEFAULT_IGNORES) {
    const parts = file.replaceAll('\\', '/').replace(/^\.\//, '').split('/');

    return ignores.some(ignore => parts.includes(ignore))
}

/** @summary Whether a repository-relative path is a durable JavaScript module in scan scope. */
export function isInScopePath(file, ignores = DEFAULT_IGNORES) {
    return file.endsWith('.mjs') && !isIgnoredPath(file, ignores)
}

/** @summary Writes the bounded CLI usage contract. */
function printHelp(write) {
    write([
        'Usage: neo-agent-skills-check-ticket-archaeology [options] [files...]',
        '',
        'Options:',
        '  -b, --base <ref>     Scan changed tracked .mjs files against a merge base.',
        '  -i, --ignore <list>  Comma-separated ignored path segments.',
        '  -q, --quiet          Suppress individual violation lines.',
        '  -h, --help           Show this help.'
    ].join('\n'))
}

/** @summary Executes one Git read against the caller repository. */
function git(args, cwd) {
    return execFileSync('git', args, {cwd, encoding: 'utf8'})
}

/** @summary Normalizes one supplied path and refuses paths outside the caller repository. */
function repoRelative(file, gitRoot) {
    const normalized = isAbsolute(file) ? relative(gitRoot, file) : file;

    if (normalized === '..' || normalized.startsWith('../')) {
        throw new Error(`Path is outside the caller repository: ${file}`)
    }

    return normalized.replaceAll('\\', '/').replace(/^\.\//, '')
}

/**
 * @summary Runs the portable archaeology gate against one caller repository.
 * @param {String[]} argv
 * @param {{cwd?: String, out?: Function, error?: Function}} options
 * @returns {Number} Process exit code.
 */
export function run(argv = process.argv.slice(2), {cwd = process.cwd(), out = console.log, error = console.error} = {}) {
    let parsed;

    try {
        parsed = parseArgs({
            args            : argv,
            allowPositionals: true,
            strict          : true,
            options         : {
                base  : {type: 'string', short: 'b'},
                help  : {type: 'boolean', short: 'h'},
                ignore: {type: 'string', short: 'i', default: DEFAULT_IGNORES.join(',')},
                quiet : {type: 'boolean', short: 'q', default: false}
            }
        })
    } catch (cause) {
        error(`check-ticket-archaeology: ${cause.message}`);
        return 2
    }

    if (parsed.values.help) {
        printHelp(out);
        return 0
    }

    let gitRoot;

    try {
        gitRoot = git(['rev-parse', '--show-toplevel'], cwd).trim()
    } catch {
        error('check-ticket-archaeology: caller cwd is not inside a Git repository.');
        return 2
    }

    const ignores = parsed.values.ignore.split(',').map(value => value.trim()).filter(Boolean);
    let files, selection;

    try {
        if (parsed.values.base) {
            files = git(['diff', '--name-only', '-z', '--diff-filter=ACMR', `${parsed.values.base}...HEAD`], gitRoot)
                .split('\0').filter(Boolean);
            selection = `changed vs ${parsed.values.base}`
        } else if (parsed.positionals.length) {
            files     = parsed.positionals.map(file => repoRelative(file, gitRoot));
            selection = 'supplied paths'
        } else {
            files = git(['ls-files', '-z', '--', '*.mjs'], gitRoot).split('\0').filter(Boolean);
            selection = 'all tracked .mjs files'
        }
    } catch (cause) {
        error(`check-ticket-archaeology: file selection failed: ${cause.message}`);
        return 2
    }

    files = [...new Set(files.map(file => repoRelative(file, gitRoot)).filter(file => isInScopePath(file, ignores)))].sort();

    const failures = [],
          unreadable = [],
          unparsable = [],
          realRoot   = realpathSync(gitRoot);

    for (const file of files) {
        let content;

        try {
            const full     = resolve(gitRoot, file),
                  realFile = realpathSync(full),
                  escaped  = relative(realRoot, realFile);

            if (isAbsolute(escaped) || escaped === '..' || escaped.startsWith('../')) {
                throw new Error('tracked path resolves outside the caller repository')
            }

            content = readFileSync(realFile, 'utf8')
        } catch (cause) {
            unreadable.push(`${file}: ${cause.message}`);
            continue
        }

        try {
            findArchaeology(content).forEach(hit => failures.push({file, ...hit}))
        } catch (cause) {
            unparsable.push(`${file}: ${cause.message}`)
        }
    }

    if (unreadable.length) {
        error(`check-ticket-archaeology: ${unreadable.length} selected file(s) could not be read (${selection}).`);
        if (!parsed.values.quiet) unreadable.forEach(message => error(`  ${message}`));
        return 2
    }

    if (unparsable.length) {
        error(`check-ticket-archaeology: ${unparsable.length} selected module(s) could not be parsed (${selection}).`);
        if (!parsed.values.quiet) unparsable.forEach(message => error(`  ${message}`));
        return 2
    }

    if (failures.length) {
        error(`check-ticket-archaeology: ${failures.length} decay-prone comment ref(s) across ${files.length} file(s) (${selection}).`);
        if (!parsed.values.quiet) failures.forEach(hit => error(`  ${hit.file}:${hit.line}: ${hit.text}`));
        error('Durable comments and JSDoc describe current behavior. Put tracking and review provenance in the PR or commit, not source comments.');
        return 1
    }

    out(`check-ticket-archaeology: ${files.length} file(s), 0 violations (${selection}).`);
    return 0
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(__filename)) {
    process.exitCode = run()
}
