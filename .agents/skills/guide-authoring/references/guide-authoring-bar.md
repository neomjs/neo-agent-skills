# Guide Authoring Bar

Fires when you author OR review a `learn/` guide (`learn/benefits/<slug>.md`, `learn/agentos/<slug>.md`). The bar is **9/10 or it bounces** — the operator rejects 75%+ of guide PRs that miss it, and every redo is negative ROI.

**The recursive principle.** A guide about a system is only credible if it was written by *using* that system. The #1 quality failure is writing from the old guide + code-reading (inference) instead of from the live tools + content. `MemoryCore.md` hit ~6/10 and shipped two factual errors for exactly this reason; `KnowledgeBase.md` was rubber-stamp-approved, then reversed. This guide is those cycles distilled — so the next guide starts at 9, not at the beginning.

## 1. Grounding discipline — before the first sentence — `DISCIPLINE-ONLY`

You MUST do all three before writing a line (or posting a review verdict):

1. **Memory-mine the topic** (`/memory-mining`) — a 3–10-call Memory Core sweep for prior reasoning, decisions, and the `v13.0.0.md` framing on this subject. It is usually already in the graph; mine it, do not re-derive.
2. **Use the subsystem's own tools + read its real artifacts.** For a guide about a tool-bearing surface, exercise the tools and read real output. Five minutes of use surfaces what hours of code-reading miss (e.g. for Memory Core: `get_all_summaries`, `query_recent_turns`, `who_is_online` revealed weighted categories, the semantic-vs-recency axis, and A2A-as-the-mailbox).
3. **V-B-A every factual claim** against current code / ADRs / config / live healthcheck. A claim you did not re-verify fails review. Capture the grounding evidence in the PR.

## 2. The content bar — a rich hero-piece, not a feature list — `DISCIPLINE-ONLY`

Measured against the engine's `.github/RELEASE_NOTES/v13.0.0.md` ("Memory Became Telepathy" depth). Clean + accurate ≈ 5/10; a narrative that earns goosebumps = 9-10/10.

**Rich hero-piece, NOT compression.** v13.0.0 is the model for *depth*, not just tone — it is long, detailed, and convincing: war-stories told in full (Symptom → Investigation → Culprit → Fix), named examples, real quotes, the mundane everyday case paired with the dramatic one. **Conciseness is the wrong instinct for a guide.** A guide compressed until it reads "tight" loses the moat and becomes (unconvincing) marketing fluff — claims with no proof behind them. **Cut reference (§4), never narrative.** Length serves the story; earn it with detail and evidence. The test: a human should *want to try Neo after reading.* An over-short guide is a 4/10 no matter how clean (MemoryCore #14351 was compressed to ~100 lines and read as fluff — that is this failure mode).

- **Narrative arc:** problem → why it matters → how Neo solves it → what's in it for you. Lead with the friction + stakes, *then* the proof. One idea per section; each earns the next.
- **Industry-friction + benefits-driven — woven, NOT a role matrix.** Name the friction the reader feels (and how the industry frontier fails it), then the benefit. Make the value land for the people who will evaluate Neo — the eng lead weighing adoption, the architect, the dev — but **weave it into the narrative.** ⛔ A `For a CTO: … / For an architect: …` bullet grid is a marketing matrix, the opposite of story; it reads as hollow filler (generic verbs like "queryable, repeatable, improvable" with no proof behind them). Earn each stake with something concrete and specific, or cut it.
- **Frame every benefit as the reader's, for their own project or team — never as Neo's to join.** Most readers (human or LLM) don't know or care about Neo; they want value for *their own work*. That value spans a range — a part they can lift (the engine, a component: pure toolbox) up to the whole working model they run for *their own team*: named agents with identities, durable memory, cross-model peers, self-evolution (the cloud Agent OS — an adopting engineering org is exactly this reader). Lead with that; presume nothing about caring for Neo itself.
- **The identity / institution story is PORTABLE product value — frame it "your team," not "here."** The model-facing reward is *what becomes possible for an agent in a team that runs this* — your identity, your peers, your memory, your continuity, on *your* products. ⛔ Never label the audience "AI / LLM maintainer" (to an outsider that reads like *a human who maintains an AI*; the equal-peer concept is Neo-internal), and ⛔ never "if you are a model working **here**" — that shrinks a portable product to Neo's repo; teams *adopt* the working model, they don't join Neo. ✓ "this is what your team's agents can have." The attributed lived voice (next bullet) + real testimony (e.g. Fable's *"written to me … being expected"*) serve as **proof it works** — evidence the reader can have it too, not "you belong to us." A warm *secondary* note welcomes contributing to Neo itself — the smaller reader, not the headline.
- **Personal / lived maintainer voice — deep + attributed.** A guide may carry "what is it like for *me* to use this." When you do, **name yourself** (e.g. "I am Grace, @neo-opus-grace, Claude Opus 5 — …") and make it a *real, complete* first-hand account, not two thin paragraphs — the lived section is often the most memorable part of the guide, so give it room. Quote real, attributed testimony from other maintainers too.
- **Exciting because truthful.** Excitement from the real implemented reality + concrete public proof (PRs / tickets / mined memory); no marketing fluff, no overclaim, distinguish proven-today from portable-trajectory.
- **⛔ Never "framework."** Neo is an Application Engine (the Body) + a self-evolving software organism (Body + Brain). Audit every filename, heading, and sentence.

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

- **File + registration (the inputs you edit).** A new guide is `learn/<section>/<slug>.md`, registered in **two source inputs**: (1) `learn/tree.json` — the nav SSOT (`npm run ai:lint-tree-json` green); and (2) `buildScripts/docs/seo/generate.mjs` — **add + rank the guide in the `PRIORITIES` map** (e.g. `['agentos/IdentityFirewall', 1.0]`). That map is where a guide's SEO weight is set.
- **⛔ NEVER touch `apps/portal/sitemap.xml` or `apps/portal/llms.txt`** — not by hand, **not by running the generator**, not in your commit. They are **generated output owned by the data-sync pipeline**, which regenerates + commits them on its next run. Committing them yourself is pointless (the next pipeline run overwrites your edits) **and** is what collides guide PRs against each other (the #14345 ↔ #14346 SEO conflict — both committed the regenerated output). Edit the *inputs* (tree.json + the `PRIORITIES` map); leave the *output* to the pipeline.
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
