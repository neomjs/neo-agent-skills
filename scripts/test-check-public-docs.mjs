#!/usr/bin/env node
/**
 * @summary Contract checks for the public-docs lint over both mount shapes. Every rejection case of the spoke copies it
 * replaces fires on its true positive and stays quiet on the false positive that would make it noisy. A crafted guide
 * cannot stall the job, a forbidden term never reaches the log, and the bin ships.
 */

import assert                                                       from 'node:assert/strict';
import {execFileSync, spawnSync}                                    from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir}                                                     from 'node:os';
import {dirname, join}                                              from 'node:path';
import {fileURLToPath}                                              from 'node:url';
import {
    FORBIDDEN_TERMS_ENV, SCHEMA, checkHeader, forbiddenTermsFrom, lintPublicDocs, proseLines, readArgs, runLint
} from './check-public-docs.mjs';

const
    here     = dirname(fileURLToPath(import.meta.url)),
    GUARD    = join(here, 'check-public-docs.mjs'),
    SPOKE    = 'neomjs/example-spoke',
    fixtures = [];

/**
 * One folder the hub creates: leaf ids are spoke-local, routes carry the mount id.
 * @member {Object} HUB_MOUNTED
 */
const HUB_MOUNTED = {
    manifest: {
        schema   : SCHEMA,
        spoke    : SPOKE,
        treeFile : 'learn/tree.json',
        treeMount: {parentId: 'Guides', id: 'guides/example', name: 'Example App'},
        entries  : [
            {file: 'learn/data/Intro.md',  route: '/learn/guides/example/data/Intro'},
            {file: 'learn/data/Engine.md', route: '/learn/guides/example/data/Engine'}
        ]
    },
    tree: [
        {name: 'The Data Factory', parentId: null, isLeaf: false, id: 'DataFactory'},
        {name: 'Introduction',     parentId: 'DataFactory',       id: 'data/Intro'},
        {name: 'Spider Engine',    parentId: 'DataFactory',       id: 'data/Engine'}
    ],
    files: {
        'learn/data/Intro.md' : '# Intro\n',
        'learn/data/Engine.md': '# Spider Engine\n\nSee [Intro](./Intro.md) and `apps/example/view/home/MainContainer.mjs`.\n'
    }
};

/**
 * Folders the spoke's own tree holds: leaf ids are site paths, internal records stay excluded, and source links resolve
 * to tracked files under `ai/`.
 * @member {Object} SELF_MOUNTED
 */
const SELF_MOUNTED = {
    manifest: {
        schema         : SCHEMA,
        spoke          : SPOKE,
        treeFile       : 'learn/tree.json',
        treeMounts     : [{parentId: 'AgentInterfaces', id: 'AgentOS', name: 'Agent OS'}],
        excludedDirs   : ['learn/agentos/decisions/'],
        sourceLinkRoots: ['ai/'],
        entries        : [
            {file: 'learn/agentos/A2A.md',        route: '/learn/agentos/A2A'},
            {file: 'learn/agentos/MemoryCore.md', route: '/learn/agentos/MemoryCore'}
        ]
    },
    tree: [
        {name: 'Brain Interface', parentId: null,              isLeaf: false, id: 'AgentInterfaces'},
        {name: 'Agent OS',        parentId: 'AgentInterfaces', isLeaf: false, id: 'AgentOS'},
        {name: 'A2A Messaging',   parentId: 'AgentOS',                        id: 'agentos/A2A'},
        {name: 'Memory Core',     parentId: 'AgentOS',                        id: 'agentos/MemoryCore'}
    ],
    files: {
        '.gitignore'                            : 'ai/server/config.mjs\n',
        'ai/services.mjs'                       : 'export default {};\n',
        'ai/server/config.mjs'                  : 'export default {};\n',
        'deploy/compose.yml'                    : 'services: {}\n',
        'learn/agentos/A2A.md'                  : '# A2A\n',
        'learn/agentos/Unlisted.md'             : '# Unlisted\n',
        'learn/agentos/decisions/0019-record.md': '# ADR\n',
        'learn/agentos/MemoryCore.md'           : '# Memory Core\n\nSee [A2A](./A2A.md) and [`ai/services.mjs`](../../ai/services.mjs) by `@neo-opus-grace`.\n'
    }
};

/**
 * @summary A disposable spoke checkout built from a shape, after `edit` changes a copy of it. The checkout is a git
 * repository with every file added, so source links have a tracked set to resolve against.
 * @param {Object} shape {@link HUB_MOUNTED} or {@link SELF_MOUNTED}
 * @param {Function} [edit] receives the copy
 * @returns {String} the root
 */
function spoke(shape, edit = () => {}) {
    const root  = mkdtempSync(join(tmpdir(), 'check-public-docs-')),
          spec  = structuredClone(shape),
          write = (file, content) => {
              mkdirSync(dirname(join(root, file)), {recursive: true});
              writeFileSync(join(root, file), content)
          };

    fixtures.push(root);
    edit(spec);

    write('docs/public-manifest.json', JSON.stringify(spec.manifest, null, 4));
    write('learn/tree.json', JSON.stringify({data: spec.tree}, null, 4));

    for (const [file, content] of Object.entries(spec.files)) write(file, content);

    execFileSync('git', ['init', '-q'], {cwd: root});
    execFileSync('git', ['add', '-A'], {cwd: root});

    return root
}

/**
 * @param {Object} shape
 * @param {Function} [edit]
 * @param {Object} [options] passed to {@link lintPublicDocs}
 * @returns {String} every finding, one per line
 */
const findings = (shape, edit, options = {}) => lintPublicDocs({root: spoke(shape, edit), spoke: SPOKE, ...options}).errors.join('\n');

/**
 * @param {String} file
 * @param {String} body
 * @returns {Function} an edit replacing one guide's text
 */
const guide = (file, body) => spec => { spec.files[file] = body };

const engine = body => guide('learn/data/Engine.md', body),
      memory = body => guide('learn/agentos/MemoryCore.md', body);

// ── Both mount shapes are clean as built ────────────────────────────────────────────────────────
{
    const hub = lintPublicDocs({root: spoke(HUB_MOUNTED), spoke: SPOKE}),
          own = lintPublicDocs({root: spoke(SELF_MOUNTED), spoke: SPOKE});

    assert.deepEqual(hub, {errors: [], entryCount: 2, routes: ['/learn/guides/example/data/Intro', '/learn/guides/example/data/Engine']},
        'treeMount routes carry the mount id');
    assert.deepEqual(own, {errors: [], entryCount: 2, routes: ['/learn/agentos/A2A', '/learn/agentos/MemoryCore']},
        'treeMounts routes are the leaf ids')
}

// ── The header ─────────────────────────────────────────────────────────────────────────────────
{
    const header = edit => checkHeader((spec => (edit(spec), spec.manifest))(structuredClone(HUB_MOUNTED)), SPOKE).join('\n');

    assert.equal(header(() => {}), '');
    assert.match(header(spec => { spec.manifest.schema = 'public-manifest.v2' }), /schema must be "public-manifest\.v1"/);
    assert.match(header(spec => { spec.manifest.spoke = 'neomjs/other' }), /spoke must be "neomjs\/example-spoke"/,
        'a manifest copied from another spoke');
    assert.match(header(spec => { spec.manifest.treeFile = '../tree.json' }), /treeFile must be a normalized relative path/);
    assert.match(header(spec => { delete spec.manifest.treeMount }), /exactly one of treeMount and treeMounts/);
    assert.match(header(spec => { spec.manifest.treeMounts = SELF_MOUNTED.manifest.treeMounts }), /exactly one of treeMount and treeMounts/);
    assert.match(header(spec => { spec.manifest.treeMount.id = 'guides/example/' }), /treeMount must declare a normalized string id/);
    assert.match(header(spec => { spec.manifest.treeMount.id = '../example' }), /treeMount must declare a normalized string id/);
    assert.match(header(spec => { delete spec.manifest.treeMount; spec.manifest.treeMounts = [] }), /treeMounts must be a non-empty array/);
    assert.match(header(spec => { spec.manifest.entries = [] }), /entries must be a non-empty array/);
    assert.match(header(spec => { spec.manifest.excludedDirs = ['ai/'] }), /excludedDirs must be an array of normalized directories inside learn\//);
    assert.match(header(spec => { spec.manifest.sourceLinkRoots = ['learn/agentos'] }), /sourceLinkRoots must be an array of normalized directories outside learn\//,
        'a source root inside learn/ would let a link skip the admitted set');

    const empty = mkdtempSync(join(tmpdir(), 'check-public-docs-'));

    fixtures.push(empty);
    assert.deepEqual(lintPublicDocs({root: empty, spoke: SPOKE}).errors, ['missing manifest docs/public-manifest.json'], 'no manifest fails closed');
    assert.match(findings(HUB_MOUNTED, spec => { spec.files['docs/public-manifest.json'] = '{' }), /docs\/public-manifest\.json is not valid JSON/);
    assert.match(findings(HUB_MOUNTED, spec => { spec.files['learn/tree.json'] = '{"nodes": []}' }), /learn\/tree\.json needs a top-level "data" array/)
}

// ── The tree and its parity with the entries ────────────────────────────────────────────────────
{
    assert.match(findings(HUB_MOUNTED, spec => {
        spec.tree.push({name: 'Extra', parentId: 'DataFactory', id: 'data/Extra'});
        spec.files['learn/data/Extra.md'] = '# Extra\n'
    }), /leaf "learn\/data\/Extra\.md" is missing from docs\/public-manifest\.json/);

    assert.match(findings(HUB_MOUNTED, spec => {
        spec.manifest.entries.push({file: 'learn/data/Unlisted.md', route: '/learn/guides/example/data/Unlisted'});
        spec.files['learn/data/Unlisted.md'] = '# Unlisted\n'
    }), /"learn\/data\/Unlisted\.md" is not a leaf in learn\/tree\.json/);

    assert.match(findings(SELF_MOUNTED, spec => { spec.tree[3].parentId = 'Missing' }), /node "agentos\/MemoryCore" names parentId "Missing", which is no folder/);
    assert.match(findings(SELF_MOUNTED, spec => { spec.tree[3].parentId = 'agentos/A2A' }), /names parentId "agentos\/A2A", which is no folder/,
        'a leaf cannot parent');
    assert.match(findings(SELF_MOUNTED, spec => { spec.tree.push({...spec.tree[2]}) }), /duplicate node id "agentos\/A2A"/);
    assert.match(findings(SELF_MOUNTED, spec => { spec.tree.push({parentId: null, id: 'Nameless'}) }), /data\[4\] needs a string id and name/);
    assert.match(findings(SELF_MOUNTED, spec => { spec.manifest.treeMounts[0].parentId = 'Benefits' }), /treeMounts entry "AgentOS" matches no folder node/);
    assert.match(findings(SELF_MOUNTED, spec => { spec.manifest.treeMounts[0].id = 'agentos/A2A' }), /treeMounts entry "agentos\/A2A" matches no folder node/,
        'a mount is a folder, never a leaf')
}

// ── Entries and routes ─────────────────────────────────────────────────────────────────────────
{
    const route = (shape, value) => findings(shape, spec => { spec.manifest.entries[1].route = value });

    assert.match(findings(HUB_MOUNTED, spec => { spec.manifest.treeMount.id = 'guides/other' }), /invalid route "\/learn\/guides\/example\/data\/Intro" \(must start with "\/learn\/guides\/other\/"/,
        'the prefix derives from treeMount.id');
    assert.match(route(HUB_MOUNTED, '/learn/example/data/Engine'), /invalid route/);
    assert.match(route(HUB_MOUNTED, '/learn/guides/example/WrongSlug'), /route "\/learn\/guides\/example\/WrongSlug" does not match the tree's route "\/learn\/guides\/example\/data\/Engine"/);
    assert.match(route(SELF_MOUNTED, '/learn/wrong/MemoryCore'), /does not match the tree's route "\/learn\/agentos\/MemoryCore"/);

    for (const bad of ['/learn/agentos/MemoryCore/', '/learn/agentos/MemoryCore.md', '/learn/agentos/../MemoryCore']) {
        assert.match(route(SELF_MOUNTED, bad), /invalid route/, bad)
    }

    assert.match(route(SELF_MOUNTED, '/learn/agentos/A2A'), /duplicate route "\/learn\/agentos\/A2A"/);
    assert.match(findings(SELF_MOUNTED, spec => { spec.manifest.entries[1].file = 'learn/agentos/A2A.md' }), /duplicate file "learn\/agentos\/A2A\.md"/);
    assert.match(findings(SELF_MOUNTED, spec => { spec.manifest.entries[1].file = 'learn/agentos/../MemoryCore.md' }), /must be a normalized "learn\/<path>\.md"/);
    assert.match(findings(SELF_MOUNTED, spec => { spec.manifest.entries[1].file = 'docs/MemoryCore.md' }), /must be a normalized "learn\/<path>\.md"/);
    assert.match(findings(SELF_MOUNTED, spec => { delete spec.manifest.entries[1].route }), /entries\[1\]: needs a string "file" and "route"/);
    assert.match(findings(SELF_MOUNTED, spec => { delete spec.files['learn/agentos/MemoryCore.md'] }), /missing Markdown file "learn\/agentos\/MemoryCore\.md"/);

    assert.match(findings(SELF_MOUNTED, spec => {
        spec.tree.push({name: 'ADR 0019', parentId: 'AgentOS', id: 'agentos/decisions/0019-record'});
        spec.manifest.entries.push({file: 'learn/agentos/decisions/0019-record.md', route: '/learn/agentos/decisions/0019-record'})
    }), /"learn\/agentos\/decisions\/0019-record\.md" is an excluded internal record and cannot be published/);

    assert.equal(findings(SELF_MOUNTED, spec => {
        delete spec.manifest.excludedDirs;
        spec.tree.push({name: 'ADR 0019', parentId: 'AgentOS', id: 'agentos/decisions/0019-record'});
        spec.manifest.entries.push({file: 'learn/agentos/decisions/0019-record.md', route: '/learn/agentos/decisions/0019-record'})
    }), '', 'without excludedDirs nothing beyond default-deny is refused')
}

// ── Host paths, private repositories and forbidden terms ──────────────────────────────────────────
{
    assert.equal(findings(HUB_MOUNTED, engine([
        '# Spider Engine', '',
        'Clone into `/Users/<you>/workspace/example` or `/home/{user}/example`, then open `apps/example/view/home/Main.mjs`.',
        'Reviewed by `@neo-gemini-julia` and `@neo-opus-grace`. See [Intro](./Intro.md).'
    ].join('\n'))), '', 'placeholders, repo-relative home/ segments and public @neo-* handles pass');

    assert.match(findings(HUB_MOUNTED, engine('# Leak\n\nLoaded from `/Users/alice/.neo-ai/example/learn/Intro.md`.\n')),
        /learn\/data\/Engine\.md:3: forbidden host filesystem path "\/Users\/alice\/\.neo-ai\//);
    assert.match(findings(HUB_MOUNTED, engine('# Leak\n\n```bash\ncd /home/alice/example\n```\n')), /forbidden host filesystem path "\/home\/alice\/example"/,
        'fenced code is still published');
    assert.match(findings(HUB_MOUNTED, engine('# Leak\n\nScreenshot at `file:///Users/alice/x/shot.png`.\n')), /forbidden host filesystem path "\/Users\/alice\/x\/shot\.png"/);
    assert.match(findings(HUB_MOUNTED, engine('# Leak\n\nLoaded from `C:\\Users\\alice\\example\\Intro.md`.\n')), /forbidden Windows host filesystem path/);
    assert.match(findings(HUB_MOUNTED, engine('# Leak\n\nScreenshot at `file:///C:/Users/alice/x/shot.png`.\n')), /forbidden Windows host filesystem path/);

    for (const repo of ['neomjs/business', 'neomjs/neo-stage', 'neomjs/neo-pro']) {
        assert.match(findings(HUB_MOUNTED, engine(`# Leak\n\nSee ${repo} for internal notes.\n`)), /forbidden private-repository reference/, repo)
    }

    assert.equal(findings(HUB_MOUNTED, engine('# Fine\n\nSee neomjs/neo and neomjs/neo-agent-brain.\n')), '', 'public repositories pass');

    const term = findings(HUB_MOUNTED, engine('# Leak\n\nBuilt for SyntheticClient, then synthetic-client and SYNTHETICCLIENT again.\n'),
        {forbiddenTerms: ['other', 'SyntheticClient']});

    assert.equal(term, [
        `learn/data/Engine.md:3: forbidden term 2 of ${FORBIDDEN_TERMS_ENV}`,
        `learn/data/Engine.md:3: forbidden term 2 of ${FORBIDDEN_TERMS_ENV}`
    ].join('\n'), 'case-insensitive, at word boundaries, one finding per hit');
    assert.doesNotMatch(term, /syntheticclient/i, 'the finding names the term by position, never by its text');

    assert.deepEqual(forbiddenTermsFrom({[FORBIDDEN_TERMS_ENV]: ' Alpha Corp, ,Beta ,'}), ['Alpha Corp', 'Beta']);
    assert.deepEqual(forbiddenTermsFrom({}), [], 'unset is none, and the run says so')
}

// ── Relative links ─────────────────────────────────────────────────────────────────────────────
{
    assert.deepEqual(proseLines('a\n```js\nb\n```\nc\n~~~~\n```\nd\n~~~~\ne'), ['a', '', '', '', 'c', '', '', '', '', 'e'],
        'a fence closes on its own character, at least as long, and keeps every line');

    assert.equal(findings(HUB_MOUNTED, engine('# Engine\n\n```markdown\n[Example](./DoesNotExist.md)\n```\nInline `[Code](./DoesNotExist.md)` stays inert.\n')), '',
        'fenced and inline code are not links');
    assert.equal(findings(HUB_MOUNTED, engine('# Engine\n\n[Intro](./Intro) [same](Intro.md#top) [web](https://neomjs.com/x.md) [mail](mailto:a@b.c) [anchor](#top) [site](/learn/x)\n')), '',
        'a target resolves with or without .md; URLs, anchors and site paths are not relative');

    assert.match(findings(HUB_MOUNTED, engine('# Engine\n\nSee [Missing](./DoesNotExist.md#top) for details.\n')),
        /learn\/data\/Engine\.md:3: broken relative Markdown link "\.\/DoesNotExist\.md" \(must resolve to a manifest-admitted guide\)/);
    assert.match(findings(HUB_MOUNTED, spec => {
        spec.files['learn/data/Internal.md']  = '# Internal\n';
        spec.files['learn/data/Engine.md']   = '# Engine\n\nSee [Internal](./Internal.md) notes.\n'
    }), /broken relative Markdown link "\.\/Internal\.md"/, 'on disk is not admitted');
    assert.match(findings(HUB_MOUNTED, engine('# Engine\n\nSee [Sketch](../../apps/example/sketch.html).\n')),
        /broken relative Markdown link "\.\.\/\.\.\/apps\/example\/sketch\.html"/, 'no source roots, no link out of learn/');
    assert.match(findings(HUB_MOUNTED, engine('# Engine\n\nA link [split\nacross](./Gone.md) lines.\n')), /Engine\.md:4: broken relative Markdown link "\.\/Gone\.md"/);

    assert.match(findings(SELF_MOUNTED, memory('# Memory Core\n\nSee [ADR](decisions/0019-record.md) and [Unlisted](./Unlisted.md).\n')),
        /broken relative Markdown link "decisions\/0019-record\.md"[^\n]*\n[^\n]*broken relative Markdown link "\.\/Unlisted\.md"/, 'an excluded record is never a target');
    assert.equal(findings(SELF_MOUNTED, memory('# Memory Core\n\nSee [the services](../../ai/) and [one](../../ai/services.mjs#L1).\n')), '',
        'a tracked directory or file under a source root');
    assert.match(findings(SELF_MOUNTED, memory('# Memory Core\n\nSee [config](../../ai/server/config.mjs).\n')),
        /broken relative Markdown link "\.\.\/\.\.\/ai\/server\/config\.mjs" \(must resolve to a manifest-admitted guide or a tracked path under ai\/\)/,
        'an ignored overlay exists on disk and is still refused');
    assert.match(findings(SELF_MOUNTED, memory('# Memory Core\n\nSee [compose](../../deploy/compose.yml) and [gone](../../ai/gone.mjs).\n')),
        /"\.\.\/\.\.\/deploy\/compose\.yml"[^\n]*\n[^\n]*"\.\.\/\.\.\/ai\/gone\.mjs"/, 'a tracked file outside every root, and a missing one inside');
    assert.match(findings(SELF_MOUNTED, memory('# Memory Core\n\nSee [the outside](../../../elsewhere/ai/x.mjs).\n')), /broken relative Markdown link/,
        'a target outside the repository')
}

// ── The CLI ────────────────────────────────────────────────────────────────────────────────────
{
    const run = (args, options = {}) => spawnSync(process.execPath, [GUARD, ...args], {encoding: 'utf8', ...options}),
          env = {...process.env, [FORBIDDEN_TERMS_ENV]: 'SyntheticClient'};

    const help = run(['--help']);

    assert.equal(help.status, 0, '--help exits 0');
    assert.match(help.stdout, /Usage: neo-agent-skills-public-docs --spoke <owner\/name>/);

    assert.deepEqual(readArgs(['--spoke', SPOKE, '--root', 'r', '--manifest', 'm.json']), {spoke: SPOKE, root: 'r', manifest: 'm.json'});
    assert.throws(() => readArgs([]), /--spoke <owner\/name> is required/);
    assert.throws(() => readArgs(['--spoke', SPOKE, '--bogus']), /Unknown option '--bogus'/);
    assert.throws(() => readArgs(['--spoke', SPOKE, 'extra']), /positional/i);

    const usage = run([]);

    assert.equal(usage.status, 2, 'a refused argument exits 2, not 1');
    assert.match(usage.stderr, /--spoke <owner\/name> is required/);

    const clean = run(['--spoke', SPOKE], {cwd: spoke(HUB_MOUNTED), env});

    assert.equal(clean.status, 0, 'the working directory is the default root');
    assert.match(clean.stdout, /\[public-docs\] neomjs\/example-spoke: 2 guide\(s\), 1 forbidden term\(s\) checked: OK/);

    const leaked = run(['--spoke', SPOKE, '--root', spoke(HUB_MOUNTED, engine('# Leak\n\nBuilt for SyntheticClient.\n'))], {env});

    assert.equal(leaked.status, 1);
    assert.match(leaked.stderr, /✗ learn\/data\/Engine\.md:3: forbidden term 1 of NEO_PUBLIC_DOCS_FORBIDDEN_TERMS/);
    assert.match(leaked.stderr, /2 guide\(s\), 1 forbidden term\(s\) checked: FAILED, 1 finding\(s\)/);
    assert.doesNotMatch(leaked.stdout + leaked.stderr, /SyntheticClient/, 'the log never carries the term');

    const unset = run(['--spoke', SPOKE, '--root', spoke(HUB_MOUNTED)], {env: {...process.env, [FORBIDDEN_TERMS_ENV]: ''}});

    assert.match(unset.stdout, /0 forbidden term\(s\) checked: OK/, 'a run that checked no term says so');

    const renamed = spoke(HUB_MOUNTED, spec => { spec.files['docs/spoke.json'] = JSON.stringify(spec.manifest) });

    assert.equal(lintPublicDocs({root: renamed, spoke: SPOKE, manifestFile: 'docs/spoke.json'}).errors.length, 0, '--manifest names another file');

    const notGit = spoke(SELF_MOUNTED);

    rmSync(join(notGit, '.git'), {recursive: true, force: true});

    const unknown = run(['--spoke', SPOKE, '--root', notGit]);

    assert.equal(unknown.status, 2, 'a source link outside a git checkout cannot be judged, and says so');
    assert.match(unknown.stderr, /\[public-docs\] Command failed: git ls-files/);

    const quiet = (fn => {
        const {log, error} = console;

        console.log = console.error = () => {};

        try {
            return fn()
        } finally {
            Object.assign(console, {log, error})
        }
    });

    assert.equal(quiet(() => runLint({spoke: SPOKE, root: spoke(HUB_MOUNTED), forbiddenTerms: []})).exitCode, 0);
    assert.equal(quiet(() => runLint({spoke: 'neomjs/other', root: spoke(HUB_MOUNTED), forbiddenTerms: []})).exitCode, 1)
}

// ── A crafted guide cannot stall the job that judges it ─────────────────────────────────────────
//
// Guides are pull-request input. Every scan below reads each line once: link targets cannot run into the next `](`,
// and no finding counts its line from the top of the file. A second is a wide margin over the milliseconds it takes.
{
    const fast = (label, body) => {
        const root  = spoke(HUB_MOUNTED, engine(body)),
              start = performance.now();

        lintPublicDocs({root, spoke: SPOKE, forbiddenTerms: ['SyntheticClient']});
        assert.ok(performance.now() - start < 1000, `${label} takes under a second`)
    };

    fast('repeated link openers', '](./'.repeat(50000));
    fast('repeated nested brackets', '['.repeat(100000) + '](');
    fast('many broken links', '[x](./a.md)\n'.repeat(30000));
    fast('many host paths on one line', ' /Users/alice/x'.repeat(30000));
    fast('an unterminated fence', '```\n' + '[x](./a.md)\n'.repeat(30000))
}

// ── It ships, or consumers cannot invoke it ────────────────────────────────────────────────────
{
    const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'));

    assert.equal(pkg.bin['neo-agent-skills-public-docs'], './scripts/check-public-docs.mjs');
    assert.ok(pkg.files.includes('scripts/check-public-docs.mjs'), 'the lint must be in the published file list');
    assert.doesNotMatch(readFileSync(GUARD, 'utf8'), /neomjs\/(?:devindex|neo-agent-brain|neo-agent-institution)/, 'no spoke name lives in the script')
}

fixtures.forEach(dir => rmSync(dir, {recursive: true, force: true}));

console.log('check-public-docs: contract arms green.');
