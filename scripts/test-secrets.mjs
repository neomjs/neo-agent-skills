#!/usr/bin/env node
/**
 * @summary Contract checks for the credential guard: each shape it knows is found, nothing that merely looks like one
 * is, an allow marker needs a reason, and a finding never echoes the credential.
 *
 * Every planted credential is built at runtime from its prefix and a filler, so this file carries no credential-shaped
 * literal of its own, and the guard reads it clean without an allow marker.
 */

import assert                                                 from 'node:assert/strict';
import {spawnSync}                                            from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir}                                               from 'node:os';
import {dirname, join}                                        from 'node:path';
import {fileURLToPath}                                        from 'node:url';
import {PATTERNS, findSecrets}                                from './check-secrets.mjs';

const
    here     = dirname(fileURLToPath(import.meta.url)),
    GUARD    = join(here, 'check-secrets.mjs'),
    fixtures = [],
    /**
     * @param {String} alphabet
     * @param {Number} n
     * @returns {String} n characters cycling through the alphabet
     */
    fill     = (alphabet, n) => Array.from({length: n}, (_, i) => alphabet[i % alphabet.length]).join(''),
    ALNUM    = 'aB3dE5gH7jK9mN1pQ2sT4vW6yZ8',
    UPPER    = 'QWERTYUIOPASDFGHJKLZXCVBNM0123456789';

// One planted value per shape, each the length the real credential has
const planted = {
    'google-api-key'     : 'AIza' + fill(ALNUM, 35),
    'google-oauth-token' : 'ya29.' + fill(ALNUM, 40),
    'openai-key'         : 'sk-proj-' + fill(ALNUM, 60),
    'anthropic-key'      : 'sk-ant-api03-' + fill(ALNUM, 90),
    'github-token'       : 'ghp_' + fill(ALNUM, 36),
    'github-fine-grained': 'github_pat_' + fill(ALNUM, 22) + '_' + fill(ALNUM, 59),
    'aws-access-key-id'  : 'AKIA' + fill(UPPER, 16)
};

/**
 * @summary A disposable directory holding one file with the given content.
 * @param {String} name
 * @param {String} content
 * @returns {String} the file's path
 */
function fixture(name, content) {
    const dir = mkdtempSync(join(tmpdir(), 'check-secrets-'));

    fixtures.push(dir);
    writeFileSync(join(dir, name), content);

    return join(dir, name)
}

// ── Every shape it knows is found, on its line ─────────────────────────────────────────────────
{
    assert.deepEqual(Object.keys(planted).sort(), PATTERNS.map(({kind}) => kind).sort(),
        'every pattern has a planted credential here');

    for (const [kind, value] of Object.entries(planted)) {
        assert.deepEqual(findSecrets(`const config = {\n    key: '${value}'\n}`), [{line: 2, kind}], `a planted ${kind}`)
    }

    assert.deepEqual(findSecrets(`OPENAI_API_KEY=sk-${fill(ALNUM, 48)}`), [{line: 1, kind: 'openai-key'}],
        'the legacy OpenAI shape')
}

// ── Prose about a credential is not one ────────────────────────────────────────────────────────
{
    assert.deepEqual(findSecrets([
        'The redaction test feeds it AIza… and expects a mask.',
        "googleMapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY'",
        `github_pat_   : github_pat_11AB${fill(ALNUM, 18)}…`,
        'AIza' + fill(ALNUM, 34),
        'AIza' + fill(ALNUM, 36),
        'ghp_' + fill(ALNUM, 35),
        'AKIA' + fill(UPPER, 15)
    ].join('\n')), [], 'an elision, a placeholder, a short sample and wrong lengths')
}

// ── An allow marker needs a reason, and the reason has to say something ────────────────────────
{
    const key = planted['google-api-key'];

    assert.deepEqual(findSecrets([
        `'${key}' // secret-scan-ok: revoked format sample for the docs`,
        `'${key}'`,
        `'${key}' // secret-scan-ok:`
    ].join('\n')), [
        {line: 2, kind: 'google-api-key'},
        {line: 3, kind: 'allow-marker-without-reason'}
    ], 'a reason excuses its own line only, and no reason is a finding');

    assert.deepEqual(findSecrets([
        `${key} <!-- secret-scan-ok: -->`,
        `/* secret-scan-ok: */ const mapsKey = '${key}'`,
        `{/* secret-scan-ok: */} ${key}`,
        `// secret-scan-ok: ${key}`,
        `${key} <!-- secret-scan-ok: a revoked format sample -->`,
        `/* secret-scan-ok: the placeholder the tutorial replaces */ '${key}'`
    ].join('\n')), [
        {line: 1, kind: 'allow-marker-without-reason'},
        {line: 2, kind: 'allow-marker-without-reason'},
        {line: 3, kind: 'allow-marker-without-reason'},
        {line: 4, kind: 'allow-marker-without-reason'}
    ], "a comment's closer is no reason, and neither is the credential beside the marker");

    assert.deepEqual(findSecrets([
        "export const ALLOW_MARKER = 'secret-scan-ok:';",
        '// secret-scan-ok:'
    ].join('\n')), [], 'a marker on a line without a credential excuses nothing, and is nothing to report')
}

// ── Process-level arms: the report, and the shipping path through the bin symlink ──────────────
{
    const
        key    = planted['github-token'],
        file   = fixture('config.json', `{\n    "token": "${key}"\n}\n`),
        clean  = fixture('clean.json', '{"token": null}\n'),
        link   = join(dirname(file), 'check-secrets-link.mjs'),
        found  = spawnSync(process.execPath, [GUARD, file], {encoding: 'utf8'}),
        output = found.stdout + found.stderr;

    assert.equal(found.status, 1, 'a planted credential exits 1 as a process, not only as a return value');
    assert.ok(output.includes(`${file}:2  github-token`), 'the report names file, line and kind');
    assert.ok(!output.includes(key) && !output.includes(key.slice(4)), 'and never the credential');
    assert.equal(spawnSync(process.execPath, [GUARD, clean], {encoding: 'utf8'}).status, 0);

    symlinkSync(GUARD, link);
    assert.equal(spawnSync(process.execPath, [link, file], {encoding: 'utf8'}).status, 1,
        'invoked through a symlink — the installed `bin` shape — the guard still runs');
    assert.equal(spawnSync(process.execPath, ['--preserve-symlinks-main', link, file], {encoding: 'utf8'}).status, 1,
        'and under --preserve-symlinks-main')
}

// ── It ships, or consumers cannot invoke it ────────────────────────────────────────────────────
{
    const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'));

    assert.equal(pkg.bin['neo-agent-skills-secrets'], './scripts/check-secrets.mjs');
    assert.ok(pkg.files.includes('scripts/check-secrets.mjs'), 'the guard must be in the published file list')
}

fixtures.forEach(dir => rmSync(dir, {recursive: true, force: true}));

console.log('check-secrets: contract arms green.');
