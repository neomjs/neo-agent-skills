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

import {execFileSync} from 'node:child_process';
import {
    appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync,
    writeFileSync
} from 'node:fs';
import {tmpdir}                  from 'node:os';
import {dirname, join, relative} from 'node:path';
import {fileURLToPath}           from 'node:url';

const
    here     = dirname(fileURLToPath(import.meta.url)),
    repoRoot = join(here, '..'),
    SURFACE  = [
        '.agents/skills/pr-review/audits/review-cost-circuit-breaker.md',
        '.agents/skills/pr-review/references/pr-review-guide.md'
    ],
    LIMIT                       = 41357,
    DOCUMENT_REFERENCE_CENSUS   = '.agents/skills/document-references.v1.json',
    PACKAGE_NAME                = 'neo-agent-skills';

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

/** @summary Apply a mutation to the copied canonical-document census. */
function editDocumentReferences(work, mutate) {
    const file   = join(work, DOCUMENT_REFERENCE_CENSUS),
          census = JSON.parse(readFileSync(file, 'utf8'));

    mutate(census);
    writeFileSync(file, JSON.stringify(census, null, 4) + '\n')
}

/** @summary Every Markdown file under a copied skill directory. */
function markdownFiles(dir) {
    return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
        const file = join(dir, entry.name);

        return entry.isDirectory() ? markdownFiles(file) : entry.name.endsWith('.md') ? [file] : []
    })
}

/** @summary Replace one canonical document URL with a consumer-relative token. */
function exposeRawDocumentToken(work) {
    const
        census = JSON.parse(readFileSync(join(work, DOCUMENT_REFERENCE_CENSUS), 'utf8')),
        row     = census.rows.find(candidate => candidate.canonicalOwner === 'neomjs/neo-agent-brain'),
        root    = join(work, '.agents/skills', row.referencingSkills[0]),
        file    = markdownFiles(root).find(candidate => readFileSync(candidate, 'utf8').includes(row.resolution)),
        source  = readFileSync(file, 'utf8');

    writeFileSync(file, source.replace(row.resolution, `../../../../${row.token}`))
}

/** @summary Verify canonical document URLs through both materialized consumer projections. */
function projectedDocumentFindings(consumer) {
    const
        agentsProjection = join(consumer, '.agents/skills'),
        census            = JSON.parse(readFileSync(join(agentsProjection, 'document-references.v1.json'), 'utf8')),
        rowsByToken        = new Map(census.rows.map(row => [row.token, row])),
        findings          = [],
        observed          = new Set();

    /** @summary Scan one projected document-bearing source. */
    function scan(source, file) {
        for (const match of source.matchAll(new RegExp(census.selector, 'g'))) {
            const row = rowsByToken.get(match[0]);

            observed.add(match[0]);

            if (!row) {
                findings.push(`${file}: ${match[0]} has no census row.`);
                continue
            }

            const
                start    = match.index - (row.resolution.length - match[0].length),
                embedded = start >= 0 && source.slice(start, match.index + match[0].length) === row.resolution;

            if (!embedded) findings.push(`${file}: ${match[0]} is not embedded in ${row.resolution}.`)
        }
    }

    for (const file of markdownFiles(agentsProjection)) {
        scan(readFileSync(file, 'utf8'), relative(consumer, file))
    }

    const manifest = JSON.parse(readFileSync(join(agentsProjection, 'skills.manifest.json'), 'utf8'));

    for (const [skillName, row] of Object.entries(manifest.skills)) {
        scan(row.description || '', `.agents/skills/skills.manifest.json:${skillName}.description`)
    }

    // The Claude façade is per-skill rather than a whole-tree link. Walk each link root explicitly:
    // readdir follows a symlink passed as the root, while a symlink encountered as an entry is not
    // reported as a directory.
    const facade = join(consumer, '.claude/skills');

    for (const skillName of readdirSync(facade)) {
        for (const file of markdownFiles(join(facade, skillName))) {
            scan(readFileSync(file, 'utf8'), relative(consumer, file))
        }
    }

    for (const row of census.rows) {
        if (!observed.has(row.token)) findings.push(`.agents/skills: ${row.token} is not projected.`)
    }

    return findings
}

/** @summary Exercise document reach from a clean non-Neo consumer using the real materializer. */
function runConsumerDocumentReferences({mutate = false} = {}) {
    const
        consumer    = mkdtempSync(join(tmpdir(), 'skill-consumer-')),
        installed   = join(consumer, 'node_modules', PACKAGE_NAME),
        packageJson = JSON.stringify({name: 'reference-fixture-consumer', private: true, version: '1.0.0'}, null, 2) + '\n';

    let code = 0, out = '';

    try {
        writeFileSync(join(consumer, 'package.json'), packageJson);
        execFileSync('git', ['init', '-q'], {cwd: consumer});
        execFileSync('git', ['config', 'user.email', 'ci@local'], {cwd: consumer});
        execFileSync('git', ['config', 'user.name', 'ci'], {cwd: consumer});
        execFileSync('git', ['add', 'package.json'], {cwd: consumer});
        execFileSync('git', ['commit', '-qm', 'fixture consumer'], {cwd: consumer});

        mkdirSync(installed, {recursive: true});
        cpSync(join(repoRoot, '.agents'), join(installed, '.agents'), {recursive: true});
        cpSync(join(repoRoot, 'scripts'), join(installed, 'scripts'), {recursive: true});
        cpSync(join(repoRoot, 'package.json'), join(installed, 'package.json'));

        const
            materializer = join(installed, 'scripts/materialize-harness-skills.mjs'),
            env          = {...process.env, INIT_CWD: consumer};

        execFileSync('node', [materializer, '--root', consumer], {cwd: consumer, env, encoding: 'utf8'});
        execFileSync('node', [materializer, '--root', consumer, '--check'], {cwd: consumer, env, encoding: 'utf8'});

        if (mutate) exposeRawDocumentToken(installed);

        const findings = projectedDocumentFindings(consumer);

        if (findings.length) {
            code = 1;
            out  = findings.join('\n')
        }
    } catch (err) {
        code = err.status ?? 1;
        out  = `${err.stdout ?? ''}${err.stderr ?? ''}${err.message ?? ''}`
    }

    rmSync(consumer, {recursive: true, force: true});

    return {code, out}
}

/** @summary Grow corpus Markdown one byte beyond its configured net-positive cap. */
function growCorpus(work) {
    const
        manifest = JSON.parse(readFileSync(join(work, '.agents/skills/skills.manifest.json'), 'utf8')),
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

    // ── canonical document-reference arm ────────────────────────────────────────────────────────
    ['a raw consumer-relative document token fails', 1, exposeRawDocumentToken,
        'the package ships no learn tree, so a path that only resolves in neomjs/neo is a dangling instruction elsewhere'],

    ['a document row with the WRONG owner fails', 1, w => editDocumentReferences(w, c => {
        c.rows[0].canonicalOwner = 'neomjs/neo-agent-brain'
    }), 'owner and resolution must describe the same canonical repository, and the 13/10 custody partition must remain exact'],

    ['a document row with the WRONG resolution fails', 1, w => editDocumentReferences(w, c => {
        c.rows[0].resolution = c.rows[0].resolution.replace('/blob/dev/', '/blob/main/')
    }), 'dev is the authoring branch; a plausible but non-canonical URL is still wrong'],

    ['a MISSING document census row fails', 1, w => editDocumentReferences(w, c => { c.rows.pop() }),
        'an occurrence without a row has no mechanically visible owner or resolution'],

    ['a DUPLICATE document census row fails', 1, w => editDocumentReferences(w, c => {
        c.rows.push(structuredClone(c.rows[0]))
    }), 'one target must have one typed row; duplicate authority is ambiguous'],

    ['an UNKNOWN document census row fails', 1, w => editDocumentReferences(w, c => {
        const token = 'learn/agentos/UnknownDocument.md';

        c.rows.push({
            token,
            canonicalOwner   : 'neomjs/neo',
            resolution       : `https://github.com/neomjs/neo/blob/dev/${token}`,
            referencingSkills: ['create-skill'],
            kinds            : ['load']
        })
    }), 'a row that no shipped skill references is stale census data, not coverage'],

    ['referencingSkills drift fails', 1, w => editDocumentReferences(w, c => {
        c.rows.find(row => row.referencingSkills.length > 1).referencingSkills.pop()
    }), 'the census must identify every skill whose behavior depends on the target'],

    ['a document row with NO kind fails', 1, w => editDocumentReferences(w, c => { c.rows[0].kinds = [] }),
        'an untyped reference cannot distinguish a read from a write target or prose'],

    ['an UNKNOWN document kind fails', 1, w => editDocumentReferences(w, c => { c.rows[0].kinds = ['copy'] }),
        'the semantic contract is closed over load, target-write, and prose'],

    ['a DUPLICATE document kind fails', 1, w => editDocumentReferences(w, c => {
        c.rows[0].kinds.push(c.rows[0].kinds[0])
    }), 'duplicate kinds add no information and make the typed row non-canonical'],

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
],
consumerCases = [
    ['a clean non-Neo consumer resolves projected document references', 0, false,
        'the real materializer exposes the typed corpus through both .agents and .claude without a consumer-local learn tree'],

    ['a clean non-Neo consumer rejects a projected raw document token', 1, true,
        'mutating one installed URL is visible through both symlink projections and must turn document reach red']
];

let failed = 0;

console.log(`surface today: ${surfaceBytes()} of ${LIMIT} — headroom ${LIMIT - 1 - surfaceBytes()}\n`);

for (const [name, expected, mutate, because, options] of cases) {
    const {code} = run(mutate, options),
          ok     = code === expected;

    if (!ok) failed++;

    console.log(`${ok ? '  ok  ' : '  FAIL'} ${name} → exit ${code} (expected ${expected}) — ${because}`)
}

for (const [name, expected, mutate, because] of consumerCases) {
    const {code, out} = runConsumerDocumentReferences({mutate}),
          ok          = code === expected;

    if (!ok) {
        failed++;
        if (out) console.log(out)
    }

    console.log(`${ok ? '  ok  ' : '  FAIL'} ${name} → exit ${code} (expected ${expected}) — ${because}`)
}

const total = cases.length + consumerCases.length;

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
