#!/usr/bin/env node
/**
 * @summary Asserts that a consumer's `concurrency` groups survive a rerun.
 *
 * `concurrency` governs the workflow it is declared in, so a reusable workflow cannot provide it —
 * each consumer declares its own. What IS shareable is the check that the declaration is correct,
 * and the clause that gets dropped when five repositories restate it from memory is the rerun one:
 *
 *     group: tests-${{ github.workflow }}-${{ github.run_attempt == '1' && github.ref || github.run_id }}
 *
 * A group keyed on `github.ref` alone cancels correctly on a new head and also lets a RERUN of an
 * older head cancel the newer run that superseded it (`neomjs/neo#15593`). Keying a rerun on its own
 * `run_id` isolates it. Both halves are required; either alone is a different, wrong behaviour.
 */
import {readdirSync, readFileSync, realpathSync, statSync} from 'node:fs';
import {join}                                             from 'node:path';
import {fileURLToPath}                                     from 'node:url';

export const WORKFLOW_DIR = '.github/workflows';

/**
 * @type {RegExp} The SCOPE selector, not a requirement.
 *
 * A group keyed on the ref has declared itself a per-ref superseding group, and only those owe the
 * rerun clause. Groups keyed on anything else are a different intent and are none of this guard's
 * business: a scheduled pipeline keys on nothing (one run at a time, and a new cron tick must NOT
 * kill an in-flight sync), and a cross-PR sweep keys on its matrix element. Grading those was this
 * guard's first shape, and it reddened three correct workflows in `neomjs/neo`.
 */
export const REF_PATTERN = /github\.(ref|head_ref)|pull_request\.head\.ref/;

/** @type {RegExp} The rerun clause: an attempt test that falls back to the run's own id. */
export const RERUN_PATTERN = /github\.run_attempt[\s\S]*github\.run_id/;

/**
 * @summary Extracts every top-level `concurrency` block from one workflow's source.
 *
 * Line-scanned rather than YAML-parsed: this package ships zero dependencies, and the shape is
 * two known keys under a known top-level heading.
 * @param {String} source
 * @returns {Array<Object>} `{group, cancelInProgress, jobLevel}` per block
 */
export function collectConcurrencyBlocks(source) {
    const blocks = [],
          lines  = source.split('\n');

    let current = null;

    for (const line of lines) {
        const concurrency = /^(\s*)concurrency\s*:\s*$/.exec(line);

        if (concurrency) {
            current = {cancelInProgress: null, group: null, jobLevel: concurrency[1].length > 0};
            blocks.push(current);
            continue
        }

        if (!current) {
            continue
        }

        const group  = /^\s+group\s*:\s*(.+?)\s*$/.exec(line),
              cancel = /^\s+cancel-in-progress\s*:\s*(\S+)\s*$/.exec(line);

        if (group)  {current.group            = group[1]}
        if (cancel) {current.cancelInProgress = cancel[1] === 'true'}

        // A non-indented, non-comment, non-blank line ends the block.
        if (!group && !cancel && line.trim() && !line.startsWith(' ') && !line.trim().startsWith('#')) {
            current = null
        }
    }

    return blocks
}

/**
 * @summary Whether this block is in scope — a per-ref superseding group.
 * @param {Object} block
 * @returns {Boolean}
 */
export function isRefKeyed(block) {
    return !!block.group && REF_PATTERN.test(block.group)
}

/**
 * @summary Grades one in-scope concurrency block. Out-of-scope blocks are never passed here.
 * @param {Object} block
 * @returns {String[]} Violations, empty when the block is contract-clean.
 */
export function gradeBlock(block) {
    const errors = [];

    RERUN_PATTERN.test(block.group) || errors.push('group has no rerun clause — a rerun of an older head can cancel the newer run that superseded it');
    block.cancelInProgress === true || errors.push('`cancel-in-progress` is not `true`, so a superseded run is never cancelled');

    return errors
}

/**
 * @summary Grades every workflow under `root`.
 *
 * Zero workflow files is a FAILURE, never a pass. The guard resolves its root from cwd, and outside
 * a checkout every path is ENOENT — so a wrong root would otherwise be indistinguishable from a
 * repository that declares nothing, and would green. The sibling substrate guard learned the same
 * lesson under its negative-space contract; there the pinned `working-directory` is the mitigation,
 * here the empty set is simply not a legal result.
 * @param {Object} [options]
 * @param {String} [options.root=process.cwd()]
 * @returns {{files:Number, blocks:Number, findings:Object[], errors:String[]}}
 */
export function collectReport({root = process.cwd()} = {}) {
    const dir      = join(root, WORKFLOW_DIR),
          findings = [],
          errors   = [];

    let names = [];

    try {
        statSync(dir).isDirectory() && (names = readdirSync(dir).filter(name => /\.ya?ml$/.test(name)))
    } catch {
        errors.push(`${WORKFLOW_DIR} is not readable from ${root} — a wrong root reports an empty repository`);
        return {blocks: 0, errors, files: 0, findings}
    }

    if (names.length === 0) {
        errors.push(`${WORKFLOW_DIR} holds no workflow files — refusing to report a pass on an empty set`);
        return {blocks: 0, errors, files: 0, findings}
    }

    let blocks = 0,
        scoped = 0;

    for (const name of names.sort()) {
        for (const block of collectConcurrencyBlocks(readFileSync(join(dir, name), 'utf8'))) {
            blocks++;

            if (!isRefKeyed(block)) {
                continue
            }

            scoped++;

            const violations = gradeBlock(block);

            violations.length && findings.push({file: `${WORKFLOW_DIR}/${name}`, group: block.group, violations})
        }
    }

    return {blocks, errors, files: names.length, findings, scoped}
}

/**
 * @param {String[]} [argv]
 * @param {Object} [io]
 * @returns {Number} Process exit code.
 */
export function run(argv = process.argv.slice(2), {cwd = process.cwd(), out = console.log, error = console.error} = {}) {
    const report = collectReport({root: cwd});

    if (report.errors.length) {
        report.errors.forEach(message => error(`check-workflow-concurrency: ${message}`));
        return 1
    }

    report.findings.forEach(({file, group, violations}) => {
        error(`❌ ${file}`);
        error(`   group: ${group}`);
        violations.forEach(violation => error(`   - ${violation}`))
    });

    if (report.findings.length) {
        error(`check-workflow-concurrency: ${report.findings.length} of ${report.scoped} ref-keyed concurrency block(s) are not rerun-safe.`);
        return 1
    }

    out(`check-workflow-concurrency: ${report.scoped} ref-keyed block(s) of ${report.blocks} across ${report.files} workflow file(s), all rerun-safe.`);
    return 0
}

// `argv[1]` is the link path and `import.meta.url` the realpath, so a symlinked bin never matches a
// direct comparison: the module loads, `run()` never fires, and the process exits 0.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    process.exit(run())
}
