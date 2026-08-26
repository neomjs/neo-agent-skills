#!/usr/bin/env node
/**
 * @summary Enforce the Tier-2 revalidation trigger: a contract agreed while a family was benched is
 * not settled for that family when it returns.
 *
 * This contract reached quorum with `gemini` and `kimi` absent, so their signal was never withheld —
 * it was never *possible*. A revalidation trigger recorded only as prose decays into a promise
 * nobody re-reads, and the reactivation it names is exactly the moment attention is elsewhere. So
 * the trigger is a check: if a required family's `participationStatus` is `active` and the receipt
 * does not record its signal, this goes red and says what is owed.
 *
 * Repositories without an identity roster skip cleanly — the roster is Brain substrate and most
 * enrolled repos have none. A skip is reported, never silently passed.
 *
 * @example
 * node scripts/check-revalidation.mjs --consumer-root .
 */

import {existsSync, readFileSync} from 'node:fs';
import {readInertRoster}        from './inert-roster.mjs';
import {join, resolve}            from 'node:path';

const
    ROSTER  = 'ai/graph/identityRoots.mjs',
    RECEIPT = 'AGENT_SUBSTRATE_REVISION.json';

/** @summary Parse `--flag [value]` pairs. */
function parseArgs(argv) {
    const out = {};

    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--')) {
            const key = argv[i].slice(2);

            out[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
        }
    }

    return out
}

/**
 * @summary Families whose roster entry currently reads `participationStatus: 'active'`.
 *
 * @param {String} rosterSource  the roster module's TEXT — never imported, never evaluated
 * @returns {{active: Set<String>}|{error: String}}
 */
function activeFamilies(rosterSource) {
    const parsed = readInertRoster(rosterSource);

    if (parsed.error) return {error: parsed.error};

    const active = new Set();

    for (const entry of parsed.identities) {
        const {modelFamily, participationStatus} = entry?.properties ?? {};

        if (modelFamily && participationStatus === 'active') active.add(modelFamily)
    }

    return {active}
}

const
    args = parseArgs(process.argv.slice(2)),
    root = resolve(args['consumer-root'] || '.'),
    receipt = existsSync(join(root, RECEIPT)) ? JSON.parse(readFileSync(join(root, RECEIPT), 'utf8')) : null;

if (!receipt) {
    console.error(`no ${RECEIPT}: nothing pins this contract, so its revalidation state is unknowable.`);
    process.exit(1)
}

const revalidation = receipt.revalidation;

if (!revalidation) {
    console.error(`${RECEIPT} records no revalidation block; the Tier-2 trigger has no state to check.`);
    process.exit(1)
}

if (!existsSync(join(root, ROSTER))) {
    console.log(`revalidation: skipped — no ${ROSTER} in this repo (roster is Brain substrate; most consumers have none).`);
    process.exit(0)
}

const
    rosterRead = activeFamilies(readFileSync(join(root, ROSTER), 'utf8')),
    signalled = new Set(revalidation.signalled || []);

if (rosterRead.error) {
    console.error(`revalidation: RED — ${rosterRead.error}`);
    process.exit(1)
}

const
    active = rosterRead.active,
    owed   = (revalidation.requiredFrom || []).filter(f => active.has(f) && !signalled.has(f));

if (owed.length) {
    console.error(
        `revalidation OWED from: ${owed.join(', ')}\n\n` +
        `  These families were benched when this contract reached quorum, so their signal was never\n` +
        `  withheld — it was never possible. Their roster entry now reads participationStatus: 'active'.\n` +
        `  Re-present the contract for retroactive signal, then record it in ${RECEIPT}\n` +
        `  under revalidation.signalled before treating it as settled.`
    );
    process.exit(1)
}

const stillBenched = (revalidation.requiredFrom || []).filter(f => !active.has(f));

console.log(
    `revalidation: clear — ${signalled.size} signal(s) recorded` +
    (stillBenched.length ? `; still benched, trigger armed: ${stillBenched.join(', ')}` : '')
);
