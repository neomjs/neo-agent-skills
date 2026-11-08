#!/usr/bin/env node
/**
 * @summary Mutation-sensitive contract checks for the reusable consumer PR baseline.
 *
 * GitHub validates YAML syntax when the branch is published; this suite protects the semantic
 * boundary that syntax cannot: one workflow-call entrypoint, read-only permissions, three jobs whose
 * boundary keeps pull-request code away from the shared guards, a caller's own guard list run whole on the
 * pull-request-code side, a caller held to a release tag, a release
 * version read from `package.json` and written nowhere in the workflow, stable step names, every check
 * running after an earlier red, caller-repository checkout, the explicit dev-base decision, immutable
 * guard execution, and the supported materializer command. Each negative fixture removes one property
 * and must turn red.
 *
 * Run: `node scripts/test-reusable-pr-baseline.mjs`
 */

import assert            from 'node:assert/strict';
import {spawnSync}       from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir}          from 'node:os';
import {dirname, join}   from 'node:path';
import {fileURLToPath}   from 'node:url';
import {runInNewContext} from 'node:vm';

const
    here         = dirname(fileURLToPath(import.meta.url)),
    root         = join(here, '..'),
    workflowPath = join(root, '.github', 'workflows', 'reusable-pr-baseline.yml'),
    // Anchored to end-of-line: a suffixed value is a DIFFERENT root that a substring match accepts
    GUARD_ROOT   = /^\s*SKILLS_ROOT: \$\{\{ runner\.temp \}\}\/neo-agent-skills-guards\s*$/m,
    WORKSPACE    = /^\s*working-directory: \$\{\{ github\.workspace \}\}\s*$/m,
    BASE_SHA     = /^\s*BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}\s*$/m,
    PR_HEAD      = /^\s*ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}\s*$/m,
    VERSION      = /^\s*SKILLS_VERSION: \$\{\{ steps\.version\.outputs\.version \}\}\s*$/m,
    bin          = name => new RegExp(`"\\$\\{SKILLS_ROOT\\}/node_modules/\\.bin/${name}"`),
    // The PR-baseline steps that run under more than `!cancelled()`, each gate whole. Every other step after the
    // first runs under `${{ !cancelled() }}` exactly.
    BASELINE_GATES = {
        'Read the team roster'                : "${{ !cancelled() && inputs.team_roster_repository != '' }}",
        'Guides'                              : '${{ !cancelled() && inputs.guides }}',
        'Validate the close target'           : "${{ !cancelled() && github.event.pull_request.user.type != 'Bot' }}",
        "Report a bot's unjudged close target": "${{ !cancelled() && github.event.pull_request.user.type == 'Bot' }}",
        'Validate the required anchors'       : "${{ !cancelled() && (startsWith(github.event.pull_request.user.login, 'neo-') || contains(github.event.pull_request.labels.*.name, 'ai')) }}"
    };

let mutationCount = 0;

/**
 * @summary The shell a job's steps run: every `run:` value, inline or as a block, one command line per line.
 * @param {String} job A job's source, comments stripped
 * @returns {String}
 */
function runScripts(job) {
    const lines = job.split('\n'),
          out   = [];

    lines.forEach((line, index) => {
        const match = line.match(/^(\s+)run: ?(.*)$/);

        if (!match) return;

        if (!/^[|>][-+]?$/.test(match[2])) {
            out.push(match[2]);
            return
        }

        for (let i = index + 1; i < lines.length && (!lines[i].trim() || lines[i].search(/\S/) > match[1].length); i++) {
            out.push(lines[i].trim())
        }
    });

    return out.join('\n')
}

/** @summary Executes the inline Node script from the `PR base` step against a synthetic `process.env`. */
function runPrBaseScript(script, env) {
    const out = [], err = [];
    let status = 0;

    try {
        runInNewContext(script, {
            console: {
                log  : (...args) => out.push(args.join(' ')),
                error: (...args) => err.push(args.join(' '))
            },
            process: {
                env,
                exit: code => {
                    status = code ?? 0;
                    throw {__prBaseExit: true};
                }
            }
        });
    } catch (error) {
        if (!error?.__prBaseExit) {
            status = 2;
            err.push(String(error?.message || error));
        }
    }

    return {status, stdout: out.join('\n'), stderr: err.join('\n')}
}

/** @summary Isolates one top-level job so a sibling cannot satisfy its contract. */
function jobSource(source, jobId) {
    const marker = `  ${jobId}:\n`,
          // At a line start: an input of the same name sits deeper, and its line contains the marker
          start  = source.indexOf(`\n${marker}`) + 1;

    if (start === 0) return '';

    const after = source.slice(start + marker.length),
          next  = after.search(/^  [a-z0-9_-]+:\n/m);

    return marker + (next === -1 ? after : after.slice(0, next))
}

/**
 * @summary Isolates one named step of a job, so a sibling step cannot satisfy its contract. It ends at the next step
 * or at the comment block that introduces it, so a neighbour's prose never counts for this step.
 */
function stepSource(job, name) {
    const marker = `      - name: ${name}\n`,
          start  = job.indexOf(marker);

    if (start === -1) return '';

    const after = job.slice(start + marker.length),
          next  = after.search(/^      (?:- |#)/m);

    return marker + (next === -1 ? after : after.slice(0, next))
}

/**
 * @summary Returns named semantic-contract violations in one reusable-workflow source string.
 * @param {String} source
 * @returns {String[]}
 */
export function validateReusablePrBaseline(source) {
    const failures        = [],
          baselineJob     = jobSource(source, 'pr-baseline'),
          skillsJob       = jobSource(source, 'skills-materialized'),
          guardsJob       = jobSource(source, 'guards'),
          guardsRunStep   = stepSource(guardsJob, 'Run the declared guards'),
          step            = name => stepSource(baselineJob, name),
          headStep        = step('Checkout exact caller head'),
          baseFetchStep   = step('Fetch pull-request base'),
          versionStep     = step('Skills version'),
          releaseRefStep  = step('Release ref'),
          prBaseStep      = step('PR base'),
          installStep     = step('Install immutable guards'),
          archaeologyStep = step('Source comment archaeology'),
          substrateStep   = step('Substrate size'),
          overridesStep   = step('npm overrides'),
          secretsStep     = step('Secrets'),
          guidesStep      = step('Guides'),
          // The one read of another repository's tree: the caller team's roster, cloned outside the caller's tree
          rosterStep      = step('Read the team roster'),
          authorshipStep  = step('Commit authorship'),
          readBodyStep    = step('Read the live pull-request body'),
          closeTargetStep = step('Validate the close target'),
          botReportStep   = step("Report a bot's unjudged close target"),
          anchorsStep     = step('Validate the required anchors'),
          bodySteps       = [readBodyStep, closeTargetStep, botReportStep, anchorsStep].join(''),
          required = [
              ['workflow-call trigger', /^on:\n  workflow_call:\n/m],
              ['read-only contents', /^permissions:\n  contents: read\n/m],
              ['PR baseline job id', /^  pr-baseline:\n/m],
              ['PR baseline stable name', /^    name: PR baseline\n/m],
              // Granted on the job that runs no pull-request code, never on the one that runs the caller's install
              ['PR baseline pull-request grant', /^    permissions:\n      contents: read\n      pull-requests: read\n/m, baselineJob],
              ['Skills job id', /^  skills-materialized:\n/m],
              ['Skills stable name', /^    name: Skills materialized\n/m],
              ['non-PR refusal', /^      - name: Reject a non-PR caller\n        if: \$\{\{ github\.event_name != 'pull_request' \}\}\n        run: exit 1\n/m, baselineJob],
              // `job.workflow_*` name THIS reusable file; `github.*` would read the caller's package.json.
              ['version reads its own repository', /^\s*WORKFLOW_REPO: \$\{\{ job\.workflow_repository \}\}\s*$/m, versionStep],
              ['version reads its own commit', /^\s*WORKFLOW_SHA: \$\{\{ job\.workflow_sha \}\}\s*$/m, versionStep],
              // Over the API, into the step: nothing of this repository lands in the caller's tree
              ['version reads package.json over the API',
                  /gh api -H 'Accept: application\/vnd\.github\.raw\+json' "repos\/\$\{WORKFLOW_REPO\}\/contents\/package\.json\?ref=\$\{WORKFLOW_SHA\}" \| jq -r \.version/, versionStep],
              ['version step id', /^        id: version\s*$/m, versionStep],
              ['version output', /echo "version=\$\{version\}" >> "\$GITHUB_OUTPUT"/, versionStep],
              // `job.workflow_ref` names THIS reusable file's ref; `github.workflow_ref` is the caller's own.
              ['release-ref reads its own ref', /WORKFLOW_REF: \$\{\{ job\.workflow_ref \}\}/, releaseRefStep],
              ['release-ref requires its own release tag', /!= \*"@refs\/tags\/v\$\{SKILLS_VERSION\}" \]\]/, releaseRefStep],
              // The version is written once, in package.json: every reader takes it from the version step
              ['release-ref version read from package.json', VERSION, releaseRefStep],
              ['required_base default', /^      required_base:\n(?:        .*\n)*?        default: dev\n/m],
              ['release_base default', /^      release_base:\n(?:        .*\n)*?        default: main\n/m],
              ['release_actors default', /^      release_actors:\n(?:        .*\n)*?        default: '\[\]'\n/m],
              ['PR-base event env', /^\s*EVENT_NAME: \$\{\{ github\.event_name \}\}\s*$/m, prBaseStep],
              ['PR-base actual base env', /^\s*ACTUAL_BASE: \$\{\{ github\.event\.pull_request\.base\.ref \}\}\s*$/m, prBaseStep],
              ['PR-base authenticated author env', /^\s*PR_AUTHOR: \$\{\{ github\.event\.pull_request\.user\.login \}\}\s*$/m, prBaseStep],
              ['PR-base required_base env', /^\s*REQUIRED_BASE: \$\{\{ inputs\.required_base \}\}\s*$/m, prBaseStep],
              ['PR-base release_base env', /^\s*RELEASE_BASE: \$\{\{ inputs\.release_base \}\}\s*$/m, prBaseStep],
              ['PR-base release_actors env', /^\s*RELEASE_ACTORS: \$\{\{ inputs\.release_actors \}\}\s*$/m, prBaseStep],
              // `@v\d+` and not a bare `checkout`: the contract is that the job checks out the
              // caller, so it must survive a major bump — but a version-free match would also
              // accept a commented-out line or another action whose name contains the word.
              ['caller checkout', /uses: actions\/checkout@v\d+/, skillsJob],
              ['Node input', /node-version: \$\{\{ inputs\.node_version \}\}/],
              ['lockfile install', /run: npm ci/, skillsJob],
              ['materializer check', /run: npx --no-install neo-agent-skills-materialize --check/, skillsJob],
              ['exact caller head', PR_HEAD, headStep],
              // Archaeology diffs from the base and authorship reads a range of commits: a shallow head leaves both nothing
              ['full history', /^\s*fetch-depth: 0\s*$/m, headStep],
              ['exact base SHA', BASE_SHA, baseFetchStep],
              ['exact base fetch', /git fetch --no-tags origin "\$\{BASE_SHA\}"/, baseFetchStep],
              ['isolated exact install', /npm install --prefix "\$\{SKILLS_ROOT\}" --ignore-scripts --package-lock=false --no-save/, installStep],
              ['exact package spec', /"neo-agent-skills@\$\{SKILLS_VERSION\}"/, installStep],
              ['isolated runner root', GUARD_ROOT, installStep],
              ['guard version read from package.json', VERSION, installStep],
              ['archaeology isolated absolute bin', bin('neo-agent-skills-ticket-archaeology'), archaeologyStep],
              ['archaeology isolated runner root', GUARD_ROOT, archaeologyStep],
              ['archaeology exact base SHA', BASE_SHA, archaeologyStep],
              ['archaeology exact base invocation', /--base "\$\{BASE_SHA\}"/, archaeologyStep],
              ['substrate isolated absolute bin', bin('neo-agent-skills-substrate-size'), substrateStep],
              ['substrate isolated runner root', GUARD_ROOT, substrateStep],
              // The pin is the only thing separating "nothing to measure" from "measured nothing": outside the
              // checkout every target is ENOENT, which the negative-space contract reports as N/A and GREENS.
              ['substrate measurement pinned to the caller workspace', WORKSPACE, substrateStep],
              ['overrides isolated absolute bin', bin('neo-agent-skills-npm-overrides'), overridesStep],
              ['overrides isolated runner root', GUARD_ROOT, overridesStep],
              ['overrides judged in the caller workspace', WORKSPACE, overridesStep],
              ['secrets isolated absolute bin', bin('neo-agent-skills-secrets'), secretsStep],
              ['secrets isolated runner root', GUARD_ROOT, secretsStep],
              // `--all` and nothing after it: a file list, or any narrowing, scans less of the caller's tree
              ['secrets scans every tracked file', /neo-agent-skills-secrets"\n\s+--all\s*$/m, secretsStep],
              ['secrets scanned in the caller workspace', WORKSPACE, secretsStep],
              // Off unless the caller asks, so an upgrade adds no check nobody chose
              ['guides input default off', /^      guides:\n(?:        .*\n)*?        type: boolean\n        default: false\n/m],
              ['guides_skip input default', /^      guides_skip:\n(?:        .*\n)*?        default: '\[\]'\n/m],
              ['guides isolated absolute bin', bin('neo-agent-skills-guides'), guidesStep],
              ['guides isolated runner root', GUARD_ROOT, guidesStep],
              // The lint's root is the cwd: outside the checkout it would judge no guides and green
              ['guides judged in the caller workspace', WORKSPACE, guidesStep],
              ['guides skip list through env', /^\s*GUIDES_SKIP: \$\{\{ inputs\.guides_skip \}\}\s*$/m, guidesStep],
              ['authorship isolated absolute bin', bin('neo-agent-skills-commit-authorship'), authorshipStep],
              ['authorship isolated runner root', GUARD_ROOT, authorshipStep],
              ['authorship checked in the caller workspace', WORKSPACE, authorshipStep],
              // The one identity a pull request cannot forge decides whether its commits are an agent's
              ['authorship authenticated PR author', /^\s*AUTHOR_LOGIN: \$\{\{ github\.event\.pull_request\.user\.login \}\}\s*$/m, authorshipStep],
              ['authorship roster repository from the caller inputs', /^\s*ROSTER_REPO: \$\{\{ inputs\.team_roster_repository \}\}\s*$/m, rosterStep],
              ['authorship roster ref from the caller inputs', /^\s*ROSTER_REF: \$\{\{ inputs\.team_roster_ref \}\}\s*$/m, rosterStep],
              ['authorship roster cloned outside the caller tree', /^\s*ROSTER_DIR: \$\{\{ runner\.temp \}\}\/team-roster\s*$/m, rosterStep],
              ['authorship roster clone target', /git clone --quiet --depth 1 --branch "\$\{ROSTER_REF\}" "https:\/\/github\.com\/\$\{ROSTER_REPO\}\.git" "\$\{ROSTER_DIR\}"\s*$/m, rosterStep],
              // The guard reads the roster where it was cloned, never a path of the same name in the caller's tree
              ['authorship reads the cloned roster',
                  /ROSTER: \$\{\{ inputs\.team_roster_repository != '' && format\('\{0\}\/team-roster\/\{1\}', runner\.temp, inputs\.team_roster_path\) \|\| '' \}\}/, authorshipStep],
              ['PR-body live fetch', /github\.rest\.pulls\.get/, readBodyStep],
              ['PR-body agent-author boundary', /startsWith\(github\.event\.pull_request\.user\.login, 'neo-'\)/, anchorsStep],
              ['PR-body ai-label opt-in', /contains\(github\.event\.pull_request\.labels\.\*\.name, 'ai'\)/, anchorsStep],
              ['PR-body isolated absolute bin', bin('neo-agent-skills-pr-body'), closeTargetStep],
              ['PR-body isolated runner root', GUARD_ROOT, closeTargetStep],
              ['PR-body anchors isolated absolute bin', bin('neo-agent-skills-pr-body'), anchorsStep],
              ['PR-body anchors isolated runner root', GUARD_ROOT, anchorsStep],
              ['guards input default', /^      guards:\n(?:        .*\n)*?        default: '\[\]'\n/m],
              ['guards job id', /^  guards:\n/m],
              ['guards stable name', /^    name: guards\n/m, guardsJob],
              ['guards job skipped without a list', /^    if: \$\{\{ inputs\.guards != '\[\]' \}\}\n/m, guardsJob],
              ['guards caller checkout', /uses: actions\/checkout@v\d+/, guardsJob],
              ['guards Node input', /node-version: \$\{\{ inputs\.node_version \}\}/, guardsJob],
              ['guards lockfile install', /run: npm ci/, guardsJob],
              ['guards list through env', /^\s*GUARDS: \$\{\{ inputs\.guards \}\}\s*$/m, guardsRunStep]
          ];

    required.forEach(([label, pattern, target = source]) => {
        if (!pattern.test(target)) failures.push(`missing ${label}`)
    });

    const triggerBlock = source.match(/^on:\n([\s\S]*?)\njobs:/m)?.[1] || '';

    if (!triggerBlock || /^  (?:pull_request|pull_request_target|push|workflow_dispatch|schedule):/m.test(triggerBlock)) {
        failures.push('direct event trigger present')
    }

    // Three jobs, and the boundary is why: the caller's install and the caller's own guards share a job with no shared guard
    if ((source.slice(source.indexOf('\njobs:\n')).match(/^  [a-z0-9_-]+:\n/gm) || []).length !== 3) {
        failures.push('the workflow must run exactly three jobs')
    }

    // Comments are stripped before any "must not contain" check: prose naming a hazard is not the hazard.
    const code         = text => text.split('\n').filter(line => !/^\s*#/.test(line)).join('\n'),
          baselineCode = code(baselineJob),
          baselineRun  = runScripts(baselineCode);

    // Steps of one job share GITHUB_ENV, GITHUB_PATH and the filesystem, so pull-request code here could green every
    // later step. Only the immutable guards run, by absolute path from runner.temp, and Node runs only the workflow's
    // own stdin scripts. A script argument, like any relative path, lets the caller's tree decide what runs.
    if (/\bnpm (?:ci|run|exec)\b|\bnpx\b|\byarn\b|\bpnpm\b|uses: \.\//.test(baselineCode) ||
        /npm install(?![^\n]*--prefix "\$\{SKILLS_ROOT\}")/.test(baselineCode) ||
        /(?<!\$\{SKILLS_ROOT\}\/)node_modules\/\.bin/.test(baselineCode) ||
        /(?:^|[;&|(]\s*)(?:node|bash|sh|zsh|source)\s+(?!-(?:\s|$))\S/m.test(baselineRun) ||
        /(?:^|[\s;&|("'=])\.{1,2}\//m.test(baselineRun)) {
        failures.push('PR baseline runs pull-request code')
    }

    // The caller head is this job's only checkout, and nothing here deletes or moves a file. A workflow-owned write
    // inside the caller's tree replaces or removes a path the caller tracks, and a guard that reads the tree afterwards
    // greens what it never saw.
    if ((baselineCode.match(/uses: actions\/checkout@/g) || []).length !== 1 || !/uses: actions\/checkout@/.test(headStep)) {
        failures.push('PR baseline writes a checkout into the caller tree')
    }
    if (/(?:^|[;&|(]\s*)(?:rm|mv|cp|ln|mkdir|touch|tee)\s/m.test(baselineRun)) failures.push('PR baseline writes into the caller tree');

    // A failed check must not stop the later ones, so every step after the first runs under exactly !cancelled(), or
    // under one of the four gates below, each read whole. Without it the default success() gate skips the rest, and an
    // author fixes one red per push. A gate is matched exactly, not searched: `!cancelled() && false` contains the
    // condition and still never runs.
    baselineJob.split(/^      - /m).slice(2).forEach(stepText => {
        const name = stepText.match(/^name: (.*)$/m)?.[1] || '',
              gate = stepText.match(/^        if: (.*)$/m)?.[1] || '';

        if (gate !== (BASELINE_GATES[name] ?? '${{ !cancelled() }}')) {
            failures.push(`a PR-baseline step stops at an earlier red: ${stepText.split('\n')[0]}`)
        }
    });

    // One context carries every verdict, so a step skipped by event would let a body edit overwrite another check's red
    if (/github\.event\.action/.test(baselineCode)) failures.push('a PR-baseline check skips an event');

    if (/^\s+repository:/m.test(source)) failures.push('checkout repository override present');
    // The roster decides who the team is, so the step reading it may name nothing of the pull request under review
    if (/github\.event\.pull_request|github\.head_ref|github\.sha/.test(rosterStep)) {
        failures.push('authorship roster read from the pull request')
    }

    // A version typed into the workflow is a second copy that the next release must edit by hand.
    if (/\d+\.\d+\.\d+/.test(source)) failures.push('version literal present');

    // The guards are invoked bare. Every argument they accept narrows what gets measured, so a steered invocation in a
    // shared baseline is the same hole as running the caller's own copy: the tree under review decides how hard it is
    // judged. `--root` would point the measurement, or the manifest, somewhere other than the caller head.
    if (/neo-agent-skills-substrate-size"[^\n]*\S/.test(substrateStep)) failures.push('substrate guard invoked with arguments');
    if (/neo-agent-skills-npm-overrides"[^\n]*\S/.test(overridesStep)) failures.push('overrides guard invoked with arguments');
    // The guide lint takes one narrowing, the caller's declared skip list, and no root: a root would judge other guides
    if (/--(?:root|script-root|openapi-root)\b/.test(code(guidesStep))) failures.push('guides lint pointed away from the caller checkout');
    if (/\$\{\{/.test(runScripts(code(guidesStep)))) failures.push('guides skip list interpolated into run:');

    // ── The PR-body steps' own invariants ──────────────────────────────────────────────────────────
    //
    // THE BODY NEVER REACHES A SHELL — it is fetched in JavaScript and written to a file; `run:` steps
    // receive only a workflow-owned path. A pull-request body is attacker-controlled text, so
    // interpolating it into `run:` is a shell-injection primitive.
    //
    // Two claims, two scopes. The close target (exactly one `Resolves`) is policy for every pull request
    // a person or agent opens, so its only gate is the GitHub App exemption; the §9 anchors are the AGENT
    // protocol, so their step alone carries the `neo-` / `ai` boundary. COUNTED, not merely present: a
    // second gated step would silently exempt human PRs from the close target again, and a presence check
    // passes on one survivor. A bot's step must REPORT the exemption, or its green is a vacuous pass.
    if ((baselineCode.match(/startsWith\(github\.event\.pull_request\.user\.login, 'neo-'\)/g) || []).length !== 1) {
        failures.push('PR-body author boundary must gate exactly one step — the anchors')
    }

    const closeTargetGate = (closeTargetStep.match(/^\s+if:.*$/gm) || []).map(line => line.trim()).join(' | ');

    if (!closeTargetStep) {
        failures.push('PR baseline has no close-target step')
    } else if (closeTargetGate !== "if: ${{ !cancelled() && github.event.pull_request.user.type != 'Bot' }}" ||
               !/--close-target-only/.test(closeTargetStep)) {
        failures.push('the close-target step must run for every author but a Bot, with --close-target-only')
    }

    if (!botReportStep.includes("if: ${{ !cancelled() && github.event.pull_request.user.type == 'Bot' }}")) {
        failures.push("a Bot author's close target must be reported, not silently skipped")
    }

    const bodyCode = code(bodySteps);

    if (/DRAFT_FLAG|--draft/.test(bodyCode)) failures.push('PR-body steps still carry a draft exception');

    // VALUE FLOW, not token presence. A token check passes on a decorative occurrence: the live
    // fetch can sit in the file while an aliased event snapshot is what actually gets written.
    //
    // (a) The fetched response must be what reaches the file. A `pulls.get` whose result is discarded
    //     while `writeFileSync` receives an event-payload alias satisfies every presence check.
    const writeCall = bodyCode.match(/writeFileSync\([^)]*\)/);

    if (!writeCall) {
        failures.push('PR-body never writes the body to a file')
    } else if (!/\bdata\.body\b/.test(writeCall[0])) {
        failures.push('PR-body writes something other than the fetched response')
    }

    // (b) No body value may reach a shell-visible surface — `env:` included, not only `run:`. An env
    //     var carrying the body is interpolated by the shell exactly like an inline expression.
    bodyCode.split('\n').forEach(line => {
        if (/^\s+[A-Z_]+\s*:\s*\$\{\{[^}]*\bbody\b/.test(line)) {
            failures.push('PR-body content reaches a shell-visible env value')
        }
    });

    // A body reaching a shell means an EXPRESSION interpolated into a run: line, not the substring
    // "body" appearing somewhere in the step. Scoped per line, so it cannot span steps.
    if (bodyCode.split('\n').some(line => /\$\{\{[^}]*\bbody\b/.test(line))) {
        failures.push('PR-body content reaches a run: block')
    }

    // An event snapshot is wrong in both directions: a re-run replays stale text, so a
    // corrected body can never go green and an edited one keeps a stale green.
    if (/context\.payload\.pull_request\.body/.test(bodyCode)) failures.push('PR-body read from the event snapshot');

    if (/github\.rest\.|pulls\.update|issues\.createComment|\bgh\s+pr\b/.test(prBaseStep)) {
        failures.push('PR-base step mutates pull-request state')
    }
    if (/github\.actor/.test(prBaseStep)) failures.push('PR-base reads github.actor');

    const prBaseRun    = prBaseStep.match(/        run: \|\n((?:          .*\n|\n)+)/)?.[1] || '',
          prBaseScript = prBaseRun.match(/          node - <<'EOF'\n([\s\S]*?)\n          EOF\n/)?.[1] || '';

    if (/\$\{\{/.test(prBaseRun)) failures.push('PR-base interpolates expressions into run:');

    if (!prBaseScript) {
        failures.push('missing PR-base decision script')
    } else {
        const baseEnv    = {
                  EVENT_NAME    : 'pull_request',
                  ACTUAL_BASE   : 'dev',
                  PR_AUTHOR     : 'neo-gemini-maryam',
                  REQUIRED_BASE : 'dev',
                  RELEASE_BASE  : 'main',
                  RELEASE_ACTORS: '[]'
              },
              runBase    = overrides => runPrBaseScript(prBaseScript, {...baseEnv, ...overrides}),
              hasBounded = result => result.status === 1 &&
                  Boolean(result.stderr.trim()) &&
                  !result.stderr.includes('\n') &&
                  result.stderr.length <= 240;

        if (runBase({}).status !== 0) {
            failures.push('PR-base rejects ordinary required_base PR')
        }
        if (runBase({ACTUAL_BASE: 'main', PR_AUTHOR: 'tobiu', RELEASE_ACTORS: '["tobiu"]'}).status !== 0) {
            failures.push('PR-base rejects authorized release_base PR')
        }
        if ([
            {EVENT_NAME: 'workflow_dispatch'},
            {ACTUAL_BASE: ''},
            {PR_AUTHOR: ''},
            {REQUIRED_BASE: ''}
        ].some(overrides => !hasBounded(runBase(overrides)))) {
            failures.push('missing PR-base non-PR refusal')
        }
        if (!hasBounded(runBase({ACTUAL_BASE: 'feature/x', PR_AUTHOR: 'tobiu', RELEASE_ACTORS: '["tobiu"]'}))) {
            failures.push('missing base mismatch refusal')
        }
        if ([
            {ACTUAL_BASE: 'main', PR_AUTHOR: 'neo-gemini-maryam', RELEASE_ACTORS: '["tobiu"]'},
            {ACTUAL_BASE: 'main', PR_AUTHOR: 'tobiu', RELEASE_ACTORS: '[]'}
        ].some(overrides => !hasBounded(runBase(overrides)))) {
            failures.push('PR-base admits unauthorized release actor')
        }
        if ([
            {RELEASE_ACTORS: 'tobiu'},
            {RELEASE_ACTORS: '{"tobiu":true}'},
            {RELEASE_ACTORS: '"tobiu"'},
            {RELEASE_ACTORS: 'null'}
        ].some(overrides => !hasBounded(runBase(overrides)))) {
            failures.push('PR-base accepts invalid release_actors JSON or non-array')
        }
        if ([
            {RELEASE_ACTORS: '[123]'},
            {RELEASE_ACTORS: '[""]'},
            {ACTUAL_BASE: 'main', PR_AUTHOR: 'tobiu', RELEASE_ACTORS: '[" tobiu "]'},
            {ACTUAL_BASE: 'main', PR_AUTHOR: 'tobiu', RELEASE_ACTORS: '["tobiu,neo-gpt"]'}
        ].some(overrides => !hasBounded(runBase(overrides)))) {
            failures.push('PR-base accepts non-string or empty release_actors entry')
        }
        if ([
            {ACTUAL_BASE: 'main', PR_AUTHOR: 'tobiu', RELEASE_BASE: '', RELEASE_ACTORS: '["tobiu"]'},
            {ACTUAL_BASE: 'main', PR_AUTHOR: 'tobiu', RELEASE_BASE: 'dev', RELEASE_ACTORS: '["tobiu"]'}
        ].some(overrides => !hasBounded(runBase(overrides)))) {
            failures.push('PR-base widens admission on empty or duplicate release_base')
        }
    }

    // ── The guards job's own invariants ────────────────────────────────────────────────────────────
    //
    // A caller's guards are its own scripts, so they never run in the job that runs no pull-request code. The list
    // reaches its runner through `env:` only, and the runner is exercised for real: node runs the script, bash runs
    // each guard, and every guard appends its name to a file, so "ran" means a guard ran rather than the runner
    // reporting that it did.
    if (/inputs\.guards/.test(baselineCode)) failures.push('PR baseline runs the declared guards');

    const guardsRun    = guardsRunStep.match(/        run: \|\n((?:          .*\n|\n)+)/)?.[1] || '',
          guardsScript = guardsRun.match(/          node - <<'EOF'\n([\s\S]*?)\n          EOF\n/)?.[1] || '';

    if (/\$\{\{/.test(guardsRun)) failures.push('guards list interpolated into run:');

    if (!guardsScript) {
        failures.push('missing guards runner script')
    } else {
        const dir    = mkdtempSync(join(tmpdir(), 'neo-baseline-guards-')),
              ran    = join(dir, 'ran'),
              mark   = name => ({name, run: `printf '%s\\n' '${name}' >> ran`}),
              runAll = list => {
                  const summary = join(dir, 'summary.md');

                  rmSync(ran, {force: true});
                  writeFileSync(summary, '');

                  const result = spawnSync(process.execPath, ['-'], {
                      cwd     : dir,
                      encoding: 'utf8',
                      input   : guardsScript,
                      env     : {...process.env, GITHUB_STEP_SUMMARY: summary, GUARDS: typeof list === 'string' ? list : JSON.stringify(list)}
                  });

                  return {status: result.status, ran: existsSync(ran) ? readFileSync(ran, 'utf8') : '', summary: readFileSync(summary, 'utf8')}
              };

        try {
            const green = runAll([mark('first'), mark('second')]),
                  mixed = runAll([{...mark('red'), run: `${mark('red').run}; exit 3`}, mark('after')]);

            if (green.status !== 0 || green.ran !== 'first\nsecond\n') failures.push('guards do not run every declared guard in order');
            if (mixed.status !== 1) failures.push('a red guard leaves the guards job green');
            if (mixed.ran !== 'red\nafter\n') failures.push('guards stop at an earlier red');
            if (!/^\| red \| \*\*fail\*\* \|$/m.test(mixed.summary) || !/^\| after \| pass \|$/m.test(mixed.summary)) {
                failures.push('guards summary does not name each result')
            }

            // Each list carries a guard that WOULD write, so a malformed list that runs anything shows in `ran`
            const malformed = ['', 'x', 'null', '{}', '[]', '[1]', [mark('a'), {name: 'b'}], [mark('a'), {...mark('b'), extra: 1}],
                [mark('a'), {name: '', run: 'true'}], [mark('a'), {name: 'b', run: ' '}], [mark('a'), mark('b::c')], [mark('a'), mark('a')]];

            if (malformed.some(list => {
                const result = runAll(list);

                return result.status !== 1 || result.ran !== ''
            })) {
                failures.push('a malformed guard list runs or passes')
            }
        } finally {
            rmSync(dir, {force: true, recursive: true})
        }
    }

    // A red check under continue-on-error leaves its job green
    if (/continue-on-error:\s*true/.test(source)) failures.push('continue-on-error present');
    if (/^\s+[a-z_-]+: write(?:-all)?\s*$/m.test(source) ||
        /^\s*permissions: (?:read|write)-all\s*$/m.test(source)) {
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

/** @summary Replaces `from` inside one named step only, so a byte-identical line in a sibling step stays put. */
function inStep(name, from, to) {
    return value => {
        const job  = jobSource(value, 'pr-baseline'),
              step = stepSource(job, name);

        return step ? value.replace(step, step.replace(from, to)) : value
    }
}

const source = readFileSync(workflowPath, 'utf8');

assert.deepEqual(validateReusablePrBaseline(source), [], 'canonical reusable workflow violates its own contract');

{
    const prBaseStep = (stepSource(jobSource(source, 'pr-baseline'), 'PR base').match(/        run: \|\n((?:          .*\n|\n)+)/)?.[1] || '').replace(/^ {10}/gm, ''),
          execStep   = env => spawnSync('bash', ['-e', '-o', 'pipefail', '-c', prBaseStep], {
              encoding: 'utf8',
              env     : {
                  ...process.env,
                  EVENT_NAME    : 'pull_request',
                  ACTUAL_BASE   : 'dev',
                  PR_AUTHOR     : 'neo-gemini-maryam',
                  REQUIRED_BASE : 'dev',
                  RELEASE_BASE  : 'main',
                  RELEASE_ACTORS: '[]',
                  ...env
              }
          });

    assert.equal(execStep({}).status, 0, 'pr-base bash step admits ordinary required_base PR');
    assert.equal(execStep({ACTUAL_BASE: 'main', PR_AUTHOR: 'tobiu', RELEASE_ACTORS: '["tobiu"]'}).status, 0,
        'pr-base bash step admits authorized release_base PR');
    assert.equal(execStep({ACTUAL_BASE: 'main', PR_AUTHOR: 'neo-gemini-maryam', RELEASE_ACTORS: '["tobiu"]'}).status, 1,
        'pr-base bash step refuses unauthorized release_base PR');
}

// ── The guide lint receives the caller's skip list whole, or the step fails before it runs ──────
{
    const guidesRun = (stepSource(jobSource(source, 'pr-baseline'), 'Guides').match(/        run: \|\n((?:          .*\n|\n)+)/)?.[1] || '').replace(/^ {10}/gm, ''),
          stubRoot  = mkdtempSync(join(tmpdir(), 'neo-baseline-guides-')),
          argsFile  = join(stubRoot, 'args'),
          runWith   = skip => {
              rmSync(argsFile, {force: true});

              const {status} = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', guidesRun],
                  {encoding: 'utf8', env: {...process.env, GUIDES_SKIP: skip, SKILLS_ROOT: stubRoot}});

              return {status, args: existsSync(argsFile) ? readFileSync(argsFile, 'utf8') : null}
          };

    // A stand-in lint that records its arguments, one per line
    mkdirSync(join(stubRoot, 'node_modules', '.bin'), {recursive: true});
    writeFileSync(join(stubRoot, 'node_modules', '.bin', 'neo-agent-skills-guides'),
        `#!/bin/sh\nfor a in "$@"; do printf '%s\\n' "$a"; done > "${argsFile}"\n`, {mode: 0o755});

    assert.ok(guidesRun, 'the Guides step has a run block');
    assert.deepEqual(runWith('[]'), {status: 0, args: ''}, 'no skip list passes no --skip');
    assert.deepEqual(runWith('["dead-script-ref"]'), {status: 0, args: '--skip\ndead-script-ref\n'}, 'one rule');
    assert.deepEqual(runWith('["dead-script-ref","no-mermaid"]'), {status: 0, args: '--skip\ndead-script-ref,no-mermaid\n'},
        'two rules reach the lint as one argument');

    for (const bad of ['{}', '[1]', '"dead-script-ref"', 'not json', '']) {
        assert.deepEqual(runWith(bad).args, null, `a malformed skip list never reaches the lint: ${JSON.stringify(bad)}`);
        assert.notEqual(runWith(bad).status, 0, `and fails the step: ${JSON.stringify(bad)}`)
    }

    rmSync(stubRoot, {recursive: true, force: true})
}

expectMutationFailure('the guide lint pointed at another root', source,
    inStep('Guides', '-guides" "${args[@]}"', '-guides" --root docs "${args[@]}"'),
    'guides lint pointed away from the caller checkout');
expectMutationFailure('the skip list spliced into the shell', source,
    inStep('Guides', '<<< "${GUIDES_SKIP}"', "<<< '${{ inputs.guides_skip }}'"),
    'guides skip list interpolated into run:');
expectMutationFailure('the guide lint turned on for every caller', source,
    inStep('Guides', '        if: ${{ !cancelled() && inputs.guides }}\n', '        if: ${{ !cancelled() }}\n'),
    'a PR-baseline step stops at an earlier red: name: Guides');

expectMutationFailure('trigger', source,
    value => value.replace('  workflow_call:', '  pull_request:'),
    'missing workflow-call trigger');
expectMutationFailure('permissions', source,
    value => value.replace('contents: read', 'contents: write'),
    'missing read-only contents');
expectMutationFailure('write-all shorthand', source,
    value => value.replace('  skills-materialized:\n    name: Skills materialized\n    runs-on: ubuntu-latest\n',
                           '  skills-materialized:\n    name: Skills materialized\n    runs-on: ubuntu-latest\n    permissions: write-all\n'),
    'write permission present');

// ── The two-job boundary: the caller's install never shares a job with the guards ─────────────────
expectMutationFailure('baseline job removed', source,
    value => value.replace('  pr-baseline:\n', '  removed-baseline:\n'),
    'missing PR baseline job id');
expectMutationFailure('baseline stable name', source,
    value => value.replace('    name: PR baseline\n', '    name: Baseline\n'),
    'missing PR baseline stable name');
expectMutationFailure('a fourth job split off', source,
    value => value.replace('  skills-materialized:\n', '  extra:\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n\n  skills-materialized:\n'),
    'the workflow must run exactly three jobs');
expectMutationFailure('the caller install folded into the baseline', source,
    value => value.replace('      - name: Install immutable guards\n',
                           '      - name: Install consumer dependencies\n        if: ${{ !cancelled() }}\n        run: npm ci\n\n      - name: Install immutable guards\n'),
    'PR baseline runs pull-request code');
expectMutationFailure('a guard resolved from the caller tree', source,
    inStep('Secrets', '"${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-secrets"', 'npx neo-agent-skills-secrets'),
    'PR baseline runs pull-request code');
expectMutationFailure('a relative bin from the caller tree', source,
    inStep('npm overrides', 'run: "${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-npm-overrides"', 'run: node_modules/.bin/neo-agent-skills-npm-overrides'),
    'PR baseline runs pull-request code');
expectMutationFailure('pull-request grant moved off the baseline', source,
    value => value.replace('    permissions:\n      contents: read\n      pull-requests: read\n', ''),
    'missing PR baseline pull-request grant');

// ── Every check runs after an earlier red, on every event ──────────────────────────────────────
expectMutationFailure('a check stops at an earlier red', source,
    inStep('Secrets', '        if: ${{ !cancelled() }}\n', ''),
    'a PR-baseline step stops at an earlier red: name: Secrets');
expectMutationFailure('a check gated back to success()', source,
    inStep('Substrate size', 'if: ${{ !cancelled() }}', 'if: ${{ success() }}'),
    'a PR-baseline step stops at an earlier red: name: Substrate size');
expectMutationFailure('a check skipped on a body edit', source,
    inStep('Secrets', 'if: ${{ !cancelled() }}', "if: ${{ !cancelled() && github.event.action != 'edited' }}"),
    'a PR-baseline check skips an event');
// A gate that contains the condition is not the gate: `&& false` keeps the substring and never runs.
expectMutationFailure('a check gated to never run', source,
    inStep('Secrets', 'if: ${{ !cancelled() }}', 'if: ${{ !cancelled() && false }}'),
    'a PR-baseline step stops at an earlier red: name: Secrets');
expectMutationFailure('an exception gate narrowed to never run', source,
    inStep('Read the team roster', "if: ${{ !cancelled() && inputs.team_roster_repository != '' }}",
                                   "if: ${{ !cancelled() && inputs.team_roster_repository != '' && false }}"),
    'a PR-baseline step stops at an earlier red: name: Read the team roster');
expectMutationFailure('continue on error', source,
    inStep('Secrets', '        if: ${{ !cancelled() }}\n', '        if: ${{ !cancelled() }}\n        continue-on-error: true\n'),
    'continue-on-error present');
expectMutationFailure('non-PR refusal removed', source,
    value => value.replace("      - name: Reject a non-PR caller\n        if: ${{ github.event_name != 'pull_request' }}\n        run: exit 1\n\n", ''),
    'missing non-PR refusal');

// ── The release ref and the version: the release is package.json's, at the commit that defines this workflow ──
expectMutationFailure('release-ref reads the caller ref', source,
    value => value.replace('WORKFLOW_REF: ${{ job.workflow_ref }}', 'WORKFLOW_REF: ${{ github.workflow_ref }}'),
    'missing release-ref reads its own ref');
expectMutationFailure('release-ref accepts any semver tag', source,
    value => value.replace('!= *"@refs/tags/v${SKILLS_VERSION}" ]]', '!~ @refs/tags/v[0-9]+\\.[0-9]+\\.[0-9]+$ ]]'),
    'missing release-ref requires its own release tag');
expectMutationFailure('release-ref version written by hand', source,
    inStep('Release ref', 'SKILLS_VERSION: ${{ steps.version.outputs.version }}', "SKILLS_VERSION: 'latest'"),
    'missing release-ref version read from package.json');
expectMutationFailure('version read from the caller commit', source,
    inStep('Skills version', 'WORKFLOW_SHA: ${{ job.workflow_sha }}', 'WORKFLOW_SHA: ${{ github.sha }}'),
    'missing version reads its own commit');
expectMutationFailure('version read from the caller repository', source,
    inStep('Skills version', 'WORKFLOW_REPO: ${{ job.workflow_repository }}', 'WORKFLOW_REPO: ${{ github.repository }}'),
    'missing version reads its own repository');
expectMutationFailure('version read from the caller tree', source,
    inStep('Skills version', `gh api -H 'Accept: application/vnd.github.raw+json' "repos/\${WORKFLOW_REPO}/contents/package.json?ref=\${WORKFLOW_SHA}" | jq -r .version`,
                             'jq -r .version package.json'),
    'missing version reads package.json over the API');

// ── No workflow-owned write lands in the caller's tree ───────────────────────────────────────────
// The pre-fix shape: this repository checked out into the caller's tree, then removed. A caller-tracked file under
// that path vanished from disk while `git ls-files` still listed it, so the secrets scan skipped it and greened.
const PRE_FIX_CHECKOUT = "      - name: Checkout this workflow's package.json\n        if: ${{ !cancelled() }}\n" +
    '        uses: actions/checkout@v7\n        with:\n          repository: ${{ job.workflow_repository }}\n' +
    '          ref: ${{ job.workflow_sha }}\n          path: .neo-agent-skills\n\n';

expectMutationFailure('a checkout of this repository into the caller tree', source,
    value => value.replace('      - name: Skills version\n', `${PRE_FIX_CHECKOUT}      - name: Skills version\n`),
    'PR baseline writes a checkout into the caller tree');
expectMutationFailure('a workflow-owned path removed from the caller tree', source,
    inStep('Skills version', '          if [[ ! "${version}"', '          rm -rf .neo-agent-skills\n          if [[ ! "${version}"'),
    'PR baseline writes into the caller tree');
expectMutationFailure('the roster cloned into the caller tree', source,
    inStep('Read the team roster', 'ROSTER_DIR: ${{ runner.temp }}/team-roster', 'ROSTER_DIR: .team-roster'),
    'missing authorship roster cloned outside the caller tree');
expectMutationFailure('the roster checked out over the caller tree again', source,
    value => value.replace(/      - name: Read the team roster\n[\s\S]*?"\$\{ROSTER_DIR\}"\n/,
        "      - name: Read the team roster\n        if: ${{ !cancelled() && inputs.team_roster_repository != '' }}\n" +
        '        uses: actions/checkout@v7\n        with:\n          path: .team-roster\n'),
    'PR baseline writes a checkout into the caller tree');
expectMutationFailure('authorship reads a roster from the caller tree', source,
    inStep('Commit authorship', "format('{0}/team-roster/{1}', runner.temp, inputs.team_roster_path)", "format('.team-roster/{0}', inputs.team_roster_path)"),
    'missing authorship reads the cloned roster');

// ── Node runs only the workflow's own stdin, and no relative path runs ───────────────────────────
expectMutationFailure('a caller script run by Node', source,
    inStep('Secrets', '"${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-secrets"', 'node ./attacker.mjs'),
    'PR baseline runs pull-request code');
expectMutationFailure('a caller script run by Node without a dot', source,
    inStep('Secrets', '"${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-secrets"', 'node scripts/attacker.mjs'),
    'PR baseline runs pull-request code');
expectMutationFailure('a caller script run by a shell', source,
    inStep('Secrets', '"${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-secrets"', 'bash scripts/attacker.sh'),
    'PR baseline runs pull-request code');
expectMutationFailure('a relative executable', source,
    inStep('Secrets', '"${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-secrets"', './attacker'),
    'PR baseline runs pull-request code');
expectMutationFailure('version step renamed out of reach', source,
    value => value.replace('        id: version\n', '        id: read\n'),
    'missing version step id');
// The red control for "never written anywhere else": one literal is enough to fail.
expectMutationFailure('version literal reintroduced', source,
    inStep('Install immutable guards', 'SKILLS_VERSION: ${{ steps.version.outputs.version }}', "SKILLS_VERSION: '0.1.20'"),
    'version literal present');
expectMutationFailure('guards installed at a version of their own', source,
    inStep('Install immutable guards', 'SKILLS_VERSION: ${{ steps.version.outputs.version }}', "SKILLS_VERSION: 'latest'"),
    'missing guard version read from package.json');

// ── The PR-base decision ────────────────────────────────────────────────────────────────────────
expectMutationFailure('release_base default', source,
    value => value.replace("      release_base:\n        description: Protected release branch accepted only when the pull-request author is in release_actors.\n        required: false\n        type: string\n        default: main", "      release_base:\n        description: Protected release branch accepted only when the pull-request author is in release_actors.\n        required: false\n        type: string\n        default: dev"),
    'missing release_base default');
expectMutationFailure('release_actors default', source,
    value => value.replace("        default: '[]'\n", "        default: '[\"tobiu\"]'\n"),
    'missing release_actors default');
expectMutationFailure('base decision non-PR check dropped', source,
    value => value.replace("EVENT_NAME !== 'pull_request' || !ACTUAL_BASE.trim() || !PR_AUTHOR.trim()", 'false'),
    'missing PR-base non-PR refusal');
expectMutationFailure('base decision ordinary required_base broken', source,
    value => value.replace('if (ACTUAL_BASE === REQUIRED_BASE) {', 'if (false) {'),
    'PR-base rejects ordinary required_base PR');
expectMutationFailure('base decision authorized release_base broken', source,
    value => value.replace('if (actors.includes(PR_AUTHOR)) {', 'if (false) {'),
    'PR-base rejects authorized release_base PR');
expectMutationFailure('base decision admits unauthorized release actor', source,
    value => value.replace('if (actors.includes(PR_AUTHOR)) {', 'if (true) {'),
    'PR-base admits unauthorized release actor');
expectMutationFailure('base decision accepts any base branch', source,
    value => value.replace("fail(`Expected PR base '${REQUIRED_BASE}'", "process.exit(0); fail(`Expected PR base '${REQUIRED_BASE}'"),
    'missing base mismatch refusal');
expectMutationFailure('base decision skips release_actors array validation', source,
    value => value.replace('if (!Array.isArray(actors)) {', 'if (false) {'),
    'PR-base accepts invalid release_actors JSON or non-array');
expectMutationFailure('base decision skips release_actors entry validation', source,
    value => value.replace("if (actors.some(actor => typeof actor !== 'string' || !actor.trim() || actor !== actor.trim() || /\\s/.test(actor))) {", 'if (false) {'),
    'PR-base accepts non-string or empty release_actors entry');
expectMutationFailure('base decision allows empty release_base to match', source,
    value => value.replace('if (releaseBase && RELEASE_BASE === releaseBase && ACTUAL_BASE === releaseBase) {', 'if (!releaseBase || ACTUAL_BASE === releaseBase) {'),
    'PR-base widens admission on empty or duplicate release_base');
expectMutationFailure('base step reads github.actor', source,
    value => value.replace(
        '          PR_AUTHOR: ${{ github.event.pull_request.user.login }}\n          REQUIRED_BASE:',
        '          PR_AUTHOR: ${{ github.actor }}\n          REQUIRED_BASE:'),
    'PR-base reads github.actor');
expectMutationFailure('base step mutates pull request', source,
    value => value.replace("console.log(`Admitted PR by '${PR_AUTHOR}' targeting required_base '${REQUIRED_BASE}'.`);", "console.log('pulls.update');"),
    'PR-base step mutates pull-request state');

// ── The Skills job: the caller's own install, alone ─────────────────────────────────────────────
expectMutationFailure('Skills job', source,
    value => value.replace('  skills-materialized:', '  removed-skills:'),
    'missing Skills job id');
expectMutationFailure('caller checkout', source,
    value => value.replace(/( +- uses: actions\/checkout@v\d+)\n\n      - uses: actions\/setup-node/, '$1\n        with:\n          repository: neomjs/neo-agent-skills\n\n      - uses: actions/setup-node'),
    'checkout repository override present');
// The negative half of the `caller checkout` assertion: with the version loosened to any major, a regex
// that matched too much would still pass the canonical check and every bump. Deleting the step is the
// only thing that proves the assertion can still fail.
expectMutationFailure('caller checkout removed', source,
    value => value.replace(/\n +- uses: actions\/checkout@v\d+\n\n      - uses: actions\/setup-node/, '\n\n      - uses: actions/setup-node'),
    'missing caller checkout');
expectMutationFailure('materializer command', source,
    value => value.replace('neo-agent-skills-materialize --check', 'neo-agent-skills-materialize'),
    'missing materializer check');

// ── The head checkout and the base ─────────────────────────────────────────────────────────────
expectMutationFailure('exact caller head', source,
    value => value.replace('ref: ${{ github.event.pull_request.head.sha }}', 'ref: dev'),
    'missing exact caller head');
expectMutationFailure('full history', source,
    value => value.replace('fetch-depth: 0', 'fetch-depth: 1'),
    'missing full history');
expectMutationFailure('base fetch', source,
    value => value.replace('git fetch --no-tags origin "${BASE_SHA}"', 'git fetch origin dev'),
    'missing exact base fetch');
expectMutationFailure('base SHA', source,
    inStep('Fetch pull-request base', 'BASE_SHA: ${{ github.event.pull_request.base.sha }}', 'BASE_SHA: dev'),
    'missing exact base SHA');

// ── The guard install: immutable, from runner.temp, at the release ─────────────────────────────
expectMutationFailure('runner isolation', source,
    inStep('Install immutable guards', '${{ runner.temp }}/neo-agent-skills-guards', '${{ github.workspace }}/guard'),
    'missing isolated runner root');
expectMutationFailure('runner root — suffixed root', source,
    inStep('Install immutable guards', 'SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-guards', 'SKILLS_ROOT: ${{ runner.temp }}/neo-agent-skills-guards-shadow'),
    'missing isolated runner root');
expectMutationFailure('isolated install', source,
    value => value.replace('npm install --prefix "${SKILLS_ROOT}" --ignore-scripts --package-lock=false --no-save', 'npm install --ignore-scripts --package-lock=false --no-save'),
    'missing isolated exact install');
expectMutationFailure('exact package spec', source,
    value => value.replace('"neo-agent-skills@${SKILLS_VERSION}"', '"neo-agent-skills@latest"'),
    'missing exact package spec');

// ── Each guard: its absolute bin, its runner root, its pinned workspace ─────────────────────────
expectMutationFailure('archaeology step removed', source,
    value => value.replace('      - name: Source comment archaeology\n', '      - name: Archaeology\n'),
    'missing archaeology isolated absolute bin');
expectMutationFailure('archaeology base invocation', source,
    value => value.replace('--base "${BASE_SHA}"', '--base origin/dev'),
    'missing archaeology exact base invocation');
expectMutationFailure('archaeology base SHA', source,
    inStep('Source comment archaeology', 'BASE_SHA: ${{ github.event.pull_request.base.sha }}', 'BASE_SHA: dev'),
    'missing archaeology exact base SHA');
expectMutationFailure('archaeology runner root — suffixed root', source,
    inStep('Source comment archaeology', 'neo-agent-skills-guards', 'neo-agent-skills-guards-shadow'),
    'missing archaeology isolated runner root');
expectMutationFailure('substrate absolute bin', source,
    inStep('Substrate size', 'run: "${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-substrate-size"', 'run: "${SKILLS_ROOT}/bin/neo-agent-skills-substrate-size"'),
    'missing substrate isolated absolute bin');
expectMutationFailure('substrate steered invocation', source,
    inStep('Substrate size', 'run: "${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-substrate-size"',
                             'run: "${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-substrate-size" --root docs'),
    'substrate guard invoked with arguments');
// ── Any root OTHER than the caller workspace must red ──────────────────────────────────────────
//
// One defect class, asserted per guard. Each assertion names a PATH, and an unanchored substring
// accepts a suffix: a DIFFERENT root satisfying the contract that forbids different roots. A wrong
// `working-directory` is the dangerous one: the guard resolves its targets from cwd, so outside the
// checkout every target is ENOENT, the negative-space contract reports N/A, and the step GREENS
// having measured nothing. A suffix mutation is the only shape that tells an anchored assertion from
// an unanchored one; replacing the value wholesale reds against both.
expectMutationFailure('substrate workspace pin — suffixed root', source,
    inStep('Substrate size', 'working-directory: ${{ github.workspace }}', 'working-directory: ${{ github.workspace }}/docs'),
    'missing substrate measurement pinned to the caller workspace');
expectMutationFailure('substrate runner root — suffixed root', source,
    inStep('Substrate size', 'neo-agent-skills-guards', 'neo-agent-skills-guards-shadow'),
    'missing substrate isolated runner root');
expectMutationFailure('overrides steered invocation', source,
    inStep('npm overrides', 'run: "${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-npm-overrides"',
                            'run: "${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-npm-overrides" --root docs'),
    'overrides guard invoked with arguments');
expectMutationFailure('overrides workspace pin — suffixed root', source,
    inStep('npm overrides', 'working-directory: ${{ github.workspace }}', 'working-directory: ${{ github.workspace }}/docs'),
    'missing overrides judged in the caller workspace');
expectMutationFailure('overrides runner root — suffixed root', source,
    inStep('npm overrides', 'neo-agent-skills-guards', 'neo-agent-skills-guards-shadow'),
    'missing overrides isolated runner root');
expectMutationFailure('secrets narrowed scan', source,
    value => value.replace(
        '"${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-secrets"\n          --all',
        '"${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-secrets"\n          --all README.md'),
    'missing secrets scans every tracked file');
expectMutationFailure('secrets workspace pin — suffixed root', source,
    inStep('Secrets', 'working-directory: ${{ github.workspace }}', 'working-directory: ${{ github.workspace }}/docs'),
    'missing secrets scanned in the caller workspace');
expectMutationFailure('secrets runner root — suffixed root', source,
    inStep('Secrets', 'neo-agent-skills-guards', 'neo-agent-skills-guards-shadow'),
    'missing secrets isolated runner root');

// ── Commit authorship: the same isolation, and a roster the pull request cannot touch ───────────
expectMutationFailure('authorship lane from a forgeable source', source,
    value => value.replace(
        'AUTHOR_LOGIN: ${{ github.event.pull_request.user.login }}\n          BASE_SHA',
        'AUTHOR_LOGIN: ${{ github.event.pull_request.head.user.login }}\n          BASE_SHA'),
    'missing authorship authenticated PR author');
expectMutationFailure('authorship workspace pin — suffixed root', source,
    inStep('Commit authorship', 'working-directory: ${{ github.workspace }}', 'working-directory: ${{ github.workspace }}/docs'),
    'missing authorship checked in the caller workspace');
expectMutationFailure('authorship runner root — suffixed root', source,
    inStep('Commit authorship', 'neo-agent-skills-guards', 'neo-agent-skills-guards-shadow'),
    'missing authorship isolated runner root');
expectMutationFailure('authorship roster read at the pull request head', source,
    inStep('Read the team roster', 'ROSTER_REF: ${{ inputs.team_roster_ref }}',
        'ROSTER_REF: ${{ inputs.team_roster_ref || github.event.pull_request.head.sha }}'),
    'authorship roster read from the pull request');

// ── The PR-body steps ────────────────────────────────────────────────────────────────────────────
expectMutationFailure('PR-body decorative live fetch', source,
    // The fetch stays, so every presence check still passes — but an event-payload alias is what
    // reaches the file. This is the arm a token check cannot have.
    value => value.replace("            require('node:fs').writeFileSync(process.env.BODY_FILE, data.body ?? '');",
                           "            const snapshot = context.payload.pull_request.body;\n            require('node:fs').writeFileSync(process.env.BODY_FILE, snapshot ?? '');"),
    'PR-body writes something other than the fetched response');
expectMutationFailure('PR-body body into a shell-visible env', source,
    inStep('Validate the close target', '          BODY_FILE  : ${{ runner.temp }}/pr-body.md',
                                        '          BODY_FILE  : ${{ runner.temp }}/pr-body.md\n          PR_BODY    : ${{ github.event.pull_request.body }}'),
    'PR-body content reaches a shell-visible env value');

const AGENT_GATE = "        if: ${{ !cancelled() && (startsWith(github.event.pull_request.user.login, 'neo-') || contains(github.event.pull_request.labels.*.name, 'ai')) }}\n";

expectMutationFailure('PR-body anchors ungated', source,
    value => value.replace(`      - name: Validate the required anchors\n${AGENT_GATE}`, "      - name: Validate the required anchors\n        if: ${{ !cancelled() }}\n"),
    'PR-body author boundary must gate exactly one step — the anchors');
expectMutationFailure('PR-body close target gated to agents again', source,
    value => value.replace("      - name: Validate the close target\n        if: ${{ !cancelled() && github.event.pull_request.user.type != 'Bot' }}\n",
                           `      - name: Validate the close target\n${AGENT_GATE}`),
    'the close-target step must run for every author but a Bot, with --close-target-only');
expectMutationFailure('PR-body close-target flag dropped', source,
    value => value.replace('          --body-file "${BODY_FILE}" --close-target-only', '          --body-file "${BODY_FILE}"'),
    'the close-target step must run for every author but a Bot, with --close-target-only');
expectMutationFailure('PR-body close target judges a bot', source,
    value => value.replace("      - name: Validate the close target\n        if: ${{ !cancelled() && github.event.pull_request.user.type != 'Bot' }}\n",
                           '      - name: Validate the close target\n        if: ${{ !cancelled() }}\n'),
    'the close-target step must run for every author but a Bot, with --close-target-only');
expectMutationFailure('PR-body close target exempts a person', source,
    value => value.replace("user.type != 'Bot'", "user.type != 'User'"),
    'the close-target step must run for every author but a Bot, with --close-target-only');
expectMutationFailure('PR-body bot exemption unreported', source,
    value => value.replace(/      - name: Report a bot's unjudged close target\n[\s\S]*?close target is not judged\."\n\n/, ''),
    "a Bot author's close target must be reported, not silently skipped");
expectMutationFailure('PR-body draft exception reintroduced', source,
    value => value.replace('          --body-file "${BODY_FILE}"\n', '          --body-file "${BODY_FILE}" ${DRAFT_FLAG}\n'),
    'PR-body steps still carry a draft exception');
expectMutationFailure('PR-body ai-label opt-in dropped', source,
    value => value.split(" || contains(github.event.pull_request.labels.*.name, 'ai')").join(''),
    'missing PR-body ai-label opt-in');
expectMutationFailure('PR-body event snapshot', source,
    value => value.replace('            const {data} = await github.rest.pulls.get({', '            const data = context.payload.pull_request.body;\n            const {data: _} = await github.rest.pulls.get({'),
    'PR-body read from the event snapshot');
expectMutationFailure('PR-body reaches a shell', source,
    value => value.replace('          --body-file "${BODY_FILE}" --close-target-only', '          --body-file "${{ github.event.pull_request.body }}" --close-target-only'),
    'PR-body content reaches a run: block');
expectMutationFailure('PR-body runner root — suffixed root', source,
    inStep('Validate the close target', 'neo-agent-skills-guards', 'neo-agent-skills-guards-shadow'),
    'missing PR-body isolated runner root');

// ── The candidate a pre-fix setup hid stays the secrets guard's to reject ────────────────────────
// The contract above keeps every workflow-owned write out of the caller's tree, so the tree Secrets reads is the tree
// the pull request brought. Here that candidate carries a credential under each path a setup step used to write, and
// the guard rejects it as it arrived. The pre-fix setup's deletion hides one of those paths from the same guard: that
// is the false green this boundary closes, and it proves this control can tell the two apart.
{
    const candidate  = mkdtempSync(join(tmpdir(), 'pr-baseline-candidate-')),
          // Assembled at run time: as a literal it would be this repository's own finding
          credential = 'AKIA' + 'Q'.repeat(16),
          tracked    = ['.neo-agent-skills/package.json', '.team-roster/roster.mjs'],
          secrets    = () => spawnSync(process.execPath, [join(root, 'scripts', 'check-secrets.mjs'), '--all'], {cwd: candidate, encoding: 'utf8'});

    try {
        spawnSync('git', ['init', '-q'], {cwd: candidate});

        tracked.forEach(file => {
            mkdirSync(join(candidate, dirname(file)), {recursive: true});
            writeFileSync(join(candidate, file), `export const key = '${credential}';\n`)
        });

        spawnSync('git', ['add', '-A'], {cwd: candidate});

        const asArrived = secrets();

        assert.equal(asArrived.status, 1, `the guard must reject the candidate as it arrived: ${asArrived.stdout}${asArrived.stderr}`);
        tracked.forEach(file => assert.ok(asArrived.stderr.includes(file), `the guard must name ${file}`));

        rmSync(join(candidate, '.neo-agent-skills'), {recursive: true, force: true});

        assert.ok(!secrets().stderr.includes('.neo-agent-skills/'), 'the pre-fix deletion must hide its path from the guard, or this control proves nothing')
    } finally {
        rmSync(candidate, {recursive: true, force: true})
    }
}

// The guards job: each arm breaks one property the caller's single context stands behind
expectMutationFailure('guards skip gate', source,
    value => value.replace("    if: ${{ inputs.guards != '[]' }}\n", ''),
    'missing guards job skipped without a list');
expectMutationFailure('guards list interpolated', source,
    value => value.replace("const {GITHUB_STEP_SUMMARY = '', GUARDS = ''} = process.env;",
        "const {GITHUB_STEP_SUMMARY = ''} = process.env, GUARDS = '${{ inputs.guards }}';"),
    'guards list interpolated into run:');
expectMutationFailure('guards stop at the first red', source,
    value => value.replace('              return {name, passed: status === 0};',
        '              if (status !== 0) process.exit(1);\n              return {name, passed: true};'),
    'guards stop at an earlier red');
expectMutationFailure('a red guard exits green', source,
    value => value.replace('process.exit(results.every(({passed}) => passed) ? 0 : 1);', 'process.exit(0);'),
    'a red guard leaves the guards job green');
expectMutationFailure('a duplicate guard name runs', source,
    value => value.replace('              if (names.has(guard.name)) {', '              if (false) {'),
    'a malformed guard list runs or passes');
expectMutationFailure('the summary hides a red', source,
    value => value.replace("passed ? 'pass' : '**fail**'", "'pass'"),
    'guards summary does not name each result');
expectMutationFailure('the guards list reaches PR baseline', source,
    value => value.replace('      - name: Reject a non-PR caller\n',
        '      - name: Reject a non-PR caller\n        env:\n          GUARDS: ${{ inputs.guards }}\n'),
    'PR baseline runs the declared guards');

console.log(`reusable-pr-baseline: canonical contract + ${mutationCount} negative mutations + the tracked-path collision control passed`);
