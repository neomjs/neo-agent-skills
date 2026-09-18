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

`postinstall` materializes **two surfaces**, both as symlinks into `node_modules`, both untracked:

| surface | shape | for |
|---|---|---|
| `.agents/skills` | **one directory symlink** at the whole tree | harness-neutral discovery — Codex, Antigravity, any fork |
| `.claude/skills` | **per-skill links**, manifest-projected | the Claude façade |

The shapes differ on purpose. The manifest may opt a skill out of the Claude façade, and **you cannot
opt a skill out of a directory symlink** — so the neutral surface links the tree and the façade links
each skill. Git-ignore both paths; a tracked entry under either is a shadow copy, which is the thing
this package exists to make unnecessary.

**Skill changes bump this package's version.** Consumers update the dependency like any other.
Freshness is whatever npm already tells you — `npm outdated`, dependabot — and there is deliberately
no bespoke lag gate anywhere in this contract.

## The check that matters

```bash
npx neo-agent-skills-materialize --check
```

Run it in consumer CI. It answers the questions this transport leaves open: **did both projections happen, and does every
link point where it should?** Existence is not correctness — a link resolving to the wrong skill
resolves.

It can silently not happen. `npm ci --ignore-scripts` skips `postinstall` *and* `prepare`, and is
already deliberate practice in several `neomjs` workflows — that yields a resolved dependency and
zero reachable skills. A dependency resolving is not the same as skills being reachable, and only
this check tells them apart.

One measured npm behaviour worth knowing: **`npm install <pkg>` does not run your `postinstall`;
a bare `npm install` does.** So the command that bumps this dependency leaves the links stale until
the next install. `--check` is what turns that from silent into loud.

## Shared source-comment guard

```bash
npx --no-install neo-agent-skills-ticket-archaeology --base origin/dev
```

The guard scans every changed tracked `.mjs` file in full. Repository-local issue numbers of any
length and review-history markers fail only in comments or JSDoc; executable strings remain valid.
A numeric CSS color of 3, 4, 6 or 8 digits passes directly after color syntax (`color:`,
`backgroundColor_=`, `fillStyle=`, `CSS color`), a number with a leading zero is never a ticket, and a
numeric HTML entity (`&#39;`) is a codepoint rather than a reference;
anywhere else a bare number stays a ref. A token-scoped `[not-ticket-ref: …]` marker binds to the one
token it follows: `css-color` on such a color, or any other non-blank reason on a numeric reference
the author declares deliberate. A marker binding to neither, or carrying no reason, fails closed.
Consumer repositories call the stable `Source comment archaeology` job in
`.github/workflows/reusable-pr-baseline.yml` through an immutable Skills revision. That job installs
its exact guard release outside the caller workspace, so a pull request cannot weaken its own gate by
changing the caller lockfile or local binary.

## Shared substrate byte-budget guard

```bash
npx --no-install neo-agent-skills-substrate-size
```

Measures what a seat actually **loads** per turn — `AGENTS.md`, `.agents/ANTIGRAVITY_RULES.md`,
`.claude/CLAUDE.md` — against a **24,576-byte** per-file limit, and fails the check on a breach.

Loaded bytes, not file bytes: symlinks resolve through `realpathSync` (an `lstat` on a symlinked
`CLAUDE.md` reports **12** — the length of `../AGENTS.md`), and whole-line `@path` imports are summed
recursively as one unit with a cycle guard keyed on file identity. It reports **headroom** rather than
pass/fail, because this drift is gradual: by the time a file flips to EXCEEDS it is already truncating.

**Past the limit the harness silently truncates the BOTTOM of the file**, so a seat loses the tail of
its own rules with nothing reporting it — the one failure that cannot be observed from inside the seat
suffering it.

**A missing entry point is `not applicable`, never a failure.** Consumers legitimately differ: only
some carry all three. **Only `ENOENT` means absent** — a permission denial or an unreadable path is an
error and fails the check, because absent is a claim about the repository while unreadable is a claim
about the observation, and a failed observation supports neither.

Consumer repositories call the stable `Substrate size` job in
`.github/workflows/reusable-pr-baseline.yml` through an immutable Skills revision. **The limit ships
with the guard, not with the caller**: the job installs its exact release outside the caller workspace
and pins the measurement to the checked-out tree, so a pull request cannot widen the limit it is judged
by, drop an entry from the target roster, or move the measurement to a directory where every target is
absent and the check greens on nothing.

## Shared npm-overrides guard

```bash
npx --no-install neo-agent-skills-npm-overrides
```

An npm `overrides` rule is a floor: it keeps a dependent whose declared range still admits a
vulnerable version from resolving beneath the patched one. **Dependabot neither bumps nor removes
`overrides`**, so a rule outlives its reason silently. Worse, when a dependent moves to a new major,
the stale rule forces it back onto the old one.

The guard judges each rule against the ranges its dependents **declare** in `package-lock.json`, with
no network. A nested rule (`"parent": {"pkg": …}`) counts only dependents inside `parent`'s
resolved subtree, hoisted ones included:

| verdict | meaning |
|---|---|
| `needed` | a dependent in scope still admits a version below the floor; the offending ranges are printed |
| `REDUNDANT` | nothing in scope can resolve below the floor, or nothing declares the package any more: delete the rule |
| `FIGHTING` | a dependent's range starts above everything the rule permits: delete or raise the rule |

Holding a package above an exact pin (`dompurify: "3.4.8"` held at `^3.4.13`) is the deliberate
security direction, so it reads `needed`. No `overrides` is N/A. A missing `package.json`, or
overrides with no v2/v3 lock, is a failed observation and exits 1.

Consumer repositories call the stable `npm overrides` job in `.github/workflows/reusable-pr-baseline.yml`.
The verdict can only change in a pull request that edits `package.json` or `package-lock.json`, so
the job runs on every pull request and never reddens one for an upstream release.

## What is in the package

| path | what |
|---|---|
| `.agents/skills/` | the substrate — skills plus `skills.manifest.json` and its schema |
| `scripts/materialize-harness-skills.mjs` | the postinstall linker and its `--check` arm |
| `scripts/check-ticket-archaeology.mjs` | the portable comment/JSDoc archaeology guard |
| `scripts/check-npm-overrides.mjs` | the portable stale-`overrides` guard |
| `scripts/check-substrate-size.mjs` | the portable per-turn substrate byte-budget guard |

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
