#!/usr/bin/env node
/** @summary Identifies Dependabot PRs and grants publication only from an exact merged PR receipt. */

import {readFileSync, realpathSync} from 'node:fs';
import {fileURLToPath}              from 'node:url';
import {parseArgs}                  from 'node:util';

/**
 * @summary Classifies the PR author, independent of the actor merging or rerunning it.
 * @param {Object} pullRequest GitHub's PR receipt.
 * @returns {Boolean} Whether the author is the canonical Dependabot bot.
 */
export function isDependabot(pullRequest) {
    const user = pullRequest?.user;

    if (!user?.login || !['User', 'Bot'].includes(user.type)) throw new Error('PR author is unavailable');
    if (user.login === 'dependabot[bot]' && user.type !== 'Bot') throw new Error('Dependabot author type is inconsistent');

    return user.login === 'dependabot[bot]' && user.type === 'Bot'
}

/**
 * @summary Resolves the one merged PR that introduced this commit to the declared release branch.
 * @param {Object[]} pullRequests Commit-associated GitHub PR receipts.
 * @param {Object} context Exact commit, repository and base branch.
 * @returns {Object} Publication decision; missing or ambiguous provenance throws.
 */
export function releaseOrigin(pullRequests, {sha, repository, base = 'dev'}) {
    if (!Array.isArray(pullRequests) || !/^[a-f0-9]{40}$/.test(sha ?? '') || !repository || !base) {
        throw new Error('release origin requires PR receipts, exact SHA, repository and base')
    }

    const matches = pullRequests.filter(pr => pr.state === 'closed' && pr.merged_at &&
        pr.merge_commit_sha === sha && pr.base?.ref === base && pr.base?.repo?.full_name === repository);

    if (matches.length !== 1) throw new Error(`expected one exact merged PR, found ${matches.length}`);

    const pr = matches[0];

    return {publish: !isDependabot(pr), prNumber: pr.number}
}

/**
 * @summary Reads paginated commit-associated PR receipts from stdin and emits the CI publication output.
 * @param {String[]} argv CLI options.
 * @param {Object} io Input and output seams for the contract runner.
 * @returns {Number} Exit code; errors never emit publication permission.
 */
export function run(argv = process.argv.slice(2), {input = () => readFileSync(0, 'utf8'), out = console.log, error = console.error} = {}) {
    try {
        const {values} = parseArgs({args: argv, strict: true, options: {
            sha: {type: 'string'}, repository: {type: 'string'}, base: {type: 'string', default: 'dev'}
        }});
        const pages = JSON.parse(input()),
              prs = Array.isArray(pages) && pages.every(Array.isArray) ? pages.flat() : pages,
              result = releaseOrigin(prs, values);

        out(`publish=${result.publish}`);
        return 0
    } catch (cause) {
        error(`release-origin: ${cause.message}`);
        return 1
    }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    process.exitCode = run()
}
