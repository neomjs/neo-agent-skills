#!/usr/bin/env node
/**
 * @summary Decides whether a pull request is a Dependabot update that `reusable-dependabot-automerge.yml` may hand to
 * GitHub's auto-merge.
 *
 * The workflow runs this file from its own commit, never from the pull request's head, so the code that decides a
 * merge is never code the merge brings in. The decision is pure. Its inputs are:
 * - the pull request's author, read from the event and never from `github.actor`, which names whoever re-ran or merged;
 * - the event's sender, the account whose push or reopen this run answers;
 * - the dependencies and update type `dependabot/fetch-metadata` read;
 * - the caller's allow-list and update types, where `*` admits any, majors and unparsed updates included;
 * - the repository's kill switch.
 *
 * Anything short of a full match is ineligible, with one reason line; an ineligible pull request is not an error.
 * Every event decides afresh, so an ineligible Dependabot pull request also gets `disarm`: auto-merge armed by an
 * earlier admission must not merge a head nobody admitted, such as a fix another account pushed. Pull requests by
 * anyone else are never touched.
 *
 * Run (from the workflow): `AUTOMERGE_*` environment in; `eligible`, `disarm` and `reason` out on `$GITHUB_OUTPUT`.
 */

import {appendFileSync, realpathSync} from 'node:fs';
import {fileURLToPath}                from 'node:url';

/** @summary Splits a comma-separated list into trimmed, non-empty entries. @param {String} [value] @returns {String[]} */
const list = value => String(value ?? '').split(',').map(entry => entry.trim()).filter(Boolean);

/** @summary Whether a list admits anything: it names `*`. @param {String} [value] @returns {Boolean} */
const admitsAny = value => list(value).includes('*');

/**
 * @summary Returns whether this pull request may merge itself, whether an earlier arming must be taken back, and why.
 * @param {Object} update
 * @param {String} update.author          The pull request author's login.
 * @param {String} update.authorType      The author's account type (`Bot` for Dependabot).
 * @param {String} update.sender          The event's sender: Dependabot when it opened or rebased the pull request.
 * @param {String} update.dependencyNames Comma-separated names `dependabot/fetch-metadata` read.
 * @param {String} update.updateType      `version-update:semver-<patch|minor|major>`, or empty.
 * @param {String} update.allowList       Comma-separated dependency names that may merge themselves, or `*` for any.
 * @param {String} update.updateTypes     Comma-separated semver update types that may merge themselves, or `*` for any.
 * @param {String} [update.killSwitch]    The repository variable `NEO_AUTOMERGE_DEPENDABOT`; `off` stops every merge.
 * @returns {{eligible: Boolean, disarm: Boolean, reason: String}}
 */
export function decideAutomergeEligibility({author, authorType, sender, dependencyNames, updateType, allowList, updateTypes, killSwitch}) {
    const
        dependabotPr = author === 'dependabot[bot]' && authorType === 'Bot',
        // One line each: a newline inside a name or login must not write a second `eligible=` into $GITHUB_OUTPUT.
        line         = text => text.replace(/[\r\n]+/g, ' '),
        refuse       = reason => ({eligible: false, disarm: dependabotPr, reason: line(reason)});

    if (String(killSwitch ?? '').trim().toLowerCase() === 'off') {
        return refuse('the repository variable NEO_AUTOMERGE_DEPENDABOT is off')
    }

    if (!dependabotPr) {
        return refuse(`the pull request was not opened by dependabot[bot] (author: ${author || 'unknown'})`)
    }

    if (sender !== 'dependabot[bot]') {
        return refuse(`this event was sent by ${sender || 'unknown'}, not dependabot[bot]`)
    }

    const
        names   = list(dependencyNames),
        anyName = admitsAny(allowList),
        outside = anyName ? [] : names.filter(name => !list(allowList).includes(name)),
        type    = String(updateType ?? '').replace(/^version-update:semver-/, '');

    if (!anyName && names.length === 0) return refuse('the update names no dependency');
    if (outside.length > 0) return refuse(`dependencies outside the allow-list: ${outside.join(', ')}`);
    if (!admitsAny(updateTypes) && !list(updateTypes).includes(type)) {
        return refuse(`update type '${updateType || 'none'}' is not one of: ${list(updateTypes).join(', ')}`)
    }

    return {eligible: true, disarm: false, reason: line(`${names.join(', ') || 'an unnamed dependency'}: a ${type || 'untyped'} update by dependabot[bot]`)}
}

// Canonicalized on both sides, as in check-version-bump.mjs: a symlinked argv[1] still runs the entrypoint.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    const {env} = process;

    const {eligible, disarm, reason} = decideAutomergeEligibility({
        author         : env.AUTOMERGE_AUTHOR,
        authorType     : env.AUTOMERGE_AUTHOR_TYPE,
        sender         : env.AUTOMERGE_SENDER,
        dependencyNames: env.AUTOMERGE_DEPENDENCY_NAMES,
        updateType     : env.AUTOMERGE_UPDATE_TYPE,
        allowList      : env.AUTOMERGE_ALLOW_LIST,
        updateTypes    : env.AUTOMERGE_UPDATE_TYPES,
        killSwitch     : env.AUTOMERGE_KILL_SWITCH
    });

    console.log(`${eligible ? 'Eligible' : 'Not eligible'}: ${reason}${disarm ? ' (an earlier arming is taken back)' : ''}`);

    if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `eligible=${eligible}\ndisarm=${disarm}\nreason=${reason}\n`)
}
