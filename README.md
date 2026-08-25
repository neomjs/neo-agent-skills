# neo-agent-skills

The canonical store for the Neo agent skill substrate. Every enrolled repository in the
`neomjs` organization carries **the same tree from here**, as committed bytes.

## Why this repo exists

Skill substrate changes constantly — 181 commits across 62 distinct days in a 90-day window.
Nothing kept consuming repositories current, and the failure mode was never staleness. It was
*invisible* staleness: a consuming repo was not behind, it was **forked**, and nothing reported
that. Where substrate had been hand-copied it drifted silently; where it had not been copied it
was simply absent.

This repo is the single source those repos sync from, and `AGENT_SUBSTRATE_REVISION.json` is the
receipt that makes a drift detectable instead of merely regrettable.

## What is here

| path | what it is |
|---|---|
| `.agents/skills/` | the canonical tree — 38 skills plus the manifest and its schema |
| `.agents/skills/skills.manifest.json` | budget and projection SSOT |
| `AGENT_SUBSTRATE_REVISION.json` | the immutable receipt pinning what a canonical revision certifies |

The consumer path is identical (`.agents/skills`), so a sync is a straight directory copy and a
byte-equality check is a plain diff — no path mapping for a guard to get wrong.

## Two axes, and they are not the same axis

Conflating these is the mistake this contract exists to prevent:

- **Repo distribution** — every enrolled repo carries the same canonical tree. **No per-repo
  subsets.** A repo does not get to curate which constitution it runs.
- **Harness exposure** — each harness receives the **manifest-declared** projection. Per-harness
  subsets are legitimate, so a sync guard must *permit* a manifest-declared difference while
  still rejecting an undeclared one.

## What this repo does NOT carry

The maintainer constitution. It keeps its own revision authority and projects into seat and
session substrate — never into a consuming repo's committed tree. Appending it to a fork's
committed `AGENTS.md` would make unreachable internal commands (mailbox protocol, Memory Core
saves, A2A lifecycle) *active authority* for every fork agent. The contributor surface and the
maintainer constitution are separate custody.

## Two things that look right and are not

**Install-time materialization.** Generating the tree from a package install is falsified:
`npm ci --ignore-scripts` is already deliberate practice in three `neomjs/neo` workflows, and it
skips `prepare` as well as `postinstall`. An install-time tree yields **zero skills, silently,
with no error**.

**A git hook as the enforcing seat.** `--no-verify` makes any hook feedback rather than authority.
Binding enforcement is reusable CI plus required branch protection, owned separately.

## Enrollment

Enrollment is a **registry predicate**, never a hardcoded list or count. Exclusions are explicit
rows carrying a reason; absence never means exempt. This is not pedantry — pricing this contract
against a hardcoded "21 repositories" survived multiple revisions before a live census returned
**52**, so every cadence and blast estimate had been computed over the wrong set.

## Provenance

Graduated from `neomjs/neo` discussion D#17756 at cross-family quorum; contract ticket
[neomjs/neo#17784](https://github.com/neomjs/neo/issues/17784), under epic
[#17500](https://github.com/neomjs/neo/issues/17500).
