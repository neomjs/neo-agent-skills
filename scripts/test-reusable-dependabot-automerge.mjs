#!/usr/bin/env node
/**
 * @summary Contract checks for the reusable Dependabot auto-merge workflow and the decision it runs.
 *
 * Two halves. The decision's fixture events run the real `decideAutomergeEligibility`: a Dependabot update of
 * an allow-listed dependency is eligible; a lookalike author, a mixed-dependency update, a major bump and the
 * kill switch are not, each with its reason line. The workflow's contract is the semantic boundary YAML
 * syntax cannot carry: a `workflow_call` entrypoint, read-only by default, no secret, no
 * `pull_request_target`, no `github.actor`, the decision read from this workflow's own commit, and
 * auto-merge enabled only after the decision, with the caller's token. Each negative fixture removes one
 * property and must turn red.
 *
 * Run: `node scripts/test-reusable-dependabot-automerge.mjs`
 */

import assert          from 'node:assert/strict';
import {readFileSync}  from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {decideAutomergeEligibility} from './dependabot-automerge-eligibility.mjs';

const
    here         = dirname(fileURLToPath(import.meta.url)),
    workflowPath = join(here, '..', '.github', 'workflows', 'reusable-dependabot-automerge.yml'),
    ALLOW_LIST   = 'neo-agent-skills, neomjs/neo-agent-skills/.github/workflows/reusable-pr-baseline.yml',
    UPDATE_TYPES = 'patch, minor',
    BOT          = {author: 'dependabot[bot]', authorType: 'Bot', allowList: ALLOW_LIST, updateTypes: UPDATE_TYPES};

let mutationCount = 0;

// --- The decision ---------------------------------------------------------------------------------------

const decide = update => decideAutomergeEligibility({...BOT, ...update});

assert.deepEqual(decide({dependencyNames: 'neo-agent-skills', updateType: 'version-update:semver-patch'}),
    {eligible: true, reason: 'neo-agent-skills: a patch update by dependabot[bot]'});
assert.equal(decide({dependencyNames: 'neo-agent-skills', updateType: 'version-update:semver-minor'}).eligible, true);
assert.equal(decide({dependencyNames: 'neomjs/neo-agent-skills/.github/workflows/reusable-pr-baseline.yml', updateType: 'version-update:semver-minor'}).eligible, true,
    'the reusable workflow tag is the second allow-listed dependency');

for (const [label, update, reason] of [
    ['a lookalike author on a dependabot/ branch', {author: 'tobiu', authorType: 'User'}, 'not opened by dependabot[bot] (author: tobiu)'],
    ['the bot login on a non-Bot account',         {authorType: 'User'},                   'not opened by dependabot[bot]'],
    ['a second dependency outside the allow-list', {dependencyNames: 'neo-agent-skills, left-pad'}, 'dependencies outside the allow-list: left-pad'],
    ['a major bump',                               {updateType: 'version-update:semver-major'}, "update type 'version-update:semver-major' is not one of: patch, minor"],
    ['no update type',                             {updateType: ''},                       "update type 'none'"],
    ['no dependency',                              {dependencyNames: ''},                  'the update names no dependency'],
    ['the kill switch',                            {killSwitch: 'off'},                    'NEO_AUTOMERGE_SKILLS is off'],
    ['the kill switch, any case',                  {killSwitch: ' OFF '},                  'NEO_AUTOMERGE_SKILLS is off']
]) {
    const answer = decide({dependencyNames: 'neo-agent-skills', updateType: 'version-update:semver-patch', ...update});

    assert.equal(answer.eligible, false, `${label}: must not be eligible`);
    assert.ok(answer.reason.includes(reason), `${label}: expected a reason containing "${reason}", got "${answer.reason}"`)
}

assert.ok(!decide({author: 'x\neligible=true', authorType: 'User'}).reason.includes('\n'),
    'a reason is one line, so a newline in a login cannot write a second output');

// --- The workflow ---------------------------------------------------------------------------------------

/** @summary Isolates one top-level job so a sibling cannot satisfy its contract. */
function jobSource(source, jobId) {
    const marker = `  ${jobId}:\n`,
          start  = source.indexOf(marker);

    if (start === -1) return '';

    const after = source.slice(start + marker.length),
          next  = after.search(/^  [a-z0-9_-]+:\n/m);

    return marker + (next === -1 ? after : after.slice(0, next))
}

/**
 * @summary Returns named semantic-contract violations in one workflow source string.
 * @param {String} source
 * @returns {String[]}
 */
export function validateReusableDependabotAutomerge(source) {
    const failures    = [],
          eligibility = jobSource(source, 'eligibility'),
          enable      = jobSource(source, 'enable'),
          header      = source.slice(0, source.indexOf('\njobs:\n'));

    if (!/^on:\n  workflow_call:\n/m.test(source)) failures.push('missing workflow-call trigger');
    if (/pull_request_target/.test(source.replace(/^#.*$/gm, ''))) failures.push('pull_request_target present');
    if (/\$\{\{\s*secrets\./.test(source)) failures.push('secret referenced');
    if (/github\.actor/.test(source)) failures.push('github.actor used');
    if (!/^permissions:\n  contents: read\n/m.test(header)) failures.push('missing read-only default permissions');

    if (!eligibility) failures.push('missing eligibility job');
    if (/: write/.test(eligibility)) failures.push('eligibility holds a write permission');
    if (!eligibility.includes('repository: ${{ job.workflow_repository }}') || !eligibility.includes('ref: ${{ job.workflow_sha }}')) {
        failures.push("decision not read from this workflow's commit")
    }
    if (!eligibility.includes('sparse-checkout: scripts/dependabot-automerge-eligibility.mjs')) failures.push('decision checkout is not the decision alone');
    if (/head\.(sha|ref)|github\.head_ref/.test(source)) failures.push('pull request head referenced');
    if (!eligibility.includes('run: node .neo-agent-skills/scripts/dependabot-automerge-eligibility.mjs')) failures.push('decision not run');
    if (!eligibility.includes('AUTOMERGE_AUTHOR: ${{ github.event.pull_request.user.login }}') ||
        !eligibility.includes('AUTOMERGE_AUTHOR_TYPE: ${{ github.event.pull_request.user.type }}')) {
        failures.push('author not read from the pull request')
    }
    if (!eligibility.includes('AUTOMERGE_KILL_SWITCH: ${{ vars.NEO_AUTOMERGE_SKILLS }}')) failures.push('kill switch not read');

    if (!enable) failures.push('missing enable job');
    if (!enable.includes('needs: eligibility') || !enable.includes("if: needs.eligibility.outputs.eligible == 'true'")) {
        failures.push('enable not gated on the decision')
    }
    if (!/gh pr merge --auto /.test(enable)) failures.push('enable does not hand off to auto-merge');
    if (!enable.includes('GH_TOKEN: ${{ github.token }}')) failures.push("enable does not use the caller's token");

    return failures
}

/** @summary Asserts one fixture mutation changes the source and turns the named failure red. */
function expectMutationFailure(label, source, mutate, expectedFailure) {
    const mutated  = mutate(source),
          failures = validateReusableDependabotAutomerge(mutated);

    assert.notEqual(mutated, source, `${label}: fixture mutation changed nothing`);
    assert.ok(failures.includes(expectedFailure), `${label}: expected "${expectedFailure}", got ${failures.join(', ')}`);
    mutationCount++
}

const source = readFileSync(workflowPath, 'utf8');

assert.deepEqual(validateReusableDependabotAutomerge(source), [], 'canonical workflow violates its own contract');

expectMutationFailure('trigger', source, value => value.replace('  workflow_call:', '  pull_request:'), 'missing workflow-call trigger');
expectMutationFailure('pull_request_target', source, value => value.replace('  workflow_call:', '  pull_request_target:\n  workflow_call:'), 'pull_request_target present');
expectMutationFailure('secret', source, value => value.replace('GH_TOKEN: ${{ github.token }}', 'GH_TOKEN: ${{ secrets.AUTOMERGE_PAT }}'), 'secret referenced');
expectMutationFailure('github.actor', source,
    value => value.replace('AUTOMERGE_AUTHOR: ${{ github.event.pull_request.user.login }}', 'AUTOMERGE_AUTHOR: ${{ github.actor }}'), 'github.actor used');
expectMutationFailure('default permissions', source, value => value.replace('permissions:\n  contents: read\n', 'permissions:\n  contents: write\n'), 'missing read-only default permissions');
expectMutationFailure('eligibility writes', source,
    value => value.replace('    permissions:\n      contents: read\n      pull-requests: read', '    permissions:\n      contents: read\n      pull-requests: write'),
    'eligibility holds a write permission');
expectMutationFailure('decision from the caller', source, value => value.replace('ref: ${{ job.workflow_sha }}', 'ref: ${{ github.sha }}'),
    "decision not read from this workflow's commit");
expectMutationFailure('decision from the head', source,
    value => value.replace('ref: ${{ job.workflow_sha }}', 'ref: ${{ github.event.pull_request.head.sha }}'), 'pull request head referenced');
expectMutationFailure('whole-repository checkout', source,
    value => value.replace('sparse-checkout: scripts/dependabot-automerge-eligibility.mjs', 'sparse-checkout: scripts'), 'decision checkout is not the decision alone');
expectMutationFailure('decision skipped', source, value => value.replace('run: node .neo-agent-skills/scripts/dependabot-automerge-eligibility.mjs', 'run: echo eligible=true'), 'decision not run');
expectMutationFailure('author from elsewhere', source,
    value => value.replace('AUTOMERGE_AUTHOR_TYPE: ${{ github.event.pull_request.user.type }}', 'AUTOMERGE_AUTHOR_TYPE: Bot'), 'author not read from the pull request');
expectMutationFailure('kill switch dropped', source, value => value.replace('AUTOMERGE_KILL_SWITCH: ${{ vars.NEO_AUTOMERGE_SKILLS }}', 'AUTOMERGE_KILL_SWITCH: on'), 'kill switch not read');
expectMutationFailure('enable ungated', source, value => value.replace("    if: needs.eligibility.outputs.eligible == 'true'\n", ''), 'enable not gated on the decision');
expectMutationFailure('direct merge', source, value => value.replace('gh pr merge --auto ', 'gh pr merge '), 'enable does not hand off to auto-merge');
expectMutationFailure('eligibility removed', source, value => value.replace('  eligibility:\n', '  decision:\n'), 'missing eligibility job');

console.log(`reusable-dependabot-automerge: decision fixtures + canonical contract + ${mutationCount} negative mutations passed`);
