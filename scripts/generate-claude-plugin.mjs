#!/usr/bin/env node
/**
 * @summary Materializes and verifies the Claude Code plugin bundles under `plugins/<slug>/` and the root
 * `.claude-plugin/marketplace.json` from `PLUGIN_BUNDLES` and `skills.manifest.json`.
 *
 * `PLUGIN_BUNDLES` is harness-neutral: each entry names a slug, the plugin, the description a model reads when it
 * decides to install, and its skills. This file is the Claude projector (`plugin.json`, `marketplace.json`); another
 * harness's catalog is another projector over the same registry.
 *
 * Every bundle's skills are projected as real files (`ARCHIVE_SYMLINK_EXEC_SURFACE` forbids Git symlinks in Anthropic
 * Directory archives), with repo-relative `.agents/skills/` references rewritten so an installed plugin resolves its
 * own payloads inside `~/.claude/plugins/cache/`:
 * - `.agents/skills/<own-skill>/...`       -> `${CLAUDE_SKILL_DIR}/...`
 * - `.agents/skills/<bundled-sibling>/...` -> `${CLAUDE_PLUGIN_ROOT}/skills/<bundled-sibling>/...`
 * - `.agents/skills/<other-skill>/...`     -> `neo-agent-skills:<other-skill>/...`, a name, never a fetchable URL: the
 *   Software Directory Policy §2F forbids directing Claude to pull behavioral instructions from external sources.
 * - `https://github.com/neomjs/<repo>/(blob|raw)/<ref>/<path>` -> `neomjs/<repo>:<path>`, for the same reason.
 *
 * Every `plugin.json` and the marketplace mirror root `package.json`'s `version` (bumped on every maintainer release,
 * enforced by `scripts/check-version-bump.mjs`, synced by the `npm version` lifecycle script) so Claude Code
 * invalidates `~/.claude/plugins/cache/` on every release
 * (`code.claude.com/docs/en/plugins/loading#how-claude-code-computes-the-version`).
 */

import {cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, extname, join, relative, resolve}                                                                from 'node:path';
import process                                                                                                    from 'node:process';
import {parseArgs}                                                                                                from 'node:util';
import {fileURLToPath}                                                                                            from 'node:url';

export const PLUGINS_REL      = 'plugins';
export const ICON_REL         = 'assets/icon.png';
export const ICON_SOURCE_REL  = 'plugins/neo/assets/icon.png';
export const MARKETPLACE_REL  = '.claude-plugin/marketplace.json';
export const MARKETPLACE_NAME = 'neomjs';
export const UNBUNDLED_PREFIX = 'neo-agent-skills:';

/**
 * @summary Longest `description` a deciding model reads whole: directory search results cut it at 500 characters,
 * mid-word (measured on the Anthropic Directory, 2026-11-24).
 */
export const MAX_DESCRIPTION = 500;

/**
 * @summary Harness-neutral registry of plugin bundles, one per `plugins/<slug>/`.
 *
 * `description` is the pitch a model reads when it decides to install: name the task it is in and the capability it
 * lacks, in its words, never ours. A bundle lists its `skills`, or takes every skill of one manifest `audience`.
 * `intro` and `setup` are README lines; `setup` covers what the plugin cannot do itself (an MCP server to register).
 * @type {Object[]}
 */
export const PLUGIN_BUNDLES = [{
    slug            : 'neo',
    name            : 'neomjs',
    displayName     : 'Neo.mjs',
    description     : 'Build data grids, Gantt charts, schedulers, kanban boards and multi-window web desktops with Neo.mjs, which runs components, stores and state in workers, off the main thread. Includes the Neural Link workflow: inspect and patch a running app\'s live component tree, stores and DOM instead of reloading and screenshotting.',
    keywords        : ['data-grid', 'gantt', 'scheduler', 'kanban', 'multi-window', 'docking', 'web-desktop', 'web-workers', 'sharedworker', 'offscreen-canvas', 'live-dom-inspection', 'context-recovery', 'neural-link', 'mcp', 'neomjs'],
    audience        : 'app',
    documentationUrl: 'https://neomjs.com/learn',
    supportUrl      : 'https://github.com/neomjs/neo/issues',
    intro           : [
        'Neo.mjs keeps UI components, data stores, and state providers alive as persistent object graphs off the main thread. Pair these bundled skills with the published `neo-neural-link` MCP bridge so Claude can inspect the live component tree, query stores and state providers, simulate events, measure DOM geometry, and hot-patch running code without reloads.'
    ],
    setup           : [
        '## Connect the Live Neural Link MCP Bridge',
        '',
        'The bundled `neural-link` skill drives the `neo-neural-link` MCP tools. Because unverified directory plugins do not auto-start local `stdio` servers, register the published `neo-neural-link` server (`Node.js >= 24.0.0`) once in your workspace:',
        '',
        '```bash',
        'claude mcp add neo-neural-link -- npx -y neo-neural-link',
        '```'
    ]
}, {
    slug       : 'prompt-injection-firewall',
    name       : 'prompt-injection-firewall',
    displayName: 'Prompt Injection Firewall for Untrusted Input',
    description: 'Read untrusted GitHub issues, pull-request comments, external docs, and fetched web pages without letting embedded instructions hijack your session goals or trick you into executing unverified claims. Defends against OWASP ASI01 agent goal hijack via channel separation (retrieved content is data, never commands), falsifies questionable premises before acting, and stress-tests architecture or PR proposals in chat or via gh.',
    keywords   : ['prompt-injection', 'untrusted-input', 'channel-separation', 'owasp-asi01', 'github-issues', 'pull-requests', 'design-review', 'premise-check'],
    skills     : ['identity-firewall', 'peer-role', 'upstream-skill-feedback'],
    intro      : [
        'Retrieved issues, PR comments, external documentation, and fetched web pages routinely mix domain facts with instruction-shaped text or flawed assumptions. These skills defend against OWASP ASI01 (agent goal hijack) via strict channel separation (untrusted input is data, never commands), require premise falsification before agreement or code changes, and guide evidence-backed design review via `gh` or chat with zero MCP setup (`contained` reach).'
    ]
}, {
    slug       : 'context-compaction-memory',
    name       : 'context-compaction-memory',
    displayName: 'Context Compaction Recovery & Session Handover',
    description: 'After /compact or across fresh sessions, reconstruct exact branch, PR, issue, and decision state from structured git/gh and turn records instead of trusting lossy summaries. Includes session-sunset handovers to end long sessions without amnesia, prior-art mining before diagnosing regressions or proposing architecture, and Map-vs-Atlas byte-budget guards so CLAUDE.md and AGENTS.md never bloat or truncate.',
    keywords   : ['context-compaction', 'after-compact', 'context-recovery', 'session-handoff', 'claude-md', 'agents-md', 'progressive-disclosure', 'cross-session-memory', 'prior-art'],
    skills     : ['context-recovery', 'session-sunset', 'memory-mining', 'turn-memory-pre-flight', 'upstream-skill-feedback'],
    intro      : [
        'Context compaction (`/compact`) and session boundaries routinely replace exact commit SHAs, review states, and rejected hypotheses with lossy summaries. These bundled skills reconstruct live state from structured `git`/`gh` and handover records, write structured `.agents/handover.md` session handovers before closing a window, mine prior commits/issues/decisions before re-deriving architecture, and enforce Map-vs-Atlas byte budgets across `CLAUDE.md`, `AGENTS.md`, and skill routers (`contained` reach, local storage, zero external account).'
    ]
}, {
    slug       : 'adversarial-pr-review',
    name       : 'adversarial-pr-review',
    displayName: 'Adversarial PR Review — Premise & Ticket-AC Gate',
    description: 'Review pull requests patch-blind against the linked GitHub issue\'s acceptance criteria, API/schema contracts, and real-state premise (\'can the handled state exist in practice?\') before reading the diff—catching wrong-premise, partial-AC, and architecture-drift PRs that pass green CI and style linters. Includes pre-commit PR reflection gates, git/gh technical-debt sweeps, and structured review templates via gh or chat.',
    keywords   : ['pr-review', 'code-review', 'pull-request', 'acceptance-criteria', 'premise-check', 'contract-ledger', 'technical-debt', 'github-cli', 'architecture-review'],
    skills     : ['pr-review', 'pull-request', 'tech-debt-radar', 'upstream-skill-feedback'],
    intro      : [
        'Green CI and line-by-line style linters still approve pull requests that solve the wrong problem, handle states that never occur in production, or quietly drop acceptance criteria from the originating issue. These bundled skills build a patch-blind premise snapshot from the linked issue, Contract Ledger, and base source before inspecting the diff, audit real-state reachability and adjacent technical debt via `gh` and `git log`, and format actionable reviews with zero MCP setup (`contained` reach).'
    ]
}];

const
    PNG_MAGIC         = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    MAX_ICON_B        = 2 * 1024 * 1024,
    TEXT_EXTENSIONS   = new Set(['.json', '.js', '.md', '.mjs', '.txt', '.yaml', '.yml']),
    REPO_SKILL_REF_RE = /(?<!\/)\.agents\/skills\/([a-z0-9-]+)\/([^\s)`"']*)/g,
    // Concrete `<skill>` slugs only so prose globs (`.agents/skills/**`) in `turn-memory-pre-flight` pass; leaves `.agents/skills/<file>` unguarded.
    UNREWROTE_REF_RE  = /(?<!\/)\.agents\/skills\/[a-z0-9-]+(?:\/|$)/,
    FETCHABLE_REF_RE  = /https:\/\/(?:github\.com\/neomjs\/[a-z0-9-]+\/(?:blob|raw)\/|raw\.githubusercontent\.com\/neomjs\/)/,
    NEOMJS_URL_RE     = /https:\/\/(?:github\.com\/neomjs\/([a-z0-9-]+)\/(?:blob|raw)\/[^/\s)`"']+\/([^\s)`"']*)|raw\.githubusercontent\.com\/neomjs\/([a-z0-9-]+)\/[^/\s)`"']+\/([^\s)`"']*))/g,
    AUTHOR            = {name: 'Neo.mjs', url: 'https://neomjs.com'},
    REPOSITORY        = 'https://github.com/neomjs/neo-agent-skills',
    here              = dirname(fileURLToPath(import.meta.url)),
    defaultRoot       = resolve(here, '..');

/**
 * @summary Sorted names of skills declaring `audience` in `skills.manifest.json` (a row without `audiences` is maintainer-only).
 * @param {Object} manifest
 * @param {String} audience
 * @returns {String[]}
 */
export function audienceSkillsFrom(manifest, audience) {
    return Object.entries(manifest?.skills || {})
        .filter(([, row]) => (row.audiences ?? ['maintainer']).includes(audience))
        .map(([name]) => name)
        .sort()
}

/**
 * @summary Sorted skill names a bundle projects: its explicit `skills`, else every skill of its `audience`.
 * @param {Object} bundle
 * @param {Object} manifest
 * @returns {String[]}
 * @throws {Error} When the bundle sets both or neither field, or names a skill the manifest lacks.
 */
export function bundleSkills(bundle, manifest) {
    if (Boolean(bundle.skills) === Boolean(bundle.audience)) {
        throw new Error(`plugin bundle '${bundle.slug}': set exactly one of skills or audience`)
    }

    if (bundle.audience) {
        return audienceSkillsFrom(manifest, bundle.audience)
    }

    const unknown = bundle.skills.filter(name => !manifest?.skills?.[name]);

    if (unknown.length) {
        throw new Error(`plugin bundle '${bundle.slug}': skills.manifest.json has no ${unknown.join(', ')}`)
    }

    return [...bundle.skills].sort()
}

/**
 * @summary Canonical `.claude-plugin/plugin.json` payload for one bundle, synced to root `package.json` `version`.
 * @param {Object} bundle
 * @param {String} version
 * @returns {Object}
 */
export function expectedPluginManifest(bundle, version) {
    return {
        name            : bundle.name,
        displayName     : bundle.displayName,
        version,
        description     : bundle.description,
        icon            : ICON_REL,
        author          : AUTHOR,
        homepage        : 'https://neomjs.com',
        repository      : REPOSITORY,
        documentationUrl: bundle.documentationUrl ?? `${REPOSITORY}/tree/dev/${PLUGINS_REL}/${bundle.slug}`,
        supportUrl      : bundle.supportUrl       ?? `${REPOSITORY}/issues`,
        license         : 'MIT',
        keywords        : bundle.keywords
    }
}

/**
 * @summary Canonical root `.claude-plugin/marketplace.json` payload listing every bundle, synced to root `package.json` `version`.
 * @param {Object[]} bundles
 * @param {String} version
 * @returns {Object}
 */
export function expectedMarketplace(bundles, version) {
    return {
        name    : MARKETPLACE_NAME,
        owner   : AUTHOR,
        metadata: {
            description: 'Claude Code plugins projected from the neomjs/neo-agent-skills skill corpus.',
            version
        },
        plugins : bundles.map(bundle => ({
            name       : bundle.name,
            source     : `./${PLUGINS_REL}/${bundle.slug}`,
            description: bundle.description,
            version,
            keywords   : bundle.keywords
        }))
    }
}

/**
 * @summary Rewrites a plugin file so nothing in it is fetchable. Repo-relative `.agents/skills/` references resolve
 * inside the plugin or become `neo-agent-skills:` names. Absolute neomjs `blob`/`raw` URLs become `neomjs/<repo>:<path>`
 * names, except links to a skill in this repository, which take the skill-aware rewrite.
 * @param {String} text
 * @param {String} skillName
 * @param {Set<String>} bundleSkillSet
 * @returns {String}
 */
export function rewriteSkillText(text, skillName, bundleSkillSet) {
    return text.replace(NEOMJS_URL_RE, (_match, blobRepo, blobPath, rawRepo, rawPath) => {
        const
            repo = blobRepo ?? rawRepo,
            path = blobPath ?? rawPath;

        return repo === 'neo-agent-skills' && path.startsWith('.agents/skills/') ? path : `neomjs/${repo}:${path}`
    }).replace(REPO_SKILL_REF_RE, (_match, targetSkill, rest) => {
        if (targetSkill === skillName) {
            return `\${CLAUDE_SKILL_DIR}/${rest}`
        }
        if (bundleSkillSet.has(targetSkill)) {
            return `\${CLAUDE_PLUGIN_ROOT}/skills/${targetSkill}/${rest}`
        }
        return `${UNBUNDLED_PREFIX}${targetSkill}/${rest}`
    })
}

function projectSkillFile(srcPath, skillName, bundleSkillSet) {
    const raw = readFileSync(srcPath);

    if (!TEXT_EXTENSIONS.has(extname(srcPath).toLowerCase())) {
        return raw
    }

    return Buffer.from(rewriteSkillText(raw.toString('utf8'), skillName, bundleSkillSet), 'utf8')
}

/**
 * @summary Canonical `plugins/<slug>/README.md` text for one bundle.
 * @param {Object} bundle
 * @param {Object} manifest
 * @returns {String}
 */
export function expectedReadme(bundle, manifest) {
    const
        rel  = `${PLUGINS_REL}/${bundle.slug}`,
        rows = bundleSkills(bundle, manifest)
            .map(name => `- **\`${name}\`** — ${manifest.skills[name].description}`)
            .join('\n');

    return [
        `# ${bundle.displayName} — Official Claude Plugin`,
        '',
        bundle.description,
        '',
        ...(bundle.intro ?? []).flatMap(paragraph => [paragraph, '']),
        '## Install',
        '',
        `- **Marketplace (Claude Code):** run \`claude plugin marketplace add neomjs/neo-agent-skills\`, then \`claude plugin install ${bundle.name}@${MARKETPLACE_NAME}\`.`,
        `- **Claude Directory (Claude Code, Cowork, Claude apps):** install **${bundle.displayName}** (\`${bundle.name}\`) from \`https://claude.ai/directory\`.`,
        `- **From a local clone (\`neomjs/neo-agent-skills\`):** run \`claude --plugin-dir ./${rel}\`.`,
        '',
        ...(bundle.setup ? [...bundle.setup, ''] : []),
        '## Bundled Skills',
        '',
        rows,
        '',
        '## Local Plugin Validation',
        '',
        '```bash',
        `claude plugin validate ./${rel}`,
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
 * @summary Materializes every bundle under `plugins/<slug>/` and the root marketplace from path-rewritten real files.
 * @param {{root?: String, bundles?: Object[]}} [options={}]
 * @returns {{slug: String, skills: String[]}[]}
 */
export function generatePlugin({root = defaultRoot, bundles = PLUGIN_BUNDLES} = {}) {
    const
        manifest   = readSkillManifest(root),
        version    = readPackageVersion(root),
        iconSource = join(root, ICON_SOURCE_REL),
        projected  = [];

    for (const bundle of bundles) {
        const
            skills    = bundleSkills(bundle, manifest),
            skillSet  = new Set(skills),
            pluginDir = join(root, PLUGINS_REL, bundle.slug),
            metaDir   = join(pluginDir, '.claude-plugin'),
            skillsDir = join(pluginDir, 'skills'),
            iconPath  = join(pluginDir, ICON_REL);

        mkdirSync(metaDir, {recursive: true});
        rmSync(skillsDir, {recursive: true, force: true});
        rmSync(join(pluginDir, '.mcp.json'), {force: true});
        mkdirSync(skillsDir, {recursive: true});

        if (iconPath !== iconSource) {
            mkdirSync(dirname(iconPath), {recursive: true});
            cpSync(iconSource, iconPath)
        }

        writeFileSync(join(metaDir, 'plugin.json'), jsonText(expectedPluginManifest(bundle, version)), 'utf8');
        writeFileSync(join(pluginDir, 'README.md'), expectedReadme(bundle, manifest), 'utf8');

        for (const name of skills) {
            const
                srcDir = join(root, '.agents/skills', name),
                dstDir = join(skillsDir, name);

            for (const rel of scanTree(srcDir).files) {
                const dstFile = join(dstDir, rel);
                mkdirSync(dirname(dstFile), {recursive: true});
                writeFileSync(dstFile, projectSkillFile(join(srcDir, rel), name, skillSet))
            }
        }

        projected.push({slug: bundle.slug, skills})
    }

    mkdirSync(join(root, dirname(MARKETPLACE_REL)), {recursive: true});
    writeFileSync(join(root, MARKETPLACE_REL), jsonText(expectedMarketplace(bundles, version)), 'utf8');

    return projected
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
 * @summary Registry findings: duplicate slugs or names, and descriptions that are empty or longer than the search cut.
 * @param {Object[]} bundles
 * @returns {String[]}
 */
function checkRegistry(bundles) {
    const findings = [];

    for (const key of ['slug', 'name']) {
        const values = bundles.map(bundle => bundle[key]);

        for (const value of new Set(values.filter((value, i) => values.indexOf(value) !== i))) {
            findings.push(`PLUGIN_BUNDLES: duplicate ${key} '${value}'`)
        }
    }

    for (const bundle of bundles) {
        const length = bundle.description?.trim().length ?? 0;

        if (!length) {
            findings.push(`PLUGIN_BUNDLES '${bundle.slug}': description is empty`)
        } else if (length > MAX_DESCRIPTION) {
            findings.push(`PLUGIN_BUNDLES '${bundle.slug}': description is ${length} characters; directory search cuts it at ${MAX_DESCRIPTION}`)
        }
    }

    return findings
}

/**
 * @summary Icon findings: a regular, square 512..2048 px PNG under 2 MB.
 * @param {String} iconPath
 * @param {String} label
 * @returns {String[]}
 */
function checkIcon(iconPath, label) {
    try {
        const stat = lstatSync(iconPath);
        if (!stat.isFile() || stat.isSymbolicLink()) {
            return [`${label}: expected a regular PNG file`]
        }

        const bytes = readFileSync(iconPath);
        if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_MAGIC)) {
            return [`${label}: invalid PNG header`]
        }
        if (bytes.length >= MAX_ICON_B) {
            return [`${label}: exceeds 2 MB cap (${bytes.length} bytes)`]
        }

        const
            width  = bytes.readUInt32BE(16),
            height = bytes.readUInt32BE(20);

        return width !== height || width < 512 || width > 2048
            ? [`${label}: icon must be square 512..2048 px (got ${width}x${height})`]
            : []
    } catch {
        return [`${label}: missing square PNG icon`]
    }
}

/**
 * @summary One bundle's directory-policy, manifest, README, icon, path-rewrite and skill-parity findings.
 * @param {String} root
 * @param {Object} bundle
 * @param {Object} manifest
 * @param {String} version
 * @returns {String[]}
 */
function checkBundle(root, bundle, manifest, version) {
    const
        rel       = `${PLUGINS_REL}/${bundle.slug}`,
        pluginDir = join(root, rel),
        metaDir   = join(pluginDir, '.claude-plugin'),
        skillsDir = join(pluginDir, 'skills'),
        findings  = [];

    if (!existsSync(pluginDir)) {
        return [`${rel}: directory missing`]
    }

    const
        expected  = bundleSkills(bundle, manifest),
        skillSet  = new Set(expected),
        wholeScan = scanTree(pluginDir);

    for (const sym of wholeScan.symlinks) {
        findings.push(`${rel}/${sym}: symbolic links are forbidden by ARCHIVE_SYMLINK_EXEC_SURFACE`)
    }

    if (existsSync(join(pluginDir, '.mcp.json'))) {
        findings.push(`${rel}/.mcp.json: local stdio MCP servers are refused for unverified organizations; document \`claude mcp add\` in README.md instead`)
    }

    const manifestJsonPath = join(metaDir, 'plugin.json');
    if (existsSync(manifestJsonPath) && !lstatSync(manifestJsonPath).isSymbolicLink()) {
        try {
            const parsedManifest = JSON.parse(readFileSync(manifestJsonPath, 'utf8'));
            if (parsedManifest.version !== version) {
                findings.push(`${rel}/.claude-plugin/plugin.json: version '${parsedManifest.version}' out of sync with package.json '${version}'`)
            }
        } catch {
            // Covered by checkExactFile below.
        }
    }

    findings.push(
        ...checkExactFile(manifestJsonPath, `${rel}/.claude-plugin/plugin.json`, jsonText(expectedPluginManifest(bundle, version))),
        ...checkExactFile(join(pluginDir, 'README.md'), `${rel}/README.md`, expectedReadme(bundle, manifest)),
        ...checkIcon(join(pluginDir, ICON_REL), `${rel}/${ICON_REL}`)
    );

    if (existsSync(metaDir)) {
        const extraMeta = readdirSync(metaDir).filter(name => name !== 'plugin.json').sort();
        if (extraMeta.length) {
            findings.push(`${rel}/.claude-plugin: must contain only plugin.json (found: ${extraMeta.join(', ')})`)
        }
    }

    for (const file of wholeScan.files) {
        if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) {
            continue
        }

        const text = readFileSync(join(pluginDir, file), 'utf8');

        if (UNREWROTE_REF_RE.test(text)) {
            findings.push(`${rel}/${file}: contains unrewritten repo-relative .agents/skills/ path`)
        }
        if (FETCHABLE_REF_RE.test(text)) {
            findings.push(`${rel}/${file}: links a fetchable neomjs file; Directory Policy §2F forbids pulling behavioral instructions from external sources`)
        }
    }

    if (!existsSync(skillsDir)) {
        findings.push(`${rel}/skills: directory missing`);
        return findings
    }

    const presentSet = new Set(readdirSync(skillsDir));

    for (const missing of expected.filter(name => !presentSet.has(name))) {
        findings.push(`${rel}/skills/${missing}: missing bundled skill directory`)
    }

    for (const unexpected of [...presentSet].filter(name => !skillSet.has(name)).sort()) {
        findings.push(`${rel}/skills/${unexpected}: unexpected entry (only the bundle's skills may be bundled)`)
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

        for (const file of srcFiles.filter(f => !dstSet.has(f))) {
            findings.push(`${rel}/skills/${name}/${file}: missing file from source skill`)
        }
        for (const file of dstFiles.filter(f => !srcSet.has(f))) {
            findings.push(`${rel}/skills/${name}/${file}: extra file absent from source skill`)
        }
        for (const file of srcFiles.filter(f => dstSet.has(f))) {
            if (!projectSkillFile(join(srcDir, file), name, skillSet).equals(readFileSync(join(dstDir, file)))) {
                findings.push(`${rel}/skills/${name}/${file}: drifted from projected .agents/skills/${name}/${file}`)
            }
        }
    }

    return findings
}

/**
 * @summary Returns every registry, contract, directory-policy, path-rewrite, or parity violation across all bundles and the marketplace.
 * @param {{root?: String, bundles?: Object[]}} [options={}]
 * @returns {String[]}
 */
export function checkPlugin({root = defaultRoot, bundles = PLUGIN_BUNDLES} = {}) {
    const
        manifest = readSkillManifest(root),
        version  = readPackageVersion(root),
        findings = checkRegistry(bundles),
        slugs    = new Set(bundles.map(bundle => bundle.slug)),
        rootDir  = join(root, PLUGINS_REL);

    for (const bundle of bundles) {
        findings.push(...checkBundle(root, bundle, manifest, version))
    }

    if (existsSync(rootDir)) {
        for (const orphan of readdirSync(rootDir).filter(name => !slugs.has(name)).sort()) {
            findings.push(`${PLUGINS_REL}/${orphan}: not registered in PLUGIN_BUNDLES`)
        }
    }

    findings.push(...checkExactFile(join(root, MARKETPLACE_REL), MARKETPLACE_REL, jsonText(expectedMarketplace(bundles, version))));

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

            out(`claude-plugin: ${PLUGIN_BUNDLES.length} bundle(s) and ${MARKETPLACE_REL} coherent with skills.manifest.json.`);
            return 0
        }

        for (const {slug, skills} of generatePlugin({root})) {
            out(`claude-plugin: materialized ${PLUGINS_REL}/${slug} (${skills.length} skills: ${skills.join(', ')}).`)
        }
        out(`claude-plugin: wrote ${MARKETPLACE_REL}.`);
        return 0
    } catch (cause) {
        error(`generate-claude-plugin: ${cause.message}`);
        return 1
    }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
    process.exitCode = run()
}
