#!/usr/bin/env node
/**
 * @summary Fails a pull request that does not carry a new release. Its `package.json` version must be greater
 * than its base's, the lockfile must agree, and npm must not have the version yet.
 *
 * Every merge to `dev` publishes (`.github/workflows/publish.yml`), so a pull request carries the version it will
 * publish. `package.json` is the one place a version is written:
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

// A plain release. The baseline's `version` job accepts only this shape, so a prerelease could publish and
// then never be callable.
const RELEASE = /^\d+\.\d+\.\d+$/;

/**
 * @summary The reasons a head version is not a new release. Empty when it is one.
 * @param {{head: String, lock: String, base: String, published: Boolean}} versions
 * @returns {String[]}
 */
export function judgeVersionBump({head, lock, base, published}) {
    if (!RELEASE.test(head ?? '')) return [`package.json names no release version ('${head}')`];

    return [
        lock !== head && `package-lock.json says ${lock} where package.json says ${head}; bump both with \`npm version\``,
        RELEASE.test(base ?? '') && !semver.gt(head, base) &&
            `${head} is not greater than the base's ${base}; every merge publishes, so every pull request bumps`,
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
        parsed = parseArgs({args: argv, allowPositionals: false, strict: true, options: {base: {type: 'string'}}})
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
        const read = file => JSON.parse(readFileSync(join(cwd, file), 'utf8')).version,
              head = read('package.json');

        versions = {
            head,
            lock     : read('package-lock.json'),
            base     : JSON.parse(execFileSync('git', ['show', `${parsed.values.base}:package.json`], {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']})).version,
            published: RELEASE.test(head ?? '') && published(head)
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

    out(`check-version-bump: ${versions.base} → ${versions.head}, a version npm does not have yet.`);
    return 0
}

// Canonicalized on both sides, as in check-npm-overrides.mjs: under `--preserve-symlinks-main` import.meta.url
// keeps a link path, and an unresolved compare would load the module, skip `run()` and exit 0 judging nothing.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    process.exitCode = run()
}
