#!/usr/bin/env node
/**
 * @summary Contract checks for the commit-authorship guard, run against real commits in a disposable repository.
 *
 * The operator's identity comes from a stand-in global config (`GIT_CONFIG_GLOBAL`), so no arm reads or writes the real
 * one, and `NEO_AGENT_IDENTITY` is cleared so the seat running these arms cannot make the main checkout look agent-owned.
 * The team roster is a fixture module with two seats on `team.example`.
 */

import assert                                                            from 'node:assert/strict';
import {execFileSync, spawnSync}                                         from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir}                                                          from 'node:os';
import {dirname, join}                                                   from 'node:path';
import {fileURLToPath}                                                   from 'node:url';
import {findUnknownCoAuthors, pendingRanges, teamFromRoster}             from './check-commit-authorship.mjs';

const
    here     = dirname(fileURLToPath(import.meta.url)),
    GUARD    = join(here, 'check-commit-authorship.mjs'),
    root     = mkdtempSync(join(tmpdir(), 'check-commit-authorship-')),
    repo     = join(root, 'repo'),
    worktree = join(root, 'worktree'),
    roster   = join(root, 'roster.mjs'),
    OPERATOR = 'operator@home.example',
    env      = {...process.env, GIT_CONFIG_GLOBAL: join(root, 'global.gitconfig'), GIT_CONFIG_NOSYSTEM: '1', NEO_AGENT_IDENTITY: ''},
    git      = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8', env}).trim();

writeFileSync(env.GIT_CONFIG_GLOBAL, `[user]\n\tname = Operator\n\temail = ${OPERATOR}\n`);
writeFileSync(roster, `const EMAIL = {'@seat-one': 'seat-one@team.example', '@seat-two': 'seat-two@team.example'};
export const registryAgentLogins = () => Object.keys(EMAIL);
export const rosterEmailForLogin = login => EMAIL[login?.startsWith('@') ? login : \`@\${login}\`] ?? null;
`);

git(root, 'init', '-q', '-b', 'dev', repo);
git(repo, 'commit', '-q', '--allow-empty', '-m', 'base');

const base = git(repo, 'rev-parse', 'HEAD');

/**
 * @summary Commits on top of `base` in `cwd`, and returns its sha. `author` is `Name <address>`, or null for the
 * checkout's own identity.
 * @returns {String}
 */
const commit = (cwd, author, message) => {
    git(cwd, 'checkout', '-q', '--detach', base);
    git(cwd, 'commit', '-q', '--allow-empty', '-m', message, ...(author ? ['--author', author] : []));

    return git(cwd, 'rev-parse', 'HEAD')
};

/**
 * @summary Runs the guard over `base..sha`: as the pre-push hook would (the ref tuple on stdin), or in CI (`--base`).
 * @returns {{status: Number, output: String}}
 */
const guard = (cwd, sha, args = [], {ci = false, script = GUARD} = {}) => {
    const {status, stdout, stderr} = spawnSync(process.execPath, [script, ...args, ...(ci ? ['--base', base] : [])], {
        cwd,
        encoding: 'utf8',
        env,
        input   : ci ? '' : `refs/heads/lane ${sha} refs/heads/lane ${base}\n`
    });

    return {status, output: stdout + stderr}
};

try {
    git(repo, 'worktree', 'add', '-q', '--detach', worktree, base);

    // ── The operator check: an agent checkout never pushes the operator's identity ─────────────────
    {
        const leaked = commit(worktree, null, 'resolved to the global identity');

        assert.equal(git(worktree, 'log', '-1', '--format=%ae'), OPERATOR, 'the fixture reproduces the leak');

        const refused = guard(worktree, leaked);

        assert.equal(refused.status, 1, 'from a linked worktree, a commit authored as the operator is refused');
        assert.match(refused.output, /authored as the operator from an agent checkout/);

        assert.equal(guard(repo, leaked).status, 0, 'the same commit from the main checkout is the operator\'s own');
        assert.equal(guard(worktree, leaked, ['--roster', roster]).status, 1, 'a roster changes nothing about this check')
    }

    // ── The trailer check, with the team's roster ──────────────────────────────────────────────────
    {
        const
            credits  = commit(repo, 'Seat One <seat-one@team.example>', 'work\n\nCo-Authored-By: A Person <person@elsewhere.example>'),
            ghost    = commit(repo, 'Outside <outside@else.example>', 'work\n\nCo-Authored-By: Ghost <ghost@team.example>'),
            seatPair = commit(repo, 'Seat One <seat-one@team.example>', 'work\n\nCo-Authored-By: Seat Two <seat-two@team.example>');

        const refused = guard(repo, credits, ['--roster', roster]);

        assert.equal(refused.status, 1, 'an agent-authored commit may not credit an address no seat owns');
        assert.match(refused.output, /person@elsewhere\.example/);

        const advised = guard(repo, ghost, ['--roster', roster]);

        assert.equal(advised.status, 0, 'another contributor\'s trailer is advice, never a block');
        assert.match(advised.output, /ghost@team\.example/);

        assert.equal(guard(repo, seatPair, ['--roster', roster]).status, 0, 'a seat crediting a seat passes');

        // No roster: no team to police, and the operator check still runs
        assert.equal(guard(repo, credits).status, 0, 'without a roster no trailer is checked');
        assert.match(guard(repo, credits, [], {ci: true}).output, /no team roster supplied/, 'and CI says so');
        assert.equal(guard(worktree, commit(worktree, null, 'leak again')).status, 1, 'while the operator check runs on')
    }

    // ── The lane comes from the authenticated PR author, never from the commit's own author ───────
    {
        const forged = commit(repo, 'Forged <forged@else.example>', 'work\n\nCo-Authored-By: A Person <person@elsewhere.example>');

        assert.equal(guard(repo, forged, ['--roster', roster], {ci: true}).status, 0,
            'judged by its forged author alone, the commit is not agent-authored');
        assert.equal(guard(repo, forged, ['--roster', roster, '--author-login', 'seat-one'], {ci: true}).status, 1,
            'opened by a seat, it is, whatever its author field claims');
        assert.equal(guard(repo, forged, ['--roster', roster, '--author-login', 'somebody'], {ci: true}).status, 0,
            'opened by someone outside the team, it is not inspected')
    }

    // ── A roster the caller named and the guard cannot read is a misconfiguration, never a pass ────
    {
        const missing = guard(repo, base, ['--roster', join(root, 'absent.mjs')], {ci: true});

        assert.equal(missing.status, 1);
        assert.match(missing.output, /cannot read the team roster/);

        const link = join(root, 'neo-agent-skills-commit-authorship');

        symlinkSync(GUARD, link);
        assert.equal(guard(repo, base, ['--roster', join(root, 'absent.mjs')], {ci: true, script: link}).status, 1,
            'invoked through a symlink, the installed `bin` shape, the guard still runs')
    }

    // ── A new branch is measured against what the remote has seen, whatever the trunk is called ────
    {
        const
            origin = join(root, 'origin.git'),
            clone  = join(root, 'clone'),
            zero   = '0'.repeat(40),
            pinned = {...env, NEO_AGENT_IDENTITY: 'seat-one'},
            push   = (cwd, sha, args = [], remoteSha = zero) => {
                const {status, stdout, stderr} = spawnSync(process.execPath, [GUARD, ...args], {
                    cwd,
                    encoding: 'utf8',
                    env     : pinned,
                    input   : `refs/heads/feature ${sha} refs/heads/feature ${remoteSha}\n`
                });

                return {status, output: stdout + stderr}
            };

        // A `main` trunk and no `dev`: the clone's only remote-tracking refs are origin/main and origin/HEAD
        git(root, 'init', '-q', '--bare', '-b', 'main', origin);
        git(repo, 'push', '-q', origin, `${base}:refs/heads/main`);
        git(root, 'clone', '-q', origin, clone);
        git(clone, 'commit', '-q', '--allow-empty', '-m', 'feature\n\nCo-Authored-By: A Person <person@elsewhere.example>');

        const leaked = git(clone, 'rev-parse', 'HEAD');

        assert.equal(git(clone, 'for-each-ref', '--format=%(refname)', 'refs/remotes/origin/dev'), '', 'the trunk is not dev');

        const operatorOnly = push(clone, leaked);

        assert.equal(operatorOnly.status, 1, 'with no roster, the operator identity on a new main-trunk branch is refused');
        assert.match(operatorOnly.output, /authored as the operator from an agent checkout/);

        const withRoster = push(clone, leaked, ['--roster', roster]);

        assert.equal(withRoster.status, 1, 'with the roster, its off-team trailer is refused too');
        assert.match(withRoster.output, /person@elsewhere\.example/);

        assert.equal(push(clone, base).status, 0, 'a new branch the remote has already seen sends nothing new');

        // Nothing to measure against, and nothing to read: both are refusals, never a clean scan
        const noBasis = push(worktree, commit(worktree, null, 'no remote at all'));

        assert.equal(noBasis.status, 1, 'with no remote-tracking ref, a new branch has no basis');
        assert.match(noBasis.output, /no remote-tracking ref/);

        const unreadable = push(clone, leaked, [], 'f'.repeat(40));

        assert.equal(unreadable.status, 1, 'a remote sha this clone does not have cannot be read');
        assert.match(unreadable.output, /cannot read the pushed commits/)
    }

    // ── The pure parts ─────────────────────────────────────────────────────────────────────────────
    {
        const team = teamFromRoster(await import(new URL(`file://${roster}`).href));

        assert.equal(teamFromRoster(null), null);
        assert.deepEqual([...team.domains], ['team.example'], 'the team\'s domains are its seats\' domains');
        assert.equal(team.isAgentLogin('@seat-two'), true);
        assert.equal(team.isAgentLogin(''), false);
        assert.deepEqual(findUnknownCoAuthors({team}), []);

        const zero = '0'.repeat(40);

        assert.deepEqual(pendingRanges(`refs/heads/a ${'a'.repeat(40)} refs/heads/a ${zero}\n`), [`${'a'.repeat(40)} --not --remotes`],
            'a new remote branch is measured against what no remote-tracking ref has seen');
        assert.deepEqual(pendingRanges(`refs/heads/a ${zero} refs/heads/a ${'b'.repeat(40)}\n`), [], 'a deletion sends nothing');
        assert.deepEqual(pendingRanges(''), ['HEAD --not --remotes'], 'no payload scans the unpushed commits, never nothing');
        assert.deepEqual(pendingRanges('', 'abc'), ['abc..HEAD'])
    }

    // ── It ships, or consumers cannot invoke it ────────────────────────────────────────────────────
    {
        const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'));

        assert.equal(pkg.bin['neo-agent-skills-commit-authorship'], './scripts/check-commit-authorship.mjs');
        assert.ok(pkg.files.includes('scripts/check-commit-authorship.mjs'), 'the guard must be in the published file list')
    }
} finally {
    rmSync(root, {recursive: true, force: true})
}

console.log('check-commit-authorship: contract arms green.');
