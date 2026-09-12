#!/usr/bin/env node
/** @summary Mutation-sensitive contract checks for the AGENTS.md generator. */

import assert                                      from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir}                                    from 'node:os';
import {join}                                      from 'node:path';
import {PER_FILE_LIMIT_BYTES, assemble, generate, parseSection, run} from './generate-agents-md.mjs';

const fixtures = [];

/** @summary A disposable source tree, cleaned up when the file finishes. */
function fixture(sections, preamble = '# Title\n\nIntro.\n') {
    const root = mkdtempSync(join(tmpdir(), 'agents-md-'));

    fixtures.push(root);
    mkdirSync(join(root, 'sections'), {recursive: true});
    writeFileSync(join(root, 'preamble.md'), preamble);

    sections.forEach(({audiences = 'maintainer', body, id, listGroup, listNumber, order, repos = 'neo', wrapperGroup}) => {
        const fm = ['---', `id: ${id}`, `order: ${order}`];

        wrapperGroup && fm.push(`wrapperGroup: ${wrapperGroup}`);
        listGroup    && fm.push(`listGroup: ${listGroup}`);
        listNumber   && fm.push(`listNumber: ${listNumber}`);
        fm.push(`repos: ${repos}`, `audiences: ${audiences}`, '---', '');
        writeFileSync(join(root, 'sections', `${String(order).padStart(3, '0')}-${id}.md`), fm.join('\n') + body + '\n')
    });

    return root
}

/** @summary Collects a CLI run's streams without printing them. */
function capture(argv) {
    const lines = [];
    let payload = '';

    return {
        code: run(argv, {out: line => lines.push(line), error: line => lines.push(line), write: text => {payload += text}}),
        payload,
        text: lines.join('\n')
    }
}

// ── Wrapper grouping: the trap that adjacency cannot see ────────────────────────────────────────
// `§neo_identity_anchor` and `§swarm_topology_anchor` are ADJACENT and both wrapped, yet live in
// SEPARATE blocks in the real file, while `§core_values` and `§identity_prompt_firewall` share one.
// A generator that grouped by "consecutive and both wrapped" merges the first pair silently.
{
    const root = fixture([
        {id: 'alpha', order: 10, wrapperGroup: 'g1', body: '## §alpha\n\nA.'},
        {id: 'beta',  order: 20, wrapperGroup: 'g2', body: '## §beta\n\nB.'}
    ]);

    const {text} = generate({audience: 'maintainer', repo: 'neo', root});

    assert.equal(text.match(/<neo_core_overrides/g).length, 2, 'adjacent DISTINCT groups stay two blocks');
    assert.equal(text.match(/<\/neo_core_overrides>/g).length, 2, 'and both close');
}

{
    const root = fixture([
        {id: 'alpha', order: 10, wrapperGroup: 'g1', body: '## §alpha\n\nA.'},
        {id: 'beta',  order: 20, wrapperGroup: 'g1', body: '## §beta\n\nB.'}
    ]);

    const {text} = generate({audience: 'maintainer', repo: 'neo', root});

    assert.equal(text.match(/<neo_core_overrides/g).length, 1, 'a shared group is ONE block');
    // The arm that catches a same-group section being dropped — the first implementation collapsed
    // the block correctly and silently emitted only its first section.
    assert.match(text, /## §alpha/, 'first section of the group survives');
    assert.match(text, /## §beta/,  'and so does the second');
    assert.match(text, /<neo_core_overrides[^\n]*\n## §alpha/, 'the open tag is glued to the first heading, no blank line');
    assert.match(text, /B\.\n<\/neo_core_overrides>/,          'and the close tag to the last content line');
}

// ── Applicability is declared, never inferred ───────────────────────────────────────────────────
{
    assert.throws(
        () => parseSection('---\nid: x\norder: 10\nrepos: TODO\naudiences: maintainer\n---\n## §x\n', 'x.md'),
        /still TODO/,
        'an undecided declaration fails loudly rather than defaulting to "ships everywhere"'
    );

    assert.throws(
        () => parseSection('---\nid: x\norder: 10\naudiences: maintainer\n---\n## §x\n', 'x.md'),
        /must declare repos/,
        'a missing declaration is not an implicit yes'
    );
}

{
    const root = fixture([
        {id: 'everywhere', order: 10, repos: 'neo, devindex',  audiences: 'maintainer, contributor', body: '## §everywhere\n\nE.'},
        {id: 'brainonly',  order: 20, repos: 'neo-agent-brain', audiences: 'maintainer',              body: '## §brainonly\n\nB.'},
        {id: 'internal',   order: 30, repos: 'neo, devindex',  audiences: 'maintainer',              body: '## §internal\n\nI.'}
    ]);

    const engine      = generate({audience: 'maintainer',  repo: 'neo', root}).text,
          contributor = generate({audience: 'contributor', repo: 'neo', root}).text,
          brain       = generate({audience: 'maintainer',  repo: 'neo-agent-brain', root}).text;

    assert.doesNotMatch(engine, /§brainonly/,  'a gate whose governed surface is elsewhere does not ship here');
    assert.match(brain,        /§brainonly/,   'and does ship where it is load-bearing');
    assert.doesNotMatch(contributor, /§internal/, 'the contributor variant drops what a fork cannot act on');
    assert.match(contributor,  /§everywhere/,  'and keeps what it can');
}

// ── The budget is enforced on the EMITTED file ──────────────────────────────────────────────────
// An over-budget variant is never written: past the limit a harness silently truncates the file's
// TAIL, and the loss is unobservable from inside the seat that suffers it.
{
    const root = fixture([{id: 'huge', order: 10, body: '## §huge\n\n' + 'x'.repeat(PER_FILE_LIMIT_BYTES)}]),
          out  = join(root, 'emitted.md'),
          {code, text} = (() => {
              const lines = [];
              return {code: run(['--repo', 'neo', '--out', out], {
                  out: line => lines.push(line), error: line => lines.push(line), root
              }), text: lines.join('\n')}
          })();

    assert.equal(code, 1, 'an over-budget variant is refused');
    assert.match(text, /over the 24576 B budget/, 'and the refusal names the budget it broke');
    assert.throws(() => readFileSync(out, 'utf8'), /ENOENT/, 'and nothing is written — refuse before emitting, not after');
}

// ── The document sink does not editorialize ─────────────────────────────────────────────────────
// `console.log` appends a newline, so emitting the document through the status channel makes
// `> file` differ from `--out file` by one byte — fatal for a generator whose whole promise is a
// byte-exact diff against the hand-maintained file it replaces.
{
    const {code, payload} = capture(['--repo', 'neo', '--audience', 'maintainer']);

    assert.equal(code, 0, 'the real source emits for the engine');
    assert.ok(payload.endsWith('\n'),   'the document ends with exactly one newline');
    assert.ok(!payload.endsWith('\n\n'), 'and not two — the status channel must not add one');
}

// ── Numbered items keep their DECLARED number ───────────────────────────────────────────────────
// The rule that makes per-repository gate exclusion safe. Cross-references name gates by number
// ("§critical_gates #4") from files this generator never sees, so dropping one rule from a
// repository must not slide the rest. Positional numbering would look correct in every single-repo
// render and silently break every citation in the one repo that excludes a gate.
{
    const root = fixture([
        {id: 'head',  order: 400, repos: 'neo, brain', body: '## §gates\n\nThese apply:'},
        {id: 'gate1', order: 401, repos: 'neo, brain', body: 'First.',  listGroup: 'gates', listNumber: 1},
        {id: 'gate2', order: 402, repos: 'brain',      body: 'Second.', listGroup: 'gates', listNumber: 2},
        {id: 'gate3', order: 403, repos: 'neo, brain', body: 'Third.',  listGroup: 'gates', listNumber: 3}
    ]);

    const engine = generate({audience: 'maintainer', repo: 'neo', root}).text,
          brain  = generate({audience: 'maintainer', repo: 'brain', root}).text;

    assert.match(brain,  /1\. First\.\n2\. Second\.\n3\. Third\./, 'all three render as one list, in order');
    assert.doesNotMatch(engine, /Second\./,   'the repo-specific gate does not ship where it governs nothing');
    assert.match(engine, /1\. First\.\n3\. Third\./,
        'and the survivors keep 1 and 3 — the gap is deliberate, because renumbering would break every "#3" citation');
    assert.doesNotMatch(engine, /2\. Third\./, 'Third must NOT slide up into the vacated number');
}

// ── The real source: the headline exclusion ─────────────────────────────────────────────────────
{
    const engine = generate({audience: 'maintainer', repo: 'neo'}).text,
          brain  = generate({audience: 'maintainer', repo: 'neo-agent-brain'}).text,
          GATE   = /No AiConfig work without reading ADR-0019/;

    assert.match(brain,        GATE, 'the AiConfig gate ships where its governed surface lives');
    assert.doesNotMatch(engine, GATE, 'and not to the engine, where `git ls-files ai/` is empty');

    assert.ok(Buffer.byteLength(engine, 'utf8') < Buffer.byteLength(brain, 'utf8'),
        'the engine variant is strictly smaller — the accretion-defense net-reduction constraint');

    // Every gate the engine DOES keep must still carry its own number.
    [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(n =>
        assert.ok(engine.includes(`\n${n}. `), `engine keeps gate ${n} at its declared number`));
}

// ── CLI contract ────────────────────────────────────────────────────────────────────────────────
{
    assert.equal(capture([]).code, 1, '--repo is required: there is no default repository');
    assert.equal(capture(['--repo', 'neo', '--audience', 'nobody']).code, 1, 'an unknown audience is refused, not silently treated as maintainer');
}

fixtures.forEach(root => rmSync(root, {force: true, recursive: true}));
console.log('✅ generate-agents-md contract checks pass.');
