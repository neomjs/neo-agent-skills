#!/usr/bin/env node
/**
 * @summary Witnesses for the CodeQL extraction guard (`check-codeql-extraction.mjs`).
 *
 * The guard exists to turn a dropped file red. Each arm hands it the Analyze log or the Actions API
 * answer that decides one verdict, and asserts that verdict and its exit code. The drop log uses the
 * format of a real CodeQL extraction failure (the engine's neomjs/neo#15370).
 *
 * Run: `node scripts/test-check-codeql-extraction.mjs`
 */

import assert from 'node:assert/strict';
import {
    ANALYZE_JOB,
    fetchAnalyzeJobLogs,
    findCodeqlExtractionErrors,
    runGuard,
    summarizeExtractionAcrossLegs
} from './check-codeql-extraction.mjs';

const
    DROPPED   = 'scripts/broken.mjs',
    DROP_LOG  = [
        '2026-11-11T15:00:00.0000000Z Could not process some files due to syntax errors',
        `2026-11-11T15:00:00.0000000Z   * ${DROPPED}#L12C7:7: A parse error occurred: Unexpected token`
    ].join('\n'),
    CLEAN_LOG = '2026-11-11T15:00:00.0000000Z Finalizing database.\n2026-11-11T15:00:01.0000000Z Analysis produced the following metric data.',
    ENV       = {GITHUB_REPOSITORY: 'neomjs/neo-agent-skills', GITHUB_RUN_ID: '42', GITHUB_TOKEN: 'token'},
    // A called workflow's jobs carry the caller's prefix; the guard's own job shares the run.
    JOBS      = [
        {id: 1, name: 'CodeQL / Analyze (javascript-typescript)', status: 'completed'},
        {id: 2, name: 'CodeQL / Analyze (actions)',               status: 'completed'},
        {id: 3, name: 'CodeQL / CodeQL extraction guard',         status: 'in_progress'}
    ],
    noSleep   = async () => {},
    tests     = [];

/**
 * @summary A fake Actions API: the run's jobs (one listing per read, the last repeating), then each leg's log by id.
 * @param {Object} options
 * @param {Array<Object[]>} options.jobPages
 * @param {Object<Number, String>} options.logs Job id to log; a missing id answers 404.
 * @returns {Function} A `fetch` stand-in.
 */
function fakeApi({jobPages, logs}) {
    let reads = 0;

    return async url => {
        if (url.includes('/actions/runs/')) {
            const jobs = jobPages[Math.min(reads++, jobPages.length - 1)];
            return {ok: true, json: async () => ({jobs})}
        }

        const id = Number(url.match(/\/actions\/jobs\/(\d+)\/logs/)[1]);

        return id in logs
            ? {ok: true, text: async () => logs[id]}
            : {ok: false, status: 404, statusText: 'Not Found'}
    }
}

/**
 * @summary Collects console-shaped output for assertions.
 * @returns {{lines: String[], fn: Function}}
 */
function capture() {
    const lines = [];
    return {lines, fn: (...args) => lines.push(args.join(' '))}
}

const test = (name, fn) => tests.push({name, fn});

test('names the dropped file from a real-format Analyze log', () => {
    assert.deepEqual(findCodeqlExtractionErrors(DROP_LOG), {hasErrors: true, files: [DROPPED], groupMarkerSeen: true})
});

test('fails on the group header alone when the bullet format drifts', () => {
    const {hasErrors, files} = findCodeqlExtractionErrors('Could not process some files due to syntax errors\n  - something else');

    assert.equal(hasErrors, true);
    assert.deepEqual(files, [])
});

test('passes a clean log', () => {
    assert.equal(findCodeqlExtractionErrors(CLEAN_LOG).hasErrors, false)
});

test('a drop in any language leg is a drop', () => {
    const verdict = summarizeExtractionAcrossLegs([{name: 'Analyze (actions)', log: CLEAN_LOG}, {name: 'Analyze (javascript-typescript)', log: DROP_LOG}]);

    assert.equal(verdict.hasErrors, true);
    assert.deepEqual(verdict.dropped, [{leg: 'Analyze (javascript-typescript)', file: DROPPED}]);
    assert.equal(verdict.legCount, 2)
});

test('matches direct and called Analyze legs, never the guard job', () => {
    ['Analyze (actions)', 'CodeQL / Analyze (javascript-typescript)'].forEach(name => assert.match(name, ANALYZE_JOB));
    ['CodeQL / CodeQL extraction guard', 'Reanalyze (actions)', 'Analyze'].forEach(name => assert.doesNotMatch(name, ANALYZE_JOB))
});

test('reads only the Analyze legs of a called run, re-reading one the jobs view still reports running', async () => {
    const
        running = JOBS.map(job => job.id === 2 ? {...job, status: 'in_progress'} : job),
        legs    = await fetchAnalyzeJobLogs({
            repo     : ENV.GITHUB_REPOSITORY,
            runId    : ENV.GITHUB_RUN_ID,
            token    : ENV.GITHUB_TOKEN,
            fetchImpl: fakeApi({jobPages: [running, JOBS], logs: {1: CLEAN_LOG, 2: CLEAN_LOG}}),
            sleep    : noSleep
        });

    assert.deepEqual(legs.map(leg => leg.name), ['CodeQL / Analyze (javascript-typescript)', 'CodeQL / Analyze (actions)'])
});

test('exits 1 and names the file when a leg dropped one', async () => {
    const error = capture();
    const code  = await runGuard({env: ENV, fetchImpl: fakeApi({jobPages: [JOBS], logs: {1: DROP_LOG, 2: CLEAN_LOG}}), sleep: noSleep, log: () => {}, error: error.fn});

    assert.equal(code, 1);
    assert.ok(error.lines.some(line => line.includes(`[CodeQL / Analyze (javascript-typescript)] ${DROPPED}`)), error.lines.join('\n'))
});

test('exits 0 when every leg extracted cleanly', async () => {
    const log  = capture();
    const code = await runGuard({env: ENV, fetchImpl: fakeApi({jobPages: [JOBS], logs: {1: CLEAN_LOG, 2: CLEAN_LOG}}), sleep: noSleep, log: log.fn, error: () => {}});

    assert.equal(code, 0);
    assert.match(log.lines.join('\n'), /across 2 Analyze leg/)
});

test('exits 2, never 0, when a leg log cannot be read', async () => {
    const code = await runGuard({env: ENV, fetchImpl: fakeApi({jobPages: [JOBS], logs: {1: CLEAN_LOG}}), sleep: noSleep, log: () => {}, error: () => {}});

    assert.equal(code, 2)
});

test('exits 2 without the run environment', async () => {
    assert.equal(await runGuard({env: {}, log: () => {}, error: () => {}}), 2)
});

let failed = 0;

for (const {name, fn} of tests) {
    try {
        await fn();
        console.log(`ok   ${name}`)
    } catch (cause) {
        failed++;
        console.error(`FAIL ${name}\n     ${cause.message}`)
    }
}

console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0)
