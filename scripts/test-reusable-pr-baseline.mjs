#!/usr/bin/env node
/**
 * @summary Mutation-sensitive contract checks for the reusable consumer PR baseline.
 *
 * GitHub validates YAML syntax when the branch is published; this suite protects the semantic
 * boundary that syntax cannot: one workflow-call entrypoint, read-only permissions, three stable
 * jobs, caller-repository checkout, the explicit dev-base decision, immutable archaeology
 * execution, and the supported materializer command. Each negative fixture removes one property
 * and must turn red.
 *
 * Run: `node scripts/test-reusable-pr-baseline.mjs`
 */

import assert          from 'node:assert/strict';
import {readFileSync}  from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const
    here         = dirname(fileURLToPath(import.meta.url)),
    root         = join(here, '..'),
    workflowPath = join(root, '.github', 'workflows', 'reusable-pr-baseline.yml'),
    pkg          = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

let mutationCount = 0;

/** @summary Isolates one top-level job so a sibling cannot satisfy its contract. */
function jobSource(source, jobId) {
    const marker = `  ${jobId}:\n`,
          start  = source.indexOf(marker);

    if (start === -1) return '';

    const after = source.slice(start + marker.length),
          next  = after.search(/^  [a-z0-9_-]+:\n/m);

    return marker + (next === -1 ? after : after.slice(0, next))
}

/**
 * @summary Returns named semantic-contract violations in one reusable-workflow source string.
 * @param {String} source
 * @returns {String[]}
 */
export function validateReusablePrBaseline(source) {
    const failures       = [],
          prBaseJob      = jobSource(source, 'pr-base'),
          skillsJob      = jobSource(source, 'skills-materialized'),
          archaeologyJob = jobSource(source, 'source-comment-archaeology'),
          required = [
              ['workflow-call trigger', /^on:\n  workflow_call:\n/m],
              ['read-only contents', /^permissions:\n  contents: read\n/m],
              ['PR-base job id', /^  pr-base:\n/m],
              ['PR-base stable name', /^    name: PR base\n/m],
              ['Skills job id', /^  skills-materialized:\n/m],
              ['Skills stable name', /^    name: Skills materialized\n/m],
              ['archaeology job id', /^  source-comment-archaeology:\n/m],
              ['archaeology stable name', /^    name: Source comment archaeology\n/m],
              ['required_base default', /^      required_base:\n[\s\S]*?^        default: dev\n/m],
              ['PR-base non-PR refusal', /github\.event_name != 'pull_request'/, prBaseJob],
              ['base mismatch refusal', /github\.event\.pull_request\.base\.ref != inputs\.required_base/, prBaseJob],
              ['caller checkout', /uses: actions\/checkout@v4/, skillsJob],
              ['Node input', /node-version: \$\{\{ inputs\.node_version \}\}/],
              ['lockfile install', /run: npm ci/, skillsJob],
              ['materializer check', /run: npx --no-install neo-agent-skills-materialize --check/, skillsJob],
              ['archaeology non-PR refusal', /github\.event_name != 'pull_request'/, archaeologyJob]
          ];

    required.forEach(([label, pattern, target = source]) => {
        if (!pattern.test(target)) failures.push(`missing ${label}`)
    });

    const triggerBlock = source.match(/^on:\n([\s\S]*?)\njobs:/m)?.[1] || '';

    if (!triggerBlock || /^  (?:pull_request|pull_request_target|push|workflow_dispatch|schedule):/m.test(triggerBlock)) {
        failures.push('direct event trigger present')
    }
    if (/^\s+repository:/m.test(source)) failures.push('checkout repository override present');
    if (!/ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/.test(archaeologyJob)) {
        failures.push('missing exact caller head')
    }
    if (!/fetch-depth: 0/.test(archaeologyJob)) failures.push('missing full history');
    if ((archaeologyJob.match(/BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/g) || []).length !== 2) {
        failures.push('missing exact base SHA')
    }
    if (!/git fetch --no-tags origin "\$\{BASE_SHA\}"/.test(archaeologyJob)) {
        failures.push('missing exact base fetch')
    }
    if (!archaeologyJob.includes(`SKILLS_VERSION: '${pkg.version}'`)) failures.push('package version drift');
    if ((archaeologyJob.match(/SKILLS_ROOT: \$\{\{ runner\.temp \}\}\/neo-agent-skills-source-comment-archaeology/g) || []).length !== 2) {
        failures.push('missing isolated runner root')
    }
    if (!/npm install --prefix "\$\{SKILLS_ROOT\}" --ignore-scripts --package-lock=false --no-save/.test(archaeologyJob)) {
        failures.push('missing isolated exact install')
    }
    if (!/"neo-agent-skills@\$\{SKILLS_VERSION\}"/.test(archaeologyJob)) failures.push('missing exact package spec');
    if (!/"\$\{SKILLS_ROOT\}\/node_modules\/\.bin\/neo-agent-skills-ticket-archaeology"/.test(archaeologyJob)) {
        failures.push('missing isolated absolute bin')
    }
    if (!/--base "\$\{BASE_SHA\}"/.test(archaeologyJob)) failures.push('missing exact base invocation');
    if (/continue-on-error:\s*true/.test(source)) failures.push('continue-on-error present');
    if (/^\s+[a-z_-]+: write(?:-all)?\s*$/m.test(source) ||
        /^permissions: (?:read|write)-all\s*$/m.test(source)) {
        failures.push('write permission present')
    }

    return failures
}

/** @summary Requires one mutation to violate the named semantic contract. */
function expectMutationFailure(label, source, mutate, expectedFailure) {
    const mutated  = mutate(source),
          failures = validateReusablePrBaseline(mutated);

    assert.notEqual(mutated, source, `${label}: fixture mutation changed nothing`);
    assert.ok(failures.includes(expectedFailure), `${label}: expected "${expectedFailure}", got ${failures.join(', ')}`);
    mutationCount++
}

const source = readFileSync(workflowPath, 'utf8');

assert.deepEqual(validateReusablePrBaseline(source), [], 'canonical reusable workflow violates its own contract');

expectMutationFailure('trigger', source,
    value => value.replace('  workflow_call:', '  pull_request:'),
    'missing workflow-call trigger');
expectMutationFailure('permissions', source,
    value => value.replace('contents: read', 'contents: write'),
    'missing read-only contents');
expectMutationFailure('write-all shorthand', source,
    value => value.replace('    runs-on: ubuntu-latest\n    steps:', '    runs-on: ubuntu-latest\n    permissions: write-all\n    steps:'),
    'write permission present');
expectMutationFailure('base job', source,
    value => value.replace('  pr-base:', '  removed-base:'),
    'missing PR-base job id');
expectMutationFailure('base decision', source,
    value => value.replace("github.event_name != 'pull_request' || github.event.pull_request.base.ref != inputs.required_base", 'false'),
    'missing PR-base non-PR refusal');
expectMutationFailure('Skills job', source,
    value => value.replace('  skills-materialized:', '  removed-skills:'),
    'missing Skills job id');
expectMutationFailure('caller checkout', source,
    value => value.replace('      - uses: actions/checkout@v4', '      - uses: actions/checkout@v4\n        with:\n          repository: neomjs/neo-agent-skills'),
    'checkout repository override present');
expectMutationFailure('materializer command', source,
    value => value.replace('neo-agent-skills-materialize --check', 'neo-agent-skills-materialize'),
    'missing materializer check');
expectMutationFailure('exact caller head', source,
    value => value.replace('ref: ${{ github.event.pull_request.head.sha }}', 'ref: dev'),
    'missing exact caller head');
expectMutationFailure('archaeology non-PR refusal', source,
    value => value.replace("if: ${{ github.event_name != 'pull_request' }}", 'if: false'),
    'missing archaeology non-PR refusal');
expectMutationFailure('full history', source,
    value => value.replace('fetch-depth: 0', 'fetch-depth: 1'),
    'missing full history');
expectMutationFailure('base fetch', source,
    value => value.replace('git fetch --no-tags origin "${BASE_SHA}"', 'git fetch origin dev'),
    'missing exact base fetch');
expectMutationFailure('base SHA', source,
    value => value.replace('BASE_SHA: ${{ github.event.pull_request.base.sha }}', 'BASE_SHA: dev'),
    'missing exact base SHA');
expectMutationFailure('base invocation', source,
    value => value.replace('--base "${BASE_SHA}"', '--base origin/dev'),
    'missing exact base invocation');
expectMutationFailure('package version', source,
    value => value.replace(`SKILLS_VERSION: '${pkg.version}'`, "SKILLS_VERSION: 'latest'"),
    'package version drift');
expectMutationFailure('runner isolation', source,
    value => value.replace('${{ runner.temp }}/neo-agent-skills-source-comment-archaeology', '${{ github.workspace }}/guard'),
    'missing isolated runner root');
expectMutationFailure('isolated install', source,
    value => value.replace('npm install --prefix "${SKILLS_ROOT}"', 'npm install'),
    'missing isolated exact install');
expectMutationFailure('exact package spec', source,
    value => value.replace('"neo-agent-skills@${SKILLS_VERSION}"', '"neo-agent-skills@latest"'),
    'missing exact package spec');
expectMutationFailure('absolute bin', source,
    value => value.replace('"${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-ticket-archaeology"', 'npx neo-agent-skills-ticket-archaeology'),
    'missing isolated absolute bin');
expectMutationFailure('continue on error', source,
    value => value.replace('    runs-on: ubuntu-latest\n    steps:', '    runs-on: ubuntu-latest\n    continue-on-error: true\n    steps:'),
    'continue-on-error present');

console.log(`reusable-pr-baseline: canonical contract + ${mutationCount} negative mutations passed`);
