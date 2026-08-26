# neo-agent-skills

The canonical agent skill substrate for the `neomjs` organization. Consuming repositories **depend
on this package**; they never carry a copy of it.

## How it reaches a repository

```bash
npm install --save-dev neo-agent-skills
```

Then run the materializer from your `postinstall`:

```json
{
  "scripts": { "postinstall": "neo-agent-skills-materialize" },
  "devDependencies": { "neo-agent-skills": "^0.1.0" }
}
```

`postinstall` projects the installed package into the layout your harness discovers — **symlinks
whose targets live under `node_modules`**. The links are created, never committed. Git-ignore the
projection path (`.claude/skills/`); a tracked entry there is a shadow copy, which is the thing this
package exists to make unnecessary.

**Skill changes bump this package's version.** Consumers update the dependency like any other.
Freshness is whatever npm already tells you — `npm outdated`, dependabot — and there is deliberately
no bespoke lag gate anywhere in this contract.

## The check that matters

```bash
npx neo-agent-skills-materialize --check
```

Run it in consumer CI. It answers the one question this transport leaves open: **did the projection
actually happen?**

It can silently not happen. `npm ci --ignore-scripts` skips `postinstall` *and* `prepare`, and is
already deliberate practice in several `neomjs` workflows — that yields a resolved dependency and
zero reachable skills. A dependency resolving is not the same as skills being reachable, and only
this check tells them apart.

One measured npm behaviour worth knowing: **`npm install <pkg>` does not run your `postinstall`;
a bare `npm install` does.** So the command that bumps this dependency leaves the links stale until
the next install. `--check` is what turns that from silent into loud.

## What is in the package

| path | what |
|---|---|
| `.agents/skills/` | the substrate — skills plus `skills.manifest.json` and its schema |
| `scripts/materialize-harness-skills.mjs` | the postinstall linker and its `--check` arm |

The manifest governs **projection**: a skill declaring `claudeSymlinkRequired: false` is a declared
opt-out and is correctly absent from the façade. Per-skill links rather than one directory link,
because a skill cannot be opted out of a directory symlink.

## Authority

Skills are authored on `dev`. `main` is release-only via the publish pipeline. Promotion is a
version bump and a publish — **the package version, the registry tarball integrity, and the
consumer's lockfile are the revision authority.** There is no receipt file; an earlier design used
one to police byte-copies across repositories, and both the copies and the receipt are gone.

Contract: [neomjs/neo#17798](https://github.com/neomjs/neo/issues/17798) · graduated from
[D#17756](https://github.com/neomjs/neo/discussions/17756).
