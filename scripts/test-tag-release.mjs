#!/usr/bin/env node
/**
 * @summary Fixture checks for `tag-release.mjs`: it tags a clean published commit once, and refuses
 * a dirty tree and an existing tag before writing anything.
 *
 * Run: `node scripts/test-tag-release.mjs`
 */

import assert                                          from 'node:assert/strict';
import {spawnSync, execFileSync}                       from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync}            from 'node:fs';
import {tmpdir}                                        from 'node:os';
import {join}                                          from 'node:path';

const
    script = join(import.meta.dirname, 'tag-release.mjs'),
    repo   = mkdtempSync(join(tmpdir(), 'tag-release-')),
    git    = (...args) => execFileSync('git', args, {cwd: repo, encoding: 'utf8'}).trim(),
    run    = () => spawnSync('node', [script, `--root=${repo}`, '--no-push'], {encoding: 'utf8'});

try {
    git('init', '-q');
    git('config', 'user.email', 'ci@local');
    git('config', 'user.name', 'ci');
    writeFileSync(join(repo, 'package.json'), JSON.stringify({name: 'fixture', version: '1.2.3'}) + '\n');
    git('add', 'package.json');
    git('commit', '-qm', 'fixture');

    const first = run();
    assert.equal(first.status, 0, `a clean published commit is tagged: ${first.stderr}`);
    assert.equal(git('rev-parse', 'v1.2.3^{commit}'), git('rev-parse', 'HEAD'), 'the tag marks the published commit');

    const again = run();
    assert.equal(again.status, 1, 'an existing tag is refused');
    assert.match(again.stderr, /v1\.2\.3 already exists/);

    git('tag', '-d', 'v1.2.3');
    writeFileSync(join(repo, 'untracked.txt'), 'x');
    const dirty = run();
    assert.equal(dirty.status, 1, 'a dirty tree is refused');
    assert.match(dirty.stderr, /the tree is dirty/);
    assert.equal(git('tag', '--list', 'v1.2.3'), '', 'a refused run writes no tag');

    console.log('tag-release: 3 cases passed');
} finally {
    rmSync(repo, {recursive: true, force: true})
}
