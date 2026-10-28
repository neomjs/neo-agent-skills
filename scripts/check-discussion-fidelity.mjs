#!/usr/bin/env node
/**
 * @summary Compares explicitly marked binding inventories in a source Discussion against Epic and leaf ticket bodies.
 *
 * The comparator is pure over supplied Markdown documents and never fetches from the network.
 * Only inventories explicitly marked in the source Discussion are compared as enumerable sets;
 * unmarked prose mentions (current-state censuses, rejected options, examples, superseded paths)
 * are ignored so filename or token sweeps never false-alarm on background context.
 *
 * For each marked `inventory-id` in the source Discussion, the comparator unions all items declared
 * under the same `inventory-id` across the supplied Epic and leaf bodies and requires exact set
 * equality (zero missing identities and zero extra identities).
 */

import {readFileSync, realpathSync} from 'node:fs';
import process                      from 'node:process';
import {parseArgs}                  from 'node:util';
import {fileURLToPath}              from 'node:url';

const
    HTML_OPEN_RE  = /^ {0,3}<!--\s*binding-inventory:\s*([A-Za-z0-9._-]+)\s*-->\s*$/i,
    HTML_CLOSE_RE = /^ {0,3}<!--\s*\/binding-inventory(?:\s*:\s*([A-Za-z0-9._-]+))?\s*-->\s*$/i,
    FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})binding-inventory(?::|\s+)([A-Za-z0-9._-]+)\s*$/i,
    FENCE_LINE_RE = /^ {0,3}(`{3,}|~{3,})/,
    TABLE_SEP_RE  = /^\|[\s:|-]+\|$/,
    BACKTICK_RE   = /`([^`\n]+)`/g,
    __filename    = fileURLToPath(import.meta.url);

/**
 * @summary Strips trailing explanatory prose after an unquoted dash separator on a list line.
 * @param {String} text
 * @returns {String}
 */
function stripTrailingCommentary(text) {
    let cutIndex = -1;

    for (const token of ['—', '--', '->']) {
        let searchFrom = 0;

        while (searchFrom < text.length) {
            const idx = text.indexOf(token, searchFrom);
            if (idx === -1) break;

            const
                afterIdx  = idx + token.length,
                hasBefore = idx > 0 && (text[idx - 1] === ' ' || text[idx - 1] === '\t'),
                hasAfter  = afterIdx < text.length && (text[afterIdx] === ' ' || text[afterIdx] === '\t');

            if (hasBefore && hasAfter && (cutIndex === -1 || idx < cutIndex)) {
                cutIndex = idx;
                break
            }

            searchFrom = idx + 1
        }
    }

    return (cutIndex === -1 ? text : text.slice(0, cutIndex)).trim()
}

/**
 * @summary Parses an ASCII directory tree branch line without backtracking regular expressions.
 * @param {String} line
 * @returns {{prefix: String, entry: String}|null}
 */
function parseTreeBranch(line) {
    const
        teeIdx = line.indexOf('├──'),
        ellIdx = line.indexOf('└──');

    let idx = -1;

    if (teeIdx !== -1 && ellIdx !== -1) {
        idx = Math.min(teeIdx, ellIdx)
    } else {
        idx = teeIdx !== -1 ? teeIdx : ellIdx
    }

    if (idx === -1) return null;

    const prefix = line.slice(0, idx);

    for (let i = 0; i < prefix.length; i++) {
        const ch = prefix[i];
        if (ch !== '│' && ch !== ' ' && ch !== '\t') return null
    }

    const rest = line.slice(idx + 3);
    if (!rest || (rest[0] !== ' ' && rest[0] !== '\t')) return null;

    const entry = rest.trim();
    return entry ? {prefix, entry} : null
}

/**
 * @summary Parses lines inside one marked binding-inventory block into canonical identities.
 * Supports flat lines, bullet/numbered lists, Markdown table first-column code spans, and ASCII trees.
 * @param {String[]} lines
 * @returns {String[]}
 */
function parseBlockItems(lines) {
    const
        items     = [],
        hasTree   = lines.some(line => parseTreeBranch(line) !== null),
        treeStack = [];

    for (const rawLine of lines) {
        const
            line    = rawLine.replace(/\r$/, ''),
            trimmed = line.trim();

        if (!trimmed) continue;
        if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) continue;
        if (FENCE_LINE_RE.test(line)) continue;
        if (TABLE_SEP_RE.test(trimmed)) continue;

        if (hasTree) {
            const branch = parseTreeBranch(line);

            if (branch) {
                const
                    prefix = branch.prefix.replaceAll('│', ' '),
                    depth  = Math.floor(prefix.length / 4) + 1,
                    entry  = stripTrailingCommentary(branch.entry).replace(/^`|`$/g, '').trim(),
                    parent = treeStack[depth - 1] ?? '';

                if (entry.endsWith('/')) {
                    treeStack[depth] = `${parent}${entry}`;
                    treeStack.length = depth + 1
                } else if (entry) {
                    items.push(`${parent}${entry}`)
                }
                continue
            }

            const rootCandidate = stripTrailingCommentary(trimmed).replace(/^[-*+]\s+/, '').replace(/^`|`$/g, '');

            if (rootCandidate.endsWith('/')) {
                treeStack[0]     = rootCandidate;
                treeStack.length = 1;
                continue
            }
        }

        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const firstCell = trimmed.slice(1, -1).split('|')[0]?.trim() ?? '';

            BACKTICK_RE.lastIndex = 0;
            for (const match of firstCell.matchAll(BACKTICK_RE)) {
                const token = match[1].trim();
                if (token) items.push(token)
            }
            continue
        }

        const head = stripTrailingCommentary(trimmed);

        BACKTICK_RE.lastIndex = 0;
        const backticked = [...head.matchAll(BACKTICK_RE)].map(match => match[1].trim()).filter(Boolean);

        if (backticked.length) {
            items.push(...backticked);
            continue
        }

        if (/^(?:#|\/\/)\s/.test(head)) continue;

        const plain = head.replace(/^(?:[-*+]|\d+\.)\s+/, '').trim();
        if (plain) items.push(plain)
    }

    return items
}

/**
 * @summary Extracts explicitly marked binding inventories from a Markdown body.
 * @param {String} [markdown='']
 * @returns {{inventories: Object<String, String[]>, emptyIds: String[], errors: String[]}}
 */
export function extractBindingInventories(markdown = '') {
    const
        lines       = String(markdown).split('\n'),
        rawMap      = new Map(),
        blockCounts = new Map(),
        errors      = [];

    let active = null;

    for (let i = 0; i < lines.length; i++) {
        const
            line   = lines[i].replace(/\r$/, ''),
            lineNo = i + 1;

        if (active) {
            if (active.kind === 'html') {
                const closeMatch = HTML_CLOSE_RE.exec(line);

                if (closeMatch) {
                    const closeId = closeMatch[1];

                    if (closeId && closeId !== active.id) {
                        errors.push(`line ${lineNo}: closing binding-inventory tag "${closeId}" does not match open "${active.id}"`)
                    }

                    const parsed = parseBlockItems(active.lines);
                    parsed.forEach(item => rawMap.get(active.id).add(item));
                    active = null;
                    continue
                }

                if (HTML_OPEN_RE.test(line)) {
                    errors.push(`line ${lineNo}: nested binding-inventory open tag inside unclosed "${active.id}"`);
                    active = null;
                    continue
                }

                active.lines.push(line);
                continue
            }

            if (active.kind === 'fence') {
                const fenceMatch = FENCE_LINE_RE.exec(line);

                if (fenceMatch && fenceMatch[1][0] === active.fence[0] && fenceMatch[1].length >= active.fence.length) {
                    const parsed = parseBlockItems(active.lines);
                    parsed.forEach(item => rawMap.get(active.id).add(item));
                    active = null;
                    continue
                }

                active.lines.push(line);
                continue
            }
        }

        const htmlOpen = HTML_OPEN_RE.exec(line);
        if (htmlOpen) {
            const id = htmlOpen[1];
            if (!rawMap.has(id)) rawMap.set(id, new Set());
            blockCounts.set(id, (blockCounts.get(id) ?? 0) + 1);
            active = {kind: 'html', id, startLine: lineNo, lines: []};
            continue
        }

        if (HTML_CLOSE_RE.test(line)) {
            errors.push(`line ${lineNo}: closing binding-inventory tag with no matching open tag`);
            continue
        }

        const fenceOpen = FENCE_OPEN_RE.exec(line);
        if (fenceOpen) {
            const id = fenceOpen[2];
            if (!rawMap.has(id)) rawMap.set(id, new Set());
            blockCounts.set(id, (blockCounts.get(id) ?? 0) + 1);
            active = {kind: 'fence', fence: fenceOpen[1], id, startLine: lineNo, lines: []};
            continue
        }
    }

    if (active) {
        errors.push(`line ${active.startLine}: unclosed binding-inventory block "${active.id}"`)
    }

    const
        inventories = {},
        emptyIds    = [];

    for (const [id, set] of rawMap.entries()) {
        const sorted = [...set].sort();
        inventories[id] = sorted;
        if (sorted.length === 0) emptyIds.push(id)
    }

    return {inventories, emptyIds, errors}
}

/**
 * @summary Compares marked binding inventories in a source Discussion against the union of Epic and leaf bodies.
 * @param {Object} [options={}]
 * @param {String} [options.discussion=''] Source Discussion Markdown body.
 * @param {Array<String|{label?: String, body: String}>} [options.targets=[]] Target Epic and leaf Markdown bodies.
 * @param {Boolean} [options.requireInventory=false] Fail when the source Discussion declares zero binding inventories.
 * @returns {{
 *   ok: Boolean,
 *   mode: 'enumerable'|'judged-only',
 *   inventoryCount: Number,
 *   inventories: Object<String, {
 *     equal: Boolean,
 *     presentInTargets: Boolean,
 *     sourceCount: Number,
 *     targetCount: Number,
 *     missing: String[],
 *     extra: String[]
 *   }>,
 *   unexpectedTargetInventoryIds: String[],
 *   emptySourceInventoryIds: String[],
 *   errors: String[]
 * }}
 */
export function compareDiscussionFidelity({discussion = '', targets = [], requireInventory = false} = {}) {
    const
        sourceParsed = extractBindingInventories(discussion),
        errors       = sourceParsed.errors.map(err => `discussion: ${err}`),
        targetUnion  = new Map(),
        targetSeen   = new Set();

    targets.forEach((entry, index) => {
        const
            label  = typeof entry === 'string' ? `target[${index}]` : (entry?.label || `target[${index}]`),
            body   = typeof entry === 'string' ? entry : (entry?.body ?? ''),
            parsed = extractBindingInventories(body);

        parsed.errors.forEach(err => errors.push(`${label}: ${err}`));
        parsed.emptyIds.forEach(id => errors.push(`${label}: binding-inventory "${id}" is empty`));

        for (const [id, items] of Object.entries(parsed.inventories)) {
            targetSeen.add(id);
            if (!targetUnion.has(id)) targetUnion.set(id, new Set());
            const set = targetUnion.get(id);
            items.forEach(item => set.add(item))
        }
    });

    const
        sourceIds                    = Object.keys(sourceParsed.inventories).sort(),
        emptySourceInventoryIds      = [...sourceParsed.emptyIds].sort(),
        unexpectedTargetInventoryIds = [...targetSeen].filter(id => !(id in sourceParsed.inventories)).sort(),
        inventories                  = {};

    if (requireInventory && sourceIds.length === 0) {
        errors.push('source Discussion declares no binding-inventory blocks (--require-inventory)')
    }

    for (const id of sourceIds) {
        const
            sourceItems      = sourceParsed.inventories[id],
            sourceSet        = new Set(sourceItems),
            presentInTargets = targetSeen.has(id),
            targetItems      = [...(targetUnion.get(id) ?? new Set())].sort(),
            targetSet        = new Set(targetItems),
            missing          = sourceItems.filter(item => !targetSet.has(item)),
            extra            = targetItems.filter(item => !sourceSet.has(item)),
            equal            = presentInTargets && sourceItems.length > 0 && missing.length === 0 && extra.length === 0;

        inventories[id] = {
            equal,
            presentInTargets,
            sourceCount: sourceItems.length,
            targetCount: targetItems.length,
            missing,
            extra
        }
    }

    const
        allEqual = sourceIds.every(id => inventories[id].equal),
        ok       = errors.length === 0
            && emptySourceInventoryIds.length === 0
            && unexpectedTargetInventoryIds.length === 0
            && allEqual;

    return {
        ok,
        mode          : sourceIds.length > 0 ? 'enumerable' : 'judged-only',
        inventoryCount: sourceIds.length,
        inventories,
        unexpectedTargetInventoryIds,
        emptySourceInventoryIds,
        errors
    }
}

/**
 * @summary Prints CLI usage instructions.
 * @param {Function} write
 */
function printHelp(write) {
    write([
        'Usage: neo-agent-skills-discussion-fidelity --discussion <file> --target <file> [--target <file> ...] [options]',
        '',
        'Compares explicitly marked binding inventories in a source Discussion against the union of',
        'supplied Epic and leaf ticket bodies. Unmarked prose mentions are ignored.',
        '',
        'Markdown marker syntax:',
        '  <!-- binding-inventory: <inventory-id> -->',
        '  - `path/or/symbol`',
        '  <!-- /binding-inventory -->',
        '',
        '  or fenced:',
        '  ```binding-inventory:<inventory-id>',
        '  path/or/symbol',
        '  ```',
        '',
        'Options:',
        '  -d, --discussion <file>   Source Discussion Markdown file (required).',
        '  -t, --target <file>       Target Epic or leaf Markdown file (repeatable).',
        '  -e, --epic <file>         Alias for --target (repeatable).',
        '  -l, --leaf <file>         Alias for --target (repeatable).',
        '      --require-inventory   Fail if the source Discussion declares zero binding inventories.',
        '      --json                Emit structured JSON report.',
        '  -h, --help                Show this help.'
    ].join('\n'))
}

/**
 * @summary CLI entry point for source-Discussion enumerable inventory comparison.
 * @param {String[]} [argv]
 * @param {{out?: Function, error?: Function}} [options={}]
 * @returns {Number} Exit code (0 = pass, 1 = fidelity mismatch, 2 = usage/read error).
 */
export function run(argv = process.argv.slice(2), {out = console.log, error = console.error} = {}) {
    let parsed;

    try {
        parsed = parseArgs({
            args            : argv,
            allowPositionals: true,
            strict          : true,
            options         : {
                discussion         : {type: 'string', short: 'd'},
                target             : {type: 'string', short: 't', multiple: true},
                epic               : {type: 'string', short: 'e', multiple: true},
                leaf               : {type: 'string', short: 'l', multiple: true},
                'require-inventory': {type: 'boolean', default: false},
                json               : {type: 'boolean', default: false},
                help               : {type: 'boolean', short: 'h', default: false}
            }
        })
    } catch (cause) {
        error(`check-discussion-fidelity: ${cause.message}`);
        return 2
    }

    if (parsed.values.help) {
        printHelp(out);
        return 0
    }

    const
        discussionPath = parsed.values.discussion,
        targetPaths    = [
            ...(parsed.values.target ?? []),
            ...(parsed.values.epic ?? []),
            ...(parsed.values.leaf ?? []),
            ...parsed.positionals
        ];

    if (!discussionPath) {
        error('check-discussion-fidelity: --discussion <file> is required.');
        return 2
    }

    if (!targetPaths.length) {
        error('check-discussion-fidelity: at least one --target / --epic / --leaf <file> is required.');
        return 2
    }

    let discussionBody;
    try {
        discussionBody = readFileSync(discussionPath, 'utf8')
    } catch (cause) {
        error(`check-discussion-fidelity: cannot read discussion file ${discussionPath} — ${cause.message}`);
        return 2
    }

    const targets = [];
    for (const file of targetPaths) {
        try {
            targets.push({label: file, body: readFileSync(file, 'utf8')})
        } catch (cause) {
            error(`check-discussion-fidelity: cannot read target file ${file} — ${cause.message}`);
            return 2
        }
    }

    const result = compareDiscussionFidelity({
        discussion      : discussionBody,
        targets,
        requireInventory: Boolean(parsed.values['require-inventory'])
    });

    if (parsed.values.json) {
        out(JSON.stringify(result, null, 2));
        return result.ok ? 0 : 1
    }

    if (result.ok) {
        if (result.inventoryCount === 0) {
            out('check-discussion-fidelity: 0 marked enumerable inventories (mode: judged-only).');
        } else {
            const summary = Object.entries(result.inventories)
                .map(([id, info]) => `${id} (${info.sourceCount}/${info.targetCount})`)
                .join(', ');
            out(`check-discussion-fidelity: ${result.inventoryCount} inventory(s) matched exactly — ${summary}.`)
        }
        return 0
    }

    error('check-discussion-fidelity: source-Discussion binding inventory mismatch.');
    result.errors.forEach(msg => error(`  error: ${msg}`));
    result.emptySourceInventoryIds.forEach(id => error(`  empty source inventory: ${id}`));
    result.unexpectedTargetInventoryIds.forEach(id => error(`  unexpected target inventory id (absent from source): ${id}`));

    for (const [id, info] of Object.entries(result.inventories)) {
        if (info.equal) continue;
        if (!info.presentInTargets) {
            error(`  inventory "${id}": missing from all target Epic/leaf bodies (${info.sourceCount} expected).`)
        }
        if (info.missing.length) {
            error(`  inventory "${id}" missing (${info.missing.length}): ${info.missing.join(', ')}`)
        }
        if (info.extra.length) {
            error(`  inventory "${id}" extra (${info.extra.length}): ${info.extra.join(', ')}`)
        }
    }

    return 1
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(__filename)) {
    process.exitCode = run()
}
