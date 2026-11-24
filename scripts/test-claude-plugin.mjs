#!/usr/bin/env node
/**
 * @summary Parity, path-rewrite, cache-version, and directory-policy contract tests for `scripts/generate-claude-plugin.mjs` and `plugins/neo`.
 */

import assert                                                                                        from 'node:assert/strict';
import {cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir}                                                                                      from 'node:os';
import {dirname, extname, join, resolve}                                                             from 'node:path';
import {fileURLToPath}                                                                               from 'node:url';
import {
    BLOB_ROOT,
    ICON_REL,
    PLUGIN_REL,
    appSkillsFrom,
    checkPlugin,
    expectedPluginManifest,
    generatePlugin,
    rewriteSkillText,
    run
} from './generate-claude-plugin.mjs';

const
    here          = dirname(fileURLToPath(import.meta.url)),
    packageRoot   = resolve(here, '..'),
    committedIcon = join(packageRoot, PLUGIN_REL, ICON_REL),
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
    // 1. Committed repository bundle passes `--check`, syncs `version` to `package.json`, and leaves zero repo-relative `.agents/skills/` paths.
    const rootPkgVersion = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version;
    assert.deepEqual(checkPlugin({root: packageRoot}), [], 'committed plugins/neo bundle must have zero drift');
    assert.equal(run(['--check', '--root', packageRoot], {out: () => {}, error: () => {}}), 0);
    assert.equal(expectedPluginManifest(rootPkgVersion).version, rootPkgVersion);

    const committedManifest = JSON.parse(readFileSync(join(packageRoot, PLUGIN_REL, '.claude-plugin/plugin.json'), 'utf8'));
    assert.equal(committedManifest.version, rootPkgVersion, 'plugin.json version must mirror root package.json version');

    for (const file of walkTextFiles(join(packageRoot, PLUGIN_REL))) {
        const text = readFileSync(file, 'utf8');
        assert.equal(/(?<!\/)\.agents\/skills\//.test(text), false, `${file} must not contain repo-relative .agents/skills/ path`)
    }

    const authoringSkill = readFileSync(join(packageRoot, PLUGIN_REL, 'skills/neo-app-authoring/SKILL.md'), 'utf8');
    assert.ok(authoringSkill.includes('${CLAUDE_SKILL_DIR}/references/app-authoring-guide.md'));

    // 2. `rewriteSkillText` maps own skill -> `${CLAUDE_SKILL_DIR}`, sibling app skill -> `${CLAUDE_PLUGIN_ROOT}`, maintainer skill -> canonical HTTPS URL.
    {
        const rewritten = rewriteSkillText(
            'Own: `.agents/skills/neo-app-authoring/references/a.md`, sibling: `.agents/skills/neural-link/SKILL.md`, maintainer: (`.agents/skills/pr-review/audits/x.md`).',
            'neo-app-authoring',
            new Set(['neo-app-authoring', 'neural-link'])
        );
        assert.equal(
            rewritten,
            `Own: \`\${CLAUDE_SKILL_DIR}/references/a.md\`, sibling: \`\${CLAUDE_PLUGIN_ROOT}/skills/neural-link/SKILL.md\`, maintainer: (\`${BLOB_ROOT}/pr-review/audits/x.md\`).`
        )
    }

    // 3. Fresh fixture materializes only `app` skills with rewritten paths and passes `--check`.
    {
        const
            root     = createFixture(),
            {skills} = generatePlugin({root});

        assert.deepEqual(skills, ['neo-app-authoring', 'neural-link']);
        assert.equal(lstatSync(join(root, PLUGIN_REL, 'skills/neo-app-authoring')).isSymbolicLink(), false);
        assert.ok(lstatSync(join(root, PLUGIN_REL, 'skills/neo-app-authoring')).isDirectory());

        const copiedSkill = readFileSync(join(root, PLUGIN_REL, 'skills/neo-app-authoring/SKILL.md'), 'utf8');
        assert.ok(copiedSkill.includes('${CLAUDE_SKILL_DIR}/references/guide.md'));
        assert.ok(copiedSkill.includes(`${BLOB_ROOT}/session-sunset/references/guide.md`));
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

    // 5. Unrewritten `.agents/skills/` path or stale `"version"` in `plugin.json` fails closed (RA-1 & RA-2 guards).
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

        assert.deepEqual(appSkillsFrom(updated), ['context-recovery', 'neo-app-authoring', 'neural-link']);
        assert.ok(checkPlugin({root}).some(line => line.includes('context-recovery: missing app-audience skill directory')))
    }

    // 10. Unknown CLI flags return exit code 2.
    assert.equal(run(['--unknown-flag'], {out: () => {}, error: () => {}}), 2);

    console.log('✅ claude-plugin contract checks pass.')
} finally {
    for (const root of tempRoots) {
        rmSync(root, {recursive: true, force: true})
    }
}
