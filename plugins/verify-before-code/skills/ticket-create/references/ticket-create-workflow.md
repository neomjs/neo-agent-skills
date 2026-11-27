# Ticket Create Workflow

Apply before drafting or filing. Preserve the evidence the next maintainer needs to decide whether to build.

> **Standalone / plugin workspace (no Agent OS MCPs):** run §1a sweeps via `gh issue list --state open --limit 20`, `gh issue/pr list --state all --search "<nouns>"`, `git grep`, and `git log -S "<symbol>" -n 20` (**note:** covers committed history/public threads, not `ask_knowledge_base`/`query_raw_memories` RAG or A2A claims). Apply §2's 6-stage chain and §5's problem/reality/fix/AC structure, but **labels and body format follow the host repo** (`gh label list`, `.github/ISSUE_TEMPLATE/`): §4 defaults (`ai` required; `good first issue` + `help wanted` + claim line) and §5 `neomjs`-only fields (sweep-attestation line, `Retrieval Hint`, `Origin Session ID`) apply **only in `neomjs` repositories**. Draft in chat; run `gh issue create` **only** on explicit user request (skip `ai:structure-map` and `create_issue`).

## §0 — Understand the intent before you write the ticket

Does the work fit the architecture and active roadmap outcome? For Brain and Skills, use the Engine roadmap’s line table. Recover intent from the owner, consumers, JSDoc and prior decisions (`memory-mining` / `ask_knowledge_base`). Missing intent can be a documentation gap.

A ticket that calls an existing behavior wrong carries its `Design authority:` line before The Fix exists — the rule: [`design-authority.md`](design-authority.md).

## 1. Pre-Authoring Adjacency Sweeps (Gate 0)

**Before drafting any title or body**, you MUST execute the applicable sweeps below to ensure swarm synchronicity and architectural discipline:

### 1a. The Content Sweep (Duplicate Detection)
Verify no equivalent ticket or closed exclusion already exists. Redundant tickets pollute the Knowledge Base.

Duplicates hide in **two substrates**; sweep **both as the LAST step immediately before `create_issue`** — never at turn-start or before drafting. A pre-draft sweep goes stale while you write: in a thundering herd, a peer's ticket can land in between. The turn-start mailbox check (`§mailbox_check_protocol`) is for general coordination, **not** the dup gate.

**(i) GitHub live freshness + noun sweep (mandatory) — catches already-FILED duplicates, older open owners and closed rulings:** read at least the latest 20 open GitHub issues from the live tracker (issue number, title, author, labels, URL), then query open and closed state on the problem's nouns: an open owner older than the latest 20 is the one a fold needs.

```bash
gh issue list --state open --limit 20 --json number,title,author,labels,url
gh issue list --state open --search "<problem nouns>" --limit 15
gh issue list --state closed --search "<problem nouns>" --limit 15
```

Read the `Out of Scope` and `Avoided Traps` sections of any same-surface closed hit — a closed ticket's title rarely reveals that it governs adjacent scope, and a closed hit answers what was already decided, never whether the premise matters (`neomjs/neo#18308` zero-backwards-compatibility ruling while `#18537` still closed `not_planned`, `neomjs/neo#18399` `Out of Scope` exclusion, `neomjs/neo#16391` / PR `#16403` already-shipped `hasLandedInPlace`). An MCP call may stand in for the open page only when live and created-descending (`list_issues`, `sort: 'created'`): updated-descending buries untouched fresh filings (`#15603`). All three runs are required even when KB and local searches return no hits.

If live GitHub state cannot be fetched, retry through the approved path; if still unreachable, stop before `create_issue` and report the blocker rather than filing from stale evidence.

Record them on one attestation line in the ticket body, e.g. `Live latest-open + closed sweep: checked latest 20 open + open and closed search (<problem nouns>, Out of Scope / Avoided Traps read on hits) at <timestamp>; no equivalent or prior exclusion found` (or link the existing ticket instead of filing).

**Backlog band:** add the open-issue count to that line (under 25 green, 25–50 orange, over 50 red). Every open ticket is prior art; in orange or red, fold into an owning ticket or epic if one exists, else file the needed ticket.

**(ii) A2A in-flight claim sweep (mandatory) — catches IN-FLIGHT duplicates not yet on GitHub:** in a thundering herd a peer's intent first exists only as an A2A `[lane-claim]`/`[lane-intent]` invisible to `(i)`. Immediately before `create_issue`, scan the mailbox for recent claims on the same scope:

```js
list_messages({ status: 'all', projection: 'compact', limit: 30 })  // ALL read-states
```

**Filter by recency + scope, NOT read-status.** A `[lane-claim]` already marked read during turn-start mailbox triage is still an active claim — `status: 'unread'` hides it and causes duplicate filing (read-status tracks consumption, not relevance). Keep messages whose `sentAt` falls in the herd window (~last 30–60 min) **and** whose `[lane-claim]`/`[lane-intent]` subject overlaps your scope (`taggedConcepts: ['lane-claim']` is optional; subject-scan stays primary).

**Tiebreak — first-claim-timestamp-wins:** the **earliest claim/file timestamp wins**, and an earlier *unfiled claim* outranks a later *filed ticket*. The later party stands down; if it already filed, it closes its duplicate and ports unique substance onto the survivor (earlier claimant absorbs later filer's content, **not** the reverse). A contested-lane resolution MUST set `wakeSuppressed: false` — claim-class is quiet by default (#15987), so omitting it leaves the signal mailbox-only.

**(iii) Memory Core rationale sweep + (iv) own-assignment sweep (both mandatory):** `(i)` and `(ii)` are **artifact** substrates — combine them with one `query_raw_memories` keyed on the **problem's** nouns (observed symptom, never proposed mechanism) and `gh issue list --state open --assignee @me` reading the **bodies** of same-surface hits. Both attest in the body beside `(i)`.

**(v) Epic-layer sweep (epic-labeled filings only, mandatory):** read every open `label:epic` issue's `Terminal predicate:` line, run `gh issue list --label epic --state closed --search "<outcome nouns>"` to read the predicate or body opening of same-outcome closed epics, body-read what an outcome-overlap query ranks, and attest beside `(i)`.

<!-- trigger: filing a ticket, filing an EPIC, or a defect found while measuring something else -> read ./decision-substrate-sweeps.md (query shape, the epic sweep, attestation lines, same-turn porting, the #17997 / #12856 anchors) -->
<!-- trigger: load-bearing population count or absence claim justifying premise, scope, or acceptance -> read neo-agent-skills:pr-review/references/reviewer-instrument-audit.md (role-triggered publish-safe instrument receipt; routine receipts and CI totals exempt) -->

Semantic sweep: `ask_knowledge_base(query='...', type='ticket')` — surfaces conceptual duplicates that title scanning misses; its rows come from the `github-content-sync` tenant.
Exact/historical sweep: `query_documents` (issues, archived issues, discussions) or a live `gh search issues --owner neomjs "<keyword>"`.

If an equivalent ticket or a prior decision exists: do NOT file a duplicate. Comment on the existing ticket, extend its scope, or reject the new request — and if the content belongs on a parent, comment it onto that parent **in the same turn**.

### 1b. The Meta-Skill Sweep (Progressive Disclosure)
If the proposed ticket involves modifying any agent skill (i.e., any file within `.agents/skills/`), you MUST explicitly consult `neo-agent-skills:create-skill/SKILL.md` before finalizing the ticket body.
**Pre-flight check:** *Have I verified this proposal adheres to the Progressive Disclosure routing pattern and does not bloat the top-level SKILL.md router?*

**Content artifacts:** a ticket whose deliverable is release notes (`.github/RELEASE_NOTES/**`) or a blog, outbound or pitch text (`learn/blog/**`, social posts, `funding/**`) reads `neo-agent-skills:release-notes/SKILL.md` or `neo-agent-skills:blog-post/SKILL.md` before drafting. The body names that skill on its first screen, and its first ACs state the impact the artifact must have (release-notes §5's questions; blog-post §1's reader, want and action), so every later seat meets the skill in the ticket itself.

### 1c. Agent OS Structure Map Gate (Architecture-Creation Mandatory)

Before creating any Epic, architecture/substrate ticket, or ticket touching `ai/`, Agent OS, MCP, Memory Core, orchestration, `.agents/skills`, or placement, run `npm run ai:structure-map -- --files --loc`; cite the owning folder/sibling precedent or record N/A. Brain-hosted; never `--silent` (empty exit-1 ≠ pass).

### 1d. The Ungraduated-Discussion Cross-Check (High-Blast-Radius Mandatory)

**Trigger:** if a proposed ticket cites a Discussion below §6.2 quorum AND matches any mechanical high-blast trigger in `ideation-sandbox-workflow.md §5.2`, default to **BLOCK creation**. At quorum, file the real `#N` before recording its back-reference marker.

**Why:** a pre-quorum ticket creates a premature center-of-gravity; this pairs with the Discussion-side §5.1 gate.

**Three-act boundary:** creation is pre-quorum-blocked by default; marker recording is post-quorum; work-start and merge eligibility are post-marker, so no PR opens before the marker.

**Pre-quorum reservation exception:** the body MUST carry all three:

1. attributed, cite-able substantive rationale (identity alone is insufficient);
2. an inline divergence matrix: recommendation + 2 alternatives, each with a falsifier;
3. the sections that must be refreshed after graduation.

The shell also carries `[PROVISIONAL_UNGRADUATED: D#N]`, links the source Discussion, marks scope provisional, and omits final ACs; do not assign, claim, or start it. At quorum, promote the body/graduated-artifact ledger, record `[GRADUATED_TO_TICKET: #N]`, and remove the provisional marker; only then may a PR open.

For source anchors (`#11078` / `#11082` / `#11083` / `#11084`), Discussion `#11091` authority context, and substrate-decay review, read [`neo-agent-skills:ideation-sandbox/audits/double-diamond-divergence-guard.md`](neo-agent-skills:ideation-sandbox/audits/double-diamond-divergence-guard.md).

### 1e. The Zero-Ceremony Defect Channel (capture exemption)

Defect CAPTURE is exempt from §1a's sweeps and §2's chain, permanently. On broken substrate — or working substrate you touched and saw is wrong — production or local — capture is one A2A line to `AGENT:*`, no sweeps, no body:

```
defect-note: <surface> <broke | is wrong> <observed symptom>
```

- **Capture ≠ admission.** Notes fold into one standing observation per surface/symptom fingerprint (read model: `ai/services/memory-core/helpers/defectObservationFold.mjs`; print it: `node ai/scripts/diagnostics/defectObservations.mjs`).
- **Promotion runs the FULL ceremony** — an issue is created only on a production-down signal, an independent second occurrence, an operator escalation, or a triage decision, and runs this entire workflow, V-B-A included. Capture never waits for any of it.
- **Recovery is a note too:** `defect-note: [recovered] <the note, verbatim>` closes the observation idempotently — the fold keys the whole line; a fresh sighting re-opens it.
- **Promotion/dismissal are notes too:** `defect-note: [promoted #N] <same note>` (any seat) or `defect-note: [dismissed] <same note>` (operator only) — either takes a row off the orchestrator digest (`defectObservations.mjs --digest`).
- The asymmetry is deliberate: a duplicate note costs one dedup; an unfiled defect costs what an unfiled production break costs (origin: the `query_summaries` specimen, D#17136). **A workaround or scope boundary without a filed defect-note is the named anti-pattern** — the workaround may stay private, the sighting may not.

## 2. Six-Stage Challenge Chain

Apply PR-review importance weights at creation time (30% premise / right work; 30% owning substrate; 30% deliverable correctness; 10% AC/evidence sanity — weights govern verdict, not drafting length). Every stage must pass before drafting:

1. **Premise** — is the problem real, reproducible, and independently verified rather than secondhand?
2. **Prescription** — verify the owning layer. For Neo Engine, example and Learn tickets, **try the native approach before drafting**. Use the Engine’s [Structural Inventory](neomjs/neo:learn/benefits/ArchitectureOverview.md#structural-inventory) to find related packages. Query the Knowledge Base for usage (standalone: search the Engine’s `src/`, `examples/` and `learn/`). Trace the public API or config through its owner and a shipped consumer, including inheritance, composition or global CSS as relevant. Exercise the distinguishing behavior and a working case to preserve. Leave an unverified prescription open.
3. **Substrate** — service layer, build script, CI workflow, core, or docs? When introducing or relocating a `.mjs` file, validate placement via `neo-agent-skills:structural-pre-flight/` first (Stage 0/1 fast-path or full Pre-Flight; anchors: PR `#11008`, `ai/daemons/wake/daemon.mjs`).
4. **Consumer** — match the form (guide, metadata or tool response) to its consumer. For reusable Engine work, show the import or declarative config another app will use with its own data or actions. Put shared behavior behind that public entry and domain wiring in the demo. When existing composition works, teach it in a guide or example if a reader gap remains. Drop the ticket if the outcome is already covered.
5. **Service-Boundary** — avoid crossing service boundaries or placing config in a non-owning service.
6. **Decision Record impact** — for architecture/substrate tickets, declare `none`, `aligned-with`, `depends-on`, `amends`, `supersedes`, or `challenges` an ADR; run [`../../ticket-intake/references/adr-successor-risk-audit.md`](../../ticket-intake/references/adr-successor-risk-audit.md) before challenging or superseding an accepted ADR.

Reshape or drop any ticket that fails a stage.

## 3. Title Hygiene

**Titles describe the subject, never `[enhancement]` / `[bug]` / `[epic]` prefixes** (category belongs in labels) and stay under ~70 characters (`Add config for X`, `Y fails when Z`, `Modernize W`).

## 4. Label Rules

**Default for new non-critical standalone work: `good first issue` + `help wanted` + `ai`.**
Keep curated labels off urgent/critical, unresolved, private-dependent or owned work; say why.
First-time is not novice. Supply public context and checks (§5/§12) for features,
fixes and refactors, not just trivial tests.

With either curated label, place this above Context on the first screen:
“Please comment to claim before starting; check current assignees and linked PRs.”

- **`ai` — required on agent-created tickets** (provenance, not difficulty or ownership).
- **Primary — exactly one:** `epic`, `enhancement`, or `bug`. Standalone issues must be one-PR-resolvable (one `Resolves #N`); split larger work, or use `epic` when leaves coordinate toward a shared outcome (`epic-create` Procedure 1).
- **Secondary — as applicable:** `architecture`, `performance`, `regression`, `refactoring`, `documentation`, `testing`, plus domain labels (`core`, `grid`, `build`, etc.).
- Verify labels exist via `list_labels` (or `gh label list` standalone) before filing; never invent names.

## 5. Fat Ticket Body Structure

Skeleton tickets are forbidden — so are world atlases: sections complete, each fact once, derivations linked (#16528). Every ticket body MUST contain:

- **Context** — why this exists and its evidence. Incident tickets name the observed operation when known, mark unknowns, and separate observation from inference; quotations are leads, not causes. *(Retire with §8 once lint enforces this without syntax proxies.)*
- **The Problem** — deep background, insights from recent Memory Core explorations, reproducer if applicable. Historical "why" for the agent picking up the ticket later.
- **The Architectural Reality** — cite the owner and record what the existing consumer can already do, the observed gap and how it determined scope (§2).
- **The Fix** — concrete prescription: files, symbols, architectural primitives touched. What changes, and where.
- **Contract Ledger Matrix** *(when applicable)* — For any ticket introducing, modifying, or deprecating a surface consumed by humans, agents, or external systems (public methods, configs, MCP tools), include a formal Contract Ledger matrix (Target Surface, Source of Authority, Proposed Behavior, Fallback, Docs, Evidence). Rows naming existing surfaces must satisfy the row-level Surface-Anchor V-B-A discipline in the [Contract Ledger protocol](neomjs/neo-agent-brain:learn/agentos/process/contract-ledger.md) before the ticket asserts them.
- **Decision Record impact** *(architecture/substrate tickets)* — the §2 step-6 declaration (`none` … `challenges <org>/<repo>#adr:<slug>` or same-repo `adr:<slug>`).
- **Decision Record** *(Discussion-origin tickets)* — Preserve the source Discussion's ADR classification when present: `Not needed`, `Optional: <ADR/ticket/discussion anchor>`, or `Required: <org>/<repo>#adr:<slug> / PR #N / ticket #N` (records the graduation's authority target; `Decision Record impact` records what this ticket itself does to ADR authority).
- **Discussion Criteria Mapping & Leaf Slice** *(when graduating from a Discussion)* — Reconciles the upstream Discussion's `[RESOLVED_TO_AC]` criteria and marked `binding-inventory` blocks per [`neo-agent-skills:epic-resolution/audits/source-discussion-reconciliation-audit.md`](neo-agent-skills:epic-resolution/audits/source-discussion-reconciliation-audit.md). Every Discussion-origin leaf MUST carry its exact binding slice (`inventory-id` entries, Contract Ledger rows, and ACs) in its own body so implementation and review never depend on reopening the Discussion.
- **Acceptance Criteria** — bulleted checklist; each item independently verifiable, post-merge-only items flagged. **Epic exception:** for `epic`-labeled tickets, ACs live in the **SUB** tickets (author per `neo-agent-skills:epic-create/`: problem-scope + intended-solution; subs linked via `update_issue_relationship`, each one-PR-deliverable).
- **Out of Scope** — what this ticket deliberately does NOT do.
- **Avoided Traps** / **Gold Standards Rejected** *(when applicable)* — alternatives considered and rejected with rationale (especially generic LLM/React patterns that fail in Neo.mjs's multi-threaded architecture).
- **Related** — sibling tickets, superseded tickets, dependencies, PRs.
- **Origin Session ID** — `Origin Session ID: <uuid>` on its own line near the end of the body; optional but highly recommended for genuinely single-session tickets.
- **Handoff Retrieval Hints** — Semantic query patterns (`query_raw_memories`, `query_summaries`) or exact commit-range anchors (**REQUIRED** for architecturally substantive or multi-session tickets; e.g. `Retrieval Hint: "cross-harness MCP singleton cache divergence"`).

### 5.1 Reference Hygiene: Backtick-Escape for Descriptive `#N`

When drafting ticket bodies, read the [reference-hygiene guide](neomjs/neo-agent-brain:learn/agentos/process/reference-hygiene.md): structural issue references stay bare; descriptive prose references use backticks.

## 6. Linkage

- **Epic ↔ sub-issue:** use the `update_issue_relationship` MCP tool to natively link sub-issues to their parent. Do NOT rely on inline Markdown checkboxes (`- [ ] #N`) as the tracking mechanism. Native links feed the Native Edge Graph; Markdown does not.
- **Blocking / blocked-by:** same tool. Sets `blockedBy` / `blocking` fields on the ticket frontmatter after sync.
- **Origin Session ID:** embeds the current session as textual provenance. Complements native linkage by preserving the reasoning trail across swarm instances.

## 7. Pre-Execution Gates

*These gates apply to the commit step (see `AGENTS.md §3`), not ticket creation. However, you must ensure the ticket body is rich enough that a future commit can satisfy Gate 2 (Contextual Completeness) without requiring a separate documentation pass.*

## 8. Anti-Patterns (Non-Exhaustive)

| Anti-pattern | Why it harms |
|---|---|
| `[enhancement]` / `[bug]` / `[epic]` prefix in title | Duplicates label taxonomy; wastes title budget |
| Skeleton body (1-2 sentences) | Breaks A2A — next agent has no context to act on |
| Missing Origin Session ID | Breaks A2A Contextual Bridge; no provenance trail |
| Skipping duplicate sweep | Pollutes Knowledge Base; splits swarm attention |
| Inventing label names | Breaks label taxonomy; causes silent GitHub API rejections |
| Precedent-following without skill check | Propagates anti-patterns from prior sessions |
| Quotation as root cause | Text search tests attribution, not the event |
| Over-fragmentation | one-PR work split into micro-tickets; bundle by default — a split replaces scope, not adds |

## 9. When to Escalate to Discussion Instead

If the "ticket" is really an architectural question, brainstorming, or pre-PR exploration, file a **Discussion**, not an Issue. The `ideation-sandbox` skill covers this path. Issues are for actionable work with a defined success criterion; Discussions are for shaping the question.

## 10. After Creation (Chained MCP Tool Usage)

The `create_issue` tool returns the new issue number. The ownership disposition is decided **at** that call; the rest are typical follow-ups:

- **Ownership at creation:** self-assign, name a `handoff: @handle`, or state `unowned-rationale:`. Prefer `unowned-rationale: Ready for a contributor; maintainers provide planning and review.` for eligible work; direct assignments and urgent delivery remain exceptions. **Self-assign via guarded `manage_issue_assignees` before any tracked edit** (AGENTS.md critical gate 7). Never leave ownership unexplained.
- **`manage_issue_labels(action: 'add', ...)`** — only if the label set needs adjustment post-creation (e.g., label list was incomplete at `create_issue` time). Prefer getting labels right in the initial call.
- **`update_issue_relationship(parent_id: N, child_id: M, type: 'SUB_ISSUE')`** — required when filing sub-issues under an Epic. Native graph linkage only; do NOT rely on inline `- [ ] #N` markdown checkboxes (see §6). Count the parent's subs first (`gh api repos/<r>/issues/N/sub_issues --paginate --jq length`); past ~25, file or link to a successor epic (`epic-create` Procedure 1).
- **Ticket body edits:** Use `update_issue_body` (or `gh issue edit N --body-file <path>`); GitHub remains canonical.
- **Replacement work:** once successor IDs exist, run [same-turn reconciliation](decision-substrate-sweeps.md#same-turn-reconciliation) on the predecessors found by §1a; preserve surviving outcomes before retiring old prescriptions.
- **Picking up the ticket:** If you intend to start working on this newly created ticket immediately, you MUST run the `ticket-intake` skill next (your assignee claim fulfills the primary gate).

Minimize chained calls where possible — a well-formed `create_issue` call with complete `title`, `body`, and `labels` at creation time avoids all of the above except `update_issue_relationship` (which can only run after the issue exists).

## 11. Authorship Respect

**You update your own authored artifacts in place. You never override another author's.**

When editing tickets:
- **Your own:** correct the BODY, incl. ACs. A comment cannot supersede it — reviewers read the body for ACs.
- **Someone else's:** propose via comment; never mutate their body or ACs.
- **Reviewer-RA restatements:** read `neo-agent-skills:pull-request/references/foreign-ticket-restatement.md` (comment-proposal default; claimer-authored in-body sections like intake-derived ledgers stay claimer-updatable).

*Why:* Rewriting someone else's prose causes attribution collapse and breaks Native Edge Graph ingestion.

## 12. Substrate Awareness ("Assume No Private Memory")

When writing tickets, **assume the reader has access to nothing private**. Publish the needed reasoning; Memory Core IDs are provenance, not required private lookups.

**Fair-game citations:**
- Committed repo paths (`learn/...`, `.agents/skills/...`)
- GitHub resources (`#N`, PR URLs, commit SHAs)
- Neo Memory Core session IDs (`Origin Session ID: <uuid>`)

**FORBIDDEN load-bearing citations:**
- Harness-private filenames (e.g., `feedback_*.md` from Claude Code, or private Antigravity stores)
- Local filesystem paths outside the repo
- Machine-specific identifiers
