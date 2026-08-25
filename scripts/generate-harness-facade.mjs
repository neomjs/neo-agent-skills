#!/usr/bin/env node
/**
 * @summary Generate a harness façade from `skills.manifest.json` — the projection axis, made executable.
 *
 * Repo distribution and harness exposure are different axes. Every enrolled repo carries the same
 * canonical tree; each harness sees only what the manifest *declares* for it. This script owns the
 * second axis, so the façade stops being hand-maintained state that drifts from its own manifest.
 *
 * A skill is projected when its `claudeSymlinkRequired` is true, or when it omits the key and
 * `defaults.claudeSymlinkRequired` is true. An explicit `false` is a declared opt-out and must be
 * **absent** — you cannot opt a skill out of a single directory symlink, which is why the façade is
 * per-skill links rather than one link to the tree.
 *
 * Wave one preserves today's proven façade: `--check` asserts the generated projection is identical
 * to what is already committed, so adopting the generator changes no bytes. That equality is the
 * evidence that generation and the existing hand-maintained state agree.
 *
 * @example
 * node scripts/generate-harness-facade.mjs --root . --check   # verify, mutate nothing
 * node scripts/generate-harness-facade.mjs --root . --write   # materialize the façade
 */

import {existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, lstatSync, rmSync, symlinkSync} from 'node:fs';
import {join, resolve}                                                                                   from 'node:path';

const
    MANIFEST = '.agents/skills/skills.manifest.json',
    FACADE   = '.claude/skills',
    LINK_TO  = skill => `../../.agents/skills/${skill}`;

/**
 * @summary Parse `--flag [value]` pairs.
 * @param {String[]} argv
 * @returns {Object}
 */
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
 * @summary Skills the manifest declares for the Claude façade, and those it opts out.
 * @param {Object} manifest
 * @returns {{projected: String[], optedOut: String[]}}
 */
function projection(manifest) {
    const
        fallback  = manifest?.defaults?.claudeSymlinkRequired === true,
        projected = [],
        optedOut  = [];

    for (const [name, row] of Object.entries(manifest?.skills || {})) {
        const required = Object.hasOwn(row, 'claudeSymlinkRequired') ? row.claudeSymlinkRequired : fallback;

        (required ? projected : optedOut).push(name)
    }

    return {projected: projected.sort(), optedOut: optedOut.sort()}
}

const
    args     = parseArgs(process.argv.slice(2)),
    root     = resolve(args.root || '.'),
    manifest = JSON.parse(readFileSync(join(root, MANIFEST), 'utf8')),
    {projected, optedOut} = projection(manifest),
    facadeDir = join(root, FACADE);

if (args.write) {
    rmSync(facadeDir, {recursive: true, force: true});
    mkdirSync(facadeDir, {recursive: true});

    for (const skill of projected) symlinkSync(LINK_TO(skill), join(facadeDir, skill));

    console.log(`wrote ${projected.length} links; ${optedOut.length} declared opt-out(s) omitted: ${optedOut.join(', ') || '—'}`);
    process.exit(0)
}

// Default and --check: compare the declared projection against what is committed, mutate nothing.
const
    present = existsSync(facadeDir)
        ? readdirSync(facadeDir).filter(n => !n.startsWith('.')).sort()
        : [],
    missing    = projected.filter(n => !present.includes(n)),
    unexpected = present.filter(n => !projected.includes(n)),
    wrongTarget = projected.filter(n => {
        const link = join(facadeDir, n);

        // A regular directory here is a copy rather than a link — real drift, but `missing` already
        // covers absence, so only an existing symlink pointing elsewhere is reported as a bad target.
        if (!present.includes(n) || !lstatSync(link).isSymbolicLink()) return false;

        return readlinkSync(link) !== LINK_TO(n)
    });

if (missing.length || unexpected.length || wrongTarget.length) {
    console.error('façade does NOT match the manifest projection:');
    if (missing.length)     console.error(`  missing   : ${missing.join(', ')}`);
    if (unexpected.length)  console.error(`  unexpected: ${unexpected.join(', ')} (declared opt-outs must be absent)`);
    if (wrongTarget.length) console.error(`  bad target: ${wrongTarget.join(', ')}`);
    process.exit(1)
}

console.log(
    `façade matches the manifest projection: ${projected.length} links present, ` +
    `${optedOut.length} declared opt-out(s) correctly absent${optedOut.length ? ` (${optedOut.join(', ')})` : ''}`
);
