#!/usr/bin/env node
/** @summary Checks publication authority from merged PR receipts and the workflow boundaries that consume it. */

import assert                         from 'node:assert/strict';
import {readFileSync}                 from 'node:fs';
import {isDependabot, releaseOrigin, run} from './release-origin.mjs';

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

console.log('release-origin: author, exact merge provenance, failure and workflow boundaries passed');
