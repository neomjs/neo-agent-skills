#!/usr/bin/env node
/** @summary Mutation-sensitive contract checks for the portable PR-body anchor guard. */

import assert                                   from 'node:assert/strict';
import {spawnSync}                              from 'node:child_process';
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
        'a non-draft body without `Resolves #N` must be refused');

    assert.deepEqual(findBodyViolations({body: noResolves, isDraft: true}).visible, [],
        'a DRAFT may defer the close target when it carries `Refs #N`');

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

    assert.ok(findBodyViolations({body: comma}).visible.some(v => v.includes('`Resolves #X, #Y` is forbidden')),
        'the comma form must be named as forbidden, not merely reported missing');

    // Draft exception survives, and it is standalone too.
    assert.deepEqual(findBodyViolations({body: `Refs #1234\n${withoutResolves}`, isDraft: true}).visible, [],
        'a DRAFT may defer the close target with a standalone `Refs #N`');
    assert.ok(findBodyViolations({body: `see Refs #1234 inline\n${withoutResolves}`, isDraft: true})
        .visible.some(v => v.includes('Refs #N')), 'an inline `Refs` is not a declaration either')
}

// ── The CLI ships with a bin entry, or consumers cannot invoke it ──────────────────────────────
{
    const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'));

    assert.equal(pkg.bin['neo-agent-skills-pr-body'], './scripts/check-pr-body.mjs');
    assert.ok(pkg.files.includes('scripts/check-pr-body.mjs'), 'the guard must ship in the package')
}

scratch.forEach(dir => rmSync(dir, {force: true, recursive: true}));

console.log('check-pr-body: contract arms green.');
