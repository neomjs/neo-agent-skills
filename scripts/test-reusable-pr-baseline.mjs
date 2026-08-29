#!/usr/bin/env node
/**
 * @summary Mutation-sensitive contract checks for the reusable consumer PR baseline.
 *
 * GitHub validates YAML syntax when the branch is published; this suite protects the semantic
 * boundary that syntax cannot: one workflow-call entrypoint, read-only permissions, two stable
 * jobs, caller-repository checkout, the explicit dev-base decision, and the supported materializer
 * command. Each negative fixture removes one of those properties and must turn red.
 *
 * Run: `node scripts/test-reusable-pr-baseline.mjs`
 */

import assert          from 'node:assert/strict';
import {readFileSync}  from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const
    here         = dirname(fileURLToPath(import.meta.url)),
    workflowPath = join(here, '..', '.github', 'workflows', 'reusable-pr-baseline.yml');

/**
 * @summary Returns named semantic-contract violations in one reusable-workflow source string.
 * @param {String} source
 * @returns {String[]}
 */
export function validateReusablePrBaseline(source) {
    const failures = [],
          required = [
              ['workflow-call trigger', /^on:\n  workflow_call:\n/m],
              ['read-only contents', /^permissions:\n  contents: read\n/m],
              ['PR-base job id', /^  pr-base:\n/m],
              ['PR-base stable name', /^    name: PR base\n/m],
              ['Skills job id', /^  skills-materialized:\n/m],
              ['Skills stable name', /^    name: Skills materialized\n/m],
              ['required_base default', /^      required_base:\n[\s\S]*?^        default: dev\n/m],
              ['non-PR refusal', /github\.event_name != 'pull_request'/],
              ['base mismatch refusal', /github\.event\.pull_request\.base\.ref != inputs\.required_base/],
              ['caller checkout', /uses: actions\/checkout@v4/],
              ['Node input', /node-version: \$\{\{ inputs\.node_version \}\}/],
              ['lockfile install', /run: npm ci/],
              ['materializer check', /run: npx --no-install neo-agent-skills-materialize --check/]
          ];

    required.forEach(([label, pattern]) => {
        if (!pattern.test(source)) failures.push(`missing ${label}`)
    });

    const triggerBlock = source.match(/^on:\n([\s\S]*?)\njobs:/m)?.[1] || '';

    if (!triggerBlock || /^  (?:pull_request|pull_request_target|push|workflow_dispatch|schedule):/m.test(triggerBlock)) {
        failures.push('direct event trigger present')
    }
    if (/^\s+repository:/m.test(source)) failures.push('checkout repository override present');
    if (/^\s+[a-z_-]+: write\s*$/m.test(source)) failures.push('write permission present');

    return failures
}

/** @summary Requires one mutation to violate the named semantic contract. */
function expectMutationFailure(label, source, mutate, expectedFailure) {
    const mutated  = mutate(source),
          failures = validateReusablePrBaseline(mutated);

    assert.notEqual(mutated, source, `${label}: fixture mutation changed nothing`);
    assert.ok(failures.includes(expectedFailure), `${label}: expected "${expectedFailure}", got ${failures.join(', ')}`)
}

const source = readFileSync(workflowPath, 'utf8');

assert.deepEqual(validateReusablePrBaseline(source), [], 'canonical reusable workflow violates its own contract');

expectMutationFailure('trigger', source,
    value => value.replace('  workflow_call:', '  pull_request:'),
    'missing workflow-call trigger');
expectMutationFailure('permissions', source,
    value => value.replace('contents: read', 'contents: write'),
    'missing read-only contents');
expectMutationFailure('base job', source,
    value => value.replace('  pr-base:', '  removed-base:'),
    'missing PR-base job id');
expectMutationFailure('base decision', source,
    value => value.replace("github.event_name != 'pull_request'", 'false'),
    'missing non-PR refusal');
expectMutationFailure('Skills job', source,
    value => value.replace('  skills-materialized:', '  removed-skills:'),
    'missing Skills job id');
expectMutationFailure('caller checkout', source,
    value => value.replace('      - uses: actions/checkout@v4', '      - uses: actions/checkout@v4\n        with:\n          repository: neomjs/neo-agent-skills'),
    'checkout repository override present');
expectMutationFailure('materializer command', source,
    value => value.replace('neo-agent-skills-materialize --check', 'neo-agent-skills-materialize'),
    'missing materializer check');

console.log('reusable-pr-baseline: canonical contract + 7 negative mutations passed');
