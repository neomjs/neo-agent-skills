#!/usr/bin/env node
/**
 * @summary Mutation-sensitive contract checks for the packaged PR-review policy.
 *
 * Every policy branch has a passing fixture and a mutation that must turn it red with its own code. The
 * passing fixtures are the shipped templates themselves, filled in only where a template prints a
 * placeholder, so the suite also proves the templates satisfy the policy that ships beside them.
 *
 * Run: `node scripts/test-check-pr-review-body.mjs`
 */

import assert                                                  from 'node:assert/strict';
import {spawnSync}                                             from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir}                                                from 'node:os';
import {dirname, join}                                         from 'node:path';
import {fileURLToPath}                                         from 'node:url';
import {
    INVISIBLE_STRUCTURE_ANCHORS, PREMISE_ANCHORS, REMEDIES, REVIEW_TEMPLATES, SKELETON_ANCHORS, VISIBLE_METRIC_ANCHORS,
    assertEnvelope, commentMarker, correctiveComment, judgeReview, reviewShape
} from './check-pr-review-body.mjs';

const
    here     = dirname(fileURLToPath(import.meta.url)),
    root     = join(here, '..'),
    GUARD    = join(here, 'check-pr-review-body.mjs'),
    UUID     = '0f0e0d0c-0b0a-4908-8706-050403020100',
    scratch  = [],
    failures = [];

let arms = 0;

/** @summary A scratch directory removed at the end of the run. */
function tempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'pr-review-'));

    scratch.push(dir);
    return dir
}

/** @summary A shipped template, read from the given package root. */
function template(shape, base = root) {
    return readFileSync(join(base, REVIEW_TEMPLATES[shape]), 'utf8')
}

/** @summary Replaces a template's origin placeholder with a real Memory Core UUID line. */
function withOrigin(body) {
    return body.replace(/^(\s*[*-]\s+\*\*Origin Session ID:\*\*)\s.*$/m, `$1 ${UUID}`)
}

/** @summary Replaces exactly one occurrence, failing the suite when the fixture no longer carries it. */
function swap(body, from, to) {
    assert.ok(body.includes(from), `fixture lost "${from}"`);
    return body.replace(from, to)
}

/** @summary A review envelope around a body. */
function envelope(body, {activation = null, createdAt = '2026-10-28T12:00:00Z', reviewer = 'neo-opus-vega', state = 'APPROVED'} = {}) {
    return {budgetActivation: activation, pullRequest: {createdAt, number: 42}, repository: 'neomjs/neo-agent-skills', review: {body, id: 7, reviewer, state}}
}

/**
 * @summary Asserts a verdict, and records every failing one for the privacy arms.
 * @param {String} label
 * @param {String} body
 * @param {Object} options Envelope options.
 * @param {String} code Expected code; `outcome` follows from it.
 * @param {String|null} [finding] Expected finding, when the arm pins one.
 */
function expect(label, body, options, code, finding) {
    const input   = envelope(body, options),
          verdict = judgeReview(input);

    assert.equal(verdict.code, code, `${label}: expected ${code}, got ${verdict.code} (${verdict.finding})`);
    finding !== undefined && assert.equal(verdict.finding, finding, `${label}: finding`);
    verdict.outcome === 'fail' && failures.push({input, verdict});
    arms++
}

/** @summary A mutation arm: the mutation must change the body, and the result must carry the given code. */
function mutate(label, body, change, options, code, finding) {
    const mutated = change(body);

    assert.notEqual(mutated, body, `${label}: mutation changed nothing`);
    expect(label, mutated, options, code, finding)
}

// ── The templates carry every anchor the policy declares ──────────────────────────────────────────────
//
// The binding the module's header promises. Checked against a mutated template too, so the check itself is
// shown to notice a renamed heading rather than passing on whatever it is given.
function bindingFailures(read) {
    const missing = [];

    Object.entries(SKELETON_ANCHORS).forEach(([shape, anchors]) => {
        anchors.forEach(anchor => !read(shape).includes(anchor) && missing.push(`${shape}: ${anchor}`))
    });

    ['canonical', 'follow-up'].forEach(shape => {
        [...VISIBLE_METRIC_ANCHORS, ...INVISIBLE_STRUCTURE_ANCHORS, ...PREMISE_ANCHORS.map(({token}) => token)]
            .forEach(anchor => !read(shape).includes(anchor) && missing.push(`${shape}: ${anchor}`))
    });

    return missing
}

assert.deepEqual(bindingFailures(shape => template(shape)), [], 'a shipped template lost an anchor the policy declares');

{
    const renamed = shape => shape === 'round-2' ? template(shape).replace('### 🔚 Verdict', '### Verdict') : template(shape);

    assert.deepEqual(bindingFailures(renamed), ['round-2: ### 🔚 Verdict'], 'the binding check must name a renamed heading');
    arms++
}

// ── Passing fixtures: each shipped template, filled only where it prints a placeholder ───────────────
const
    canonical  = withOrigin(template('canonical')),
    followUp   = withOrigin(template('follow-up')),
    micro      = template('micro'),
    microDelta = withOrigin(template('micro-delta')),
    round2     = [
        ['**Status:** [Approved / Approve+Follow-Up / Comment]', '**Status:** Approved'],
        ['**Round-1 Review ID:** [reviewId or URL]', '**Round-1 Review ID:** 5683341608'],
        ['| ADDRESSED / DEFENDED / STILL_OPEN |', '| ADDRESSED |']
    ].reduce((body, [from, to]) => swap(body, from, to), withOrigin(template('round-2')));

[
    ['canonical', canonical], ['follow-up', followUp], ['micro', micro], ['micro-delta', microDelta], ['round-2', round2]
].forEach(([shape, body]) => {
    assert.equal(reviewShape(body), shape, `${shape} template selects its own shape`);
    expect(`${shape} template, approved`, body, {}, 'REVIEW_SHAPE_VALID', null)
});

// ── Who the policy judges ──────────────────────────────────────────────────────────────────────────
expect('a person reviews', 'LGTM', {reviewer: 'tobiu'}, 'REVIEWER_NOT_AGENT');
expect('an app reviews', 'LGTM', {reviewer: 'dependabot[bot]'}, 'REVIEWER_NOT_AGENT');
expect('an agent posts LGTM', 'LGTM', {}, 'TEMPLATE_INCOMPLETE', '[ARCH_ALIGNMENT]');
expect('a dismissed review', 'LGTM', {state: 'DISMISSED'}, 'REVIEW_DISMISSED');

// ── Full template: visible misses are named, structural misses never are ──────────────────────────────
VISIBLE_METRIC_ANCHORS.forEach(tag => {
    mutate(`full review drops ${tag}`, canonical, body => body.replaceAll(tag, '[RENAMED]'), {}, 'TEMPLATE_INCOMPLETE', tag)
});

PREMISE_ANCHORS.forEach(({label, token}) => {
    mutate(`full review drops ${label}`, canonical, body => body.replaceAll(token, '**Renamed:**'), {}, 'TEMPLATE_INCOMPLETE', label)
});

mutate('full review keeps the origin placeholder', canonical, () => template('canonical'), {}, 'TEMPLATE_INCOMPLETE', 'Origin Session ID: a Memory Core UUID on its own line');
mutate('full review writes a harness id for its origin', canonical, body => body.replace(UUID, 'claude-session-42'), {}, 'TEMPLATE_INCOMPLETE');

INVISIBLE_STRUCTURE_ANCHORS.forEach(anchor => {
    mutate(`full review drops "${anchor}"`, canonical, body => body.replaceAll(anchor, 'Renamed'), {}, 'TEMPLATE_INCOMPLETE', null)
});

SKELETON_ANCHORS.canonical.forEach(heading => {
    mutate(`full review renames ${heading}`, canonical, body => body.replace(heading, '### Renamed'), {}, 'TEMPLATE_INCOMPLETE', null)
});

mutate('follow-up review renames a heading', followUp, body => body.replace('### 🔬 Premise Falsifiers', '### Falsifiers'), {}, 'TEMPLATE_INCOMPLETE', null);

// ── Micro-review: the light floor, selected only by a real H1 ─────────────────────────────────────────
mutate('micro-review claims an intense class', micro, body => swap(body, '**Class:** [micro | contained | mechanical]', '**Class:** intense'), {}, 'TEMPLATE_INCOMPLETE', 'Class: micro | contained | mechanical');
mutate('micro-review drops its glance', micro, body => body.replace('**Glance:**', '**Summary:**'), {}, 'TEMPLATE_INCOMPLETE', null);
expect('micro-review owes no UUID on its origin line', micro, {}, 'REVIEW_SHAPE_VALID');
assert.equal(reviewShape(`${canonical}\n\`\`\`\n# PR Micro-Review\n\`\`\``), 'canonical', 'a fenced micro header does not select the light floor');

// ── Micro-Delta and its COMMENTED CLOSURE ───────────────────────────────────────────────────────────
const closure = [
    ['- [ ] **COMMENTED CLOSURE**', '- [x] **COMMENTED CLOSURE**'],
    ['[consumers checked and result]', 'three consumers, unchanged'],
    ['[covered properties and remaining falsifier status]', 'all covered'],
    ['[carried findings vs new classes]', 'carried only'],
    ['[ticket / PR / evidence authority aligned]', 'aligned'],
    ['[the existing RA\'s named capability; allowed property refinements]', 'unchanged']
].reduce((body, [from, to]) => swap(body, from, to), microDelta);

mutate('micro-delta names a semantic blocker', microDelta, body => swap(body, '`[mechanical-hygiene | metadata-drift]`', '`semantic`'), {}, 'TEMPLATE_INCOMPLETE', 'Remaining Blocker Class: mechanical-hygiene | metadata-drift');
mutate('micro-delta drops its origin UUID', microDelta, body => body.replace(UUID, ''), {}, 'TEMPLATE_INCOMPLETE', 'Origin Session ID: a Memory Core UUID on its own line');
expect('closure packet, commented', closure, {state: 'COMMENTED'}, 'REVIEW_SHAPE_VALID');
mutate('closure packet submitted as Request Changes', closure, body => `${body}\n[review-budget-managed]`, {state: 'CHANGES_REQUESTED'}, 'COMMENTED_CLOSURE_STATE');
mutate('closure packet leaves a field unfilled', closure, body => swap(body, 'all covered', '[covered]'), {state: 'COMMENTED'}, 'TEMPLATE_INCOMPLETE', 'Falsifier/property matrix');
mutate('closure packet drops its heading', closure, body => swap(body, '### RC2 Closure Packet', '### Packet'), {state: 'COMMENTED'}, 'TEMPLATE_INCOMPLETE', 'RC2 Closure Packet');

// ── Round 2: shape, and the Status against its own table ─────────────────────────────────────────────
const stillOpen = swap(swap(round2, '| ADDRESSED |', '| STILL_OPEN |'), '**Status:** Approved', '**Status:** Comment');

expect('Round 2 with an open item, commented', stillOpen, {state: 'COMMENTED'}, 'REVIEW_SHAPE_VALID');
mutate('Round 2 declares no Status', round2, body => swap(body, '**Status:** Approved', 'Status: approved'), {}, 'ROUND_2_STATE_INCOHERENT', 'no `**Status:**` line');
mutate('Round 2 declares Request Changes', round2, body => swap(body, '**Status:** Approved', '**Status:** Request Changes'), {}, 'ROUND_2_STATE_INCOHERENT', 'a `**Status:**` outside the legal Round-2 set');
mutate('Round 2 approves an open item', stillOpen, body => swap(body, '**Status:** Comment', '**Status:** Approved'), {}, 'ROUND_2_STATE_INCOHERENT', 'a STILL_OPEN row under a Status other than Comment');
mutate('Round 2 cites no review', round2, body => swap(body, '5683341608', '[reviewId or URL]'), {}, 'TEMPLATE_INCOMPLETE', 'Round-1 Review ID: the review this round dispositions');
mutate('Round 2 dispositions nothing', round2, body => swap(body, '| ADDRESSED |', '| done |'), {}, 'TEMPLATE_INCOMPLETE', 'a disposition row: ADDRESSED, DEFENDED or STILL_OPEN');
mutate('Round 2 mints a checklist', round2, body => `${body}\n- [ ] one more thing`, {}, 'TEMPLATE_INCOMPLETE', 'no new action checklist: prior actions live in the disposition table');
mutate('Round 2 drops its origin UUID', round2, body => body.replace(UUID, ''), {}, 'TEMPLATE_INCOMPLETE', 'Origin Session ID: a Memory Core UUID on its own line');
mutate('Round 2 shortens its H1', round2, body => swap(body, '# PR Review — Round 2 (disposition only)', '# PR Review — Round 2'), {}, 'TEMPLATE_INCOMPLETE', null);

// ── A plain COMMENT owes no template, and opens no demand packet in any budget state ──────────────────
const note = 'One naming note, nothing blocking.';

expect('a plain comment', note, {state: 'COMMENTED'}, 'COMMENT_SUPPLEMENTARY');
mutate('a comment opens a checkbox demand', note, body => `${body}\n\n### Required Actions\n- [ ] rename the helper`, {state: 'COMMENTED'}, 'COMMENT_ACTION_PACKET', '1 new required-action item(s)');
mutate('a comment opens an RA line', note, body => `${body}\n\n## Required Action\nRA-1: guard the boundary`, {state: 'COMMENTED'}, 'COMMENT_ACTION_PACKET');
mutate('a managed comment opens a demand', note, body => `${body}\n[review-budget-managed]\n### Required Actions\n- [ ] x`, {state: 'COMMENTED'}, 'COMMENT_ACTION_PACKET');
expect('a fenced example packet', `${note}\n\`\`\`\n### Required Actions\n- [ ] example\n\`\`\``, {state: 'COMMENTED'}, 'COMMENT_SUPPLEMENTARY');
expect('a quoted carried action', `${note}\n### Required Actions\n> - [ ] carried from round one`, {state: 'COMMENTED'}, 'COMMENT_SUPPLEMENTARY');
expect('unchecked options outside the section', `${note}\n### Verdict\n- [ ] **APPROVED**`, {state: 'COMMENTED'}, 'COMMENT_SUPPLEMENTARY');
expect('a checked box is no demand', `${note}\n### Required Actions\n- [x] done`, {state: 'COMMENTED'}, 'COMMENT_SUPPLEMENTARY');

// ── Drop+Supersede: a terminal Request Changes with a complete contract ───────────────────────────────
//
// Filled where the full template prints the fields, as a real review does: a field is read from its first line.
const
    terminal      = [
        ['**Status:** [Approved / Approve+Follow-Up / Request Changes / Drop+Supersede / Comment]', '**Status:** Drop+Supersede'],
        ['- **Decision**: [Approve / Approve+Follow-Up / Request Changes / Drop+Supersede]', '- **Decision**: Drop+Supersede'],
        ['- **Disposition:** [implementation-off | ticket-prescription-off | ticket-premise-dead]', '- **Disposition:** ticket-prescription-off'],
        ['[exact paths/lines/anchors proving the premise failure]', 'the caller passes no reader'],
        ['[what is reusable, where it lands, and what is discarded]', 'the parser survives'],
        ['[ticket / amended ticket / closure artifact]', 'a fresh leaf'],
        ['[successor URL or anchor that cites this salvage map]', 'the leaf body']
    ],
    dropSupersede = terminal.reduce((body, [from, to]) => swap(body, from, to), `${canonical}\n[review-budget-managed]`);

expect('a complete Drop+Supersede', dropSupersede, {state: 'CHANGES_REQUESTED'}, 'REVIEW_SHAPE_VALID');
expect('a Drop+Supersede approved', dropSupersede, {}, 'DROP_SUPERSEDE_STATE');
mutate('Drop+Supersede without its Decision line', dropSupersede, body => swap(body, '- **Decision**: Drop+Supersede\n', ''), {state: 'CHANGES_REQUESTED'}, 'DROP_SUPERSEDE_INCOMPLETE', 'the Status and Decision lines both read Drop+Supersede');
mutate('Drop+Supersede with an unknown disposition', dropSupersede, body => swap(body, 'ticket-prescription-off', 'other'), {state: 'CHANGES_REQUESTED'}, 'DROP_SUPERSEDE_INCOMPLETE', 'Disposition: implementation-off | ticket-prescription-off | ticket-premise-dead');
mutate('Drop+Supersede leaves a placeholder', dropSupersede, body => swap(body, 'the parser survives', '[salvage]'), {state: 'CHANGES_REQUESTED'}, 'DROP_SUPERSEDE_INCOMPLETE', 'Salvage map');
mutate('Drop+Supersede writes TBD', dropSupersede, body => swap(body, 'a fresh leaf', 'TBD'), {state: 'CHANGES_REQUESTED'}, 'DROP_SUPERSEDE_INCOMPLETE', 'Successor landing pad');
expect('Drop+Supersede on the Micro-Delta form', [microDelta, '[review-budget-managed]', ...dropSupersede.split('\n').filter(line => terminal.some(([, to]) => line.includes(to)))].join('\n'), {state: 'CHANGES_REQUESTED'}, 'DROP_SUPERSEDE_INCOMPLETE', 'the full or follow-up template, not the Micro-Delta one');

// ── Review budget: a Request Changes after activation owes provenance ─────────────────────────────────
const
    history   = (nodes, extra = {}) => ({base: 'dev', closingPullRequests: {hasNextPage: false, nodes, totalCount: nodes.length, ...extra}, issue: 15257}),
    activated = history([{baseRefName: 'dev', mergedAt: '2026-07-16T20:54:31Z', number: 15307, state: 'MERGED'}]),
    rc        = (extra = {}) => ({state: 'CHANGES_REQUESTED', ...extra});

expect('no activation coordinate, no provenance', canonical, rc(), 'BUDGET_PROVENANCE_MISSING');
expect('managed provenance', `${canonical}\n[review-budget-managed]`, rc(), 'REVIEW_SHAPE_VALID');
expect('a disclosed bypass', `${canonical}\n[review-budget-bypass] reason: the MCP server was down`, rc(), 'REVIEW_SHAPE_VALID');
expect('a bypass without a reason', `${canonical}\n[review-budget-bypass] reason:`, rc(), 'BUDGET_PROVENANCE_MISSING');
expect('an override without the managed path', `${canonical}\n[review-budget-override]`, rc(), 'BUDGET_OVERRIDE_UNMANAGED');
expect('an override on the managed path', `${canonical}\n[review-budget-managed] [review-budget-override]`, rc(), 'REVIEW_SHAPE_VALID');
expect('an approval owes no provenance', canonical, {}, 'REVIEW_SHAPE_VALID');
expect('a pull request opened before activation', canonical, rc({activation: activated, createdAt: '2026-07-01T00:00:00Z'}), 'REVIEW_SHAPE_VALID');
expect('a pull request opened after activation', canonical, rc({activation: activated}), 'BUDGET_PROVENANCE_MISSING');
expect('no merge into the base yet', canonical, rc({activation: history([{baseRefName: 'main', mergedAt: '2026-07-16T20:54:31Z', number: 1, state: 'MERGED'}])}), 'REVIEW_SHAPE_VALID');
expect('a history with another page', canonical, rc({activation: history(activated.closingPullRequests.nodes, {hasNextPage: true})}), 'BUDGET_ACTIVATION_UNPROVABLE');
expect('a history shorter than its count', canonical, rc({activation: history(activated.closingPullRequests.nodes, {totalCount: 2})}), 'BUDGET_ACTIVATION_UNPROVABLE');
expect('a merge with no time', canonical, rc({activation: history([{baseRefName: 'dev', mergedAt: null, number: 1, state: 'MERGED'}])}), 'BUDGET_ACTIVATION_UNPROVABLE');
expect('an unreadable history', canonical, rc({activation: {base: 'dev', closingPullRequests: {}, issue: 15257}}), 'BUDGET_ACTIVATION_UNPROVABLE');
expect('an activated budget and no creation time', canonical, rc({activation: activated, createdAt: 'soon'}), 'BUDGET_COHORT_UNKNOWN');
expect('no coordinate needs no creation time', `${canonical}\n[review-budget-managed]`, rc({createdAt: 'soon'}), 'REVIEW_SHAPE_VALID');

// ── Nothing invisible, and nothing the reviewer wrote, reaches a finding or the comment ──────────────
{
    const
        never   = [...INVISIBLE_STRUCTURE_ANCHORS, ...Object.values(SKELETON_ANCHORS).flat()],
        canary  = 'CANARY-7f3a',
        planted = [
            judgeReview(envelope(swap(round2, '**Status:** Approved', `**Status:** ${canary}`))),
            judgeReview(envelope(`${note}\n### Required Actions\n- [ ] ${canary}`, {state: 'COMMENTED'}))
        ];

    assert.deepEqual(planted.map(({code}) => code), ['ROUND_2_STATE_INCOHERENT', 'COMMENT_ACTION_PACKET']);

    Object.values(REMEDIES).forEach(remedy => never.forEach(anchor => assert.ok(!remedy.includes(anchor), `a remedy names "${anchor}"`)));

    failures.forEach(({input, verdict}) => {
        const comment = correctiveComment(input, verdict);

        never.forEach(anchor => {
            assert.ok(!String(verdict.finding).includes(anchor), `${verdict.code} names "${anchor}" in its finding`);
            assert.ok(!comment.includes(anchor), `${verdict.code} names "${anchor}" in its comment`)
        })
    });

    planted.forEach(verdict => {
        assert.ok(!String(verdict.finding).includes(canary), 'a finding echoes the review body');
        assert.ok(!correctiveComment(envelope(''), verdict).includes(canary), 'the comment echoes the review body')
    });
    arms += 3
}

// ── The comment: one per review, pointing at the template the failure is about ───────────────────────
{
    const
        input   = envelope('LGTM'),
        comment = correctiveComment(input, judgeReview(input));

    assert.ok(comment.startsWith(`${commentMarker(7)}\n`), 'the marker opens the comment');
    assert.ok(comment.includes('@neo-opus-vega') && comment.includes('pullrequestreview-7'), 'the comment addresses the review');
    assert.ok(comment.includes(REVIEW_TEMPLATES.canonical), 'a template miss points at its template');
    assert.ok(correctiveComment(input, {code: 'ROUND_2_STATE_INCOHERENT', finding: null, outcome: 'fail', shape: 'round-2'}).includes(REVIEW_TEMPLATES['round-2']));
    assert.ok(correctiveComment(input, {code: 'DROP_SUPERSEDE_STATE', finding: null, outcome: 'fail', shape: 'canonical'}).includes(REVIEW_TEMPLATES['follow-up']));
    const budgetComment = correctiveComment(input, {code: 'BUDGET_PROVENANCE_MISSING', finding: null, outcome: 'fail', shape: 'canonical'});

    assert.ok(Object.values(REVIEW_TEMPLATES).every(path => !budgetComment.includes(path)), 'a budget failure names no template');
    arms += 5
}

// ── The envelope is validated before anything is judged ──────────────────────────────────────────────
[
    ['a missing budgetActivation key', input => { delete input.budgetActivation }],
    ['a bare repository name', input => { input.repository = 'neo' }],
    ['a review without an id', input => { delete input.review.id }],
    ['a pending review', input => { input.review.state = 'PENDING' }],
    ['an anonymous reviewer', input => { input.review.reviewer = '' }],
    ['a body that is not text', input => { input.review.body = null }],
    ['an activation without its issue', input => { input.budgetActivation = {base: 'dev', closingPullRequests: {}} }]
].forEach(([label, damage]) => {
    const input = envelope(canonical);

    assert.doesNotThrow(() => assertEnvelope(input), 'the base envelope is valid');
    damage(input);
    assert.throws(() => assertEnvelope(input), TypeError, `${label} must be refused`);
    arms++
});

// ── The CLI, as a real process ───────────────────────────────────────────────────────────────────────
function cli(args, input, guard = GUARD) {
    const dir  = tempDir(),
          file = join(dir, 'envelope.json');

    typeof input === 'string' ? writeFileSync(file, input) : writeFileSync(file, JSON.stringify(input));

    const result = spawnSync(process.execPath, [guard, '--envelope', file, ...args], {encoding: 'utf8'});

    return {code: result.status, dir, stderr: result.stderr, stdout: result.stdout}
}

{
    const passing = envelope(canonical),
          failing = envelope('LGTM');

    assert.equal(cli([], passing).code, 0, 'a valid review exits 0');
    assert.equal(cli([], envelope('LGTM', {reviewer: 'tobiu'})).code, 0, 'an unenforced review exits 0');

    const red = cli([], failing);

    assert.equal(red.code, 1, 'a policy failure exits 1');
    assert.match(red.stderr, /TEMPLATE_INCOMPLETE/);

    const written = join(tempDir(), 'comment.md');

    assert.equal(cli(['--comment-file', written], failing).code, 1);
    assert.ok(readFileSync(written, 'utf8').startsWith(commentMarker(7)), 'a failure writes its comment');

    const clean = join(tempDir(), 'comment.md');

    assert.equal(cli(['--comment-file', clean], passing).code, 0);
    assert.ok(!existsSync(clean), 'a pass writes no comment');

    assert.deepEqual(JSON.parse(cli(['--json'], failing).stdout), judgeReview(failing), '--json prints the verdict');

    assert.equal(cli([], '{not json').code, 2, 'unreadable JSON exits 2');
    assert.equal(cli(['--json'], '{not json').stdout.trim(), JSON.stringify({code: 'ENVELOPE_INVALID', finding: null, outcome: 'error', shape: null}));

    const {budgetActivation, ...withoutKey} = passing;

    assert.match(cli([], withoutKey).stderr, /budgetActivation/, 'a missing key is named');
    assert.equal(cli([], withoutKey).code, 2);
    assert.equal(cli(['--bogus'], passing).code, 2, 'an unknown flag exits 2');
    assert.equal(spawnSync(process.execPath, [GUARD], {encoding: 'utf8'}).status, 2, 'no --envelope exits 2');

    // A bin is a symlink once installed; the entrypoint guard must still run the check through one.
    const link = join(tempDir(), 'linked-guard.mjs');

    symlinkSync(GUARD, link);
    assert.equal(cli([], failing, link).code, 1, 'the guard runs through a symlinked entrypoint');
    arms += 12
}

// ── The published package: policy, bin, subpath and templates in; workflows and tests out ───────────
{
    const listing = spawnSync('npm', ['pack', '--dry-run', '--json'], {cwd: root, encoding: 'utf8'});

    assert.equal(listing.status, 0, `npm pack --dry-run failed: ${listing.stderr}`);

    const files = JSON.parse(listing.stdout)[0].files.map(({path}) => path);

    ['scripts/check-pr-review-body.mjs', ...Object.values(REVIEW_TEMPLATES)].forEach(path => assert.ok(files.includes(path), `the package ships ${path}`));
    assert.ok(!files.some(path => path.startsWith('.github/') || /scripts\/test-/.test(path)), 'the package ships no workflow or test source');

    const packDir = tempDir(),
          packed  = spawnSync('npm', ['pack', '--silent', '--pack-destination', packDir], {cwd: root, encoding: 'utf8'});

    assert.equal(packed.status, 0, `npm pack failed: ${packed.stderr}`);

    const installDir = tempDir();

    writeFileSync(join(installDir, 'package.json'), JSON.stringify({name: 'pr-review-fixture', private: true, version: '1.0.0'}));

    const installed = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts', join(packDir, packed.stdout.trim().split('\n').pop())], {cwd: installDir, encoding: 'utf8'});

    assert.equal(installed.status, 0, `npm install failed: ${installed.stderr}`);

    const
        packageRoot = join(installDir, 'node_modules', 'neo-agent-skills'),
        envelopes   = tempDir(),
        run         = input => {
            const file = join(envelopes, `${arms++}.json`);

            writeFileSync(file, JSON.stringify(input));
            return spawnSync('npx', ['--no-install', 'neo-agent-skills-pr-review-body', '--envelope', file], {cwd: installDir, encoding: 'utf8'}).status
        };

    assert.deepEqual(bindingFailures(shape => template(shape, packageRoot)), [], 'the packed templates carry every declared anchor');
    assert.equal(run(envelope(canonical)), 0, 'the packed bin passes a valid review');
    assert.equal(run(envelope('LGTM')), 1, 'the packed bin fails an invalid one');

    const imported = spawnSync(process.execPath, ['--input-type=module', '-e', "import('neo-agent-skills/pr-review-policy').then(m => process.stdout.write(typeof m.judgeReview))"], {cwd: installDir, encoding: 'utf8'});

    assert.equal(imported.stdout, 'function', `the ./pr-review-policy subpath resolves: ${imported.stderr}`)
}

scratch.forEach(dir => rmSync(dir, {force: true, recursive: true}));

console.log(`check-pr-review-body: ${arms} contract arms green.`);
