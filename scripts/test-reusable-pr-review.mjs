#!/usr/bin/env node
/**
 * @summary Mutation-sensitive contract checks for the reusable `pull_request_review` workflow.
 *
 * GitHub validates YAML syntax on publish; this suite protects what syntax cannot: a review-event-only entry, a
 * read-only judging job, a caller held to a release tag, an immutable guard install outside the caller's tree, a
 * live review read, and one corrective comment written by the only job that may write. Each negative fixture
 * removes one property and must turn red. The workflow's own scripts then run against mocks, so the envelope it
 * writes is the one the policy accepts.
 *
 * Run: `node scripts/test-reusable-pr-review.mjs`
 */

import assert                                             from 'node:assert/strict';
import {spawnSync}                                        from 'node:child_process';
import {chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir}                                           from 'node:os';
import {dirname, join}                                    from 'node:path';
import {fileURLToPath}                                    from 'node:url';
import {assertEnvelope, commentMarker, judgeReview}       from './check-pr-review-body.mjs';

const
    here         = dirname(fileURLToPath(import.meta.url)),
    workflowPath = join(here, '..', '.github', 'workflows', 'reusable-pr-review.yml'),
    source       = readFileSync(workflowPath, 'utf8'),
    MARKER       = commentMarker(1).split('review=')[0] + 'review=',
    scratch      = [];

let mutationCount = 0;

/** @summary Isolates one top-level job so a sibling cannot satisfy its contract. */
function jobSource(text, jobId) {
    const marker = `  ${jobId}:\n`,
          start  = text.indexOf(marker);

    if (start === -1) return '';

    const after = text.slice(start + marker.length),
          next  = after.search(/^  [a-z0-9_-]+:\n/m);

    return marker + (next === -1 ? after : after.slice(0, next))
}

/** @summary One step's source, from its `- name:` line to the next step. */
function stepSource(job, name) {
    return job.match(new RegExp(`      - name: ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n[\\s\\S]*?(?=\\n      - |\\s*$)`))?.[0] || ''
}

/** @summary A block scalar's body (`script: |` or `run: |`), de-indented. */
function blockBody(step, key) {
    // The last step of the file ends without a newline once sliced; the block grammar needs one per line.
    const match = `${step}\n`.match(new RegExp(`\\n( +)${key}: \\|\\n((?:\\1  .*\\n|\\n)+)`));

    return match ? match[2].replace(new RegExp(`^${match[1]}  `, 'gm'), '') : ''
}

/**
 * @summary Returns named contract violations in one workflow source string.
 * @param {String} text
 * @returns {String[]}
 */
export function validateReusablePrReview(text) {
    const
        failures   = [],
        body       = jobSource(text, 'review-body'),
        correction = jobSource(text, 'review-correction'),
        readStep   = stepSource(body, 'Read the review and its budget cohort'),
        judgeStep  = stepSource(body, 'Judge the review'),
        postStep   = stepSource(correction, 'Post or update the corrective comment'),
        checkouts  = body.match(/uses: actions\/checkout@/g)?.length ?? 0,
        blocks     = [...text.matchAll(/\n( +)(?:run|script): \|\n((?:\1  .*\n|\n)+)/g)].map(match => match[2]),
        required   = [
            ['workflow-call trigger', /^on:\n  workflow_call:\n/m],
            ['read-only top-level grant', /^permissions:\n  contents: read\n\n/m],
            ['review-body job', /^    name: Review body\n/m, body],
            ['review-body reads only', /^    permissions:\n      contents: read\n      issues: read\n      pull-requests: read\n    outputs:/m, body],
            ['non-review caller fails closed', /if: \$\{\{ github\.event_name != 'pull_request_review' \}\}\n[\s\S]*?exit 1/, body],
            ['own repository checkout', /repository: \$\{\{ job\.workflow_repository \}\}\n\s+ref: \$\{\{ job\.workflow_sha \}\}/, body],
            ['package.json alone', /sparse-checkout: package\.json\n/, body],
            ['release tag enforced', /WORKFLOW_REF: \$\{\{ job\.workflow_ref \}\}[\s\S]*!= \*"@refs\/tags\/v\$\{version\}"/, body],
            ['immutable guard install', /SKILLS_ROOT: \$\{\{ runner\.temp \}\}\/neo-agent-skills-pr-review\n[\s\S]*?npm install --prefix "\$\{SKILLS_ROOT\}" --ignore-scripts --package-lock=false --no-save\n\s+"neo-agent-skills@\$\{SKILLS_VERSION\}"/, body],
            ['live review read', /github\.rest\.pulls\.getReview\(/, readStep],
            ['bounded activation read', /closedByPullRequestsReferences\(first: 100, includeClosedPrs: true\)[\s\S]*pageInfo \{ hasNextPage \}/, readStep],
            ['packaged guard invocation', /"\$\{SKILLS_ROOT\}\/node_modules\/\.bin\/neo-agent-skills-pr-review-body" --envelope "\$\{ENVELOPE_FILE\}" --json --comment-file "\$\{COMMENT_FILE\}"/, judgeStep],
            ['verdict outputs', /outcome: \$\{\{ steps\.judge\.outputs\.outcome \}\}\n\s+comment: \$\{\{ steps\.judge\.outputs\.comment \}\}/, body],
            ['red on a failed verdict', /STATUS: \$\{\{ steps\.judge\.outputs\.status \}\}\n\s+run: exit "\$\{STATUS:-1\}"/, body],
            ['review-correction job', /^    name: Review correction\n    needs: review-body\n/m, correction],
            ['correction runs on a failed verdict only', /if: \$\{\{ always\(\) && needs\.review-body\.outputs\.outcome == 'fail' \}\}/, correction],
            ['correction writes pull requests only', /^    permissions:\n      pull-requests: write\n    steps:/m, correction],
            ['comment through env', /COMMENT: \$\{\{ needs\.review-body\.outputs\.comment \}\}[\s\S]*process\.env\.COMMENT/, postStep],
            ['one comment per review', new RegExp(`startsWith\\('${MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\)[\\s\\S]*'github-actions\\[bot\\]'[\\s\\S]*updateComment[\\s\\S]*createComment`), postStep]
        ];

    required.forEach(([label, pattern, scope = text]) => !pattern.test(scope) && failures.push(label));

    // The review is the job's whole input: the only checkout is this workflow's own package.json.
    (checkouts !== 1 || /github\.event\.pull_request\.head/.test(body)) && failures.push('no caller checkout');
    /context\.payload\.review\.body/.test(text)                     && failures.push('review body read from the event');
    blocks.some(block => block.includes('${{'))                    && failures.push('expression inside a script or run body');
    /write/.test(body.replace(/writeFileSync/g, ''))               && failures.push('review-body reads only');

    return [...new Set(failures)]
}

/** @summary A mutation must change the source and turn the named property red. */
function expectMutationFailure(label, mutate, expected) {
    const mutated = mutate(source);

    assert.notEqual(mutated, source, `${label}: mutation changed nothing`);
    assert.ok(validateReusablePrReview(mutated).includes(expected), `${label}: expected "${expected}", got ${validateReusablePrReview(mutated).join(', ')}`);
    mutationCount++
}

assert.deepEqual(validateReusablePrReview(source), [], 'canonical reusable review workflow violates its own contract');

[
    ['a pull_request trigger', s => s.replace('  workflow_call:\n', '  pull_request:\n'), 'workflow-call trigger'],
    ['a write grant at the top', s => s.replace('permissions:\n  contents: read\n\n', 'permissions:\n  contents: write\n\n'), 'read-only top-level grant'],
    ['a renamed check', s => s.replace('    name: Review body\n', '    name: Lint review\n'), 'review-body job'],
    ['a judging job that may write', s => s.replace('      pull-requests: read\n    outputs:', '      pull-requests: write\n    outputs:'), 'review-body reads only'],
    ['a non-review caller admitted', s => s.replace("github.event_name != 'pull_request_review'", "github.event_name == 'workflow_dispatch'"), 'non-review caller fails closed'],
    ['the caller\'s package.json', s => s.replace('repository: ${{ job.workflow_repository }}', 'repository: ${{ github.repository }}'), 'own repository checkout'],
    ['a whole checkout', s => s.replace('          sparse-checkout: package.json\n', ''), 'package.json alone'],
    ['any ref admitted', s => s.replace('!= *"@refs/tags/v${version}"', '== ""'), 'release tag enforced'],
    ['install scripts allowed', s => s.replace('--prefix "${SKILLS_ROOT}" --ignore-scripts', '--prefix "${SKILLS_ROOT}"'), 'immutable guard install'],
    ['a floating release', s => s.replace('"neo-agent-skills@${SKILLS_VERSION}"', '"neo-agent-skills@latest"'), 'immutable guard install'],
    ['the event snapshot', s => s.replace('{data: review} = await github.rest.pulls.getReview({owner, repo, pull_number: pullRequest.number, review_id: context.payload.review.id})', '{data: review} = {data: context.payload.review}'), 'live review read'],
    ['an unbounded history', s => s.replace('pageInfo { hasNextPage }', 'pageInfo { endCursor }'), 'bounded activation read'],
    ['a guard from the caller\'s tree', s => s.replace('"${SKILLS_ROOT}/node_modules/.bin/neo-agent-skills-pr-review-body"', 'node scripts/check-pr-review-body.mjs'), 'packaged guard invocation'],
    ['a dropped comment output', s => s.replace('      comment: ${{ steps.judge.outputs.comment }}\n', ''), 'verdict outputs'],
    ['a verdict that never reds', s => s.replace('run: exit "${STATUS:-1}"', 'run: exit 0'), 'red on a failed verdict'],
    ['a correction on every run', s => s.replace("if: ${{ always() && needs.review-body.outputs.outcome == 'fail' }}", 'if: ${{ always() }}'), 'correction runs on a failed verdict only'],
    ['a correction with contents write', s => s.replace('      pull-requests: write\n    steps:', '      contents: write\n      pull-requests: write\n    steps:'), 'correction writes pull requests only'],
    ['the comment inlined into the script', s => s.replace("body           = process.env.COMMENT ?? ''", "body           = `${{ needs.review-body.outputs.comment }}`"), 'expression inside a script or run body'],
    ['a stacked comment', s => s.replace('existing\n                ? await github.rest.issues.updateComment({owner, repo, comment_id: existing.id, body})\n                : await', 'await'), 'one comment per review'],
    ['a caller checkout', s => s.replace('      - uses: actions/setup-node@v7\n', '      - uses: actions/checkout@v7\n\n      - uses: actions/setup-node@v7\n'), 'no caller checkout'],
    ['the payload body', s => s.replace("body: review.body ?? ''", "body: context.payload.review.body ?? ''"), 'review body read from the event'],
    ['an expression in a shell body', s => s.replace('exit 1\n\n      # `job.workflow_*`', 'echo "${{ github.actor }}"\n          exit 1\n\n      # `job.workflow_*`'), 'expression inside a script or run body']
].forEach(([label, mutate, expected]) => expectMutationFailure(label, mutate, expected));

// ── The workflow's own scripts, run against mocks ──────────────────────────────────────────────────────
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

/** @summary Runs one github-script body with injected globals. */
function githubScript(step, globals) {
    return new AsyncFunction(...Object.keys(globals), blockBody(step, 'script'))(...Object.values(globals))
}

{
    const
        readStep = stepSource(jobSource(source, 'review-body'), 'Read the review and its budget cohort'),
        closers  = {nodes: [{baseRefName: 'dev', mergedAt: '2026-07-16T20:54:31Z', number: 15307, state: 'MERGED'}], pageInfo: {hasNextPage: false}, totalCount: 1},
        read     = async issue => {
            let written = null;

            await githubScript(readStep, {
                context: {payload: {pull_request: {created_at: '2026-10-28T12:00:00Z', number: 42}, review: {id: 9}}, repo: {owner: 'neomjs', repo: 'neo'}},
                github : {
                    graphql: async (query, variables) => (assert.equal(variables.issue, 15257), {repository: {issue: {closedByPullRequestsReferences: closers}}}),
                    rest   : {pulls: {getReview: async ({review_id}) => ({data: {body: 'LGTM', id: review_id, state: 'APPROVED', user: {login: 'neo-gpt'}}})}}
                },
                process: {env: {ACTIVATION_BASE: 'dev', ACTIVATION_ISSUE: String(issue), ENVELOPE_FILE: 'envelope.json'}},
                require: name => (assert.equal(name, 'node:fs'), {writeFileSync: (file, text) => { written = JSON.parse(text) }})
            });

            return written
        };

    for (const issue of [0, 15257]) {
        const envelope = await read(issue);

        assert.doesNotThrow(() => assertEnvelope(envelope), `the envelope written with activation issue ${issue} is the one the policy accepts`);
        assert.equal(judgeReview(envelope).code, 'TEMPLATE_INCOMPLETE', 'the live body is the one judged');
        assert.equal(envelope.budgetActivation === null, issue === 0, 'issue 0 declares no activation coordinate')
    }
}

{
    const
        postStep = stepSource(jobSource(source, 'review-correction'), 'Post or update the corrective comment'),
        marker   = commentMarker(9),
        post     = async (comment, existing) => {
            const calls = [];

            await githubScript(postStep, {
                context: {payload: {pull_request: {number: 42}}, repo: {owner: 'neomjs', repo: 'neo'}},
                github : {
                    paginate: async () => existing,
                    rest    : {issues: {
                        createComment: async ({body}) => calls.push(['create', body]),
                        listComments : () => {},
                        updateComment: async ({comment_id}) => calls.push(['update', comment_id])
                    }}
                },
                process: {env: {COMMENT: comment}}
            });

            return calls
        },
        ours     = {body: `${marker}\nold`, id: 2, user: {login: 'github-actions[bot]'}},
        spoofed  = {body: `${marker}\nplanted`, id: 3, user: {login: 'someone'}};

    assert.deepEqual(await post(`${marker}\nnew`, []), [['create', `${marker}\nnew`]], 'a first failure creates the comment');
    assert.deepEqual(await post(`${marker}\nnew`, [spoofed, ours]), [['update', 2]], 'an edited review updates its own comment');
    assert.deepEqual((await post(`${marker}\nnew`, [spoofed]))[0][0], 'create', 'a person\'s comment carrying the marker is never edited');
    await assert.rejects(post('no marker', []), /no review marker/, 'a comment without its marker is refused')
}

// ── The judge step's shell glue: the verdict and the comment survive as outputs, and a failure reds ─────
{
    const
        dir      = mkdtempSync(join(tmpdir(), 'pr-review-judge-')),
        bin      = join(dir, 'node_modules', '.bin'),
        outputs  = join(dir, 'outputs'),
        judge    = blockBody(stepSource(jobSource(source, 'review-body'), 'Judge the review'), 'run'),
        guard    = join(bin, 'neo-agent-skills-pr-review-body'),
        runJudge = (verdict, status, comment) => {
            comment && writeFileSync(join(dir, 'prepared.md'), `${comment}\n`);
            writeFileSync(guard, [
                '#!/usr/bin/env bash',
                comment ? `cp "${join(dir, 'prepared.md')}" "\${COMMENT_FILE}"` : ':',
                `echo '${JSON.stringify(verdict)}'`,
                `exit ${status}`
            ].join('\n'));
            chmodSync(guard, 0o755);
            writeFileSync(outputs, '');

            const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', judge], {
                encoding: 'utf8',
                env     : {...process.env, COMMENT_FILE: join(dir, `comment-${status}.md`), ENVELOPE_FILE: join(dir, 'envelope.json'), GITHUB_OUTPUT: outputs, SKILLS_ROOT: dir}
            });

            assert.equal(result.status, 0, `the judge step records the verdict and leaves the exit to the next step: ${result.stderr}`);
            return readFileSync(outputs, 'utf8')
        };

    scratch.push(dir);
    mkdirSync(bin, {recursive: true});

    assert.match(runJudge({outcome: 'fail'}, 1, `${commentMarker(9)}\n## lint\nline two`), /status=1\noutcome=fail\ncomment<<NEO_PR_REVIEW_COMMENT\n<!-- neo-agent-skills:pr-review-lint review=9 -->\n## lint\nline two\n\nNEO_PR_REVIEW_COMMENT/);
    assert.match(runJudge({outcome: 'pass'}, 0, null), /^status=0\noutcome=pass\n$/, 'a pass writes no comment output');
    assert.match(runJudge({outcome: 'error'}, 2, null), /status=2\noutcome=error/, 'a malformed envelope is recorded as an error');

    const report = status => spawnSync('bash', ['-e', '-c', 'exit "${STATUS:-1}"'], {env: {...process.env, STATUS: status}}).status;

    assert.deepEqual([report('0'), report('1'), report('2'), report('')], [0, 1, 2, 1], 'the report step reds every verdict but a pass, and a missing one')
}

scratch.forEach(dir => rmSync(dir, {force: true, recursive: true}));

console.log(`reusable-pr-review: canonical contract + ${mutationCount} negative mutations + script arms passed`);
