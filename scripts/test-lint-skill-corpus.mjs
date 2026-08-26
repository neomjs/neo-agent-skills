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
 * @param {Object} [options]
 * @param {String} [options.commitMessage] enables a two-commit git fixture and the --base path
 * @returns {{code: Number, out: String}}
 */
function run(mutate, {commitMessage = null} = {}) {
    const work = mkdtempSync(join(tmpdir(), 'corpus-lint-'));

    cpSync(join(repoRoot, '.agents'), join(work, '.agents'), {recursive: true});
    cpSync(join(repoRoot, 'scripts'), join(work, 'scripts'), {recursive: true});

    if (commitMessage) {
        execFileSync('git', ['init', '-q'], {cwd: work});
        execFileSync('git', ['config', 'user.email', 'ci@local'], {cwd: work});
        execFileSync('git', ['config', 'user.name', 'ci'], {cwd: work});
        execFileSync('git', ['add', '.'], {cwd: work});
        execFileSync('git', ['commit', '-qm', 'baseline'], {cwd: work})
    }

    mutate?.(work);

    if (commitMessage) {
        execFileSync('git', ['add', '.'], {cwd: work});
        execFileSync('git', ['commit', '-qm', commitMessage], {cwd: work})
    }

    let code = 0, out = '';

    try {
        const args = [join(work, 'scripts/lint-skill-corpus.mjs')];

        if (commitMessage) args.push('--base', 'HEAD~1');

        out = execFileSync('node', args, {cwd: work, encoding: 'utf8'})
    } catch (err) {
        code = err.status ?? 1;
        out  = `${err.stdout ?? ''}${err.stderr ?? ''}`
    }

    rmSync(work, {recursive: true, force: true});

    return {code, out}
}

/** @summary Current byte sum of the budgeted surface. */
const surfaceBytes = () => SURFACE.reduce((sum, rel) => sum + statSync(join(repoRoot, rel)).size, 0);

/** @summary Apply a mutation to the copied manifest, preserving its on-disk shape. */
function editManifest(work, mutate) {
    const file     = join(work, '.agents/skills/skills.manifest.json'),
          manifest = JSON.parse(readFileSync(file, 'utf8'));

    mutate(manifest);
    writeFileSync(file, JSON.stringify(manifest, null, 4) + '\n')
}

/** @summary Grow corpus Markdown one byte beyond its configured net-positive cap. */
function growCorpus(work) {
    const
        manifest = JSON.parse(readFileSync(join(work, '.agents/skills/skills.manifest.json'), 'utf8'),
        growth   = manifest.defaults.maxPositiveDeltaBytes + 1;

    appendFileSync(join(work, SURFACE[1]), '\n' + 'x'.repeat(growth))
}

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
        'a renamed or departed member must not silently shrink the sum to a passing total'],

    // ── schema arm, migrated with the manifest it validates ──────────────────────────────────────
    ['an UNSUPPORTED manifest key fails', 1, w => editManifest(w, m => { m.somethingNew = 1 }),
        'an unrecognised key is a typo or an unreviewed extension; silently ignoring it is how drift enters'],

    ['a wrong schemaVersion fails', 1, w => editManifest(w, m => { m.schemaVersion = 2 }),
        'the validator only knows v1 shapes, so a v2 document would be checked against the wrong rules'],

    ['a skill MISSING a required field fails', 1,
        w => editManifest(w, m => { delete m.skills[Object.keys(m.skills)[0]].description }),
        'the required list comes from $defs.skill — read from the wrong path it is [] and every one of these passes vacuously'],

    ['a skill key that disagrees with entry.name fails', 1,
        w => editManifest(w, m => { m.skills[Object.keys(m.skills)[0]].name = 'renamed-elsewhere' }),
        'the key and the name address the same skill; when they diverge the router and the index disagree'],

    ['a NON-kebab-case skill name fails', 1,
        w => editManifest(w, m => { m.skills[Object.keys(m.skills)[0]].name = Object.keys(m.skills)[0].toUpperCase() }),
        'the name is a directory name on disk, so casing is not cosmetic'],

    // ── net-growth escape hatch — only observable through the --base git-history path ────────────
    ['over-cap growth WITHOUT justification fails', 1, growCorpus,
        'the cap must stay red when the measured commit range carries no explicit rationale',
        {commitMessage: 'grow corpus'}],

    ['over-cap growth WITH a non-empty justification passes', 0, growCorpus,
        'the escape hatch exists so legitimate growth does not force maintainers to raise the cap',
        {commitMessage: 'grow corpus\n\n[skill-growth-justified: fixture proves the exception path]'}],

    ['an EMPTY growth marker does not justify growth', 1, growCorpus,
        'a token with no reason is ceremony, not a recorded decay-mitigation rationale',
        {commitMessage: 'grow corpus\n\n[skill-growth-justified:]'}]
];

let failed = 0;

console.log(`surface today: ${surfaceBytes()} of ${LIMIT} — headroom ${LIMIT - 1 - surfaceBytes()}\n`);

for (const [name, expected, mutate, because, options] of cases) {
    const {code} = run(mutate, options),
          ok     = code === expected;

    if (!ok) failed++;

    console.log(`${ok ? '  ok  ' : '  FAIL'} ${name} → exit ${code} (expected ${expected}) — ${because}`)
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
