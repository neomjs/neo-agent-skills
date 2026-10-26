#!/usr/bin/env node
/**
 * @summary Consumer-side postinstall: materialize harness skill links pointing into `node_modules`.
 *
 * The transport is an **npm dependency**. Skills are authored on `neo-agent-skills/dev`, every skill
 * change bumps this package's version, and a consumer bumps the dependency in its own
 * `package.json` + lockfile. This script then projects the installed package into whatever layout a
 * harness discovers — as **untracked, git-ignored symlinks whose targets live under
 * `node_modules`**. It copies **zero skill bytes into consumer git**, which is the property that
 * makes the store a single source rather than a publisher of duplicates.
 *
 * An earlier design committed the bytes into every consumer. The operator rejected it twice
 * (`SSOT violation`), and the objection is structural: a canonical store whose contents are
 * duplicated N times is not canonical, and the drift machinery needed to police those duplicates is
 * evidence of the mistake rather than mitigation of it.
 *
 * **`--check` exists because `--ignore-scripts` is our own practice.** Three `neomjs/neo` workflows
 * already run `npm ci --ignore-scripts`, which skips `postinstall` *and* `prepare`. Under this
 * transport that yields a consumer with the dependency resolved and **no links materialized** — the
 * invisible-absence failure, reintroduced by the transport's own install step. `--check` is the arm
 * that makes it loud: CI asserts materialization succeeded rather than assuming the hook ran.
 *
 * **Measured npm gotcha — `npm install <pkg>` does NOT run the consumer's `postinstall`; a bare
 * `npm install` does.** Verified on a clean fixture: installing the tarball by name added the
 * package and materialized nothing, while a subsequent bare `npm install` produced all 37 links.
 * That matters because the version-bump workflow is exactly `npm install neo-agent-skills@x` — the
 * links stay stale through the command that bumps them. `--check` is what turns that from silent
 * into loud, which is why it is a CI arm and not a convenience.
 *
 * **`--audience <name>` projects one declared audience instead of the maintainer corpus.** A
 * workspace that `neo-app` creates for an outside developer gets the `app` skills and nothing else.
 * In that mode BOTH surfaces become per-skill links: a directory link exposes the whole tree, so it
 * cannot leave the maintainer skills out. The audience is passed by the consumer (its `prepare`), never
 * inferred from it. A row that declares no `audiences` serves maintainers, which is what every row
 * written before the field existed is — so the projection without the flag is the one it always was.
 *
 * @example
 * neo-agent-skills-materialize                         # postinstall: create/refresh the links
 * neo-agent-skills-materialize --check                 # CI: assert they exist, resolve, and nothing shadows them
 * neo-agent-skills-materialize --audience app          # an app workspace: only the skills declaring `app`
 * neo-agent-skills-materialize --audience app --check  # assert that projection
 */

import {existsSync, mkdirSync, readdirSync, readFileSync, readlinkSync, lstatSync, realpathSync, rmSync, symlinkSync, statSync} from 'node:fs';
import {execFileSync}                                                                                                            from 'node:child_process';
import {dirname, join, relative, resolve}                                                                                        from 'node:path';
import {fileURLToPath}                                                                                                           from 'node:url';

const
    here        = dirname(fileURLToPath(import.meta.url)),
    packageRoot = resolve(here, '..'),
    SKILLS_REL  = '.agents/skills',
    // Two surfaces, deliberately different shapes.
    //
    // `.agents/skills` is ONE directory symlink: the harness-neutral discovery surface. A Codex,
    // Antigravity or any other fork looks here, and it must see the whole tree — projection is not
    // its concern.
    //
    // `.claude/skills` is PER-SKILL links, because the manifest may opt a skill out of the Claude
    // façade and you cannot opt a skill out of a directory symlink. That asymmetry is the contract,
    // not an inconsistency.
    AGENTS      = '.agents/skills',
    FACADE      = '.claude/skills';

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
 * @summary The consumer root — the project installing this package.
 *
 * `INIT_CWD` is what npm sets to the directory the install was invoked from, which is the consumer
 * root during `postinstall`. Falling back to walking out of `node_modules` keeps a direct invocation
 * working. Guessing `process.cwd()` alone would silently target the wrong tree when npm runs
 * lifecycle scripts from elsewhere.
 *
 * @returns {String}
 */
function consumerRoot() {
    if (process.env.INIT_CWD) return resolve(process.env.INIT_CWD);

    const marker = `${resolve('node_modules')}`;

    return packageRoot.includes(`${'node_modules'}`)
        ? resolve(packageRoot.slice(0, packageRoot.indexOf('node_modules')))
        : resolve(marker, '..')
}

/**
 * @summary The audiences a skill row serves; a row that declares none serves maintainers.
 * @param {Object} row
 * @returns {String[]}
 */
function audiencesOf(row) {
    return row.audiences ?? ['maintainer']
}

/**
 * @summary Skills that serve one audience — the `.agents/skills` set under `--audience`.
 * @param {Object} manifest
 * @param {String} audience
 * @returns {String[]}
 */
function members(manifest, audience) {
    return Object.entries(manifest?.skills || {})
        .filter(([, row]) => audiencesOf(row).includes(audience))
        .map(([name]) => name)
        .sort()
}

/**
 * @summary Skills the manifest projects into the Claude façade for one audience.
 * @param {Object} manifest
 * @param {String} audience
 * @returns {String[]}
 */
function projected(manifest, audience) {
    const fallback = manifest?.defaults?.claudeSymlinkRequired === true;

    return members(manifest, audience)
        .filter(name => {
            const row = manifest.skills[name];

            return Object.hasOwn(row, 'claudeSymlinkRequired') ? row.claudeSymlinkRequired : fallback
        })
}

/**
 * @summary Is a path tracked by the consumer's git? Tracked links are shadow bytes, not projection.
 * @param {String} root
 * @param {String} path
 * @returns {Boolean}
 */
function tracked(root, path) {
    try {
        execFileSync('git', ['ls-files', '--error-unmatch', '--', path], {cwd: root, stdio: 'ignore'});
        return true
    } catch {
        return false
    }
}

const
    args     = parseArgs(process.argv.slice(2)),
    // Physical like `packageRoot`, which Node realpaths: across two path spaces a relative link dangles.
    root     = realpathSync(resolve(args.root || consumerRoot())),
    skillsIn = join(packageRoot, SKILLS_REL),
    manifestPath = join(skillsIn, 'skills.manifest.json');

if (!existsSync(manifestPath)) {
    console.error(`neo-agent-skills: no manifest at ${manifestPath}; the installed package is incomplete.`);
    process.exit(1)
}

if (args.audience === true) {
    console.error('neo-agent-skills: --audience needs a name, e.g. --audience app.');
    process.exit(1)
}

const
    manifest   = JSON.parse(readFileSync(manifestPath, 'utf8')),
    // No flag is the maintainer projection — the one every consumer had before audiences existed.
    audience   = args.audience ?? null,
    names      = projected(manifest, audience ?? 'maintainer'),
    // Only a DECLARED audience splits the harness-neutral surface into per-skill links.
    agentNames = audience ? members(manifest, audience) : null,
    agentsDir  = join(root, AGENTS),
    facadeDir  = join(root, FACADE),
    // Relative so the link survives the tree being moved or mounted at a different absolute path.
    targetIn   = dir => name => relative(dir, join(skillsIn, name)),
    targetFor  = targetIn(facadeDir);

// A filter that matches nothing is a typo, not an empty projection: refuse before touching a link.
if (audience && !agentNames.length) {
    const declared = [...new Set(Object.values(manifest.skills).flatMap(audiencesOf))].sort();

    console.error(`neo-agent-skills: no skill declares the audience "${audience}". Declared: ${declared.join(', ')}.`);
    process.exit(1)
}

/**
 * @summary Failures of one per-skill surface against the names it must hold, exactly.
 * @param {String} dir
 * @param {String} label
 * @param {String[]} expected
 * @param {Function} targetOf name → the relative link target it must carry
 * @returns {String[]}
 */
function checkLinks(dir, label, expected, targetOf) {
    const
        present  = existsSync(dir) ? readdirSync(dir).filter(n => !n.startsWith('.')) : [],
        failures = [];

    if (!present.length) {
        failures.push(
            `${label} is empty or absent while neo-agent-skills is installed. The postinstall hook did ` +
            `not run — \`npm ci --ignore-scripts\` skips both postinstall and prepare, and is already ` +
            `deliberate practice in three neomjs/neo workflows. The dependency resolving is not the same ` +
            `as the skills being reachable.`
        )
    }

    for (const name of expected) {
        const link = join(dir, name);

        if (!present.includes(name)) { failures.push(`${label}/${name} is missing from the projection.`); continue }
        if (!lstatSync(link).isSymbolicLink()) {
            failures.push(`${label}/${name} is not a symlink — a real directory here is copied bytes, which this transport forbids.`);
            continue
        }
        if (!existsSync(link)) failures.push(`${label}/${name} is a dangling link; its node_modules target is gone.`);
        else if (readlinkSync(link) !== targetOf(name)) {
            failures.push(
                `${label}/${name} points at ${readlinkSync(link)}, expected ${targetOf(name)}. ` +
                `Checking that a link exists and resolves says nothing about WHERE it resolves.`
            )
        }
        if (tracked(root, join(label, name))) {
            failures.push(`${label}/${name} is TRACKED by git. Projection artifacts are untracked by contract — tracked links are shadow bytes.`)
        }
    }

    for (const extra of present.filter(n => !expected.includes(n))) {
        failures.push(`${label}/${extra} is not projected by the manifest — an invented or stale entry.`)
    }

    return failures
}

// ── check mode: assert materialization actually happened ────────────────────────────────────────
if (args.check) {
    const failures = [];

    // Harness-neutral surface first — its absence means a non-Claude fork discovers nothing.
    if (agentNames) {
        if (existsSync(agentsDir) && lstatSync(agentsDir).isSymbolicLink()) {
            failures.push(
                `${AGENTS} is a directory link, but --audience ${audience} projects per-skill links. A ` +
                `directory link exposes every skill in the package, the maintainer corpus included.`
            )
        } else {
            failures.push(...checkLinks(agentsDir, AGENTS, agentNames, targetIn(agentsDir)))
        }
    } else {
        const agentsTarget = relative(dirname(agentsDir), skillsIn);

        if (!existsSync(agentsDir) || !lstatSync(agentsDir).isSymbolicLink()) {
            failures.push(
                `${AGENTS} is absent or not a symlink. This is the harness-NEUTRAL discovery surface; ` +
                `without it a Codex/Antigravity-style fork sees no skills at all, however healthy the ` +
                `Claude façade looks.`
            )
        } else if (readlinkSync(agentsDir) !== agentsTarget) {
            failures.push(
                `${AGENTS} points at ${readlinkSync(agentsDir)}, expected ${agentsTarget}. A link that ` +
                `resolves to the wrong tree resolves — existence is not correctness.`
            )
        }
    }

    failures.push(...checkLinks(facadeDir, FACADE, names, targetFor));

    if (failures.length) {
        console.error(`neo-agent-skills: materialization check FAILED (${failures.length})\n`);
        for (const f of failures) console.error(`  - ${f}\n`);
        process.exit(1)
    }

    console.log(
        `neo-agent-skills: ${names.length} skill link(s) materialized from node_modules` +
        `${audience ? ` for the ${audience} audience` : ''}, none tracked, none shadowed ` +
        `(v${JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version})`
    );
    process.exit(0)
}

/**
 * @summary Refuse to destroy anything git tracks.
 *
 * Materialization owns UNTRACKED projection and nothing else. Without this, running `npm install` in
 * the authoring repository deletes its 133 tracked skill files and its 37 tracked façade links —
 * silently, from a postinstall hook, because `rmSync(..., {recursive: true, force: true})` does not
 * care what it is removing. A repo that still authors the corpus, or has not yet untracked its
 * façade, must get a loud refusal rather than a wiped tree.
 *
 * @param {String} path  absolute path about to be replaced
 * @param {String} label the path as a consumer would name it
 */
function refuseIfTracked(path, label) {
    if (!existsSync(path)) return;

    try {
        const out = execFileSync('git', ['ls-files', '--error-unmatch', '--', label], {
            cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
        });

        if (out.trim()) {
            console.error(
                `neo-agent-skills: REFUSING to materialize over ${label} — git tracks it ` +
                `(${out.trim().split('\n').length} file(s)).\n\n` +
                `  Materialization manages untracked projection only. This repo either still authors ` +
                `the corpus or has not untracked its façade yet; either way, replacing tracked content ` +
                `from a postinstall hook would delete committed work with no prompt.\n` +
                `  Untrack the path and git-ignore it first, then install again.`
            );
            process.exit(1)
        }
    } catch {
        // Not a git repo, or the path is untracked — both mean nothing committed is at risk.
    }
}

// ── write mode: (re)create the projection ───────────────────────────────────────────────────────
// Harness-neutral surface: one directory link at the whole tree, or per-skill links for a declared
// audience. Removing either shape first lets a consumer switch between them on the next install.
refuseIfTracked(agentsDir, AGENTS);
rmSync(agentsDir, {recursive: true, force: true});

if (agentNames) {
    mkdirSync(agentsDir, {recursive: true});
    for (const name of agentNames) symlinkSync(targetIn(agentsDir)(name), join(agentsDir, name))
} else {
    mkdirSync(dirname(agentsDir), {recursive: true});
    symlinkSync(relative(dirname(agentsDir), skillsIn), agentsDir)
}

// Claude façade: per-skill links, manifest-projected.
refuseIfTracked(facadeDir, FACADE);
rmSync(facadeDir, {recursive: true, force: true});
mkdirSync(facadeDir, {recursive: true});

for (const name of names) symlinkSync(targetFor(name), join(facadeDir, name));

const omitted = Object.keys(manifest.skills).filter(n => !names.includes(n));

console.log(
    `neo-agent-skills: materialized ${names.length} link(s) into ${FACADE} → node_modules` +
    (audience ? ` for the ${audience} audience (${agentNames.length} in ${AGENTS})` : '') +
    (omitted.length ? `; ${omitted.length} not projected: ${omitted.join(', ')}` : '')
);
console.log(`neo-agent-skills: ${AGENTS}/ and ${FACADE}/ must be git-ignored — these are projection artifacts, never committed bytes.`);
