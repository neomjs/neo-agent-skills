#!/usr/bin/env node
/** @summary Mutation-sensitive contract checks for the portable PR-body anchor guard. */

import assert                                   from 'node:assert/strict';
import {spawn, spawnSync}                       from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir}                                 from 'node:os';
import {dirname, join}                          from 'node:path';
import {fileURLToPath}                          from 'node:url';
import {VISIBLE_PR_BODY_ANCHORS, INVISIBLE_PR_BODY_ANCHORS, findBodyViolations, hasAnchor, run} from './check-pr-body.mjs';

const
    here      = dirname(fileURLToPath(import.meta.url)),
    GUARD     = join(here, 'check-pr-body.mjs'),
    // macOS resolves /tmp through a symlink and one arm below asserts what node does with a
    // symlinked entrypoint. Spawning the already-resolved path would decide that arm before it runs.
    CLI_GUARD = GUARD.startsWith('/private/tmp/') ? GUARD.replace('/private/tmp/', '/tmp/') : GUARD,
    scratch   = [];

/** @summary A body carrying every anchor as a real line, plus a close target. */
function goodBody(extra = '') {
    return [
        'Resolves #1234',
        '',
        'Evidence: L2 (unit) → L2 required. No residuals.',
        '',
        '## AC Evidence',
        '| AC-1 | covered |',
        '',
        '## Deltas from ticket',
        'None substantive.',
        '',
        '## Test Evidence',
        'All coverage runs in CI.',
        '',
        '## Post-Merge Validation',
        'None.',
        '',
        'Authored by @neo-opus-grace.',
        extra
    ].join('\n')
}

/** @summary Runs the CLI as a real process. */
function cli(args, body) {
    const dir  = mkdtempSync(join(tmpdir(), 'pr-body-'));
    const file = join(dir, 'body.md');

    scratch.push(dir);
    writeFileSync(file, body);

    const result = spawnSync(process.execPath, [CLI_GUARD, '--body-file', file, ...args], {encoding: 'utf8'});

    return {code: result.status, text: `${result.stdout}${result.stderr}`}
}

// ── The canonical body passes ──────────────────────────────────────────────────────────────────
{
    const {visible, invisible} = findBodyViolations({body: goodBody()});

    assert.deepEqual(visible, [], 'a complete body must report no visible misses');
    assert.deepEqual(invisible, [], 'a complete body must report no invisible misses');
    assert.equal(cli([], goodBody()).code, 0)
}

// ── THE #28 DEFECT: naming an anchor in prose must NOT satisfy it ──────────────────────────────
//
// The previous gate used `body.includes(anchor)` against the whole body. Every anchor also appears
// in bodies that DISCUSS the anchors, so a body that never carried the section passed by mentioning
// it. Measured on the restoration PR: deleting the `## Deltas` heading left three surviving prose
// occurrences and the check stayed green.
//
// Each arm below removes one anchor's LINE while leaving the anchor's text in prose. Under the old
// substring rule every one of these was green.
VISIBLE_PR_BODY_ANCHORS.concat(INVISIBLE_PR_BODY_ANCHORS).filter(spec => spec.match === 'line').forEach(({anchor}) => {
    const body = goodBody()
        .split('\n')
        .filter(line => !line.replace(/^[ \t]+/, '').startsWith(anchor))
        .concat([`This PR intentionally omits ${anchor} because everything runs in CI.`])
        .join('\n');

    assert.ok(body.includes(anchor), `fixture must still MENTION ${anchor}, or it proves nothing`);

    const {visible, invisible} = findBodyViolations({body});

    assert.ok(
        visible.includes(anchor) || invisible.includes(anchor),
        `naming "${anchor}" in prose must not satisfy it — this is the #28 defect`
    );

    assert.equal(cli([], body).code, 1, `a prose-only "${anchor}" must exit non-zero`)
});

// ── A table cell does not satisfy an anchor ────────────────────────────────────────────────────
{
    assert.equal(hasAnchor('| ## Test Evidence | present |', {anchor: '## Test Evidence', match: 'line'}), false,
        'a table row opens with `|`, so it is not the anchor line');
    assert.equal(hasAnchor('   ## Test Evidence', {anchor: '## Test Evidence', match: 'line'}), true,
        'indentation is formatting, not evasion')
}

// ── The close-target rules ─────────────────────────────────────────────────────────────────────
{
    const noResolves = goodBody().replace('Resolves #1234', 'Refs #1234');

    assert.ok(findBodyViolations({body: noResolves}).visible.some(v => v.includes('Resolves #N')),
        'a body without `Resolves #N` must be refused');

    // No draft exception any more (@tobiu, 2026-09-23: "zero exceptions"): the CLI has no `--draft`
    // flag, and strict argument parsing refuses one rather than ignoring it.
    assert.throws(() => run(['--draft'], {stdin: noResolves, out: () => {}, error: () => {}}), /Unknown option '--draft'/,
        'a draft flag must be refused, never silently honoured');

    // Exactly ONE ticket: a second standalone line is named as the rule it breaks.
    assert.ok(findBodyViolations({body: `Resolves #5678\n${goodBody()}`}).visible.some(v => v.includes('exactly ONE ticket')),
        'two standalone `Resolves` lines must be refused');

    assert.ok(findBodyViolations({body: goodBody().replace('Resolves #1234', 'Closes #1234')})
        .visible.some(v => v.includes('forbidden')), '`Closes #N` must be refused');

    assert.ok(findBodyViolations({body: goodBody().replace('Resolves #1234', 'Fixes #1234')})
        .visible.some(v => v.includes('forbidden')), '`Fixes #N` must be refused')
}

// ── The failure message never enumerates the anchor set ────────────────────────────────────────
//
// A message listing every missing anchor is a template an agent can satisfy without writing the
// sections — the anchor-stuffing this split exists to defeat. At most one diagnostic anchor, and
// never an invisible one.
{
    const body = goodBody().split('\n').filter(line => !line.startsWith('Authored by ')).join('\n'),
          {text} = cli([], body);

    INVISIBLE_PR_BODY_ANCHORS.forEach(({anchor}) => {
        assert.ok(!text.includes(anchor), `the failure message must never name the invisible anchor ${anchor}`)
    })
}

// ── NO REGRESSION: a governance body that DISCUSSES the anchor set stays green ─────────────────
//
// The arm that keeps the fix from overshooting. Bodies in this repository routinely name every
// anchor in prose while also carrying the sections — this comment block does it. Line-anchoring
// must refuse a body that only *mentions* an anchor without refusing one that mentions AND carries.
{
    const discursive = goodBody([
        '',
        'This PR explains the anchor set: `## AC Evidence` certifies coverage, `## Test Evidence`',
        'carries outside-CI receipts, `## Post-Merge Validation` lists deferred checks, and',
        '`## Deltas` records scope changes. `Evidence:` and `Authored by ` are line prefixes.'
    ].join('\n'));

    const {visible, invisible} = findBodyViolations({body: discursive});

    assert.deepEqual(visible, [], 'a body that discusses the anchors AND carries them must stay green');
    assert.deepEqual(invisible, [], 'discussion must not disturb the invisible anchors either');
    assert.equal(cli([], discursive).code, 0)
}

// ── An anchor with no declared match kind THROWS rather than picking one ────────────────────────
//
// An unnamed default is how the substring rule survived unexamined: nobody chose it, so nobody
// reviewed it. A declaration error must be loud at the point of declaration.
{
    assert.throws(() => hasAnchor('anything', {anchor: '## Nope'}), /declares no match kind/,
        'an undeclared match kind must throw, not default');

    [...VISIBLE_PR_BODY_ANCHORS, ...INVISIBLE_PR_BODY_ANCHORS].forEach(spec => {
        assert.ok(['line', 'substring'].includes(spec.match),
            `${spec.anchor} must declare a known match kind, not "${spec.match}"`)
    })
}

// ── A CODE anchor is not a section: fenced and indented blocks are not content ─────────────────
//
// The first fix taught the gate that a sentence naming `## Deltas` is not the section, and left it
// believing a FENCED one is. Same defect, one level in. Both arms delete the real line and leave
// the anchor visible in a place a reader would call code.
{
    const withoutTestEvidence = goodBody()
        .split('\n').filter(line => !line.startsWith('## Test Evidence')).join('\n');

    const fenced = `${withoutTestEvidence}\n\n\`\`\`md\n## Test Evidence\n\`\`\`\n`,
          tilde  = `${withoutTestEvidence}\n\n~~~\n## Test Evidence\n~~~\n`,
          indent = `${withoutTestEvidence}\n\n    ## Test Evidence\n`,
          tabbed = `${withoutTestEvidence}\n\n\t## Test Evidence\n`;

    [['fenced', fenced], ['tilde-fenced', tilde], ['4-space indented', indent], ['tab indented', tabbed]]
        .forEach(([label, body]) => {
            assert.ok(body.includes('## Test Evidence'), `${label}: fixture must still CONTAIN the anchor`);
            assert.ok(findBodyViolations({body}).visible.includes('## Test Evidence'),
                `a ${label} "## Test Evidence" must not satisfy the anchor`);
            assert.equal(cli([], body).code, 1, `${label} must exit non-zero`)
        });

    // NO OVERSHOOT: Markdown permits up to three spaces before a heading, and a real body may
    // carry one. Rejecting that would trade this defect for a false negative.
    const threeSpace = withoutTestEvidence.replace('## AC Evidence', '   ## Test Evidence\n\n## AC Evidence');

    assert.deepEqual(findBodyViolations({body: threeSpace}).visible, [],
        'a heading indented three spaces is still a heading');

    // An unterminated fence swallows the rest of the body — a real hazard, so it is asserted
    // rather than left to chance.
    const unterminated = `${goodBody()}\n\n\`\`\`\n## Test Evidence\n`;

    assert.deepEqual(findBodyViolations({body: unterminated}).visible, [],
        'the REAL sections above an unterminated fence still count');
}

// ── The close target is a STANDALONE line, exactly as §9.1 promises ────────────────────────────
//
// `pull-request-workflow.md` §9.1: "standalone Resolves #TICKET_ID", and "comma-separated
// `Resolves #X, #Y` is forbidden". The previous pattern searched the whole raw body, so every
// mutant below satisfied a rule that forbids it.
{
    const withoutResolves = goodBody()
        .split('\n').filter(line => !line.startsWith('Resolves ')).join('\n');

    const mutants = {
        'mid-prose'  : 'This PR Resolves #1234 as a side effect.',
        'fenced'     : '```\nResolves #1234\n```',
        'table cell' : '| note | Resolves #1234 |',
        'indented'   : '    Resolves #1234',
        'colon form' : 'Resolves: #1234'
    };

    Object.entries(mutants).forEach(([label, line]) => {
        const body = `${line}\n${withoutResolves}`;

        assert.ok(body.includes('Resolves'), `${label}: fixture must still MENTION Resolves`);
        assert.ok(findBodyViolations({body}).visible.some(v => v.includes('Resolves #N')),
            `a ${label} "Resolves" must not satisfy the close target`)
    });

    // The comma form is a close target the author wrote DELIBERATELY, so it earns its own message
    // rather than being reported as absent.
    const comma = `Resolves #1234, #5678\n${withoutResolves}`;

    assert.ok(findBodyViolations({body: comma}).visible.some(v => v.includes('exactly ONE ticket')),
        'the comma form must be named as the one-ticket rule, not merely reported missing');
    assert.ok(!findBodyViolations({body: comma}).visible.some(v => v.startsWith('`Resolves #N` on its own line')),
        'and must not ALSO be reported as absent');

    // A standalone `Refs` never stands in for the close target.
    assert.ok(findBodyViolations({body: `Refs #1234\n${withoutResolves}`}).visible.some(v => v.includes('Resolves #N')),
        'a standalone `Refs #N` is not a close target')
}

// ── --close-target-only judges the close target alone (every PR, any author) ──────────────────
//
// A human contributor's PR is held to the repository's one rule, not to the agent template: the
// anchors are absent from this fixture, and the verdict must not mention them either way.
{
    const human = 'Adds the missing null check.\n\nResolves #1234';

    assert.equal(cli(['--close-target-only'], human).code, 0, 'a human body with one `Resolves` passes');

    const refsOnly = cli(['--close-target-only'], 'Adds the missing null check.\n\nRefs #1234');

    assert.equal(refsOnly.code, 1, 'a human body with only `Refs` fails');
    assert.ok(refsOnly.text.includes('Resolves #N'), 'and the failure names the close target');
    VISIBLE_PR_BODY_ANCHORS.forEach(({anchor}) => assert.ok(!refsOnly.text.includes(anchor),
        `a close-target failure must not mention the agent anchor ${anchor}`));

    assert.equal(cli(['--close-target-only'], 'Resolves #1\nResolves #2').code, 1, 'two tickets fail for humans too')
}

// ── One canonical line does not make a second closing expression inert ──────────────────────────
//
// GitHub closes on any-case keywords, an optional colon, a qualified target and inline prose. Each bypass below
// passed the canonical-line count alone; each must now fail in BOTH scopes, while non-closing references stay green.
{
    const bypasses = {
        'lowercase keyword'  : 'resolves #2',
        'colon form'         : 'Resolves: #2',
        'qualified reference': 'Resolves neomjs/neo-agent-skills#2',
        'past tense'         : 'Resolved #2',
        'inline prose'       : 'This also fixes #2.',
        'issue URL'          : 'Closes https://github.com/neomjs/neo/issues/2'
    };

    Object.entries(bypasses).forEach(([label, line]) => {
        const human = `Resolves #1\n${line}`;

        assert.equal(cli(['--close-target-only'], human).code, 1, `${label}: a second closing reference fails the close-target scope`);
        assert.ok(findBodyViolations({body: `${line}\n${goodBody()}`}).visible.some(v => v.includes('exactly ONE ticket')),
            `${label}: and the full agent scope names the one-ticket rule`)
    });

    // Controls for the same entry point: the canonical line alone passes, and references GitHub does not act on
    // never count as a second target.
    assert.equal(cli(['--close-target-only'], 'Resolves #1').code, 0, 'one canonical line passes');
    ['Refs #2', 'Related: #2', 'see #2', 'Fixed a bug where #2 misrendered'].forEach(line => {
        assert.equal(cli(['--close-target-only'], `Resolves #1\n${line}`).code, 0, `"${line}" is not a closing reference`);
        assert.deepEqual(findBodyViolations({body: `${line}\n${goodBody()}`}).visible, [], `"${line}" keeps the agent scope green`)
    })
}

// ── A body file is read the same whatever stdin is, and no path passes an empty body ───────────
//
// An agent harness spawns its processes with a stdin that is neither a TTY nor a closed pipe. `spawnSync` closes the
// stdin it creates, so the arms above cannot see what such a stdin does: these spawn the CLI and leave stdin open.
{
    const openStdin = (args, timeout = 5000) => new Promise(resolve => {
        const child = spawn(process.execPath, [CLI_GUARD, ...args], {stdio: ['pipe', 'pipe', 'pipe']}),
              timer = setTimeout(() => {child.kill(); resolve('hung')}, timeout);

        child.on('exit', code => {clearTimeout(timer); resolve(code)})
    });

    const bodyFile = body => {
        const dir = mkdtempSync(join(tmpdir(), 'pr-body-'));

        scratch.push(dir);
        writeFileSync(join(dir, 'body.md'), body);

        return join(dir, 'body.md')
    };

    assert.equal(await openStdin(['--body-file', bodyFile(goodBody())]), 0, 'a body file passes with stdin left open');
    assert.equal(await openStdin([`--body-file=${bodyFile('Resolves #1')}`]), 1, 'and fails on its own merits, in both flag forms');

    assert.equal(spawnSync(process.execPath, [CLI_GUARD], {input: goodBody()}).status, 0, 'a piped body still passes');
    assert.equal(spawnSync(process.execPath, [CLI_GUARD], {input: ''}).status, 1, 'an empty piped body fails');
    assert.equal(cli([], '').code, 1, 'an empty body file fails')
}

// ── The CLI ships with a bin entry, or consumers cannot invoke it ──────────────────────────────
{
    const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'));

    assert.equal(pkg.bin['neo-agent-skills-pr-body'], './scripts/check-pr-body.mjs');
    assert.ok(pkg.files.includes('scripts/check-pr-body.mjs'), 'the guard must ship in the package')
}

scratch.forEach(dir => rmSync(dir, {force: true, recursive: true}));

console.log('check-pr-body: contract arms green.');
