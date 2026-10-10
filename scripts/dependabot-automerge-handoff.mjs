#!/usr/bin/env node
/**
 * @summary Hands an admitted Dependabot pull request to GitHub's auto-merge, or takes back the arming this workflow
 * made, after reading the repository's live configuration.
 *
 * `reusable-dependabot-automerge.yml` runs this file from its own commit, after the eligibility decision. Arming needs,
 * read before any mutation:
 * - "Allow auto-merge" on (GraphQL `autoMergeAllowed`: REST omits the setting below write access);
 * - at least one required status check in the active rulesets of the pull request's base branch;
 * - the pull request's head still the commit the decision admitted.
 *
 * Without required checks GitHub would merge at once, so their absence refuses rather than arms. The mutation carries
 * `--match-head-commit`, so GitHub refuses a head that moved after the read. A missing, empty, unreadable or malformed
 * read throws, and nothing is armed. Branch protection outside rulesets is not read: a repository relying on it alone
 * is refused.
 *
 * Disarming takes back auto-merge only when this workflow's token armed it; an arming by a person stays.
 *
 * Run (from the workflow): `GH_TOKEN` and `AUTOMERGE_*` environment in. A refusal exits 1 with an `::error::` line.
 */

import {execFileSync}  from 'node:child_process';
import {realpathSync}  from 'node:fs';
import {fileURLToPath} from 'node:url';

const
    MERGE_METHODS  = ['squash', 'merge', 'rebase'],
    // GraphQL names the token's app without the `[bot]` suffix REST appends
    WORKFLOW_TOKEN = ['github-actions', 'github-actions[bot]'],
    // One query, so the setting, the head and the arming describe the same moment
    QUERY          = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    autoMergeAllowed
    pullRequest(number: $number) { headRefOid baseRefName autoMergeRequest { enabledBy { login } } }
  }
}`;

/** @summary The first line of a failure: a `gh` error's stderr, or a refusal's message. @param {Error} error @returns {String} */
const firstLine = error => String(error.stderr || error.message || error).trim().split('\n')[0];

/** @summary Throws a refusal; the step goes red and nothing is armed. @param {String} message */
function refuse(message) {
    throw new Error(message)
}

/**
 * @summary Runs one `gh` read and parses its JSON, refusing when the read fails or does not parse.
 * @param {Function} gh
 * @param {String}   label
 * @param {String[]} args
 * @returns {*}
 */
function read(gh, label, args) {
    let text;

    try {
        text = gh(args)
    } catch (error) {
        refuse(`could not read ${label}: ${firstLine(error)}`)
    }

    try {
        return JSON.parse(text)
    } catch {
        refuse(`${label}: the answer is not JSON`)
    }
}

/**
 * @summary Arms or disarms GitHub's auto-merge for one pull request, and says what it did.
 * @param {Object}   options
 * @param {Function} options.gh           Runs `gh` with an argument array and returns stdout; throws when it fails.
 * @param {String}   options.repository   `owner/name`.
 * @param {String}   options.number       The pull request number.
 * @param {String}   options.admittedHead The head commit the decision admitted.
 * @param {String}   options.eligible     `'true'` when the decision admitted the pull request.
 * @param {String}   options.disarm       `'true'` when the decision takes back an earlier arming.
 * @param {String}   [options.mergeMethod] `squash`, `merge` or `rebase`.
 * @returns {String} One line for the log.
 */
export function handOff({gh, repository, number, admittedHead, eligible, disarm, mergeMethod}) {
    const arm = eligible === 'true';

    if (!arm && disarm !== 'true') refuse('the decision neither admitted nor disarmed this pull request');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) refuse(`repository '${repository}' is not owner/name`);
    if (!/^[1-9]\d*$/.test(number ?? '')) refuse(`pull request number '${number}' is not a number`);
    if (arm && !/^[0-9a-f]{40}$/.test(admittedHead ?? '')) refuse(`admitted head '${admittedHead}' is not a commit SHA`);
    if (arm && !MERGE_METHODS.includes(mergeMethod)) refuse(`merge_method '${mergeMethod}' is not one of: ${MERGE_METHODS.join(', ')}`);

    const
        [owner, name] = repository.split('/'),
        target        = ['pr', 'merge', number, '--repo', repository],
        repo          = read(gh, 'the repository and pull request',
            ['api', 'graphql', '-f', `query=${QUERY}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `number=${number}`])?.data?.repository,
        pr            = repo?.pullRequest;

    if (typeof repo?.autoMergeAllowed !== 'boolean' || typeof pr?.headRefOid !== 'string' || typeof pr?.baseRefName !== 'string') {
        refuse('the repository and pull request read is malformed')
    }

    if (!arm) {
        const armedBy = pr.autoMergeRequest?.enabledBy?.login;

        if (!pr.autoMergeRequest) return 'Not armed: nothing to take back.';
        if (!WORKFLOW_TOKEN.includes(armedBy)) return `Armed by ${armedBy || 'unknown'}, not by this workflow: left alone.`;

        gh([...target, '--disable-auto']);
        return 'Took back the auto-merge this workflow armed.'
    }

    if (!repo.autoMergeAllowed) refuse(`"Allow auto-merge" is off in ${repository}`);
    if (pr.headRefOid !== admittedHead) refuse(`the head moved from the admitted ${admittedHead} to ${pr.headRefOid}; the run for the new head decides`);

    const rules = read(gh, `the rules of ${pr.baseRefName}`, ['api', `repos/${repository}/rules/branches/${encodeURIComponent(pr.baseRefName)}?per_page=100`]);

    if (!Array.isArray(rules)) refuse(`the rules of ${pr.baseRefName} are malformed`);

    const checks = rules.filter(rule => rule?.type === 'required_status_checks')
        .flatMap(rule => rule.parameters?.required_status_checks ?? [])
        .map(check => check?.context)
        .filter(Boolean);

    if (checks.length === 0) refuse(`${pr.baseRefName} requires no status check, so GitHub would merge without one`);

    gh([...target, '--auto', `--${mergeMethod}`, '--match-head-commit', admittedHead]);
    return `Armed at ${admittedHead}: GitHub merges once ${checks.length} required checks pass on ${pr.baseRefName}.`
}

// Canonicalized on both sides, as in check-version-bump.mjs: a symlinked argv[1] still runs the entrypoint.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    const {env} = process;

    try {
        console.log(handOff({
            gh          : args => execFileSync('gh', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}),
            repository  : env.AUTOMERGE_REPOSITORY,
            number      : env.AUTOMERGE_PR_NUMBER,
            admittedHead: env.AUTOMERGE_ADMITTED_HEAD,
            eligible    : env.AUTOMERGE_ELIGIBLE,
            disarm      : env.AUTOMERGE_DISARM,
            mergeMethod : env.AUTOMERGE_MERGE_METHOD
        }))
    } catch (error) {
        console.error(`::error::${firstLine(error)}`);
        process.exitCode = 1
    }
}
