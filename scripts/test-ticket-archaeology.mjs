#!/usr/bin/env node
/** @summary Mutation-sensitive contract checks for the portable ticket-archaeology CLI. */

import assert                           from 'node:assert/strict';
import {execFileSync, spawnSync}        from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir}                         from 'node:os';
import {dirname, join}                  from 'node:path';
import {fileURLToPath}                  from 'node:url';
import {findArchaeology, isInScopePath} from './check-ticket-archaeology.mjs';

const
    here  = dirname(fileURLToPath(import.meta.url)),
    GUARD = join(here, 'check-ticket-archaeology.mjs'),
    CLI_GUARD = GUARD.startsWith('/private/tmp/') ? GUARD.replace('/private/tmp/', '/tmp/') : GUARD;

/** @summary Finding line numbers for one JavaScript source fixture. */
function hitLines(source) {
    return findArchaeology(source).map(hit => hit.line)
}

assert.deepEqual(hitLines([
    '// smallest repo-local ref #1',
    '// short repo-local ref #14',
    '// three-digit repo-local ref #242',
    '/** large repo-local ref #12345 */'
].join('\n')), [1, 2, 3, 4]);

assert.deepEqual(hitLines([
    'const value = 1; // trailing ticket #14',
    '/*',
    ' * block ticket #242',
    ' */'
].join('\n')), [1, 3]);

assert.deepEqual(hitLines([
    '// issue 4 introduced it',
    '// Ticket #18 owns it',
    '// PR 242 reviewed it',
    '// Epic #14 groups it',
    '// Discussion 7 explored it',
    '// ADR-3 settled it'
].join('\n')), [1, 2, 3, 4, 5, 6]);

assert.deepEqual(hitLines([
    '// RA-1 added this arm',
    '// review round 2 changed it',
    '// round 3 reviewer disposition',
    '// round 1 and round 2 both stayed green',
    '// both earlier rounds were silent',
    '// the first review cycle missed it'
].join('\n')), [1, 2, 3, 4, 5, 6]);

assert.deepEqual(findArchaeology([
    '// Round 1: register the first window.',
    '// Round 2: repeat with the opposite order.'
].join('\n')), [], 'behavioral rounds are not review archaeology without a history marker');

assert.deepEqual(findArchaeology([
    "const title = 'ticket #14';",
    "const url = 'https://github.com/neomjs/neo-agent-skills/issues/18';",
    'const template = `review round 2 and #242`;',
    "test('review witness (#242 RA-1)', () => {});",
    '// theme token #1234ff'
].join('\n')), []);

assert.deepEqual(hitLines('// CSS color #000000 [not-ticket-ref: css-color]'), [],
    'a typed marker exempts exactly one ambiguous numeric CSS token');
assert.deepEqual(hitLines('// ticket #14 beside CSS color #000000 [not-ticket-ref: css-color]'), [1],
    'the typed color marker cannot hide another tracking reference');
assert.deepEqual(hitLines('// see #242 [not-ticket-ref: css-color]'), [1],
    'a typed marker without CSS syntax cannot relabel a short ticket');
assert.deepEqual(hitLines('// [not-ticket-ref: css-color]'), [1], 'an unused marker fails closed');
assert.deepEqual(hitLines('// token #242'), [1], 'generic token wording cannot make a short ticket green');
assert.deepEqual(hitLines('// theme #242'), [1], 'generic theme wording cannot make a short ticket green');

assert.deepEqual(hitLines('// ref #14 ticket-ref-ok: implementation history'), [1],
    'a legacy escape marker must not suppress a real tracking reference');
assert.deepEqual(hitLines('// ticket-ref-ok: stale escape'), [1], 'a legacy marker is itself invalid');
assert.deepEqual(hitLines("const marker = 'ticket-ref-ok'; // ticket #14"), [1],
    'a code string cannot suppress a trailing comment');

assert.deepEqual(findArchaeology([
    'const raw = `line one',
    '// ticket #14 is template data',
    'line three`;'
].join('\n')), [], 'comment punctuation in template data remains a string');

assert.deepEqual(hitLines([
    'const template = `value ${(() => {',
    '    // nested ticket #14',
    '    return 1',
    '})()}`;'
].join('\n')), [2], 'real comments inside template expressions remain visible');

assert.throws(() => findArchaeology('export const = broken;'), /Unexpected token/,
    'invalid modules fail closed instead of looking comment-clean');

assert.equal(isInScopePath('src/Foo.mjs'), true);
assert.equal(isInScopePath('apps/demo/Main.mjs'), true);
assert.equal(isInScopePath('.claude/hooks/stop.mjs'), true);
assert.equal(isInScopePath('resources/source.mjs'), true);
assert.equal(isInScopePath('node_modules/pkg/index.mjs'), false);
assert.equal(isInScopePath('src/Foo.js'), false);

const repo    = mkdtempSync(join(tmpdir(), 'skills-archaeology-')),
      outside = mkdtempSync(join(tmpdir(), 'skills-archaeology-outside-'));

try {
    const git = args => execFileSync('git', args, {cwd: repo, encoding: 'utf8'});

    git(['init', '-b', 'dev']);
    git(['config', 'user.name', 'Contract Test']);
    git(['config', 'user.email', 'contract@example.invalid']);

    writeFileSync(join(repo, 'existing.mjs'), '// old archaeology #14\nexport const value = 1;\n');
    git(['add', 'existing.mjs']);
    git(['commit', '-m', 'baseline']);
    const base = git(['rev-parse', 'HEAD']).trim();

    writeFileSync(join(repo, 'existing.mjs'), '// old archaeology #14\nexport const value = 2;\n');
    writeFileSync(join(repo, 'clean.mjs'), 'export const clean = true;\n');
    git(['add', 'existing.mjs', 'clean.mjs']);
    git(['commit', '-m', 'change']);

    assert.doesNotMatch(git(['diff', '--unified=0', base, 'HEAD', '--', 'existing.mjs']), /^\+.*#14/m,
        'the whole-file red control must predate the changed lines');

    const run = args => spawnSync(process.execPath, [CLI_GUARD, ...args], {cwd: repo, encoding: 'utf8'});
    const changed = run(['--base', base]);

    assert.equal(changed.status, 1);
    assert.match(changed.stderr, /existing\.mjs:1/);
    assert.doesNotMatch(changed.stderr, /clean\.mjs:/);

    const supplied = run(['existing.mjs']);
    assert.equal(supplied.status, 1);

    const allTracked = run([]);
    assert.equal(allTracked.status, 1);

    writeFileSync(join(repo, 'existing.mjs'), '// current behavior\nexport const value = 2;\n');
    git(['add', 'existing.mjs']);
    git(['commit', '-m', 'clean']);

    const clean = run(['--base', 'HEAD~1']);
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(clean.stdout, /0 violations/);

    writeFileSync(join(repo, 'untracked.mjs'), '// untracked archaeology #14\n');

    const trackedOnly = run([]);
    assert.equal(trackedOnly.status, 0, trackedOnly.stderr);

    const invalid = run(['--unknown']);
    assert.equal(invalid.status, 2);
    assert.match(invalid.stderr, /Unknown option/);

    writeFileSync(join(outside, 'target.mjs'), '// current behavior\n');
    symlinkSync(join(outside, 'target.mjs'), join(repo, 'escape.mjs'));
    git(['add', 'escape.mjs']);
    git(['commit', '-m', 'escape']);

    const escaped = run(['escape.mjs']);
    assert.equal(escaped.status, 2);
    assert.match(escaped.stderr, /outside the caller repository/)
} finally {
    rmSync(repo, {recursive: true, force: true});
    rmSync(outside, {recursive: true, force: true})
}

const distribution = mkdtempSync(join(tmpdir(), 'skills-archaeology-pack-'));

try {
    const root     = join(here, '..'),
          packDir  = join(distribution, 'pack'),
          cacheDir = join(distribution, 'npm-cache'),
          consumer = join(distribution, 'consumer');

    mkdirSync(packDir, {recursive: true});
    mkdirSync(consumer, {recursive: true});

    const npmEnv = {...process.env, npm_config_cache: cacheDir},
          packed = JSON.parse(execFileSync('npm', ['pack', '--pack-destination', packDir, '--json'], {
              cwd: root, encoding: 'utf8', env: npmEnv
          })),
          tarball = join(packDir, packed[0].filename);

    writeFileSync(join(consumer, 'package.json'), JSON.stringify({name: 'guard-consumer', private: true}, null, 2));
    execFileSync('npm', [
        'install', '--ignore-scripts', '--package-lock=false', '--no-save', tarball
    ], {cwd: consumer, encoding: 'utf8', env: npmEnv});

    const git = args => execFileSync('git', args, {cwd: consumer, encoding: 'utf8'}),
          bin = join(consumer, 'node_modules', '.bin', 'neo-agent-skills-ticket-archaeology');

    git(['init', '-b', 'dev']);
    git(['config', 'user.name', 'Packed Contract']);
    git(['config', 'user.email', 'packed@example.invalid']);
    writeFileSync(join(consumer, 'probe.mjs'), 'export const value = 1;\n');
    git(['add', 'probe.mjs']);
    git(['commit', '-m', 'baseline']);
    const base = git(['rev-parse', 'HEAD']).trim();

    writeFileSync(join(consumer, 'probe.mjs'), '// review RA-1\nexport const value = 2;\n');
    git(['add', 'probe.mjs']);
    git(['commit', '-m', 'red']);

    const red = spawnSync(bin, ['--base', base], {cwd: consumer, encoding: 'utf8'});
    assert.equal(red.status, 1);
    assert.match(red.stderr, /review-archaeology|decay-prone/);

    writeFileSync(join(consumer, 'probe.mjs'), '// current behavior\nexport const value = 3;\n');
    git(['add', 'probe.mjs']);
    git(['commit', '-m', 'green']);

    const green = spawnSync(bin, ['--base', 'HEAD~1'], {cwd: consumer, encoding: 'utf8'});
    assert.equal(green.status, 0, green.stderr)
} finally {
    rmSync(distribution, {recursive: true, force: true})
}

console.log('ticket-archaeology: repository-local ids, controls, CLI modes, and packed bin passed');
