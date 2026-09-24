#!/usr/bin/env node
/**
 * @summary Tags the commit npm just published as `v<version>` and pushes the tag.
 *
 * Runs as `postpublish`, so the npm release and the tag a consumer's `uses:` names cannot diverge:
 * a tag exists only for a version on the registry, and it marks the commit that was packed. A dirty
 * tree or an existing tag stops it before anything is written.
 *
 * Run: `node scripts/tag-release.mjs [--no-push]`
 */

import {execFileSync}  from 'node:child_process';
import {readFileSync}  from 'node:fs';
import {join, resolve} from 'node:path';

const
    root    = resolve(process.argv.find(arg => arg.startsWith('--root='))?.slice(7) || join(import.meta.dirname, '..')),
    version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
    tag     = `v${version}`,
    push    = !process.argv.includes('--no-push'),
    git     = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();

/** @summary Stops with the reason, before any tag is written. */
function fail(reason) {
    console.error(`tag-release: ${reason}.`);
    process.exit(1)
}

if (git('status', '--porcelain')) fail(`the tree is dirty, so ${tag} would not mark what was packed`);
if (git('tag', '--list', tag))    fail(`${tag} already exists`);

git('tag', '-a', tag, '-m', `neo-agent-skills ${version}`);
if (push) git('push', 'origin', tag);

console.log(`tag-release: ${tag} at ${git('rev-parse', '--short', 'HEAD')}${push ? ', pushed' : ''}`);
