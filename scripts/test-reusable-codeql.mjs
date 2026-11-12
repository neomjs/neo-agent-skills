#!/usr/bin/env node
/**
 * @summary Contract checks for the shared CodeQL lane (`reusable-codeql.yml`) and Skills' own caller (`codeql.yml`).
 *
 * GitHub validates YAML syntax when the branch is published. These checks hold what syntax cannot:
 * - one `workflow_call` entrypoint whose `languages` input drives the matrix;
 * - `build-mode: none` and one `/language:<language>` category per leg, Default Setup's own category, so
 *   a repository's alert history carries over;
 * - least-privilege permissions per job;
 * - an extraction guard that runs after Analyze, fetched at the workflow's own commit, run from
 *   runner.temp and never checked out.
 *
 * Each negative fixture removes one property and must turn red.
 *
 * Run: `node scripts/test-reusable-codeql.mjs`
 */

import assert          from 'node:assert/strict';
import {readFileSync}  from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const
    root      = join(dirname(fileURLToPath(import.meta.url)), '..'),
    workflows = join(root, '.github', 'workflows'),
    reusable  = readFileSync(join(workflows, 'reusable-codeql.yml'), 'utf8'),
    caller    = readFileSync(join(workflows, 'codeql.yml'), 'utf8'),
    jobOf     = (source, job) => source.split(new RegExp(`^  ${job}:\\s*$`, 'm'))[1]?.split(/^  \S[^:\n]*:\s*$/m)[0] ?? '',
    tests     = [];

/**
 * The lane's required properties, each a predicate over the workflow source.
 * @type {Object<String, Function>}
 */
const LANE = {
    'workflow_call entrypoint'      : src => /^on:\s*\n\s+workflow_call:\s*$/m.test(src),
    'languages input drives matrix' : src => /^\s{6}languages:\s*$/m.test(src) && /language: \$\{\{ fromJSON\(inputs\.languages\) \}\}/.test(src),
    'no default permissions'        : src => /^permissions: \{\}\s*$/m.test(src),
    'build-mode none'               : src => /^\s*build-mode: none\s*$/m.test(src),
    'per-language category'         : src => /^\s*category: \/language:\$\{\{ matrix\.language \}\}\s*$/m.test(src),
    'analyze may upload'            : src => /security-events: write/.test(jobOf(src, 'analyze')),
    'analyze reads contents only'   : src => /contents: read/.test(jobOf(src, 'analyze')) && !/contents: write/.test(jobOf(src, 'analyze')),
    'guard runs after analyze'      : src => /^\s*needs: analyze\s*$/m.test(jobOf(src, 'extraction-guard')),
    'guard reads job logs only'     : src => /actions: read/.test(jobOf(src, 'extraction-guard')) && !/: write/.test(jobOf(src, 'extraction-guard')),
    'guard fetched at its own commit': src => /WORKFLOW_SHA: \$\{\{ job\.workflow_sha \}\}/.test(jobOf(src, 'extraction-guard'))
        && /contents\/scripts\/check-codeql-extraction\.mjs\?ref=\$\{WORKFLOW_SHA\}/.test(jobOf(src, 'extraction-guard')),
    'guard runs from runner.temp'   : src => /^\s*run: node "\$\{RUNNER_TEMP\}\/check-codeql-extraction\.mjs"\s*$/m.test(jobOf(src, 'extraction-guard')),
    'guard never checks out'        : src => !/actions\/checkout/.test(jobOf(src, 'extraction-guard'))
};

/**
 * Skills' own caller: the lane on itself, on every route into `dev`.
 * @type {Object<String, Function>}
 */
const CALLER = {
    'calls the local lane'     : src => /^\s*uses: \.\/\.github\/workflows\/reusable-codeql\.yml\s*$/m.test(src),
    'both Skills languages'    : src => /languages: '\["javascript-typescript", "actions"\]'/.test(src),
    'push and pull_request dev': src => /^\s{2}push:\s*\n\s{4}branches: \[dev\]/m.test(src) && /^\s{2}pull_request:\s*\n\s{4}branches: \[dev\]/m.test(src),
    'weekly schedule'          : src => /^\s{2}schedule:\s*$/m.test(src),
    'grants the upload'        : src => /^\s{2}security-events: write\s*$/m.test(src)
};

const failing = (properties, src) => Object.entries(properties).filter(([, holds]) => !holds(src)).map(([name]) => name);
const test    = (name, fn) => tests.push({name, fn});

test('the lane holds every property', () => assert.deepEqual(failing(LANE, reusable), []));
test("Skills' caller holds every property", () => assert.deepEqual(failing(CALLER, caller), []));

// One mutation per property that the lane must not lose.
[
    ['per-language category',          src => src.replace(/category: \/language:\$\{\{ matrix\.language \}\}/, 'category: /codeql')],
    ['build-mode none',                src => src.replace(/^(\s*)build-mode: none$/m, '$1build-mode: autobuild')],
    ['no default permissions',         src => src.replace('permissions: {}', 'permissions: write-all')],
    ['guard runs after analyze',       src => src.replace('needs: analyze', '')],
    ['guard never checks out',         src => src.replace('      - uses: actions/setup-node@v7', '      - uses: actions/checkout@v7\n      - uses: actions/setup-node@v7')],
    ['guard fetched at its own commit',src => src.replace('job.workflow_sha', 'github.sha')],
    ['guard reads job logs only',      src => src.replace('actions: read  # read the Analyze', 'actions: write # read the Analyze')]
].forEach(([property, mutate]) => test(`turns red without: ${property}`, () => {
    const mutated = mutate(reusable);

    assert.notEqual(mutated, reusable, `the mutation for "${property}" no longer applies to the workflow`);
    assert.ok(failing(LANE, mutated).includes(property), `"${property}" stayed green after the mutation`)
}));

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
