#!/usr/bin/env node
/**
 * @summary Two-leg consumer guard: synced skill bytes equal canonical@receipt, and the
 * per-harness façade equals the manifest-declared projection.
 *
 * Runs inside an enrolled repository's CI. The two legs answer different questions and neither
 * subsumes the other:
 *
 * - **Leg A — distribution.** Does this repo carry the canonical tree, unmodified? Every enrolled
 *   repo carries the same bytes; there are no per-repo subsets. Answered by a git tree hash, which
 *   is content-addressed and therefore a byte-equality proof rather than a sample of one.
 * - **Leg B — projection.** Does the harness façade match what the manifest *declares*? Per-harness
 *   subsets are legitimate, so a façade that differs from the canonical tree is not evidence of
 *   drift. A façade that differs from the manifest is.
 *
 * Conflating the two produces a guard that either rejects legitimate projections or accepts real
 * drift. That conflation is the defect this contract was written to prevent.
 *
 * The guard **fails closed**: a missing receipt, an unreadable manifest, or an absent skill tree is
 * red, never green. A consumer that has never synced is exactly the invisible-staleness case the
 * canonical store exists to make visible — `neomjs/devindex` carried a hand-copied constitution and
 * no skill tree at all, and nothing reported it.
 *
 * @example
 * node scripts/verify-substrate-sync.mjs --consumer-root .
 * node scripts/verify-substrate-sync.mjs --consumer-root . --canonical-receipt ./canonical.json
 */

import {execFileSync}                     from 'node:child_process';
import {existsSync, readFileSync, readdirSync, lstatSync} from 'node:fs';
import {join, resolve}                     from 'node:path';

const SKILL_TREE_PATH = '.agents/skills';
const MANIFEST_PATH   = '.agents/skills/skills.manifest.json';
const RECEIPT_PATH    = 'AGENT_SUBSTRATE_REVISION.json';
const CLAUDE_FACADE   = '.claude/skills';

/**
 * @summary Parse `--flag value` pairs into a plain object.
 * @param {String[]} argv
 * @returns {Object}
 */
function parseArgs(argv) {
    const out = {};

    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--')) {
            const key = argv[i].slice(2);
            const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;

            out[key] = val
        }
    }

    return out
}

/**
 * @summary Content-addressed hash of a path in the work tree.
 *
 * Uses the git index rather than `HEAD:` so the guard sees what a PR actually proposes, not the
 * merge base. A guard reading `HEAD:` would pass a PR whose changes are staged but not committed
 * on the checked-out ref, which is precisely the mutation it exists to catch.
 *
 * @param {String} root  repository root
 * @param {String} path  path relative to root
 * @returns {String|null} tree sha, or null when the path is absent from the index
 */
function treeHash(root, path) {
    try {
        // `<tree-ish>:<path>` resolves a subdirectory to its tree sha. stderr is swallowed because an
        // absent path is a normal, expected finding here — not an error to narrate at the user.
        const out = execFileSync('git', ['rev-parse', `HEAD:${path}`], {
            cwd     : root,
            encoding: 'utf8',
            stdio   : ['ignore', 'pipe', 'ignore']
        });

        return out.trim() || null
    } catch {
        return null
    }
}

/**
 * @summary Read and parse JSON, returning null rather than throwing on absence.
 * @param {String} file
 * @returns {Object|null}
 */
function readJson(file) {
    if (!existsSync(file)) return null;

    try {
        return JSON.parse(readFileSync(file, 'utf8'))
    } catch {
        return null
    }
}

/**
 * @summary The set of skills the manifest declares should appear in the Claude façade.
 *
 * A skill is projected when its own `claudeSymlinkRequired` is true, or when it omits the key and
 * `defaults.claudeSymlinkRequired` is true. An explicit `false` is a *declared opt-out* — its
 * absence from the façade is correct and must not be reported as drift.
 *
 * @param {Object} manifest
 * @returns {{projected: Set<String>, optedOut: Set<String>}}
 */
function declaredProjection(manifest) {
    const
        fallback  = manifest?.defaults?.claudeSymlinkRequired === true,
        projected = new Set(),
        optedOut  = new Set();

    for (const [name, row] of Object.entries(manifest?.skills || {})) {
        const required = Object.hasOwn(row, 'claudeSymlinkRequired') ? row.claudeSymlinkRequired : fallback;

        (required ? projected : optedOut).add(name)
    }

    return {projected, optedOut}
}

/**
 * @summary Names present in the harness façade directory.
 * @param {String} dir
 * @returns {Set<String>}
 */
function facadeEntries(dir) {
    if (!existsSync(dir)) return new Set();

    return new Set(readdirSync(dir).filter(name => {
        if (name.startsWith('.')) return false;

        const full = join(dir, name);

        // Symlinks are the façade's normal form; lstat avoids resolving a link into its target.
        return lstatSync(full).isSymbolicLink() || lstatSync(full).isDirectory()
    }))
}

const
    args     = parseArgs(process.argv.slice(2)),
    root     = resolve(args['consumer-root'] || '.'),
    failures = [],
    notes    = [];

// ── Leg A — distribution: the tree is canonical, byte for byte ──────────────────────────────────
const receipt = readJson(join(root, RECEIPT_PATH));

if (!receipt) {
    failures.push(
        `no ${RECEIPT_PATH}: this repo carries no canonical pin, so nothing can attest its skill ` +
        `tree. An enrolled repo without a receipt is unsynced, not exempt — enrollment is a ` +
        `registry predicate and absence never means excluded.`
    )
} else {
    const
        claimed = receipt?.subject?.skillTreeHash,
        actual  = treeHash(root, SKILL_TREE_PATH);

    if (!claimed) {
        failures.push(`${RECEIPT_PATH} carries no subject.skillTreeHash; the receipt attests nothing.`)
    } else if (!actual) {
        failures.push(
            `${SKILL_TREE_PATH} is absent, but the receipt pins ${claimed}. This is the ` +
            `invisible-staleness case: not behind, simply missing, and previously reported by nothing.`
        )
    } else if (actual !== claimed) {
        failures.push(
            `skill tree diverges from canonical@receipt.\n` +
            `      receipt claims : ${claimed}\n` +
            `      this repo has  : ${actual}\n` +
            `      The tree is forked, not stale. Re-sync from canonical rather than editing in place.`
        )
    } else {
        notes.push(`leg A — skill tree matches canonical@receipt (${claimed})`)
    }
}

// ── Leg B — projection: the façade equals what the manifest declares ────────────────────────────
const manifest = readJson(join(root, MANIFEST_PATH));

if (!manifest) {
    failures.push(`no readable ${MANIFEST_PATH}: the projection cannot be derived, so the façade cannot be checked.`)
} else {
    const
        {projected, optedOut} = declaredProjection(manifest),
        present               = facadeEntries(join(root, CLAUDE_FACADE)),
        missing               = [...projected].filter(name => !present.has(name)),
        undeclared            = [...present].filter(name => optedOut.has(name));

    if (missing.length) {
        failures.push(
            `façade is missing ${missing.length} manifest-declared skill(s): ${missing.slice(0, 5).join(', ')}` +
            `${missing.length > 5 ? ', …' : ''}. Regenerate the façade from the manifest.`
        )
    }

    if (undeclared.length) {
        failures.push(
            `façade exposes ${undeclared.length} skill(s) the manifest opts OUT of: ${undeclared.join(', ')}. ` +
            `A declared opt-out must be absent from the projection.`
        )
    }

    if (!missing.length && !undeclared.length) {
        notes.push(
            `leg B — façade matches the manifest projection ` +
            `(${projected.size} projected, ${optedOut.size} declared opt-out${optedOut.size === 1 ? '' : 's'} ` +
            `correctly absent)`
        )
    }
}

// ── Verdict ─────────────────────────────────────────────────────────────────────────────────────
for (const note of notes) console.log(`  ok   ${note}`);

if (failures.length) {
    console.error(`\nsubstrate-sync: RED (${failures.length} finding${failures.length === 1 ? '' : 's'})\n`);
    for (const f of failures) console.error(`  FAIL ${f}\n`);
    process.exit(1)
}

console.log('\nsubstrate-sync: GREEN — distribution and projection both hold.');
