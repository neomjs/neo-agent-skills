#!/usr/bin/env node
/** @summary Mutation-sensitive contract checks for the npm-overrides guard. */

import assert                                                                        from 'node:assert/strict';
import {spawnSync}                                                                   from 'node:child_process';
import {chmodSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync}    from 'node:fs';
import {tmpdir}                                                                      from 'node:os';
import {dirname, join}                                                               from 'node:path';
import {fileURLToPath}                                                               from 'node:url';
import {classify, collectReport, collectRules, parseKey, resolveLocation, run, scopeLocations, subtreeOf} from './check-npm-overrides.mjs';

const
    here     = dirname(fileURLToPath(import.meta.url)),
    GUARD    = join(here, 'check-npm-overrides.mjs'),
    fixtures = [],
    silent   = {error() {}, out() {}};

/**
 * @summary A disposable consumer root holding the given manifest and lock.
 * @param {Object} manifest `package.json` content; `null` writes none.
 * @param {Object} [packages] Lock `packages` entries besides the root; `null` writes no lock.
 * @returns {String} the root
 */
function consumer(manifest, packages = {}) {
    const root = mkdtempSync(join(tmpdir(), 'npm-overrides-'));

    fixtures.push(root);
    manifest && writeFileSync(join(root, 'package.json'), JSON.stringify(manifest));
    packages && writeFileSync(join(root, 'package-lock.json'), JSON.stringify({
        lockfileVersion: 3,
        name           : manifest?.name ?? 'fixture',
        packages       : {'': {name: 'fixture', version: '1.0.0', dependencies: manifest?.dependencies, devDependencies: manifest?.devDependencies}, ...packages}
    }));

    return root
}

/**
 * @summary A lock `packages` map shaped like neo's gray-matter case, with the declared range varied.
 * @param {String} declared What gray-matter declares for js-yaml.
 * @returns {Object}
 */
function grayMatter(declared) {
    return {
        'node_modules/gray-matter': {version: '4.0.3', dependencies: {'js-yaml': declared}},
        'node_modules/js-yaml'    : {version: '3.15.2'}
    }
}

const NESTED = {name: 'fixture', dependencies: {'gray-matter': '^4.0.3'}, overrides: {'gray-matter': {'js-yaml': '^3.15.2'}}};

/**
 * @summary Classifies the single rule of `manifest` against `packages`.
 * @param {Object} manifest
 * @param {Object} packages
 * @returns {Object}
 */
function verdictOf(manifest, packages) {
    const [rule] = collectRules(manifest.overrides, manifest);

    return classify(rule, {'': {dependencies: manifest.dependencies, devDependencies: manifest.devDependencies}, ...packages})
}

// ── Keys and rules ─────────────────────────────────────────────────────────────────────────────
{
    assert.deepEqual(parseKey('js-yaml'),          {name: 'js-yaml',      selector: null});
    assert.deepEqual(parseKey('js-yaml@^3'),       {name: 'js-yaml',      selector: '^3'});
    assert.deepEqual(parseKey('@scope/pkg'),       {name: '@scope/pkg',   selector: null}, 'a scope\'s leading @ is not a selector');
    assert.deepEqual(parseKey('@scope/pkg@2.0.0'), {name: '@scope/pkg',   selector: '2.0.0'});
}

{
    const manifest = {
        dependencies: {foo: '^2.1.0'},
        overrides   : {
            'lodash-es': '^4.18.0',
            'a'        : {'.': '1.2.3', 'b': {'c': '^5.0.0'}},
            'foo'      : '$foo',
            'bad'      : 'github:owner/repo',
            'gone'     : '$nowhere'
        }
    };
    const rules = collectRules(manifest.overrides, manifest);
    const byLabel = Object.fromEntries(rules.map(rule => [rule.label, rule]));

    assert.equal(rules.length, 6);
    assert.deepEqual(byLabel['lodash-es ^4.18.0'].scope, [], 'a top-level string applies everywhere');
    assert.deepEqual(byLabel['a 1.2.3'].scope, [], '`.` overrides the package itself, at its enclosing scope');
    assert.deepEqual(byLabel['a > b > c ^5.0.0'].scope.map(({name}) => name), ['a', 'b'], 'nesting accumulates the chain');
    assert.equal(byLabel['foo $foo'].range, '^2.1.0', '`$name` borrows the root manifest spec');
    assert.match(byLabel['bad github:owner/repo'].error, /not a semver range/);
    assert.match(byLabel['gone $nowhere'].error, /does not declare/);
}

// ── Resolution and subtrees ────────────────────────────────────────────────────────────────────
{
    const packages = {
        'node_modules/a'                  : {version: '1.0.0', dependencies: {x: '^1.0.0', y: '^1.0.0'}},
        'node_modules/a/node_modules/x'   : {version: '1.0.0'},
        'node_modules/x'                  : {version: '2.0.0'},
        'node_modules/y'                  : {version: '1.0.0', dependencies: {z: '^1.0.0'}},
        'node_modules/z'                  : {version: '1.0.0'},
        'node_modules/unrelated'          : {version: '1.0.0'}
    };

    assert.equal(resolveLocation(packages, 'node_modules/a', 'x'), 'node_modules/a/node_modules/x', 'the nearest node_modules wins');
    assert.equal(resolveLocation(packages, 'node_modules/a', 'y'), 'node_modules/y', 'then the enclosing one');
    assert.equal(resolveLocation(packages, 'node_modules/a', 'missing'), null);

    // The discriminating arm: `z` is hoisted and two hops away, so a location-prefix reading of "a's
    // subtree" (everything under node_modules/a/) would miss it, and wrongly keep `unrelated` out
    // only by accident.
    assert.deepEqual([...subtreeOf(packages, ['node_modules/a'])].sort(),
        ['node_modules/a', 'node_modules/a/node_modules/x', 'node_modules/y', 'node_modules/z']);
    assert.equal(scopeLocations(packages, []).size, Object.keys(packages).length, 'an empty chain is the whole tree');
}

// ── The three verdicts, on neo's own gray-matter shape ─────────────────────────────────────────
{
    assert.equal(verdictOf(NESTED, grayMatter('^3.13.1')).verdict, 'needed',    'a dependent still admits 3.13.x');
    assert.equal(verdictOf(NESTED, grayMatter('^3.15.2')).verdict, 'REDUNDANT', 'the dependent caught up to the floor');
    assert.equal(verdictOf(NESTED, grayMatter('^4.1.0')).verdict,  'FIGHTING',  'the rule would force js-yaml 4 users back onto 3');
}

// Above an exact pin is the deliberate security direction, not a fight: neo holds monaco's
// `dompurify: "3.4.8"` at `^3.4.13`. Reading it as FIGHTING would red the one override that ships a fix.
{
    const manifest = {dependencies: {'monaco-editor': '0.56.0'}, overrides: {'monaco-editor': {dompurify: '^3.4.13'}}};

    assert.equal(verdictOf(manifest, {
        'node_modules/monaco-editor': {version: '0.56.0', dependencies: {dompurify: '3.4.8'}},
        'node_modules/dompurify'    : {version: '3.4.13'}
    }).verdict, 'needed')
}

// ── Scope discriminates: the same data, two scopes, two verdicts ───────────────────────────────
{
    const packages = {
        ...grayMatter('^3.15.2'),
        'node_modules/other': {version: '1.0.0', dependencies: {'js-yaml': '^3.13.1'}}
    };

    assert.equal(verdictOf(NESTED, packages).verdict, 'REDUNDANT',
        'a nested rule ignores a dependent outside its parent\'s subtree');
    assert.equal(verdictOf({...NESTED, overrides: {'js-yaml': '^3.15.2'}}, packages).verdict, 'needed',
        'the same dependent keeps a global rule alive');
}

// A transitive dependent INSIDE the subtree keeps a nested rule alive even when the parent caught up,
// and it is hoisted, so only the resolution walk can see it.
{
    const packages = {
        'node_modules/gray-matter'   : {version: '5.0.0', dependencies: {'js-yaml': '^3.15.2', 'section-matter': '^1.0.0'}},
        'node_modules/section-matter': {version: '1.0.0', dependencies: {'js-yaml': '^3.13.1'}},
        'node_modules/js-yaml'       : {version: '3.15.2'}
    };
    const result = verdictOf(NESTED, packages);

    assert.equal(result.verdict, 'needed');
    assert.deepEqual(result.below.map(({dependent}) => dependent), ['section-matter@1.0.0'])
}

// ── Edge cases that must not read REDUNDANT by omission ────────────────────────────────────────
{
    const none = verdictOf(NESTED, {'node_modules/gray-matter': {version: '4.0.3'}});

    assert.equal(none.verdict, 'REDUNDANT', 'nothing in scope declares the package any more');
    assert.equal(none.edges, 0);

    assert.equal(verdictOf(NESTED, grayMatter('github:nodeca/js-yaml')).verdict, 'needed',
        'a non-semver spec is replaced outright by the override, so the rule is doing work');

    assert.equal(verdictOf({devDependencies: {'lodash-es': '^4.17.21'}, overrides: {'lodash-es': '^4.18.0'}}, {}).verdict, 'needed',
        'the root manifest\'s own devDependencies are dependents of a top-level rule');

    assert.equal(verdictOf({overrides: {'gray-matter': {'js-yaml@^3': '^3.15.2'}}}, grayMatter('^4.1.0')).verdict, 'REDUNDANT',
        'a target selector limits the rule to ranges it can match, so a ^4 dependent is out of its reach');
}

// ── Report and exit codes ──────────────────────────────────────────────────────────────────────
{
    assert.equal(run([], {...silent, cwd: consumer({name: 'x'})}), 0, 'no overrides is N/A, not a failure');
    assert.equal(run([], {...silent, cwd: consumer(NESTED, grayMatter('^3.13.1'))}), 0);
    assert.equal(run([], {...silent, cwd: consumer(NESTED, grayMatter('^3.15.2'))}), 1, 'REDUNDANT reds');
    assert.equal(run([], {...silent, cwd: consumer(NESTED, grayMatter('^4.1.0'))}),  1, 'FIGHTING reds');

    // A wrong root and an absent lock are failed observations, never an empty consumer.
    assert.equal(run([], {...silent, cwd: consumer(null, null)}), 1, 'no package.json is a wrong root');
    assert.equal(run([], {...silent, cwd: consumer(NESTED, null)}), 1, 'overrides with no lock cannot be judged');
    assert.equal(run(['--bogus'], {...silent, cwd: consumer(NESTED)}), 2, 'an unknown option is CLI misuse');
    assert.equal(run(['--help'], {...silent, cwd: consumer(NESTED)}), 0);

    const v1 = consumer(NESTED, null);

    writeFileSync(join(v1, 'package-lock.json'), JSON.stringify({lockfileVersion: 1, dependencies: {}}));
    assert.match(collectReport({root: v1}).errors[0], /v2 or v3 is required/, 'a v1 lock has no declared ranges to read');

    const unreadable = consumer({...NESTED, overrides: {'gray-matter': {'js-yaml': 'github:nodeca/js-yaml'}}}, grayMatter('^3.13.1'));

    assert.equal(run([], {...silent, cwd: unreadable}), 1, 'an override with no readable floor is reported, not skipped');

    // A range that parses but matches nothing has no floor either, and a typo'd raise is how one
    // arrives: it must reach the error channel, never throw out of the comparison.
    for (const range of ['>2.0.0 <1.0.0', '>=3.15.2 <3.0.0']) {
        const empty = consumer({...NESTED, overrides: {'gray-matter': {'js-yaml': range}}}, grayMatter('^3.13.1'));

        assert.equal(run([], {...silent, cwd: empty}), 1, `${range}: reported, not thrown`);
        assert.match(collectReport({root: empty}).errors[0], /matches no version/)
    }
}

// ── What the report tells the reader to do ─────────────────────────────────────────────────────
{
    const lines = [], capture = {error: line => lines.push(line), out: line => lines.push(line)};

    // A spec that is no comparable range is replaced by the rule, not "below" its floor.
    run([], {...capture, cwd: consumer(NESTED, grayMatter('github:nodeca/js-yaml'))});
    assert.match(lines.join('\n'), /replaced outright, no comparable range: gray-matter@4\.0\.3/);
    assert.doesNotMatch(lines.join('\n'), /below the floor/);

    // One dependent fought and another still below the floor: deleting the rule unprotects the
    // second, so the remedy is to narrow it.
    lines.length = 0;
    run([], {...capture, cwd: consumer({...NESTED, overrides: {'js-yaml': '^3.15.2'}}, {
        ...grayMatter('^4.1.0'),
        'node_modules/other': {version: '1.0.0', dependencies: {'js-yaml': '^3.13.1'}}
    })});
    assert.match(lines.join('\n'), /FIGHTING[\s\S]*Other dependents still need it \(below the floor: other@1\.0\.0[\s\S]*narrow the rule/);
    assert.doesNotMatch(lines.join('\n'), /Delete or raise the rule/)
}

// Only ENOENT means absent: a permission denial is a failed observation and must not pass as a
// consumer with no manifest to judge.
{
    const root = consumer(NESTED, grayMatter('^3.13.1'));

    chmodSync(join(root, 'package.json'), 0o000);

    const {errors} = collectReport({root});

    chmodSync(join(root, 'package.json'), 0o644);
    assert.match(errors[0], /EACCES/)
}

// ── Process-level arms: the shipping path, through the bin symlink and without it ──────────────
{
    const
        stale = consumer(NESTED, grayMatter('^3.15.2')),
        clean = consumer(NESTED, grayMatter('^3.13.1')),
        link  = join(consumer({name: 'x'}), 'npm-overrides-link.mjs');

    const breach = spawnSync(process.execPath, [GUARD, '--root', stale], {encoding: 'utf8'});

    assert.equal(breach.status, 1, 'a stale rule exits 1 as a process, not only as a return value');
    assert.match(breach.stderr, /REDUNDANT/);
    assert.equal(spawnSync(process.execPath, [GUARD, '--root', clean], {encoding: 'utf8'}).status, 0);

    symlinkSync(GUARD, link);
    assert.equal(spawnSync(process.execPath, [link, '--root', stale], {encoding: 'utf8'}).status, 1,
        'invoked through a symlink — the installed `bin` shape — the guard still runs');
    assert.equal(spawnSync(process.execPath, ['--preserve-symlinks-main', link, '--root', stale], {encoding: 'utf8'}).status, 1,
        'and under --preserve-symlinks-main');
}

// ── It ships, or consumers cannot invoke it ────────────────────────────────────────────────────
{
    const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'));

    assert.equal(pkg.bin['neo-agent-skills-npm-overrides'], './scripts/check-npm-overrides.mjs');
    assert.ok(pkg.files.includes('scripts/check-npm-overrides.mjs'), 'the guard must be in the published file list');
    assert.ok(pkg.dependencies.semver, 'semver is a runtime dependency of the guard, not a dev one')
}

fixtures.forEach(root => rmSync(root, {recursive: true, force: true}));

console.log('check-npm-overrides: contract arms green.');
