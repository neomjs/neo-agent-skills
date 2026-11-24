#!/usr/bin/env node
/**
 * @summary Materializes and verifies the `plugins/neo` Claude Code Plugin Bundle from `skills.manifest.json`.
 */

import {existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {dirname, join, posix, relative, resolve}                                                                                      from 'node:path';
import process                                                                                                                        from 'node:process';
import {parseArgs}                                                                                                                    from 'node:util';
import {fileURLToPath}                                                                                                                from 'node:url';

export const PLUGIN_REL     = 'plugins/neo';
export const PLUGIN_VERSION = '1.0.0';

const
    here        = dirname(fileURLToPath(import.meta.url)),
    defaultRoot = resolve(here, '..');

/**
 * @summary Canonical `.claude-plugin/plugin.json` manifest payload.
 * @returns {Object}
 */
export function expectedPluginManifest() {
    return {
        name       : 'neo',
        version    : PLUGIN_VERSION,
        description: 'Neo.mjs multi-threaded application authoring skills and Neural Link live runtime MCP bridge.',
        author     : {
            name: 'Neo.mjs',
            url : 'https://neomjs.com'
        },
        homepage  : 'https://neomjs.com',
        repository: 'https://github.com/neomjs/neo-agent-skills',
        license   : 'MIT'
    }
}

/**
 * @summary Canonical `.mcp.json` configuration launching the published `neo-neural-link` stdio server.
 * @returns {Object}
 */
export function expectedMcpConfig() {
    return {
        mcpServers: {
            'neo-neural-link': {
                command: 'npx',
                args   : ['-y', 'neo-neural-link']
            }
        }
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
        '# Neo.mjs — Claude Code Plugin Bundle',
        '',
        'Install Neo.mjs application-authoring skills and the **Neural Link** live runtime MCP bridge in one unit.',
        '',
        'Neo.mjs keeps UI components, data stores, and state providers alive as persistent object graphs inside Web Workers and SharedWorkers across native browser windows. Through the bundled `neo-neural-link` MCP server (`npx -y neo-neural-link`), Claude Code inspects the live component tree, queries stores and state providers, simulates events, measures DOM geometry, and hot-patches running code without reloads.',
        '',
        '## Bundled Skills (`app` audience)',
        '',
        rows,
        '',
        '## Bundled MCP Server (`.mcp.json`)',
        '',
        '- **`neo-neural-link`** (`npx -y neo-neural-link`, Node.js `>= 24.0.0`) — whitebox runtime bridge for running Neo.mjs apps.',
        '',
        '## Local Validation & Development',
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

/**
 * @summary Reads `.agents/skills/skills.manifest.json` from `root`.
 * @param {String} root
 * @returns {Object}
 */
function readSkillManifest(root) {
    return JSON.parse(readFileSync(join(root, '.agents/skills/skills.manifest.json'), 'utf8'))
}

/**
 * @summary Materializes `plugins/neo` under `root` from `.agents/skills/skills.manifest.json`.
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
    mkdirSync(skillsDir, {recursive: true});

    writeFileSync(join(metaDir, 'plugin.json'), jsonText(expectedPluginManifest()), 'utf8');
    writeFileSync(join(pluginDir, '.mcp.json'), jsonText(expectedMcpConfig()), 'utf8');
    writeFileSync(join(pluginDir, 'README.md'), expectedReadme(manifest), 'utf8');

    for (const name of skills) {
        const target = toPosix(relative(skillsDir, join(root, '.agents/skills', name)));
        symlinkSync(target, join(skillsDir, name))
    }

    return {pluginDir, skills}
}

/**
 * @summary Verifies a regular UTF-8 file equals `expected` without following symlinks.
 * @param {String} filePath
 * @param {String} label
 * @param {String} expected
 * @returns {String[]}
 */
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
 * @summary Returns every contract or parity violation in `plugins/neo` under `root`.
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
        findings  = [];

    if (!existsSync(pluginDir)) {
        return [`${PLUGIN_REL}: directory missing`]
    }

    findings.push(
        ...checkExactFile(join(metaDir, 'plugin.json'), `${PLUGIN_REL}/.claude-plugin/plugin.json`, jsonText(expectedPluginManifest())),
        ...checkExactFile(join(pluginDir, '.mcp.json'), `${PLUGIN_REL}/.mcp.json`, jsonText(expectedMcpConfig())),
        ...checkExactFile(join(pluginDir, 'README.md'), `${PLUGIN_REL}/README.md`, expectedReadme(manifest))
    );

    if (existsSync(metaDir)) {
        const extraMeta = readdirSync(metaDir).filter(name => name !== 'plugin.json').sort();
        if (extraMeta.length) {
            findings.push(`${PLUGIN_REL}/.claude-plugin: must contain only plugin.json (found: ${extraMeta.join(', ')})`)
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
        findings.push(`${PLUGIN_REL}/skills/${missing}: missing app-audience skill link`)
    }

    for (const unexpected of present.filter(name => !expectedSet.has(name))) {
        findings.push(`${PLUGIN_REL}/skills/${unexpected}: unexpected entry (only app-audience skills may be bundled)`)
    }

    for (const name of expected.filter(entry => presentSet.has(entry))) {
        const
            linkPath       = join(skillsDir, name),
            stat           = lstatSync(linkPath),
            expectedTarget = posix.join('../../../.agents/skills', name);

        if (!stat.isSymbolicLink()) {
            findings.push(`${PLUGIN_REL}/skills/${name}: must be a relative symlink to ${expectedTarget}, not a duplicate copy`);
            continue
        }

        const actualTarget = toPosix(readlinkSync(linkPath));

        if (actualTarget !== expectedTarget) {
            findings.push(`${PLUGIN_REL}/skills/${name}: symlink points to "${actualTarget}", expected "${expectedTarget}"`);
            continue
        }

        if (!existsSync(join(linkPath, 'SKILL.md'))) {
            findings.push(`${PLUGIN_REL}/skills/${name}: target SKILL.md does not resolve`)
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
