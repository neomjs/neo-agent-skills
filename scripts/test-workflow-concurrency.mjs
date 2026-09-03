#!/usr/bin/env node
/** @summary Mutation-sensitive contract checks for the workflow-concurrency guard. */

import assert                                          from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir}                                        from 'node:os';
import {join}                                          from 'node:path';
import {collectConcurrencyBlocks, collectReport, gradeBlock, isRefKeyed, run} from './check-workflow-concurrency.mjs';

const fixtures = [];

/**
 * @summary A disposable repository root carrying the given workflow files.
 * @param {Object} files name → source
 * @returns {String} the root
 */
function repo(files) {
    const root = mkdtempSync(join(tmpdir(), 'workflow-concurrency-'));

    fixtures.push(root);
    mkdirSync(join(root, '.github/workflows'), {recursive: true});
    Object.entries(files).forEach(([name, source]) => writeFileSync(join(root, '.github/workflows', name), source));

    return root
}

const CORRECT = `name: Tests
concurrency:
  group: tests-\${{ github.workflow }}-\${{ github.run_attempt == '1' && github.ref || github.run_id }}
  cancel-in-progress: true
jobs:
  unit:
    runs-on: ubuntu-latest
`;

// The mutation this guard exists for: the rerun clause dropped, everything else intact. It cancels
// correctly on a new head, so it looks right and passes any presence check.
const NO_RERUN_CLAUSE = CORRECT.replace(
    "\${{ github.run_attempt == '1' && github.ref || github.run_id }}",
    '\${{ github.ref }}'
);

const silent = {error() {}, out() {}};

// ── the parser ────────────────────────────────────────────────────────────────────────────────
{
    const [block] = collectConcurrencyBlocks(CORRECT);

    assert.equal(block.cancelInProgress, true);
    assert.match(block.group, /run_attempt/);
    assert.equal(block.jobLevel, false, 'a top-level block is not job-level');
}

{
    assert.deepEqual(collectConcurrencyBlocks('name: X\njobs:\n  a:\n    runs-on: ubuntu-latest\n'), [],
        'a workflow with no concurrency block yields none');
}

// ── grading ───────────────────────────────────────────────────────────────────────────────────
{
    assert.deepEqual(gradeBlock(collectConcurrencyBlocks(CORRECT)[0]), [], 'the correct shape has no violations');
}

{
    const violations = gradeBlock(collectConcurrencyBlocks(NO_RERUN_CLAUSE)[0]);

    assert.equal(violations.length, 1, 'exactly the rerun clause is missing');
    assert.match(violations[0], /rerun clause/);
}

{
    const violations = gradeBlock({cancelInProgress: false, group: "\${{ github.run_attempt == '1' && github.ref || github.run_id }}"});

    assert.equal(violations.length, 1);
    assert.match(violations[0], /cancel-in-progress/, 'a group that supersedes nothing is a violation on its own');
}

// ── scope: only ref-keyed groups owe the rerun clause ──────────────────────────────────────────
// The first shape of this guard graded every block and reddened three CORRECT workflows in
// `neomjs/neo`: two scheduled pipelines keyed on nothing (one run at a time, and a new cron tick
// must not kill an in-flight sync) and a cross-PR sweep keyed on its matrix element.
{
    assert.equal(isRefKeyed({group: 'data-sync-pipeline'}), false, 'a scheduled singleton is out of scope');
    assert.equal(isRefKeyed({group: 'review-admission-mergeability-\${{ matrix.pr }}'}), false, 'a cross-PR sweep is out of scope');
    assert.equal(isRefKeyed({group: null}), false);
    assert.equal(isRefKeyed(collectConcurrencyBlocks(CORRECT)[0]), true, 'a ref-keyed group is in scope')
}

{
    const scheduled = `name: Nightly
concurrency:
  group: data-sync-pipeline
  cancel-in-progress: false
jobs:
  sync:
    runs-on: ubuntu-latest
`;
    const report = collectReport({root: repo({'nightly.yml': scheduled})});

    assert.deepEqual(report.findings, [], 'an out-of-scope group produces no finding');
    assert.equal(report.blocks, 1, 'it is still counted');
    assert.equal(report.scoped, 0, 'but it is not graded')
}

// ── the report, and the negative-space contract ───────────────────────────────────────────────
{
    const report = collectReport({root: repo({'test.yml': CORRECT})});

    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.findings, []);
    assert.equal(report.blocks, 1);
}

{
    const report = collectReport({root: repo({'test.yml': NO_RERUN_CLAUSE})});

    assert.equal(report.findings.length, 1, 'the dropped clause is reported');
    assert.equal(report.findings[0].file, '.github/workflows/test.yml')
}

{
    // A wrong root must FAIL, never green. Outside a checkout every path is ENOENT, so an empty set
    // is indistinguishable from a repository that declares nothing — and a guard that greens there
    // reports "measured nothing" as "nothing to measure".
    const bare   = mkdtempSync(join(tmpdir(), 'workflow-concurrency-empty-')),
          report = collectReport({root: bare});

    fixtures.push(bare);
    assert.equal(report.errors.length, 1, 'a missing workflow directory is an error, not a pass');
    assert.match(report.errors[0], /wrong root/)
}

{
    const root   = repo({}),
          report = collectReport({root});

    assert.equal(report.errors.length, 1, 'an empty workflow directory is an error, not a pass');
    assert.match(report.errors[0], /empty set/)
}

// ── exit codes ────────────────────────────────────────────────────────────────────────────────
{
    assert.equal(run([], {cwd: repo({'test.yml': CORRECT}), ...silent}), 0);
    assert.equal(run([], {cwd: repo({'test.yml': NO_RERUN_CLAUSE}), ...silent}), 1);
    assert.equal(run([], {cwd: mkdtempSync(join(tmpdir(), 'workflow-concurrency-none-')), ...silent}), 1)
}

fixtures.forEach(root => rmSync(root, {force: true, recursive: true}));
console.log('check-workflow-concurrency: contract checks passed.');
