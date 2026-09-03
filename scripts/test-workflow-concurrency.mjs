#!/usr/bin/env node
/** @summary Mutation-sensitive contract checks for the workflow-concurrency guard. */

import assert                                          from 'node:assert/strict';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir}                                        from 'node:os';
import {join}                                          from 'node:path';
import {collectConcurrencyBlocks, collectReport, gradeBlock, isInScope, run} from './check-workflow-concurrency.mjs';

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

// ── scope: a block that CANCELS is in scope; its group decides what it cancels ────────────────
// Selecting on "is the group ref-keyed?" picks a proxy for the hazard and misses its worst shape.
// In `neomjs/neo` the two selectors are indistinguishable — 15 ref-keyed, 15 cancelling, identical
// sets — so no green run separates them. Found by @neo-opus-vega, who located the discriminating
// case one character away in the tree.
{
    assert.equal(isInScope({cancelInProgress: true,  group: 'anything'}), true);
    assert.equal(isInScope({cancelInProgress: false, group: "${{ github.ref }}"}), false,
        'a block that cancels nothing cannot cancel the wrong thing');
    assert.equal(isInScope({cancelInProgress: null,  group: 'x'}), false)
}

{
    // THE COUNTER-EXAMPLE: a static group that cancels is strictly worse than any ref-keyed block —
    // it cancels across every branch, not only across heads of one ref — and the ref-keyed selector
    // skipped it silently.
    const violations = gradeBlock({cancelInProgress: true, group: 'data-sync-pipeline'});

    assert.equal(violations.length, 1);
    assert.match(violations[0], /carries no ref/)
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

    assert.deepEqual(report.findings, [], 'a non-cancelling block produces no finding');
    assert.equal(report.blocks, 1, 'it is still counted');
    assert.equal(report.scoped, 0, 'but it is not graded');

    // …and the same file with cancelling ON is graded and red. One character apart.
    const cancelling = collectReport({root: repo({'nightly.yml': scheduled.replace('false', 'true')})});

    assert.equal(cancelling.findings.length, 1, 'flipping the flag makes it the worst shape, not an invisible one');
    assert.match(cancelling.findings[0].violations[0], /carries no ref/)
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
