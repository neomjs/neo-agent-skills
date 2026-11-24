#!/usr/bin/env node
/**
 * @summary Materializes and verifies the `plugins/neo` Claude Code Plugin Bundle from `skills.manifest.json`.
 */

import {cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, relative, resolve}                                                                         from 'node:path';
import process                                                                                                    from 'node:process';
import {parseArgs}                                                                                                from 'node:util';
import {fileURLToPath}                                                                                            from 'node:url';

export const PLUGIN_REL     = 'plugins/neo';
export const PLUGIN_VERSION = '1.0.0';
export const ICON_REL       = 'assets/icon.png';

const
    PNG_MAGIC   = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    MAX_ICON_B  = 2 * 1024 * 1024,
    here        = dirname(fileURLToPath(import.meta.url)),
    defaultRoot = resolve(here, '..');

/**
 * @summary Canonical `.claude-plugin/plugin.json` manifest payload.
 * @returns {Object}
 */
export function expectedPluginManifest() {
    return {
        name            : 'neomjs',
        displayName     : 'Neo.mjs',
        version         : PLUGIN_VERSION,
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
        '## Bundled Skills (`app` audience)',
        '',
        rows,
        '',
        '## Connect the Live Neural Link MCP Bridge',
        '',
        'Register the published `neo-neural-link` stdio server (`Node.js >= 24.0.0`) in your workspace:',
        '',
        '```bash',
        'claude mcp add neo-neural-link -- npx -y neo-neural-link',
        '```',
        '',
        '## Local Plugin Validation & Development',
        '',
        '```bash',
        'claude plugin validate ./plugins/neo',
        'claude --plugin-dir ./plugins/neo',
        '```',
        ''
    ].join('\n')
}

const jsonText = value => `${JSON.stringify(value, null, 2)}\n`;
const toPosix  = value => value.replace(/\\/g, '/');

function readSkillManifest(root) {
    return JSON.parse(readFileSync(join(root, '.agents/skills/skills.manifest.json'), 'utf8'))
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
 * @summary Materializes `plugins/neo` under `root` from `.agents/skills/skills.manifest.json` using real files.
 * @param {{root?: String}} [options={}]
 * @returns {{pluginDir: String, skills: String[]}}
 */
export function generatePlugin({root = defaultRoot} = {}) {
    const
        manifest  = readSkillManifest(root),
        skills    = appSkillsFrom(manifest),
        pluginDir = join(root, PLUGIN_REL),
        metaDir   = join(pluginDir, '.claude-plugin'),
        skillsDir = join(pluginDir, 'skills');

    mkdirSync(metaDir, {recursive: true});
    rmSync(skillsDir, {recursive: true, force: true});
    rmSync(join(pluginDir, '.mcp.json'), {force: true});
    mkdirSync(skillsDir, {recursive: true});

    writeFileSync(join(metaDir, 'plugin.json'), jsonText(expectedPluginManifest()), 'utf8');
    writeFileSync(join(pluginDir, 'README.md'), expectedReadme(manifest), 'utf8');

    for (const name of skills) {
        cpSync(join(root, '.agents/skills', name), join(skillsDir, name), {recursive: true})
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
 * @summary Returns every contract, directory-policy, or parity violation in `plugins/neo` under `root`.
 * @param {{root?: String}} [options={}]
 * @returns {String[]}
 */
export function checkPlugin({root = defaultRoot} = {}) {
    const
        manifest  = readSkillManifest(root),
        expected  = appSkillsFrom(manifest),
        pluginDir = join(root, PLUGIN_REL),
        metaDir   = join(pluginDir, '.claude-plugin'),
        skillsDir = join(pluginDir, 'skills'),
        iconPath  = join(pluginDir, ICON_REL),
        findings  = [];

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

    findings.push(
        ...checkExactFile(join(metaDir, 'plugin.json'), `${PLUGIN_REL}/.claude-plugin/plugin.json`, jsonText(expectedPluginManifest())),
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
                srcBuf = readFileSync(join(srcDir, rel)),
                dstBuf = readFileSync(join(dstDir, rel));

            if (!srcBuf.equals(dstBuf)) {
                findings.push(`${PLUGIN_REL}/skills/${name}/${rel}: drifted from .agents/skills/${name}/${rel}`)
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
