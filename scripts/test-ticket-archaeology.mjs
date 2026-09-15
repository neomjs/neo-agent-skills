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

assert.deepEqual(hitLines("// publishes as <p>&#39;beta&#39;</p>"), [],
    'a numeric HTML entity is a codepoint, not a ticket — the & before the # is the discriminator');
assert.deepEqual(hitLines('// renders &#8212; between the columns'), [],
    'an entity with nothing quoting it reads the same way');
assert.deepEqual(hitLines("// ticket #14 explains why it publishes as &#39;beta&#39;"), [1],
    'an entity on the line cannot hide a real reference beside it');
assert.deepEqual(hitLines('// the hex form &#x27; needs no exemption'), [],
    'control: a hex entity never matched the numeric rule to begin with');
assert.deepEqual(hitLines('// see #39 for the entity work'), [1],
    'control: the same digits without entity syntax stay a ticket');

assert.deepEqual(hitLines('// CSS color #000000 [not-ticket-ref: css-color]'), [],
    'a typed marker exempts exactly one ambiguous numeric CSS token');
assert.deepEqual(hitLines("// @member {String} backgroundColor_='#000000' [not-ticket-ref: css-color]"), [],
    'the typed marker relieves the camelCase property idiom that motivated the Engine bug');
assert.deepEqual(hitLines('// borderColor="#111111" [not-ticket-ref: css-color]'), [],
    'a quoted camelCase color assignment is explicit color context');
assert.deepEqual(hitLines('// fillStyle=`#123456` [not-ticket-ref: css-color]'), [],
    'canvas-style color properties use the same typed escape');
assert.deepEqual(hitLines('// ticket #14 beside CSS color #000000 [not-ticket-ref: css-color]'), [1],
    'the typed color marker cannot hide another tracking reference');
assert.deepEqual(hitLines('// see #242 [not-ticket-ref: css-color]'), [1],
    'a typed marker without CSS syntax cannot relabel a short ticket');
assert.deepEqual(hitLines("// issue='#9473' [not-ticket-ref: css-color]"), [1],
    'generic quoted assignments cannot launder a real reference');
assert.deepEqual(hitLines('// [not-ticket-ref: css-color]'), [1], 'an unused marker fails closed');
assert.deepEqual(hitLines('// token #242'), [1], 'generic token wording cannot make a short ticket green');
assert.deepEqual(hitLines('// theme #242'), [1], 'generic theme wording cannot make a short ticket green');

assert.deepEqual(hitLines("// @member {String} backgroundColor_='#000000'"), [],
    'color context needs no marker: a camelCase color property is a color');
assert.deepEqual(hitLines('// borderColor="#111111"'), [], 'a quoted color assignment is a color without a marker');
assert.deepEqual(hitLines('// fillStyle=`#123456`'), [], 'a canvas color property is a color without a marker');
assert.deepEqual(hitLines('// CSS color #123456'), [], 'CSS color wording is color context without a marker');
assert.deepEqual(hitLines('// defaults to #000000'), [], 'a leading zero is never a ticket number');
assert.deepEqual(hitLines('// see #16538'), [1], 'a five-digit ref in prose stays a ticket');
assert.deepEqual(hitLines("// 'see #16538'"), [1], 'a quoted ref in prose stays a ticket');
assert.deepEqual(hitLines('// #9473'), [1], 'a bare four-digit ref stays a ticket');
assert.deepEqual(hitLines('// tracked in #123456'), [1], 'a six-digit number outside color context stays a ticket');
assert.deepEqual(hitLines("// issue='#9473'"), [1], 'a quoted assignment to a non-color name stays a ticket');

// A typed marker binds to a REFERENCE as it binds to a color: the author declares, visibly and
// greppably, that this number is deliberate. The reason text is not graded — only the binding is.
assert.deepEqual(hitLines('// @see #11133 [not-ticket-ref: implementing ticket]'), [],
    'a typed marker on the reference token excuses a deliberate reference');
assert.deepEqual(hitLines('// Pre-push branch-discipline check (#11133) [not-ticket-ref: implementing ticket]'), [],
    'the marker binds through a closing paren, as the color form binds through a closing quote');
assert.deepEqual(hitLines('// see #16538 [not-ticket-ref: the PR title this fixture samples]'), [],
    'a free-text reason is accepted: the guard requires a justification, not a vocabulary');
assert.deepEqual(hitLines('// see #11133'), [1],
    'the same reference without a marker stays a tracking reference');
assert.deepEqual(hitLines('// see #11133 ticket-ref-ok: implementing ticket'), [1],
    'the legacy form gains nothing: it carries no binding');
assert.deepEqual(hitLines('// [not-ticket-ref: implementing ticket]'), [1],
    'a reference marker binding to no token fails closed, as the color marker does');
assert.deepEqual(hitLines('// "fix(build): bypass hooks (#11590)" [not-ticket-ref: illustrative PR-title sample]'), [],
    'the binding survives a short run of closing punctuation between the token and the marker');
assert.deepEqual(hitLines('// see #242 and some words [not-ticket-ref: nope]'), [1],
    'prose between the token and the marker breaks the binding: adjacency is what makes it a declaration');
assert.deepEqual(hitLines('// see #242 [not-ticket-ref: css-color]'), [1],
    'the color reason never binds to a reference, so a color marker still cannot relabel a short ticket');

assert.deepEqual(hitLines('// ticket #14 beside #11133 [not-ticket-ref: implementing ticket]'), [1],
    'the marker excuses its own token only, never the row');

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
