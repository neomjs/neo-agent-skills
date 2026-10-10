#!/usr/bin/env node
/**
 * @summary Contract checks for the reusable Dependabot auto-merge workflow and the two scripts it runs.
 *
 * Three parts. The decision's fixture events run the real `decideAutomergeEligibility`. Under the workflow's own
 * defaults, read from its source, any Dependabot pull request is eligible, majors and unparsed updates included.
 * Under a caller's lists, a dependency or update type outside them is refused. A lookalike author, another
 * account's push and the kill switch are refused either way, each with its reason line, and only a Dependabot pull
 * request is disarmed.
 * The handoff's controls run the real `handOff` against a recorded `gh`: it arms, bound to the admitted head, only
 * when the live reads show auto-merge on and a required check; a missing, empty, unreadable or malformed read, or a
 * moved head, mutates nothing. Its command line does the same through a stub `gh` on PATH. The workflow's contract
 * is the semantic boundary YAML syntax cannot carry; each negative fixture removes one property and must turn red.
 *
 * Run: `node scripts/test-reusable-dependabot-automerge.mjs`
 */

import assert                                                   from 'node:assert/strict';
import {spawnSync}                                              from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync}       from 'node:fs';
import {tmpdir}                                                 from 'node:os';
import {delimiter, dirname, join}                               from 'node:path';
import {fileURLToPath}                                          from 'node:url';

import {decideAutomergeEligibility} from './dependabot-automerge-eligibility.mjs';
import {handOff}                    from './dependabot-automerge-handoff.mjs';

const
    here         = dirname(fileURLToPath(import.meta.url)),
    workflowPath = join(here, '..', '.github', 'workflows', 'reusable-dependabot-automerge.yml'),
    handoffPath  = join(here, 'dependabot-automerge-handoff.mjs'),
    ALLOW_LIST   = 'neo-agent-skills, neomjs/neo-agent-skills/.github/workflows/reusable-pr-baseline.yml',
    UPDATE_TYPES = 'patch, minor',
    BOT          = {author: 'dependabot[bot]', authorType: 'Bot', sender: 'dependabot[bot]', allowList: ALLOW_LIST, updateTypes: UPDATE_TYPES};

let mutationCount = 0;

// --- The decision ---------------------------------------------------------------------------------------

const decide = update => decideAutomergeEligibility({...BOT, dependencyNames: 'neo-agent-skills', updateType: 'version-update:semver-patch', ...update});

assert.deepEqual(decide({}), {eligible: true, disarm: false, reason: 'neo-agent-skills: a patch update by dependabot[bot]'});
assert.equal(decide({updateType: 'version-update:semver-minor'}).eligible, true);
assert.equal(decide({dependencyNames: 'neomjs/neo-agent-skills/.github/workflows/reusable-pr-baseline.yml', updateType: 'version-update:semver-minor'}).eligible, true,
    'the reusable workflow tag is the second allow-listed dependency');

for (const [label, update, reason, disarm] of [
    ['a lookalike author on a dependabot/ branch', {author: 'tobiu', authorType: 'User'},              'not opened by dependabot[bot] (author: tobiu)', false],
    ['the bot login on a non-Bot account',         {authorType: 'User'},                                'not opened by dependabot[bot]', false],
    ['another account pushed to the update',       {sender: 'neo-opus-grace'},                          'sent by neo-opus-grace, not dependabot[bot]', true],
    ['no sender',                                  {sender: ''},                                        'sent by unknown', true],
    ['a second dependency outside the allow-list', {dependencyNames: 'neo-agent-skills, left-pad'},     'dependencies outside the allow-list: left-pad', true],
    ['a major bump',                               {updateType: 'version-update:semver-major'},         "update type 'version-update:semver-major' is not one of: patch, minor", true],
    ['no update type',                             {updateType: ''},                                    "update type 'none'", true],
    ['no dependency',                              {dependencyNames: ''},                               'the update names no dependency', true],
    ['the kill switch',                            {killSwitch: 'off'},                                 'NEO_AUTOMERGE_DEPENDABOT is off', true],
    ['the kill switch, any case',                  {killSwitch: ' OFF '},                               'NEO_AUTOMERGE_DEPENDABOT is off', true],
    ["the kill switch on a person's pull request", {killSwitch: 'off', author: 'tobiu', authorType: 'User'}, 'NEO_AUTOMERGE_DEPENDABOT is off', false],
    ['another account pushed, under `*`',          {allowList: '*', updateTypes: '*', sender: 'neo-opus-grace'}, 'sent by neo-opus-grace', true],
    ['the kill switch, under `*`',                 {allowList: '*', updateTypes: '*', killSwitch: 'off'}, 'NEO_AUTOMERGE_DEPENDABOT is off', true]
]) {
    const answer = decide(update);

    assert.equal(answer.eligible, false, `${label}: must not be eligible`);
    assert.equal(answer.disarm, disarm, `${label}: disarm must be ${disarm}`);
    assert.ok(answer.reason.includes(reason), `${label}: expected a reason containing "${reason}", got "${answer.reason}"`)
}

assert.ok(!decide({author: 'x\neligible=true', authorType: 'User'}).reason.includes('\n'),
    'a reason is one line, so a newline in a login cannot write a second output');

// The workflow's own defaults, read from its source, so a narrowed default turns these arms red
const defaults = Object.fromEntries([...readFileSync(workflowPath, 'utf8')
    .matchAll(/^ {6}(dependency_allow_list|update_types):\n(?: {8}.*\n)*? {8}default: '?([^'\n]*)'?\n/gm)]
    .map(([, input, value]) => [input, value]));

assert.deepEqual(defaults, {dependency_allow_list: '*', update_types: '*'}, 'both list inputs default to every update');

for (const [label, update] of [
    ['a dependency no list names', {dependencyNames: 'left-pad, webpack'}],
    ['a major bump',               {updateType: 'version-update:semver-major'}],
    ['an update with no metadata', {dependencyNames: '', updateType: ''}]
]) {
    const answer = decide({allowList: defaults.dependency_allow_list, updateTypes: defaults.update_types, ...update});

    assert.equal(answer.eligible, true, `${label}, under the defaults: ${answer.reason}`)
}

// --- The handoff ----------------------------------------------------------------------------------------

const
    ADMITTED = 'a'.repeat(40),
    MOVED    = 'b'.repeat(40),
    REPO     = 'neomjs/example',
    TARGET   = ['pr', 'merge', '42', '--repo', REPO],
    REQUIRED = [{type: 'required_status_checks', parameters: {required_status_checks: [{context: 'corpus'}]}}],
    ARM      = {repository: REPO, number: '42', admittedHead: ADMITTED, eligible: 'true', disarm: 'false', mergeMethod: 'squash'},
    DISARM   = {...ARM, eligible: 'false', disarm: 'true'};

/**
 * @summary A `gh` that answers the handoff's two reads from a fixture and records every call.
 * @param {Object} [fixture]
 * @returns {{gh: Function, calls: String[][], mutations: Function}}
 */
function recordedGh({allowed = true, head = ADMITTED, armedBy = null, rules = REQUIRED, repositoryAnswer, rulesAnswer, unreadable, mutationRefusal} = {}) {
    const calls = [];

    const gh = args => {
        calls.push(args);

        if (args[0] === 'pr') {
            if (mutationRefusal) throw Object.assign(new Error('Command failed: gh pr merge'), {stderr: mutationRefusal});
            return ''
        }

        const which = args[1] === 'graphql' ? 'repository' : 'rules';

        if (unreadable === which) throw Object.assign(new Error('Command failed: gh api'), {stderr: 'HTTP 403: Resource not accessible by integration'});

        return which === 'rules' ? rulesAnswer ?? JSON.stringify(rules) : repositoryAnswer ?? JSON.stringify({data: {repository: {
            autoMergeAllowed: allowed,
            pullRequest     : {headRefOid: head, baseRefName: 'dev', autoMergeRequest: armedBy && {enabledBy: {login: armedBy}}}
        }}})
    };

    return {gh, calls, mutations: () => calls.filter(args => args[0] === 'pr')}
}

{
    const run = recordedGh();

    assert.match(handOff({...ARM, gh: run.gh}), /^Armed at a{40}: GitHub merges once 1 required checks pass on dev\.$/);
    assert.deepEqual(run.mutations(), [[...TARGET, '--auto', '--squash', '--match-head-commit', ADMITTED]],
        'the configured positive control arms once, bound to the admitted head');
    assert.ok(run.calls.some(args => args[1] === `repos/${REPO}/rules/branches/dev?per_page=100`), "the rules are read for the pull request's base branch")
}

for (const [label, fixture, options, message] of [
    ['auto-merge off',                     {allowed: false},                                                ARM, '"Allow auto-merge" is off in neomjs/example'],
    ['no rules on the base branch',        {rules: []},                                                     ARM, 'dev requires no status check'],
    ['rules without a required check',     {rules: [{type: 'deletion'}]},                                   ARM, 'dev requires no status check'],
    ['a required-check rule naming none',  {rules: [{type: 'required_status_checks', parameters: {required_status_checks: []}}]}, ARM, 'dev requires no status check'],
    ['the repository unreadable',          {unreadable: 'repository'},                                      ARM, 'could not read the repository and pull request: HTTP 403'],
    ['the rules unreadable',               {unreadable: 'rules'},                                           ARM, 'could not read the rules of dev: HTTP 403'],
    ['the repository answer is not JSON',  {repositoryAnswer: '<html>'},                                    ARM, 'the answer is not JSON'],
    ['the repository answer is malformed', {repositoryAnswer: JSON.stringify({data: {repository: null}})}, ARM, 'read is malformed'],
    ['the rules answer is malformed',      {rulesAnswer: JSON.stringify({message: 'Not Found'})},          ARM, 'the rules of dev are malformed'],
    ['the head moved after admission',     {head: MOVED},                                                   ARM, `the head moved from the admitted ${ADMITTED} to ${MOVED}`],
    ['an unknown merge method',            {}, {...ARM, mergeMethod: 'fast-forward'},                            "merge_method 'fast-forward'"],
    ['an admitted head that is no SHA',    {}, {...ARM, admittedHead: 'main'},                                   "admitted head 'main'"],
    ['neither admitted nor disarmed',      {}, {...ARM, eligible: 'false'},                                      'neither admitted nor disarmed']
]) {
    const run = recordedGh(fixture);

    assert.throws(() => handOff({...options, gh: run.gh}), error => error.message.includes(message), `${label}: expected a refusal containing "${message}"`);
    assert.deepEqual(run.mutations(), [], `${label}: must mutate nothing`)
}

{
    const run = recordedGh({mutationRefusal: 'GraphQL: Head branch was modified. Review and try the merge again.'});

    assert.throws(() => handOff({...ARM, gh: run.gh}), error => error.stderr.includes('Head branch was modified'),
        "GitHub's refusal of a head that moved after the read is not swallowed")
}

for (const [label, fixture, mutations, line] of [
    ['armed by this workflow',                  {armedBy: 'github-actions'},                              [[...TARGET, '--disable-auto']], 'Took back'],
    ['armed by this workflow, as REST names it', {armedBy: 'github-actions[bot]'},                        [[...TARGET, '--disable-auto']], 'Took back'],
    ['armed by this workflow, setting now off', {armedBy: 'github-actions', allowed: false, rules: []}, [[...TARGET, '--disable-auto']], 'Took back'],
    ['armed by a person',                       {armedBy: 'tobiu'},                                       [], 'Armed by tobiu, not by this workflow: left alone.'],
    ['not armed',                               {},                                                       [], 'Not armed: nothing to take back.']
]) {
    const run = recordedGh(fixture);

    assert.ok(handOff({...DISARM, gh: run.gh}).includes(line), `${label}: expected "${line}"`);
    assert.deepEqual(run.mutations(), mutations, `${label}: unexpected mutations`);
    assert.ok(!run.calls.some(args => args[1]?.startsWith('repos/')), `${label}: taking back reads no admission rules`)
}

// --- The handoff's command line, through a stub `gh` on PATH ----------------------------------------------

const stubDir = mkdtempSync(join(tmpdir(), 'automerge-gh-'));

try {
    const log = join(stubDir, 'calls.jsonl');

    writeFileSync(join(stubDir, 'gh.cjs'), `const {appendFileSync} = require('node:fs');
const args = process.argv.slice(2), plan = JSON.parse(process.env.STUB_GH_PLAN);
appendFileSync(process.env.STUB_GH_LOG, JSON.stringify(args) + '\\n');
const answer = args[0] === 'pr' ? '' : plan[args[1] === 'graphql' ? 'repository' : 'rules'];
if (answer === 'unreadable') { process.stderr.write('HTTP 403: Resource not accessible by integration\\n'); process.exit(1) }
process.stdout.write(typeof answer === 'string' ? answer : JSON.stringify(answer));
`);
    writeFileSync(join(stubDir, 'gh'), `#!/bin/sh\nexec "${process.execPath}" "$(dirname "$0")/gh.cjs" "$@"\n`, {mode: 0o755});

    const cli = plan => {
        writeFileSync(log, '');

        const result = spawnSync(process.execPath, [handoffPath], {encoding: 'utf8', env: {
            ...process.env,
            PATH                   : `${stubDir}${delimiter}${process.env.PATH}`,
            STUB_GH_LOG            : log,
            STUB_GH_PLAN           : JSON.stringify(plan),
            AUTOMERGE_REPOSITORY   : REPO,
            AUTOMERGE_PR_NUMBER    : '42',
            AUTOMERGE_ADMITTED_HEAD: ADMITTED,
            AUTOMERGE_ELIGIBLE     : 'true',
            AUTOMERGE_DISARM       : 'false',
            AUTOMERGE_MERGE_METHOD : 'squash'
        }});

        return {...result, calls: readFileSync(log, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line))}
    };

    const
        repository = {data: {repository: {autoMergeAllowed: true, pullRequest: {headRefOid: ADMITTED, baseRefName: 'dev', autoMergeRequest: null}}}},
        refused    = cli({repository: 'unreadable', rules: REQUIRED}),
        armed      = cli({repository, rules: REQUIRED});

    assert.equal(refused.status, 1, 'an unreadable repository exits 1');
    assert.match(refused.stderr, /^::error::could not read the repository and pull request: HTTP 403/m);
    assert.ok(refused.calls.length > 0 && !refused.calls.some(args => args[0] === 'pr'), 'the refused command line read through the stub and mutated nothing');

    assert.equal(armed.status, 0, `the configured command line exits 0: ${armed.stderr}`);
    assert.deepEqual(armed.calls.at(-1), [...TARGET, '--auto', '--squash', '--match-head-commit', ADMITTED])
} finally {
    rmSync(stubDir, {recursive: true, force: true})
}

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
          handoff     = jobSource(source, 'handoff'),
          header      = source.slice(0, source.indexOf('\njobs:\n')),
          checkouts   = source.split(/\n(?= {6}- )/).filter(step => step.includes('uses: actions/checkout@')),
          runs        = source.split('\n').filter(line => /^\s+(- )?run:/.test(line));

    if (!/^on:\n  workflow_call:\n/m.test(source)) failures.push('missing workflow-call trigger');
    if (/pull_request_target/.test(source.replace(/^#.*$/gm, ''))) failures.push('pull_request_target present');
    if (/\$\{\{\s*secrets\./.test(source)) failures.push('secret referenced');
    if (/github\.actor/.test(source)) failures.push('github.actor used');
    if (!/^permissions:\n  contents: read\n/m.test(header)) failures.push('missing read-only default permissions');

    // Head identifiers may travel as data; only this workflow's own commit is ever checked out or executed
    if (checkouts.some(step => !step.includes('repository: ${{ job.workflow_repository }}') || !step.includes('ref: ${{ job.workflow_sha }}'))) {
        failures.push("a checkout is not this workflow's own commit")
    }
    if (runs.some(line => !/^\s+(- )?run: node \.neo-agent-skills\/scripts\/dependabot-automerge-(eligibility|handoff)\.mjs$/.test(line))) {
        failures.push('a run command is not one of the two scripts')
    }

    if (!eligibility) failures.push('missing eligibility job');
    if (/: write/.test(eligibility)) failures.push('eligibility holds a write permission');
    if (!eligibility.includes('sparse-checkout: scripts/dependabot-automerge-eligibility.mjs')) failures.push('decision checkout is not the decision alone');
    if (!eligibility.includes('run: node .neo-agent-skills/scripts/dependabot-automerge-eligibility.mjs')) failures.push('decision not run');
    if (!eligibility.includes('AUTOMERGE_AUTHOR: ${{ github.event.pull_request.user.login }}') ||
        !eligibility.includes('AUTOMERGE_AUTHOR_TYPE: ${{ github.event.pull_request.user.type }}')) {
        failures.push('author not read from the pull request')
    }
    if (!eligibility.includes('AUTOMERGE_SENDER: ${{ github.event.sender.login }}')) failures.push('sender not read from the event');
    if (!eligibility.includes("if: github.event.pull_request.user.login == 'dependabot[bot]' && github.event.sender.login == 'dependabot[bot]'")) {
        failures.push("metadata read on another account's event")
    }
    if (!eligibility.includes('        continue-on-error: true\n        uses: dependabot/fetch-metadata@v2')) failures.push('a failed metadata read fails the job');
    if (!eligibility.includes('AUTOMERGE_KILL_SWITCH: ${{ vars.NEO_AUTOMERGE_DEPENDABOT }}')) failures.push('kill switch not read');

    if (!handoff) failures.push('missing handoff job');
    if (!handoff.includes('needs: eligibility') ||
        !handoff.includes("if: needs.eligibility.outputs.eligible == 'true' || needs.eligibility.outputs.disarm == 'true'")) {
        failures.push('handoff not gated on the decision')
    }
    if (!handoff.includes('sparse-checkout: scripts/dependabot-automerge-handoff.mjs')) failures.push('handoff checkout is not the handoff alone');
    if (!handoff.includes('run: node .neo-agent-skills/scripts/dependabot-automerge-handoff.mjs')) failures.push('handoff not run');
    if (!handoff.includes('GH_TOKEN: ${{ github.token }}')) failures.push("handoff does not use the caller's token");
    if (!eligibility.includes('head: ${{ github.event.pull_request.head.sha }}') ||
        !handoff.includes('AUTOMERGE_ADMITTED_HEAD: ${{ needs.eligibility.outputs.head }}')) {
        failures.push('handoff not bound to the admitted head')
    }
    if (!eligibility.includes('disarm: ${{ steps.decide.outputs.disarm }}') ||
        !handoff.includes('AUTOMERGE_ELIGIBLE: ${{ needs.eligibility.outputs.eligible }}') ||
        !handoff.includes('AUTOMERGE_DISARM: ${{ needs.eligibility.outputs.disarm }}')) {
        failures.push('handoff does not carry the decision')
    }

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

/** @summary Replaces the first `from` inside one job only. */
const inJob = (jobId, from, to) => value => {
    const job = jobSource(value, jobId);

    return value.replace(job, () => job.replace(from, () => to))
};

const source = readFileSync(workflowPath, 'utf8');

assert.deepEqual(validateReusableDependabotAutomerge(source), [], 'canonical workflow violates its own contract');

expectMutationFailure('trigger', source, value => value.replace('  workflow_call:', '  pull_request:'), 'missing workflow-call trigger');
expectMutationFailure('pull_request_target', source, value => value.replace('  workflow_call:', '  pull_request_target:\n  workflow_call:'), 'pull_request_target present');
expectMutationFailure('secret', source, value => value.replace('GH_TOKEN: ${{ github.token }}', 'GH_TOKEN: ${{ secrets.AUTOMERGE_PAT }}'), 'secret referenced');
expectMutationFailure('github.actor', source,
    value => value.replace('AUTOMERGE_SENDER: ${{ github.event.sender.login }}', 'AUTOMERGE_SENDER: ${{ github.actor }}'), 'github.actor used');
expectMutationFailure('default permissions', source, value => value.replace('permissions:\n  contents: read\n', 'permissions:\n  contents: write\n'), 'missing read-only default permissions');
expectMutationFailure('eligibility writes', source,
    inJob('eligibility', '    permissions:\n      contents: read\n      pull-requests: read', '    permissions:\n      contents: read\n      pull-requests: write'),
    'eligibility holds a write permission');
expectMutationFailure('decision from the caller', source, inJob('eligibility', 'ref: ${{ job.workflow_sha }}', 'ref: ${{ github.sha }}'),
    "a checkout is not this workflow's own commit");
expectMutationFailure('handoff from the head', source, inJob('handoff', 'ref: ${{ job.workflow_sha }}', 'ref: ${{ github.event.pull_request.head.sha }}'),
    "a checkout is not this workflow's own commit");
expectMutationFailure('handoff from the caller repository', source,
    inJob('handoff', 'repository: ${{ job.workflow_repository }}', 'repository: ${{ github.repository }}'), "a checkout is not this workflow's own commit");
expectMutationFailure('whole-repository decision checkout', source,
    value => value.replace('sparse-checkout: scripts/dependabot-automerge-eligibility.mjs', 'sparse-checkout: scripts'), 'decision checkout is not the decision alone');
expectMutationFailure('whole-repository handoff checkout', source,
    value => value.replace('sparse-checkout: scripts/dependabot-automerge-handoff.mjs', 'sparse-checkout: scripts'), 'handoff checkout is not the handoff alone');
expectMutationFailure('decision skipped', source,
    value => value.replace('run: node .neo-agent-skills/scripts/dependabot-automerge-eligibility.mjs', 'run: echo eligible=true'), 'decision not run');
expectMutationFailure('a head expression executed', source,
    value => value.replace('run: node .neo-agent-skills/scripts/dependabot-automerge-handoff.mjs', 'run: node .neo-agent-skills/scripts/dependabot-automerge-handoff.mjs ${{ github.head_ref }}'),
    'a run command is not one of the two scripts');
expectMutationFailure('a raw merge beside the handoff', source,
    value => `${value}\n      - run: gh pr merge --auto --squash "$PR_URL"\n`, 'a run command is not one of the two scripts');
expectMutationFailure('author from elsewhere', source,
    value => value.replace('AUTOMERGE_AUTHOR_TYPE: ${{ github.event.pull_request.user.type }}', 'AUTOMERGE_AUTHOR_TYPE: Bot'), 'author not read from the pull request');
expectMutationFailure('sender dropped', source,
    value => value.replace('AUTOMERGE_SENDER: ${{ github.event.sender.login }}', "AUTOMERGE_SENDER: dependabot[bot]"), 'sender not read from the event');
expectMutationFailure('metadata on every event', source,
    value => value.replace(" && github.event.sender.login == 'dependabot[bot]'", ''), "metadata read on another account's event");
expectMutationFailure('kill switch dropped', source, value => value.replace('AUTOMERGE_KILL_SWITCH: ${{ vars.NEO_AUTOMERGE_DEPENDABOT }}', 'AUTOMERGE_KILL_SWITCH: on'), 'kill switch not read');
expectMutationFailure('kill switch under its old name', source,
    value => value.replace('vars.NEO_AUTOMERGE_DEPENDABOT', 'vars.NEO_AUTOMERGE_SKILLS'), 'kill switch not read');
expectMutationFailure('metadata failure fails the job', source, value => value.replace('        continue-on-error: true\n', ''), 'a failed metadata read fails the job');
expectMutationFailure('handoff ungated', source,
    value => value.replace("    if: needs.eligibility.outputs.eligible == 'true' || needs.eligibility.outputs.disarm == 'true'\n", ''), 'handoff not gated on the decision');
expectMutationFailure('handoff skipped', source,
    value => value.replace('run: node .neo-agent-skills/scripts/dependabot-automerge-handoff.mjs', 'run: node .neo-agent-skills/scripts/dependabot-automerge-eligibility.mjs'), 'handoff not run');
expectMutationFailure("handoff without the caller's token", source, value => value.replace('          GH_TOKEN: ${{ github.token }}\n', ''), "handoff does not use the caller's token");
expectMutationFailure('head unbound', source,
    value => value.replace('AUTOMERGE_ADMITTED_HEAD: ${{ needs.eligibility.outputs.head }}', "AUTOMERGE_ADMITTED_HEAD: ''"), 'handoff not bound to the admitted head');
expectMutationFailure('disarm dropped', source, value => value.replace('          AUTOMERGE_DISARM: ${{ needs.eligibility.outputs.disarm }}\n', ''), 'handoff does not carry the decision');
expectMutationFailure('eligibility removed', source, value => value.replace('  eligibility:\n', '  decision:\n'), 'missing eligibility job');
expectMutationFailure('handoff removed', source, value => value.replace('  handoff:\n', '  enable:\n'), 'missing handoff job');

console.log(`reusable-dependabot-automerge: decision fixtures + handoff controls + command line + canonical contract + ${mutationCount} negative mutations passed`);
