#!/usr/bin/env node
/** @summary Mutation-sensitive contract checks for the portable substrate-size CLI. */

import assert                                                        from 'node:assert/strict';
import {spawnSync}                                                   from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir}                                                      from 'node:os';
import {dirname, join}                                               from 'node:path';
import {fileURLToPath}                                               from 'node:url';
import {PER_FILE_LIMIT_BYTES, collectReport, resolveLoadedSize, run} from './check-substrate-size.mjs';

const
    here      = dirname(fileURLToPath(import.meta.url)),
    GUARD     = join(here, 'check-substrate-size.mjs'),
    // macOS resolves /tmp through a symlink, and one arm below asserts what node does with symlinked
    // entrypoints. Spawning the already-resolved path would decide that arm before it runs.
    CLI_GUARD = GUARD.startsWith('/private/tmp/') ? GUARD.replace('/private/tmp/', '/tmp/') : GUARD,
    fixtures  = [];

/** @summary A disposable tree, cleaned up when the file finishes. */
function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'substrate-size-'));

    fixtures.push(root);
    return root
}

/** @summary Writes a file, creating its directory. */
function write(root, file, body) {
    mkdirSync(dirname(join(root, file)), {recursive: true});
    writeFileSync(join(root, file), body);
    return join(root, file)
}

/** @summary Collects a run's stdout/stderr without printing it. */
function capture(argv, cwd) {
    const lines = [];

    return {code: run(argv, {cwd, out: line => lines.push(line), error: line => lines.push(line)}), text: lines.join('\n')}
}

// ── A repository with no substrate files greens the job ────────────────────────────────────────
// The Engine implementation this ports errored on an absent target, which would red the Brain,
// Skills and Institution for correctly carrying none. A baseline three of five consumers cannot
// adopt is not a baseline, so absent is N/A and never a failure.
{
    const root = fixture(),
          rows = collectReport({root});

    assert.equal(rows.length, 3);
    assert.ok(rows.every(row => row.applicable === false), 'every absent target is reported not-applicable');
    assert.ok(rows.every(row => row.error === null), 'an absent target is never an error');

    const {code, text} = capture([], root);

    assert.equal(code, 0, 'a repository with zero targets exits 0');
    assert.match(text, /N\/A/, 'and says N/A rather than passing silently');
}

// ── A partially-populated repository measures what is there ────────────────────────────────────
{
    const root = fixture();

    write(root, 'AGENTS.md', 'a'.repeat(100));

    const rows = collectReport({root});

    assert.equal(rows.find(row => row.file === 'AGENTS.md').bytes, 100);
    assert.equal(rows.find(row => row.file === 'AGENTS.md').headroom, PER_FILE_LIMIT_BYTES - 100);
    assert.equal(rows.filter(row => !row.applicable).length, 2, 'the two absent targets stay N/A');
    assert.equal(capture([], root).code, 0);
}

// ── A breach exits non-zero and names the file, its bytes and the limit ────────────────────────
{
    const root = fixture(),
          size = PER_FILE_LIMIT_BYTES + 1;

    write(root, 'AGENTS.md', 'a'.repeat(size));

    const {code, text} = capture([], root);

    assert.equal(code, 1);
    assert.match(text, /AGENTS\.md/);
    assert.match(text, new RegExp(String(size)), 'the failure names the measured byte count');
    assert.match(text, new RegExp(String(PER_FILE_LIMIT_BYTES)), 'and the limit it breached');
    assert.match(text, /OVER by 1/, 'and by how much');
}

// ── Exactly at the limit passes; one byte past it fails ────────────────────────────────────────
// The comparison is `>`, and a `>=` mutation would red a file that fits exactly. Asserting only the
// breach case cannot see that: both spellings fail an over-limit file.
{
    const root = fixture();

    write(root, 'AGENTS.md', 'a'.repeat(PER_FILE_LIMIT_BYTES));
    assert.equal(capture([], root).code, 0, 'a file exactly at the limit is not a breach');

    write(root, 'AGENTS.md', 'a'.repeat(PER_FILE_LIMIT_BYTES + 1));
    assert.equal(capture([], root).code, 1);
}

// ── A symlinked entry point is measured as its resolution, not as the link ─────────────────────
// This is the surface that hid: `lstat` on a symlink reports the length of the target PATH STRING —
// 12 bytes for `../AGENTS.md` — while the seat reads the whole file through it. An lstat-only
// implementation reports 12 here and passes a tree that is 5 bytes over budget.
{
    const root  = fixture(),
          bytes = PER_FILE_LIMIT_BYTES + 5;

    write(root, 'AGENTS.md', 'a'.repeat(bytes));
    mkdirSync(join(root, '.claude'), {recursive: true});
    symlinkSync('../AGENTS.md', join(root, '.claude/CLAUDE.md'));

    const row = collectReport({root}).find(entry => entry.file === '.claude/CLAUDE.md');

    assert.equal(row.applicable, true, 'a symlinked target is present');
    assert.equal(row.bytes, bytes, 'the link is measured as what it resolves to');
    assert.notEqual(row.bytes, '../AGENTS.md'.length, 'and not as the length of the target path string');
    assert.equal(row.over, true);
    assert.equal(capture([], root).code, 1);
}

// ── A dangling entry point is an error, never a skip ───────────────────────────────────────────
// `existsSync` follows symlinks, so the obvious presence test answers "absent" for a link pointing
// at nothing — and with absent now meaning N/A, the guard would go quiet on a seat whose rules
// resolve to no bytes at all. Presence is decided by `lstat`, which sees the entry itself.
{
    const root = fixture();

    mkdirSync(join(root, '.claude'), {recursive: true});
    symlinkSync('../AGENTS.md', join(root, '.claude/CLAUDE.md'));

    const row = collectReport({root}).find(entry => entry.file === '.claude/CLAUDE.md');

    assert.equal(row.applicable, true, 'a dangling link is present, not absent');
    assert.ok(row.error, 'and unmeasurable, which fails closed');

    const {code, text} = capture([], root);

    assert.equal(code, 1, 'a target that exists and cannot be measured is a failure');
    assert.match(text, /could not be measured/);
}

// ── Whole-line @-imports are summed as one loaded unit ─────────────────────────────────────────
{
    const root = fixture();

    write(root, 'rules/extra.md', 'b'.repeat(500));
    write(root, '.claude/CLAUDE.md', ['# seat', '@../rules/extra.md', ''].join('\n'));

    const
        stub = readFileSync(join(root, '.claude/CLAUDE.md')).length,
        row  = collectReport({root}).find(entry => entry.file === '.claude/CLAUDE.md');

    assert.equal(row.bytes, stub + 500, 'the seat pays for the importer plus everything it pulls in');
    assert.deepEqual(row.members, ['rules/extra.md'], 'and the composition is named');
}

// ── Members are named against the canonical root, even when the root is reached by a link ──────
// Imports resolve against the importer's realpath. Naming members relative to an UNRESOLVED root
// produces a `../../..` climb out of the tree and back down — it reads as a path escape rather than
// as composition. macOS reaches every temp directory through a symlink, so the arm above sees this
// locally; Linux CI does not, and would green a regression. This arm links the root explicitly.
{
    const
        real = fixture(),
        link = join(fixture(), 'linked-root');

    write(real, 'rules/extra.md', 'b'.repeat(500));
    write(real, '.claude/CLAUDE.md', '@../rules/extra.md\n');
    symlinkSync(real, link);

    assert.deepEqual(
        collectReport({root: link}).find(entry => entry.file === '.claude/CLAUDE.md').members,
        ['rules/extra.md']
    )
}

// ── An import is only an import on its own line ────────────────────────────────────────────────
// A pattern without anchors would count prose mentioning an @path as a load, inflating every total.
{
    const root = fixture();

    write(root, 'rules/extra.md', 'b'.repeat(500));
    write(root, '.claude/CLAUDE.md', 'see @../rules/extra.md for detail\n');

    assert.equal(collectReport({root}).find(entry => entry.file === '.claude/CLAUDE.md').members.length, 0)
}

// ── Imports recurse, and a cycle terminates instead of hanging ─────────────────────────────────
{
    const root = fixture();

    write(root, 'a.md', '@b.md\n');
    write(root, 'b.md', '@a.md\n');

    const {bytes, members} = resolveLoadedSize('a.md', {root});

    assert.equal(bytes, '@b.md\n'.length + '@a.md\n'.length, 'each member is paid for once');
    assert.deepEqual(members, ['b.md', 'a.md'])
}

// ── The cycle guard keys on file IDENTITY, not on the path used to reach it ────────────────────
// Two paths to one file is the normal shape here: an entry point is a symlink, and something also
// imports the target directly. Keying the guard on the path string counts those bytes twice and
// reports a budget the seat never pays — inflated toward a false breach rather than a false pass,
// but wrong either way.
{
    const root = fixture();

    write(root, 'AGENTS.md', '@link.md\n');
    symlinkSync(join(root, 'AGENTS.md'), join(root, 'link.md'));

    assert.equal(resolveLoadedSize('AGENTS.md', {root}).bytes, '@link.md\n'.length,
        'the same file reached by two names is paid for once')
}

// ── A missing import fails closed rather than dropping a member ────────────────────────────────
// A budget that silently skips a renamed member measures a fiction and reports it as a pass.
{
    const root = fixture();

    write(root, 'AGENTS.md', '@renamed.md\n');

    const {code, text} = capture([], root);

    assert.equal(code, 1);
    assert.match(text, /renamed\.md/)
}

// ── The limit is not a command-line option ─────────────────────────────────────────────────────
// The gate's whole value is that a pull request cannot widen the budget it is judged by. A `--limit`
// flag would hand that back, and this arm reds if one is ever added.
{
    const root = fixture();

    write(root, 'AGENTS.md', 'a'.repeat(PER_FILE_LIMIT_BYTES + 1));

    const {code} = capture(['--limit', '999999'], root);

    assert.equal(code, 2, 'an unknown option is CLI misuse, not a wider budget');
    assert.equal(capture([], root).code, 1, 'and the breach still reds')
}

// ── Process-level arms: the shipping path, not just the exported functions ─────────────────────
{
    const root = fixture();

    write(root, 'AGENTS.md', 'a'.repeat(PER_FILE_LIMIT_BYTES + 1));

    const breach = spawnSync(process.execPath, [CLI_GUARD, '--root', root], {encoding: 'utf8'});

    assert.equal(breach.status, 1, 'a breach exits 1 as a process, not only as a return value');
    assert.match(breach.stderr, /over the 24576 byte limit/);

    const clean = spawnSync(process.execPath, [CLI_GUARD, '--root', fixture()], {encoding: 'utf8'});

    assert.equal(clean.status, 0, 'an empty tree exits 0 as a process');

    const help = spawnSync(process.execPath, [CLI_GUARD, '--help'], {encoding: 'utf8'});

    assert.equal(help.status, 0);
    assert.match(help.stdout, /neo-agent-skills-substrate-size/)
}

// ── The entrypoint guard survives BOTH ways a path can arrive unresolved ───────────────────────
// Reached through a symlink, argv[1] is the link and import.meta.url is the target; under
// --preserve-symlinks-main it is the other way round. Either mismatch makes the guard false, and a
// guard that never runs exits 0 with nothing measured — indistinguishable from a pass.
{
    const
        root = fixture(),
        link = join(fixture(), 'substrate-size-link.mjs');

    write(root, 'AGENTS.md', 'a'.repeat(PER_FILE_LIMIT_BYTES + 1));
    symlinkSync(GUARD, link);

    const viaLink = spawnSync(process.execPath, [link, '--root', root], {encoding: 'utf8'});

    assert.equal(viaLink.status, 1, 'invoked through a symlink — the installed `bin` shape — the guard still runs');

    const preserved = spawnSync(process.execPath, ['--preserve-symlinks-main', link, '--root', root], {encoding: 'utf8'});

    assert.equal(preserved.status, 1, 'and under --preserve-symlinks-main, which reverses which side is unresolved')
}

// ── The CLI ships with a bin entry, or consumers cannot invoke it ──────────────────────────────
{
    const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'));

    assert.equal(pkg.bin['neo-agent-skills-substrate-size'], './scripts/check-substrate-size.mjs')
}

fixtures.forEach(root => rmSync(root, {recursive: true, force: true}));

console.log('check-substrate-size: contract arms green.');
