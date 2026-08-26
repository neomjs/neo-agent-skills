#!/usr/bin/env node
/**
 * @summary Fixture suite for the corpus lint — every case states the mutation that must make it fail.
 *
 * These cases came with the combined-surface rule when it moved here from `neomjs/neo`'s
 * `check-substrate-size` spec. A rule migrating without its tests is a rule that silently stops being
 * checked: the code arrives, nothing exercises it, and the first regression is invisible. The
 * boundary cases below are the expensive part of that rule and the reason they are ported verbatim
 * rather than re-derived.
 *
 * Run: `node scripts/test-lint-skill-corpus.mjs`
 */

import {execFileSync}                                             from 'node:child_process';
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
        appendFileSync, statSync}                                  from 'node:fs';
import {tmpdir}                                                    from 'node:os';
import {dirname, join}                                             from 'node:path';
import {fileURLToPath}                                             from 'node:url';

const
    here     = dirname(fileURLToPath(import.meta.url)),
    repoRoot = join(here, '..'),
    SURFACE  = [
        '.agents/skills/pr-review/audits/review-cost-circuit-breaker.md',
        '.agents/skills/pr-review/references/pr-review-guide.md'
    ],
    LIMIT    = 41357;

/**
 * @summary Run the lint inside a disposable copy of the repo, after applying a mutation.
 * @param {Function} [mutate] receives the copy's root
 * @returns {{code: Number, out: String}}
 */
function run(mutate) {
    const work = mkdtempSync(join(tmpdir(), 'corpus-lint-'));

    cpSync(join(repoRoot, '.agents'), join(work, '.agents'), {recursive: true});
    cpSync(join(repoRoot, 'scripts'), join(work, 'scripts'), {recursive: true});

    mutate?.(work);

    let code = 0, out = '';

    try {
        out = execFileSync('node', [join(work, 'scripts/lint-skill-corpus.mjs')], {encoding: 'utf8'})
    } catch (err) {
        code = err.status ?? 1;
        out  = `${err.stdout ?? ''}${err.stderr ?? ''}`
    }

    rmSync(work, {recursive: true, force: true});

    return {code, out}
}

/** @summary Current byte sum of the budgeted surface. */
const surfaceBytes = () => SURFACE.reduce((sum, rel) => sum + statSync(join(repoRoot, rel)).size, 0);

/** @summary Grow the second surface file so the pair lands on an exact total. */
function padTo(work, total) {
    const
        target = join(work, SURFACE[1]),
        other  = statSync(join(work, SURFACE[0])).size,
        need   = total - other - statSync(target).size;

    if (need > 0) appendFileSync(target, '#'.repeat(need));
    else if (need < 0) writeFileSync(target, readFileSync(target, 'utf8').slice(0, need))
}

const cases = [
    ['baseline corpus is clean', 0, undefined,
        'the suite is worthless if the unmutated corpus does not pass'],

    ['pair OVER the limit fails', 1, w => padTo(w, LIMIT + 500),
        'the drift that went unnoticed: two individually legal files breaching a loaded surface'],

    ['EXACTLY at the limit fails', 1, w => padTo(w, LIMIT),
        'the graduated boundary is `< 41,357`, so landing on it is the breach, not the last legal state'],

    ['one byte UNDER the limit passes', 0, w => padTo(w, LIMIT - 1),
        'the largest legal sum is limitBytes - 1; an off-by-one here reports headroom at the size that fails'],

    ['a MISSING budgeted file fails closed', 1,
        w => rmSync(join(w, SURFACE[0])),
        'a renamed or departed member must not silently shrink the sum to a passing total']
];

let failed = 0;

console.log(`surface today: ${surfaceBytes()} of ${LIMIT} — headroom ${LIMIT - 1 - surfaceBytes()}\n`);

for (const [name, expected, mutate, because] of cases) {
    const {code} = run(mutate),
          ok     = code === expected;

    if (!ok) failed++;

    console.log(`${ok ? '  ok  ' : '  FAIL'} ${name} → exit ${code} (expected ${expected}) — ${because}`)
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
