#!/usr/bin/env node
/** @summary Checks publication authority from merged PR receipts and the workflow boundaries that consume it. */

import assert                                             from 'node:assert/strict';
import {spawnSync}                                        from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir}                                           from 'node:os';
import {delimiter, join}                                  from 'node:path';
import {fileURLToPath}                                    from 'node:url';
import {isDependabot, releaseOrigin, run}                 from './release-origin.mjs';

const sha = 'a'.repeat(40), repository = 'neomjs/neo-agent-skills',
      context = {sha, repository},
      receipt = {number: 7, state: 'closed', merged_at: '2026-10-09T00:00:00Z', merge_commit_sha: sha,
          base: {ref: 'dev', repo: {full_name: repository}}, user: {login: 'neo-gpt', type: 'User'}},
      bot = {...receipt, user: {login: 'dependabot[bot]', type: 'Bot'}, merged_by: {login: 'tobiu', type: 'User'}};

assert.equal(isDependabot(bot), true);
assert.equal(isDependabot({...receipt, user: {login: 'other[bot]', type: 'Bot'}}), false, 'no exception for other bots');
assert.throws(() => isDependabot({...bot, user: {...bot.user, type: 'User'}}), /inconsistent/);
assert.throws(() => isDependabot({...receipt, user: null}), /unavailable/);
assert.deepEqual(releaseOrigin([receipt], context), {publish: true, prNumber: 7});
assert.deepEqual(releaseOrigin([bot], context), {publish: false, prNumber: 7}, 'a human merging Dependabot never grants release');
assert.deepEqual(releaseOrigin([{...receipt, head: {ref: 'dependabot/lookalike'}, title: 'Dependabot update'}], context),
    {publish: true, prNumber: 7}, 'branch names and titles cannot grant the exception');

for (const candidate of [
    {...receipt, merged_at: null}, {...receipt, state: 'open'}, {...receipt, merge_commit_sha: 'b'.repeat(40)},
    {...receipt, base: {...receipt.base, ref: 'main'}},
    {...receipt, base: {...receipt.base, repo: {full_name: 'other/repository'}}}
]) assert.throws(() => releaseOrigin([candidate], context), /expected one exact merged PR/);

assert.throws(() => releaseOrigin([], context), /found 0/);
assert.throws(() => releaseOrigin([receipt, bot], context), /found 2/, 'ambiguity never chooses an author');
assert.throws(() => releaseOrigin([receipt], {...context, sha: 'HEAD'}), /exact SHA/);
assert.throws(() => releaseOrigin([receipt], {...context, repository: undefined}), /repository/);

const invoke = input => {
    const outputs = [], errors = [],
          code = run(['--sha', sha, '--repository', repository], {input, out: line => outputs.push(line), error: line => errors.push(line)});

    return {code, outputs, errors}
};

assert.deepEqual(invoke(() => JSON.stringify([[bot]])).outputs, ['publish=false']);
assert.deepEqual(invoke(() => JSON.stringify([[], [receipt]])).outputs, ['publish=true'], 'paginated receipts reach the classifier');
for (const input of [() => '{broken', () => JSON.stringify([]), () => { throw new Error('API failed') }]) {
    const result = invoke(input);
    assert.equal(result.code, 1);
    assert.deepEqual(result.outputs, [], 'unavailable provenance emits no publication permission');
}

const workflow = readFileSync(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8'),
      corpus = readFileSync(new URL('../.github/workflows/skill-corpus.yml', import.meta.url), 'utf8');

assert.match(workflow, /gh api --paginate --slurp.*GITHUB_SHA/);
assert.match(workflow, /node scripts\/release-origin\.mjs --sha "\$GITHUB_SHA" --repository "\$GITHUB_REPOSITORY"/);
assert.match(workflow, /needs: \[origin, test\]/);
assert.match(workflow, /if: \$\{\{ needs\.origin\.outputs\.publish == 'true' \}\}/);
assert.doesNotMatch(workflow, /^concurrency:/m, 'a bot-only workflow never occupies the release queue');
assert.match(workflow, /  publish:[\s\S]*?    concurrency:\n      group: publish\n      cancel-in-progress: false\n      queue: max/,
    'the gated publisher serializes all pending releases without replacing one');
assert.doesNotMatch(workflow, /github\.actor/, 'human merge/rerun actors cannot choose release policy');
assert.match(corpus, /check-version-bump\.mjs --base "\$\{BASE_SHA\}" --event "\$GITHUB_EVENT_PATH"/);
assert.match(corpus, /run: node scripts\/test-release-origin\.mjs/);
assert.match(workflow, /run: npm test/, 'post-merge validation still runs for Dependabot');

// The origin step's own run block, under bash with stub `gh` and `sleep` on PATH: GitHub links a merge commit to its
// PR asynchronously, so the step must read again rather than skip a release whose receipt is a few seconds late.
const originStep = (/- name: Classify the exact merged PR\n[\s\S]*?\n {8}run: \|\n((?: {10}.*\n)+)/.exec(workflow)?.[1] ?? '')
    .replace(/^ {10}/gm, '');

assert.ok(originStep.includes('release-origin.mjs'), 'the origin step\'s run block was found');

const stubDir  = mkdtempSync(join(tmpdir(), 'release-origin-')),
      repoRoot = fileURLToPath(new URL('..', import.meta.url)),
      origin   = (emptyReads, author = receipt) => {
          const output = join(stubDir, 'output'), calls = join(stubDir, 'calls');

          writeFileSync(output, '');
          writeFileSync(calls, '');

          const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', originStep], {cwd: repoRoot, encoding: 'utf8', env: {
              ...process.env,
              PATH             : `${stubDir}${delimiter}${process.env.PATH}`,
              GITHUB_OUTPUT    : output,
              GITHUB_REPOSITORY: repository,
              GITHUB_SHA       : sha,
              STUB_CALLS       : calls,
              STUB_EMPTY_READS : String(emptyReads),
              STUB_RECEIPT     : JSON.stringify([[author]])
          }});

          return {code: result.status, output: readFileSync(output, 'utf8'), reads: readFileSync(calls, 'utf8').length}
      };

try {
    writeFileSync(join(stubDir, 'gh.cjs'), `const fs = require('node:fs');
fs.appendFileSync(process.env.STUB_CALLS, '.');
const reads = fs.readFileSync(process.env.STUB_CALLS, 'utf8').length;
process.stdout.write(reads > Number(process.env.STUB_EMPTY_READS) ? process.env.STUB_RECEIPT : '[[]]');
`);
    writeFileSync(join(stubDir, 'gh'), `#!/bin/sh\nexec "${process.execPath}" "$(dirname "$0")/gh.cjs" "$@"\n`, {mode: 0o755});
    writeFileSync(join(stubDir, 'sleep'), '#!/bin/sh\nexit 0\n', {mode: 0o755});

    assert.deepEqual(origin(0), {code: 0, output: 'publish=true\n', reads: 1}, 'an indexed receipt publishes at once');
    assert.deepEqual(origin(2), {code: 0, output: 'publish=true\n', reads: 3}, 'a receipt that appears on the third read still publishes');
    assert.deepEqual(origin(Infinity), {code: 1, output: '', reads: 6}, 'a receipt that never appears fails closed after six reads');
    assert.deepEqual(origin(1, bot), {code: 0, output: 'publish=false\n', reads: 2}, 'a late Dependabot receipt still grants no release')
} finally {
    rmSync(stubDir, {recursive: true, force: true})
}

console.log('release-origin: author, exact merge provenance, failure, workflow boundaries and the late-receipt retry passed');
