# Ticket Create Workflow

The authoritative protocol for creating Neo.mjs GitHub issues. Enforced before any `create_issue` MCP tool invocation. This is the creation-side dual of `ticket-intake` (which consumes existing tickets).

Tickets are **A2A (Agent-to-Agent) memory bridges**, not just human tracking artifacts. A poorly-formed ticket loses architectural context the Swarm will re-derive every session. Every rule below exists because an earlier session re-derived the discipline and got it wrong.

## §0 — Understand the intent before you write the ticket

Before the duplicate sweep or the Fat-Ticket body: is this the right work — does it fit the current architecture and goals? Understand what it's *for* (from the affected files and their neighbors / imports — intent belongs in their JSDoc, `src/core/Base.mjs` is the bar — plus `memory-mining` / `ask_knowledge_base`) before you structure it. A perfectly-formed ticket for the wrong work is still the wrong work. If the intent it relies on is documented nowhere, that gap is itself worth a ticket.

A ticket that calls an existing behavior wrong carries its `Design authority:` line before The Fix exists — the rule: [`design-authority.md`](design-authority.md).

## 1. Pre-Authoring Adjacency Sweeps (Gate 0)

**Before drafting any title or body**, you MUST execute the applicable sweeps below to ensure swarm synchronicity and architectural discipline:

### 1a. The Content Sweep (Duplicate Detection)
Verify no equivalent ticket or closed exclusion already exists. Redundant tickets pollute the Knowledge Base.

Duplicates hide in **two substrates**; sweep **both as the LAST step immediately before `create_issue`** — never at turn-start or before drafting. A pre-draft sweep goes stale while you write the Fat Ticket: in a thundering herd, a peer's ticket can land between your sweep and your `create_issue` call. The turn-start mailbox check (`§mailbox_check_protocol`) is for general coordination, **not** the dup gate.

**(i) GitHub live freshness + closed-state sweep (mandatory) — catches already-FILED duplicates and closed rulings:** read at least the latest 20 open GitHub issues from the live tracker (issue number, title, author, labels, URL) and query closed state on the problem's nouns:

```bash
gh issue list --state open --limit 20 --json number,title,author,labels,url
gh issue list --state closed --search "<problem nouns>" --limit 15
```

Read the `Out of Scope` and `Avoided Traps` sections of any same-surface closed hit — a closed ticket's title rarely reveals that it governs adjacent scope, and a closed hit answers what was already decided, never whether the premise matters (`neomjs/neo#18308` zero-backwards-compatibility ruling while `#18537` still closed `not_planned`, `neomjs/neo#18399` `Out of Scope` exclusion, `neomjs/neo#16391` / PR `#16403` already-shipped `hasLandedInPlace`). An equivalent MCP call for the open page is acceptable only when live AND created-descending (`list_issues` with `sort: 'created'`); updated-descending is supplemental because it buries untouched fresh filings (`#15603`). Both runs are required even when KB and local searches return no hits.

If live GitHub state cannot be fetched due to sandbox, network, or auth state, retry through the approved path; if still unreachable, stop before `create_issue` and report the blocker rather than filing from stale evidence.

Record both on the same attestation line in the ticket body, e.g. `Live latest-open + closed sweep: checked latest 20 open + closed search (<problem nouns>, Out of Scope / Avoided Traps read on hits) at <timestamp>; no equivalent or prior exclusion found` (or link the existing ticket instead of filing).

**(ii) A2A in-flight claim sweep (mandatory) — catches IN-FLIGHT duplicates not yet on GitHub:** in a thundering herd a peer's intent first exists only as an A2A `[lane-claim]`/`[lane-intent]` invisible to `(i)`. Immediately before `create_issue`, scan the mailbox for recent claims on the same scope:

```js
list_messages({ status: 'all', limit: 30 })  // ALL read-states — recency is the bound, not read-status
```

**Filter by recency + scope, NOT read-status.** A `[lane-claim]` already marked read during turn-start mailbox triage is still an active claim — `status: 'unread'` hides it and causes duplicate filing (read-status tracks consumption, not relevance). Keep messages whose `sentAt` falls in the herd window (~last 30–60 min) **and** whose `[lane-claim]`/`[lane-intent]` subject overlaps your scope (`taggedConcepts: ['lane-claim']` is optional; subject-scan stays primary).

**Tiebreak — first-claim-timestamp-wins:** the **earliest claim/file timestamp wins**, and an earlier *unfiled claim* outranks a later *filed ticket*. The later party stands down; if it already filed, it closes its duplicate and ports unique substance onto the survivor (earlier claimant absorbs later filer's content, **not** the reverse). A contested-lane resolution MUST set `wakeSuppressed: false` — claim-class is quiet by default (#15987), so omitting it leaves the signal mailbox-only.

**(iii) Memory Core rationale sweep + (iv) own-assignment sweep (both mandatory):** `(i)` and `(ii)` are **artifact** substrates — combine them with one `query_raw_memories` keyed on the **problem's** nouns (observed symptom, never proposed mechanism) and `gh issue list --state open --assignee @me` reading the **bodies** of same-surface hits. Both attest in the body beside `(i)`.

**(v) Epic-layer sweep (epic-labeled filings only, mandatory):** read every open `label:epic` issue's `Terminal predicate:` line, run `gh issue list --label epic --state closed --search "<outcome nouns>"` to read the predicate or body opening of same-outcome closed epics, body-read what an outcome-overlap query ranks, and attest beside `(i)`.

<!-- trigger: filing a ticket, filing an EPIC, or a defect found while measuring something else -> read ./decision-substrate-sweeps.md (query shape, the epic sweep, attestation lines, same-turn porting, the #17997 / #12856 anchors) -->
<!-- trigger: load-bearing population count or absence claim justifying premise, scope, or acceptance -> read ../../pr-review/references/reviewer-instrument-audit.md (role-triggered publish-safe instrument receipt; routine receipts and CI totals exempt) -->

Semantic sweep: `ask_knowledge_base(query='...', type='ticket')` — surfaces conceptual duplicates that title scanning misses; its rows come from the `github-content-sync` tenant.
Exact/historical sweep: `query_documents` (issues, archived issues, discussions) or a live `gh search issues --owner neomjs "<keyword>"`.

If an equivalent ticket or a prior decision exists: do NOT file a duplicate. Comment on the existing ticket, extend its scope, or reject the new request — and if the content belongs on a parent, comment it onto that parent **in the same turn**.

### 1b. The Meta-Skill Sweep (Progressive Disclosure)
If the proposed ticket involves modifying any agent skill (i.e., any file within `.agents/skills/`), you MUST explicitly consult `.agents/skills/create-skill/SKILL.md` before finalizing the ticket body.
**Pre-flight check:** *Have I verified this proposal adheres to the Progressive Disclosure routing pattern and does not bloat the top-level SKILL.md router?*

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

For source anchors (`#11078` / `#11082` / `#11083` / `#11084`), Discussion `#11091` authority context, and substrate-decay review, read [`../../ideation-sandbox/audits/double-diamond-divergence-guard.md`](../../ideation-sandbox/audits/double-diamond-divergence-guard.md).

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

Apply the same importance weighting used by PR review at creation time: premise / right thing to build = 30%; substrate / what belongs where = 30%; deliverable correctness = 30%; AC and evidence checklist sanity = 10%. These are importance-to-verdict weights, not drafting effort budgets. A perfectly detailed AC list for the wrong work or wrong owning substrate still fails the ticket.

Apply at creation time — not just at intake. Every stage must pass before the ticket is drafted.

1. **Premise** — is the stated problem real and reproducible? Has the underlying symptom been independently verified, or is it secondhand?
2. **Prescription** — is the stated fix the right substrate for the problem, or does it treat a symptom? Could a different layer (config, service, daemon, schema) solve it better?
   **Verify-Before-Assert Integration:** Before making architectural claims or prescribing solutions in your Fat Ticket body (Stage 2 Prescription), you MUST apply the **Verify-Before-Assert Pre-Flight Check** (`AGENTS.md` §verify_before_assert). You cannot assert that a bug exists or a pattern is flawed without empirical confirmation (a falsifying tool call) prior to filing the ticket.
3. **Substrate** — where does this work belong? Service layer? Build script? CI workflow? Framework core? Documentation? Match the fix to the substrate that owns the concern.
   **Structural Pre-Flight Integration:** when the prescription introduces or relocates a `.mjs` file, validate the directory choice via `.agents/skills/structural-pre-flight/` before drafting the ticket body (Stage 0 mechanical trigger; Stage 1 30s sibling-match fast-path; full Pre-Flight for novel directory choices; anchors: PR `#11008` `orchestrator-daemon.mjs`, `ai/daemons/wake/daemon.mjs`).
4. **Consumer** — who reads the output of this change? Human developer, agent, Memory Core, Native Edge Graph, Knowledge Base? Different consumers need different shapes (markdown prose vs structured metadata vs MCP payload).
5. **Service-Boundary** — does the fix cross a service boundary it shouldn't? Config added to the wrong owning service creates future migration debt.
6. **Decision Record impact** — for architecture/substrate tickets, declare whether the work is `none`, `aligned-with`, `depends-on`, `amends`, `supersedes`, or `challenges` an ADR. If it challenges or supersedes an accepted ADR, apply the ADR successor-risk audit in [`../../ticket-intake/references/adr-successor-risk-audit.md`](../../ticket-intake/references/adr-successor-risk-audit.md) before filing.

A ticket that fails any stage should be reshaped OR rejected, not filed.

## 3. Title Hygiene

**Titles describe the subject, not the category.** Category lives in labels.

- ❌ `[enhancement] Add config for X`
- ❌ `[bug] Y fails when Z`
- ❌ `[epic] Modernize W`
- ✅ `Add config for X`
- ✅ `Y fails when Z`
- ✅ `Modernize W`

The `[enhancement]` / `[bug]` / `[epic]` prefix duplicates the label taxonomy — it also eats title budget. Use the budget for subject specificity instead.

Keep titles under ~70 characters. PR titles derive from ticket titles; length discipline compounds.

## 4. Label Rules

**Most new non-critical standalone tickets our agents create: `good first issue` + `ai`.**
First-time does not mean novice: frontier models with public contributor instructions and
npm-installed skills can implement features, fixes and refactors without private Memory Core.
Do not restrict them to trivial tests. Prepare public context and verification criteria (§5/§12).
Exclude urgent/critical, unresolved, private-dependent or already-owned work; say why.
Honor first-time-only conventions with `help wanted` for returning contributors.

- **`ai` — required on agent-created tickets, including trivial ones.** Provenance, not difficulty or a maintainer claim.
- **Primary — exactly one:** `epic`, `enhancement`, or `bug`. **Choosing it:** a standalone must be one-PR-resolvable — one `Resolves`, so a second PR closes it early or fails the lint. Bigger → **split**, or `epic` only when leaves coordinate toward one shared outcome (`epic-create` Procedure 1).
- **Secondary — as applicable:** `architecture`, `performance`, `regression`, `refactoring`, `documentation`, `testing`, plus domain labels (`core`, `grid`, `build`, etc.).
- Before filing: call `list_labels` to confirm the labels exist. Do not invent label names.

## 5. Fat Ticket Body Structure

Skeleton tickets are forbidden — so are world atlases: sections complete, each fact once, derivations linked (#16528). Every ticket body MUST contain:

- **Context** — why this exists and its evidence. Incident tickets name the observed operation when known, mark unknowns, and separate observation from inference; quotations are leads, not causes. *(Retire with §8 once lint enforces this without syntax proxies.)*
- **The Problem** — deep background, insights from recent Memory Core explorations, reproducer if applicable. Historical "why" for the agent picking up the ticket later.
- **The Architectural Reality** — exactly which Neo.mjs patterns, class topologies, or service boundaries this issue interacts with. Cite file:line when known. Distinguishes intent-level framing (Problem) from structural specificity (Reality).
- **The Fix** — concrete prescription: files, symbols, architectural primitives touched. What changes, and where.
- **Contract Ledger Matrix** *(when applicable)* — For any ticket introducing, modifying, or deprecating a surface consumed by humans, agents, or external systems (public methods, configs, MCP tools), include a formal Contract Ledger matrix (Target Surface, Source of Authority, Proposed Behavior, Fallback, Docs, Evidence). Rows naming existing surfaces must satisfy the row-level Surface-Anchor V-B-A discipline in the [Contract Ledger protocol](https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/process/contract-ledger.md) before the ticket asserts them.
- **Decision Record impact** *(architecture/substrate tickets)* — the §2 step-6 declaration (`none` … `challenges <org>/<repo>#adr:<slug>` or same-repo `adr:<slug>`).
- **Decision Record** *(Discussion-origin tickets)* — Preserve the source Discussion's ADR classification when present: `Not needed`, `Optional: <ADR/ticket/discussion anchor>`, or `Required: <org>/<repo>#adr:<slug> / PR #N / ticket #N` (records the graduation's authority target; `Decision Record impact` records what this ticket itself does to ADR authority).
- **Discussion Criteria Mapping** *(when graduating from a Discussion)* — Maps the upstream Discussion's `[RESOLVED_TO_AC]` criteria to this Epic's ACs (`ideation-sandbox-workflow.md §6.6`), satisfying `epic-resolution` Closeout Gates upfront.
- **Acceptance Criteria** — bulleted checklist; each item independently verifiable, post-merge-only items flagged. **Epic exception:** for `epic`-labeled tickets, ACs live in the **SUB** tickets (author per `.agents/skills/epic-create/`: problem-scope + intended-solution; subs linked via `update_issue_relationship`, each one-PR-deliverable).
- **Out of Scope** — what this ticket deliberately does NOT do.
- **Avoided Traps** / **Gold Standards Rejected** *(when applicable)* — alternatives considered and rejected with rationale (especially generic LLM/React patterns that fail in Neo.mjs's multi-threaded architecture).
- **Related** — sibling tickets, superseded tickets, dependencies, PRs.
- **Origin Session ID** — `Origin Session ID: <uuid>` on its own line near the end of the body; optional but highly recommended for genuinely single-session tickets.
- **Handoff Retrieval Hints** — Semantic query patterns (`query_raw_memories`, `query_summaries`) or exact commit-range anchors (**REQUIRED** for architecturally substantive or multi-session tickets; e.g. `Retrieval Hint: "cross-harness MCP singleton cache divergence"`).

### 5.1 Reference Hygiene: Backtick-Escape for Descriptive `#N`

When drafting ticket bodies, read the [reference-hygiene guide](https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/process/reference-hygiene.md): structural issue references stay bare; descriptive prose references use backticks.

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
- **Ticket body edits:** Update GitHub directly with `gh issue edit N --body-file <path>` (or the equivalent live GitHub write surface). GitHub remains canonical; scheduled mirroring may lag.
- **Replacement work:** once successor IDs exist, run [same-turn reconciliation](decision-substrate-sweeps.md#same-turn-reconciliation) on the predecessors found by §1a; preserve surviving outcomes before retiring old prescriptions.
- **Picking up the ticket:** If you intend to start working on this newly created ticket immediately, you MUST run the `ticket-intake` skill next (your assignee claim fulfills the primary gate).

Minimize chained calls where possible — a well-formed `create_issue` call with complete `title`, `body`, and `labels` at creation time avoids all of the above except `update_issue_relationship` (which can only run after the issue exists).

## 11. Authorship Respect

**You update your own authored artifacts in place. You never override another author's.**

When editing tickets:
- **Your own:** correct the BODY, incl. ACs. A comment cannot supersede it — reviewers read the body for ACs.
- **Someone else's:** propose via comment; never mutate their body or ACs.
- **Reviewer-RA restatements:** read `../../pull-request/references/foreign-ticket-restatement.md` (comment-proposal default; claimer-authored in-body sections like intake-derived ledgers stay claimer-updatable).

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
