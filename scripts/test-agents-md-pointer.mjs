#!/usr/bin/env node
/** @summary Contract checks for the AGENTS.md pointer, its git filter and the `--pointer` stage, on real git. */

import assert                                                               from 'node:assert/strict';
import {execFileSync, spawnSync}                                            from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir}                                                             from 'node:os';
import {dirname, join}                                                      from 'node:path';
import {fileURLToPath}                                                      from 'node:url';
import {POINTER_MARKER, cleanCommand, ensureFilter, pointerFor, refresh}    from './agents-md-pointer.mjs';
import {run}                                                                from './generate-agents-md.mjs';

const
    here     = dirname(fileURLToPath(import.meta.url)),
    roots    = [],
    git      = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8'}),
    tryGit   = (cwd, ...args) => spawnSync('git', args, {cwd, encoding: 'utf8'}).status,
    quiet    = {error: () => {}, out: () => {}},
    rules    = '# Generated rules\n' + 'a rule\n'.repeat(20000),
    // neomjs/neo's committed AGENTS.md, byte for byte: its adoption must change no committed file
    enginePointer = '<!-- neo-agents-md: pointer -->\n' +
        'IMPORTANT: this file is generated. `npm install` writes the agent rules here and materializes the agent skills into `.agents/skills/`.\n' +
        'Contributing from a fork without installing? `npx -p neo-agent-skills neo-agent-skills-agents-md --repo neo --audience contributor` prints the rules you follow.\n';

// A git hook exports GIT_DIR and GIT_INDEX_FILE, which would send these checkouts' commits into the repository the
// hook runs in, and a host's global config can sign commits or carry its own filter. Every git this file starts, the
// module's included, inherits this process's environment, so the environment is isolated once, here.
const isolated = mkdtempSync(join(tmpdir(), 'agents-md-pointer-env-'));

roots.push(isolated);
Object.keys(process.env).filter(key => key.startsWith('GIT_')).forEach(key => delete process.env[key]);
Object.assign(process.env, {GIT_CONFIG_GLOBAL: join(isolated, 'global.gitconfig'), GIT_CONFIG_NOSYSTEM: '1'});
writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');

const dirSymlink = process.platform === 'win32' ? 'junction' : 'dir';

/**
 * @summary A consumer checkout holding the committed pointer, the `.gitattributes` line and this package under
 * `node_modules`, where the clean command finds it. No filter is registered yet.
 * @returns {String}
 */
function checkout() {
    const root = mkdtempSync(join(tmpdir(), 'agents-md-pointer-'));

    roots.push(root);
    mkdirSync(join(root, 'node_modules'));
    symlinkSync(dirname(here), join(root, 'node_modules', 'neo-agent-skills'), dirSymlink);
    writeFileSync(join(root, '.gitattributes'), '/AGENTS.md filter=neo-agents-md\n');
    writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
    writeFileSync(join(root, 'AGENTS.md'), pointerFor('neo'));

    git(root, 'init', '--quiet', '-b', 'dev');
    git(root, 'add', '.');
    git(root, '-c', 'user.name=spec', '-c', 'user.email=spec@example.com', 'commit', '--quiet', '-m', 'pointer');

    return root
}

const indexHoldsPointer = root => git(root, 'show', ':AGENTS.md') === pointerFor('neo');

// ── The pointer and the clean command ───────────────────────────────────────────────────────────────
{
    assert.equal(pointerFor('neo'), enginePointer, 'the pointer for neo is the Engine\'s committed file');
    assert.equal(Buffer.byteLength(pointerFor('neo')), 328);
    assert.ok(pointerFor('devindex').startsWith(POINTER_MARKER + '\n'), 'every pointer opens with the marker');
    assert.throws(() => pointerFor('a b'), /--repo must name one repository/, 'a word git\'s shell would split is refused');
    assert.throws(() => cleanCommand('x;rm'), /--repo must name one repository/);

    // Larger than a pipe buffer, so a filter that did not drain stdin would break git's write
    const filtered = spawnSync('node', [join(here, 'agents-md-pointer.mjs'), '--repo', 'neo'], {encoding: 'utf8', input: rules});

    assert.equal(filtered.status, 0);
    assert.equal(filtered.stdout, pointerFor('neo'), 'the CLI answers any working copy with the pointer')
}

// ── The stage: one call registers, writes and refreshes ─────────────────────────────────────────────
{
    const root = checkout();

    assert.equal(run(['--repo', 'neo', '--out', join(root, 'AGENTS.md'), '--pointer'], quiet), 0);
    assert.ok(!readFileSync(join(root, 'AGENTS.md'), 'utf8').startsWith(POINTER_MARKER), 'the working copy holds the rules');
    assert.equal(git(root, 'status', '--porcelain'), '', 'git status stays clean');
    assert.ok(indexHoldsPointer(root), 'and the index keeps the pointer');
    assert.equal(git(root, 'config', '--local', '--get', 'filter.neo-agents-md.smudge'), 'cat\n');
    assert.equal(git(root, 'config', '--local', '--get', 'filter.neo-agents-md.required'), 'true\n');

    git(root, 'add', 'AGENTS.md');
    assert.equal(git(root, 'diff', '--cached'), '', 'an add stores nothing new');

    assert.equal(run(['--repo', 'neo', '--pointer'], quiet), 1, '--pointer without --out is refused')
}

// ── Without a filter, the refresh stages nothing ────────────────────────────────────────────────────
{
    const root = checkout();

    writeFileSync(join(root, 'AGENTS.md'), rules);
    refresh({root});

    assert.ok(indexHoldsPointer(root), 'the index keeps the pointer before any git add');
    assert.equal(git(root, 'status', '--porcelain'), ' M AGENTS.md\n', 'and git shows the change')
}

// ── A filter that cannot be registered stops the stage before the file is touched ───────────────────
{
    const root = checkout();

    // A concurrent writer holds the config lock, so `git config` cannot write
    writeFileSync(join(root, '.git/config.lock'), '');

    assert.throws(() => ensureFilter({root, repo: 'neo'}), /cannot register filter\.neo-agents-md\.clean, filter\.neo-agents-md\.smudge, and filter\.neo-agents-md\.required/);
    assert.equal(run(['--repo', 'neo', '--out', join(root, 'AGENTS.md'), '--pointer'], quiet), 1);
    assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), pointerFor('neo'), 'the file is left as it was');
    assert.ok(indexHoldsPointer(root))
}

// ── A registered filter that cannot run refuses to store the file ───────────────────────────────────
{
    const root = checkout();

    ensureFilter({root, repo: 'neo'});
    // The command fails as it would with no node on git's PATH
    git(root, 'config', '--local', 'filter.neo-agents-md.clean', 'false');
    writeFileSync(join(root, 'AGENTS.md'), rules);

    assert.throws(() => refresh({root}), /git could not run the neo-agents-md filter/);
    assert.notEqual(tryGit(root, 'add', 'AGENTS.md'), 0, 'a required filter refuses, never passes raw content through');
    assert.ok(indexHoldsPointer(root))
}

// ── A checkout writes the pointer: a new worktree is clean, and without the smudge it dies ──────────
{
    const root  = checkout(),
          trees = mkdtempSync(join(tmpdir(), 'agents-md-worktree-'));

    roots.push(trees);
    assert.equal(ensureFilter({root, repo: 'neo'}), 'registered');
    assert.equal(ensureFilter({root, repo: 'neo'}), 'present', 'a second run finds it');

    git(root, 'worktree', 'add', '--quiet', '--detach', join(trees, 'with-smudge'), 'HEAD');

    assert.equal(readFileSync(join(trees, 'with-smudge', 'AGENTS.md'), 'utf8'), pointerFor('neo'));

    // A worktree gets no node_modules; give it the package, so its status can run the clean command
    mkdirSync(join(trees, 'with-smudge', 'node_modules'));
    symlinkSync(dirname(here), join(trees, 'with-smudge', 'node_modules', 'neo-agent-skills'), dirSymlink);

    assert.equal(git(join(trees, 'with-smudge'), 'status', '--porcelain'), '', 'the new worktree is clean');

    // The control: required, with no smudge, fails every write of the file into a working tree
    git(root, 'config', '--local', '--unset', 'filter.neo-agents-md.smudge');

    assert.notEqual(tryGit(root, 'worktree', 'add', '--detach', join(trees, 'without-smudge'), 'HEAD'), 0);
    assert.ok(!existsSync(join(trees, 'without-smudge', 'AGENTS.md')))
}

// ── Without the module, a worktree falls back to the index's pointer ───────────────────────────────
{
    const root  = checkout(),
          trees = mkdtempSync(join(tmpdir(), 'agents-md-worktree-'));

    roots.push(trees);
    ensureFilter({root, repo: 'neo'});

    const tree = join(trees, 'without-module');
    git(root, 'worktree', 'add', '--quiet', '--detach', tree, 'HEAD');
    writeFileSync(join(tree, 'AGENTS.md'), rules);

    assert.equal(tryGit(tree, 'status'), 0, 'git status exits 0 when the module is absent');
    assert.equal(tryGit(tree, 'add', 'AGENTS.md'), 0, 'git add exits 0 when the module is absent');
    assert.equal(git(tree, 'cat-file', 'blob', ':AGENTS.md'), pointerFor('neo'), 'the stored blob stays the pointer');
    assert.equal(git(tree, 'diff', '--cached'), '', 'nothing is staged')
}

roots.forEach(root => rmSync(root, {force: true, recursive: true}));
console.log('✅ agents-md-pointer contract checks pass.');
