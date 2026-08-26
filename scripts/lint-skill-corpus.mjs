#!/usr/bin/env node
/**
 * @summary The canonical anti-bloat guard for the skill corpus. Runs only here.
 *
 * 96% of this package is the skill corpus, so the corpus is the thing worth protecting and the only
 * thing this lint knows about. Consuming repositories run no corpus rules — they run
 * `materialize --check` and nothing else. Keeping the budgets here rather than shipping them to
 * every consumer is the point: one enforcement site, not N.
 *
 * **`routerByteBudget` counts LINES, not bytes.** The name is inherited from the authoring repo and
 * is misleading; the comparison there is `lineCount > skill.routerByteBudget`. Encoding the name's
 * apparent meaning instead of its actual one would silently pass every router in the corpus.
 *
 * Deliberately absent, because they belong to other owners or to nobody: identity-roster and
 * revalidation checks, consumer byte-drift, AGENTS entrypoint budgets, and anything resembling a
 * reusable consumer workflow. Canonical documentation reach is corpus coherence, so it is checked
 * here without teaching consumers any lint rule.
 *
 * @example
 * node scripts/lint-skill-corpus.mjs
 * node scripts/lint-skill-corpus.mjs --base origin/dev   # adds the net-growth arm
 */

import {execFileSync}                                    from 'node:child_process';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve}                from 'node:path';
import {fileURLToPath}                                   from 'node:url';

const
    root     = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
    SKILLS   = join(root, '.agents/skills'),
    manifest = JSON.parse(readFileSync(join(SKILLS, 'skills.manifest.json'), 'utf8')),
    defaults = manifest.defaults,
    errors   = [],
    exempt   = new Set((defaults.oversizedWorkflowMaps || []).map(p => p.replace(/^\.agents\/skills\//, '')));

const SKILL_GROWTH_JUSTIFIED_RE = /\[skill-growth-justified:\s*[^\]\n]+\]/i;

/** @summary A skill's effective budget: its own override, else the default. */
const budget = (row, key) => (Object.hasOwn(row, key) ? row[key] : defaults[key]);

// ── 0. manifest schema ──────────────────────────────────────────────────────────────────────────
// The manifest is the index every other arm reads, so a malformed one makes the rest of this lint
// answer questions about the wrong document. Checked first for that reason.
//
// The per-skill shape lives at `$defs.skill`, NOT at `properties.skills.additionalProperties` —
// that path is undefined here, so `required` reads as `[]` and every missing-field check passes
// vacuously. Getting this wrong produces a green that means nothing.
const schema = JSON.parse(readFileSync(join(SKILLS, 'skills.manifest.schema.json'), 'utf8'));

{
    const rootKeys = new Set([...schema.required, '$schema']);

    for (const key of Object.keys(manifest)) {
        if (!rootKeys.has(key)) errors.push(`manifest has unsupported key: ${key}`)
    }

    for (const key of schema.required) {
        if (!(key in manifest)) errors.push(`manifest missing required key: ${key}`)
    }

    if (manifest.schemaVersion !== 1) errors.push('manifest schemaVersion must be 1.');

    if (!manifest.skills || typeof manifest.skills !== 'object' || Array.isArray(manifest.skills)) {
        errors.push('manifest skills must be an object.')
    }

    const defaultKeys = new Set(Object.keys(schema.properties.defaults.properties));

    for (const key of Object.keys(defaults)) {
        if (!defaultKeys.has(key)) errors.push(`defaults has unsupported key: ${key}`)
    }

    for (const key of schema.properties.defaults.required) {
        if (!(key in defaults)) errors.push(`defaults missing required key: ${key}`)
    }

    for (const key of ['routerByteBudget', 'payloadBudget']) {
        if (!Number.isInteger(defaults[key]) || defaults[key] < 1) {
            errors.push(`defaults.${key} must be a positive integer.`)
        }
    }

    const skillKeys = new Set(Object.keys(schema.$defs.skill.properties));

    for (const [skillName, skill] of Object.entries(manifest.skills || {})) {
        for (const key of Object.keys(skill)) {
            if (!skillKeys.has(key)) errors.push(`${skillName} has unsupported key: ${key}`)
        }

        for (const key of schema.$defs.skill.required) {
            if (!(key in skill)) errors.push(`${skillName} missing required key: ${key}`)
        }

        if (skill.name !== skillName) errors.push(`${skillName}: manifest key must match entry.name "${skill.name}".`);

        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name || '')) {
            errors.push(`${skillName} has an invalid kebab-case name.`)
        }
    }
}

/** @summary Total bytes of a directory tree, or 0 when absent. */
function treeBytes(dir) {
    if (!existsSync(dir)) return 0;

    let total = 0;

    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const full = join(dir, entry.name);

        total += entry.isDirectory() ? treeBytes(full) : statSync(full).size
    }

    return total
}

/** @summary Every file under a tree, relative to it. */
function walk(dir, base = dir) {
    if (!existsSync(dir)) return [];

    return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
        const full = join(dir, entry.name);

        return entry.isDirectory() ? walk(full, base) : [relative(base, full)]
    })
}

const
    dirs      = readdirSync(SKILLS, {withFileTypes: true}).filter(e => e.isDirectory()).map(e => e.name).sort(),
    declared  = Object.keys(manifest.skills).sort();

// ── 0b. canonical document-reference census ────────────────────────────────────────────────────
//
// The package deliberately ships no `learn/` tree. A consumer-relative documentation path can
// therefore appear to work in neomjs/neo while dangling in every other consumer. The census is the
// bounded contract: every exact document token names its canonical repository, URL, consumers and
// semantic use. The URL arm below checks the actual corpus rather than trusting the data to certify
// itself.
const
    DOCUMENT_REFERENCE_FILE     = join(SKILLS, 'document-references.v1.json'),
    DOCUMENT_REFERENCE_SELECTOR = 'learn/[A-Za-z0-9_./-]+\\.md',
    DOCUMENT_REFERENCE_EXACT_RE = new RegExp(`^(?:${DOCUMENT_REFERENCE_SELECTOR})$`),
    DOCUMENT_REFERENCE_OWNERS   = new Map([
        ['neomjs/neo-agent-brain', 13],
        ['neomjs/neo',             10]
    ]),
    DOCUMENT_REFERENCE_KINDS    = new Set(['load', 'target-write', 'prose']),
    DOCUMENT_REFERENCE_ROOT_KEYS = new Set(['schemaVersion', 'selector', 'rows']),
    DOCUMENT_REFERENCE_ROW_KEYS = new Set([
        'token', 'canonicalOwner', 'resolution', 'referencingSkills', 'kinds'
    ]);

let documentReferenceCensus = {};

try {
    documentReferenceCensus = JSON.parse(readFileSync(DOCUMENT_REFERENCE_FILE, 'utf8'))
} catch {
    errors.push('document-references.v1.json is missing or invalid JSON — canonical documentation reach is unmeasured.')
}

for (const key of Object.keys(documentReferenceCensus)) {
    if (!DOCUMENT_REFERENCE_ROOT_KEYS.has(key)) {
        errors.push(`document-reference census has unsupported key: ${key}`)
    }
}

for (const key of DOCUMENT_REFERENCE_ROOT_KEYS) {
    if (!(key in documentReferenceCensus)) {
        errors.push(`document-reference census missing required key: ${key}`)
    }
}

if (documentReferenceCensus.schemaVersion !== 'document-references.v1') {
    errors.push('document-reference census schemaVersion must be "document-references.v1".')
}

if (documentReferenceCensus.selector !== DOCUMENT_REFERENCE_SELECTOR) {
    errors.push(`document-reference census selector must be "${DOCUMENT_REFERENCE_SELECTOR}".`)
}

const
    documentReferenceRows = Array.isArray(documentReferenceCensus.rows) ? documentReferenceCensus.rows : [],
    documentRowsByToken    = new Map(),
    ownerCounts            = new Map([...DOCUMENT_REFERENCE_OWNERS.keys()].map(owner => [owner, 0]));

if (!Array.isArray(documentReferenceCensus.rows)) {
    errors.push('document-reference census rows must be an array.')
}

if (documentReferenceRows.length !== 23) {
    errors.push(`document-reference census must contain exactly 23 rows; found ${documentReferenceRows.length}.`)
}

for (const [index, row] of documentReferenceRows.entries()) {
    const label = `document-reference row ${index + 1}`;

    if (!row || typeof row !== 'object' || Array.isArray(row)) {
        errors.push(`${label} must be an object.`);
        continue
    }

    for (const key of Object.keys(row)) {
        if (!DOCUMENT_REFERENCE_ROW_KEYS.has(key)) errors.push(`${label} has unsupported key: ${key}`)
    }

    for (const key of DOCUMENT_REFERENCE_ROW_KEYS) {
        if (!(key in row)) errors.push(`${label} missing required key: ${key}`)
    }

    if (!DOCUMENT_REFERENCE_EXACT_RE.test(row.token || '')) {
        errors.push(`${label} token is not an exact learn/**/*.md document: ${JSON.stringify(row.token)}.`)
    } else if (documentRowsByToken.has(row.token)) {
        errors.push(`document-reference census has duplicate row for ${row.token}.`)
    } else {
        documentRowsByToken.set(row.token, row)
    }

    if (!DOCUMENT_REFERENCE_OWNERS.has(row.canonicalOwner)) {
        errors.push(`${label} has unknown canonicalOwner: ${JSON.stringify(row.canonicalOwner)}.`)
    } else {
        ownerCounts.set(row.canonicalOwner, ownerCounts.get(row.canonicalOwner) + 1)
    }

    const expectedResolution = `https://github.com/${row.canonicalOwner}/blob/dev/${row.token}`;

    if (row.resolution !== expectedResolution) {
        errors.push(`${label} resolution must be ${expectedResolution}; found ${JSON.stringify(row.resolution)}.`)
    }

    if (!Array.isArray(row.referencingSkills) || !row.referencingSkills.length) {
        errors.push(`${label} referencingSkills must be a non-empty array.`)
    } else {
        const uniqueSkills = new Set(row.referencingSkills);

        if (uniqueSkills.size !== row.referencingSkills.length) {
            errors.push(`${label} referencingSkills contains duplicates.`)
        }

        for (const skillName of row.referencingSkills) {
            if (typeof skillName !== 'string' || !manifest.skills[skillName]) {
                errors.push(`${label} references unknown skill: ${JSON.stringify(skillName)}.`)
            }
        }
    }

    if (!Array.isArray(row.kinds) || !row.kinds.length) {
        errors.push(`${label} kinds must be a non-empty array.`)
    } else {
        const uniqueKinds = new Set(row.kinds);

        if (uniqueKinds.size !== row.kinds.length) errors.push(`${label} kinds contains duplicates.`)

        for (const kind of row.kinds) {
            if (!DOCUMENT_REFERENCE_KINDS.has(kind)) {
                errors.push(`${label} has unknown kind: ${JSON.stringify(kind)}.`)
            }
        }
    }
}

for (const [owner, expected] of DOCUMENT_REFERENCE_OWNERS) {
    if (ownerCounts.get(owner) !== expected) {
        errors.push(`document-reference census must contain ${expected} ${owner} rows; found ${ownerCounts.get(owner)}.`)
    }
}

const observedDocumentSkills = new Map();

/** @summary Records one document token and verifies it is inside the census row's exact URL. */
function recordDocumentReference({file, index, skillName, source, token}) {
    if (!observedDocumentSkills.has(token)) observedDocumentSkills.set(token, new Set());
    observedDocumentSkills.get(token).add(skillName);

    const row = documentRowsByToken.get(token);

    if (!row) {
        errors.push(`${file} references ${token}, which has no document-reference census row.`);
        return
    }

    if (typeof row.resolution !== 'string') return;

    const
        prefixLength = row.resolution.length - token.length,
        start        = index - prefixLength,
        embedded     = start >= 0 && source.slice(start, index + token.length) === row.resolution;

    if (!embedded) {
        errors.push(`${file} references ${token} outside its exact canonical URL ${row.resolution}.`)
    }
}

for (const name of dirs) {
    const skillRoot = join(SKILLS, name);

    for (const rel of walk(skillRoot)) {
        if (!rel.endsWith('.md')) continue;

        const
            file   = `${name}/${rel}`,
            source = readFileSync(join(skillRoot, rel), 'utf8');

        for (const match of source.matchAll(new RegExp(DOCUMENT_REFERENCE_SELECTOR, 'g'))) {
            recordDocumentReference({file, index: match.index, skillName: name, source, token: match[0]})
        }
    }
}

// The manifest repeats router descriptions, so it is a real shipped reference surface too. Attribute
// each occurrence to the row whose description owns it rather than to a fake "manifest" skill.
for (const [skillName, skill] of Object.entries(manifest.skills)) {
    const source = skill.description || '';

    for (const match of source.matchAll(new RegExp(DOCUMENT_REFERENCE_SELECTOR, 'g'))) {
        recordDocumentReference({
            file: `skills.manifest.json:${skillName}.description`,
            index: match.index,
            skillName,
            source,
            token: match[0]
        })
    }
}

for (const [token, row] of documentRowsByToken) {
    const observed = observedDocumentSkills.get(token);

    if (!observed) {
        errors.push(`document-reference census row ${token} has no occurrence in the shipped skill corpus.`);
        continue
    }

    const
        expectedSkills = Array.isArray(row.referencingSkills) ? [...new Set(row.referencingSkills)].sort() : [],
        actualSkills   = [...observed].sort();

    if (JSON.stringify(actualSkills) !== JSON.stringify(expectedSkills)) {
        errors.push(`${token} referencingSkills drift: census ${JSON.stringify(expectedSkills)}, corpus ${JSON.stringify(actualSkills)}.`)
    }
}

for (const token of observedDocumentSkills.keys()) {
    if (!documentRowsByToken.has(token)) {
        // Per-occurrence findings above carry the exact files. This aggregate makes the missing-row
        // contract explicit even when several files repeat the same uncatalogued token.
        errors.push(`document-reference census is missing row for ${token}.`)
    }
}

// ── 1. directory ↔ manifest coherence, and frontmatter agreement ────────────────────────────────
for (const name of dirs) {
    if (!manifest.skills[name]) errors.push(`${name}/ exists on disk with no manifest row — an undeclared skill ships but is never budgeted.`)
}

for (const name of declared) {
    if (!dirs.includes(name)) { errors.push(`manifest declares ${name} with no directory — a row budgeting nothing.`); continue }

    const skillMd = join(SKILLS, name, 'SKILL.md');

    if (!existsSync(skillMd)) { errors.push(`${name}/SKILL.md is missing — the router is what a harness reads first.`); continue }

    const
        src  = readFileSync(skillMd, 'utf8'),
        fm   = /^---\n([\s\S]*?)\n---/.exec(src),
        row  = manifest.skills[name];

    if (!fm) { errors.push(`${name}/SKILL.md has no frontmatter block.`); continue }

    const
        // Frontmatter scalars may be YAML-quoted. Comparing the quoted form against the manifest's
        // unquoted value reported all 38 rows as disagreeing with themselves — a parser defect that
        // reads exactly like a corpus defect, which is why the unquote happens before the compare.
        // Strip the YAML quotes AND unescape what they required. Three separate parser defects
        // here each reported the corpus as broken: the quotes themselves, then the \" escapes the
        // quoting forced, then nothing. A frontmatter reader that is subtly wrong accuses 38 files.
        unquote = v => {
            const trimmed = v?.trim();

            return /^(["']).*\1$/s.test(trimmed ?? '')
                ? trimmed.slice(1, -1).replace(/\\(["'\\])/g, '$1').trim()
                : trimmed
        },
        fmName  = unquote(/^name:\s*(.+)$/m.exec(fm[1])?.[1]),
        fmDesc  = unquote(/^description:\s*([\s\S]+?)(?=\n[a-z-]+:\s|$)/m.exec(fm[1])?.[1]);

    if (fmName !== name)     errors.push(`${name}/SKILL.md frontmatter name is "${fmName}", expected "${name}".`);
    if (fmName !== row.name) errors.push(`${name}: frontmatter name "${fmName}" disagrees with the manifest row "${row.name}".`);
    if (fmDesc && row.description && fmDesc.replace(/\s+/g, ' ') !== row.description.replace(/\s+/g, ' ')) {
        errors.push(`${name}: frontmatter description disagrees with the manifest row — the router and the index would advertise different triggers.`)
    }

    // ── 2. router + payload budgets ─────────────────────────────────────────────────────────────
    // trimEnd first — the canonical comparison is `text.trimEnd().split('\n').length`. Without it a
    // trailing newline adds a phantom line and every router sitting exactly ON budget reports over.
    const lines = src.trimEnd().split('\n').length;

    if (lines > budget(row, 'routerByteBudget')) {
        errors.push(`${name}/SKILL.md has ${lines} lines, exceeds routerByteBudget ${budget(row, 'routerByteBudget')} (LINES, not bytes).`)
    }

    const refs = join(SKILLS, name, 'references');

    if (treeBytes(refs) > budget(row, 'payloadBudget')) {
        errors.push(`${name}/references has ${treeBytes(refs)} bytes, exceeds payloadBudget ${budget(row, 'payloadBudget')}.`)
    }

    const perFile = budget(row, 'perFilePayloadBudget');

    if (perFile) {
        for (const rel of walk(refs)) {
            if (exempt.has(`${name}/references/${rel}`)) continue;

            const bytes = statSync(join(refs, rel)).size;

            if (bytes > perFile) {
                errors.push(`${name}/references/${rel} has ${bytes} bytes, exceeds perFilePayloadBudget ${perFile}. Extract edge cases behind one-line trigger pointers.`)
            }
        }
    }

    // ── 3. reference integrity ──────────────────────────────────────────────────────────────────
    for (const file of ['SKILL.md', ...walk(refs).map(r => join('references', r))]) {
        const full = join(SKILLS, name, file);

        if (!/\.md$/.test(full)) continue;

        for (const [, link] of readFileSync(full, 'utf8').matchAll(/\]\((\.\.?\/[^)\s#]+)/g)) {
            const target = resolve(dirname(full), link);

            // A link leaving the skill tree is outside this lint's jurisdiction: the package does not
            // ship those files, so "does it resolve" is unanswerable here rather than false. The corpus
            // carries several links into the authoring repo's learn/ tree — a real portability question,
            // and not one a corpus-local check can adjudicate.
            // The boundary is the SKILLS TREE, not the package root. `create-skill/../../../learn`
            // resolves under the package root and still points at a directory this package does not
            // ship — checking the wrong boundary let every escaping link through as "inside".
            if (!target.startsWith(SKILLS)) continue;

            if (!existsSync(target)) {
                errors.push(`${name}/${file} links ${link}, which does not resolve — a router pointing at nothing is worse than one pointing nowhere.`)
            }
        }
    }
}

// ── 3b. combined budgets — a loaded SURFACE, not a single file ──────────────────────────────────
//
// Migrated from neomjs/neo's check-substrate-size (#15257) when the corpus moved here. Per-file
// budgets cannot express it: the rule bounds what a reader loads when several files arrive together,
// so two files each individually legal can still breach the surface. `limitBytes` is the baseline the
// surface had to get BELOW, so landing exactly on it is the breach and the largest legal sum is
// limitBytes - 1.
const COMBINED_BUDGETS = [
    {
        label     : 'pr-review loaded surface (neomjs/neo#15257)',
        limitBytes: 41357,
        files     : [
            'pr-review/audits/review-cost-circuit-breaker.md',
            'pr-review/references/pr-review-guide.md'
        ]
    }
];

for (const {label, limitBytes, files} of COMBINED_BUDGETS) {
    let sum = 0, missing = [];

    for (const rel of files) {
        const full = join(SKILLS, rel);

        existsSync(full) ? sum += statSync(full).size : missing.push(rel)
    }

    if (missing.length) {
        errors.push(`${label}: budgeted file(s) absent — ${missing.join(', ')}. A budget over a file that does not exist silently bounds nothing.`)
    } else if (sum >= limitBytes) {
        errors.push(`${label}: ${sum} bytes against a limit of ${limitBytes}; the largest legal sum is ${limitBytes - 1}. Individually legal files can still breach a loaded surface.`)
    }
}

// ── 4. net-growth budget ────────────────────────────────────────────────────────────────────────
const baseArg = process.argv.indexOf('--base');

if (baseArg !== -1 && process.argv[baseArg + 1]) {
    const base = process.argv[baseArg + 1];

    try {
        const
            baseBytes = Number(execFileSync('git', ['ls-tree', '-r', '-l', `${base}:.agents/skills`], {cwd: root, encoding: 'utf8'})
                .split('\n').filter(Boolean).reduce((sum, line) => sum + Number(line.split(/\s+/)[3] || 0), 0)),
            nowBytes  = treeBytes(SKILLS),
            delta     = nowBytes - baseBytes,
            cap       = defaults.maxPositiveDeltaBytes;

        // The escape hatch, carried over from the authoring repo's lint. Without it the cap is a hard
        // block with no legitimate way past, so the only route for justified growth becomes raising
        // the cap — which is how a budget quietly stops being one. A justification must be written
        // down, in the commit range being measured, and it names itself.
        const justified = SKILL_GROWTH_JUSTIFIED_RE.test(
            execFileSync('git', ['log', '--format=%B', `${base}..HEAD`], {cwd: root, encoding: 'utf8'})
        );

        if (Number.isFinite(cap) && delta > cap && !justified) {
            errors.push(`corpus grew ${delta} bytes against ${base}, exceeds maxPositiveDeltaBytes ${cap}. Growth is allowed; unexamined growth is not — trim, or state why in a commit message as [skill-growth-justified: reason].`)
        }
    } catch {
        errors.push(`net-growth arm could not read ${base}:.agents/skills — refusing to report a pass it did not measure.`)
    }
}

if (errors.length) {
    console.error(`skill-corpus: ${errors.length} finding(s)\n`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1)
}

console.log(`skill-corpus: ${dirs.length} skills, coherent with the manifest, within budget, document reach canonical.`);
