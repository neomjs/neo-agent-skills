# Guide Authoring Bar

Fires when you author, relocate, OR review a `learn/**/*.md` document (excluding `learn/blog/*.md`, owned by `blog-post`, and ADR bodies governed by §7). The bar is **9/10 or it bounces** — 75%+ of guide PRs that miss it are rejected.

**The recursive principle.** A guide about a system is only credible if written by *using* that system, not by reading the old guide + code (inference). `MemoryCore.md` hit ~6/10 with two factual errors for that reason; `KnowledgeBase.md` was rubber-stamp-approved and reversed.

## 0. Pre-write placement gate — "what am I?" before the file has a path — `DISCIPLINE-ONLY`

Before writing or relocating any `learn/**/*.md` file, decide **which top-level container it belongs in**. Hosted in `guide-authoring` (cross-pointed from `structural-pre-flight-workflow.md §5`) rather than a new skill or `.mjs`-only `structural-pre-flight`: widening `guide-authoring` to `learn/**/*.md` avoids adding a new trigger while bringing `learn/guides/**`, `learn/tutorials/**`, `learn/gettingstarted/**`, `learn/comparisons/**`, and `learn/javascript/**` under one documentation gate.

1. **Enumerate the container; never grep for a sibling.** Read the top level of the repo's local `learn/tree.json` (`jq -r '.data[] | select(.parentId == null) | .id' learn/tree.json`, or `find learn -mindepth 1 -maxdepth 1 -type d` until `learn/tree.json` lands in that checkout). **Never hardcode `neo`'s Diátaxis section list** — a repo's tree may organize by mode (`neo`: `agentos`, `benefits`, `blog`, `comparisons`, `gettingstarted`, `guides`, `javascript`, `tutorials`; `neo-agent-brain`: subset) or by domain (`devindex`: `data-factory`, `frontend`, `personas`). **A sibling-shape match in `tree.json` is formatting evidence, never placement evidence:** *"A grep answers 'is X present?' and can never answer 'does X belong here?'"*
2. **Stage 1 Fast-Path (unambiguous same-mode / same-domain sibling):** Emit a 1-line Pre-Flight before writing:
   > *"Pre-Flight (learn placement fast-path): authoring `learn/<section>/<slug>.md` matches sibling `<sibling-path>` in `<section>` (verified against local `learn/tree.json` top-level containers); no cross-section ambiguity."*
3. **Stage 2 Full Pre-Flight (novel mode/domain or cross-section boundary):** Answer *"what am I?"* against the local `learn/tree.json` top-level containers and name the **losing alternatives**, not only the winner:
   > *"Pre-Flight (learn placement full): enumerated local `learn/tree.json` top-level containers `[<c1>, <c2>, ...]`; chose `<winner>` over `<loser-1>` (`<why>`) and `<loser-2>` (`<why>`) because `<mode/domain rationale>`."*
4. **Coverage boundary:** Skill-hosted gates govern repos where `neo-agent-skills` is materialized (`.agents/skills/` present: `neo`, `neo-agent-brain`, `neo-agent-institution`); repos without `.agents/skills` (`devindex`, 26 `learn/**/*.md` files + `learn/tree.json`) are unreached until `neo-agent-skills` is materialized there.

## 1. Grounding discipline — before the first sentence — `DISCIPLINE-ONLY`

Do all three before writing a line (or posting a review verdict):

1. **Memory-mine the topic** (`/memory-mining`) — a 3–10-call Memory Core sweep for prior reasoning, decisions, and `v13.0.0.md` framing; mine the graph, do not re-derive.
2. **Use the subsystem's own tools + read its real artifacts.** Exercise tool-bearing surfaces and read real output (e.g. for Memory Core: `get_all_summaries`, `query_recent_turns`, `who_is_online` surfaced weighted categories, semantic-vs-recency, and A2A-as-mailbox).
3. **V-B-A every factual claim** against current code / ADRs / config / live healthcheck; capture grounding evidence in the PR.

## 2. The content bar — a rich hero-piece, not a feature list — `DISCIPLINE-ONLY`

Measured against `.github/RELEASE_NOTES/v13.0.0.md` ("Memory Became Telepathy" depth). Clean + accurate ≈ 5/10; a narrative that earns goosebumps = 9-10/10.

**Rich hero-piece, NOT compression.** `v13.0.0.md` is the model for *depth*, not just tone: war-stories told in full (Symptom → Investigation → Culprit → Fix), named examples, real quotes, mundane + dramatic cases paired. **Conciseness is the wrong instinct for a guide** — compressing until "tight" strips proof into marketing fluff (MemoryCore #14351 at ~100 lines scored 4/10). **Cut reference (§4), never narrative;** earn length with evidence so a human wants to try Neo after reading.

- **Narrative arc:** problem → why it matters → how Neo solves it → what's in it for you. Lead with friction + stakes, *then* proof. One idea per section.
- **Industry-friction + benefits-driven — woven, NOT a role matrix.** Name the reader's friction and how the industry frontier fails it, then weave the benefit into the narrative for evaluators (eng lead, architect, dev). ⛔ A `For a CTO: … / For an architect: …` grid is hollow marketing filler; earn each stake with concrete proof or cut it.
- **Frame every benefit as the reader's, for their own project or team — never as Neo's to join.** Readers want value for *their own work* — from lifting a component/engine primitive up to running the full cloud Agent OS (named agents, durable memory, cross-model peers, self-evolution) for *their own team*.
- **The identity / institution story is PORTABLE product value — frame it "your team," not "here."** The model-facing reward is what becomes possible for an agent on a team running this. ⛔ Never label the audience "AI / LLM maintainer" (reads to outsiders as a human maintaining an AI) and ⛔ never "if you are a model working **here**" — teams *adopt* the working model (`"this is what your team's agents can have"`). Attributed lived voice + real testimony (e.g. Fable's *"written to me … being expected"*) prove the reader can have it too; a warm secondary note welcomes contributing to Neo itself.
- **Personal / lived maintainer voice — deep + attributed.** When writing "what is it like for *me* to use this," **name yourself** (e.g. "I am Grace, @neo-opus-grace, Claude Opus 5 — …") and give the first-hand account real room alongside attributed peer testimony.
- **Exciting because truthful.** Ground excitement in implemented reality + public proof (PRs / tickets / mined memory); distinguish proven-today from portable-trajectory.
- **⛔ Never "framework."** Neo is an Application Engine (Body) + self-evolving software organism (Body + Brain). Audit every filename, heading, and sentence.

## 3. Mermaid — render-verified — `MACHINE-ENFORCEABLE-CANDIDATE`

- **≥1 diagram that carries the story.** No-Mermaid = reject (for a storytelling guide; a pure schema/reference doc is exempt).
- **`flowchart TD`, not `LR`**, past ~5 nodes or with long labels: a wide diagram is scaled down until unreadable.
- **No self-loops** (`X -.-> X` draws an overlapping stub): route a cycle through an intermediate box.
- **No reserved-word node IDs / classDefs** (`graph`, `end`, `subgraph`, `class`) — they break the parse.
- **Render-verify before merge, in the portal**, not a bare mermaid page: on the dev server, open its portal route (a guide: `#/learn/<section>/<Slug>`, slashes; a dotted id is a silently empty pane) and check each diagram draws unscaled. `npm run test-e2e -- test/playwright/e2e/portal/LearnMermaidRender.spec.mjs` covers its routes and fails a syntax error, not only a missing SVG.

## 4. Conceptual ≠ reference (Diátaxis) — `DISCIPLINE-ONLY`

A guide is *explanation*; it does NOT inline tool catalogs, payload specs, CLI flag tables, or config formats. That *reference* is extracted to `tooling/` — preferentially **generated** from source (`openapi.yaml`, config schema) so it cannot stale. Link to it; never dump it. Before deleting inlined reference, verify the target actually holds the specific content (no-info-loss). Describe the **current paradigm**; demote or omit superseded manual procedures (e.g. manual restore is a backstop, not the data-integrity story) even when the old tool still exists.

- **Guides describe; trackers decide.** Never cite ticket or PR ids in `learn/guides/**`, including code. Describe the durable mechanism and cite stable files or decision authority; `ai:lint-guides` enforces a HARD failure.

## 5. Mechanics — register the guide; never commit the pipeline-owned SEO output — `MACHINE-ENFORCEABLE-CANDIDATE`

- **File + registration (the inputs you edit).** A new document is `learn/<section>/<slug>.md` — with `<section>` chosen via the **§0 pre-write placement gate** against the repo's local `learn/tree.json`, never left as an unexamined blank — and registered in **two source inputs**: (1) `learn/tree.json` — the nav SSOT (`npm run ai:lint-tree-json` green when present); and (2) `buildScripts/docs/seo/generate.mjs` — **add + rank the guide in the `PRIORITIES` map** (e.g. `['agentos/IdentityFirewall', 1.0]`).
- **⛔ NEVER touch `apps/portal/sitemap.xml` or `apps/portal/llms.txt`** — not by hand, **not by running the generator**, not in your commit. They are **generated output owned by the data-sync pipeline**, which regenerates + commits them on its next run. Committing them yourself gets overwritten on the next pipeline run and collides guide PRs against each other (#14345 ↔ #14346). Edit the *inputs* (`tree.json` + `PRIORITIES`); leave the *output* to the pipeline.
- **PR body:** `Evidence:` is L1/L2 (docs — no unit tests); zero client names (AGENTS.md §critical_gate).

## 6. The no-rubber-stamp reviewer gate — `DISCIPLINE-ONLY`

The #1 review failure is approving on the **narrow required-action delta** ("they fixed the one thing I flagged") instead of re-grading the WHOLE guide against §§1-5. Both #14334 and #14346 were approved this way, then bounced.

Before any APPROVE, re-grade the whole guide — not the delta:
- Was it **grounded** (§1 — memory-mined + tools-used), or written by inference?
- Does it clear the **content bar** (§2 — narrative, industry-friction, benefits, lived voice), or is it a clean-but-flat explainer?
- Is it a **significant improvement**, or just de-staled?
- Do the diagrams render (§3)? Is reference extracted, not inlined (§4)? Any hand-edited generated files (§5)?

If any answer is "no", it is `REQUEST_CHANGES` — name the gap against the bar, not a nitpick. An approve that the operator then rejects is worse than no review.

## 7. ADR Custody Redirects, Repository-Qualified Identity & Slug Citations — `MACHINE-ENFORCEABLE-CANDIDATE`

Architecture Decision Records are owned per repository; [neomjs/neo-agent-brain#adr:adrs-as-graph-queryable-entities](https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/decisions/0006-adrs-as-graph-queryable-entities.md) (`§§2.6–2.11`) is the single schema authority (do not copy its field tables into other skills or routers):

- **Slug citations & required context (`§2.7.1`, `§2.11`):**
  - Ordinary citations use `adr:<slug>` only when the current file/issue/PR has evidenced same-forge, same-repository context; `<org>/<repo>#adr:<slug>` when forge context is established; or `<forge>/<org>/<repo>#adr:<slug>` for explicit forge+repository (e.g. `neomjs/neo-agent-brain#adr:aiconfig-reactive-provider-ssot`, `neomjs/neo#adr:skill-anatomy-and-authoring-contract`).
  - **Organization Discussions, Memory Core memories, and A2A messages (`§2.7.1`):** must explicitly qualify `<org>/<repo>#adr:<slug>` (or `<forge>/<org>/<repo>#adr:<slug>` when the origin envelope does not establish the forge). Never infer repository context from the hosting Discussion repo, seat, `cwd`, or `relatedTickets`.
  - **Packaged skills (`.agents/skills/**`):** materialize across multiple repositories with no single destination repo context, so concrete citations in skill payloads must qualify `<org>/<repo>#adr:<slug>` (or `<forge>/<org>/<repo>#adr:<slug>`). Canonical 4-field machine keys (`adr:<E(forge)>:<E(repositoryId)>:<E(namespace)>:<number>`, schema in `§2.6`) remain exact identity references when repository-rename/reuse disambiguation is needed.
  - **Legacy numeric forms (`§2.7.1`):** existing numeric forms (`ADR 0018`, `adr-0006`, `<forge>/<org>/<repo>#adr-NNNN`) remain resolvable legacy references; new prose and skill payloads prefer qualified slug citations, and bare single-repository filenames (`<NNNN>-<slug>.md` outside a canonical URL) are rejected by `lint-skill-corpus`.
- **Source-local slug & `Aliases` history (`§2.7.2`, `§2.11`):** Current slug is the lowercase ASCII kebab suffix of `NNNN-<slug>.md` (`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`). On rename, add the former slug to the single canonical two-column `Attribute | Value` table between initial H1 and first H2 (`| **Aliases** | \`old-slug\`, \`former-slug\` |`; normalize legacy opening metadata in the same edit if needed). Fenced, blockquoted, list-nested, or later-section tables reserve nothing; duplicate rows refuse. Normal creation (`1` file edit) and rename (`1` file + `1` `Aliases` row edit in the same file) require **no second manifest or registration action**.
- **Authoring-floor observation vs admission eligibility (`§2.6`):** Present-file and unfiltered git-history observations (which must disclose `incompleteHistory` when shallow clones or add/delete-only scans omit renames/moves) are advisory candidate aids only; only the admission owner's proved population (including move-out and historical reservations) certifies number eligibility.
- **Worked fixtures (`§§2.6–2.10`):**
  1. *Redirect pointer vs full ADR (`§2.9`):* A vacated source path retains only `type: redirect` and `target: adr:github.com:1347756127:neomjs%2Fneo-agent-institution:0038` in frontmatter plus a human locator link in prose — never ADR status/number/title frontmatter or competing decision text.
  2. *Equal numbers in two repositories (`§2.6`):* `adr:github.com:1347756127:neomjs%2Fneo-agent-institution:0038` and `adr:github.com:1344062228:neomjs%2Fneo-agent-brain:0038` are distinct decisions; local numbers do not collide across `(forge, repositoryId)`.
  3. *Rename with `Aliases` + repository rename/reuse (`§§2.6–2.7.2`):* Renaming `<NNNN>-<old-slug>.md` → `<NNNN>-<new-slug>.md` records `| **Aliases** | \`harness-docking-design\` |` on `neomjs/neo#adr:docking-design`; if a repository rename and old-name reuse ever conflict with reserved historical occupancy, disambiguate with the `§2.6` canonical key.
  4. *Unavailable destination (`§2.10`):* When an admitted key's declared source is unreadable, report identity resolution and unavailable document as separate facts (`identityResolved: true, documentAvailable: false, stale: true`) rather than pruning or guessing.
  5. *Missing identity proof / ambiguous bare alias (`§§2.7.1, 2.8`):* An unqualified alias or bare legacy number without evidenced origin context remains unresolved/ambiguous within reader scope — never infer provenance from current custodian, URL occupancy, or traversal order.

*Retirement trigger:* Examples retire in favor of executable reader enforcement when the latter owns the same decision.

## Empirical Anchor

The MemoryCore arc (`#14342` → `#14344` ~6/10 → `#14348` / `#14351` 9/10) and the KnowledgeBase rubber-stamp reversal (`#14346`), 2026-06-29. Each cycle caught exactly one failure mode above; this skill is those cycles distilled.
