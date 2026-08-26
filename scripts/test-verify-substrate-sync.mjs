#!/usr/bin/env node
/**
 * @summary Fixture suite for the two-leg substrate guard — every case carries a negative arm.
 *
 * A guard that cannot go red is scenery, so each fixture states the mutation that MUST make it fail.
 * The permissive cases matter as much as the failing ones: `synced` proves a manifest-declared
 * opt-out is *permitted* absent from the façade, which is the difference between a guard that
 * understands the projection axis and one that rejects every legitimate harness view.
 *
 * **`paired-tree-and-receipt` is the case this suite previously lacked, and its absence hid a
 * false-green.** Every earlier negative mutated the tree while leaving the receipt fixed, so the
 * suite could not distinguish "compares against canonical" from "compares against itself". A
 * consumer commit that edits a synced skill AND rewrites its own `subject.skillTreeHash` satisfied
 * both sides of the old comparison and reported GREEN — found by @neo-gpt-emmy on
 * neomjs/neo-agent-brain#5, not by these tests.
 *
 * Run: `node scripts/test-verify-substrate-sync.mjs`
 */

import {execFileSync}                                                       from 'node:child_process';
import {cpSync, mkdirSync, rmSync, appendFileSync, symlinkSync, mkdtempSync,
        readFileSync, writeFileSync}                                        from 'node:fs';
import {tmpdir}                                                             from 'node:os';
import {dirname, join}                                                      from 'node:path';
import {fileURLToPath}                                                      from 'node:url';

const
    here      = dirname(fileURLToPath(import.meta.url)),
    repoRoot  = join(here, '..'),
    guard     = join(here, 'verify-substrate-sync.mjs'),
    receipt   = 'AGENT_SUBSTRATE_REVISION.json',
    workspace = mkdtempSync(join(tmpdir(), 'substrate-guard-'));

/** @summary Run a git command quietly. */
const git = (cwd, ...args) => execFileSync('git', args, {cwd, stdio: 'ignore'});

/** @summary Capture a git command's stdout. */
const gitOut = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();

// The revision fixtures pin. It must exist in canonical's history, because Leg A resolves the
// expected hash out of that history rather than out of the fixture's own receipt.
const canonicalRevision = gitOut(repoRoot, 'rev-parse', 'HEAD');

/**
 * @summary Materialize a consumer fixture from the canonical tree, then apply mutations.
 * @param {String}   name
 * @param {Function} [mutate]      applied before the commit
 * @param {Function} [postCommit]  applied after, then amended in — for attacks that need real hashes
 * @returns {String} fixture root
 */
function fixture(name, mutate, postCommit) {
    const root = join(workspace, name);

    mkdirSync(join(root, '.agents'), {recursive: true});
    cpSync(join(repoRoot, '.agents/skills'), join(root, '.agents/skills'), {recursive: true});

    // A consumer receipt is canonical's receipt plus the revision it is pinned to.
    const consumerReceipt = JSON.parse(readFileSync(join(repoRoot, receipt), 'utf8'));

    consumerReceipt.canonicalRepository = 'neomjs/neo-agent-skills';
    consumerReceipt.canonicalRevision   = canonicalRevision;
    writeFileSync(join(root, receipt), `${JSON.stringify(consumerReceipt, null, 2)}\n`);

    const manifest = JSON.parse(readFileSync(join(root, '.agents/skills/skills.manifest.json'), 'utf8'));

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

    if (postCommit) {
        postCommit(root);
        git(root, 'add', '-A');
        git(root, 'commit', '--amend', '-m', 'fixture');
    }

    return root
}

/**
 * @summary Assert the guard's exit code for a fixture.
 * @param {String}   name
 * @param {Number}   expected  0 green, 1 red
 * @param {String}   because   what this case proves
 * @param {Function} [mutate]
 * @param {Function} [postCommit]
 * @returns {Boolean}
 */
function check(name, expected, because, mutate, postCommit) {
    const root = fixture(name, mutate, postCommit);
    let code = 0;

    try {
        execFileSync('node', [guard, '--consumer-root', root, '--canonical-root', repoRoot], {stdio: 'pipe'})
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
        'a single byte inside the synced tree forks it from canonical',
        root => appendFileSync(join(root, '.agents/skills/pr-review/SKILL.md'), '\n<!-- local edit -->\n')),

    // ── The case whose absence hid a false-green ────────────────────────────────────────────────
    check('paired-tree-and-receipt', 1,
        'THE ATTACK: edit a synced byte AND re-sign the local receipt with the resulting hash — ' +
        'self-consistent, and red only because the expected value comes from canonical',
        root => appendFileSync(join(root, '.agents/skills/pr-review/SKILL.md'), '\n<!-- paired edit -->\n'),
        root => {
            // Post-commit, so the rewritten hash is the REAL hash of the mutated tree. A bogus value
            // would be caught by any comparison and would prove nothing about the anchor.
            const
                path    = join(root, receipt),
                local   = JSON.parse(readFileSync(path, 'utf8'));

            local.subject.skillTreeHash = gitOut(root, 'rev-parse', 'HEAD:.agents/skills');
            writeFileSync(path, `${JSON.stringify(local, null, 2)}\n`)
        }),

    check('receipt-resigned-only', 1,
        'rewriting the receipt hash alone, tree untouched, is caught as receipt-vs-canonical disagreement',
        root => {
            const
                path  = join(root, receipt),
                local = JSON.parse(readFileSync(path, 'utf8'));

            local.subject.skillTreeHash = '0000000000000000000000000000000000000000';
            writeFileSync(path, `${JSON.stringify(local, null, 2)}\n`)
        }),

    check('unknown-canonical-revision', 1,
        'pinning a revision canonical does not have fails closed rather than falling back to self-attestation',
        root => {
            const
                path  = join(root, receipt),
                local = JSON.parse(readFileSync(path, 'utf8'));

            local.canonicalRevision = 'ffffffffffffffffffffffffffffffffffffffff';
            writeFileSync(path, `${JSON.stringify(local, null, 2)}\n`)
        }),

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
        root => rmSync(join(root, receipt), {force: true})),

    check('no-skill-tree', 1,
        'the devindex shape: constitution copied, skill tree simply absent, reported by nothing',
        root => rmSync(join(root, '.agents/skills'), {recursive: true, force: true}))
];

// Non-vacuity control: the anchor must be what makes the paired attack red. Re-run that fixture
// WITHOUT --canonical-root; it must still be non-zero (fail-closed), never green.
const pairedRoot = fixture('paired-no-anchor',
    root => appendFileSync(join(root, '.agents/skills/pr-review/SKILL.md'), '\n<!-- paired edit -->\n'),
    root => {
        const
            path  = join(root, receipt),
            local = JSON.parse(readFileSync(path, 'utf8'));

        local.subject.skillTreeHash = gitOut(root, 'rev-parse', 'HEAD:.agents/skills');
        writeFileSync(path, `${JSON.stringify(local, null, 2)}\n`)
    });

let anchorlessCode = 0;

try {
    execFileSync('node', [guard, '--consumer-root', pairedRoot], {stdio: 'pipe'})
} catch (err) {
    anchorlessCode = err.status ?? 1
}

const anchorlessOk = anchorlessCode !== 0;

console.log(`${anchorlessOk ? '  ok  ' : '  FAIL'} paired-no-anchor → exit ${anchorlessCode} (expected non-zero) — ` +
    'without an external anchor the guard refuses rather than self-attesting');

results.push(anchorlessOk);

rmSync(workspace, {recursive: true, force: true});

const failed = results.filter(r => !r).length;

console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
