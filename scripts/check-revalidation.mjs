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
import {pathToFileURL}          from 'node:url';
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
 * @param {String} rosterPath  absolute path to the roster module
 * @returns {Promise<Set<String>>}
 */
async function activeFamilies(rosterPath) {
    // Read the roster as DATA rather than as text. Two regex parsers failed here first, and both
    // failed silently green: `modelFamily` and `participationStatus` live under a nested
    // `properties` object, entries contain further nested objects, and field ORDER varies — the
    // gemini entry states its status BEFORE its family, so "nearest preceding match" is wrong on the
    // one entry that matters most. The module declares no imports, so importing it costs nothing and
    // removes the entire class of failure.
    const {IDENTITIES} = await import(pathToFileURL(rosterPath).href);

    if (!Array.isArray(IDENTITIES)) {
        throw new Error(`${ROSTER} exported no IDENTITIES array; the roster contract changed shape.`)
    }

    const active = new Set();

    for (const entry of IDENTITIES) {
        const {modelFamily, participationStatus} = entry?.properties ?? {};

        if (modelFamily && participationStatus === 'active') active.add(modelFamily)
    }

    return active
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
    active    = await activeFamilies(join(root, ROSTER)),
    signalled = new Set(revalidation.signalled || []),
    owed      = (revalidation.requiredFrom || []).filter(f => active.has(f) && !signalled.has(f));

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
