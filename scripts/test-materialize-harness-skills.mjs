#!/usr/bin/env node
/**
 * @summary Contract checks for the skills materializer: both projections, the switch between them,
 * and every refusal, run for real against throwaway consumer roots.
 *
 * The consumer roots are plain temporary directories, not git repositories — an app workspace
 * `neo-app` has just created is not one yet, and the tracked-file probes must treat that as "nothing
 * committed is at risk" rather than fail.
 */

import assert                                                               from 'node:assert/strict';
import {spawnSync}                                                          from 'node:child_process';
import {existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, unlinkSync} from 'node:fs';
import {tmpdir}                                                             from 'node:os';
import {dirname, join, relative, resolve}                                   from 'node:path';
import {fileURLToPath}                                                      from 'node:url';

const
    here      = dirname(fileURLToPath(import.meta.url)),
    script    = join(here, 'materialize-harness-skills.mjs'),
    skillsIn  = resolve(here, '..', '.agents/skills'),
    manifest  = JSON.parse(readFileSync(join(skillsIn, 'skills.manifest.json'), 'utf8')),
    roots     = [],
    // The v1 app set, named rather than derived, so a row that silently joins or leaves the
    // audience fails here instead of shipping into every app workspace.
    APP       = ['neo-app-authoring', 'neural-link'],
    serves    = (row, audience) => (row.audiences ?? ['maintainer']).includes(audience),
    MAINTAINER = Object.keys(manifest.skills).filter(name => serves(manifest.skills[name], 'maintainer')).sort();

/**
 * @summary A fresh consumer root; removed when the file finishes. Physical, as the materializer
 * makes it: macOS's temporary directory is a symlink, and a link target computed across the two
 * path spaces differs by a segment.
 */
function consumer() {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'materialize-')));

    roots.push(root);
    return root
}

/** @summary Runs the materializer against a root, without inheriting the caller's INIT_CWD. */
function materialize(root, ...flags) {
    const env = {...process.env};

    delete env.INIT_CWD;

    return spawnSync(process.execPath, [script, '--root', root, ...flags], {encoding: 'utf8', env})
}

const entries = dir => readdirSync(dir).filter(name => !name.startsWith('.')).sort();

// ── The manifest declares the app audience on exactly the v1 set ────────────────────────────────
assert.deepEqual(
    Object.keys(manifest.skills).filter(name => serves(manifest.skills[name], 'app')).sort(), APP,
    'the app audience is exactly neo-app-authoring and neural-link'
);
assert.ok(!MAINTAINER.includes('neo-app-authoring'), 'and the app-only skill is no maintainer skill');

// ── No flag: the maintainer projection, shaped as it always was ─────────────────────────────────
{
    const root = consumer(),
          run  = materialize(root);

    assert.equal(run.status, 0, `the default projection materializes: ${run.stderr}`);
    assert.ok(lstatSync(join(root, '.agents/skills')).isSymbolicLink(), '.agents/skills stays ONE directory link');
    assert.equal(readlinkSync(join(root, '.agents/skills')), relative(join(root, '.agents'), skillsIn), 'at the package tree');
    assert.deepEqual(entries(join(root, '.claude/skills')), MAINTAINER, '.claude/skills holds the maintainer skills');
    assert.equal(materialize(root, '--check').status, 0, 'and its check passes');
    assert.equal(materialize(root, '--check', '--audience', 'app').status, 1,
        'the app check refuses a maintainer projection: a directory link exposes every skill');
}

// ── --audience app: per-skill links on both surfaces, exactly the app set ───────────────────────
{
    const root   = consumer(),
          run    = materialize(root, '--audience', 'app'),
          agents = join(root, '.agents/skills');

    assert.equal(run.status, 0, `the app projection materializes: ${run.stderr}`);
    assert.ok(!lstatSync(agents).isSymbolicLink(), '.agents/skills becomes a directory of links');
    assert.deepEqual(entries(agents), APP, 'holding exactly the app skills');
    assert.deepEqual(entries(join(root, '.claude/skills')), APP, 'and so does the Claude façade');

    for (const name of APP) {
        assert.ok(lstatSync(join(agents, name)).isSymbolicLink(), `${name} is a link, not copied bytes`);
        assert.ok(existsSync(join(agents, name, 'SKILL.md')), `${name} resolves to its SKILL.md`);
    }

    assert.equal(materialize(root, '--check', '--audience', 'app').status, 0, 'its check passes outside a git repository');
    assert.equal(materialize(root, '--check').status, 1, 'and the maintainer check refuses it');

    // Mutation: the check must see an invented entry and a missing one, on the neutral surface too.
    symlinkSync(relative(agents, join(skillsIn, 'pr-review')), join(agents, 'pr-review'));
    assert.equal(materialize(root, '--check', '--audience', 'app').status, 1, 'an extra maintainer skill in .agents/skills fails the check');
    unlinkSync(join(agents, 'pr-review'));
    unlinkSync(join(agents, 'neural-link'));
    assert.equal(materialize(root, '--check', '--audience', 'app').status, 1, 'a missing app skill fails the check');

    // Switching back on the next install restores the directory link.
    assert.equal(materialize(root).status, 0, 'the default projection replaces the app one');
    assert.ok(lstatSync(agents).isSymbolicLink(), '.agents/skills is one directory link again');
    assert.equal(materialize(root, '--check').status, 0, 'and checks clean');
}

// ── Refusals come before any link is touched ────────────────────────────────────────────────────
{
    const root    = consumer(),
          unknown = materialize(root, '--audience', 'nobody');

    assert.equal(unknown.status, 1, 'an audience no skill declares is refused');
    assert.match(unknown.stderr, /"nobody"/, 'naming it');
    assert.match(unknown.stderr, /app, maintainer/, 'and the declared audiences');
    assert.deepEqual(entries(root), [], 'and nothing was materialized');
    assert.equal(materialize(root, '--audience').status, 1, 'an audience flag without a name is refused');
}

roots.forEach(root => rmSync(root, {force: true, recursive: true}));
console.log('✅ materialize-harness-skills contract checks pass.');
