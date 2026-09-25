#!/usr/bin/env node
/**
 * @summary Contract checks for `check-version-bump.mjs`.
 *
 * - A greater, unpublished version that the lockfile agrees with passes.
 * - Each of these fails by name: an equal or lower version, a stale lockfile, a published version, a prerelease.
 * - A registry that gives no answer fails the check instead of passing it.
 * - The CLI judges the files in its checkout against a real git base.
 *
 * Run: `node scripts/test-check-version-bump.mjs`
 */

import assert                                             from 'node:assert/strict';
import {execFileSync}                                     from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync}               from 'node:fs';
import {tmpdir}                                           from 'node:os';
import {join}                                             from 'node:path';
import {classifyView, isPublished, judgeVersionBump, run} from './check-version-bump.mjs';

const verdict = (head, base, {lock = head, published = false} = {}) => judgeVersionBump({head, lock, base, published});

assert.deepEqual(verdict('0.1.20', '0.1.19'), [], 'a new, greater, unpublished version passes');
assert.match(verdict('0.1.19', '0.1.19').join(), /0\.1\.19 is not greater than the base's 0\.1\.19/, 'an unbumped version fails, naming both');
assert.match(verdict('0.1.18', '0.1.19').join(), /0\.1\.18 is not greater/, 'a lower version fails');
assert.deepEqual(verdict('0.1.10', '0.1.9'), [], 'versions compare as numbers, not as text');
assert.match(verdict('0.1.20', '0.1.19', {lock: '0.1.19'}).join(), /package-lock\.json says 0\.1\.19 where package\.json says 0\.1\.20/, 'a stale lockfile fails');
assert.match(verdict('0.1.20', '0.1.19', {published: true}).join(), /npm already has neo-agent-skills@0\.1\.20/, 'a published version fails');
assert.deepEqual(verdict('0.2.0-beta.1', '0.1.19'), ["package.json names no release version ('0.2.0-beta.1')"], 'a prerelease is not a release');

// The three shapes `npm view <package>@<version> version` answers with, as npm 11 prints them.
assert.equal(classifyView({status: 0, stdout: '0.1.19\n', stderr: ''}, '0.1.19'), true, 'npm prints a version it has');
assert.equal(classifyView({status: 1, stdout: '', stderr: 'npm error code E404\nnpm error 404 No match found for version 9.9.9\n'}, '9.9.9'), false,
    'E404 is npm saying it does not have the version');
assert.throws(() => classifyView({status: 1, stdout: '', stderr: 'npm error code ECONNREFUSED\n'}, '0.1.20'), /the registry did not answer .*ECONNREFUSED/,
    'no answer is not a "no"');

// The real `npm view`, pointed at a registry that cannot answer: the check fails closed.
const {npm_config_registry, npm_config_fetch_retries} = process.env;

process.env.npm_config_registry      = 'http://127.0.0.1:9/';
process.env.npm_config_fetch_retries = '0';

try {
    assert.throws(() => isPublished('0.1.20'), /the registry did not answer/, 'an unreachable registry fails closed')
} finally {
    npm_config_registry      === undefined ? delete process.env.npm_config_registry      : process.env.npm_config_registry      = npm_config_registry;
    npm_config_fetch_retries === undefined ? delete process.env.npm_config_fetch_retries : process.env.npm_config_fetch_retries = npm_config_fetch_retries
}

const
    repo    = mkdtempSync(join(tmpdir(), 'check-version-bump-')),
    git     = (...args) => execFileSync('git', args, {cwd: repo, encoding: 'utf8'}).trim(),
    release = version => {
        writeFileSync(join(repo, 'package.json'),      JSON.stringify({name: 'neo-agent-skills', version}) + '\n');
        writeFileSync(join(repo, 'package-lock.json'), JSON.stringify({name: 'neo-agent-skills', version, lockfileVersion: 3}) + '\n')
    },
    judge   = (argv, published = () => false) => {
        const lines = [],
              code  = run(argv, {cwd: repo, out: line => lines.push(line), error: line => lines.push(line), published});

        return {code, text: lines.join('\n')}
    };

try {
    git('init', '-q');
    git('config', 'user.email', 'ci@local');
    git('config', 'user.name', 'ci');
    release('0.1.19');
    git('add', '.');
    git('commit', '-qm', 'base');

    const base = git('rev-parse', 'HEAD');

    release('0.1.20');

    let result = judge(['--base', base]);
    assert.equal(result.code, 0, `a bumped head passes: ${result.text}`);
    assert.match(result.text, /0\.1\.19 → 0\.1\.20/);

    result = judge(['--base', base], () => true);
    assert.equal(result.code, 1, 'a head npm already has fails');
    assert.match(result.text, /npm already has neo-agent-skills@0\.1\.20/);

    result = judge(['--base', base], () => { throw new Error('the registry did not answer for neo-agent-skills@0.1.20 (ETIMEDOUT)') });
    assert.equal(result.code, 1, 'a registry that gives no answer fails the check');
    assert.match(result.text, /did not answer/);

    release('0.1.19');
    result = judge(['--base', base]);
    assert.equal(result.code, 1, 'an unbumped head fails');
    assert.match(result.text, /0\.1\.19 is not greater than the base's 0\.1\.19/);

    result = judge([]);
    assert.equal(result.code, 2, 'a missing --base is a usage error, not a pass');
    assert.match(result.text, /--base <ref> is required/);

    result = judge(['--base', 'no-such-ref']);
    assert.equal(result.code, 1, 'a base git cannot read fails');
} finally {
    rmSync(repo, {recursive: true, force: true})
}

console.log('check-version-bump: the verdicts, the registry answers and the CLI against a real base passed');
