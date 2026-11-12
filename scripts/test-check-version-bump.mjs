#!/usr/bin/env node
/**
 * @summary Contract checks for `check-version-bump.mjs`.
 *
 * - A greater, unpublished version that the lockfile agrees with passes.
 * - Each of these fails by name: an equal or lower version, a stale lockfile, a published version, a prerelease.
 * - A registry that gives no answer fails the check instead of passing it.
 * - A fork keeps the base version: it passes however far the base moved since it branched, and a fork that changes
 *   the version fails with a sentence written for its author.
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

const forkVerdict = (head, base, {lock = head} = {}) => judgeVersionBump({head, lock, base, published: false, origin: 'fork'}),
      bumpedFork  = forkVerdict('1.4.6', '1.4.5').join();

assert.deepEqual(forkVerdict('1.4.5', '1.4.5'), [], 'a fork that keeps the base version passes');
assert.match(bumpedFork, /changes the package version to 1\.4\.6\. Restore 1\.4\.5 in package\.json and package-lock\.json/, 'a bumped fork is told what to restore');
assert.match(bumpedFork, /the next maintainer release carries your change/);
assert.doesNotMatch(bumpedFork, /maintainer pull requests/, 'its author reads no rule written for maintainers');
assert.match(forkVerdict('1.4.5', '1.4.5', {lock: '1.4.4'}).join(), /package-lock\.json says 1\.4\.4 where package\.json says 1\.4\.5/, 'a fork\'s lockfile still has to agree');

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

    const event   = join(repo, 'event.json'),
          home    = 'neomjs/neo-agent-skills',
          eventOf = (login, type, head = home) => writeFileSync(event, JSON.stringify({
              sender: {login: 'tobiu'}, pull_request: {user: {login, type}, base: {repo: {full_name: home}}, head: {repo: head && {full_name: head}}}
          }));

    eventOf('dependabot[bot]', 'Bot');
    result = judge(['--base', base, '--event', event], () => { throw new Error('Dependabot must not query npm') });
    assert.equal(result.code, 0, `Dependabot retains the published base version: ${result.text}`);
    assert.match(result.text, /validation only/);

    release('0.1.20');
    result = judge(['--base', base, '--event', event]);
    assert.equal(result.code, 1, 'Dependabot must not carry a package release');
    assert.match(result.text, /Dependabot must retain/);

    release('0.1.19');
    writeFileSync(join(repo, 'package-lock.json'), JSON.stringify({version: '0.1.18'}));
    result = judge(['--base', base, '--event', event]);
    assert.equal(result.code, 1, 'Dependabot still requires matching lock metadata');

    release('0.1.19');
    for (const [login, type] of [['neo-gpt', 'User'], ['another[bot]', 'Bot']]) {
        eventOf(login, type);
        assert.equal(judge(['--base', base, '--event', event]).code, 1, 'other authors still require a release');
    }
    release('0.1.20');
    eventOf('neo-gpt', 'User');
    assert.equal(judge(['--base', base, '--event', event]).code, 0, 'human rerun actor does not exempt a maintainer PR');

    // A fork branched at 0.1.19 while dev released 0.1.20 and 0.1.21. Its merge result carries dev's version.
    release('0.1.20');
    git('commit', '-qam', 'release 0.1.20');
    release('0.1.21');
    git('commit', '-qam', 'release 0.1.21');

    const moved = git('rev-parse', 'HEAD');

    eventOf('contributor', 'User', 'contributor/neo-agent-skills');
    result = judge(['--base', moved, '--event', event], () => { throw new Error('a fork must not query npm') });
    assert.equal(result.code, 0, `a fork that never touched the version passes over a base two releases ahead: ${result.text}`);
    assert.match(result.text, /a fork keeps 0\.1\.21/);

    release('0.1.22');
    result = judge(['--base', moved, '--event', event]);
    assert.equal(result.code, 1, 'a fork that changes the version fails');
    assert.match(result.text, /Restore 0\.1\.21 in package\.json and package-lock\.json/);

    release('0.1.21');
    eventOf('contributor', 'User', null);
    assert.equal(judge(['--base', moved, '--event', event]).code, 0, 'a deleted fork keeps the version too');

    writeFileSync(event, '{}');
    assert.equal(judge(['--base', base, '--event', event]).code, 1, 'missing PR metadata fails closed');
    assert.equal(judge(['--base', base, '--event', join(repo, 'missing.json')]).code, 1, 'unreadable event fails closed');

    result = judge([]);
    assert.equal(result.code, 2, 'a missing --base is a usage error, not a pass');
    assert.match(result.text, /--base <ref> is required/);

    result = judge(['--base', 'no-such-ref']);
    assert.equal(result.code, 1, 'a base git cannot read fails');
} finally {
    rmSync(repo, {recursive: true, force: true})
}

console.log('check-version-bump: the verdicts, the registry answers and the CLI against a real base passed');
