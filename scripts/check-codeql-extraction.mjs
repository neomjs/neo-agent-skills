#!/usr/bin/env node
/**
 * @summary CI gate that fails when CodeQL silently dropped a source file for a parse error.
 *
 * A file CodeQL cannot parse produces zero alerts, so it clears the code-scanning alert gate:
 * "unparseable" and "clean" look the same there, and the analyses API's `warning` field stays empty
 * on a run whose Analyze log reports the drop. The Analyze job's log is the one surface that carries
 * the extractor's own verdict:
 *   `Could not process some files due to syntax errors`  (the group header)
 *   `  * <path>#L<line>C<col>:<col>: A parse error occurred: …`  (one bullet per dropped file)
 *
 * The `extraction-guard` job of `.github/workflows/reusable-codeql.yml` fetches this file at that
 * workflow's own commit and runs it after every Analyze leg completed. Ported from the engine's
 * `buildScripts/util/check-codeql-extraction.mjs` (neomjs/neo#15370, #16075, #20035), with the
 * Analyze-leg match widened for a called workflow, whose jobs carry the caller's prefix.
 * Dependency-free: Node built-ins and global `fetch` only, so the guard job needs no install.
 *
 * Run inside a `needs: analyze` job: `node check-codeql-extraction.mjs`
 * (reads `GITHUB_REPOSITORY`, `GITHUB_RUN_ID` and `GITHUB_TOKEN` with `actions: read`).
 */

import {realpathSync}  from 'node:fs';
import {fileURLToPath} from 'node:url';

/**
 * The extractor's "at least one file was dropped" header. Its presence alone fails the gate, so a drop
 * cannot pass when the per-file bullet format drifts.
 * @type {String}
 */
export const EXTRACTION_GROUP_MARKER = 'Could not process some files due to syntax errors';

/**
 * One dropped file per bullet: the path before its `#L…` location suffix.
 * @type {RegExp}
 */
export const PER_FILE_PARSE_ERROR = /\*\s+([^\s#:]+)\S*\s+A parse error occurred/gi;

/**
 * An Analyze leg by job name: `Analyze (<language>)` directly, or `<caller job> / Analyze (<language>)`
 * when the lane runs as a called workflow. The guard's own job never matches.
 * @type {RegExp}
 */
export const ANALYZE_JOB = /(?:^|\/ )Analyze \(/;

/**
 * @summary Decides from one Analyze log whether CodeQL dropped a file, and names the files it named.
 * @param {String} logText The job's raw log; the timestamp Actions prepends to each line is tolerated.
 * @returns {{hasErrors: Boolean, files: String[], groupMarkerSeen: Boolean}}
 */
export function findCodeqlExtractionErrors(logText) {
    const
        text  = String(logText ?? ''),
        files = [];

    for (const match of text.matchAll(PER_FILE_PARSE_ERROR)) {
        const file = match[1]?.trim();
        file && files.push(file)
    }

    const groupMarkerSeen = text.includes(EXTRACTION_GROUP_MARKER);

    return {hasErrors: groupMarkerSeen || files.length > 0, files: [...new Set(files)], groupMarkerSeen}
}

/**
 * @summary Aggregates every Analyze leg: a drop in any language leg is a drop.
 * @param {Array<{name: String, log: String}>} legs One entry per completed Analyze leg.
 * @returns {{hasErrors: Boolean, dropped: Array<{leg: String, file: String|null}>, legCount: Number}}
 *     `file` is `null` for a leg whose header fired but whose bullets did not parse.
 */
export function summarizeExtractionAcrossLegs(legs) {
    const
        rows    = Array.isArray(legs) ? legs : [],
        dropped = [];

    for (const {name, log} of rows) {
        const {hasErrors, files, groupMarkerSeen} = findCodeqlExtractionErrors(log);

        if (!hasErrors) continue;

        if (files.length) {
            files.forEach(file => dropped.push({leg: name, file}))
        } else if (groupMarkerSeen) {
            dropped.push({leg: name, file: null})
        }
    }

    return {hasErrors: dropped.length > 0, dropped, legCount: rows.length}
}

/**
 * @summary Reads the raw log of every Analyze leg of this run through the Actions API.
 *
 * The jobs view can trail a finished `needs: analyze` dependency by seconds, so a leg not yet reported
 * `completed` is re-read on the same backoff. A leg seen once stays on the roster until its log is
 * read. An unread leg is an uncertified leg: an exhausted wait or a failed fetch throws.
 * @param {Object} params
 * @param {String} params.repo `owner/name`.
 * @param {String|Number} params.runId
 * @param {String} params.token A token with `actions: read`.
 * @param {RegExp} [params.jobNameMatch=ANALYZE_JOB]
 * @param {Function} [params.fetchImpl=globalThis.fetch]
 * @param {Function} [params.sleep] Backoff seam.
 * @param {Number[]} [params.retryDelays] Delay before each retry; bounds the attempts per phase.
 * @returns {Promise<Array<{name: String, log: String}>>}
 */
export async function fetchAnalyzeJobLogs({
    repo,
    runId,
    token,
    jobNameMatch = ANALYZE_JOB,
    fetchImpl    = globalThis.fetch,
    sleep        = delay => new Promise(resolve => setTimeout(resolve, delay)),
    retryDelays  = [1000, 2000, 4000, 8000, 16000, 32000]
}) {
    const
        base        = 'https://api.github.com',
        headers     = {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'},
        isRetryable = status => status === 404 || status >= 500,
        isPending   = leg => leg.status !== 'completed',
        observed    = new Map(),
        observe     = legs => legs.forEach(leg => observed.set(leg.id ?? leg.name, leg)),
        pending     = () => [...observed.values()].filter(isPending),
        readLegs    = async () => {
            const jobsRes = await fetchImpl(`${base}/repos/${repo}/actions/runs/${runId}/jobs?per_page=100`, {headers});
            if (!jobsRes.ok) throw new Error(`fetch run jobs failed: ${jobsRes.status} ${jobsRes.statusText}`);

            const
                {jobs = []} = await jobsRes.json(),
                legs        = jobs.filter(job => jobNameMatch.test(job.name));

            if (!legs.length) throw new Error(`no job matching ${jobNameMatch} in run ${runId} (jobs: ${jobs.map(job => job.name).join(', ')})`);

            return legs
        };

    observe(await readLegs());

    let waitedMs = 0;

    for (let reads = 1; pending().length; reads++) {
        const retryDelay = retryDelays[reads - 1];

        if (retryDelay == null) {
            const [leg] = pending();
            throw new Error(`Analyze leg "${leg.name}" is ${leg.status || 'missing status'}, not completed, after ${reads} reads over ${waitedMs}ms`)
        }

        await sleep(retryDelay);
        waitedMs += retryDelay;
        observe(await readLegs())
    }

    return Promise.all([...observed.values()].map(async leg => {
        let elapsedMs = 0;

        for (let attempt = 1; ; attempt++) {
            const logRes = await fetchImpl(`${base}/repos/${repo}/actions/jobs/${leg.id}/logs`, {headers, redirect: 'follow'});

            if (logRes.ok) return {name: leg.name, log: await logRes.text()};

            const retryDelay = retryDelays[attempt - 1];

            if (!isRetryable(logRes.status) || retryDelay == null) {
                const exhausted = isRetryable(logRes.status) ? ` after ${attempt} attempts over ${elapsedMs}ms` : '';
                throw new Error(`fetch Analyze leg "${leg.name}" log failed${exhausted}: ${logRes.status} ${logRes.statusText}`)
            }

            await sleep(retryDelay);
            elapsedMs += retryDelay
        }
    }))
}

/**
 * @summary Runs the gate and returns its exit code: `0` clean, `1` a file was dropped, `2` the logs
 * could not be read. It never certifies clean from a surface it did not read.
 * @param {Object} [options]
 * @param {Object} [options.env=process.env]
 * @param {Function} [options.fetchImpl]
 * @param {Function} [options.sleep]
 * @param {Function} [options.log=console.log]
 * @param {Function} [options.error=console.error]
 * @returns {Promise<Number>}
 */
export async function runGuard({env = process.env, fetchImpl, sleep, log = console.log, error = console.error} = {}) {
    const {GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: runId, GITHUB_TOKEN: token} = env;

    if (!repo || !runId || !token) {
        error('check-codeql-extraction: GITHUB_REPOSITORY, GITHUB_RUN_ID and GITHUB_TOKEN are required (run inside a needs: analyze job).');
        return 2
    }

    let legs;

    try {
        legs = await fetchAnalyzeJobLogs({repo, runId, token, ...(fetchImpl && {fetchImpl}), ...(sleep && {sleep})})
    } catch (cause) {
        error(`check-codeql-extraction: could not read an Analyze leg's log; refusing to certify clean from an unread surface.\n  ${cause.message}`);
        return 2
    }

    const {hasErrors, dropped, legCount} = summarizeExtractionAcrossLegs(legs);

    if (hasErrors) {
        error(`CodeQL dropped source file(s) for parse errors across ${legCount} Analyze leg(s):`);
        dropped.forEach(({leg, file}) => error(
            file ? `  - [${leg}] ${file}` : `  - [${leg}] (group header present; per-file names not parsed, open the leg's log)`
        ));
        error('A file CodeQL cannot parse emits no alerts and clears the alert gate, so this never surfaces as a finding. Fix the parse error, or exclude the file explicitly.');
        return 1
    }

    log(`CodeQL extraction clean: no file dropped across ${legCount} Analyze leg(s).`);
    return 0
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    process.exit(await runGuard())
}
