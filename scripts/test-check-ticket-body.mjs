#!/usr/bin/env node
/**
 * @summary Contract and red-first fixture suite for `scripts/check-ticket-body.mjs`.
 */

import assert                                             from 'node:assert/strict';
import {spawnSync}                                        from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir}                                           from 'node:os';
import {dirname, join}                                    from 'node:path';
import {fileURLToPath}                                    from 'node:url';
import {findArchaeology}                                  from './check-ticket-archaeology.mjs';
import {
    DESIGN_AUTHORITY_REF,
    findTicketBodyViolations,
    hasDefectExcuse,
    hasDesignAuthorityLine,
    run
} from './check-ticket-body.mjs';

const
    here      = dirname(fileURLToPath(import.meta.url)),
    repoRoot  = join(here, '..'),
    GUARD     = join(here, 'check-ticket-body.mjs'),
    CLI_GUARD = GUARD.startsWith('/private/tmp/') ? GUARD.replace('/private/tmp/', '/tmp/') : GUARD,
    scratch   = [];

/**
 * @summary Creates a temporary directory cleaned up at process exit.
 * @returns {String}
 */
function makeTempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'ticket-body-'));
    scratch.push(dir);
    return dir
}

/**
 * @summary Runs the CLI against a temporary file containing `body`.
 * @param {String} body
 * @param {String[]} [extraArgs=[]]
 * @returns {{code: Number, text: String}}
 */
function runCli(body, extraArgs = []) {
    const
        dir  = makeTempDir(),
        file = join(dir, 'ticket.md');

    writeFileSync(file, body, 'utf8');

    const res = spawnSync(process.execPath, [CLI_GUARD, '--body-file', file, ...extraArgs], {encoding: 'utf8'});
    return {code: res.status, text: `${res.stdout}${res.stderr}`}
}

/**
 * @summary Returns a base behavior-change ticket body with no `Design authority:` line and no defect excuse.
 * Includes a spec path in `## The Fix` and a bare `@summary` mention in prose so neither excuses a missing line.
 * @param {Object} [overrides={}]
 * @param {String} [overrides.contextExtra='']
 * @param {String} [overrides.problemExtra='']
 * @param {String} [overrides.realityExtra='']
 * @returns {String}
 */
function baseBehaviorChangeTicket({contextExtra = '', problemExtra = '', realityExtra = ''} = {}) {
    return [
        '## Context',
        '',
        'When a child panel mounts inside a workspace view, the toolbar docked at the header stays',
        'aligned to the outer container rather than shifting into the child body.',
        contextExtra,
        '',
        '## The Problem',
        '',
        'The header toolbar placement looks wrong when the child panel is collapsed, and nothing in',
        'the current layout moves it automatically. Note that bare tag mentions like `@summary` in prose',
        'are not quoted JSDoc contract lines.',
        problemExtra,
        '',
        '## The Architectural Reality',
        '',
        '- `src/container/Panel.mjs` owns header docking and child layout items.',
        realityExtra,
        '',
        '## The Fix',
        '',
        'Move the toolbar into the child body and add a unit test in `test/playwright/unit/container/Panel.spec.mjs`.',
        '',
        '## Acceptance Criteria',
        '',
        '- [ ] Toolbar moves into the child body when collapsed, covered by `test/playwright/unit/container/Panel.spec.mjs`.'
    ].filter(line => line !== '').join('\n')
}

try {
    // ── Zero comment archaeology in guard and test suite ──────────────────────────────────────────
    for (const file of ['scripts/check-ticket-body.mjs', 'scripts/test-check-ticket-body.mjs']) {
        const source = readFileSync(join(repoRoot, file), 'utf8');
        assert.deepEqual(findArchaeology(source, file), [], `${file} must carry zero comment archaeology`)
    }

    // ── Red-first arm: base body without line and without any of the three excuses FAILS ──────────
    {
        const
            body   = baseBehaviorChangeTicket(),
            report = findTicketBodyViolations({body}),
            cliRes = runCli(body);

        assert.equal(report.ok, false, 'base behavior-change ticket without line or excuse must fail');
        assert.equal(report.satisfiedBy, null);
        assert.deepEqual(report.excuses, {crash: false, red: false, jsdoc: false, excused: false});
        assert.equal(cliRes.code, 1);
        assert.match(cliRes.text, new RegExp(DESIGN_AUTHORITY_REF.replaceAll('.', '\\.')));
    }

    // ── Same body WITH Design authority: line PASSES (both canonical grammars + n/a) ──────────────
    {
        const quotedGrammar = baseBehaviorChangeTicket({
            realityExtra: '- Design authority: "Header toolbars remain anchored at the outer panel root across child collapse states."'
        });
        const reportA = findTicketBodyViolations({body: quotedGrammar});

        assert.equal(reportA.ok, true, 'quoted record-sentence grammar must pass');
        assert.equal(reportA.satisfiedBy, 'design-authority');
        assert.equal(runCli(quotedGrammar).code, 0);

        const noneFoundGrammar = baseBehaviorChangeTicket({
            realityExtra: '- Design authority: none found (searched: learn/agentos/decisions/, learn/guides/, ask_knowledge_base)'
        });
        const reportB = findTicketBodyViolations({body: noneFoundGrammar});

        assert.equal(reportB.ok, true, 'none-found grammar with searched list must pass');
        assert.equal(reportB.satisfiedBy, 'design-authority');
        assert.equal(runCli(noneFoundGrammar).code, 0);

        const naGrammar = baseBehaviorChangeTicket({
            realityExtra: '- Design authority: n/a — this ticket adds a new lint check and calls no existing behavior wrong.'
        });
        const reportC = findTicketBodyViolations({body: naGrammar});

        assert.equal(reportC.ok, true, 'explicit n/a with rationale must pass');
        assert.equal(reportC.satisfiedBy, 'design-authority');
        assert.equal(runCli(naGrammar).code, 0);
    }

    // ── Anti-evasion on Design authority: fenced, empty, or unquoted prose must FAIL ──────────────
    {
        const fencedOnly = baseBehaviorChangeTicket({
            realityExtra: [
                '```markdown',
                'Design authority: "Fake line inside a code fence"',
                '```'
            ].join('\n')
        });
        assert.equal(hasDesignAuthorityLine(fencedOnly), false, 'fenced example must not satisfy Design authority');
        assert.equal(findTicketBodyViolations({body: fencedOnly}).ok, false);

        const bareNoneFound = baseBehaviorChangeTicket({
            realityExtra: '- Design authority: none found'
        });
        assert.equal(hasDesignAuthorityLine(bareNoneFound), false, 'none found without (searched: …) must fail');

        const placeholderSearched = baseBehaviorChangeTicket({
            realityExtra: '- Design authority: none found (searched: …)'
        });
        assert.equal(hasDesignAuthorityLine(placeholderSearched), false, 'unfilled ellipsis placeholder must fail');

        const unquotedProse = baseBehaviorChangeTicket({
            realityExtra: '- Design authority: see the panel guide for details'
        });
        assert.equal(hasDesignAuthorityLine(unquotedProse), false, 'unquoted prose without a record sentence must fail');
    }

    // ── Same body (no line) WITH Excuse 1: a fenced crash/error block PASSES ─────────────────────
    {
        const withFencedCrash = baseBehaviorChangeTicket({
            problemExtra: [
                '```text',
                "TypeError: Cannot read properties of null (reading 'dock')",
                '    at Panel.updateHeaderToolbar (src/container/Panel.mjs:184:21)',
                '```'
            ].join('\n')
        });
        const report = findTicketBodyViolations({body: withFencedCrash});

        assert.equal(report.ok, true, 'fenced crash block must excuse absent Design authority line');
        assert.equal(report.satisfiedBy, 'defect-excuse');
        assert.equal(report.excuses.crash, true);
        assert.equal(report.excuses.red, false);
        assert.equal(report.excuses.jsdoc, false);
        assert.equal(runCli(withFencedCrash).code, 0);

        const benignFence = baseBehaviorChangeTicket({
            problemExtra: [
                '```json',
                '{"dock": "top", "collapsed": true}',
                '```'
            ].join('\n')
        });
        assert.equal(hasDefectExcuse(benignFence).crash, false, 'non-error config fence must not count as a crash');
        assert.equal(findTicketBodyViolations({body: benignFence}).ok, false);
    }

    // ── Same body (no line) WITH Excuse 2: a spec path or failing test title in Problem/Context PASSES
    {
        const withSpecPath = baseBehaviorChangeTicket({
            problemExtra: 'Reproduced in `test/playwright/unit/container/Panel.spec.mjs` when collapsing the child panel.'
        });
        const reportA = findTicketBodyViolations({body: withSpecPath});

        assert.equal(reportA.ok, true, 'spec path in Problem/Context must excuse absent Design authority line');
        assert.equal(reportA.satisfiedBy, 'defect-excuse');
        assert.equal(reportA.excuses.red, true);
        assert.equal(runCli(withSpecPath).code, 0);

        const withFailingTestTitle = baseBehaviorChangeTicket({
            contextExtra: 'Failing test: "Panel keeps header toolbar mounted when child collapses"'
        });
        const reportB = findTicketBodyViolations({body: withFailingTestTitle});

        assert.equal(reportB.ok, true, 'named failing test title in Context must excuse absent Design authority line');
        assert.equal(reportB.satisfiedBy, 'defect-excuse');
        assert.equal(reportB.excuses.red, true);
        assert.equal(runCli(withFailingTestTitle).code, 0);
    }

    // ── Same body (no line) WITH Excuse 3: a quoted @-JSDoc line PASSES ──────────────────────────
    {
        const withQuotedJsdoc = baseBehaviorChangeTicket({
            problemExtra: 'Contradicts `Panel.mjs` JSDoc: `"@summary Relocates the header toolbar into the active child body on collapse."`'
        });
        const reportA = findTicketBodyViolations({body: withQuotedJsdoc});

        assert.equal(reportA.ok, true, 'quoted @-JSDoc line must excuse absent Design authority line');
        assert.equal(reportA.satisfiedBy, 'defect-excuse');
        assert.equal(reportA.excuses.jsdoc, true);
        assert.equal(runCli(withQuotedJsdoc).code, 0);

        const withBlockquoteJsdoc = baseBehaviorChangeTicket({
            problemExtra: '> @param {Boolean} collapsed Moves the header toolbar into the child body when true.'
        });
        const reportB = findTicketBodyViolations({body: withBlockquoteJsdoc});

        assert.equal(reportB.ok, true, 'blockquoted @-JSDoc line must excuse absent Design authority line');
        assert.equal(reportB.satisfiedBy, 'defect-excuse');
        assert.equal(reportB.excuses.jsdoc, true);
        assert.equal(runCli(withBlockquoteJsdoc).code, 0);
    }

    // ── Strict CLI argument handling & unreadable file error ──────────────────────────────────────
    {
        assert.throws(
            () => run(['--unknown-flag'], {stdin: '', out: () => {}, error: () => {}}),
            /Unknown option '--unknown-flag'/
        );

        const errors = [];
        const code   = run(['--body-file', '/nonexistent/ticket-body.md'], {
            out  : () => {},
            error: msg => errors.push(msg)
        });
        assert.equal(code, 1);
        assert.ok(errors.some(msg => msg.includes('cannot read')));
    }

    // ── Reference sunset retirement contract ──────────────────────────────────────────────────────
    {
        const refContent = readFileSync(join(repoRoot, DESIGN_AUTHORITY_REF), 'utf8');
        assert.ok(refContent.includes('Design authority: <the record sentence, quoted>'));
        assert.ok(refContent.includes('Design authority: none found (searched:'));
        assert.ok(
            !refContent.includes('Retire this reference once a body lint enforces the line'),
            'the sunset sentence in design-authority.md must be retired'
        );
    }

    // ── Workflow wiring contract in skill-corpus.yml ──────────────────────────────────────────────
    {
        const workflow = readFileSync(join(repoRoot, '.github/workflows/skill-corpus.yml'), 'utf8');
        assert.match(workflow, /issues:\n    types: \[opened, edited, reopened\]/);
        assert.match(workflow, /  ticket-body:\n    name: Ticket body\n    if: \$\{\{ github\.event_name == 'issues' \}\}/);
        assert.match(workflow, /issues: read/);
        assert.match(workflow, /github\.rest\.issues\.get/);
        assert.match(workflow, /node scripts\/check-ticket-body\.mjs\n\s*--body-file "\$\{BODY_FILE\}"/);
        assert.doesNotMatch(workflow, /context\.payload\.issue\.body/);
    }

    // ── Package registration and packed CLI execution ─────────────────────────────────────────────
    {
        const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
        assert.equal(pkg.bin['neo-agent-skills-ticket-body'], './scripts/check-ticket-body.mjs');
        assert.ok(pkg.files.includes('scripts/check-ticket-body.mjs'));

        const
            packDir = makeTempDir(),
            packRes = spawnSync('npm', ['pack', '--silent', '--pack-destination', packDir], {
                cwd     : repoRoot,
                encoding: 'utf8'
            });

        assert.equal(packRes.status, 0, `npm pack failed: ${packRes.stderr}`);
        const
            tarball    = join(packDir, packRes.stdout.trim().split('\n').pop()),
            installDir = makeTempDir();

        writeFileSync(join(installDir, 'package.json'), JSON.stringify({
            name   : 'ticket-body-fixture',
            version: '1.0.0',
            private: true
        }, null, 2));

        const installRes = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts', tarball], {
            cwd     : installDir,
            encoding: 'utf8'
        });
        assert.equal(installRes.status, 0, `npm install tarball failed: ${installRes.stderr}`);

        const
            badFile  = join(installDir, 'bad.md'),
            goodFile = join(installDir, 'good.md');

        writeFileSync(badFile, baseBehaviorChangeTicket(), 'utf8');
        writeFileSync(goodFile, baseBehaviorChangeTicket({
            realityExtra: '- Design authority: "Header toolbars remain anchored at the outer panel root."'
        }), 'utf8');

        const badRun = spawnSync('npx', ['--no-install', 'neo-agent-skills-ticket-body', '--body-file', badFile], {
            cwd     : installDir,
            encoding: 'utf8'
        });
        assert.equal(badRun.status, 1, 'packed CLI must fail on body without line or excuse');

        const goodRun = spawnSync('npx', ['--no-install', 'neo-agent-skills-ticket-body', '--body-file', goodFile], {
            cwd     : installDir,
            encoding: 'utf8'
        });
        assert.equal(goodRun.status, 0, `packed CLI must pass on valid body: ${goodRun.stderr}`);
    }
} finally {
    scratch.forEach(dir => rmSync(dir, {recursive: true, force: true}))
}

console.log('check-ticket-body: red-first arms, workflow contract, sunset retirement, and packed CLI passed');
