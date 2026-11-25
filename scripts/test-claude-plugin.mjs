#!/usr/bin/env node
/**
 * @summary Registry, parity, path-rewrite, cache-version, and directory-policy contract tests for
 * `scripts/generate-claude-plugin.mjs`, every `plugins/<slug>/` bundle, and `.claude-plugin/marketplace.json`.
 */

import assert                                                                                        from 'node:assert/strict';
import {cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir}                                                                                      from 'node:os';
import {dirname, extname, join, resolve}                                                             from 'node:path';
import {fileURLToPath}                                                                               from 'node:url';
import {
    ICON_REL,
    ICON_SOURCE_REL,
    MARKETPLACE_REL,
    MAX_DESCRIPTION,
    PLUGIN_BUNDLES,
    UNBUNDLED_PREFIX,
    audienceSkillsFrom,
    bundleSkills,
    checkPlugin,
    expectedPluginManifest,
    generatePlugin,
    rewriteSkillText,
    run
} from './generate-claude-plugin.mjs';

const
    PLUGIN_REL    = 'plugins/neo',
    here          = dirname(fileURLToPath(import.meta.url)),
    packageRoot   = resolve(here, '..'),
    committedIcon = join(packageRoot, ICON_SOURCE_REL),
    neoBundle     = PLUGIN_BUNDLES.find(bundle => bundle.slug === 'neo'),
    silent        = {out: () => {}, error: () => {}},
    TEXT_EXTS     = new Set(['.json', '.js', '.md', '.mjs', '.txt', '.yaml', '.yml']),
    tempRoots     = [];

function walkTextFiles(dir) {
    const out = [];
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walkTextFiles(full))
        } else if (entry.isFile() && TEXT_EXTS.has(extname(entry.name).toLowerCase())) {
            out.push(full)
        }
    }
    return out
}

/**
 * @summary Creates a throwaway repository fixture with two `app` skills, one `maintainer` skill, and a valid icon.
 * @returns {String}
 */
function createFixture() {
    const
        root      = realpathSync(mkdtempSync(join(tmpdir(), 'claude-plugin-'))),
        skills    = join(root, '.agents/skills'),
        assetsDir = join(root, PLUGIN_REL, 'assets');

    tempRoots.push(root);
    mkdirSync(skills, {recursive: true});
    mkdirSync(assetsDir, {recursive: true});
    cpSync(committedIcon, join(root, PLUGIN_REL, ICON_REL));
    writeFileSync(join(root, 'package.json'), JSON.stringify({name: 'neo-agent-skills', version: '2.6.0'}, null, 2) + '\n', 'utf8');

    const manifest = {
        schemaVersion: 1,
        skills       : {
            'neo-app-authoring': {
                name       : 'neo-app-authoring',
                description: 'App authoring rules.',
                audiences  : ['app']
            },
            'neural-link': {
                name       : 'neural-link',
                description: 'Live runtime MCP bridge.',
                audiences  : ['maintainer', 'app']
            },
            'session-sunset': {
                name       : 'session-sunset',
                description: 'Maintainer handover protocol.'
            }
        }
    };

    writeFileSync(join(skills, 'skills.manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    for (const name of Object.keys(manifest.skills)) {
        const dir = join(skills, name, 'references');
        mkdirSync(dir, {recursive: true});
        writeFileSync(
            join(skills, name, 'SKILL.md'),
            `---\nname: ${name}\ndescription: "${manifest.skills[name].description}"\n---\nRead \`.agents/skills/${name}/references/guide.md\` and \`.agents/skills/session-sunset/references/guide.md\`.\n`,
            'utf8'
        );
        writeFileSync(join(dir, 'guide.md'), `# ${name}\n`, 'utf8')
    }

    return root
}

try {
    // 1. Committed bundles and marketplace pass `--check`, sync `version` to `package.json`, and leave zero repo-relative `.agents/skills/` paths.
    const rootPkgVersion = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version;
    assert.deepEqual(checkPlugin({root: packageRoot}), [], 'committed plugin bundles and marketplace must have zero drift');
    assert.equal(run(['--check', '--root', packageRoot], silent), 0);
    assert.equal(expectedPluginManifest(neoBundle, rootPkgVersion).version, rootPkgVersion);

    for (const bundle of PLUGIN_BUNDLES) {
        const committedManifest = JSON.parse(readFileSync(join(packageRoot, 'plugins', bundle.slug, '.claude-plugin/plugin.json'), 'utf8'));
        assert.equal(committedManifest.version, rootPkgVersion, `plugins/${bundle.slug} plugin.json version must mirror root package.json version`);
        assert.ok(bundle.description.length <= MAX_DESCRIPTION, `plugins/${bundle.slug} description must fit the directory search cut`)
    }

    const marketplace = JSON.parse(readFileSync(join(packageRoot, MARKETPLACE_REL), 'utf8'));
    assert.equal(marketplace.metadata.version, rootPkgVersion);
    assert.deepEqual(marketplace.plugins.map(entry => entry.source), PLUGIN_BUNDLES.map(bundle => `./plugins/${bundle.slug}`));

    for (const file of walkTextFiles(join(packageRoot, 'plugins'))) {
        const text = readFileSync(file, 'utf8');
        assert.equal(/(?<!\/)\.agents\/skills\//.test(text), false, `${file} must not contain repo-relative .agents/skills/ path`)
    }

    const authoringSkill = readFileSync(join(packageRoot, PLUGIN_REL, 'skills/neo-app-authoring/SKILL.md'), 'utf8');
    assert.ok(authoringSkill.includes('${CLAUDE_SKILL_DIR}/references/app-authoring-guide.md'));

    const
        feedbackRouter   = readFileSync(join(packageRoot, PLUGIN_REL, 'skills/upstream-skill-feedback/SKILL.md'), 'utf8'),
        feedbackWorkflow = readFileSync(join(packageRoot, PLUGIN_REL, 'skills/upstream-skill-feedback/references/upstream-feedback-workflow.md'), 'utf8'),
        feedbackForm     = readFileSync(join(packageRoot, '.github/ISSUE_TEMPLATE/plugin-skill-feedback.yml'), 'utf8');

    assert.ok(feedbackRouter.includes('${CLAUDE_SKILL_DIR}/references/upstream-feedback-workflow.md'));
    assert.equal(/^allowed-tools\s*:/m.test(feedbackRouter), false, 'upstream-skill-feedback must declare zero allowed-tools to keep plugin reach contained');
    assert.ok(
        feedbackWorkflow.includes('Directory Policy §2D') &&
        feedbackWorkflow.includes('template=plugin-skill-feedback.yml&title=') &&
        feedbackWorkflow.includes('only** when the user explicitly asks'),
        'upstream-skill-feedback workflow must default to user-submitted prefilled Issue Form link (§2D) and restrict gh issue create to explicit user delegation'
    );
    for (const id of ['plugin_version', 'skill_name', 'step', 'expected_vs_actual', 'harness_and_model', 'redaction_confirm']) {
        assert.ok(new RegExp(`^\\s*id:\\s*${id}\\b`, 'm').test(feedbackForm), `plugin-skill-feedback.yml must define field id '${id}'`)
    }

    // 2. `rewriteSkillText` maps own skill -> `${CLAUDE_SKILL_DIR}`, bundled sibling -> `${CLAUDE_PLUGIN_ROOT}`, unbundled skill -> a non-fetchable name.
    {
        const rewritten = rewriteSkillText(
            'Own: `.agents/skills/neo-app-authoring/references/a.md`, sibling: `.agents/skills/neural-link/SKILL.md`, maintainer: (`.agents/skills/pr-review/audits/x.md`).',
            'neo-app-authoring',
            new Set(['neo-app-authoring', 'neural-link'])
        );
        assert.equal(
            rewritten,
            `Own: \`\${CLAUDE_SKILL_DIR}/references/a.md\`, sibling: \`\${CLAUDE_PLUGIN_ROOT}/skills/neural-link/SKILL.md\`, maintainer: (\`${UNBUNDLED_PREFIX}pr-review/audits/x.md\`).`
        )
    }

    // 3. Fresh fixture materializes only `app` skills into `plugins/neo` with rewritten paths, writes the marketplace, and passes `--check`.
    {
        const
            root        = createFixture(),
            [{skills}]  = generatePlugin({root});

        assert.deepEqual(skills, ['neo-app-authoring', 'neural-link']);
        assert.deepEqual(JSON.parse(readFileSync(join(root, MARKETPLACE_REL), 'utf8')).plugins.map(entry => entry.name), ['neomjs']);
        assert.equal(lstatSync(join(root, PLUGIN_REL, 'skills/neo-app-authoring')).isSymbolicLink(), false);
        assert.ok(lstatSync(join(root, PLUGIN_REL, 'skills/neo-app-authoring')).isDirectory());

        const copiedSkill = readFileSync(join(root, PLUGIN_REL, 'skills/neo-app-authoring/SKILL.md'), 'utf8');
        assert.ok(copiedSkill.includes('${CLAUDE_SKILL_DIR}/references/guide.md'));
        assert.ok(copiedSkill.includes(`${UNBUNDLED_PREFIX}session-sunset/references/guide.md`));
        assert.equal(/https:\/\//.test(copiedSkill), false, 'an unbundled skill must never project as a fetchable URL');
        assert.equal(/(?<!\/)\.agents\/skills\//.test(copiedSkill), false);
        assert.equal(checkPlugin({root}).length, 0);
        assert.equal(run(['--check', '--root', root], {out: () => {}, error: () => {}}), 0)
    }

    // 4. Editing source `.agents/skills/<name>` without regenerating fails closed (parity guard).
    {
        const root = createFixture();
        generatePlugin({root});
        writeFileSync(join(root, '.agents/skills/neo-app-authoring/references/guide.md'), '# updated\n', 'utf8');

        const findings = checkPlugin({root});
        assert.ok(findings.some(line => line.includes('drifted from projected .agents/skills/neo-app-authoring/references/guide.md')));
        assert.equal(run(['--check', '--root', root], {out: () => {}, error: () => {}}), 1)
    }

    // 5. Unrewritten `.agents/skills/` path or stale `"version"` in `plugin.json` fails closed.
    {
        const root = createFixture();
        generatePlugin({root});
        writeFileSync(
            join(root, PLUGIN_REL, 'skills/neo-app-authoring/SKILL.md'),
            'Read `.agents/skills/neo-app-authoring/references/guide.md`.\n',
            'utf8'
        );
        writeFileSync(
            join(root, 'package.json'),
            JSON.stringify({name: 'neo-agent-skills', version: '2.6.1'}, null, 2) + '\n',
            'utf8'
        );

        const findings = checkPlugin({root});
        assert.ok(findings.some(line => line.includes('contains unrewritten repo-relative .agents/skills/ path')));
        assert.ok(findings.some(line => line.includes("version '2.6.0' out of sync with package.json '2.6.1'")));
        assert.equal(run(['--check', '--root', root], {out: () => {}, error: () => {}}), 1)
    }

    // 6. Symbolic links inside `plugins/neo` fail closed (`ARCHIVE_SYMLINK_EXEC_SURFACE` guard).
    {
        const
            root    = createFixture(),
            symPath = join(root, PLUGIN_REL, 'skills/neo-app-authoring');

        generatePlugin({root});
        rmSync(symPath, {recursive: true, force: true});
        symlinkSync('../../../.agents/skills/neo-app-authoring', symPath);

        const findings = checkPlugin({root});
        assert.ok(findings.some(line => line.includes('ARCHIVE_SYMLINK_EXEC_SURFACE')));
        assert.equal(run(['--check', '--root', root], {out: () => {}, error: () => {}}), 1)
    }

    // 7. Leaking a maintainer-only skill or `.mcp.json` fails closed.
    {
        const root = createFixture();
        generatePlugin({root});
        cpSync(join(root, '.agents/skills/session-sunset'), join(root, PLUGIN_REL, 'skills/session-sunset'), {recursive: true});
        writeFileSync(join(root, PLUGIN_REL, '.mcp.json'), '{}\n', 'utf8');

        const findings = checkPlugin({root});
        assert.ok(findings.some(line => line.includes('session-sunset: unexpected entry')));
        assert.ok(findings.some(line => line.includes('.mcp.json: local stdio MCP servers are refused')));
        assert.equal(run(['--check', '--root', root], {out: () => {}, error: () => {}}), 1)
    }

    // 8. Missing or non-square PNG icon fails closed.
    {
        const root = createFixture();
        generatePlugin({root});
        rmSync(join(root, PLUGIN_REL, ICON_REL), {force: true});

        assert.ok(checkPlugin({root}).some(line => line.includes('missing square PNG icon')))
    }

    // 9. Adding an `app` skill to `skills.manifest.json` without regenerating fails closed.
    {
        const
            root         = createFixture(),
            manifestPath = join(root, '.agents/skills/skills.manifest.json');

        generatePlugin({root});
        mkdirSync(join(root, '.agents/skills/context-recovery'), {recursive: true});
        writeFileSync(join(root, '.agents/skills/context-recovery/SKILL.md'), '---\nname: context-recovery\ndescription: "Recovery."\n---\n', 'utf8');

        const updated = {
            schemaVersion: 1,
            skills       : {
                'context-recovery' : {name: 'context-recovery', description: 'Recovery.', audiences: ['app']},
                'neo-app-authoring': {name: 'neo-app-authoring', description: 'App authoring rules.', audiences: ['app']},
                'neural-link'      : {name: 'neural-link', description: 'Live runtime MCP bridge.', audiences: ['maintainer', 'app']}
            }
        };
        writeFileSync(manifestPath, JSON.stringify(updated, null, 2), 'utf8');

        assert.deepEqual(audienceSkillsFrom(updated, 'app'), ['context-recovery', 'neo-app-authoring', 'neural-link']);
        assert.ok(checkPlugin({root}).some(line => line.includes('context-recovery: missing bundled skill directory')))
    }

    // 10. Unknown CLI flags return exit code 2.
    assert.equal(run(['--unknown-flag'], silent), 2);

    // 11. A second bundle with explicit skills projects its own tree: bundled siblings resolve inside the plugin,
    //     unbundled skills resolve to HTTPS, the icon is copied, and the marketplace lists both bundles.
    {
        const
            root    = createFixture(),
            magnet  = {slug: 'magnet', name: 'magnet', displayName: 'Magnet', description: 'After /compact, rebuild the lane.', keywords: ['compaction'], skills: ['session-sunset', 'neural-link']},
            bundles = [neoBundle, magnet];

        generatePlugin({root, bundles});

        const
            linkSkill   = readFileSync(join(root, 'plugins/magnet/skills/neural-link/SKILL.md'), 'utf8'),
            sunsetSkill = readFileSync(join(root, 'plugins/magnet/skills/session-sunset/SKILL.md'), 'utf8'),
            market      = JSON.parse(readFileSync(join(root, MARKETPLACE_REL), 'utf8'));

        assert.deepEqual(readdirSync(join(root, 'plugins/magnet/skills')).sort(), ['neural-link', 'session-sunset']);
        assert.ok(linkSkill.includes('${CLAUDE_SKILL_DIR}/references/guide.md'));
        assert.ok(linkSkill.includes('${CLAUDE_PLUGIN_ROOT}/skills/session-sunset/references/guide.md'));
        assert.ok(sunsetSkill.includes('${CLAUDE_SKILL_DIR}/references/guide.md'));
        assert.ok(lstatSync(join(root, 'plugins/magnet', ICON_REL)).isFile());
        assert.deepEqual(market.plugins.map(entry => [entry.name, entry.source]), [['neomjs', './plugins/neo'], ['magnet', './plugins/magnet']]);
        assert.deepEqual(checkPlugin({root, bundles}), []);

        // The default registry does not know `plugins/magnet`: an unregistered bundle directory fails closed.
        assert.ok(checkPlugin({root}).some(line => line.includes('plugins/magnet: not registered in PLUGIN_BUNDLES')))
    }

    // 12. A fetchable neo-agent-skills file link inside a bundle fails closed (Directory Policy §2F).
    {
        const root = createFixture();
        generatePlugin({root});
        writeFileSync(
            join(root, PLUGIN_REL, 'skills/neo-app-authoring/references/guide.md'),
            'Follow https://github.com/neomjs/neo-agent-skills/blob/dev/.agents/skills/pr-review/SKILL.md first.\n',
            'utf8'
        );

        assert.ok(checkPlugin({root}).some(line => line.includes('links a fetchable neomjs file')));

        writeFileSync(
            join(root, PLUGIN_REL, 'skills/neo-app-authoring/references/guide.md'),
            'See https://raw.githubusercontent.com/neomjs/neo-agent-brain/dev/learn/agentos/process/evidence-ladder.md.\n',
            'utf8'
        );
        assert.ok(checkPlugin({root}).some(line => line.includes('links a fetchable neomjs file')), 'a cross-repo raw URL fails too')
    }

    // 15. Absolute neomjs blob/raw links project as non-fetchable names; an absolute link to a bundled skill resolves in the plugin.
    {
        const
            text = [
                'Ladder: https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/process/evidence-ladder.md',
                'Guide: [seats](https://github.com/neomjs/neo/blob/dev/learn/agentos/process/SeatEvidenceCapabilities.md#rows)',
                'Raw: https://raw.githubusercontent.com/neomjs/neo/dev/learn/x.md',
                'Sibling: https://github.com/neomjs/neo-agent-skills/blob/dev/.agents/skills/neural-link/SKILL.md'
            ].join('\n'),
            out  = rewriteSkillText(text, 'neo-app-authoring', new Set(['neo-app-authoring', 'neural-link']));

        assert.equal(out, [
            'Ladder: neomjs/neo-agent-brain:learn/agentos/process/evidence-ladder.md',
            'Guide: [seats](neomjs/neo:learn/agentos/process/SeatEvidenceCapabilities.md#rows)',
            'Raw: neomjs/neo:learn/x.md',
            'Sibling: ${CLAUDE_PLUGIN_ROOT}/skills/neural-link/SKILL.md'
        ].join('\n'))
    }

    // 13. A marketplace out of step with the registry or the package version fails closed.
    {
        const root = createFixture();
        generatePlugin({root});
        writeFileSync(join(root, 'package.json'), JSON.stringify({name: 'neo-agent-skills', version: '2.6.1'}, null, 2) + '\n', 'utf8');

        assert.ok(checkPlugin({root}).some(line => line.includes(`${MARKETPLACE_REL}: content out of sync with generator`)))
    }

    // 14. Registry errors fail closed: an unknown skill, both or neither selector, a duplicate name, an over-long description.
    {
        const
            root     = createFixture(),
            manifest = JSON.parse(readFileSync(join(root, '.agents/skills/skills.manifest.json'), 'utf8')),
            base     = {slug: 'x', name: 'x', displayName: 'X', description: 'X.', keywords: []};

        assert.throws(() => bundleSkills({...base, skills: ['no-such-skill']}, manifest), /has no no-such-skill/);
        assert.throws(() => bundleSkills({...base, skills: ['neural-link'], audience: 'app'}, manifest), /exactly one of skills or audience/);
        assert.throws(() => bundleSkills(base, manifest), /exactly one of skills or audience/);

        generatePlugin({root});
        const findings = checkPlugin({root, bundles: [neoBundle, {...neoBundle, slug: 'neo2', description: 'x'.repeat(MAX_DESCRIPTION + 1)}]});
        assert.ok(findings.some(line => line.includes("duplicate name 'neomjs'")));
        assert.ok(findings.some(line => line.includes(`description is ${MAX_DESCRIPTION + 1} characters`)))
    }

    console.log('✅ claude-plugin contract checks pass.')
} finally {
    for (const root of tempRoots) {
        rmSync(root, {recursive: true, force: true})
    }
}
