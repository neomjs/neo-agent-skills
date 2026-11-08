#!/usr/bin/env node
/**
 * @summary Mechanical guide-quality lint for a repository's `learn/` guides, so a reviewer is never the only
 * thing standing between a broken diagram, a dead link or a hallucinated command and `dev`. It lints whole files,
 * not a diff: a guide that is already wrong is the failure, and diff-scoping would let it pass untouched.
 *
 * **HARD (exit 1), objectively wrong:**
 *   - `mermaid-reserved-word`: a Mermaid keyword (`graph`, `end`, `subgraph`, `class`, …) used as a node ID or
 *     `classDef` name, which silently breaks the parse and still merges green.
 *   - `mermaid-self-loop`: an `X --> X` edge.
 *   - `dead-link`: a relative `](./x.md)` or `](../x.md)` target absent on disk.
 *   - `dead-script-ref`: an `` `ai:foo` `` or `npm run ai:foo` that no script manifest defines.
 *   - `openapi-tool-parity`: a row under a Tools heading naming no `ai/mcp/server/*​/openapi.yaml` operation.
 *   - `ticket-id`: a ticket reference in nested `learn/guides/` Markdown. Guides describe the mechanism; trackers
 *     own mutable ids. CSS and Mermaid hex colors stay valid.
 *
 * **WARN (exit 0 unless `--warn-as-error`), heuristics a person confirms:** `no-mermaid`, `mermaid-lr-squish`,
 * `feature-list-heading` (reference leaking into an explanation guide) and `identity-framework`.
 *
 * **Scope.** Every rule runs over the top-level `learn/agentos/*.md` and `learn/benefits/*.md` of the root. The
 * ticket rule also walks nested `learn/guides/`. Widening every rule there would turn legacy debt into a hard gate;
 * `decisions/`, `tooling/` and `process/` stay out of the full rule set.
 *
 * **Data roots.** `dead-script-ref` resolves against the `package.json` and `cloud/package.json` of each
 * `--script-root` (default: the root). `openapi-tool-parity` resolves against `--openapi-root` (default: the root),
 * and with no operations there it checks nothing rather than failing every row. A repository whose guides name
 * another repository's scripts either passes that repository as a script root or skips the rule with `--skip`.
 */

import {existsSync, readdirSync, readFileSync, realpathSync} from 'node:fs';
import path                                                   from 'node:path';
import process                                                from 'node:process';
import {fileURLToPath}                                        from 'node:url';

/**
 * Conceptual-guide directories, top-level `*.md` only.
 * @member {String[]} GUIDE_DIRS
 */
export const GUIDE_DIRS = ['learn/agentos', 'learn/benefits'];

/**
 * The narrative guide tree the ticket rule walks recursively.
 * @member {String} GUIDE_SERIES_DIR
 */
export const GUIDE_SERIES_DIR = 'learn/guides';

/**
 * Every rule id, HARD first, so `--skip` can refuse a name no rule answers to.
 * @member {String[]} RULES
 */
export const RULES = [
    'mermaid-reserved-word', 'mermaid-self-loop', 'dead-link', 'dead-script-ref', 'openapi-tool-parity', 'ticket-id',
    'no-mermaid', 'mermaid-lr-squish', 'feature-list-heading', 'identity-framework'
];

/**
 * Mermaid keywords that break the parser when reused as a node ID or `classDef` name. `graph` and `flowchart` are
 * also the legal diagram declaration on a block's first line, which {@link checkMermaidBlock} skips.
 * @member {String[]} MERMAID_RESERVED
 */
export const MERMAID_RESERVED = ['graph', 'end', 'subgraph', 'class', 'flowchart', 'style', 'linkStyle', 'click', 'default'];

/**
 * Above this node count an `LR` flow squishes unreadable on GitHub and the portal.
 * @member {Number} LR_NODE_WARN
 */
export const LR_NODE_WARN = 6;

/**
 * A whole `##`/`###` heading that signals a reference catalog inside an explanation guide.
 * @member {RegExp} FEATURE_LIST_HEADING
 */
export const FEATURE_LIST_HEADING = /^#{2,3}\s+(available\s+)?(tools?|configuration|config|api|reference|commands?|options|parameters|flags|endpoints?|methods?|properties)\s*$/i;

/**
 * A tools-catalog heading. Narrow on purpose: config, property and schema tables share the `| `name` |` row shape,
 * and `## Build Tools` or `## Debugging Tools` must not scope their rows in.
 * @member {RegExp} TOOLS_HEADING
 */
export const TOOLS_HEADING = /^#{2,4}\s+(available\s+|mcp\s+|agent\s+|the\s+)?tools?\b/i;

const
    TOOL_TABLE_ROW     = /^\|\s*`([a-z][a-z0-9_]*)`\s*\|/,
    // CSS hexadecimal lengths that would otherwise read as numeric ticket ids
    CSS_HEX_LENGTHS    = new Set([4, 6, 8]),
    CSS_COLOR_PROPERTY = /^(?:--[\w-]+|accent-color|background(?:-color)?|border(?:-(?:block|inline)(?:-(?:start|end))?|-(?:top|right|bottom|left))?(?:-color)?|box-shadow|caret-color|color|column-rule(?:-color)?|fill|flood-color|lighting-color|outline(?:-color)?|scrollbar-color|stop-color|stroke|text-decoration(?:-color)?|text-emphasis(?:-color)?|text-shadow)$/i;

/**
 * @param {String} content
 * @param {Number} index
 * @returns {Number} the 1-based line of a character index
 */
function lineOf(content, index) {
    return content.slice(0, index).split('\n').length
}

/**
 * @summary Fenced ` ```mermaid ` blocks, each with the 1-based file line of its first body line.
 * @param {String} content
 * @returns {Object[]} `{body, startLine}`
 */
export function extractMermaidBlocks(content) {
    const blocks  = [],
          pattern = /```mermaid\s*\n([\s\S]*?)```/g;
    let match;

    while ((match = pattern.exec(content)) !== null) {
        blocks.push({body: match[1], startLine: lineOf(content, match.index) + 1})
    }

    return blocks
}

/**
 * @summary HARD checks for one Mermaid block: reserved words as node IDs or `classDef` names, and self-loops. The
 * first non-empty line is the diagram declaration and is exempt.
 * @param {Object} block `{body, startLine}`
 * @returns {Object[]} findings
 */
export function checkMermaidBlock(block) {
    const findings = [];
    let seenDeclaration = false;

    block.body.split('\n').forEach((raw, i) => {
        const line     = raw.trim(),
              fileLine = block.startLine + i;

        if (!line) return;

        if (!seenDeclaration) {
            seenDeclaration = true;
            return
        }

        const classDefMatch = line.match(/^classDef\s+([A-Za-z0-9_]+)/);

        if (classDefMatch && MERMAID_RESERVED.includes(classDefMatch[1].toLowerCase())) {
            findings.push({severity: 'HARD', rule: 'mermaid-reserved-word', line: fileLine,
                detail: `classDef named with reserved word "${classDefMatch[1]}" breaks the Mermaid parser`})
        }

        const nodeIdMatch = line.match(/(^|[^A-Za-z0-9_])(end|graph|subgraph|class)\s*[[({]/);

        if (nodeIdMatch) {
            findings.push({severity: 'HARD', rule: 'mermaid-reserved-word', line: fileLine,
                detail: `reserved word "${nodeIdMatch[2]}" used as a node ID breaks the Mermaid parser`})
        }

        // The same identifier on both ends of an edge, an optional |label| stripped
        const edgeMatch = line.match(/^([A-Za-z0-9_]+)\s*(?:--+>?|-\.-*->?|==+>?|--+)\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_]+)\b/);

        if (edgeMatch && edgeMatch[1] === edgeMatch[2]) {
            findings.push({severity: 'HARD', rule: 'mermaid-self-loop', line: fileLine,
                detail: `self-loop edge "${edgeMatch[1]} -> ${edgeMatch[1]}": use an intermediate node and two edges`})
        }
    });

    return findings
}

/**
 * @summary WARN: an `LR`/`RL` flow with more than {@link LR_NODE_WARN} distinct nodes.
 * @param {Object} block `{body, startLine}`
 * @returns {Object[]} findings
 */
export function checkMermaidOrientation(block) {
    const firstLine = block.body.split('\n').map(line => line.trim()).find(Boolean) || '';

    if (!/^(flowchart|graph)\s+(LR|RL)\b/i.test(firstLine)) return [];

    const nodeIds = new Set(block.body.match(/[A-Za-z0-9_]+(?=\s*[[({])/g) || []);

    if (nodeIds.size <= LR_NODE_WARN) return [];

    return [{severity: 'WARN', rule: 'mermaid-lr-squish', line: block.startLine,
        detail: `${nodeIds.size} nodes in an LR flow: use "flowchart TD" so it stays readable on GitHub and the portal`}]
}

/**
 * @summary HARD: relative `*.md` links whose target is absent. External URLs and bare anchors are skipped.
 * @param {String} content
 * @param {String} fileDir absolute directory of the guide
 * @param {Function} [existsFn=existsSync] injectable for tests
 * @returns {Object[]} findings
 */
export function checkDeadLinks(content, fileDir, existsFn = existsSync) {
    const findings = [],
          pattern  = /]\((\.\.?\/[^)#\s]+\.md)(#[^)]*)?\)/g;
    let match;

    while ((match = pattern.exec(content)) !== null) {
        if (!existsFn(path.resolve(fileDir, match[1]))) {
            findings.push({severity: 'HARD', rule: 'dead-link', line: lineOf(content, match.index),
                detail: `link target does not exist: ${match[1]}`})
        }
    }

    return findings
}

/**
 * @summary HARD: `ai:*` references no script manifest defines. Only the backtick and `npm run` forms count, so prose
 * naming a namespace in passing is not flagged.
 * @param {String} content
 * @param {Set<String>} scriptKeys
 * @returns {Object[]} findings
 */
export function checkDeadScriptRefs(content, scriptKeys) {
    const findings = [],
          seen     = new Set(),
          pattern  = /(?:`\s*(?:npm run\s+)?|npm run\s+)(ai:[a-z0-9][a-z0-9:-]*)/gi;
    let match;

    while ((match = pattern.exec(content)) !== null) {
        const ref = match[1],
              key = `${ref}@${lineOf(content, match.index)}`;

        if (scriptKeys.has(ref) || seen.has(key)) continue;

        seen.add(key);
        findings.push({severity: 'HARD', rule: 'dead-script-ref', line: lineOf(content, match.index),
            detail: `"${ref}" is not a script in any package manifest`})
    }

    return findings
}

/**
 * @param {String} line
 * @param {Number} index
 * @returns {Boolean} whether the offset sits inside an inline-code span (unescaped backticks before it are odd)
 */
function isInsideInlineCode(line, index) {
    let count = 0;

    for (let i = 0; i < index; i++) {
        if (line[i] === '`' && line[i - 1] !== '\\') count++
    }

    return count % 2 === 1
}

/**
 * @summary Tells an all-numeric CSS or Mermaid color from a ticket id: exempt only inside code, and only after a
 * CSS color property or a Mermaid `fill:`, `stroke:` or `color:`.
 * @param {String} line
 * @param {Number} index
 * @param {String} token
 * @param {Boolean} inFence
 * @returns {Boolean}
 */
function isSyntacticHexColor(line, index, token, inFence) {
    if (!CSS_HEX_LENGTHS.has(token.length - 1) || (!inFence && !isInsideInlineCode(line, index))) {
        return false
    }

    const before      = line.slice(0, index),
          declaration = before.match(/(?:^|[;{])\s*([-\w]+)\s*:[^#]*$/);

    return Boolean(declaration && CSS_COLOR_PROPERTY.test(declaration[1])) ||
        /\b(?:fill|stroke|color)\s*:[^#]*$/i.test(before)
}

/**
 * @summary HARD: ticket references in durable guide prose, inline or fenced. Only syntactic colors are exempt,
 * because a six-digit numeric color is lexically a future ticket id.
 * @param {String} content
 * @returns {Object[]} findings
 */
export function checkTicketIds(content) {
    const findings = [];
    let inFence = false;

    content.split('\n').forEach((line, i) => {
        if (line.trim().startsWith('```')) {
            inFence = !inFence;
            return
        }

        const pattern = /#[0-9]{4,}(?![0-9A-Za-z])/g;
        let match;

        while ((match = pattern.exec(line)) !== null) {
            if (isSyntacticHexColor(line, match.index, match[0], inFence)) continue;

            findings.push({severity: 'HARD', rule: 'ticket-id', line: i + 1,
                detail: `ticket reference "${match[0]}" rots in guides: describe the mechanism and cite stable files or authority documents instead`})
        }
    });

    return findings
}

/**
 * @summary HARD: rows under a {@link TOOLS_HEADING} naming no known operation. Fenced code is skipped, and an empty
 * operation set checks nothing: with no surface to verify against, the rule cannot tell real from invented.
 * @param {String} content
 * @param {Set<String>} operationIds
 * @returns {Object[]} findings
 */
export function checkOpenApiToolParity(content, operationIds) {
    const findings = [];

    if (!operationIds || operationIds.size === 0) return findings;

    let underTools = false,
        inFence    = false;

    content.split('\n').forEach((raw, i) => {
        const line = raw.trim();

        if (line.startsWith('```')) { inFence = !inFence; return }
        if (inFence) return;
        if (line.startsWith('#')) { underTools = TOOLS_HEADING.test(line); return }
        if (!underTools) return;

        const match = line.match(TOOL_TABLE_ROW);

        if (match && !operationIds.has(match[1])) {
            findings.push({severity: 'HARD', rule: 'openapi-tool-parity', line: i + 1,
                detail: `tool-table ref \`${match[1]}\` resolves to no ai/mcp/server/*/openapi.yaml operationId: a stale or invented tool, or a heading that is not an MCP-tool catalog`})
        }
    });

    return findings
}

/**
 * @summary WARN: catalog headings and `framework` mentions, outside fenced code.
 * @param {String} content
 * @returns {Object[]} findings
 */
export function checkProse(content) {
    const findings = [];
    let inFence = false;

    content.split('\n').forEach((raw, i) => {
        const line = raw.trim();

        if (line.startsWith('```')) { inFence = !inFence; return }
        if (inFence) return;

        if (FEATURE_LIST_HEADING.test(line)) {
            findings.push({severity: 'WARN', rule: 'feature-list-heading', line: i + 1,
                detail: `catalog heading "${line}": move reference into tooling/ and keep the guide narrative`})
        }

        if (/\bframework\b/i.test(line)) {
            findings.push({severity: 'WARN', rule: 'identity-framework', line: i + 1,
                detail: '"framework": Neo is an Application Engine and a self-evolving organism; confirm this usage is intentional'})
        }
    });

    return findings
}

/**
 * @summary Every full-scope finding for one guide. Pure apart from the injectable `existsFn`.
 * @param {String} content
 * @param {Object} ctx `{fileDir, scriptKeys, operationIds, existsFn}`
 * @returns {Object[]} findings, by line
 */
export function lintGuide(content, ctx) {
    const blocks   = extractMermaidBlocks(content),
          findings = [];

    for (const block of blocks) {
        findings.push(...checkMermaidBlock(block), ...checkMermaidOrientation(block))
    }

    if (blocks.length === 0) {
        findings.push({severity: 'WARN', rule: 'no-mermaid', line: 1,
            detail: 'no Mermaid diagram: the bar wants at least one diagram that carries the story'})
    }

    findings.push(
        ...checkDeadLinks(content, ctx.fileDir, ctx.existsFn),
        ...checkDeadScriptRefs(content, ctx.scriptKeys || new Set()),
        ...checkOpenApiToolParity(content, ctx.operationIds || new Set()),
        ...checkProse(content)
    );

    return findings.sort((a, b) => a.line - b.line)
}

/**
 * @param {String} rootDir
 * @returns {String[]} the full-scope guides, top-level `*.md` of each {@link GUIDE_DIRS} entry, root-relative
 */
export function discoverGuides(rootDir) {
    const files = [];

    for (const dir of GUIDE_DIRS) {
        const absDir = path.join(rootDir, dir);

        if (!existsSync(absDir)) continue;

        for (const entry of readdirSync(absDir, {withFileTypes: true})) {
            if (entry.isFile() && entry.name.endsWith('.md')) files.push(path.join(dir, entry.name))
        }
    }

    return files.sort()
}

/**
 * @param {String} rootDir
 * @returns {String[]} every `*.md` under {@link GUIDE_SERIES_DIR}, root-relative. Symlinks are not followed.
 */
export function discoverGuideSeries(rootDir) {
    const files = [],
          visit = dir => {
              const absDir = path.join(rootDir, dir);

              if (!existsSync(absDir)) return;

              for (const entry of readdirSync(absDir, {withFileTypes: true})) {
                  const relative = path.join(dir, entry.name);

                  if (entry.isDirectory()) visit(relative);
                  else if (entry.isFile() && entry.name.endsWith('.md')) files.push(relative)
              }
          };

    visit(GUIDE_SERIES_DIR);

    return files.sort()
}

/**
 * @summary Whether an explicit path resolves inside the guide series. Resolving first stops
 * `learn/guides/../agentos` from inheriting the recursive rule.
 * @param {String} file
 * @param {String} rootDir
 * @returns {Boolean}
 */
function isGuideSeriesFile(file, rootDir) {
    const absolute = path.isAbsolute(file) ? path.resolve(file) : path.resolve(rootDir, file),
          relative = path.relative(path.join(rootDir, GUIDE_SERIES_DIR), absolute);

    return Boolean(relative) && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) && relative.endsWith('.md')
}

/**
 * @param {String[]} roots
 * @returns {Set<String>} the scripts each root's `package.json` and `cloud/package.json` define
 */
export function loadScriptKeys(roots) {
    const keys = new Set();

    for (const root of roots) {
        for (const relative of ['package.json', 'cloud/package.json']) {
            const file = path.join(root, relative);

            if (!existsSync(file)) continue;

            for (const key of Object.keys(JSON.parse(readFileSync(file, 'utf8')).scripts || {})) keys.add(key)
        }
    }

    return keys
}

/**
 * @summary The union of `operationId`s across `ai/mcp/server/*​/openapi.yaml` under one root. Read by pattern, with
 * no YAML dependency. A missing servers directory yields an empty set.
 * @param {String} rootDir
 * @returns {Set<String>}
 */
export function loadOperationIds(rootDir) {
    const ids       = new Set(),
          serverDir = path.join(rootDir, 'ai/mcp/server');

    if (!existsSync(serverDir)) return ids;

    for (const entry of readdirSync(serverDir, {withFileTypes: true})) {
        const spec = path.join(serverDir, entry.name, 'openapi.yaml');

        if (!entry.isDirectory() || !existsSync(spec)) continue;

        for (const raw of readFileSync(spec, 'utf8').split('\n')) {
            const match = raw.match(/^\s*operationId:\s*['"]?([A-Za-z0-9_]+)/);

            if (match) ids.add(match[1])
        }
    }

    return ids
}

/**
 * @summary Parses the CLI. `--script-root` and `--skip` repeat, and `--skip` also takes a comma list. A skipped
 * name that no rule answers to is refused: a typo would otherwise skip nothing and look like coverage.
 * @param {String[]} [argv=process.argv.slice(2)]
 * @returns {Object} `{files, warnAsError, scriptRoots, skip, root?, openapiRoot?, help?}`
 */
export function parseArgs(argv = process.argv.slice(2)) {
    const options = {files: [], warnAsError: false, scriptRoots: [], skip: []},
          value   = (flag, i) => {
              if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${flag} needs a value`);

              return argv[i + 1]
          };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--warn-as-error') options.warnAsError = true;
        else if (arg === '--help' || arg === '-h') options.help = true;
        else if (arg === '--root') options.root = value(arg, i++);
        else if (arg === '--openapi-root') options.openapiRoot = value(arg, i++);
        else if (arg === '--script-root') options.scriptRoots.push(value(arg, i++));
        else if (arg === '--skip') {
            for (const rule of value(arg, i++).split(',').map(name => name.trim()).filter(Boolean)) {
                if (!RULES.includes(rule)) throw new Error(`--skip names no rule: "${rule}" (rules: ${RULES.join(', ')})`);

                options.skip.push(rule)
            }
        }
        else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
        else options.files.push(arg)
    }

    return options
}

/**
 * @summary Runs the lint and returns the outcome instead of exiting, so tests drive it directly.
 * @param {Object} [options={}] `{files, warnAsError, root, scriptRoots, openapiRoot, skip}`, every key optional
 * @returns {Object} `{exitCode, hard, warn, fullGuideCount, ticketIdGuideCount}`
 */
export function runLint(options = {}) {
    const root         = path.resolve(options.root || process.cwd()),
          skip         = new Set(options.skip || []),
          scriptKeys   = loadScriptKeys((options.scriptRoots?.length ? options.scriptRoots : [root]).map(dir => path.resolve(dir))),
          operationIds = loadOperationIds(path.resolve(options.openapiRoot || root)),
          explicit     = Boolean(options.files?.length),
          fullFiles    = explicit ? options.files : discoverGuides(root),
          ticketFiles  = explicit ? options.files.filter(file => isGuideSeriesFile(file, root)) : discoverGuideSeries(root),
          files        = new Map();

    for (const file of fullFiles)   files.set(file, {...files.get(file), full: true});
    for (const file of ticketFiles) files.set(file, {...files.get(file), ticketIds: true});

    let hard = 0,
        warn = 0;

    for (const [file, scope] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const abs      = path.isAbsolute(file) ? file : path.join(root, file),
              content  = readFileSync(abs, 'utf8'),
              findings = [];

        if (scope.full) findings.push(...lintGuide(content, {fileDir: path.dirname(abs), scriptKeys, operationIds}));
        if (scope.ticketIds) findings.push(...checkTicketIds(content));

        const kept = findings.filter(finding => !skip.has(finding.rule)).sort((a, b) => a.line - b.line);

        if (kept.length === 0) continue;

        console.log(`\n${file}`);

        for (const finding of kept) {
            console.log(`  ${finding.severity === 'HARD' ? '✗ HARD' : '· warn'}  [${finding.rule}] line ${finding.line}: ${finding.detail}`);
            finding.severity === 'HARD' ? hard++ : warn++
        }
    }

    const failed  = hard > 0 || (options.warnAsError && warn > 0),
          skipped = skip.size ? `, skipping ${[...skip].join(', ')}` : '';

    console.log(`\n[guides] ${fullFiles.length} full guide(s), ${ticketFiles.length} guide-series ticket-id scan(s)${skipped}: ${hard} hard, ${warn} warning(s).`);

    if (failed) console.error(`[guides] FAILED: ${hard} hard failure(s)${options.warnAsError ? ` + ${warn} warning(s) (--warn-as-error)` : ''}.`);
    else        console.log('[guides] OK');

    return {exitCode: failed ? 1 : 0, hard, warn, fullGuideCount: fullFiles.length, ticketIdGuideCount: ticketFiles.length}
}

const USAGE = [
    'Usage: neo-agent-skills-guides [files...] [--root <dir>] [--script-root <dir>]... [--openapi-root <dir>] [--skip <rule>[,<rule>]]... [--warn-as-error]',
    '  Full guide lint: learn/agentos/*.md and learn/benefits/*.md. Ticket-id lint: learn/guides/**/*.md.',
    '  --root <dir>         lint the guides under <dir> (default: the working directory).',
    '  --script-root <dir>  a manifest root resolving ai:* references (repeatable; default: the root).',
    '  --openapi-root <dir> where ai/mcp/server/*/openapi.yaml live (default: the root).',
    `  --skip <rule>        drop a rule (repeatable or comma-separated): ${RULES.join(', ')}.`,
    '  --warn-as-error      fail on warnings too.'
].join('\n');

// `--preserve-symlinks-main` keeps the link path in import.meta.url, so both sides are resolved before comparing
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    let options;

    try {
        options = parseArgs()
    } catch (error) {
        console.error(`[guides] ${error.message}`);
        process.exit(2)
    }

    if (options.help) {
        console.log(USAGE);
        process.exit(0)
    }

    process.exit(runLint(options).exitCode)
}
