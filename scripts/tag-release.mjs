#!/usr/bin/env node
/**
 * @summary Puts `v<version>` on origin at the commit npm just published; a rerun finishes a failed push.
 *
 * Runs as `postpublish`, after the registry already holds the version, so no failure here can be
 * undone by publishing again. Every path is therefore loud and safe to rerun:
 * - `npm publish --dry-run` runs postpublish too, with `npm_config_dry_run=true`: nothing is tagged;
 * - origin already has the tag at HEAD: nothing to do;
 * - the tag marks another commit, locally or on origin: refuse, the release would be ambiguous;
 * - no tag yet: refuse a dirty tree (the tag would not mark what was packed), else tag HEAD;
 * - push: a failure exits 1 naming the rerun that completes the release.
 *
 * Then the major tag (`v0` for 0.x) moves to this release, forward only. Callers name it to run every
 * published release without a pin bump each. A prerelease never moves it, and neither does a version
 * older than the one it marks, so a backport cannot downgrade every caller.
 *
 * Run: `node scripts/tag-release.mjs [--root=<repository>]`
 */

import {execFileSync, spawnSync} from 'node:child_process';
import {readFileSync}            from 'node:fs';
import {join, resolve}           from 'node:path';

const
    root    = resolve(process.argv.find(arg => arg.startsWith('--root='))?.slice(7) || join(import.meta.dirname, '..')),
    version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
    tag     = `v${version}`,
    git     = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim(),
    tryGit  = (...args) => spawnSync('git', args, {cwd: root, encoding: 'utf8'});

/** @summary Stops with the reason. */
function fail(reason) {
    console.error(`tag-release: ${reason}.`);
    process.exit(1)
}

/** @summary The commit origin's `tag` marks (peeled for an annotated tag), or '' when origin has none. */
function remoteCommit() {
    const listed = tryGit('ls-remote', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`);

    if (listed.status !== 0) fail(`cannot read origin (${listed.stderr.trim()}); rerun once origin is reachable`);

    const refs = Object.fromEntries(listed.stdout.trim().split('\n').filter(Boolean).map(line => line.split('\t').reverse()));

    return refs[`refs/tags/${tag}^{}`] || refs[`refs/tags/${tag}`] || ''
}

/** @summary Negative, zero or positive as the `X.Y.Z` version `a` is older than, equal to or newer than `b`. */
function compareVersions(a, b) {
    const [x, y] = [a, b].map(v => v.split('.').map(Number));

    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
}

/** @summary Moves the major tag to HEAD, unless this release is a prerelease or older than the one it marks. */
function moveMajor() {
    const major = `v${version.split('.')[0]}`;

    if (version.includes('-')) {
        console.log(`tag-release: ${version} is a prerelease, so ${major} stays`);
        return
    }

    const listed = tryGit('ls-remote', '--tags', 'origin');

    if (listed.status !== 0) fail(`${tag} is on origin, but its tags cannot be read (${listed.stderr.trim()}); rerun to move ${major}`);

    // Tag → commit, preferring the peeled `^{}` line of an annotated tag
    const commits = {};

    listed.stdout.trim().split('\n').filter(Boolean).forEach(line => {
        const [sha, ref] = line.split('\t'),
              name       = ref.slice('refs/tags/'.length).replace(/\^\{\}$/, '');

        if (ref.endsWith('^{}') || !commits[name]) commits[name] = sha
    });

    const current = commits[major];

    if (current === head) {
        console.log(`tag-release: ${major} already marks ${tag}`);
        return
    }

    if (current) {
        const marked = Object.keys(commits).filter(name => /^v\d+\.\d+\.\d+$/.test(name) && commits[name] === current).map(name => name.slice(1));

        if (marked.length === 0) fail(`origin's ${major} marks ${current.slice(0, 7)}, which no release tag marks; move it by hand`);

        if (marked.some(markedVersion => compareVersions(markedVersion, version) > 0)) {
            console.log(`tag-release: ${major} stays at v${marked.join(', v')}, newer than ${version}`);
            return
        }
    }

    git('tag', '-f', '-a', major, '-m', `neo-agent-skills ${version}`);

    const pushed = tryGit('push', '--force', 'origin', `refs/tags/${major}`);

    if (pushed.status !== 0) fail(`${tag} is on origin, but ${major} did not move (${pushed.stderr.trim()}); rerun \`node scripts/tag-release.mjs\``);

    console.log(`tag-release: ${major} moved to ${tag}`)
}

if (process.env.npm_config_dry_run === 'true') {
    console.log(`tag-release: dry run, so ${tag} is not tagged`);
    process.exit(0)
}

const
    head   = git('rev-parse', 'HEAD'),
    local  = tryGit('rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`).stdout.trim(),
    remote = remoteCommit();

if (remote && remote !== head) fail(`origin's ${tag} marks ${remote.slice(0, 7)}, not HEAD ${head.slice(0, 7)}`);
if (local  && local  !== head) fail(`the local ${tag} marks ${local.slice(0, 7)}, not HEAD ${head.slice(0, 7)}`);

if (remote) {
    console.log(`tag-release: ${tag} is already on origin at ${head.slice(0, 7)}`)
} else {
    if (!local) {
        if (git('status', '--porcelain')) fail(`the tree is dirty, so ${tag} would not mark what was packed`);
        git('tag', '-a', tag, '-m', `neo-agent-skills ${version}`)
    }

    const pushed = tryGit('push', 'origin', `refs/tags/${tag}`);

    if (pushed.status !== 0) {
        fail(`npm has ${version}, but ${tag} did not reach origin (${pushed.stderr.trim()}); rerun \`node scripts/tag-release.mjs\` to finish the release`)
    }

    console.log(`tag-release: ${tag} at ${head.slice(0, 7)}, pushed`)
}

moveMajor();
