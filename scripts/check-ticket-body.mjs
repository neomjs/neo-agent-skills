#!/usr/bin/env node
/**
 * @summary Validates a GitHub issue body against the Design-authority gate and its three defect excuses.
 *
 * Pure and transport-free: receives a ticket body and returns findings without reading the network.
 *
 * Two arms (enforced on every non-epic agent ticket):
 * 1. The `Design authority:` line is present in content using one of the three grammars from
 *    `.agents/skills/ticket-create/references/design-authority.md`:
 *    - `Design authority: "<the record sentence, quoted>"`
 *    - `Design authority: none found (searched: …)`
 *    - `Design authority: n/a — <reason>`
 * 2. The line is absent, and the body carries at least one of the three defect excuses:
 *    - `crash`: a fenced code block containing a crash, error, or stack trace;
 *    - `red`: a spec/test path or failing test title in the Problem/Context sections;
 *    - `jsdoc`: a quoted `@`-JSDoc line showing the contradicted contract sentence.
 *
 * When neither arm holds, the guard exits non-zero and points to `design-authority.md`.
 */

import {readFileSync, realpathSync} from 'node:fs';
import process                      from 'node:process';
import {parseArgs}                  from 'node:util';
import {fileURLToPath}              from 'node:url';

/**
 * Canonical skill reference path named in failure diagnostics.
 * @member {String} DESIGN_AUTHORITY_REF
 */
export const DESIGN_AUTHORITY_REF = '.agents/skills/ticket-create/references/design-authority.md';

const
    INDENT_CODE_RE = /^(?: {4,}|\t)/,
    CRASH_TOKENS   = Object.freeze([
        'Error:',
        'TypeError:',
        'ReferenceError:',
        'SyntaxError:',
        'RangeError:',
        'URIError:',
        'EvalError:',
        'AssertionError',
        'ERR_',
        'Uncaught ',
        'Exception',
        'Segmentation fault',
        'FATAL',
        'Command exited with code',
        'npm ERR!',
        'FAIL ',
        'FAILED'
    ]),
    JSDOC_TAGS     = Object.freeze([
        '@summary',
        '@param',
        '@returns',
        '@return',
        '@throws',
        '@member',
        '@class',
        '@config',
        '@function',
        '@fires',
        '@see',
        '@default',
        '@type',
        '@example',
        '@description'
    ]),
    STOP_SECTIONS  = Object.freeze([
        'the architectural reality',
        'architectural reality',
        'the fix',
        'proposed fix',
        'fix',
        'acceptance criteria',
        'out of scope',
        'avoided traps',
        'related'
    ]);

/**
 * @summary Parses a Markdown fence line (` ``` ` or ` ~~~ ` with at most 3 leading spaces) in linear time.
 * @param {String} line
 * @returns {{fence: String, info: String}|null}
 */
function parseFenceLine(line) {
    let spaces = 0;
    while (spaces < 4 && spaces < line.length && line[spaces] === ' ') {
        spaces++
    }
    if (spaces > 3 || spaces >= line.length) return null;

    const ch = line[spaces];
    if (ch !== '`' && ch !== '~') return null;

    let runLen = 0;
    while (spaces + runLen < line.length && line[spaces + runLen] === ch) {
        runLen++
    }
    if (runLen < 3) return null;

    return {
        fence: line.slice(spaces, spaces + runLen),
        info : line.slice(spaces + runLen).trim()
    }
}

/**
 * @summary Extracts a Markdown heading's normalized lowercase title in linear time.
 * @param {String} line
 * @returns {String|null}
 */
function parseHeadingTitle(line) {
    let spaces = 0;
    while (spaces < 4 && spaces < line.length && line[spaces] === ' ') {
        spaces++
    }
    if (spaces > 3 || spaces >= line.length) return null;

    let hashes = 0;
    while (hashes < 7 && spaces + hashes < line.length && line[spaces + hashes] === '#') {
        hashes++
    }
    if (hashes < 1 || hashes > 6) return null;

    const after = line.slice(spaces + hashes);
    if (!after || (after[0] !== ' ' && after[0] !== '\t')) return null;

    const title = after.replaceAll('`', '').trim().toLowerCase();
    return title || null
}

/**
 * @summary Extracts prose lines outside fenced and indented code blocks.
 * @param {String} [body='']
 * @returns {String[]}
 */
export function markdownContentLines(body = '') {
    const
        lines = String(body).split('\n'),
        out   = [];

    let fence = null;

    for (const rawLine of lines) {
        const
            line   = rawLine.replace(/\r$/, ''),
            opener = parseFenceLine(line);

        if (fence) {
            if (opener && opener.fence[0] === fence[0] && opener.fence.length >= fence.length && !opener.info) {
                fence = null
            }
            continue
        }

        if (opener) {
            fence = opener.fence;
            continue
        }

        if (INDENT_CODE_RE.test(line)) continue;

        out.push(line)
    }

    return out
}

/**
 * @summary Extracts fenced code blocks (`info` string and inner `text`) from a Markdown body.
 * @param {String} [body='']
 * @returns {Array<{info: String, text: String}>}
 */
export function fencedBlocks(body = '') {
    const
        lines  = String(body).split('\n'),
        blocks = [];

    let active = null;

    for (const rawLine of lines) {
        const
            line   = rawLine.replace(/\r$/, ''),
            opener = parseFenceLine(line);

        if (active) {
            if (opener && opener.fence[0] === active.fence[0] && opener.fence.length >= active.fence.length && !opener.info) {
                blocks.push({info: active.info, text: active.lines.join('\n')});
                active = null;
                continue
            }
            active.lines.push(line);
            continue
        }

        if (opener) {
            active = {fence: opener.fence, info: opener.info.toLowerCase(), lines: []}
        }
    }

    if (active) {
        blocks.push({info: active.info, text: active.lines.join('\n')})
    }

    return blocks
}

/**
 * @summary Collects all quoted or backticked substrings within a single line.
 * @param {String} line
 * @returns {String[]}
 */
function extractQuotedSpans(line) {
    const
        spans = [],
        pairs = [
            ['"', '"'],
            ["'", "'"],
            ['\u201c', '\u201d'],
            ['`', '`']
        ];

    for (const [open, close] of pairs) {
        let pos = 0;

        while (pos < line.length) {
            const start = line.indexOf(open, pos);
            if (start === -1) break;

            const end = line.indexOf(close, start + open.length);
            if (end === -1) break;

            const inner = line.slice(start + open.length, end).trim();
            if (inner) spans.push(inner);

            pos = end + close.length
        }
    }

    return spans
}

/**
 * @summary Checks whether a ticket body carries a valid `Design authority:` line in content.
 * @param {String} [body='']
 * @returns {Boolean}
 */
export function hasDesignAuthorityLine(body = '') {
    const lines = markdownContentLines(body);

    for (const rawLine of lines) {
        let text = rawLine.trim();
        if (!text || text.startsWith('|')) continue;

        if (text.startsWith('- ') || text.startsWith('* ') || text.startsWith('+ ')) {
            text = text.slice(2).trimStart()
        }

        const normalized = text.replaceAll('**', '').trimStart();
        if (!normalized.toLowerCase().startsWith('design authority:')) continue;

        const
            rest  = normalized.slice('design authority:'.length).trim(),
            lower = rest.toLowerCase();

        if (!rest) continue;

        if (lower.startsWith('none found')) {
            const sIdx = lower.indexOf('(searched:');
            if (sIdx !== -1) {
                const closeIdx = rest.indexOf(')', sIdx + 10);
                if (closeIdx !== -1) {
                    const searched = rest.slice(sIdx + 10, closeIdx).trim();
                    if (searched.length > 0 && searched !== '...' && searched !== '\u2026') {
                        return true
                    }
                }
            }
            continue
        }

        if (lower.startsWith('n/a')) {
            const tail = rest.slice(3).trimStart();
            if (tail.startsWith('\u2014') || tail.startsWith('-') || tail.startsWith(':')) {
                const reason = tail.slice(1).trim();
                if (reason.length >= 3) return true
            }
            continue
        }

        if (rest.startsWith('>') && rest.slice(1).trim().length >= 3) {
            return true
        }

        const quoted = extractQuotedSpans(rest);
        if (quoted.some(span => span.length >= 3)) {
            return true
        }
    }

    return false
}

/**
 * @summary Checks whether a line inside a fenced block looks like a stack trace frame.
 * @param {String} line
 * @returns {Boolean}
 */
function isStackFrameLine(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) return false;

    const rest = trimmed.slice(3).trim();
    return Boolean(rest) && (rest.includes('(') || rest.includes('/') || rest.includes('.mjs') || rest.includes('.js'))
}

/**
 * @summary Extracts prose lines belonging to `## Context` and `## The Problem` (or pre-Fix prose).
 * @param {String} [body='']
 * @returns {String[]}
 */
export function problemContextLines(body = '') {
    const
        lines = markdownContentLines(body),
        out   = [];

    let inProblemOrContext = true;

    for (const line of lines) {
        const title = parseHeadingTitle(line);

        if (title) {
            if (title === 'context' || title === 'the context' || title === 'problem' || title === 'the problem') {
                inProblemOrContext = true;
                continue
            }

            if (STOP_SECTIONS.some(stop => title === stop || title.startsWith(`${stop} `))) {
                inProblemOrContext = false;
                continue
            }
        }

        if (inProblemOrContext) {
            out.push(line)
        }
    }

    return out
}

/**
 * @summary Tests whether a token names a test or spec file path.
 * @param {String} rawToken
 * @returns {Boolean}
 */
function isSpecPathToken(rawToken) {
    let token = rawToken.trim();

    while (token.length > 0 && '`"([\'<'.includes(token[0])) {
        token = token.slice(1)
    }
    while (token.length > 0 && '`")]\',.:;>'.includes(token[token.length - 1])) {
        token = token.slice(0, -1)
    }

    const lineColIdx = token.indexOf(':');
    if (lineColIdx > 0) {
        token = token.slice(0, lineColIdx)
    }

    if (!token || token.includes(' ')) return false;

    if (
        token.endsWith('.spec.mjs') ||
        token.endsWith('.spec.js')  ||
        token.endsWith('.test.mjs') ||
        token.endsWith('.test.js')
    ) {
        return token.length > 9
    }

    if (
        (token.startsWith('test/') || token.startsWith('tests/') || token.startsWith('scripts/test-')) &&
        (token.endsWith('.mjs') || token.endsWith('.js'))
    ) {
        return true
    }

    return token.startsWith('test-') && (token.endsWith('.mjs') || token.endsWith('.js'))
}

/**
 * @summary Checks whether a text segment carries a JSDoc `@tag` with descriptive contract text.
 * @param {String} segment
 * @returns {Boolean}
 */
function containsJsdocClause(segment) {
    const trimmed = segment.trim();
    if (!trimmed) return false;

    for (const tag of JSDOC_TAGS) {
        let searchFrom = 0;

        while (searchFrom < trimmed.length) {
            const idx = trimmed.indexOf(tag, searchFrom);
            if (idx === -1) break;

            const
                beforeOk = idx === 0 || ' \t*({["\'\u201c`'.includes(trimmed[idx - 1]),
                afterIdx = idx + tag.length,
                afterCh  = afterIdx < trimmed.length ? trimmed[afterIdx] : '';

            if (beforeOk && (afterCh === ' ' || afterCh === '\t')) {
                const rest = trimmed.slice(afterIdx).trim();
                if (rest.length >= 3) return true
            }

            searchFrom = idx + 1
        }
    }

    return false
}

/**
 * @summary Evaluates the three defect excuses (`crash`, `red`, `jsdoc`) on a ticket body.
 * @param {String} [body='']
 * @returns {{crash: Boolean, red: Boolean, jsdoc: Boolean, excused: Boolean}}
 */
export function hasDefectExcuse(body = '') {
    const
        blocks  = fencedBlocks(body),
        content = markdownContentLines(body),
        probCtx = problemContextLines(body);

    const crash = blocks.some(block => {
        if (['error', 'stderr', 'stack', 'trace'].includes(block.info) && block.text.trim().length > 0) {
            return true
        }
        if (CRASH_TOKENS.some(token => block.text.includes(token))) {
            return true
        }
        return block.text.split('\n').some(isStackFrameLine)
    });

    const red = probCtx.some(line => {
        const tokens = line.split(/[\s|]+/).filter(Boolean);
        if (tokens.some(isSpecPathToken)) return true;

        const lower = line.toLowerCase();
        if (
            (lower.includes('failing test:') || lower.includes('red test:') || lower.includes('failing spec:')) &&
            extractQuotedSpans(line).some(span => span.length >= 3)
        ) {
            return true
        }

        if (lower.includes('test-') && (lower.includes('exit 1') || lower.includes('failed'))) {
            return true
        }

        return false
    });

    const jsdoc = content.some(line => {
        const trimmed = line.trim();
        if (!trimmed) return false;

        if (trimmed.startsWith('>') && containsJsdocClause(trimmed.slice(1))) {
            return true
        }

        return extractQuotedSpans(trimmed).some(containsJsdocClause)
    });

    return {
        crash,
        red,
        jsdoc,
        excused: crash || red || jsdoc
    }
}

/**
 * @summary Returns ticket-body violations when neither `Design authority:` nor any defect excuse is present.
 * @param {Object} [options={}]
 * @param {String} [options.body='']
 * @returns {{
 *   ok: Boolean,
 *   satisfiedBy: 'design-authority'|'defect-excuse'|null,
 *   excuses: {crash: Boolean, red: Boolean, jsdoc: Boolean, excused: Boolean},
 *   violations: String[]
 * }}
 */
export function findTicketBodyViolations({body = ''} = {}) {
    const
        hasAuthority = hasDesignAuthorityLine(body),
        excuses      = hasDefectExcuse(body);

    if (hasAuthority) {
        return {
            ok         : true,
            satisfiedBy: 'design-authority',
            excuses,
            violations : []
        }
    }

    if (excuses.excused) {
        return {
            ok         : true,
            satisfiedBy: 'defect-excuse',
            excuses,
            violations : []
        }
    }

    return {
        ok         : false,
        satisfiedBy: null,
        excuses,
        violations : [
            `Ticket body carries neither a valid \`Design authority:\` line nor a defect excuse. See ${DESIGN_AUTHORITY_REF}.`
        ]
    }
}

/**
 * @summary CLI entry point. Reads a ticket body from `--body-file` or stdin and validates it.
 * @param {String[]} [argv]
 * @param {Object} [options={}]
 * @param {Function} [options.out=console.log]
 * @param {Function} [options.error=console.error]
 * @param {String} [options.stdin='']
 * @returns {Number} Exit code (`0` on pass, `1` on violation or read error).
 */
export function run(argv = process.argv.slice(2), {out = console.log, error = console.error, stdin = ''} = {}) {
    const parsed = parseArgs({
        args            : argv,
        allowPositionals: false,
        strict          : true,
        options         : {'body-file': {type: 'string'}}
    });

    let body = stdin;

    if (parsed.values['body-file']) {
        try {
            body = readFileSync(parsed.values['body-file'], 'utf8')
        } catch (cause) {
            error(`check-ticket-body: cannot read ${parsed.values['body-file']} — ${cause.message}`);
            return 1
        }
    }

    const result = findTicketBodyViolations({body});

    if (result.ok) {
        out(`✅ Ticket body passes design-authority check (${result.satisfiedBy}).`);
        return 0
    }

    error('❌ Ticket body is missing `Design authority:` and carries no defect excuse.');
    error(`   ${result.violations[0]}`);
    return 1
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    const args = process.argv.slice(2);

    if (args.some(arg => arg === '--body-file' || arg.startsWith('--body-file='))) {
        process.exit(run(args))
    } else {
        const chunks = [];

        process.stdin.on('data', chunk => chunks.push(chunk))
            .on('end', () => process.exit(run(args, {stdin: chunks.join('')})))
    }
}
