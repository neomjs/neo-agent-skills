#!/usr/bin/env node
/**
 * @summary Materializes and verifies the `plugins/neo` Claude Code Plugin Bundle from `skills.manifest.json`.
 *
 * Projects every `audiences: ["app"]` skill into `plugins/neo/skills/<name>/` as real files (`ARCHIVE_SYMLINK_EXEC_SURFACE`
 * forbids Git symlinks in Anthropic Directory archives) while rewriting repo-relative `.agents/skills/` references so
 * installed plugins resolve their own payloads inside `~/.claude/plugins/cache/`:
 * - `.agents/skills/<own-skill>/...`        -> `${CLAUDE_SKILL_DIR}/...`
 * - `.agents/skills/<other-app-skill>/...`  -> `${CLAUDE_PLUGIN_ROOT}/skills/<other-app-skill>/...`
 * - `.agents/skills/<maintainer-skill>/...` -> `https://github.com/neomjs/neo-agent-skills/blob/dev/.agents/skills/<maintainer-skill>/...`
 *
 * `.claude-plugin/plugin.json` mirrors root `package.json`'s `version` (enforced to bump on every maintainer release by
 * `scripts/check-version-bump.mjs` and auto-synced via the `npm version` lifecycle script) so Claude Code invalidates
 * `~/.claude/plugins/cache/` on every release (`code.claude.com/docs/en/plugins/loading#how-claude-code-computes-the-version`)
 * while satisfying semver validation cleanly.
 */

import {cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, extname, join, relative, resolve}                                                                from 'node:path';
import process                                                                                                    from 'node:process';
import {parseArgs}                                                                                                from 'node:util';
import {fileURLToPath}                                                                                            from 'node:url';

export const PLUGIN_REL   = 'plugins/neo';
export const ICON_REL     = 'assets/icon.png';
export const BLOB_ROOT    = 'https://github.com/neomjs/neo-agent-skills/blob/dev/.agents/skills';

const
    PNG_MAGIC         = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    MAX_ICON_B        = 2 * 1024 * 1024,
    TEXT_EXTENSIONS   = new Set(['.json', '.js', '.md', '.mjs', '.txt', '.yaml', '.yml']),
    REPO_SKILL_REF_RE = /(?<!\/)\.agents\/skills\/([a-z0-9-]+)\/([^\s)`"']*)/g,
    UNREWROTE_REF_RE  = /(?<!\/)\.agents\/skills\//,
    here              = dirname(fileURLToPath(import.meta.url)),
    defaultRoot       = resolve(here, '..');

/**
 * @summary Canonical `.claude-plugin/plugin.json` manifest payload synced to root `package.json` `version`.
 * @param {String} version
 * @returns {Object}
 */
export function expectedPluginManifest(version) {
    return {
        name            : 'neomjs',
        displayName     : 'Neo.mjs',
        version,
        description     : 'Neo.mjs multi-threaded application authoring skills and Neural Link live runtime inspection workflow.',
        icon            : ICON_REL,
        author          : {
            name: 'Neo.mjs',
            url : 'https://neomjs.com'
        },
        homepage        : 'https://neomjs.com',
        repository      : 'https://github.com/neomjs/neo-agent-skills',
        documentationUrl: 'https://neomjs.com/learn',
        supportUrl      : 'https://github.com/neomjs/neo/issues',
        license         : 'MIT',
        keywords        : [
            'neomjs',
            'web-workers',
            'sharedworker',
            'multi-window',
            'ui-engine',
            'neural-link',
            'mcp'
        ]
    }
}

/**
 * @summary Sorted names of skills declaring the `app` audience in `skills.manifest.json`.
 * @param {Object} manifest
 * @returns {String[]}
 */
export function appSkillsFrom(manifest) {
    return Object.entries(manifest?.skills || {})
        .filter(([, row]) => (row.audiences ?? ['maintainer']).includes('app'))
        .map(([name]) => name)
        .sort()
}

/**
 * @summary Rewrites repo-relative `.agents/skills/` references for standalone plugin installations.
 * @param {String} text
 * @param {String} skillName
 * @param {Set<String>} appSkillSet
 * @returns {String}
 */
export function rewriteSkillText(text, skillName, appSkillSet) {
    return text.replace(REPO_SKILL_REF_RE, (_match, targetSkill, rest) => {
        if (targetSkill === skillName) {
            return `\${CLAUDE_SKILL_DIR}/${rest}`
        }
        if (appSkillSet.has(targetSkill)) {
            return `\${CLAUDE_PLUGIN_ROOT}/skills/${targetSkill}/${rest}`
        }
        return `${BLOB_ROOT}/${targetSkill}/${rest}`
    })
}

function projectSkillFile(srcPath, skillName, appSkillSet) {
    const raw = readFileSync(srcPath);

    if (!TEXT_EXTENSIONS.has(extname(srcPath).toLowerCase())) {
        return raw
    }

    return Buffer.from(rewriteSkillText(raw.toString('utf8'), skillName, appSkillSet), 'utf8')
}

/**
 * @summary Canonical `plugins/neo/README.md` text derived from admitted `app` skills.
 * @param {Object} manifest
 * @returns {String}
 */
export function expectedReadme(manifest) {
    const rows = appSkillsFrom(manifest)
        .map(name => `- **\`${name}\`** — ${manifest.skills[name].description}`)
        .join('\n');

    return [
        '# Neo.mjs — Official Claude Plugin',
        '',
        'Author and live-inspect multi-threaded **Neo.mjs** applications across Web Workers, SharedWorkers, and native browser windows.',
        '',
        'Neo.mjs keeps UI components, data stores, and state providers alive as persistent object graphs off the main thread. Pair these bundled skills with the published `neo-neural-link` MCP bridge so Claude can inspect the live component tree, query stores and state providers, simulate events, measure DOM geometry, and hot-patch running code without reloads.',
        '',
        '## Install',
        '',
        '- **Claude Directory (Claude Code, Cowork, Claude apps):** install **Neo.mjs** (`neomjs`) from `https://claude.ai/directory`.',
        '- **From a local clone (`neomjs/neo-agent-skills`):** run `claude --plugin-dir ./plugins/neo`.',
        '',
        '## Connect the Live Neural Link MCP Bridge',
        '',
        'The bundled `neural-link` skill drives the `neo-neural-link` MCP tools. Because unverified directory plugins do not auto-start local `stdio` servers, register the published `neo-neural-link` server (`Node.js >= 24.0.0`) once in your workspace:',
        '',
        '```bash',
        'claude mcp add neo-neural-link -- npx -y neo-neural-link',
        '```',
        '',
        '## Bundled Skills (`app` audience)',
        '',
        rows,
        '',
        '## Local Plugin Validation',
        '',
        '```bash',
        'claude plugin validate ./plugins/neo',
        'npm run generate-claude-plugin -- --check',
        '```',
        ''
    ].join('\n')
}

const jsonText = value => `${JSON.stringify(value, null, 2)}\n`;
const toPosix  = value => value.replace(/\\/g, '/');

function readSkillManifest(root) {
    return JSON.parse(readFileSync(join(root, '.agents/skills/skills.manifest.json'), 'utf8'))
}

function readPackageVersion(root) {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
}

/**
 * @summary Recursively lists relative POSIX paths and flags any symbolic links under `dir`.
 * @param {String} dir
 * @param {String} [base=dir]
 * @returns {{files: String[], symlinks: String[]}}
 */
function scanTree(dir, base = dir) {
    const out = {files: [], symlinks: []};
    if (!existsSync(dir)) return out;

    for (const name of readdirSync(dir).sort()) {
        const
            full = join(dir, name),
            rel  = toPosix(relative(base, full)),
            stat = lstatSync(full);

        if (stat.isSymbolicLink()) {
            out.symlinks.push(rel);
            continue
        }

        if (stat.isDirectory()) {
            const sub = scanTree(full, base);
            out.files.push(...sub.files);
            out.symlinks.push(...sub.symlinks);
            continue
        }

        if (stat.isFile()) {
            out.files.push(rel)
        }
    }

    return out
}

/**
 * @summary Materializes `plugins/neo` under `root` from `.agents/skills/skills.manifest.json` using path-rewritten real files.
 * @param {{root?: String}} [options={}]
 * @returns {{pluginDir: String, skills: String[]}}
 */
export function generatePlugin({root = defaultRoot} = {}) {
    const
        manifest    = readSkillManifest(root),
        pkgVersion  = readPackageVersion(root),
        skills      = appSkillsFrom(manifest),
        appSkillSet = new Set(skills),
        pluginDir   = join(root, PLUGIN_REL),
        metaDir     = join(pluginDir, '.claude-plugin'),
        skillsDir   = join(pluginDir, 'skills');

    mkdirSync(metaDir, {recursive: true});
    rmSync(skillsDir, {recursive: true, force: true});
    rmSync(join(pluginDir, '.mcp.json'), {force: true});
    mkdirSync(skillsDir, {recursive: true});

    writeFileSync(join(metaDir, 'plugin.json'), jsonText(expectedPluginManifest(pkgVersion)), 'utf8');
    writeFileSync(join(pluginDir, 'README.md'), expectedReadme(manifest), 'utf8');

    for (const name of skills) {
        const
            srcDir = join(root, '.agents/skills', name),
            dstDir = join(skillsDir, name);

        for (const rel of scanTree(srcDir).files) {
            const dstFile = join(dstDir, rel);
            mkdirSync(dirname(dstFile), {recursive: true});
            writeFileSync(dstFile, projectSkillFile(join(srcDir, rel), name, appSkillSet))
        }
    }

    return {pluginDir, skills}
}

function checkExactFile(filePath, label, expected) {
    let stat;

    try {
        stat = lstatSync(filePath)
    } catch {
        return [`${label}: missing`]
    }

    if (!stat.isFile() || stat.isSymbolicLink()) {
        return [`${label}: expected a regular file`]
    }

    const actual = readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

    return actual === expected ? [] : [`${label}: content out of sync with generator`]
}

/**
 * @summary Returns every contract, directory-policy, path-rewrite, or parity violation in `plugins/neo` under `root`.
 * @param {{root?: String}} [options={}]
 * @returns {String[]}
 */
export function checkPlugin({root = defaultRoot} = {}) {
    const
        manifest    = readSkillManifest(root),
        pkgVersion  = readPackageVersion(root),
        expected    = appSkillsFrom(manifest),
        appSkillSet = new Set(expected),
        pluginDir   = join(root, PLUGIN_REL),
        metaDir     = join(pluginDir, '.claude-plugin'),
        skillsDir   = join(pluginDir, 'skills'),
        iconPath    = join(pluginDir, ICON_REL),
        findings    = [];

    if (!existsSync(pluginDir)) {
        return [`${PLUGIN_REL}: directory missing`]
    }

    const wholeScan = scanTree(pluginDir);
    for (const sym of wholeScan.symlinks) {
        findings.push(`${PLUGIN_REL}/${sym}: symbolic links are forbidden by ARCHIVE_SYMLINK_EXEC_SURFACE`)
    }

    if (existsSync(join(pluginDir, '.mcp.json'))) {
        findings.push(`${PLUGIN_REL}/.mcp.json: local stdio MCP servers are refused for unverified organizations; document \`claude mcp add\` in README.md instead`)
    }

    const manifestJsonPath = join(metaDir, 'plugin.json');
    if (existsSync(manifestJsonPath) && !lstatSync(manifestJsonPath).isSymbolicLink()) {
        try {
            const parsedManifest = JSON.parse(readFileSync(manifestJsonPath, 'utf8'));
            if (parsedManifest.version !== pkgVersion) {
                findings.push(`${PLUGIN_REL}/.claude-plugin/plugin.json: version '${parsedManifest.version}' out of sync with package.json '${pkgVersion}'`)
            }
        } catch {
            // Covered by checkExactFile below.
        }
    }

    findings.push(
        ...checkExactFile(manifestJsonPath, `${PLUGIN_REL}/.claude-plugin/plugin.json`, jsonText(expectedPluginManifest(pkgVersion))),
        ...checkExactFile(join(pluginDir, 'README.md'), `${PLUGIN_REL}/README.md`, expectedReadme(manifest))
    );

    if (existsSync(metaDir)) {
        const extraMeta = readdirSync(metaDir).filter(name => name !== 'plugin.json').sort();
        if (extraMeta.length) {
            findings.push(`${PLUGIN_REL}/.claude-plugin: must contain only plugin.json (found: ${extraMeta.join(', ')})`)
        }
    }

    try {
        const stat = lstatSync(iconPath);
        if (!stat.isFile() || stat.isSymbolicLink()) {
            findings.push(`${PLUGIN_REL}/${ICON_REL}: expected a regular PNG file`)
        } else {
            const bytes = readFileSync(iconPath);
            if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_MAGIC)) {
                findings.push(`${PLUGIN_REL}/${ICON_REL}: invalid PNG header`)
            } else if (bytes.length >= MAX_ICON_B) {
                findings.push(`${PLUGIN_REL}/${ICON_REL}: exceeds 2 MB cap (${bytes.length} bytes)`)
            } else {
                const
                    width  = bytes.readUInt32BE(16),
                    height = bytes.readUInt32BE(20);

                if (width !== height || width < 512 || width > 2048) {
                    findings.push(`${PLUGIN_REL}/${ICON_REL}: icon must be square 512..2048 px (got ${width}x${height})`)
                }
            }
        }
    } catch {
        findings.push(`${PLUGIN_REL}/${ICON_REL}: missing square PNG icon`)
    }

    for (const rel of wholeScan.files) {
        if (!TEXT_EXTENSIONS.has(extname(rel).toLowerCase())) {
            continue
        }
        const text = readFileSync(join(pluginDir, rel), 'utf8');
        if (UNREWROTE_REF_RE.test(text)) {
            findings.push(`${PLUGIN_REL}/${rel}: contains unrewritten repo-relative .agents/skills/ path`)
        }
    }

    if (!existsSync(skillsDir)) {
        findings.push(`${PLUGIN_REL}/skills: directory missing`);
        return findings
    }

    const
        present     = readdirSync(skillsDir).sort(),
        expectedSet = new Set(expected),
        presentSet  = new Set(present);

    for (const missing of expected.filter(name => !presentSet.has(name))) {
        findings.push(`${PLUGIN_REL}/skills/${missing}: missing app-audience skill directory`)
    }

    for (const unexpected of present.filter(name => !expectedSet.has(name))) {
        findings.push(`${PLUGIN_REL}/skills/${unexpected}: unexpected entry (only app-audience skills may be bundled)`)
    }

    for (const name of expected.filter(entry => presentSet.has(entry))) {
        const
            srcDir  = join(root, '.agents/skills', name),
            dstDir  = join(skillsDir, name),
            dstStat = lstatSync(dstDir);

        if (dstStat.isSymbolicLink() || !dstStat.isDirectory()) {
            continue
        }

        const
            srcFiles = scanTree(srcDir).files,
            dstFiles = scanTree(dstDir).files,
            srcSet   = new Set(srcFiles),
            dstSet   = new Set(dstFiles);

        for (const rel of srcFiles.filter(f => !dstSet.has(f))) {
            findings.push(`${PLUGIN_REL}/skills/${name}/${rel}: missing file from source skill`)
        }
        for (const rel of dstFiles.filter(f => !srcSet.has(f))) {
            findings.push(`${PLUGIN_REL}/skills/${name}/${rel}: extra file absent from source skill`)
        }
        for (const rel of srcFiles.filter(f => dstSet.has(f))) {
            const
                expectedBuf = projectSkillFile(join(srcDir, rel), name, appSkillSet),
                dstBuf      = readFileSync(join(dstDir, rel));

            if (!expectedBuf.equals(dstBuf)) {
                findings.push(`${PLUGIN_REL}/skills/${name}/${rel}: drifted from projected .agents/skills/${name}/${rel}`)
            }
        }
    }

    return findings
}

/**
 * @summary CLI entrypoint supporting generation (default) and `--check` verification.
 * @param {String[]} [argv=process.argv.slice(2)]
 * @param {{out?: Function, error?: Function}} [io={}]
 * @returns {Number}
 */
export function run(argv = process.argv.slice(2), {out = console.log, error = console.error} = {}) {
    let parsed;

    try {
        parsed = parseArgs({
            args            : argv,
            allowPositionals: false,
            strict          : true,
            options         : {
                check: {type: 'boolean', default: false},
                root : {type: 'string'}
            }
        })
    } catch (cause) {
        error(`generate-claude-plugin: ${cause.message}`);
        return 2
    }

    const root = parsed.values.root ? resolve(parsed.values.root) : defaultRoot;

    try {
        if (parsed.values.check) {
            const findings = checkPlugin({root});

            if (findings.length) {
                findings.forEach(line => error(`❌ ${line}`));
                return 1
            }

            out(`claude-plugin: ${PLUGIN_REL} coherent with skills.manifest.json.`);
            return 0
        }

        const {skills} = generatePlugin({root});
        out(`claude-plugin: materialized ${PLUGIN_REL} (${skills.length} app skills: ${skills.join(', ')}).`);
        return 0
    } catch (cause) {
        error(`generate-claude-plugin: ${cause.message}`);
        return 1
    }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    process.exitCode = run()
}
