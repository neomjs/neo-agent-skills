#!/usr/bin/env node
/**
 * @summary Render a contributor-facing `AGENTS.md` from schema-validated repo facts plus canonical
 * public-common clauses.
 *
 * The output is **contributor-only**. The maintainer constitution is deliberately not reachable
 * from here: appending it to a public fork's committed file would make unreachable internal
 * commands — mailbox protocol, Memory Core saves, A2A lifecycle — *active authority* for every fork
 * agent. Facts are owned by the consuming repo; schema, renderer and public-common clauses are
 * owned by canonical; neither owns the other's bytes.
 *
 * Humans edit `.agents/repo-facts.json`, never the rendered output. `--check` proves the committed
 * file still equals what the inputs render, which is the second leg of consumer CI: a hand-edit to
 * the generated surface is drift even when every byte of it looks reasonable.
 *
 * @example
 * node scripts/render-agents-md.mjs --root . --check   # verify, mutate nothing
 * node scripts/render-agents-md.mjs --root . --write   # render AGENTS.md
 */

import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {dirname, join, resolve}                  from 'node:path';
import {fileURLToPath}                           from 'node:url';

const
    here          = dirname(fileURLToPath(import.meta.url)),
    canonicalRoot = join(here, '..'),
    SCHEMA        = join(canonicalRoot, 'facts/repo-facts.schema.json'),
    COMMON        = join(canonicalRoot, 'facts/public-common.md'),
    FACTS_IN      = '.agents/repo-facts.json',
    OUT           = 'AGENTS.md';

/** @summary Parse `--flag [value]` pairs. */
function parseArgs(argv) {
    const out = {};

    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--')) {
            const key = argv[i].slice(2);

            out[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
        }
    }

    return out
}

/**
 * @summary Validate facts against the bounded schema.
 *
 * Deliberately dependency-free: the canonical store is synced as committed bytes into repos whose
 * toolchains we do not control, so a guard that needs `npm install` to run is a guard that will not
 * run. Only the constructs this schema actually uses are implemented — an unknown construct is a
 * schema change, and it should fail loudly here rather than be silently skipped.
 *
 * @param {Object} facts
 * @param {Object} schema
 * @param {String} [path]
 * @returns {String[]} violations, empty when valid
 */
function validate(facts, schema, path = '') {
    const errors = [];

    if (schema.type === 'object') {
        if (typeof facts !== 'object' || facts === null || Array.isArray(facts)) {
            return [`${path || 'root'}: expected an object`]
        }

        for (const key of schema.required || []) {
            if (!Object.hasOwn(facts, key)) errors.push(`${path}${key}: required, and absent`)
        }

        for (const [key, value] of Object.entries(facts)) {
            const sub = schema.properties?.[key];

            if (!sub) {
                if (schema.additionalProperties === false) {
                    errors.push(
                        `${path}${key}: not permitted by the schema. The cap is structural — if this is a ` +
                        `genuine repo fact, amend the schema; if it is policy, it belongs in the maintainer ` +
                        `substrate, not a fork's committed file.`
                    )
                }
                continue
            }

            errors.push(...validate(value, sub, `${path}${key}.`))
        }

        return errors
    }

    if (schema.type === 'array') {
        if (!Array.isArray(facts)) return [`${path.slice(0, -1)}: expected an array`];

        if (schema.maxItems !== undefined && facts.length > schema.maxItems) {
            errors.push(`${path.slice(0, -1)}: ${facts.length} items exceeds the cap of ${schema.maxItems}`)
        }

        facts.forEach((item, i) => errors.push(...validate(item, schema.items, `${path.slice(0, -1)}[${i}].`)));

        return errors
    }

    const label = path.slice(0, -1);

    if (schema.type === 'string') {
        if (typeof facts !== 'string')                                    errors.push(`${label}: expected a string`);
        else {
            if (schema.minLength && facts.length < schema.minLength)      errors.push(`${label}: must not be empty`);
            if (schema.maxLength && facts.length > schema.maxLength)      errors.push(`${label}: ${facts.length} chars exceeds the ${schema.maxLength}-char cap`);
            if (schema.pattern && !new RegExp(schema.pattern).test(facts)) errors.push(`${label}: does not match ${schema.pattern}`);
            if (schema.enum && !schema.enum.includes(facts))               errors.push(`${label}: must be one of ${schema.enum.join(', ')}`)
        }
    }

    return errors
}

/**
 * @summary Deterministically render the contributor head from validated facts.
 * @param {Object} facts
 * @returns {String}
 */
function renderHead(facts) {
    const lines = [
        '<!-- GENERATED — do not edit. Source: .agents/repo-facts.json + canonical public-common clauses.',
        '     Edit the facts source and re-render; a hand-edit here is drift the sync guard rejects. -->',
        '',
        '# Contributing agents & humans',
        '',
        '## Repository facts',
        '',
        '| fact | value |',
        '|---|---|',
        `| repository | \`${facts.repository}\` |`,
        `| default branch | \`${facts.defaultRef}\` |`
    ];

    if (facts.ticketAuthority) lines.push(`| ticket authority | ${facts.ticketAuthority} |`);

    lines.push(`| install | \`${facts.install}\` |`);

    for (const [name, cmd] of Object.entries(facts.commands)) {
        lines.push(`| ${name} | \`${cmd}\` |`)
    }

    if (facts.forbiddenCommands?.length) {
        lines.push('', '## Commands that look right and are not', '');

        for (const {command, reason} of facts.forbiddenCommands) {
            lines.push(`- \`${command}\` — ${reason}`)
        }
    }

    if (facts.notes?.length) {
        lines.push('', '## Notes', '');
        for (const note of facts.notes) lines.push(`- ${note}`)
    }

    return lines.join('\n')
}

const
    args  = parseArgs(process.argv.slice(2)),
    root  = resolve(args.root || '.'),
    factsPath = join(root, FACTS_IN);

if (!existsSync(factsPath)) {
    console.error(`no ${FACTS_IN}: this repo owns no facts source, so its contributor surface cannot be rendered.`);
    process.exit(1)
}

const
    schema = JSON.parse(readFileSync(SCHEMA, 'utf8')),
    facts  = JSON.parse(readFileSync(factsPath, 'utf8')),
    errors = validate(facts, schema);

if (errors.length) {
    console.error(`${FACTS_IN} fails the bounded facts schema:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1)
}

const rendered = `${renderHead(facts)}\n\n${readFileSync(COMMON, 'utf8').trimEnd()}\n`;

if (args.write) {
    writeFileSync(join(root, OUT), rendered);
    console.log(`rendered ${OUT} (${rendered.length} bytes) from validated facts + canonical public-common clauses`);
    process.exit(0)
}

const committed = existsSync(join(root, OUT)) ? readFileSync(join(root, OUT), 'utf8') : null;

if (committed === null) {
    console.error(`${OUT} is absent, but facts render cleanly. Run with --write.`);
    process.exit(1)
}

if (committed !== rendered) {
    console.error(
        `${OUT} does not equal its inputs. It was hand-edited, or the facts changed without a re-render.\n` +
        `  committed: ${committed.length} bytes\n  rendered : ${rendered.length} bytes\n` +
        `  Edit .agents/repo-facts.json and re-render; the generated surface is not an editing surface.`
    );
    process.exit(1)
}

console.log(`${OUT} equals schema-validated facts + canonical public-common clauses (${rendered.length} bytes)`);
