#!/usr/bin/env node
/**
 * @summary Refuses agent commits that carry the operator's identity, or that credit an address outside the team.
 *
 * Two checks, split along what each needs to know:
 *
 * - **Operator identity** (pre-push hook). In an agent-owned checkout, no pushed commit may carry the identity from the
 *   operator's GLOBAL git config. That is what leaks when a worktree sets no identity of its own: a whole agent shift
 *   once produced 38 commits authored as the operator, and nothing warned. It compares against the global config, never
 *   a roster, so it works for whoever clones the repository.
 * - **Co-author trailers** (hook and CI). GitHub credits a `Co-Authored-By` trailer by its EMAIL, so on an agent-authored
 *   commit an address no seat owns credits a real person for work they did not do. Which commits are agent-authored,
 *   and which addresses are seats, is the TEAM's roster: `--roster <module>`, a module exporting
 *   `registryAgentLogins()` and `rosterEmailForLogin(login)`. The roster marks one team apart from everyone else who
 *   uses the same tooling (other projects, forks, contributors who are not maintainers), so it is the caller's input
 *   and never data of this package. With no roster the check inspects nothing.
 *
 * Whether a push is an agent's comes from sources its commits cannot forge: checkout ownership at the hook (a linked
 * worktree, or the `NEO_AGENT_IDENTITY` pin), and in CI the GitHub-authenticated PR author (`--author-login`). A
 * commit's own `%ae` is never trusted for that: `git commit --author` rewrites it.
 *
 * Hook: `printf '%s\n' "$payload" | neo-agent-skills-commit-authorship [--roster <module>]`, where the payload is git's
 * `<localRef> <localSha> <remoteRef> <remoteSha>` rows. CI: `--base <sha> --author-login <login> --roster <module>`.
 * Bypass, for an operator genuinely committing from an agent checkout: `git push --no-verify`.
 */

import {execSync}                    from 'node:child_process';
import {readFileSync, realpathSync} from 'node:fs';
import path                          from 'node:path';
import process                       from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const
    UNSEEN   = '--not --remotes',
    ZERO_SHA = '0'.repeat(40),
    tryExec  = command => {
        try {
            return execSync(command, {encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore']}).trim()
        } catch {
            return ''
        }
    };

/**
 * @summary The commits a push introduces, read from git's own ref tuples, or `<base>..HEAD` in CI.
 *
 * A commit some remote-tracking ref has already seen was introduced by someone else, so no range answers for it
 * (`--not --remotes`). A branch the remote already has is measured from its remote sha as well: after a rebase,
 * `remoteSha..localSha` alone also holds the upstream commits the branch moved onto. A deletion sends no commits. A new
 * remote branch reports the zero sha, and a manual run has no payload at all: both are measured against the
 * remote-tracking refs alone. That basis names no trunk, so a repository whose trunk is `main` is covered like one
 * whose trunk is `dev`, and a scan never degrades to nothing.
 * @param {String}      payload The hook's stdin
 * @param {String|null} [base]  A base sha, when there is no push to read
 * @returns {String[]} `git log` revision arguments, one entry per pushed ref
 */
export function pendingRanges(payload, base=null) {
    if (base) {
        return [`${base}..HEAD`]
    }

    const rows = payload.split('\n').map(line => line.trim()).filter(Boolean);

    if (rows.length === 0) {
        return [`HEAD ${UNSEEN}`]
    }

    return rows.map(row => {
        const [, localSha, , remoteSha] = row.split(/\s+/);

        if (!localSha || localSha === ZERO_SHA) {
            return null
        }

        return !remoteSha || remoteSha === ZERO_SHA ? `${localSha} ${UNSEEN}` : `${remoteSha}..${localSha} ${UNSEEN}`
    }).filter(Boolean)
}

/**
 * @summary Whether this checkout is owned by an agent: a LINKED worktree, or a clone pinned with `NEO_AGENT_IDENTITY`.
 *
 * A linked worktree's git dir is `<common>/worktrees/<name>`, while the main checkout's git dir IS the common dir. Both
 * are resolved first: `--git-dir` answers relatively in the main checkout, and a raw compare would call every main
 * checkout linked. An independent clone without the pin is indistinguishable from the operator's own checkout, so it
 * stays uncovered rather than refusing the operator's valid commits.
 * @returns {Boolean}
 */
export function isAgentCheckout() {
    const gitDir    = tryExec('git rev-parse --absolute-git-dir'),
          commonDir = tryExec('git rev-parse --git-common-dir');

    return Boolean(gitDir && commonDir && path.resolve(gitDir) !== path.resolve(commonDir)) ||
        Boolean(process.env.NEO_AGENT_IDENTITY?.trim())
}

/**
 * @summary The team a roster module describes: its seats' addresses, the domains they use, and who its agents are.
 * @param {Object|null} roster A module exporting `registryAgentLogins()` and `rosterEmailForLogin(login)`
 * @returns {{domains: Set<String>, emails: Set<String>, isAgentLogin: Function}|null} null without a roster
 */
export function teamFromRoster(roster) {
    if (!roster) {
        return null
    }

    const emails = new Set(roster.registryAgentLogins()
        .map(login => roster.rosterEmailForLogin(login))
        .filter(Boolean)
        .map(email => email.toLowerCase()));

    return {
        domains     : new Set([...emails].map(email => email.split('@')[1])),
        emails,
        isAgentLogin: login => Boolean(login && roster.rosterEmailForLogin(login))
    }
}

/**
 * @summary `Co-Authored-By` trailers whose address belongs to no seat of the team.
 *
 * A commit is agent-authored when its lane is (from a source the committer cannot forge), or when its author is a seat.
 * On such a commit any unknown address is an offender, since off the team's domains is exactly where a person's account
 * is. On any other commit only an unknown address on the team's own domains is reported, and only as advice: another
 * contributor's trailers are not the team's business.
 * @param {Object}   options
 * @param {Object[]} [options.commits=[]]      `{sha, subject, body, authorEmail}` each
 * @param {Boolean}  [options.agentLane=false]
 * @param {Object}   options.team              from {@link teamFromRoster}
 * @returns {Object[]} `{sha, subject, email, agentAuthored}` each
 */
export function findUnknownCoAuthors({commits = [], agentLane = false, team}) {
    const
        trailer   = /^\s*co-authored-by:\s*.*?<([^>]+)>\s*$/gim,
        offenders = [];

    commits.forEach(({sha, subject, body, authorEmail}) => {
        const
            agentAuthored = agentLane || team.emails.has((authorEmail || '').trim().toLowerCase()),
            seen          = new Set();

        let match;

        trailer.lastIndex = 0;

        while ((match = trailer.exec(body || '')) !== null) {
            const email = match[1].trim().toLowerCase();

            if (team.emails.has(email) || seen.has(email) || (!agentAuthored && !team.domains.has(email.split('@')[1]))) {
                continue
            }

            seen.add(email);
            offenders.push({sha, subject, email, agentAuthored})
        }
    });

    return offenders
}

/**
 * @summary The commits in the ranges, with the full message each trailer lives in.
 *
 * Throws when git cannot read a range: an unreadable push is not a push without offenders, and both checks read here.
 * @param {String[]} ranges
 * @returns {Object[]} `{sha, authorEmail, subject, body}` each
 */
function readCommits(ranges) {
    return ranges.flatMap(range => {
        // \x1f between fields and \x1e between records: a body carries newlines, so splitting lines would cut trailers
        const log = execSync(`git log ${range} --format=%H%x1f%ae%x1f%s%x1f%B%x1e`, {
            encoding: 'utf8',
            stdio   : ['pipe', 'pipe', 'pipe']
        }).trim();

        return log ? log.split('\x1e').map(entry => {
            const [sha, authorEmail, subject, body] = entry.replace(/^\n+/, '').split('\x1f');

            return sha ? {sha, authorEmail, subject, body} : null
        }).filter(Boolean) : []
    })
}

/**
 * @param {String[]} args
 * @param {String}   name
 * @returns {String|null}
 */
function option(args, name) {
    const index = args.indexOf(name);

    return index === -1 ? null : (args[index + 1] || null)
}

/**
 * @summary Runs both checks.
 * @param {String[]} args    The command line after the script
 * @param {String}   payload The hook's stdin
 * @returns {Promise<Number>} the exit code
 */
export async function run(args, payload) {
    const
        base       = option(args, '--base'),
        login      = option(args, '--author-login'),
        rosterPath = option(args, '--roster'),
        ranges     = pendingRanges(payload, base);

    let team = null;

    if (rosterPath) {
        try {
            team = teamFromRoster(await import(pathToFileURL(path.resolve(rosterPath)).href))
        } catch (error) {
            // A roster the caller named and this guard cannot read is a misconfigured caller, never a silent pass
            console.error(`check-commit-authorship: cannot read the team roster at ${rosterPath}: ${error.message}`);
            return 1
        }
    } else if (base) {
        console.log('check-commit-authorship: no team roster supplied, so no commit is checked for its co-author trailers.')
    }

    const
        agentCheckout = isAgentCheckout(),
        operator      = tryExec('git config --global user.email').toLowerCase(),
        // The operator check only exists where an agent pushes, and only when there is a global identity to leak
        checkOperator = Boolean(operator && agentCheckout);

    if (!team && !checkOperator) {
        return 0
    }

    // A range measured against the remote-tracking refs alone has no basis without them; one that also names its
    // remote sha (`..`) keeps that basis, and merely excludes nothing more
    if (ranges.some(range => range.endsWith(UNSEEN) && !range.includes('..')) && !tryExec('git for-each-ref --count=1 refs/remotes')) {
        console.error('check-commit-authorship: no remote-tracking ref to measure the pushed commits against. ' +
            'Fetch the remote first, or bypass with git push --no-verify.');
        return 1
    }

    let commits;

    try {
        commits = readCommits(ranges)
    } catch (error) {
        console.error(`check-commit-authorship: cannot read the pushed commits (${String(error.stderr || error.message).trim().split('\n')[0]}). ` +
            'Fetch the remote first, or bypass with git push --no-verify.');
        return 1
    }

    if (team) {
        const
            agentLane = agentCheckout || team.isAgentLogin(login),
            offenders = findUnknownCoAuthors({agentLane, commits, team}),
            blocking  = offenders.filter(offender => offender.agentAuthored),
            advisory  = offenders.filter(offender => !offender.agentAuthored);

        if (advisory.length > 0) {
            console.warn(`check-commit-authorship: ${advisory.length} Co-Authored-By trailer(s) name a team-domain address ` +
                'no seat owns. GitHub credits trailers by email, so they credit nobody. The commits are not agent-authored, ' +
                'so this is advice only.');
            advisory.forEach(({sha, subject, email}) => console.warn(`  ${sha.slice(0, 10)}  <${email}>  ${subject}`))
        }

        if (blocking.length > 0) {
            console.error(`check-commit-authorship: ${blocking.length} Co-Authored-By trailer(s) on agent-authored commit(s) ` +
                'name an address no seat owns:');
            blocking.forEach(({sha, subject, email}) => console.error(`  ${sha.slice(0, 10)}  <${email}>  ${subject}`));
            console.error('GitHub credits a trailer by its email, so an address outside the team credits a real person. ' +
                'Addresses cannot be derived from a handle: read the seat\'s address from the roster, or drop the trailer.');
            return 1
        }
    }

    if (!checkOperator) {
        return 0
    }

    const offenders = new Map();

    commits.forEach(({sha, authorEmail, subject}) => {
        (authorEmail || '').toLowerCase() === operator && offenders.set(sha, `  ${sha.slice(0, 10)}  ${subject}`)
    });

    if (offenders.size === 0) {
        return 0
    }

    console.error(`check-commit-authorship: ${offenders.size} commit(s) authored as the operator from an agent checkout:`);
    console.error([...offenders.values()].join('\n'));
    console.error(`This checkout's user.email is: ${tryExec('git config user.email') || '(unset, so the global identity resolves)'}
Set this checkout's own identity, then repair the commits:

  git config user.email "<your seat's address>"
  git rebase <the branch's base> --exec 'git commit --amend --no-edit --reset-author'

Bypass, for an operator genuinely committing from an agent checkout: git push --no-verify`);

    return 1
}

// Canonicalized on BOTH sides, as in check-secrets.mjs: a package `bin` is a symlink, and under
// `--preserve-symlinks-main` import.meta.url keeps the link path, so an unresolved compare would skip `run()`.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    let payload = '';

    // A base means CI, where there is no push to read; the hook's rows arrive on stdin
    if (!process.argv.includes('--base')) {
        try {
            payload = readFileSync(0, 'utf8')
        } catch {
            payload = ''
        }
    }

    process.exitCode = await run(process.argv.slice(2), payload)
}
