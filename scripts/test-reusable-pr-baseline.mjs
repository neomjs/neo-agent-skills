#!/usr/bin/env node
/**
 * @summary Mutation-sensitive contract checks for the reusable consumer PR baseline.
 *
 * GitHub validates YAML syntax when the branch is published; this suite protects the semantic
 * boundary that syntax cannot: one workflow-call entrypoint, read-only permissions, a caller held to a
 * release tag, stable jobs, caller-repository checkout, the explicit dev-base decision, immutable archaeology and
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
          releaseRefJob  = jobSource(source, 'release-ref'),
          prBaseJob      = jobSource(source, 'pr-base'),
          skillsJob      = jobSource(source, 'skills-materialized'),
          archaeologyJob = jobSource(source, 'source-comment-archaeology'),
          substrateJob   = jobSource(source, 'substrate-size'),
          overridesJob   = jobSource(source, 'npm-overrides'),
          secretsJob     = jobSource(source, 'secrets'),
          authorshipJob  = jobSource(source, 'commit-authorship'),
          // The one checkout of another repository: the caller team's roster, read beside the caller's tree
          rosterStep     = authorshipJob.match(/      - name: Checkout the team roster\n[\s\S]*?(?=\n      - |\s*$)/)?.[0] || '',
          prBodyJob      = jobSource(source, 'pr-body'),
          required = [
              ['workflow-call trigger', /^on:\n  workflow_call:\n/m],
              ['read-only contents', /^permissions:\n  contents: read\n/m],
              ['release-ref job id', /^  release-ref:\n/m],
              ['release-ref stable name', /^    name: Release ref\n/m],
              // `job.workflow_ref` names THIS reusable file's ref; `github.workflow_ref` is the caller's own.
              ['release-ref reads its own ref', /WORKFLOW_REF: \$\{\{ job\.workflow_ref \}\}/, releaseRefJob],
              ['release-ref requires a semver tag', /=~ @refs\/tags\/v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$ \]\]/, releaseRefJob],
              ['PR-base job id', /^  pr-base:\n/m],
              ['PR-base stable name', /^    name: PR base\n/m],
              ['Skills job id', /^  skills-materialized:\n/m],
              ['Skills stable name', /^    name: Skills materialized\n/m],
              ['archaeology job id', /^  source-comment-archaeology:\n/m],
              ['archaeology stable name', /^    name: Source comment archaeology\n/m],
              ['required_base default', /^      required_base:\n[\s\S]*?^        default: dev\n/m],
              ['PR-base non-PR refusal', /github\.event_name != 'pull_request'/, prBaseJob],
              ['base mismatch refusal', /github\.event\.pull_request\.base\.ref != inputs\.required_base/, prBaseJob],
              // `@v\d+` and not a bare `checkout`: the contract is that the job checks out the
              // caller, so it must survive a major bump — but a version-free match would also
              // accept a commented-out line or another action whose name contains the word.
              ['caller checkout', /uses: actions\/checkout@v\d+/, skillsJob],
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
                  /^\s*working-directory: \$\{\{ github\.workspace \}\}\s*$/m, substrateJob],
              ['overrides job id', /^  npm-overrides:\n/m],
              ['overrides stable name', /^    name: npm overrides\n/m],
              ['overrides non-PR refusal', /github\.event_name != 'pull_request'/, overridesJob],
              ['overrides caller head', /^\s*ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\s*$/m, overridesJob],
              ['overrides isolated exact install',
                  /npm install --prefix "\$\{SKILLS_ROOT\}" --ignore-scripts --package-lock=false --no-save/, overridesJob],
              ['overrides exact package spec', /"neo-agent-skills@\$\{SKILLS_VERSION\}"/, overridesJob],
              ['overrides isolated absolute bin',
                  /"\$\{SKILLS_ROOT\}\/node_modules\/\.bin\/neo-agent-skills-npm-overrides"/, overridesJob],
              // Anchored for the substrate pin's reason: a suffixed root is a different manifest.
              ['overrides judged in the caller workspace',
                  /^\s*working-directory: \$\{\{ github\.workspace \}\}\s*$/m, overridesJob],
              ['secrets job id', /^  secrets:\n/m],
              ['secrets stable name', /^    name: Secrets\n/m],
              ['secrets non-PR refusal', /github\.event_name != 'pull_request'/, secretsJob],
              ['secrets caller head', /^\s*ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\s*$/m, secretsJob],
              ['secrets isolated exact install',
                  /npm install --prefix "\$\{SKILLS_ROOT\}" --ignore-scripts --package-lock=false --no-save/, secretsJob],
              ['secrets exact package spec', /"neo-agent-skills@\$\{SKILLS_VERSION\}"/, secretsJob],
              ['secrets isolated absolute bin',
                  /"\$\{SKILLS_ROOT\}\/node_modules\/\.bin\/neo-agent-skills-secrets"/, secretsJob],
              // `--all` and nothing after it: a file list, or any narrowing, scans less of the caller's tree
              ['secrets scans every tracked file', /neo-agent-skills-secrets"\n\s+--all\s*$/m, secretsJob],
              ['secrets scanned in the caller workspace',
                  /^\s*working-directory: \$\{\{ github\.workspace \}\}\s*$/m, secretsJob],
              ['authorship job id', /^  commit-authorship:\n/m],
              ['authorship stable name', /^    name: Commit authorship\n/m],
              ['authorship non-PR refusal', /github\.event_name != 'pull_request'/, authorshipJob],
              ['authorship caller head', /^\s*ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\s*$/m, authorshipJob],
              // The input is a range of commits, so a shallow checkout would leave the guard nothing to read
              ['authorship full history', /^\s*fetch-depth: 0\s*$/m, authorshipJob],
              ['authorship isolated exact install',
                  /npm install --prefix "\$\{SKILLS_ROOT\}" --ignore-scripts --package-lock=false --no-save/, authorshipJob],
              ['authorship exact package spec', /"neo-agent-skills@\$\{SKILLS_VERSION\}"/, authorshipJob],
              ['authorship isolated absolute bin',
                  /"\$\{SKILLS_ROOT\}\/node_modules\/\.bin\/neo-agent-skills-commit-authorship"/, authorshipJob],
              ['authorship checked in the caller workspace',
                  /^\s*working-directory: \$\{\{ github\.workspace \}\}\s*$/m, authorshipJob],
              // The one identity a pull request cannot forge decides whether its commits are an agent's
              ['authorship authenticated PR author',
                  /^\s*AUTHOR_LOGIN: \$\{\{ github\.event\.pull_request\.user\.login \}\}\s*$/m, authorshipJob],
              ['authorship roster from the caller inputs',
                  /repository: \$\{\{ inputs\.team_roster_repository \}\}\n\s*ref: \$\{\{ inputs\.team_roster_ref \}\}\n/, authorshipJob]
          ];

    required.forEach(([label, pattern, target = source]) => {
        if (!pattern.test(target)) failures.push(`missing ${label}`)
    });

    const triggerBlock = source.match(/^on:\n([\s\S]*?)\njobs:/m)?.[1] || '';

    if (!triggerBlock || /^  (?:pull_request|pull_request_target|push|workflow_dispatch|schedule):/m.test(triggerBlock)) {
        failures.push('direct event trigger present')
    }
    if (/^\s+repository:/m.test(source.replace(rosterStep, ''))) failures.push('checkout repository override present');
    if (rosterStep && !/^\s*path: \.team-roster\s*$/m.test(rosterStep)) failures.push('authorship roster replaces the caller tree');
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

    if (!overridesJob.includes(`SKILLS_VERSION: '${pkg.version}'`)) failures.push('overrides package version drift');
    if ((overridesJob.match(/^\s*SKILLS_ROOT: \$\{\{ runner\.temp \}\}\/neo-agent-skills-npm-overrides\s*$/gm) || []).length !== 2) {
        failures.push('missing overrides isolated runner root')
    }
    // Bare for the same reason: `--root` would judge a manifest other than the caller's.
    if (/neo-agent-skills-npm-overrides"[^\n]*\S/.test(overridesJob)) {
        failures.push('overrides guard invoked with arguments')
    }

    if (!secretsJob.includes(`SKILLS_VERSION: '${pkg.version}'`)) failures.push('secrets package version drift');
    if ((secretsJob.match(/^\s*SKILLS_ROOT: \$\{\{ runner\.temp \}\}\/neo-agent-skills-secrets\s*$/gm) || []).length !== 2) {
        failures.push('missing secrets isolated runner root')
    }

    if (!authorshipJob.includes(`SKILLS_VERSION: '${pkg.version}'`)) failures.push('authorship package version drift');
    if ((authorshipJob.match(/^\s*SKILLS_ROOT: \$\{\{ runner\.temp \}\}\/neo-agent-skills-commit-authorship\s*$/gm) || []).length !== 2) {
        failures.push('missing authorship isolated runner root')
    }
    // The roster decides who the team is, so the step reading it may name nothing of the pull request under review
    if (/github\.event\.pull_request|github\.head_ref|github\.sha/.test(rosterStep)) {
        failures.push('authorship roster read from the pull request')
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
// Two claims, two scopes. The close target (exactly one `Resolves`) is policy for EVERY pull request,
// so the body read and its check run ungated; the §9 anchors are the AGENT protocol, so their step
// alone carries the `neo-` / `ai` boundary. COUNTED, not merely present: a second gated step would
// silently exempt human PRs from the close target again, and a presence check passes on one survivor.
if ((prBodyJob.match(/if: \$\{\{ startsWith\(github\.event\.pull_request\.user\.login, 'neo-'\)/g) || []).length !== 1) {
    failures.push('PR-body author boundary must gate exactly one step — the anchors')
}

const closeTargetStep = prBodyJob.match(/- name: Validate the close target\n([\s\S]*?)(?=\n      - name: |$)/);

if (!closeTargetStep) {
    failures.push('PR-body job has no close-target step')
} else if (/^\s+if:/m.test(closeTargetStep[1]) || !/--close-target-only/.test(closeTargetStep[1])) {
    failures.push('the close-target step must run ungated with --close-target-only')
}

if (/DRAFT_FLAG|--draft/.test(prBodyJob)) failures.push('PR-body job still carries a draft exception');

if (/uses: actions\/checkout/.test(prBodyJob)) failures.push('PR-body job checks out the caller tree');

    // Comments are stripped FIRST. Both checks below name the construct they forbid, so a detector
    // reading raw text flags this job's own JSDoc — the #28 defect inverted: prose describing an
    // anchor satisfied it there; here prose describing a hazard reports it. Measured, not guessed:
    // the first revision of these two rows failed against the canonical file for exactly that.
    const prBodyCode = prBodyJob.split('\n').filter(line => !/^\s*#/.test(line)).join('\n');

    // RA-4 — VALUE FLOW, not token presence. A token check passes on a decorative occurrence: the live
    // fetch can sit in the file while an aliased event snapshot is what actually gets written, and the
    // install line can name the package while the version is mutable. Each guard below follows the value.
    //
    // (a) The fetched response must be what reaches the file. A `pulls.get` whose result is discarded
    //     while `writeFileSync` receives an event-payload alias satisfies every presence check.
    const writeCall = prBodyCode.match(/writeFileSync\([^)]*\)/);

    if (!writeCall) {
        failures.push('PR-body never writes the body to a file')
    } else if (!/\bdata\.body\b/.test(writeCall[0])) {
        failures.push('PR-body writes something other than the fetched response')
    }

    // (b) No body value may reach a shell-visible surface — `env:` included, not only `run:`. An env
    //     var carrying the body is interpolated by the shell exactly like an inline expression.
    prBodyCode.split('\n').forEach(line => {
        if (/^\s+[A-Z_]+\s*:\s*\$\{\{[^}]*\bbody\b/.test(line)) {
            failures.push('PR-body content reaches a shell-visible env value')
        }
    });

    // (c) The install must be IMMUTABLE. `neo-agent-skills@latest`, a range, or a missing pin all keep
    //     the package name and change what actually executes.
    const prBodyInstall = prBodyCode.match(/npm install[\s\S]*?neo-agent-skills@[^"'\s]*/);

    if (!prBodyInstall) {
        failures.push('PR-body guard is not installed from a pinned package')
    } else if (!/neo-agent-skills@\$\{SKILLS_VERSION\}/.test(prBodyInstall[0])) {
        failures.push('PR-body guard install is not pinned to an exact version')
    }
    if (!new RegExp(`SKILLS_VERSION: '${pkg.version}'`).test(prBodyJob)) {
        failures.push('PR-body package version drift')
    }

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

/**
 * @summary Requires one mutation to both CHANGE the source and violate the named semantic contract.
 *
 * The `notEqual` is the half a caller cannot see: a `mutate` whose target no longer exists returns
 * the source untouched, and without it the arm would report on an unmutated fixture. Two reviewers
 * independently read the call sites, inferred that a stale mutation passes silently, and proposed
 * adding exactly this guard — so the assertion is named here rather than left to be rediscovered.
 */
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
expectMutationFailure('release-ref removed', source,
    value => value.replace('  release-ref:\n', '  removed-ref:\n'),
    'missing release-ref job id');
expectMutationFailure('release-ref reads the caller ref', source,
    value => value.replace('WORKFLOW_REF: ${{ job.workflow_ref }}', 'WORKFLOW_REF: ${{ github.workflow_ref }}'),
    'missing release-ref reads its own ref');
expectMutationFailure('release-ref accepts any ref', source,
    value => value.replace('=~ @refs/tags/v[0-9]+\\.[0-9]+\\.[0-9]+$ ]]', '=~ @.+$ ]]'),
    'missing release-ref requires a semver tag');
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
    value => value.replace(/( +- uses: actions\/checkout@v\d+)/, '$1\n        with:\n          repository: neomjs/neo-agent-skills'),
    'checkout repository override present');
// The negative half of the `caller checkout` assertion, which nothing covered: with the version
// loosened to any major, a regex that matched too much would still pass the canonical check and
// every bump. Deleting the step is the only thing that proves the assertion can still fail.
expectMutationFailure('caller checkout removed', source,
    value => value.replace(/\n +- uses: actions\/checkout@v\d+\n/, '\n'),
    'missing caller checkout');
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
    // The trailing context disambiguates which job's `ref:` block is dropped; only the action's
    // major is loosened, so the arm survives a bump without losing that precision.
    value => value.replace(
        /        with:\n          ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\n\n(      - uses: actions\/setup-node@v\d+\n        with:\n          node-version: \$\{\{ inputs\.node_version \}\}\n\n      # The guard runs from runner\.temp)/,
        '\n$1'),
    'missing substrate caller head');
expectMutationFailure('substrate runner isolation', source,
    value => value.replace(/\$\{\{ runner\.temp \}\}\/neo-agent-skills-substrate-size/g, '${{ github.workspace }}/guard'),
    'missing substrate isolated runner root');
expectMutationFailure('substrate package version', source,
    value => value.replace(
        `          SKILLS_ROOT: \${{ runner.temp }}/neo-agent-skills-substrate-size\n          SKILLS_VERSION: '${pkg.version}'`,
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

// ── The npm-overrides job: the substrate job's isolation contract, restated for its own step ──────
expectMutationFailure('overrides job removed', source,
    value => value.replace('  npm-overrides:\n', '  removed-npm-overrides:\n'),
    'missing overrides job id');
expectMutationFailure('overrides package version', source,
    value => value.replace(
        `          SKILLS_ROOT: \${{ runner.temp }}/neo-agent-skills-npm-overrides\n          SKILLS_VERSION: '${pkg.version}'`,
        "          SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-npm-overrides\n          SKILLS_VERSION: 'latest'"),
    'overrides package version drift');
expectMutationFailure('overrides isolated install', source,
    value => value.replace(
        /(      - name: Install immutable npm-overrides guard\n[\s\S]*?)          npm install --prefix "\$\{SKILLS_ROOT\}" --ignore-scripts --package-lock=false --no-save\n          "neo-agent-skills@\$\{SKILLS_VERSION\}"/,
        '$1          npm install "neo-agent-skills@${SKILLS_VERSION}"'),
    'missing overrides isolated exact install');
expectMutationFailure('overrides steered invocation', source,
    value => value.replace(
        'run: "${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-npm-overrides"',
        'run: "${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-npm-overrides" --root docs'),
    'overrides guard invoked with arguments');
expectMutationFailure('overrides workspace pin — suffixed root', source,
    value => value.replace(
        /(      - name: Judge every override against the ranges its dependents declare\n        working-directory: \$\{\{ github\.workspace \}\})/,
        '$1/docs'),
    'missing overrides judged in the caller workspace');
expectMutationFailure('overrides runner root — suffixed root', source,
    value => value.replace(
        'SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-npm-overrides',
        'SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-npm-overrides-shadow'),
    'missing overrides isolated runner root');

// ── The secrets job: the same isolation, and a scan that cannot be narrowed ────────────────────
expectMutationFailure('secrets job removed', source,
    value => value.replace('  secrets:\n', '  removed-secrets:\n'),
    'missing secrets job id');
expectMutationFailure('secrets package version', source,
    value => value.replace(
        `          SKILLS_ROOT: \${{ runner.temp }}/neo-agent-skills-secrets\n          SKILLS_VERSION: '${pkg.version}'`,
        "          SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-secrets\n          SKILLS_VERSION: 'latest'"),
    'secrets package version drift');
expectMutationFailure('secrets isolated install', source,
    value => value.replace(
        /(      - name: Install immutable credential guard\n[\s\S]*?)          npm install --prefix "\$\{SKILLS_ROOT\}" --ignore-scripts --package-lock=false --no-save\n          "neo-agent-skills@\$\{SKILLS_VERSION\}"/,
        '$1          npm install "neo-agent-skills@${SKILLS_VERSION}"'),
    'missing secrets isolated exact install');
expectMutationFailure('secrets narrowed scan', source,
    value => value.replace(
        '"${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-secrets"\n          --all',
        '"${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-secrets"\n          --all README.md'),
    'missing secrets scans every tracked file');
expectMutationFailure('secrets workspace pin — suffixed root', source,
    value => value.replace(
        /(      - name: Scan every tracked file for credential-shaped literals\n        working-directory: \$\{\{ github\.workspace \}\})/,
        '$1/docs'),
    'missing secrets scanned in the caller workspace');
expectMutationFailure('secrets runner root — suffixed root', source,
    value => value.replace(
        'SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-secrets',
        'SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-secrets-shadow'),
    'missing secrets isolated runner root');

// ── The commit-authorship job: the same isolation, and a roster the pull request cannot touch ─────
expectMutationFailure('authorship job removed', source,
    value => value.replace('  commit-authorship:\n', '  removed-commit-authorship:\n'),
    'missing authorship job id');
expectMutationFailure('authorship package version', source,
    value => value.replace(
        `          SKILLS_ROOT: \${{ runner.temp }}/neo-agent-skills-commit-authorship\n          SKILLS_VERSION: '${pkg.version}'`,
        "          SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-commit-authorship\n          SKILLS_VERSION: 'latest'"),
    'authorship package version drift');
expectMutationFailure('authorship shallow checkout', source,
    value => value.replace(/(  commit-authorship:\n[\s\S]*?)          fetch-depth: 0\n/, '$1'),
    'missing authorship full history');
expectMutationFailure('authorship lane from a forgeable source', source,
    value => value.replace(
        'AUTHOR_LOGIN: ${{ github.event.pull_request.user.login }}',
        'AUTHOR_LOGIN: ${{ github.event.pull_request.head.user.login }}'),
    'missing authorship authenticated PR author');
expectMutationFailure('authorship roster read at the pull request head', source,
    value => value.replace('          ref: ${{ inputs.team_roster_ref }}\n',
        '          ref: ${{ inputs.team_roster_ref || github.event.pull_request.head.sha }}\n'),
    'authorship roster read from the pull request');
expectMutationFailure('authorship roster over the caller tree', source,
    value => value.replace('          path: .team-roster\n', ''),
    'authorship roster replaces the caller tree');


expectMutationFailure('PR-body decorative live fetch', source,
    // The fetch stays, so every presence check still passes — but an event-payload alias is what
    // reaches the file. This is the arm a token check cannot have.
    value => value.replace("            require('node:fs').writeFileSync(process.env.BODY_FILE, data.body ?? '');",
                           "            const snapshot = context.payload.pull_request.body;\n            require('node:fs').writeFileSync(process.env.BODY_FILE, snapshot ?? '');"),
    'PR-body writes something other than the fetched response');
expectMutationFailure('PR-body body into a shell-visible env', source,
    value => value.replace('          BODY_FILE  : ${{ runner.temp }}/pr-body.md',
                           '          BODY_FILE  : ${{ runner.temp }}/pr-body.md\n          PR_BODY    : ${{ github.event.pull_request.body }}'),
    'PR-body content reaches a shell-visible env value');
expectMutationFailure('PR-body mutable install', source,
    value => value.replace('          "neo-agent-skills@${SKILLS_VERSION}"\n\n      # The body is fetched LIVE',
                           '          "neo-agent-skills@latest"\n\n      # The body is fetched LIVE'),
    'PR-body guard install is not pinned to an exact version');

const AGENT_GATE = "        if: ${{ startsWith(github.event.pull_request.user.login, 'neo-') || contains(github.event.pull_request.labels.*.name, 'ai') }}\n";

expectMutationFailure('PR-body anchors ungated', source,
    value => value.replace(`      - name: Validate the required anchors\n${AGENT_GATE}`, '      - name: Validate the required anchors\n'),
    'PR-body author boundary must gate exactly one step — the anchors');
expectMutationFailure('PR-body close target gated to agents again', source,
    value => value.replace('      - name: Validate the close target\n', `      - name: Validate the close target\n${AGENT_GATE}`),
    'the close-target step must run ungated with --close-target-only');
expectMutationFailure('PR-body close-target flag dropped', source,
    value => value.replace('          --body-file "${BODY_FILE}" --close-target-only', '          --body-file "${BODY_FILE}"'),
    'the close-target step must run ungated with --close-target-only');
expectMutationFailure('PR-body draft exception reintroduced', source,
    value => value.replace('          --body-file "${BODY_FILE}"\n', '          --body-file "${BODY_FILE}" ${DRAFT_FLAG}\n'),
    'PR-body job still carries a draft exception');
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
    value => value.replace('          --body-file "${BODY_FILE}" --close-target-only', '          --body-file "${{ github.event.pull_request.body }}" --close-target-only'),
    'PR-body content reaches a run: block');

expectMutationFailure('continue on error', source,
    value => value.replace('    runs-on: ubuntu-latest\n    steps:', '    runs-on: ubuntu-latest\n    continue-on-error: true\n    steps:'),
    'continue-on-error present');

console.log(`reusable-pr-baseline: canonical contract + ${mutationCount} negative mutations passed`);
