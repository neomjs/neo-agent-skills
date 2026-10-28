#!/usr/bin/env node
/** @summary Contract and fixture tests for the source-Discussion binding inventory comparator CLI. */

import assert                                                    from 'node:assert/strict';
import {execFileSync, spawnSync}                                 from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir}                                                  from 'node:os';
import {dirname, join}                                           from 'node:path';
import {fileURLToPath}                                           from 'node:url';
import {compareDiscussionFidelity, extractBindingInventories, run} from './check-discussion-fidelity.mjs';
import {findArchaeology}                                         from './check-ticket-archaeology.mjs';

const
    here      = dirname(fileURLToPath(import.meta.url)),
    GUARD     = join(here, 'check-discussion-fidelity.mjs'),
    TEST_FILE = fileURLToPath(import.meta.url);

// Durable comments in both scripts must stay free of tracking/review archaeology.
assert.deepEqual(findArchaeology(readFileSync(GUARD, 'utf8')), []);
assert.deepEqual(findArchaeology(readFileSync(TEST_FILE, 'utf8')), []);

const DOCK_TARGET_30 = Object.freeze([
    'src/dashboard/dock/Workspace.mjs',
    'src/dashboard/dock/model/Document.mjs',
    'src/dashboard/dock/model/Operations.mjs',
    'src/dashboard/dock/model/Persistence.mjs',
    'src/dashboard/dock/model/PreviewContract.mjs',
    'src/dashboard/dock/model/TopologyDiff.mjs',
    'src/dashboard/dock/model/TopologyReconciler.mjs',
    'src/dashboard/dock/projection/LayoutAdapter.mjs',
    'src/dashboard/dock/projection/Reconciler.mjs',
    'src/dashboard/dock/projection/MotionSignal.mjs',
    'src/dashboard/dock/interaction/DockSplitter.mjs',
    'src/dashboard/dock/interaction/Rail.mjs',
    'src/dashboard/dock/interaction/RevealOverlay.mjs',
    'src/dashboard/dock/interaction/RevealStateMachine.mjs',
    'src/dashboard/dock/interaction/Preview.mjs',
    'src/dashboard/dock/interaction/PreviewProducer.mjs',
    'src/dashboard/dock/interaction/DragAffordances.mjs',
    'src/dashboard/dock/interaction/DropIndicators.mjs',
    'src/dashboard/dock/interaction/TabSortZone.mjs',
    'src/dashboard/dock/interaction/TabEnterButton.mjs',
    'src/dashboard/dock/interaction/KeyboardCommands.mjs',
    'src/dashboard/dock/persistence/PerspectiveLibrary.mjs',
    'src/dashboard/dock/persistence/RestorePlanner.mjs',
    'src/dashboard/dock/window/DragTarget.mjs',
    'src/dashboard/dock/window/Participation.mjs',
    'src/dashboard/dock/window/WorkspaceSet.mjs',
    'src/dashboard/dock/window/TearOut.mjs',
    'src/dashboard/dock/window/VesselConversion.mjs',
    'src/dashboard/dock/window/VesselEmbodiment.mjs',
    'src/dashboard/dock/window/VesselPark.mjs'
]);

const NON_BINDING_13 = Object.freeze([
    'src/dashboard/Container.mjs',
    'src/dashboard/Panel.mjs',
    'src/dashboard/SortZone.mjs',
    'src/component/Splitter.mjs',
    'src/dashboard/DockZoneModel.mjs',
    'src/dashboard/DockWorkspace.mjs',
    'src/dashboard/DockLayoutAdapter.mjs',
    'src/dashboard/DockReconciler.mjs',
    'src/dashboard/DockSplitter.mjs',
    'src/dashboard/DockRail.mjs',
    'src/dashboard/DockRevealOverlay.mjs',
    'src/ai/client/DockService.mjs',
    'src/main/addon/DockFlip.mjs'
]);

assert.equal(DOCK_TARGET_30.length, 30);
assert.equal(NON_BINDING_13.length, 13);

const DISCUSSION_BODY = [
    '# Greenfield DockLayouts Architecture',
    '',
    '## Current-State Census and Rejected Shapes (Unmarked Prose)',
    'The flat package currently mixes `src/dashboard/DockZoneModel.mjs`, `src/dashboard/DockWorkspace.mjs`,',
    '`src/dashboard/DockLayoutAdapter.mjs`, `src/dashboard/DockReconciler.mjs`, `src/dashboard/DockSplitter.mjs`,',
    '`src/dashboard/DockRail.mjs`, and `src/dashboard/DockRevealOverlay.mjs` alongside generic roots',
    '`src/dashboard/Container.mjs`, `src/dashboard/Panel.mjs`, and `src/dashboard/SortZone.mjs`.',
    'DockSplitter subclasses `src/component/Splitter.mjs`; execution satellites stay at',
    '`src/ai/client/DockService.mjs` and `src/main/addon/DockFlip.mjs`.',
    '',
    '## Selected Target Package Inventory',
    '<!-- binding-inventory: dock-target-tree -->',
    ...DOCK_TARGET_30.map(item => `- \`${item}\` — graduated module`),
    '<!-- /binding-inventory -->'
].join('\n');

// 1. Extraction ignores unmarked current/superseded/generic .mjs mentions and selects only the 30 binding modules.
{
    const extracted = extractBindingInventories(DISCUSSION_BODY);
    assert.deepEqual(extracted.errors, []);
    assert.deepEqual(extracted.emptyIds, []);
    assert.equal(extracted.inventories['dock-target-tree'].length, 30);
    assert.deepEqual(extracted.inventories['dock-target-tree'], [...DOCK_TARGET_30].sort());

    for (const nonBinding of NON_BINDING_13) {
        assert.equal(
            extracted.inventories['dock-target-tree'].includes(nonBinding),
            false,
            `non-binding prose mention ${nonBinding} must never be inferred as binding`
        )
    }
}

// 2. Negative fixture A: Epic/leaf uses folder placeholder `src/dashboard/dock/**` inside the inventory block.
{
    const placeholderEpic = [
        '# Epic: Rebuild DockLayouts',
        '<!-- binding-inventory: dock-target-tree -->',
        '- `src/dashboard/dock/**`',
        '<!-- /binding-inventory -->'
    ].join('\n');

    const placeholderLeaf = [
        '# Leaf: Deliver DockLayouts anatomy cut',
        'Reorganizes `src/dashboard/dock/**` into domain subfolders.'
    ].join('\n');

    const result = compareDiscussionFidelity({
        discussion: DISCUSSION_BODY,
        targets   : [placeholderEpic, placeholderLeaf]
    });

    assert.equal(result.ok, false, 'folder placeholder must fail enumerable set comparison');
    assert.equal(result.inventories['dock-target-tree'].equal, false);
    assert.equal(result.inventories['dock-target-tree'].missing.length, 30);
    assert.deepEqual(result.inventories['dock-target-tree'].missing, [...DOCK_TARGET_30].sort());
    assert.deepEqual(result.inventories['dock-target-tree'].extra, ['src/dashboard/dock/**']);

    for (const nonBinding of NON_BINDING_13) {
        assert.equal(result.inventories['dock-target-tree'].missing.includes(nonBinding), false);
        assert.equal(result.inventories['dock-target-tree'].extra.includes(nonBinding), false)
    }
}

// 3. Negative fixture B: Epic/leaf omits the marked inventory block entirely and only mentions folder prose.
{
    const unmarkedEpic = 'Rebuilds `src/dashboard/dock/**` across five subfolders.';
    const result       = compareDiscussionFidelity({
        discussion: DISCUSSION_BODY,
        targets   : [unmarkedEpic]
    });

    assert.equal(result.ok, false, 'omitted target inventory must fail closed');
    assert.equal(result.inventories['dock-target-tree'].presentInTargets, false);
    assert.equal(result.inventories['dock-target-tree'].missing.length, 30)
}

// 4. Corrected fixture: the same 30 identities distributed across Epic and leaf bodies pass exact equality.
{
    const epicBody = [
        '# Epic: Rebuild DockLayouts',
        '```binding-inventory:dock-target-tree',
        ...DOCK_TARGET_30.slice(0, 10),
        '```'
    ].join('\n');

    const leafOneBody = [
        '# Leaf 1: Core model, projection, and interaction',
        '<!-- binding-inventory: dock-target-tree -->',
        ...DOCK_TARGET_30.slice(10, 21).map(item => `- \`${item}\``),
        '<!-- /binding-inventory -->'
    ].join('\n');

    const leafTwoBody = [
        '# Leaf 2: Persistence and window choreography',
        '<!-- binding-inventory: dock-target-tree -->',
        ...DOCK_TARGET_30.slice(21).map(item => `- \`${item}\``),
        '<!-- /binding-inventory -->'
    ].join('\n');

    const result = compareDiscussionFidelity({
        discussion: DISCUSSION_BODY,
        targets   : [epicBody, leafOneBody, leafTwoBody]
    });

    assert.equal(result.ok, true, 'union of Epic and leaf slices with exact 30 modules must pass');
    assert.equal(result.inventories['dock-target-tree'].equal, true);
    assert.equal(result.inventories['dock-target-tree'].sourceCount, 30);
    assert.equal(result.inventories['dock-target-tree'].targetCount, 30);
    assert.deepEqual(result.inventories['dock-target-tree'].missing, []);
    assert.deepEqual(result.inventories['dock-target-tree'].extra, [])
}

// 5. Missing-one positive control: 29 of 30 target modules fails and names the missing module.
{
    const missingOneTarget = [
        '<!-- binding-inventory: dock-target-tree -->',
        ...DOCK_TARGET_30.filter(item => item !== 'src/dashboard/dock/persistence/RestorePlanner.mjs').map(item => `- \`${item}\``),
        '<!-- /binding-inventory -->'
    ].join('\n');

    const result = compareDiscussionFidelity({
        discussion: DISCUSSION_BODY,
        targets   : [missingOneTarget]
    });

    assert.equal(result.ok, false, '29 of 30 modules must fail');
    assert.deepEqual(result.inventories['dock-target-tree'].missing, [
        'src/dashboard/dock/persistence/RestorePlanner.mjs'
    ]);
    assert.deepEqual(result.inventories['dock-target-tree'].extra, [])
}

// 6. Extra-one positive control: 30 target modules + 1 extra module fails and names the extra module.
{
    const extraOneTarget = [
        '<!-- binding-inventory: dock-target-tree -->',
        ...DOCK_TARGET_30.map(item => `- \`${item}\``),
        '- `src/dashboard/dock/persistence/LegacyMigrationReader.mjs`',
        '<!-- /binding-inventory -->'
    ].join('\n');

    const result = compareDiscussionFidelity({
        discussion: DISCUSSION_BODY,
        targets   : [extraOneTarget]
    });

    assert.equal(result.ok, false, '30 + 1 extra module must fail');
    assert.deepEqual(result.inventories['dock-target-tree'].missing, []);
    assert.deepEqual(result.inventories['dock-target-tree'].extra, [
        'src/dashboard/dock/persistence/LegacyMigrationReader.mjs'
    ])
}

// 7. ASCII tree inside a marked binding-inventory block expands deterministically to the same 30 paths.
{
    const asciiTreeTarget = [
        '<!-- binding-inventory: dock-target-tree -->',
        '```text',
        'src/dashboard/dock/',
        '├── Workspace.mjs',
        '├── model/',
        '│   ├── Document.mjs',
        '│   ├── Operations.mjs',
        '│   ├── Persistence.mjs',
        '│   ├── PreviewContract.mjs',
        '│   ├── TopologyDiff.mjs',
        '│   └── TopologyReconciler.mjs',
        '├── projection/',
        '│   ├── LayoutAdapter.mjs',
        '│   ├── Reconciler.mjs',
        '│   └── MotionSignal.mjs',
        '├── interaction/',
        '│   ├── DockSplitter.mjs',
        '│   ├── Rail.mjs',
        '│   ├── RevealOverlay.mjs',
        '│   ├── RevealStateMachine.mjs',
        '│   ├── Preview.mjs',
        '│   ├── PreviewProducer.mjs',
        '│   ├── DragAffordances.mjs',
        '│   ├── DropIndicators.mjs',
        '│   ├── TabSortZone.mjs',
        '│   ├── TabEnterButton.mjs',
        '│   └── KeyboardCommands.mjs',
        '├── persistence/',
        '│   ├── PerspectiveLibrary.mjs',
        '│   └── RestorePlanner.mjs',
        '└── window/',
        '    ├── DragTarget.mjs',
        '    ├── Participation.mjs',
        '    ├── WorkspaceSet.mjs',
        '    ├── TearOut.mjs',
        '    ├── VesselConversion.mjs',
        '    ├── VesselEmbodiment.mjs',
        '    └── VesselPark.mjs',
        '```',
        '<!-- /binding-inventory -->'
    ].join('\n');

    const result = compareDiscussionFidelity({
        discussion: DISCUSSION_BODY,
        targets   : [asciiTreeTarget]
    });

    assert.equal(result.ok, true, 'ASCII package tree inside binding-inventory block must match the 30 paths');
    assert.equal(result.inventories['dock-target-tree'].targetCount, 30)
}

// 8. Judged-only fallback, unclosed tag error, unexpected target inventory id, and CLI/packed bin checks.
{
    const judgedOnly = compareDiscussionFidelity({
        discussion: '# Prose-only Discussion\nNo enumerable inventories marked.',
        targets   : ['# Prose Epic']
    });
    assert.equal(judgedOnly.ok, true);
    assert.equal(judgedOnly.mode, 'judged-only');

    const requiredFail = compareDiscussionFidelity({
        discussion      : '# Prose-only Discussion',
        targets         : ['# Prose Epic'],
        requireInventory: true
    });
    assert.equal(requiredFail.ok, false);

    const unclosed = compareDiscussionFidelity({
        discussion: '<!-- binding-inventory: broken -->\n- `a.mjs`',
        targets   : ['<!-- binding-inventory: broken -->\n- `a.mjs`\n<!-- /binding-inventory -->']
    });
    assert.equal(unclosed.ok, false);
    assert.match(unclosed.errors[0], /unclosed binding-inventory/);

    const unexpectedTargetId = compareDiscussionFidelity({
        discussion: DISCUSSION_BODY,
        targets   : [
            `<!-- binding-inventory: dock-target-tree -->\n${DOCK_TARGET_30.map(i => `- \`${i}\``).join('\n')}\n<!-- /binding-inventory -->`,
            '<!-- binding-inventory: invented-id -->\n- `foo.mjs`\n<!-- /binding-inventory -->'
        ]
    });
    assert.equal(unexpectedTargetId.ok, false);
    assert.deepEqual(unexpectedTargetId.unexpectedTargetInventoryIds, ['invented-id'])
}

// 9. CLI invocation and package.json wiring.
const tempDir = mkdtempSync(join(tmpdir(), 'skills-discussion-fidelity-'));

try {
    const
        discFile = join(tempDir, 'discussion.md'),
        epicFile = join(tempDir, 'epic.md'),
        leafFile = join(tempDir, 'leaf.md'),
        badFile  = join(tempDir, 'bad.md');

    writeFileSync(discFile, DISCUSSION_BODY);
    writeFileSync(epicFile, `<!-- binding-inventory: dock-target-tree -->\n${DOCK_TARGET_30.slice(0, 15).map(i => `- \`${i}\``).join('\n')}\n<!-- /binding-inventory -->\n`);
    writeFileSync(leafFile, `<!-- binding-inventory: dock-target-tree -->\n${DOCK_TARGET_30.slice(15).map(i => `- \`${i}\``).join('\n')}\n<!-- /binding-inventory -->\n`);
    writeFileSync(badFile, '<!-- binding-inventory: dock-target-tree -->\n- `src/dashboard/dock/**`\n<!-- /binding-inventory -->\n');

    const passLogs = [];
    assert.equal(run(['--discussion', discFile, '--epic', epicFile, '--leaf', leafFile], {
        out  : msg => passLogs.push(msg),
        error: () => {}
    }), 0);
    assert.match(passLogs.join('\n'), /dock-target-tree \(30\/30\)/);

    const failLogs = [];
    assert.equal(run(['--discussion', discFile, '--target', badFile], {
        out  : () => {},
        error: msg => failLogs.push(msg)
    }), 1);
    assert.match(failLogs.join('\n'), /missing \(30\)/);

    assert.equal(run(['--unknown'], {out: () => {}, error: () => {}}), 2);
    assert.equal(run(['--help'], {out: () => {}, error: () => {}}), 0);

    const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'));
    assert.equal(pkg.bin['neo-agent-skills-discussion-fidelity'], './scripts/check-discussion-fidelity.mjs');
    assert.equal(pkg.files.includes('scripts/check-discussion-fidelity.mjs'), true);

    const
        root     = join(here, '..'),
        packDir  = join(tempDir, 'pack'),
        cacheDir = join(tempDir, 'npm-cache'),
        consumer = join(tempDir, 'consumer');

    mkdirSync(packDir, {recursive: true});
    mkdirSync(consumer, {recursive: true});

    const
        npmEnv  = {...process.env, npm_config_cache: cacheDir},
        packed  = JSON.parse(execFileSync('npm', ['pack', '--pack-destination', packDir, '--json'], {
            cwd: root, encoding: 'utf8', env: npmEnv
        })),
        tarball = join(packDir, packed[0].filename);

    writeFileSync(join(consumer, 'package.json'), JSON.stringify({name: 'fidelity-consumer', private: true}, null, 2));
    execFileSync('npm', [
        'install', '--ignore-scripts', '--package-lock=false', '--no-save', tarball
    ], {cwd: consumer, encoding: 'utf8', env: npmEnv});

    const
        bin   = join(consumer, 'node_modules', '.bin', 'neo-agent-skills-discussion-fidelity'),
        green = spawnSync(bin, ['--discussion', discFile, '--epic', epicFile, '--leaf', leafFile], {
            cwd: consumer, encoding: 'utf8'
        }),
        red   = spawnSync(bin, ['--discussion', discFile, '--target', badFile], {
            cwd: consumer, encoding: 'utf8'
        });

    assert.equal(green.status, 0, green.stderr);
    assert.equal(red.status, 1)
} finally {
    rmSync(tempDir, {recursive: true, force: true})
}

console.log('discussion-fidelity: 30-module D#17818 negative/positive fixtures, controls, and packed CLI passed');
