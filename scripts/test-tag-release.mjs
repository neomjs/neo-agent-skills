#!/usr/bin/env node
/**
 * @summary Fixture checks for `tag-release.mjs` against a real bare origin: it tags nothing on a dry
 * run, tags and pushes a clean published commit, is idempotent on rerun, fails loudly on a failed push
 * and finishes it on rerun, and refuses a dirty tree or a tag that marks another commit.
 *
 * Run: `node scripts/test-tag-release.mjs`
 */

import assert                                          from 'node:assert/strict';
import {execFileSync, spawnSync}                       from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir}                                        from 'node:os';
import {join}                                          from 'node:path';

const
    script = join(import.meta.dirname, 'tag-release.mjs'),
    base   = mkdtempSync(join(tmpdir(), 'tag-release-')),
    origin = join(base, 'origin.git'),
    repo   = join(base, 'work'),
    git    = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8'}).trim(),
    run    = (extraEnv = {}) => {
        const env = {...process.env, ...extraEnv};
        if (!('npm_config_dry_run' in extraEnv)) delete env.npm_config_dry_run;
        return spawnSync('node', [script, `--root=${repo}`], {encoding: 'utf8', env})
    },
    onOrigin = t  => git(origin, 'tag', '--list', t) ? git(origin, 'rev-parse', `${t}^{commit}`) : '';

/** @summary Commits a package.json at `version`, the state `npm publish` leaves behind. */
function release(version) {
    writeFileSync(join(repo, 'package.json'), JSON.stringify({name: 'fixture', version}) + '\n');
    git(repo, 'add', 'package.json');
    git(repo, 'commit', '-qm', `release ${version}`);
    return git(repo, 'rev-parse', 'HEAD')
}

try {
    mkdirSync(repo);
    git(base, 'init', '-q', '--bare', origin);
    git(repo, 'init', '-q');
    git(repo, 'config', 'user.email', 'ci@local');
    git(repo, 'config', 'user.name', 'ci');
    git(repo, 'remote', 'add', 'origin', origin);

    // 0. `npm publish --dry-run` runs postpublish with npm_config_dry_run=true: nothing is tagged.
    release('1.2.2');
    let out = run({npm_config_dry_run: 'true'});
    assert.equal(out.status, 0, `dry run: ${out.stderr}`);
    assert.match(out.stdout, /dry run/);
    assert.equal(git(repo, 'tag', '--list', 'v1.2.2'), '', 'a dry run writes no local tag');
    assert.equal(onOrigin('v1.2.2'), '', 'a dry run pushes no tag');

    // 1. A clean published commit is tagged and the tag reaches origin.
    let head = release('1.2.3');
    out = run();
    assert.equal(out.status, 0, `tag and push: ${out.stderr}`);
    assert.equal(onOrigin('v1.2.3'), head, 'origin holds the tag at the published commit');

    // 2. A rerun is a no-op, not a refusal.
    out = run();
    assert.equal(out.status, 0, `rerun after success: ${out.stderr}`);
    assert.match(out.stdout, /already on origin/);

    // 3. A failed push is loud, names the rerun, and leaves the local tag at HEAD.
    head = release('1.2.4');
    git(repo, 'remote', 'set-url', 'origin', join(base, 'missing.git'));
    out = run();
    assert.equal(out.status, 1, 'an unreachable origin fails the release step');
    assert.match(out.stderr, /rerun/);

    // 4. With origin back, the rerun finishes the release.
    git(repo, 'remote', 'set-url', 'origin', origin);
    out = run();
    assert.equal(out.status, 0, `recovery rerun: ${out.stderr}`);
    assert.equal(onOrigin('v1.2.4'), head, 'the recovered tag reaches origin at the published commit');

    // 5. A dirty tree is refused before any tag exists.
    release('1.2.5');
    writeFileSync(join(repo, 'untracked.txt'), 'x');
    out = run();
    assert.equal(out.status, 1, 'a dirty tree is refused');
    assert.match(out.stderr, /the tree is dirty/);
    assert.equal(git(repo, 'tag', '--list', 'v1.2.5'), '', 'a refused run writes no tag');
    rmSync(join(repo, 'untracked.txt'));

    // 6. A tag that marks another commit is refused rather than moved.
    git(repo, 'tag', '-a', 'v1.2.6', '-m', 'stale');
    release('1.2.6');
    out = run();
    assert.equal(out.status, 1, 'a tag at another commit is refused');
    assert.match(out.stderr, /marks .*, not HEAD/);

    console.log('tag-release: 7 cases passed');
} finally {
    rmSync(base, {recursive: true, force: true})
}
