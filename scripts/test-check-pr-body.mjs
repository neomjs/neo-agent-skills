#!/usr/bin/env node
/** @summary Mutation-sensitive contract checks for the portable PR-body anchor guard. */

import assert                                   from 'node:assert/strict';
import {spawnSync}                              from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir}                                 from 'node:os';
import {dirname, join}                          from 'node:path';
import {fileURLToPath}                          from 'node:url';
import {VISIBLE_PR_BODY_ANCHORS, INVISIBLE_PR_BODY_ANCHORS, findBodyViolations, hasAnchorLine, run} from './check-pr-body.mjs';

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
VISIBLE_PR_BODY_ANCHORS.concat(INVISIBLE_PR_BODY_ANCHORS).forEach(anchor => {
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
    assert.equal(hasAnchorLine('| ## Test Evidence | present |', '## Test Evidence'), false,
        'a table row opens with `|`, so it is not the anchor line');
    assert.equal(hasAnchorLine('   ## Test Evidence', '## Test Evidence'), true,
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

    INVISIBLE_PR_BODY_ANCHORS.forEach(anchor => {
        assert.ok(!text.includes(anchor), `the failure message must never name the invisible anchor ${anchor}`)
    })
}

// ── The CLI ships with a bin entry, or consumers cannot invoke it ──────────────────────────────
{
    const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'));

    assert.equal(pkg.bin['neo-agent-skills-pr-body'], './scripts/check-pr-body.mjs');
    assert.ok(pkg.files.includes('scripts/check-pr-body.mjs'), 'the guard must ship in the package')
}

scratch.forEach(dir => rmSync(dir, {force: true, recursive: true}));

console.log('check-pr-body: contract arms green.');
