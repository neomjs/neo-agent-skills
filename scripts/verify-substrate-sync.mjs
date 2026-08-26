#!/usr/bin/env node
/**
 * @summary Two-leg consumer guard: synced skill bytes equal canonical@receipt, and the
 * per-harness façade equals the manifest-declared projection.
 *
 * Runs inside an enrolled repository's CI. The two legs answer different questions and neither
 * subsumes the other:
 *
 * - **Leg A — distribution.** Does this repo carry the canonical tree, unmodified? Every enrolled
 *   repo carries the same bytes; there are no per-repo subsets. Answered by a git tree hash compared
 *   against the receipt canonical publishes at the pinned revision — an anchor OUTSIDE the consumer,
 *   because a hash compared to a locally-editable expectation proves only internal consistency.
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
 * node scripts/verify-substrate-sync.mjs --consumer-root . --canonical-root /path/to/neo-agent-skills
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
 * Reads `HEAD:<path>`, which is what CI actually has: `actions/checkout` produces a committed ref,
 * so the committed tree IS the proposal. An earlier version resolved this from the index to catch
 * staged-but-uncommitted edits — a state that does not occur in CI — at the cost of three fallback
 * strategies and a `fatal:` on every run.
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
 * @summary The receipt canonical itself publishes at a pinned revision — the external trust anchor.
 *
 * Resolved out of canonical's own git history, so the consumer commit under test cannot influence
 * it. Missing or unreachable canonical history is a FAILURE, never a skip: a guard that quietly
 * degrades to self-attestation when its anchor is absent is exactly the false-green this repairs.
 *
 * @param {String} revision       the consumer's pinned canonicalRevision
 * @param {String} [canonicalRoot] path to a canonical checkout carrying that revision
 * @returns {{receipt: Object, via: String}|{error: String}}
 */
function authoritativeReceipt(revision, canonicalRoot) {
    if (!canonicalRoot) {
        return {error:
            `cannot reach canonical history: no --canonical-root supplied, so the expected tree hash ` +
            `could only come from this repo's own receipt — which is the self-attestation this guard ` +
            `exists to reject. The reusable workflow passes it; standalone runs must clone ` +
            `neomjs/neo-agent-skills (full history) and point at it.`}
    }

    if (!existsSync(join(resolve(canonicalRoot), '.git'))) {
        return {error: `--canonical-root ${canonicalRoot} is not a git checkout; the pinned revision cannot be resolved.`}
    }

    let raw;

    try {
        raw = execFileSync('git', ['show', `${revision}:${RECEIPT_PATH}`], {
            cwd     : resolve(canonicalRoot),
            encoding: 'utf8',
            stdio   : ['ignore', 'pipe', 'ignore']
        })
    } catch {
        return {error:
            `canonical@${revision.slice(0, 10)} is not reachable in the supplied canonical checkout. ` +
            `Either this repo pins a revision canonical does not have — which is itself the finding — ` +
            `or the checkout is shallow. The workflow uses fetch-depth: 0 for exactly this reason.`}
    }

    try {
        return {receipt: JSON.parse(raw), via: `canonical git history @ ${revision.slice(0, 10)}`}
    } catch {
        return {error: `canonical@${revision.slice(0, 10)} has an unparseable ${RECEIPT_PATH}.`}
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

// ── Leg A — distribution: the tree matches the IMMUTABLE canonical revision ─────────────────────
//
// The expected hash MUST come from canonical history, never from the consumer's own receipt.
// Comparing a consumer-controlled tree against a consumer-controlled hash proves only internal
// consistency: a commit that edits a synced skill AND rewrites `subject.skillTreeHash` alongside it
// satisfies both sides of that comparison and reports GREEN. That was this guard's shipped
// behaviour, demonstrated by @neo-gpt-emmy with a paired mutation, and my own defence at review
// time — "a tampered receipt is itself a rejected non-sync mutation" — described a leg that did not
// exist. A content-addressed hash is an equality proof only when the EXPECTED value comes from an
// authority the change under test cannot rewrite.
const receipt = readJson(join(root, RECEIPT_PATH));

if (!receipt) {
    failures.push(
        `no ${RECEIPT_PATH}: this repo carries no canonical pin, so nothing can attest its skill ` +
        `tree. An enrolled repo without a receipt is unsynced, not exempt — enrollment is a ` +
        `registry predicate and absence never means excluded.`
    )
} else {
    const
        revision  = receipt.canonicalRevision,
        declared  = receipt?.subject?.skillTreeHash,
        actual    = treeHash(root, SKILL_TREE_PATH);

    if (!revision) {
        failures.push(
            `${RECEIPT_PATH} carries no canonicalRevision, so its skillTreeHash anchors to nothing ` +
            `outside this repo. A self-signed receipt cannot distinguish a sync from a fork.`
        )
    } else if (!declared) {
        failures.push(`${RECEIPT_PATH} carries no subject.skillTreeHash; the receipt attests nothing.`)
    } else if (!actual) {
        failures.push(
            `${SKILL_TREE_PATH} is absent, but the receipt pins canonical@${revision.slice(0, 10)}. ` +
            `This is the invisible-staleness case: not behind, simply missing, and reported by nothing.`
        )
    } else {
        const authority = authoritativeReceipt(revision, args['canonical-root']);

        if (authority.error) {
            failures.push(authority.error)
        } else {
            const expected = authority.receipt?.subject?.skillTreeHash;

            if (!expected) {
                failures.push(
                    `canonical@${revision.slice(0, 10)} carries no subject.skillTreeHash; the pinned ` +
                    `revision cannot serve as a trust anchor.`
                )
            } else if (declared !== expected) {
                failures.push(
                    `${RECEIPT_PATH} disagrees with canonical@${revision.slice(0, 10)}.\n` +
                    `      this repo's receipt declares : ${declared}\n` +
                    `      canonical actually publishes : ${expected}\n` +
                    `      The receipt was edited locally. It is a synced artifact, not an editing surface.`
                )
            } else if (actual !== expected) {
                failures.push(
                    `skill tree diverges from canonical@${revision.slice(0, 10)}.\n` +
                    `      canonical publishes : ${expected}\n` +
                    `      this repo has       : ${actual}\n` +
                    `      The tree is forked, not stale. Re-sync from canonical rather than editing in place.`
                )
            } else {
                notes.push(
                    `leg A — tree matches canonical@${revision.slice(0, 10)} (${expected}), and the ` +
                    `local receipt agrees with the one canonical publishes at that revision [${authority.via}]`
                )
            }
        }
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
        // `present - projected`, NOT `present ∩ optedOut`. The intersection only catches entries the
        // manifest explicitly opts OUT of, so a façade entry absent from the manifest ENTIRELY — an
        // invented skill, a stale link to a deleted one — was silently permitted. Exact projection
        // means the façade equals what the manifest declares, with nothing extra from any source.
        undeclared            = [...present].filter(name => !projected.has(name));

    if (missing.length) {
        failures.push(
            `façade is missing ${missing.length} manifest-declared skill(s): ${missing.slice(0, 5).join(', ')}` +
            `${missing.length > 5 ? ', …' : ''}. Regenerate the façade from the manifest.`
        )
    }

    if (undeclared.length) {
        failures.push(
            `façade exposes ${undeclared.length} entr${undeclared.length === 1 ? 'y' : 'ies'} the manifest does ` +
            `not project: ${undeclared.map(n => optedOut.has(n) ? `${n} (declared opt-out)` : `${n} (absent from the manifest)`).join(', ')}. ` +
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
