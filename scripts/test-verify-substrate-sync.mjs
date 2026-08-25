#!/usr/bin/env node
/**
 * @summary Fixture suite for the two-leg substrate guard — every case carries a negative arm.
 *
 * A guard that cannot go red is scenery, so each fixture below states the mutation that MUST make
 * it fail. The two permissive cases matter as much as the failing ones: `good` proves a
 * manifest-declared opt-out is *permitted* absent from the façade, which is the difference between
 * a guard that understands the projection axis and one that rejects every legitimate harness view.
 *
 * Run: `node scripts/test-verify-substrate-sync.mjs`
 */

import {execFileSync}                              from 'node:child_process';
import {cpSync, mkdirSync, rmSync, appendFileSync, symlinkSync, mkdtempSync} from 'node:fs';
import {tmpdir}                                    from 'node:os';
import {dirname, join}                             from 'node:path';
import {fileURLToPath}                             from 'node:url';

const
    here      = dirname(fileURLToPath(import.meta.url)),
    repoRoot  = join(here, '..'),
    guard     = join(here, 'verify-substrate-sync.mjs'),
    workspace = mkdtempSync(join(tmpdir(), 'substrate-guard-'));

/** @summary Run a git command quietly inside a fixture. */
const git = (cwd, ...args) => execFileSync('git', args, {cwd, stdio: 'ignore'});

/**
 * @summary Materialize a consumer fixture from the canonical tree, then apply a mutation.
 * @param {String}   name
 * @param {Function} mutate  receives the fixture root; applies the case's deviation
 * @returns {String} fixture root
 */
function fixture(name, mutate) {
    const root = join(workspace, name);

    mkdirSync(join(root, '.agents'), {recursive: true});
    mkdirSync(join(root, '.claude'), {recursive: true});
    cpSync(join(repoRoot, '.agents/skills'), join(root, '.agents/skills'), {recursive: true});
    cpSync(join(repoRoot, 'AGENT_SUBSTRATE_REVISION.json'), join(root, 'AGENT_SUBSTRATE_REVISION.json'));

    // The façade is the manifest projection: every skill except the declared opt-outs.
    const manifest = JSON.parse(
        execFileSync('cat', [join(root, '.agents/skills/skills.manifest.json')], {encoding: 'utf8'})
    );

    mkdirSync(join(root, '.claude/skills'), {recursive: true});

    for (const [skill, row] of Object.entries(manifest.skills)) {
        const required = Object.hasOwn(row, 'claudeSymlinkRequired')
            ? row.claudeSymlinkRequired
            : manifest.defaults.claudeSymlinkRequired === true;

        if (required) symlinkSync(`../../.agents/skills/${skill}`, join(root, '.claude/skills', skill))
    }

    mutate?.(root, manifest);

    git(root, 'init');
    git(root, 'config', 'user.email', 'guard@test.local');
    git(root, 'config', 'user.name', 'guard');
    git(root, 'add', '-A');
    git(root, 'commit', '-m', 'fixture');

    return root
}

/**
 * @summary Assert the guard's exit code for a fixture.
 * @param {String} name
 * @param {Number} expected  0 green, 1 red
 * @param {String} because   what this case proves
 * @param {Function} [mutate]
 * @returns {Boolean}
 */
function check(name, expected, because, mutate) {
    const root = fixture(name, mutate);
    let code = 0;

    try {
        execFileSync('node', [guard, '--consumer-root', root], {stdio: 'pipe'})
    } catch (err) {
        code = err.status ?? 1
    }

    const ok = code === expected;

    console.log(`${ok ? '  ok  ' : '  FAIL'} ${name} → exit ${code} (expected ${expected}) — ${because}`);

    return ok
}

const results = [
    check('synced', 0,
        'a correctly synced consumer is green, and its ONE declared opt-out is permitted absent'),

    check('tree-drift', 1,
        'a single byte inside the synced tree forks it from canonical@receipt',
        root => appendFileSync(join(root, '.agents/skills/pr-review/SKILL.md'), '\n<!-- local edit -->\n')),

    check('facade-exposes-optout', 1,
        'a declared opt-out present in the façade is an undeclared projection',
        (root, manifest) => {
            const optedOut = Object.entries(manifest.skills)
                .find(([, row]) => row.claudeSymlinkRequired === false)?.[0];

            if (!optedOut) throw new Error('fixture invalid: manifest declares no opt-out to expose');

            symlinkSync(`../../.agents/skills/${optedOut}`, join(root, '.claude/skills', optedOut))
        }),

    check('facade-missing-declared', 1,
        'a manifest-declared skill absent from the façade is drift, not a projection',
        root => rmSync(join(root, '.claude/skills/pr-review'), {force: true})),

    check('no-receipt', 1,
        'a consumer with no canonical pin fails closed — unsynced is not exempt',
        root => rmSync(join(root, 'AGENT_SUBSTRATE_REVISION.json'), {force: true})),

    check('no-skill-tree', 1,
        'the devindex shape: constitution copied, skill tree simply absent, previously reported by nothing',
        root => rmSync(join(root, '.agents/skills'), {recursive: true, force: true}))
];

rmSync(workspace, {recursive: true, force: true});

const failed = results.filter(r => !r).length;

console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
