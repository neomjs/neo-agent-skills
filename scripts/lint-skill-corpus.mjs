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
 * revalidation checks, consumer byte-drift, AGENTS entrypoint budgets, downstream doc targets, and
 * anything resembling a reusable consumer workflow.
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

/** @summary A skill's effective budget: its own override, else the default. */
const budget = (row, key) => (Object.hasOwn(row, key) ? row[key] : defaults[key]);

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

        if (Number.isFinite(cap) && delta > cap) {
            errors.push(`corpus grew ${delta} bytes against ${base}, exceeds maxPositiveDeltaBytes ${cap}. Growth is allowed; unexamined growth is not — state why in the PR body or trim.`)
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

console.log(`skill-corpus: ${dirs.length} skills, coherent with the manifest, within budget, references resolve.`);
