#!/usr/bin/env node
/**
 * @summary Mutation-sensitive contract checks for the reusable consumer PR baseline.
 *
 * GitHub validates YAML syntax when the branch is published; this suite protects the semantic
 * boundary that syntax cannot: one workflow-call entrypoint, read-only permissions, four stable
 * jobs, caller-repository checkout, the explicit dev-base decision, immutable archaeology and
 * substrate-budget execution, and the supported materializer command. Each negative fixture removes
 * one property and must turn red.
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
          substrateJob   = jobSource(source, 'substrate-size'),
          prBodyJob      = jobSource(source, 'pr-body'),
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
              ['archaeology non-PR refusal', /github\.event_name != 'pull_request'/, archaeologyJob],
              ['PR-body job id', /^  pr-body:\n/m],
              ['PR-body stable name', /^    name: PR body\n/m],
              ['PR-body pull-request grant', /^      pull-requests: read\n/m, prBodyJob],
              ['PR-body non-PR refusal', /github\.event_name != 'pull_request'/, prBodyJob],
              ['PR-body live fetch', /github\.rest\.pulls\.get/, prBodyJob],
              ['PR-body agent-author boundary', /startsWith\(github\.event\.pull_request\.user\.login, 'neo-'\)/, prBodyJob],
              ['PR-body ai-label opt-in', /contains\(github\.event\.pull_request\.labels\.\*\.name, 'ai'\)/, prBodyJob],
              ['PR-body isolated absolute bin', /"\$\{SKILLS_ROOT\}\/node_modules\/\.bin\/neo-agent-skills-pr-body"/, prBodyJob],
              ['PR-body isolated runner root', /SKILLS_ROOT: \$\{\{ runner\.temp \}\}\/neo-agent-skills-pr-body/, prBodyJob],
              ['substrate job id', /^  substrate-size:\n/m],
              ['substrate stable name', /^    name: Substrate size\n/m],
              ['substrate non-PR refusal', /github\.event_name != 'pull_request'/, substrateJob],
              ['substrate caller head', /^\s*ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\s*$/m, substrateJob],
              ['substrate isolated exact install',
                  /npm install --prefix "\$\{SKILLS_ROOT\}" --ignore-scripts --package-lock=false --no-save/, substrateJob],
              ['substrate exact package spec', /"neo-agent-skills@\$\{SKILLS_VERSION\}"/, substrateJob],
              ['substrate isolated absolute bin',
                  /"\$\{SKILLS_ROOT\}\/node_modules\/\.bin\/neo-agent-skills-substrate-size"/, substrateJob],
              // The pin is the only thing separating "nothing to measure" from "measured nothing".
              // The guard resolves its root from cwd; outside the checkout every target is ENOENT,
              // which the negative-space contract reports as N/A — so a bare invocation from any
              // other directory GREENS. Asserted here because it is a silent failure everywhere else.
              //
              // ANCHORED TO END-OF-LINE, and that is the whole point of the assertion. The first
              // version matched the pin as an unanchored substring, so `${{ github.workspace }}/docs`
              // satisfied it — a wrong root passing the contract that exists to forbid wrong roots
              // (RA-2, PR #26). A suffix on a PATH value silently redirects; substring presence can
              // never express "and nothing follows".
              ['substrate measurement pinned to the caller workspace',
                  /^\s*working-directory: \$\{\{ github\.workspace \}\}\s*$/m, substrateJob]
          ];

    required.forEach(([label, pattern, target = source]) => {
        if (!pattern.test(target)) failures.push(`missing ${label}`)
    });

    const triggerBlock = source.match(/^on:\n([\s\S]*?)\njobs:/m)?.[1] || '';

    if (!triggerBlock || /^  (?:pull_request|pull_request_target|push|workflow_dispatch|schedule):/m.test(triggerBlock)) {
        failures.push('direct event trigger present')
    }
    if (/^\s+repository:/m.test(source)) failures.push('checkout repository override present');
    if (!/^\s*ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\s*$/m.test(archaeologyJob)) {
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
    // Anchored for the same reason as the workspace pin: `…-source-comment-archaeology-x` is a
    // DIFFERENT install root that an unanchored match accepts.
    if ((archaeologyJob.match(/^\s*SKILLS_ROOT: \$\{\{ runner\.temp \}\}\/neo-agent-skills-source-comment-archaeology\s*$/gm) || []).length !== 2) {
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
    if (!substrateJob.includes(`SKILLS_VERSION: '${pkg.version}'`)) failures.push('substrate package version drift');
    if ((substrateJob.match(/^\s*SKILLS_ROOT: \$\{\{ runner\.temp \}\}\/neo-agent-skills-substrate-size\s*$/gm) || []).length !== 2) {
        failures.push('missing substrate isolated runner root')
    }

    // The guard is invoked bare. Every argument it accepts narrows what gets measured, so a steered
    // invocation in a shared baseline is the same hole as running the caller's own copy: the tree
    // under review decides how hard it is judged. The limit is not an option at all; --root would
    // point the measurement somewhere other than the caller head.
    if (/neo-agent-skills-substrate-size"[^\n]*\S/.test(substrateJob)) {
        failures.push('substrate guard invoked with arguments')
    }


// ── The PR-body job's own invariants ───────────────────────────────────────────────────────────
//
// Two properties this job has and the others do not, both load-bearing:
//
//   NO CHECKOUT — its whole input is the pull-request body, so the tree under review never enters
//   the job. Adding a checkout would hand the diff a surface to shadow the guard from.
//
//   THE BODY NEVER REACHES A SHELL — it is fetched in JavaScript and written to a file; `run:`
//   steps receive only a workflow-owned path. A pull-request body is attacker-controlled text, so
//   interpolating it into `run:` is a shell-injection primitive. Carried from `neomjs/neo` PR
//   #17917 AC-4, which was the only place this property had ever been written down.
// §9 is the AGENT pull-request protocol, so this job judges agent-authored PRs only — the boundary
// the deleted `agent-pr-body-lint.yml` carried. Widening it to every contributor holds human PRs to
// a template nobody agreed to, which is a policy change rather than a port.
//
// COUNTED, not merely present: the boundary must sit on BOTH judging steps. One gated and one not
// still runs the agent template against a human PR through whichever half lost its condition, and a
// presence check passes on a single surviving occurrence.
if ((prBodyJob.match(/if: \$\{\{ startsWith\(github\.event\.pull_request\.user\.login, 'neo-'\)/g) || []).length !== 2) {
    failures.push('PR-body author boundary missing from a judging step')
}
if (/uses: actions\/checkout/.test(prBodyJob)) failures.push('PR-body job checks out the caller tree');

    // Comments are stripped FIRST. Both checks below name the construct they forbid, so a detector
    // reading raw text flags this job's own JSDoc — the #28 defect inverted: prose describing an
    // anchor satisfied it there; here prose describing a hazard reports it. Measured, not guessed:
    // the first revision of these two rows failed against the canonical file for exactly that.
    const prBodyCode = prBodyJob.split('\n').filter(line => !/^\s*#/.test(line)).join('\n');

    // A body reaching a shell means an EXPRESSION interpolated into a run: line, not the substring
    // "body" appearing somewhere in the job. Scoped per line, so it cannot span steps.
    if (prBodyCode.split('\n').some(line => /\$\{\{[^}]*\bbody\b/.test(line))) {
        failures.push('PR-body content reaches a run: block')
    }
// The event snapshot is the defect `neomjs/neo#17431` records: a re-run replays stale text, so a
// corrected body can never go green and an edited one keeps a stale green.
if (/context\.payload\.pull_request\.body/.test(prBodyCode)) failures.push('PR-body read from the event snapshot');

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
expectMutationFailure('substrate job', source,
    value => value.replace('  substrate-size:', '  removed-substrate:'),
    'missing substrate job id');
expectMutationFailure('substrate stable name', source,
    value => value.replace('    name: Substrate size', '    name: Substrate budget'),
    'missing substrate stable name');
expectMutationFailure('substrate non-PR refusal', source,
    value => value.replace(
        "      - name: Reject a non-PR caller\n        if: ${{ github.event_name != 'pull_request' }}\n        run: exit 1\n\n      # The head tree",
        '      # The head tree'),
    'missing substrate non-PR refusal');
expectMutationFailure('substrate caller head', source,
    value => value.replace(
        '        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n\n      - uses: actions/setup-node@v4\n        with:\n          node-version: ${{ inputs.node_version }}\n\n      # The guard runs from runner.temp',
        '\n      - uses: actions/setup-node@v4\n        with:\n          node-version: ${{ inputs.node_version }}\n\n      # The guard runs from runner.temp'),
    'missing substrate caller head');
expectMutationFailure('substrate runner isolation', source,
    value => value.replace(/\$\{\{ runner\.temp \}\}\/neo-agent-skills-substrate-size/g, '${{ github.workspace }}/guard'),
    'missing substrate isolated runner root');
expectMutationFailure('substrate package version', source,
    value => value.replace(
        "          SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-substrate-size\n          SKILLS_VERSION: '0.1.2'",
        "          SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-substrate-size\n          SKILLS_VERSION: 'latest'"),
    'substrate package version drift');
// Anchored on the STEP NAME rather than the comment that follows it. The archaeology job carries a
// byte-identical install line, so this fixture needs something after it to disambiguate — it used
// the prose `# Invoked bare`, and editing that comment silently turned the mutation into a no-op,
// which `expectMutationFailure` then reported as a broken fixture rather than a passing contract.
// A negative fixture coupled to prose fails the moment prose is correct-but-different.
expectMutationFailure('substrate isolated install', source,
    value => value.replace(
        /(      - name: Install immutable substrate guard\n[\s\S]*?)          npm install --prefix "\$\{SKILLS_ROOT\}" --ignore-scripts --package-lock=false --no-save\n          "neo-agent-skills@\$\{SKILLS_VERSION\}"/,
        '$1          npm install "neo-agent-skills@${SKILLS_VERSION}"'),
    'missing substrate isolated exact install');
expectMutationFailure('substrate absolute bin', source,
    value => value.replace(
        'run: "${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-substrate-size"',
        'run: npx neo-agent-skills-substrate-size'),
    'missing substrate isolated absolute bin');
expectMutationFailure('substrate steered invocation', source,
    value => value.replace(
        'run: "${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-substrate-size"',
        'run: "${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-substrate-size" --root docs'),
    'substrate guard invoked with arguments');
// ── RA-2: any root OTHER than the caller workspace must red ────────────────────────────────────
//
// The three below are one defect class, not three bugs. Each asserts a PATH, and each was written
// as an unanchored substring — so appending a suffix produced a DIFFERENT root that satisfied the
// contract forbidding different roots. A wrong `working-directory` is the dangerous one: the guard
// resolves its targets from cwd, so outside the checkout every target is ENOENT, the negative-space
// contract reports N/A, and the job GREENS having measured nothing.
//
// A suffix mutation is the only shape that catches this. Replacing the value wholesale (the shape
// every other mutation here uses) reds against an unanchored pattern too, so it cannot distinguish
// an anchored assertion from an unanchored one — it would have passed before this fix and after it.
expectMutationFailure('substrate workspace pin — suffixed root', source,
    value => value.replace(
        'working-directory: ${{ github.workspace }}',
        'working-directory: ${{ github.workspace }}/docs'),
    'missing substrate measurement pinned to the caller workspace');
expectMutationFailure('substrate runner root — suffixed root', source,
    value => value.replace(
        'SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-substrate-size',
        'SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-substrate-size-shadow'),
    'missing substrate isolated runner root');
expectMutationFailure('archaeology runner root — suffixed root', source,
    value => value.replace(
        'SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-source-comment-archaeology',
        'SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-source-comment-archaeology-shadow'),
    'missing isolated runner root');


expectMutationFailure('PR-body author boundary dropped from one step', source,
    value => value.replace("        if: ${{ startsWith(github.event.pull_request.user.login, 'neo-') || contains(github.event.pull_request.labels.*.name, 'ai') }}\n        uses: actions/github-script@v7", '        uses: actions/github-script@v7'),
    'PR-body author boundary missing from a judging step');
expectMutationFailure('PR-body ai-label opt-in dropped', source,
    value => value.split(" || contains(github.event.pull_request.labels.*.name, 'ai')").join(''),
    'missing PR-body ai-label opt-in');

expectMutationFailure('PR-body job removed', source,
    value => value.replace('  pr-body:', '  removed-pr-body:'),
    'missing PR-body job id');
expectMutationFailure('PR-body stable name', source,
    value => value.replace('    name: PR body\n', '    name: Body lint\n'),
    'missing PR-body stable name');
expectMutationFailure('PR-body event snapshot', source,
    value => value.replace('            const {data} = await github.rest.pulls.get({', '            const data = context.payload.pull_request.body;\n            const {data: _} = await github.rest.pulls.get({'),
    'PR-body read from the event snapshot');
expectMutationFailure('PR-body checkout added', source,
    value => value.replace('      - name: Install immutable PR-body guard', '      - uses: actions/checkout@v4\n\n      - name: Install immutable PR-body guard'),
    'PR-body job checks out the caller tree');
expectMutationFailure('PR-body reaches a shell', source,
    value => value.replace('          --body-file "${BODY_FILE}" ${DRAFT_FLAG}', '          --body-file "${{ github.event.pull_request.body }}" ${DRAFT_FLAG}'),
    'PR-body content reaches a run: block');

expectMutationFailure('continue on error', source,
    value => value.replace('    runs-on: ubuntu-latest\n    steps:', '    runs-on: ubuntu-latest\n    continue-on-error: true\n    steps:'),
    'continue-on-error present');

console.log(`reusable-pr-baseline: canonical contract + ${mutationCount} negative mutations passed`);
