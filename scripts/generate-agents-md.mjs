#!/usr/bin/env node
/**
 * @summary Emits a repository's and audience's `AGENTS.md` from the sectioned source of record.
 *
 * `AGENTS.md` is turn-loaded substrate: every seat pays its byte cost on every turn, against a hard
 * per-file budget. Hand-maintaining it per repository has already produced two divergent copies, so
 * a gate that is load-bearing in one repository ships to repositories where it governs nothing and
 * is paid for out of a budget measured in hundreds of bytes.
 *
 * **Applicability is DECLARED, never inferred.** Each section names the repositories and audiences
 * it applies to in its own front-matter. Three inference strategies have now failed on this exact
 * question, each more sophisticated than the last: an on-disk scan (`find` returns a
 * checkout-dependent answer to a repository question, with no error to signal it), a token grep (a
 * section entirely about Memory Core scores zero when it says "save the consolidated turn" rather
 * than naming a tool), and tracked-directory presence (`devindex` tracks files under `ai/` that are
 * MCP connection JSON, not the AiConfig leaves the gate governs). A generator that guessed would
 * reproduce the defect it exists to remove — and would do it silently.
 *
 * Wrapper grouping is declared for the same reason: `§neo_identity_anchor` and
 * `§swarm_topology_anchor` are adjacent AND both wrapped, yet sit in separate `neo_core_overrides`
 * blocks, while `§core_values` and `§identity_prompt_firewall` share one. Adjacency cannot tell
 * those apart.
 */

import {parseArgs}                     from 'node:util';
import {readdirSync, readFileSync, realpathSync, writeFileSync} from 'node:fs';
import {dirname, join}                 from 'node:path';
import {fileURLToPath}                 from 'node:url';

const
    here        = dirname(fileURLToPath(import.meta.url)),
    packageRoot = dirname(here),
    sourceRoot  = join(packageRoot, 'agents-md'),
    WRAPPER_OPEN  = '<neo_core_overrides authority="repo-local" target="training-prior">',
    WRAPPER_CLOSE = '</neo_core_overrides>';

/**
 * @summary The byte budget a harness enforces on one turn-loaded file.
 *
 * Shared with `check-substrate-size.mjs` by value rather than by import: that script measures a
 * CALLER tree and ships its limit so a pull request cannot widen the budget it is judged by. A
 * generator that imported the number would let a source change move it.
 * @member {Number}
 */
export const PER_FILE_LIMIT_BYTES = 24576;

/**
 * @summary Splits one section file into its declarations and its body.
 *
 * The front-matter is read as a flat key/value block rather than through a YAML dependency: the
 * schema is five keys, two of them lists, and a parser is cheaper than a dependency in a package
 * consumers install to get guards.
 * @param {String} text
 * @param {String} name File name, for the error message.
 * @returns {{audiences: String[], body: String, id: String, order: Number, repos: String[], wrapperGroup: (String|null)}}
 */
export function parseSection(text, name) {
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);

    if (!match) throw new Error(`${name}: missing front-matter block`);

    const
        declared = Object.fromEntries(match[1].split('\n').filter(Boolean).map(line => {
            const at = line.indexOf(':');
            if (at < 0) throw new Error(`${name}: front-matter line is not key: value — ${line}`);
            return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
        })),
        list = key => {
            const raw = declared[key];
            if (raw === undefined) throw new Error(`${name}: front-matter must declare ${key}`);
            if (raw === 'TODO')    throw new Error(`${name}: ${key} is still TODO — applicability must be decided by reading, not left to the generator`);
            return raw.replace(/^\[|\]$/g, '').split(',').map(value => value.trim()).filter(Boolean)
        };

    return {
        audiences   : list('audiences'),
        body        : match[2].replace(/\n+$/, ''),
        id          : declared.id,
        listGroup   : declared.listGroup ?? null,
        listNumber  : declared.listNumber === undefined ? null : Number(declared.listNumber),
        order       : Number(declared.order),
        repos       : list('repos'),
        wrapperGroup: declared.wrapperGroup ?? null
    }
}

/**
 * @summary Reads every section from the source of record, ordered.
 * @param {String} [root=sourceRoot]
 * @returns {Object[]}
 */
export function readSections(root = sourceRoot) {
    const dir = join(root, 'sections');

    return readdirSync(dir).filter(name => name.endsWith('.md')).sort()
        .map(name => parseSection(readFileSync(join(dir, name), 'utf8'), name))
        .sort((a, b) => a.order - b.order)
}

/**
 * @summary Assembles the emitted file for one repository and audience.
 *
 * **A wrapper group is ONE block, not a state machine.** Consecutive included sections sharing a
 * group collapse into a single `neo_core_overrides` block; sections without a group are their own
 * block; blocks join with a blank line. Excluding a section from the middle of a group therefore
 * still yields a balanced block, and two adjacent-but-distinct groups stay two blocks.
 *
 * The tag spacing is exact and load-bearing, because the emitted file must diff clean against a
 * hand-maintained original: the open tag is glued to the first heading with a single newline and
 * the close tag to the last content line, while everything else is separated by a blank line. A
 * uniform join produces a blank line inside the tags and a whole-file diff.
 * @param {Object} options
 * @param {String} options.audience
 * @param {String} options.preamble
 * @param {String} options.repo
 * @param {Object[]} options.sections
 * @returns {String}
 */
export function assemble({audience, preamble, repo, sections}) {
    const
        included = sections.filter(section =>
            section.repos.includes(repo) && section.audiences.includes(audience)),
        blocks   = [];

    included.forEach(section => {
        const previous = blocks[blocks.length - 1],
              // A numbered item renders with its DECLARED number, never its position. Dropping one
              // rule from a repository must not renumber the rest, because cross-references name
              // them by number ("§critical_gates #4") from other files this generator cannot see.
              rendered = section.listNumber === null ? section.body : `${section.listNumber}. ${section.body}`;

        if (section.listGroup && previous?.listGroup === section.listGroup) {
            previous.bodies.push(rendered);
            return
        }

        if (section.wrapperGroup && previous?.group === section.wrapperGroup && !section.listGroup) {
            previous.bodies.push(rendered)
        } else {
            blocks.push({bodies: [rendered], group: section.wrapperGroup, listGroup: section.listGroup})
        }
    });

    const rendered = blocks.map(block => {
        // A list group joins on single newlines: its items are one markdown list, not sibling blocks.
        const joined = block.listGroup ? block.bodies.join('\n') : block.bodies.join('\n\n');

        return block.group ? `${WRAPPER_OPEN}\n${joined}\n${WRAPPER_CLOSE}` : joined
    });

    return [preamble, ...rendered].join('\n\n') + '\n'
}

/**
 * @summary Every repository and audience the source declares, derived rather than listed.
 *
 * The declarations ARE the supported set: a hardcoded list would be a second place to update and a
 * silent way for the two to disagree. Used to refuse unknown input BEFORE any output is produced —
 * without it a typo emits the preamble alone, reports success, and overwrites the destination file
 * it was pointed at. Found by @neo-gpt in review.
 * @param {String} [root=sourceRoot]
 * @returns {{audiences: Set<String>, repos: Set<String>}}
 */
export function readSupported(root = sourceRoot) {
    const sections = readSections(root);

    return {
        audiences: new Set(sections.flatMap(section => section.audiences)),
        repos    : new Set(sections.flatMap(section => section.repos))
    }
}

/**
 * @summary Emits one repository/audience variant.
 * @param {Object} options
 * @param {String} options.audience
 * @param {String} options.repo
 * @param {String} [options.root=sourceRoot]
 * @returns {{bytes: Number, text: String}}
 */
export function generate({audience, repo, root = sourceRoot}) {
    const text = assemble({
        audience,
        preamble: readFileSync(join(root, 'preamble.md'), 'utf8').replace(/\n+$/, ''),
        repo,
        sections: readSections(root)
    });

    return {bytes: Buffer.byteLength(text, 'utf8'), text}
}

/**
 * @summary CLI entry.
 * @param {String[]} [argv]
 * @param {Object} [options={}]
 * @param {Function} [options.out=console.log] Status lines, for a human.
 * @param {Function} [options.error=console.error]
 * @param {String} [options.root] Source root. Injectable so the budget refusal can be exercised
 * against a fixture; deliberately NOT a CLI flag, because a caller that can repoint the source can
 * emit a variant that never passed the real declarations.
 * @param {Function} [options.write] The DOCUMENT sink. Separate from `out` on purpose: `console.log`
 * appends a newline, so emitting the document through it makes `> file` differ from `--out file` by
 * one byte — and the one thing this generator must survive is a byte-exact diff against the
 * hand-maintained original it replaces.
 * @returns {Number} Exit code.
 */
export function run(argv = process.argv.slice(2), {
    out = console.log, error = console.error, root = sourceRoot, write = text => process.stdout.write(text)
} = {}) {
    let parsed;

    try {
        parsed = parseArgs({
            args            : argv,
            allowPositionals: false,
            strict          : true,
            options         : {
                audience: {type: 'string', default: 'maintainer'},
                out     : {type: 'string'},
                repo    : {type: 'string'}
            }
        })
    } catch (cause) {
        error(`generate-agents-md: ${cause.message}`);
        return 1
    }

    const {audience, out: target, repo} = parsed.values;

    if (!repo) {
        error('generate-agents-md: --repo is required (the repository the variant is emitted FOR).');
        return 1
    }

    let supported;

    try {
        supported = readSupported(root)
    } catch (cause) {
        error(`generate-agents-md: ${cause.message}`);
        return 1
    }

    // Refused BEFORE `generate`, so an unknown repository never reaches the write. A filter that
    // matches nothing is not an empty variant, it is a question the source cannot answer.
    if (!supported.repos.has(repo)) {
        error(`generate-agents-md: no section declares the repository "${repo}". Declared: ${[...supported.repos].sort().join(', ')}`);
        return 1
    }

    if (!supported.audiences.has(audience)) {
        error(`generate-agents-md: no section declares the audience "${audience}". Declared: ${[...supported.audiences].sort().join(', ')}`);
        return 1
    }

    let result;

    try {
        result = generate({audience, repo, root})
    } catch (cause) {
        error(`generate-agents-md: ${cause.message}`);
        return 1
    }

    // The budget is a property of the emitted file, so it is asserted here rather than left to the
    // consumer repo's own guard: a variant that breaches is never written, because the harness would
    // silently truncate its tail and the loss is unobservable from inside the seat that suffers it.
    if (result.bytes > PER_FILE_LIMIT_BYTES) {
        error(`generate-agents-md: ${repo}/${audience} is ${result.bytes} B, over the ${PER_FILE_LIMIT_BYTES} B budget by ${result.bytes - PER_FILE_LIMIT_BYTES}.`);
        return 1
    }

    if (target) {
        writeFileSync(target, result.text);
        out(`✅ ${repo}/${audience} → ${target} (${result.bytes} B, ${PER_FILE_LIMIT_BYTES - result.bytes} B headroom)`)
    } else {
        write(result.text)
    }

    return 0
}

// Entrypoint guard, canonicalized on BOTH sides — `bin` installs this as a symlink, and realpathing
// only `argv[1]` disagrees under `--preserve-symlinks-main`, where node keeps the link path in
// `import.meta.url`. The module would load, `run()` would never execute, and the process would exit
// 0: a guard that stops guarding. No stdin branch, deliberately — a script that waits on stdin it
// never needs hangs in any non-TTY shell.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    process.exit(run())
}
