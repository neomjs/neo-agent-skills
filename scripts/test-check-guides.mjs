#!/usr/bin/env node
/**
 * @summary Contract checks for the guide lint. Each HARD rule fires on its true positive and stays quiet on the
 * false positive that would make it noisy. The data roots resolve where they are pointed. A skipped rule drops only
 * itself, and a skip naming no rule is refused.
 */

import assert                                          from 'node:assert/strict';
import {spawnSync}                                     from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir}                                        from 'node:os';
import {dirname, join, relative}                       from 'node:path';
import {fileURLToPath}                                 from 'node:url';
import {
    RULES, checkDeadLinks, checkDeadScriptRefs, checkMermaidBlock, checkMermaidOrientation, checkOpenApiToolParity,
    checkProse, checkTicketIds, discoverGuideSeries, extractMermaidBlocks, lintGuide, parseArgs, runLint
} from './check-guides.mjs';

const
    here     = dirname(fileURLToPath(import.meta.url)),
    GUARD    = join(here, 'check-guides.mjs'),
    fixtures = [];

/**
 * @summary A disposable repository root holding the given files.
 * @param {Object} files repo-relative path to content
 * @returns {String} the root
 */
function tree(files) {
    const root = mkdtempSync(join(tmpdir(), 'check-guides-'));

    fixtures.push(root);

    for (const [file, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, file)), {recursive: true});
        writeFileSync(join(root, file), content)
    }

    return root
}

/**
 * @summary {@link runLint} with its report silenced, so the suite prints only its verdict.
 * @param {Object} options
 * @returns {Object}
 */
function lint(options) {
    const {log, error} = console;

    console.log = console.error = () => {};

    try {
        return runLint(options)
    } finally {
        Object.assign(console, {log, error})
    }
}

const guide = lines => lines.join('\n');

// ── The CLI ────────────────────────────────────────────────────────────────────────────────────
{
    const help = spawnSync(process.execPath, [GUARD, '--help'], {encoding: 'utf8'});

    assert.equal(help.status, 0, '--help exits 0');
    assert.match(help.stdout, /Usage: neo-agent-skills-guides/);
    assert.match(help.stdout, /--skip <rule>/);

    assert.deepEqual(parseArgs([]), {files: [], warnAsError: false, scriptRoots: [], skip: []}, 'defaults');
    assert.deepEqual(parseArgs(['--warn-as-error', 'a.md', 'b.md']),
        {files: ['a.md', 'b.md'], warnAsError: true, scriptRoots: [], skip: []}, 'files and --warn-as-error');
    assert.equal(parseArgs(['--help']).help, true);
    assert.deepEqual(parseArgs(['--root', 'r', '--script-root', 'a', '--script-root', 'b', '--openapi-root', 'o']),
        {files: [], warnAsError: false, scriptRoots: ['a', 'b'], skip: [], root: 'r', openapiRoot: 'o'}, 'the root flags');
    assert.deepEqual(parseArgs(['--skip', 'no-mermaid', '--skip', 'dead-script-ref, ticket-id']).skip,
        ['no-mermaid', 'dead-script-ref', 'ticket-id'], '--skip repeats and takes a comma list');

    assert.throws(() => parseArgs(['--bogus']), /Unknown argument/);
    assert.throws(() => parseArgs(['--skip', 'dead-scrpt-ref']), /--skip names no rule/, 'a misspelt rule is refused');
    assert.throws(() => parseArgs(['--root']), /--root needs a value/);
    assert.throws(() => parseArgs(['--script-root', '--warn-as-error']), /--script-root needs a value/);

    const refused = spawnSync(process.execPath, [GUARD, '--skip', 'nothing'], {encoding: 'utf8'});

    assert.equal(refused.status, 2, 'a refused argument exits 2, not 1');
    assert.match(refused.stderr, /--skip names no rule: "nothing"/)
}

// ── Mermaid ────────────────────────────────────────────────────────────────────────────────────
{
    const [block] = extractMermaidBlocks(guide(['# Title', '', '```mermaid', 'flowchart TD', '  A --> B', '```', 'after']));

    assert.equal(block.startLine, 4, 'a block starts on its first body line');
    assert.equal(extractMermaidBlocks('# Prose only').length, 0);

    assert.deepEqual(checkMermaidBlock({body: 'flowchart TD\n  A["x"] --> B["y"]\n  B --> C["z"]', startLine: 1}), [], 'a clean diagram');
    assert.deepEqual(checkMermaidBlock({body: 'flowchart TD\n  A --> B\n  classDef graph fill:#fff', startLine: 1}).map(f => f.rule),
        ['mermaid-reserved-word'], 'a reserved classDef name');
    assert.ok(checkMermaidBlock({body: 'flowchart TD\n  end[Done] --> A', startLine: 1}).some(f => f.rule === 'mermaid-reserved-word'),
        'a reserved node id');
    assert.deepEqual(checkMermaidBlock({body: 'flowchart TD\n  A --> A', startLine: 1}).map(f => f.rule), ['mermaid-self-loop']);
    assert.deepEqual(checkMermaidBlock({body: 'graph LR\n  A --> B', startLine: 1}), [], 'the declaration line is not a node');
    assert.deepEqual(checkMermaidBlock({body: 'flowchart TD\n  Detect --> Classify["x"]\n  Classify --> Heal', startLine: 1}), [],
        '"Classify" is not the reserved "class"');

    assert.deepEqual(checkMermaidOrientation({body: 'flowchart TD\n A-->B', startLine: 1}), []);
    assert.deepEqual(checkMermaidOrientation({body: 'flowchart LR\n A[a]-->B[b]\n B-->C[c]', startLine: 1}), [], 'a small LR flow');
    assert.deepEqual(checkMermaidOrientation({body: ['flowchart LR', 'A[a]-->B[b]', 'B-->C[c]', 'C-->D[d]', 'D-->E[e]', 'E-->F[f]', 'F-->G[g]', 'G-->H[h]'].join('\n'), startLine: 1})
        .map(f => [f.severity, f.rule]), [['WARN', 'mermaid-lr-squish']], 'a large LR flow warns')
}

// ── Links, scripts and prose ───────────────────────────────────────────────────────────────────
{
    const dead = checkDeadLinks('[gone](./missing.md) [here](../there.md) [ext](https://neomjs.com/x.md)', '/repo/learn', p => p.endsWith('there.md'));

    assert.deepEqual(dead.map(f => [f.rule, f.detail.includes('missing.md')]), [['dead-link', true]], 'only the missing relative target');

    const refs = checkDeadScriptRefs('Run `ai:query` then `ai:restore`, and `npm run ai:bogus`.', new Set(['ai:restore'])).map(f => f.detail).join(' ');

    assert.match(refs, /ai:query/);
    assert.match(refs, /ai:bogus/);
    assert.doesNotMatch(refs, /ai:restore/, 'a defined script is not dead');
    assert.deepEqual(checkDeadScriptRefs('The ai:foo namespace is conceptual.', new Set()), [], 'bare prose is not a reference');

    const prose = checkProse(['## Tools', 'text', 'Neo is not a framework.', '```', '## Tools', 'a framework example', '```'].join('\n'));

    assert.equal(prose.filter(f => f.rule === 'feature-list-heading').length, 1, 'fenced code is not prose');
    assert.equal(prose.filter(f => f.rule === 'identity-framework').length, 1);

    assert.ok(lintGuide('# Guide\n\nProse only.', {fileDir: '/repo', scriptKeys: new Set()}).some(f => f.rule === 'no-mermaid'));
    assert.ok(!lintGuide('# Guide\n\n```mermaid\nflowchart TD\n  A["x"] --> B["y"]\n```\n', {fileDir: '/repo', scriptKeys: new Set(), existsFn: () => true})
        .some(f => f.rule === 'no-mermaid'), 'a guide with a diagram')
}

// ── Ticket ids ─────────────────────────────────────────────────────────────────────────────────
{
    const found = checkTicketIds(['# Guide', 'The old path came from #12345 and PR #23456.', 'Inline `#34567` still rots.', '```text', 'Replay #45678 here.', '```'].join('\n'));

    assert.deepEqual(found.map(f => f.line), [2, 2, 3, 5], 'prose, inline and fenced references, each on its line');
    assert.ok(found.every(f => f.severity === 'HARD' && f.rule === 'ticket-id'));

    const colors = checkTicketIds([
        '```mermaid', 'flowchart TD', '  classDef pane fill:#3498db,stroke:#282829,color:#1234', '```',
        '```css', '.pane { border: 1px solid #282829; color: #1234; }', '```',
        'The literal `color: #282829` is a color.',
        'The literal `#56789` is still a tracker reference.',
        'Short fragments #123 and alphanumeric hashes #123abc are not ticket ids.'
    ].join('\n'));

    assert.deepEqual(colors.map(f => [f.line, f.detail.match(/#[0-9]+/)[0]]), [[9, '#56789']], 'colors stay green, a bare code id does not');

    assert.deepEqual(checkTicketIds(['```text', 'Related: #9473', 'Ticket: #123456', 'issue: #12345678', '```', 'Refs: `#8856` in the body'].join('\n'))
        .map(f => [f.line, f.detail.match(/#[0-9]+/)[0]]), [[2, '#9473'], [3, '#123456'], [4, '#12345678'], [6, '#8856']],
        'a CSS-length id after a prose label is still a ticket')
}

// ── Tool tables ────────────────────────────────────────────────────────────────────────────────
{
    const ops   = new Set(['get_namespace_tree', 'query_raw_memories']),
          table = rows => ['## Tools', '', '| Tool | Desc |', '|---|---|', ...rows].join('\n');

    assert.deepEqual(checkOpenApiToolParity(table(['| `get_namespace_tree` | real |', '| `totally_fake_tool` | fake |']), ops)
        .map(f => [f.rule, f.detail.includes('totally_fake_tool')]), [['openapi-tool-parity', true]], 'an invented tool');
    assert.deepEqual(checkOpenApiToolParity(['## Configuration', '', '| Key | Default |', '|---|---|', '| `id` | null |'].join('\n'), ops), [],
        'a config table is not a tool catalog');
    assert.deepEqual(checkOpenApiToolParity(['## Build Tools', '', '| Name |', '|---|', '| `webpack` |'].join('\n'), ops), [],
        '"Build Tools" is not a tools heading');
    assert.deepEqual(checkOpenApiToolParity(['## Tools', '', '```', '| `totally_fake_tool` | x |', '```'].join('\n'), ops), [], 'fenced code');
    assert.deepEqual(checkOpenApiToolParity(table(['| `totally_fake_tool` | x |']), new Set()), [],
        'no operation surface checks nothing, instead of failing every row')
}

// ── Discovery and the data roots ───────────────────────────────────────────────────────────────
{
    const concept = guide([
        '# Concept', '', '```mermaid', 'flowchart TD', '    A --> B', '```', '',
        'Run `npm run ai:here`, then `npm run ai:elsewhere`.', '',
        '## Tools', '', '| Tool | Desc |', '|---|---|', '| `known_op` | real |', '| `invented_op` | fake |'
    ]);

    const root  = tree({
              'package.json'                          : JSON.stringify({scripts: {'ai:here': 'x'}}),
              'learn/agentos/Concept.md'              : concept,
              'learn/agentos/decisions/Excluded.md'   : 'Run `npm run ai:never-read`.',
              'learn/guides/series/Step.md'           : '# Step\n\nThe fix landed in #12345.\n',
              'learn/guides/series/deeper/Nested.md'  : '# Nested\n'
          }),
          other = tree({
              'package.json'                    : JSON.stringify({scripts: {'ai:elsewhere': 'y'}}),
              'ai/mcp/server/one/openapi.yaml'  : 'paths:\n  /x:\n    post:\n      operationId: known_op\n'
          });

    assert.deepEqual(discoverGuideSeries(root), ['learn/guides/series/Step.md', 'learn/guides/series/deeper/Nested.md'],
        'the series walk recurses');

    const own = lint({root});

    assert.deepEqual([own.fullGuideCount, own.ticketIdGuideCount], [1, 2], 'decisions/ stays out of the full scope');
    // The script only `other` defines, and the ticket id. No operation surface under the root, so no tool finding
    assert.equal(own.hard, 2);

    const joined = lint({root, scriptRoots: [root, other], openapiRoot: other});

    // Both scripts resolve; the invented operation and the ticket id remain
    assert.equal(joined.hard, 2);
    assert.equal(lint({root, scriptRoots: [root, other], openapiRoot: other, skip: ['openapi-tool-parity']}).hard, 1,
        'a skipped rule drops its own finding');
    assert.equal(lint({root, skip: ['dead-script-ref', 'ticket-id']}).exitCode, 0, 'and no other rule');

    const cwdRun = spawnSync(process.execPath, [GUARD], {cwd: root, encoding: 'utf8'});

    assert.equal(cwdRun.status, 1, 'the working directory is the default root');
    assert.match(cwdRun.stdout, /\[ticket-id\] line 3/);
    assert.match(cwdRun.stdout, new RegExp(relative(root, join(root, 'learn/guides/series/Step.md')).replace(/[/.]/g, '\\$&')))
}

// ── It ships, or consumers cannot invoke it ────────────────────────────────────────────────────
{
    const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'));

    assert.equal(pkg.bin['neo-agent-skills-guides'], './scripts/check-guides.mjs');
    assert.ok(pkg.files.includes('scripts/check-guides.mjs'), 'the guard must be in the published file list');
    assert.equal(RULES.length, new Set(RULES).size, 'rule ids are unique')
}

fixtures.forEach(dir => rmSync(dir, {recursive: true, force: true}));

console.log('check-guides: contract arms green.');
