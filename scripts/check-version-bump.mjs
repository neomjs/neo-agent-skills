#!/usr/bin/env node
/**
 * @summary Checks release versions by PR origin (`originOf`): Dependabot and forks retain the base version; a
 * maintainer PR carries a new release.
 *
 * Maintainer merges to `dev` publish (`.github/workflows/publish.yml`); Dependabot and fork merges publish nothing,
 * and the next maintainer release carries them. A fork's author cannot see our merges coming, so the number it holds
 * would go stale with each of them; it keeps the base version instead, which no merge can outdate.
 * `package.json` is the one place a version is written:
 * - a pull request without a bump would merge a change npm never receives;
 * - a pull request naming a version npm already has would fail the publish after the merge, where no review
 *   sees it.
 *
 * If the registry cannot be asked, the check fails. An unanswered question is not a "no".
 *
 * Run from the repository root: `node scripts/check-version-bump.mjs --base <ref>`
 */

import {execFileSync, spawnSync}    from 'node:child_process';
import {readFileSync, realpathSync} from 'node:fs';
import {join}                       from 'node:path';
import {fileURLToPath}              from 'node:url';
import {parseArgs}                  from 'node:util';
import semver                       from 'semver';
import {originOf}                   from './release-origin.mjs';

// A plain release. The baseline's `version` job accepts only this shape, so a prerelease could publish and
// then never be callable.
const RELEASE = /^\d+\.\d+\.\d+$/;

/**
 * @summary The reasons a head version is not the one its origin owes. Empty when it is.
 * @param {{head: String, lock: String, base: String, published: Boolean, origin?: String}} versions `origin` is
 *     an `originOf` answer; omitted, it is a maintainer's.
 * @returns {String[]}
 */
export function judgeVersionBump({head, lock, base, published, origin = 'maintainer'}) {
    if (!RELEASE.test(head ?? '')) return [`package.json names no release version ('${head}')`];

    if (origin === 'dependabot') return [
        lock !== head && `package-lock.json says ${lock} where package.json says ${head}`,
        (!RELEASE.test(base ?? '') || head !== base) &&
            `Dependabot must retain the base package version ${base}, not release ${head}`
    ].filter(Boolean);

    // Written for the contributor, who has nothing to do but restore the version
    if (origin === 'fork') return [
        lock !== head && `package-lock.json says ${lock} where package.json says ${head}`,
        (!RELEASE.test(base ?? '') || head !== base) &&
            `This pull request changes the package version to ${head}. Restore ${base} in package.json and package-lock.json: a pull request from a fork keeps the version, and the next maintainer release carries your change.`
    ].filter(Boolean);

    return [
        lock !== head && `package-lock.json says ${lock} where package.json says ${head}; bump both with \`npm version\``,
        RELEASE.test(base ?? '') && !semver.gt(head, base) &&
            `${head} is not greater than the base's ${base}; maintainer pull requests carry a new release`,
        published && `npm already has neo-agent-skills@${head}; bump past it`
    ].filter(Boolean)
}

/**
 * @summary Reads one `npm view <package>@<version> version` result.
 * @param {{status: Number, stdout: String, stderr: String}} view
 * @param {String} version
 * @returns {Boolean} Whether npm has the version.
 * @throws {Error} When the registry gave no answer, which is not the same as "not published".
 */
export function classifyView({status, stdout, stderr}, version) {
    if (status === 0) return stdout.trim() === version;
    if (/\bE404\b/.test(stderr)) return false;

    throw new Error(`the registry did not answer for neo-agent-skills@${version} (${stderr.trim().split('\n')[0] || `npm exited ${status}`})`)
}

/**
 * @summary Whether npm has `neo-agent-skills@version`.
 * @param {String} version
 * @returns {Boolean}
 */
export function isPublished(version) {
    return classifyView(spawnSync('npm', ['view', `neo-agent-skills@${version}`, 'version'], {encoding: 'utf8'}), version)
}

/**
 * @summary Judges the checkout at `cwd` against `--base` and returns the process exit code.
 * @param {String[]} [argv]
 * @param {{cwd?: String, out?: Function, error?: Function, published?: Function}} [io]
 * @returns {Number} Process exit code.
 */
export function run(argv = process.argv.slice(2), {cwd = process.cwd(), out = console.log, error = console.error, published = isPublished} = {}) {
    let parsed;

    try {
        parsed = parseArgs({args: argv, allowPositionals: false, strict: true, options: {
            base: {type: 'string'}, event: {type: 'string'}
        }})
    } catch (cause) {
        error(`check-version-bump: ${cause.message}`);
        return 2
    }

    if (!parsed.values.base) {
        error('check-version-bump: --base <ref> is required: the commit the pull request merges into');
        return 2
    }

    let versions;

    try {
        const read   = file => JSON.parse(readFileSync(join(cwd, file), 'utf8')).version,
              head   = read('package.json'),
              origin = parsed.values.event ? originOf(JSON.parse(readFileSync(parsed.values.event, 'utf8')).pull_request) : 'maintainer';

        versions = {
            head,
            lock     : read('package-lock.json'),
            base     : JSON.parse(execFileSync('git', ['show', `${parsed.values.base}:package.json`], {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})).version,
            origin,
            published: origin === 'maintainer' && RELEASE.test(head ?? '') && published(head)
        }
    } catch (cause) {
        error(`check-version-bump: ${cause.message}`);
        return 1
    }

    const failures = judgeVersionBump(versions);

    if (failures.length) {
        failures.forEach(reason => error(`❌ ${reason}`));
        return 1
    }

    out({
        dependabot: `check-version-bump: Dependabot retains ${versions.base}; validation only.`,
        fork      : `check-version-bump: a fork keeps ${versions.base}; the next maintainer release publishes its change.`
    }[versions.origin] ?? `check-version-bump: ${versions.base} → ${versions.head}, a version npm does not have yet.`);
    return 0
}

// Canonicalized on both sides, as in check-npm-overrides.mjs: under `--preserve-symlinks-main` import.meta.url
// keeps a link path, and an unresolved compare would load the module, skip `run()` and exit 0 judging nothing.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    process.exitCode = run()
}
