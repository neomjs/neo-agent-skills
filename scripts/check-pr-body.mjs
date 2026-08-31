#!/usr/bin/env node
/**
 * @summary Validates an agent pull-request body against the anchors `pull-request-workflow.md` §9 promises.
 *
 * The decision half only. It receives a body and returns findings; it never fetches a pull request,
 * never posts a comment, and never reads the network. The reusable workflow owns event acquisition,
 * the live body read and the corrective comment — so this file is testable as a pure function, which
 * is the property the previous home could not have.
 *
 * **Why this is not the workflow it replaces.** The gate lived as 253 lines of inline
 * `actions/github-script` inside a single repository's YAML. Inline logic cannot carry a
 * `test-*.mjs` contract, and a guard living in the tree it guards can be weakened by the diff it
 * guards. Both are fixed by being here: consumers call one stable job through an immutable release.
 */

import {readFileSync, realpathSync} from 'node:fs';
import process                      from 'node:process';
import {parseArgs}                  from 'node:util';
import {fileURLToPath}              from 'node:url';

/**
 * Anchors named in the enumeration a seat reads. A body missing one is told which.
 * Each entry is a RECORD, not a bare string: the match kind is part of the declaration, because an
 * unnamed default is how the substring rule survived unexamined.
 * @member {Array<{anchor: String, match: 'line'|'substring'}>} VISIBLE_PR_BODY_ANCHORS
 */
export const VISIBLE_PR_BODY_ANCHORS = Object.freeze([
    {anchor: 'Evidence:',                match: 'substring'},
    {anchor: '## AC Evidence',           match: 'line'},
    {anchor: '## Test Evidence',         match: 'line'},
    {anchor: '## Post-Merge Validation', match: 'line'}
]);

/**
 * Anchors deliberately absent from the diagnostic enumeration.
 *
 * The split exists to defeat anchor-stuffing: an agent reconstructing a body from the failure
 * message alone produces the visible four and omits these, so the gate still refuses. That defence
 * only holds because the message never names them — it does not make them optional.
 * Records, with the same match-kind declaration as the visible set.
 * @member {Array<{anchor: String, match: 'line'|'substring'}>} INVISIBLE_PR_BODY_ANCHORS
 */
export const INVISIBLE_PR_BODY_ANCHORS = Object.freeze([
    {anchor: 'Authored by ', match: 'substring'},
    {anchor: '## Deltas',    match: 'line'}
]);

/**
 * @summary The body's PROSE lines — everything a reader would call content.
 *
 * Removes fenced blocks (``` and ~~~, any info string, closed or unterminated) and indented code
 * blocks (four or more leading spaces). Both are places an anchor can *appear* without the section
 * existing, which is the same defect as a prose mention one level in: the first fix taught the gate
 * that a sentence naming `## Deltas` is not the section, and left it believing that a fenced or
 * indented `## Deltas` is.
 *
 * A four-space line is only code when it is not a list continuation, but this guard deliberately
 * takes the stricter reading: a required section heading nested four spaces deep inside a list is
 * not a section either, so treating it as code costs nothing real and closes the evasion.
 *
 * @param {String} body
 * @returns {String[]} Lines outside every fence and indented-code block, in order.
 */
export function markdownContentLines(body = '') {
    const lines = String(body).split('\n'),
          out   = [];

    let fence = null;

    for (const line of lines) {
        const opener = line.match(/^ {0,3}(`{3,}|~{3,})/);

        if (fence) {
            // A closing fence must use the same character and be at least as long as the opener.
            if (opener && opener[1][0] === fence[0] && opener[1].length >= fence.length) fence = null;
            continue
        }

        if (opener) { fence = opener[1]; continue }

        // Indented code. Tabs count as indentation too, and a blank line is neither.
        if (/^(?: {4,}|\t)/.test(line)) continue;

        out.push(line)
    }

    return out
}

/**
 * @summary Is this anchor present, under the match kind its declaration names?
 *
 * The previous implementation matched every anchor with `body.includes(anchor)` against the whole
 * body. Every anchor also appears in bodies that *discuss* the anchors, so a table cell describing
 * `## Test Evidence`, or a sentence explaining why a section was omitted, satisfied the gate while
 * the section itself was absent. Measured on the restoration PR: deleting the `## Deltas` heading
 * left three surviving prose occurrences and the check stayed green.
 *
 * **The kinds are per anchor and deliberately not uniform**, because the anchors are not one shape.
 * The four `##` anchors are headings and are line-anchored — a mention inside a sentence, a table row
 * (which opens with `|`), or a fenced snippet no longer counts. `Evidence:` and `Authored by ` are
 * not headings and stay substring, because tightening them would re-open the false-NEGATIVE half
 * already recorded as `neomjs/neo#14344`: a body legitimately carrying `- **Evidence:** …` or a
 * signature line would start failing for formatting.
 *
 * Every anchor therefore declares its kind and there is **no default** — an undeclared anchor throws
 * rather than silently picking one, since an unnamed default is how the original defect went
 * unnoticed.
 * @param {String} body
 * @param {Object} spec
 * @param {String} spec.anchor
 * @param {'line'|'substring'} spec.match
 * @returns {Boolean}
 * @throws {Error} When the anchor declares no match kind.
 */
export function hasAnchor(body, {anchor, match}) {
    const lines = markdownContentLines(body);

    if (match === 'line') {
        // At most Markdown's permitted heading indentation. Four spaces opens an indented code
        // block, which `markdownContentLines` has already removed — this bound is what stops a
        // three-space heading being rejected as formatting while keeping the code-block door shut.
        return lines.some(line => /^ {0,3}\S/.test(line) && line.trimStart().startsWith(anchor))
    }

    // Substring anchors are matched against CONTENT too, not the raw body. A fenced `Evidence:`
    // is documentation of the anchor, not the anchor. This does not re-open `neomjs/neo#14344`:
    // that false negative was a real `- **Evidence:** …` content line, which still matches.
    if (match === 'substring') return lines.join('\n').includes(anchor);

    // No default. An anchor whose match kind is absent is a declaration error, not a body error,
    // and silently picking one is how the original defect survived unnamed for months.
    throw new Error(`check-pr-body: anchor "${anchor}" declares no match kind`)
}

/**
 * @summary Returns every reason this body must be refused, in the order a reader should fix them.
 *
 * Pure and transport-free: the same body yields the same findings whether it came from a webhook, a
 * local file, or a test fixture.
 * @param {Object} options
 * @param {String} options.body Pull-request body.
 * @param {Boolean} [options.isDraft=false] Draft pull requests may defer the close target.
 * @returns {{visible: String[], invisible: String[]}} `invisible` is never surfaced in prose.
 */
export function findBodyViolations({body = '', isDraft = false} = {}) {
    const
        visible   = VISIBLE_PR_BODY_ANCHORS.filter(spec => !hasAnchor(body, spec)).map(spec => spec.anchor),
        invisible = INVISIBLE_PR_BODY_ANCHORS.filter(spec => !hasAnchor(body, spec)).map(spec => spec.anchor),

        // The close target is a STANDALONE line, which is what `pull-request-workflow.md` §9.1
        // has always promised ("standalone Resolves #TICKET_ID"). The previous pattern searched
        // the raw body, so `This PR Resolves #1234 as a side effect.`, a fenced example, a table
        // cell and `Resolves #1, #2` all satisfied a rule that forbids every one of them. A close
        // target is a machine-read declaration; prose that happens to contain the words is not one.
        content    = markdownContentLines(body).map(line => line.trim()),
        hasResolves            = content.some(line => /^Resolves #\d+$/.test(line)),
        hasNonClosingReference = content.some(line => /^(?:Refs #\d+|Related: #\d+)$/.test(line)),
        forbiddenClose         = content.map(line => line.match(/^(Closes|Fixes):?\s+#\d+/i)).find(Boolean),
        // §9.1 forbids the comma form explicitly: multiple delivered tickets get one standalone
        // line each. Reported separately from "absent" so the author is told which rule they hit.
        commaSeparated         = content.some(line => /^Resolves #\d+\s*,/.test(line));

    // `Closes` means closed-without-delivery, an outcome that needs no pull request at all;
    // `Fixes` is ambiguous. One sanctioned closing keyword keeps the 1-PR-per-ticket model
    // mechanical: a ticket needing N pull requests cannot carry N valid `Resolves`.
    if (forbiddenClose) {
        visible.push(`\`${forbiddenClose[1]} #N\` is forbidden — use \`Resolves #N\``)
    }

    // Named before the absence check, because `Resolves #1, #2` IS a close target the author
    // wrote deliberately — telling them it is "missing" sends them looking for the wrong bug.
    if (commaSeparated) {
        visible.push('`Resolves #X, #Y` is forbidden — one standalone `Resolves #N` line per delivered ticket')
    }

    if (!hasResolves && !(isDraft && hasNonClosingReference)) {
        visible.push(isDraft
            ? '`Refs #N` or `Related: #N` on its own line (draft-only non-closing reference, required while `Resolves #N` is absent)'
            : '`Resolves #N` on its own line (mandatory closing keyword — `Refs`/`Related` alone is not sufficient, and a mention inside prose, a table cell or a fence is not a declaration)')
    }

    return {invisible, visible}
}

/**
 * @summary CLI entry. Reads a body from a file or stdin and reports findings.
 * @param {String[]} [argv]
 * @param {Object} [options={}]
 * @param {Function} [options.out=console.log]
 * @param {Function} [options.error=console.error]
 * @param {String} [options.stdin] Body text, when not read from `--body-file`.
 * @returns {Number} Exit code.
 */
export function run(argv = process.argv.slice(2), {out = console.log, error = console.error, stdin = ''} = {}) {
    const parsed = parseArgs({
        args            : argv,
        allowPositionals: false,
        strict          : true,
        options         : {'body-file': {type: 'string'}, draft: {type: 'boolean', default: false}}
    });

    let body = stdin;

    if (parsed.values['body-file']) {
        try {
            body = readFileSync(parsed.values['body-file'], 'utf8')
        } catch (cause) {
            error(`check-pr-body: cannot read ${parsed.values['body-file']} — ${cause.message}`);
            return 1
        }
    }

    const {invisible, visible} = findBodyViolations({body, isDraft: parsed.values.draft});

    if (!visible.length && !invisible.length) {
        out('✅ PR body carries every required anchor.');
        return 0
    }

    error('❌ Agent PR body is missing required template anchors.');

    // At most ONE diagnostic anchor in prose, and never an invisible one. A failure message that
    // enumerates the full set is a template an agent can satisfy without writing the sections.
    visible[0] && error(`   First missing: ${visible[0]}`);

    error('   `##` section anchors must open a LINE — naming one in prose does not satisfy it.');
    error('   See .agents/skills/pull-request/references/pull-request-workflow.md §9.');

    return 1
}

// Entrypoint guard, canonicalized on BOTH sides: realpathing only `argv[1]` still disagrees under
// `--preserve-symlinks-main`, where node keeps the link path in `import.meta.url`. The module would
// load, `run()` would never execute, and the process would exit 0 — a guard that stops guarding.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    const chunks = [];

    process.stdin.on('data', chunk => chunks.push(chunk))
        .on('end', () => process.exit(run(process.argv.slice(2), {stdin: chunks.join('')})));

    // No piped stdin: `--body-file` supplies the body instead.
    process.stdin.isTTY && process.exit(run());
}
