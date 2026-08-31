#!/usr/bin/env node
/**
 * @summary Enforces the per-turn agent substrate byte budget in a consuming repository.
 *
 * Past the limit a harness silently truncates the BOTTOM of the file, so a seat loses the tail of
 * its own rules with nothing reporting it. The failure cannot be observed from inside the seat that
 * suffers it, which is why it needs a gate rather than a habit.
 *
 * The command runs against a caller tree, not against this package checkout. The limit and the
 * target roster ship WITH the guard, so a pull request cannot widen the budget it is measured by:
 * neither is a command-line option, and the reusable baseline installs a pinned release outside the
 * caller workspace before invoking it.
 */

import {lstatSync, readFileSync, realpathSync}       from 'node:fs';
import {dirname, isAbsolute, join, relative, resolve} from 'node:path';
import process                                       from 'node:process';
import {parseArgs}                                   from 'node:util';
import {fileURLToPath}                               from 'node:url';

/**
 * Per-file budget, in bytes — Antigravity's documented per-file hard limit.
 *
 * Deliberately not a CLI option. A graduated budget is an architectural decision, and a limit a
 * caller can pass is a limit a caller can raise in the same diff the guard is meant to judge. The
 * remedy for a breach is Progressive Disclosure: move granular instruction into `.agents/skills/`.
 *
 * @member {Number} PER_FILE_LIMIT_BYTES
 */
export const PER_FILE_LIMIT_BYTES = 24576;

/**
 * The per-turn entry points, each naming the harness that loads it.
 *
 * The number's substrate is per-harness, and inheriting one harness's constant into another's
 * contract is how correct-looking arithmetic governs the wrong seat. `24576` is Antigravity's
 * documented limit. The Claude seat's own cap is an operator-stated constraint whose semantics —
 * what it is measured over — remain unconfirmed, because the experiment that would settle them
 * needs a fresh authenticated seat and has not run. Until it does, that row is checked against the
 * inherited number and `limitConfirmed: false` says so out loud, so the next reader inherits a
 * flagged assumption rather than a silent one.
 *
 * A repository that carries none of these is not in scope for the budget and is reported as such.
 *
 * @member {Object[]} TARGET_FILES
 */
export const TARGET_FILES = Object.freeze([
    {path: 'AGENTS.md',                    harness: 'Antigravity + Claude', limitConfirmed: true},
    {path: '.agents/ANTIGRAVITY_RULES.md', harness: 'Antigravity',          limitConfirmed: true},
    {path: '.claude/CLAUDE.md',            harness: 'Claude Code',          limitConfirmed: false}
]);

/**
 * A whole-line `@path` import. Claude Code resolves these relative to the importing file and loads
 * the target's CONTENT, so the importer's own byte count is not what the seat pays.
 *
 * @member {RegExp} AT_IMPORT_PATTERN
 */
export const AT_IMPORT_PATTERN = /^@(\S+)\s*$/;

/**
 * @summary Returns the bytes a harness actually loads for an entry point, following BOTH indirections.
 *
 * An entry point can reach its content two ways, and the same file has been spelled both: a SYMLINK
 * to a shared rules file, or a real file carrying `@`-imports. A check that reads only one form
 * computes the wrong total — `lstat` on a symlink reports the length of the target PATH STRING (12
 * bytes for `../AGENTS.md`), and an import stub reports its own ~25 bytes, while the seat loads tens
 * of kilobytes in either case.
 *
 * Symlinks resolve through `realpathSync`, which also keys the cycle guard on file identity rather
 * than on the path used to reach it. Imports recurse, because an imported file may import further.
 *
 * @param {String}      file Root-relative or absolute path to the entry point.
 * @param {Object}      [options={}]
 * @param {String}      [options.root=process.cwd()] Base for relative paths and for reported member names.
 * @param {Set<String>} [options.seen] Realpaths already counted — cycle guard and double-count guard.
 * @returns {{bytes: Number, members: String[]}} Loaded bytes, and the imported members contributing.
 * @throws {Error} If an import names a file that does not exist. A budget that silently drops a
 *   renamed member measures a fiction and passes, so this fails closed rather than skipping.
 */
export function resolveLoadedSize(file, {root = process.cwd(), seen = new Set()} = {}) {
    const
        full = isAbsolute(file) ? file : join(root, file),
        real = realpathSync(full),
        // Members are named relative to the CANONICAL root. Imports resolve against `real`, so a
        // tree reached through a symlink — every macOS temp directory, and any checkout under a
        // linked path — would otherwise name each member by a `../../..` climb out of the
        // unresolved root and back down, which reads as a path escape rather than as composition.
        base = realpathSync(root);

    // An entry point reachable twice (symlink plus direct import) is paid for once by the loader.
    if (seen.has(real)) {
        return {bytes: 0, members: []}
    }

    seen.add(real);

    const
        text    = readFileSync(real, 'utf8'),
        members = [];

    let bytes = Buffer.byteLength(text, 'utf8');

    text.split('\n').forEach(line => {
        const match = line.match(AT_IMPORT_PATTERN);

        if (!match) {
            return
        }

        const target = resolve(dirname(real), match[1]);

        let child;

        try {
            child = resolveLoadedSize(target, {root, seen})
        } catch {
            throw new Error(`${file} imports '${match[1]}', which cannot be read`)
        }

        bytes += child.bytes;
        members.push(relative(base, target), ...child.members)
    });

    return {bytes, members}
}

/**
 * @summary Measures every target and returns one row per entry point — the pure half of the guard.
 *
 * Returned rather than printed so the arms that matter can be asserted without spawning a process:
 * a guard whose only observable is stdout gets tested by reading its own log line back, which
 * confirms the formatter rather than the measurement.
 *
 * **Absent and unreadable are different verdicts, and conflating them is how this guard would fail
 * open.** A repository carrying none of these files is not in breach of a budget it does not
 * participate in, so an absent target is `applicable: false` and never fails. But `existsSync`
 * FOLLOWS symlinks, so a dangling entry point would answer "absent" and be skipped — the guard would
 * go quiet on a seat whose rules resolve to nothing. Presence is therefore decided by `lstat`, which
 * sees the entry itself: present-but-unresolvable is an error, not a skip.
 *
 * @param {Object}   [options={}]
 * @param {String}   [options.root=process.cwd()] Tree to measure.
 * @param {Object[]} [options.targets=TARGET_FILES]
 * @param {Number}   [options.limit=PER_FILE_LIMIT_BYTES] Test seam only; no caller passes this.
 * @returns {Object[]} Rows: `{file, harness, limitConfirmed, applicable, bytes, members, over, headroom, error}`.
 */
export function collectReport({root = process.cwd(), targets = TARGET_FILES, limit = PER_FILE_LIMIT_BYTES} = {}) {
    return targets.map(({path: file, harness, limitConfirmed}) => {
        const row = {
            file, harness, limitConfirmed,
            applicable: true, bytes: null, members: [], over: false, headroom: null, error: null
        };

        try {
            lstatSync(join(root, file))
        } catch (cause) {
            // ENOENT ONLY. A bare catch made "not applicable" absorb every filesystem failure — a
            // permission denial, an unreadable mount, a malformed root whose parent component is not
            // a directory — and each of those exited 0 as a legitimately empty consumer. That is the
            // fail-open shape this guard exists to prevent, reintroduced by the very negative-space
            // contract that lets Brain, Skills and Institution adopt the baseline at all.
            //
            // Absent is a claim about the repository. Unreadable is a claim about the observation,
            // and an observation that failed supports neither verdict. Found by @neo-gpt in review.
            if (cause.code === 'ENOENT') {
                row.applicable = false;
                return row
            }

            row.error = `${file}: cannot observe the entry (${cause.code || 'unknown'}) — refusing ` +
                `to score an unreadable target as absent. ${cause.message}`;

            return row
        }

        let loaded;

        try {
            loaded = resolveLoadedSize(file, {root})
        } catch (cause) {
            // Fail closed: an unresolvable member means the total is unknown, and an unknown total
            // must never render as a pass.
            row.error = cause.message;
            return row
        }

        row.bytes    = loaded.bytes;
        row.members  = loaded.members;
        row.over     = loaded.bytes > limit;
        row.headroom = limit - loaded.bytes;

        return row
    })
}

/** @summary Prints the CLI contract. */
function printHelp(out) {
    out([
        'Usage: neo-agent-skills-substrate-size [--root <dir>] [--quiet]',
        '',
        'Measures the per-turn agent substrate entry points in a consuming repository against the',
        `${PER_FILE_LIMIT_BYTES} byte per-file budget, following symlinks and whole-line @-imports.`,
        '',
        '  --root, -r   Tree to measure. Defaults to the current working directory.',
        '  --quiet, -q  Print only the verdict line.',
        '  --help,  -h  Print this help.',
        '',
        'Exit codes: 0 measured and within budget (or no targets present), 1 breach or unmeasurable',
        'target, 2 CLI misuse. The limit and the target roster are not options — they ship with the',
        'guard so a pull request cannot widen the budget it is judged by.'
    ].join('\n'))
}

/**
 * @summary Reports every target and returns the process exit code.
 * @param {String[]} argv
 * @param {{cwd?: String, out?: Function, error?: Function}} options
 * @returns {Number} Process exit code.
 */
export function run(argv = process.argv.slice(2), {cwd = process.cwd(), out = console.log, error = console.error} = {}) {
    let parsed;

    try {
        parsed = parseArgs({
            args            : argv,
            allowPositionals: false,
            strict          : true,
            options         : {
                help : {type: 'boolean', short: 'h', default: false},
                quiet: {type: 'boolean', short: 'q', default: false},
                root : {type: 'string',  short: 'r'}
            }
        })
    } catch (cause) {
        error(`check-substrate-size: ${cause.message}`);
        return 2
    }

    if (parsed.values.help) {
        printHelp(out);
        return 0
    }

    const
        root  = resolve(cwd, parsed.values.root ?? '.'),
        quiet = parsed.values.quiet,
        rows  = collectReport({root});

    rows.forEach(({file, harness, limitConfirmed, applicable, bytes, members, over, headroom, error: rowError}) => {
        if (quiet) {
            return
        }

        if (!applicable) {
            out(`➖ ${file.padEnd(30)} : not present — N/A for this repository`);
            return
        }

        if (rowError) {
            error(`❌ ${file.padEnd(30)} : ${rowError}`);
            return
        }

        // Headroom, not just pass/fail: this drift is gradual, so a shrinking margin is the signal.
        // By the time it flips to a breach the substrate is already truncating, and headroom counts
        // the bytes an author may still ADD, which is the question they are actually asking.
        out(`${over ? '❌' : '✅'} ${file.padEnd(30)} : ${bytes} bytes · limit ${PER_FILE_LIMIT_BYTES} · ` +
            `${over ? `OVER by ${-headroom}` : `headroom ${headroom}`} · ${harness}` +
            `${limitConfirmed ? '' : ' · limit inherited from another harness, semantics unconfirmed'}`);

        // Name what the total is made of whenever it is more than the file itself, so a reader can
        // see WHY an entry point costs more than its own bytes rather than re-deriving the chain.
        members.length && out(`   composed via @-import: ${members.join(', ')}`)
    });

    const
        breached     = rows.filter(row => row.over),
        unmeasurable = rows.filter(row => row.error),
        measured     = rows.filter(row => row.applicable && !row.error);

    if (breached.length || unmeasurable.length) {
        breached.forEach(row => error(
            `check-substrate-size: ${row.file} is ${row.bytes} bytes, over the ${PER_FILE_LIMIT_BYTES} byte limit by ${-row.headroom}.`
        ));
        unmeasurable.forEach(row => error(`check-substrate-size: ${row.file} could not be measured — ${row.error}`));
        error('The bottom of an over-budget file is silently truncated and a seat loses the tail of its own rules.');
        error('Fix by migrating granular instruction into .agents/skills/ (Progressive Disclosure).');
        error('Do NOT raise the limit to make this pass: a graduated budget is a decision, not a lint setting.');
        return 1
    }

    if (!measured.length) {
        out(`check-substrate-size: no substrate entry points in this repository — N/A, nothing to measure.`);
        return 0
    }

    out(`check-substrate-size: ${measured.length} of ${rows.length} entry point(s) present, all within ${PER_FILE_LIMIT_BYTES} bytes.`);
    return 0
}

// Entrypoint guard, canonicalized on BOTH sides — and it has to be both.
//
// The common spellings compare `process.argv[1]` to `import.meta.url` directly, which disagree
// whenever the script is reached through a symlink: argv[1] is the link path, import.meta.url is the
// resolved target, so the module loads, `run()` never runs, and the process exits 0 — a guard that
// silently stops guarding, in a script whose entire job is to fail loudly. A package `bin` IS such a
// symlink once installed, so this is the shipping path, not an edge case.
//
// Realpathing only argv[1] fixes the ordinary symlink case and leaves one open, because
// import.meta.url is usually already resolved but not always: under `--preserve-symlinks-main` node
// keeps the link path there, so the resolved argv[1] and the unresolved import.meta.url differ and
// the guard goes false again. Same silent exit 0, reachable by a flag rather than by a link.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    process.exitCode = run()
}
