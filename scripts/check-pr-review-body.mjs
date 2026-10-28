#!/usr/bin/env node
/**
 * @summary Judges one submitted agent pull-request review against the pr-review templates this package ships.
 *
 * The decision half only, like `check-pr-body.mjs`: it receives a normalized review envelope and returns a
 * verdict. It never reads GitHub and never posts. The reusable `pull_request_review` workflow acquires the
 * event, makes the bounded reads, and owns the one corrective comment.
 *
 * **Ownership.** This package owns the rules a review body alone decides. Brain's managed gate
 * (`manage_pr_review`) applies them before submission and keeps every decision that needs pull-request history:
 * the Round-2 relation to the cited review, acknowledgement of an outstanding Request Changes, and follow-up
 * ownership against the close targets. This module judges a review after submission, which is the path
 * `gh pr review` and the UI take around that gate.
 *
 * **The anchors are declared here and bound to the templates by the contract suite.** Each anchor is asserted
 * to occur in the template it names, so a template edit that drops or renames one fails the release that ships
 * it. Reading the templates at runtime instead would need a fallback for a missing file, and a fallback is a
 * second, silent copy of the contract.
 *
 * **Nothing from the review body reaches a diagnostic.** A finding is always one of this file's own strings,
 * so the corrective comment cannot be made to say what a reviewer wrote.
 */

import {readFileSync, realpathSync, writeFileSync} from 'node:fs';
import process                                    from 'node:process';
import {parseArgs}                                from 'node:util';
import {fileURLToPath}                            from 'node:url';

/**
 * Package-relative template paths, keyed by the review shape that selects them.
 * @member {Object<String, String>} REVIEW_TEMPLATES
 */
export const REVIEW_TEMPLATES = Object.freeze({
    'canonical'  : '.agents/skills/pr-review/assets/pr-review-template.md',
    'follow-up'  : '.agents/skills/pr-review/assets/pr-review-followup-template.md',
    'micro'      : '.agents/skills/pr-review/assets/pr-review-micro-review-template.md',
    'micro-delta': '.agents/skills/pr-review/assets/pr-review-micro-delta-template.md',
    'round-2'    : '.agents/skills/pr-review/assets/pr-review-round-2-template.md'
});

/**
 * The seven evaluation-metric tags of the full and follow-up templates. Named in a diagnostic when missing.
 * @member {String[]} VISIBLE_METRIC_ANCHORS
 */
export const VISIBLE_METRIC_ANCHORS = Object.freeze([
    '[ARCH_ALIGNMENT]', '[CONTENT_COMPLETENESS]', '[EXECUTION_QUALITY]', '[PRODUCTIVITY]', '[IMPACT]', '[COMPLEXITY]', '[EFFORT_PROFILE]'
]);

/**
 * Structural substrings checked and never named. A body rebuilt from a diagnostic carries what the diagnostic
 * named and omits these, so the check still refuses it; that holds only while no message ever names them.
 * @member {String[]} INVISIBLE_STRUCTURE_ANCHORS
 */
export const INVISIBLE_STRUCTURE_ANCHORS = Object.freeze(['Depth Floor', 'Required Actions', 'Strategic-Fit Decision']);

/**
 * The four premise-snapshot fields every full and follow-up review carries, as their bold template labels.
 * @member {Array<{label: String, token: String}>} PREMISE_ANCHORS
 */
export const PREMISE_ANCHORS = Object.freeze([
    {label: 'Inputs Read Before Patch', token: '**Inputs Read Before Patch:**'},
    {label: 'Expected Solution Shape',  token: '**Expected Solution Shape:**'},
    {label: 'Patch Verdict',            token: '**Patch Verdict:**'},
    {label: 'Premise Coherence',        token: '**Premise Coherence:**'}
]);

/**
 * Each shape's skeleton: the headings and fixed lines its template prints verbatim. Checked silently, like the
 * invisible anchors, because a skeleton list in a message is a template to copy without reading one.
 * @member {Object<String, String[]>} SKELETON_ANCHORS
 */
export const SKELETON_ANCHORS = Object.freeze({
    'canonical': [
        '# PR Review Summary', '### 🪜 Strategic-Fit Decision', '### 🧭 Patch-Blind Premise Snapshot',
        '### 🕸️ Context & Graph Linking', '### 🔬 Depth Floor', '### 🧠 Graph Ingestion Notes',
        '### 📋 Required Actions', '### 📊 Evaluation Metrics'
    ],
    'follow-up': [
        '# PR Review Follow-Up — exceptional verdicts only', '### 🧭 Patch-Blind Premise Snapshot',
        '### 🪜 Strategic-Fit Decision', '### ⚓ Prior Review Anchor', '### 🔁 Delta Scope',
        '### ✅ Previous Required Actions Audit', '### 🔬 Delta Depth Floor', '### 🔬 Premise Falsifiers',
        '### 📊 Metrics Delta', '### 📋 Required Actions'
    ],
    'micro': ['# PR Micro-Review', '**Class:**', '**Verdict:**', '**Glance:**', '- **Origin Session ID:**'],
    'micro-delta': [
        '# Pull Request Micro-Delta Review', '> **Context:**', '### State Vector', '- **Target SHA:**',
        '- **Origin Session ID:**', '- **Current reviewDecision:**', '- **Semantic Status:**', '- **CI Status:**',
        '- **Remaining Blocker Class:**', '- **Measured Discussion Cost:**', '### Micro-Delta Focus',
        '*Only defects classified as `mechanical-hygiene` or `metadata-drift` are reviewed here.*', '### Verdict',
        '**APPROVED**', '**COMMENTED CLOSURE**', '**MAINTAINER POLISH FAST PATH APPLIED**'
    ],
    'round-2': ['# PR Review — Round 2 (disposition only)', '### ⚓ Anchor', '### 📋 Disposition', '### 🔚 Verdict']
});

/**
 * Body markers that select a follow-up (exceptional verdict) review instead of a full one.
 * @member {String[]} FOLLOW_UP_HINTS
 */
export const FOLLOW_UP_HINTS = Object.freeze([
    '# PR Review Follow-Up', '**Cycle:**', '### ⚓ Prior Review Anchor', '### 🔁 Delta Scope', '### Prior Review Anchor',
    '### Delta Scope', '### ✅ Previous Required Actions Audit', '### Previous Required Actions Audit',
    '### 🔬 Delta Depth Floor', '### Delta Depth Floor', '### 📊 Metrics Delta', '### Metrics Delta'
]);

/**
 * Review states as the REST API reports them for a submitted review.
 * @member {String[]} REVIEW_STATES
 */
export const REVIEW_STATES = Object.freeze(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED']);

/**
 * What each failure code asks of the reviewer. The CLI and the corrective comment print the same line.
 * @member {Object<String, String>} REMEDIES
 */
export const REMEDIES = Object.freeze({
    BUDGET_ACTIVATION_UNPROVABLE: 'The review-budget activation history could not be read completely, so this review\'s cohort is unknown.',
    BUDGET_COHORT_UNKNOWN       : 'The pull request has no valid creation time, so its review-budget cohort is unknown.',
    BUDGET_OVERRIDE_UNMANAGED   : '`[review-budget-override]` is valid only on a review the managed path submitted.',
    BUDGET_PROVENANCE_MISSING   : 'A Request Changes after the review-budget activation goes through `manage_pr_review`, or discloses the bypass on a `[review-budget-bypass] reason: …` line.',
    COMMENT_ACTION_PACKET       : 'A COMMENT dispositions existing actions and raises no new ones. A first demand round is a Request Changes.',
    COMMENTED_CLOSURE_STATE     : 'A COMMENTED CLOSURE is submitted as a COMMENT; it cannot be another Request Changes.',
    DROP_SUPERSEDE_INCOMPLETE   : 'A Drop+Supersede carries its Status and Decision lines, a disposition and every contract field of pr-review §9, on the full or follow-up template.',
    DROP_SUPERSEDE_STATE        : 'A terminal Drop+Supersede is submitted as a Request Changes.',
    ROUND_2_STATE_INCOHERENT    : 'A Round 2 states one legal `**Status:**` (Approved, Approve+Follow-Up, Comment), and any STILL_OPEN row makes it Comment.',
    TEMPLATE_INCOMPLETE         : 'The body does not follow the template its shape selects.'
});

const
    ORIGIN_SESSION         = /^\s*[*-]\s+\*\*Origin Session ID:\*\*\s+[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\s*$/im,
    ROUND_2_H1             = /^#[ \t]+PR Review — Round 2\b/m,
    ROUND_2_STATUS         = /^\*\*Status:\*\*[ \t]*(.+?)[ \t]*$/m,
    ROUND_2_LEGAL_STATUSES = ['approved', 'approve+follow-up', 'comment'],
    ROUND_2_VERBS          = ['ADDRESSED', 'DEFENDED', 'STILL_OPEN'],
    ROUND_2_ROW            = /\|[^|\n]*\b(ADDRESSED|DEFENDED|STILL_OPEN)\b[^|\n]*\|/,
    ROUND_1_REFERENCE      = /\*\*Round-1 Review ID:\*\*[ \t]*(?!\[[^\]\n]*\](?!\())[^\s·]/,
    CHECKLIST_ITEM         = /^[ \t]*[-*][ \t]+\[[ x]\]/im,
    MICRO_CLASS            = /(?:^|[^\w-])(micro|contained|mechanical)(?:$|[^\w-])/i,
    BLOCKER_CLASS          = /(?:^|[^\w-])(mechanical-hygiene|metadata-drift)(?:$|[^\w-])/i,
    COMMENTED_CLOSURE      = /^\s*-\s*\[[xX]\]\s*\*\*COMMENTED CLOSURE\*\*/m,
    CLOSURE_PACKET_FIELDS  = ['Consumer sweep', 'Falsifier/property matrix', 'Carried-vs-new census', 'Truth-fold', 'Semantic-surface freeze'],
    DROP_SUPERSEDE_FIELDS  = ['Source-coordinate falsifiers', 'Salvage map', 'Successor landing pad', 'Successor map citation'],
    DROP_SUPERSEDE_KINDS   = ['implementation-off', 'ticket-prescription-off', 'ticket-premise-dead'],
    FENCE                  = /^[ \t]{0,3}(`{3,}|~{3,})/,
    HEADING                = /^[ \t]{0,3}#{1,6}[ \t]/,
    ACTION_HEADING         = /Required\s+Actions?\b/i,
    ACTION_ITEM            = /^[ \t]*[-*][ \t]+\[[ \t]*\][ \t]*\S/,
    ACTION_RA              = /^[ \t]*(?:[-*][ \t]+)?\*{0,2}RA[-_ ]?\d+\*{0,2}[ \t]*[:.)—-][ \t]*\S/i,
    BUDGET_MANAGED         = '[review-budget-managed]',
    BUDGET_OVERRIDE        = '[review-budget-override]',
    BUDGET_BYPASS          = /^\[review-budget-bypass\]\s+reason:\s*\S.*$/im,
    // The template a failure points at, when the code decides it rather than the body's shape.
    CODE_TEMPLATE          = {COMMENTED_CLOSURE_STATE: 'micro-delta', DROP_SUPERSEDE_INCOMPLETE: 'follow-up', DROP_SUPERSEDE_STATE: 'follow-up', ROUND_2_STATE_INCOHERENT: 'round-2'};

/**
 * @summary The body's lines outside fenced code blocks, split on CR/LF only.
 * @param {String} body
 * @returns {String[]}
 */
function unfencedLines(body) {
    const lines = [];
    let fence   = null;

    for (const line of String(body).split(/\r\n|[\n\r]/)) {
        const opener = FENCE.exec(line);

        if (opener) {
            if      (fence === null)         fence = opener[1][0];
            else if (opener[1][0] === fence) fence = null;
            continue
        }

        fence === null && lines.push(line)
    }

    return lines
}

/**
 * @summary The Required Actions items a body demands: unchecked boxes and `RA-N` lines under that heading.
 *
 * Scoped to the section, because a Micro-Delta verdict block is a list of unchecked OPTIONS and a body-wide scan
 * would read each as a demand. Blockquoted carried actions fail the item shape, and fenced examples are skipped.
 * @param {String} body
 * @returns {String[]} Demanded item lines, trimmed.
 */
export function demandedActionItems(body) {
    const items   = [];
    let inSection = false;

    for (const line of unfencedLines(body)) {
        if (HEADING.test(line)) { inSection = ACTION_HEADING.test(line); continue }

        inSection && (ACTION_ITEM.test(line) || ACTION_RA.test(line)) && items.push(line.trim())
    }

    return items
}

/**
 * @param {String} body
 * @returns {Boolean} Whether the body is a Micro-Delta review.
 */
function isMicroDelta(body) {
    return body.includes('# Pull Request Micro-Delta Review') || (body.includes('### State Vector') && body.includes('### Micro-Delta Focus'))
}

/**
 * @summary The shape a body selects, in the managed gate's dispatch order.
 *
 * A micro-review is selected by a real H1 outside fences, so a full review that quotes the light form is not
 * judged against the light floor. Round 2 is tested before the follow-up hints, whose vocabulary it shares.
 * @param {String} body
 * @returns {'micro'|'round-2'|'micro-delta'|'follow-up'|'canonical'}
 */
export function reviewShape(body) {
    if (unfencedLines(body).some(line => /^#[ \t]+PR Micro-Review\b/.test(line))) return 'micro';
    if (ROUND_2_H1.test(body))                                                       return 'round-2';
    if (isMicroDelta(body))                                                          return 'micro-delta';

    return FOLLOW_UP_HINTS.some(hint => body.includes(hint)) ? 'follow-up' : 'canonical'
}

/**
 * @summary A `- **Label:** value` field, or '' when absent.
 * @param {String} body
 * @param {String} label
 * @returns {String}
 */
function fieldValue(body, label) {
    const prefix = `- **${label}:**`,
          line   = body.split('\n').find(candidate => candidate.trim().startsWith(prefix));

    return line ? line.trim().slice(prefix.length).trim() : ''
}

/**
 * @param {String} value
 * @returns {Boolean} Whether a contract field is empty or still holds a placeholder.
 */
function isPlaceholder(value) {
    return !value || /^\[.*\]$/.test(value) || /^(?:todo|tbd)$/i.test(value)
}

/**
 * @summary A shape's template misses, split into what a diagnostic may name and what it never names.
 * @param {String} body
 * @param {String} shape From `reviewShape`.
 * @returns {{visible: String[], invisible: String[]}}
 */
export function templateMisses(body, shape) {
    const
        visible   = [],
        invisible = SKELETON_ANCHORS[shape].filter(anchor => !body.includes(anchor)),
        lineWith  = label => body.split('\n').find(line => line.includes(label)) || '';

    if (shape === 'canonical' || shape === 'follow-up') {
        visible.push(...VISIBLE_METRIC_ANCHORS.filter(anchor => !body.includes(anchor)));
        visible.push(...PREMISE_ANCHORS.filter(({token}) => !body.includes(token)).map(({label}) => label));
        invisible.push(...INVISIBLE_STRUCTURE_ANCHORS.filter(anchor => !body.includes(anchor)))
    }

    // The light form names its origin line but has never required the UUID; every other shape does.
    shape !== 'micro' && !ORIGIN_SESSION.test(body) && visible.push('Origin Session ID: a Memory Core UUID on its own line');

    if (shape === 'micro') {
        !MICRO_CLASS.test(lineWith('**Class:**')) && visible.push('Class: micro | contained | mechanical')
    }

    if (shape === 'micro-delta') {
        !BLOCKER_CLASS.test(lineWith('- **Remaining Blocker Class:**')) && visible.push('Remaining Blocker Class: mechanical-hygiene | metadata-drift');

        if (COMMENTED_CLOSURE.test(body)) {
            !body.includes('### RC2 Closure Packet') && visible.push('RC2 Closure Packet');
            visible.push(...CLOSURE_PACKET_FIELDS.filter(label => isPlaceholder(fieldValue(body, label))))
        }
    }

    if (shape === 'round-2') {
        !ROUND_1_REFERENCE.test(body) && visible.push('Round-1 Review ID: the review this round dispositions');
        !ROUND_2_ROW.test(body)       && visible.push('a disposition row: ADDRESSED, DEFENDED or STILL_OPEN');
        CHECKLIST_ITEM.test(body)     && visible.push('no new action checklist: prior actions live in the disposition table')
    }

    return {invisible, visible}
}

/**
 * @summary Why a Round 2's declared Status contradicts its own disposition table, or null.
 * @param {String} body
 * @returns {String|null}
 */
export function round2Incoherence(body) {
    const status = body.match(ROUND_2_STATUS);

    if (!status) return 'no `**Status:**` line';

    const declared = status[1].replace(/[*_`]/g, '').trim().toLowerCase();

    if (!ROUND_2_LEGAL_STATUSES.includes(declared)) return 'a `**Status:**` outside the legal Round-2 set';

    const stillOpen = body.split('\n')
        .filter(line => line.trim().startsWith('|') && ROUND_2_VERBS.some(verb => line.includes(verb)))
        .some(line => line.split('|').slice(1, -1).map(cell => cell.trim()).includes('STILL_OPEN'));

    return stillOpen && declared !== 'comment' ? 'a STILL_OPEN row under a Status other than Comment' : null
}

/**
 * @summary The earliest merge that activated the review budget, from a complete closing-PR history.
 * @param {Object} activation
 * @param {String} activation.base Branch whose merge activates the budget.
 * @param {{totalCount: Number, hasNextPage: Boolean, nodes: Object[]}} activation.closingPullRequests
 * @returns {{activatedMs: Number|null}|{code: String}} `activatedMs: null` means not activated yet.
 */
export function resolveActivation({base, closingPullRequests: history}) {
    const nodes = history?.nodes;

    // A history that may be partial cannot prove the earliest merge, so it fails closed rather than guessing.
    if (!Array.isArray(nodes) || history.hasNextPage !== false || !Number.isInteger(history.totalCount) || history.totalCount !== nodes.length) {
        return {code: 'BUDGET_ACTIVATION_UNPROVABLE'}
    }

    const times = nodes.filter(node => node?.state === 'MERGED' && node?.baseRefName === base).map(node => Date.parse(node?.mergedAt || ''));

    if (!times.every(Number.isFinite)) return {code: 'BUDGET_ACTIVATION_UNPROVABLE'};

    return {activatedMs: times.length ? Math.min(...times) : null}
}

/**
 * @summary The provenance code a Request Changes fails on, or null when it owes none.
 * @param {Object} envelope
 * @returns {String|null}
 */
function budgetFailure({budgetActivation, pullRequest, review: {body}}) {
    // No activation coordinate means the caller's whole history postdates the budget.
    if (budgetActivation !== null) {
        const resolved = resolveActivation(budgetActivation);

        if (resolved.code)                 return resolved.code;
        if (resolved.activatedMs === null) return null;

        const createdMs = Date.parse(pullRequest.createdAt);

        if (!Number.isFinite(createdMs))      return 'BUDGET_COHORT_UNKNOWN';
        if (createdMs <= resolved.activatedMs) return null
    }

    const managed = body.includes(BUDGET_MANAGED);

    if (body.includes(BUDGET_OVERRIDE) && !managed) return 'BUDGET_OVERRIDE_UNMANAGED';

    return managed || BUDGET_BYPASS.test(body) ? null : 'BUDGET_PROVENANCE_MISSING'
}

/**
 * @summary Throws unless the envelope carries every field the verdict reads, in its documented shape.
 * @param {Object} envelope
 * @throws {TypeError} Naming the first malformed field.
 */
export function assertEnvelope(envelope) {
    const
        fail       = field => { throw new TypeError(`malformed review envelope: ${field}`) },
        positive   = value => Number.isInteger(value) && value > 0,
        activation = envelope?.budgetActivation;

    if (!envelope || typeof envelope !== 'object')                                fail('not an object');
    if (!/^[\w.-]+\/[\w.-]+$/.test(envelope.repository ?? ''))                    fail('repository');
    if (!positive(envelope.pullRequest?.number))                                  fail('pullRequest.number');
    if (typeof envelope.pullRequest.createdAt !== 'string')                       fail('pullRequest.createdAt');
    if (!positive(envelope.review?.id))                                           fail('review.id');
    if (!REVIEW_STATES.includes(envelope.review.state))                           fail('review.state');
    if (typeof envelope.review.reviewer !== 'string' || !envelope.review.reviewer) fail('review.reviewer');
    if (typeof envelope.review.body !== 'string')                                 fail('review.body');

    // Required even when there is none: an absent key is a wrapper that forgot the read, never "no budget".
    if (!('budgetActivation' in envelope)) fail('budgetActivation');

    if (activation !== null && (typeof activation !== 'object' || !positive(activation.issue) ||
        typeof activation.base !== 'string' || !activation.base || typeof activation.closingPullRequests !== 'object')) {
        fail('budgetActivation')
    }
}

/**
 * @summary The verdict on one submitted review. Pure: the same envelope always yields the same verdict.
 *
 * The order is the reader's fix order: what the review IS, its state against its own declarations, before
 * whether its body is complete.
 * @param {Object} envelope Validated by `assertEnvelope`.
 * @returns {{outcome: 'pass'|'fail'|'not-enforced', code: String, shape: String, finding: String|null}}
 */
export function judgeReview(envelope) {
    const
        {body, reviewer, state} = envelope.review,
        shape     = reviewShape(body),
        verdict   = (outcome, code, finding = null) => ({code, finding, outcome, shape}),
        lines     = body.split('\n').map(line => line.trim()),
        dsStatus  = lines.includes('**Status:** Drop+Supersede'),
        dsDecided = lines.includes('- **Decision**: Drop+Supersede'),
        closure   = body.includes('# Pull Request Micro-Delta Review') && COMMENTED_CLOSURE.test(body),
        round2    = ROUND_2_H1.test(body);

    // Every agent seat carries the `neo-` prefix; a person's review owes no agent template.
    if (!reviewer.startsWith('neo-')) return verdict('not-enforced', 'REVIEWER_NOT_AGENT');
    if (state === 'DISMISSED')        return verdict('not-enforced', 'REVIEW_DISMISSED');

    if (dsStatus || dsDecided) {
        if (state !== 'CHANGES_REQUESTED') return verdict('fail', 'DROP_SUPERSEDE_STATE');

        const missing = [
            ...(dsStatus && dsDecided ? [] : ['the Status and Decision lines both read Drop+Supersede']),
            ...(DROP_SUPERSEDE_KINDS.includes(fieldValue(body, 'Disposition')) ? [] : [`Disposition: ${DROP_SUPERSEDE_KINDS.join(' | ')}`]),
            ...DROP_SUPERSEDE_FIELDS.filter(label => isPlaceholder(fieldValue(body, label))),
            ...(shape === 'micro-delta' ? ['the full or follow-up template, not the Micro-Delta one'] : [])
        ];

        if (missing.length) return verdict('fail', 'DROP_SUPERSEDE_INCOMPLETE', missing[0])
    }

    if (closure && state !== 'COMMENTED') return verdict('fail', 'COMMENTED_CLOSURE_STATE');

    const incoherence = round2 && round2Incoherence(body);

    if (incoherence) return verdict('fail', 'ROUND_2_STATE_INCOHERENT', incoherence);

    // A plain COMMENT owes no template. It may still not open a demand packet, in any budget state: otherwise the
    // counted round stays avoidable by never choosing Request Changes.
    if (state === 'COMMENTED' && !closure && !round2) {
        const demanded = demandedActionItems(body).length;

        return demanded
            ? verdict('fail', 'COMMENT_ACTION_PACKET', `${demanded} new required-action item(s)`)
            : verdict('pass', 'COMMENT_SUPPLEMENTARY')
    }

    const budget = state === 'CHANGES_REQUESTED' ? budgetFailure(envelope) : null;

    if (budget) return verdict('fail', budget);

    const {invisible, visible} = templateMisses(body, shape);

    return visible.length || invisible.length
        ? verdict('fail', 'TEMPLATE_INCOMPLETE', visible[0] ?? null)
        : verdict('pass', 'REVIEW_SHAPE_VALID')
}

/**
 * @param {Number} reviewId
 * @returns {String} The hidden first line that makes a corrective comment one per review.
 */
export function commentMarker(reviewId) {
    return `<!-- neo-agent-skills:pr-review-lint review=${reviewId} -->`
}

/**
 * @summary The corrective comment for a failed review: one remedy and at most one finding, both this file's strings.
 * @param {Object} envelope
 * @param {Object} verdict A failing verdict from `judgeReview`.
 * @returns {String} Markdown, opened by `commentMarker`.
 */
export function correctiveComment({pullRequest, repository, review}, {code, finding, shape}) {
    const
        url      = `https://github.com/${repository}/pull/${pullRequest.number}#pullrequestreview-${review.id}`,
        template = REVIEW_TEMPLATES[code === 'TEMPLATE_INCOMPLETE' ? shape : CODE_TEMPLATE[code]];

    return [
        commentMarker(review.id),
        '## 🚨 Agent PR review lint',
        '',
        `@${review.reviewer}: your [review on #${pullRequest.number}](${url}) fails \`${code}\`. ${REMEDIES[code]}`,
        ...(finding ? ['', `First finding: ${finding}.`] : []),
        '',
        `**Required action:** read \`.agents/skills/pr-review/SKILL.md\`${template ? ` and \`${template}\`` : ''} before posting a corrective review.`,
        'The check verifies more than this comment names; following the template is the reliable path.'
    ].join('\n')
}

/**
 * @summary CLI entry: judges the `--envelope` file, prints the verdict, and writes the comment on a failure.
 * @param {String[]} [argv]
 * @param {Object} [options={}]
 * @param {Function} [options.out=console.log]
 * @param {Function} [options.error=console.error]
 * @returns {Number} 0 pass or not enforced, 1 policy failure, 2 bad arguments or a malformed envelope.
 */
export function run(argv = process.argv.slice(2), {out = console.log, error = console.error} = {}) {
    let envelope, values;

    try {
        ({values} = parseArgs({
            args   : argv,
            strict : true,
            options: {'comment-file': {type: 'string'}, envelope: {type: 'string'}, json: {type: 'boolean', default: false}}
        }));

        if (!values.envelope) throw new TypeError('--envelope <file> is required');

        envelope = JSON.parse(readFileSync(values.envelope, 'utf8'));
        assertEnvelope(envelope)
    } catch (cause) {
        error(`check-pr-review-body: ${cause.message}`);
        values?.json && out(JSON.stringify({code: 'ENVELOPE_INVALID', finding: null, outcome: 'error', shape: null}));
        return 2
    }

    const verdict = judgeReview(envelope),
          failed  = verdict.outcome === 'fail',
          subject = `${verdict.shape} review by ${envelope.review.reviewer}`;

    if (values.json)  out(JSON.stringify(verdict));
    else if (!failed) out(`✅ ${verdict.code} (${subject}).`);
    else {
        error(`❌ ${verdict.code} (${subject}). ${REMEDIES[verdict.code]}`);
        verdict.finding && error(`   First finding: ${verdict.finding}.`)
    }

    failed && values['comment-file'] && writeFileSync(values['comment-file'], correctiveComment(envelope, verdict));

    return failed ? 1 : 0
}

// Entrypoint guard, canonicalized on both sides so a symlinked bin still runs (see `check-pr-body.mjs`).
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    process.exit(run())
}
