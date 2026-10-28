# Epic Review Workflow

Authoritative protocol for pre-work review of epics. Epic-review is a skill-gated discipline change, not a mechanical enforcement layer — it runs at agent-pickup moment, produces a structured comment on the epic ticket, and then the agent proceeds with sub-work.

Epic errors have N-sub blast radius. By the time `pr-review` catches drift on sub N, subs 1..N-1 have already pulled in the same wrong assumption. This skill gates at the larger blast radius — catching scope or approach errors *before* any sub work begins, when the cost of pivoting is cheapest.

## 1. When to Invoke

Fire this skill when **either** condition holds:

1. You are about to pick up your first sub from an epic your model-identity has not yet reviewed.
2. A user explicitly asks for an epic review (pre-validation before sub work begins).

**Review artifact cap:** at most two structured `epic-review` comments may exist on an epic across all model-identities. Before posting, count existing epic comments whose header matches this skill's output shape (`Epic Review by ...` or `Epic Review — Stage ... Challenge by ...`). If two already exist, do not post a third structured epic-review.

**Per-agent-per-epic one-shot semantics:** once your model-identity (e.g. `@neo-opus-ada`, `@neo-gemini-pro`) has posted an epic-review comment on epic #N, subsequent sub pickups from #N by the same identity cite the prior review by URL reference rather than re-running this skill.

Different model-identities reviewing the same epic independently is **encouraged only while the two-review cap has an open slot** — cross-model readback of architectural intent is the primary value, but artifact count is bounded. If exactly one epic-review exists, prefer filling the second slot with a different active model-family when a reviewer from that family is available. If the cap is full before your first review, cite the two existing epic-review URLs during sub pickup and proceed with `ticket-intake`; route only unique blockers, corrections, or missing-family-coverage concerns through targeted A2A/commentary rather than a third full review.

If the epic body has materially changed since your prior review (check `updatedAt` vs your comment's timestamp), re-run this skill and update your existing comment when possible. If you cannot update the existing comment, post a replacement only while the two-review cap has an open slot; once the cap is full, add a targeted correction/blocker note instead of a new structured epic-review.

## 2. Pre-Review Context Pull

Before running the six-stage chain, pull the following context:

1. **The epic body.** Use the `mcp_neo-mjs-github-workflow_get_conversation` tool to fetch the live epic issue body and comment thread directly from GitHub.
2. **Existing epic-review comments.** Count structured epic-review comments already present on the epic and identify their model-families when visible. If one slot remains, prefer a reviewer from a not-yet-represented active family; if the cap is full, stop before the six-stage chain and use the cap-full citation path in §5.
3. **All sub-issues under the epic.** Titles, labels, blocking relationships — the epic's frontmatter `subIssues` list is the canonical source. Read each sub's body if sub-structure coherence review (stage 3) will run.
4. **Roadmap alignment.** Query the Memory Core for current strategic direction:
   - `get_context_frontier()` — Golden Path authoritative routing
   - `query_summaries({query: '<epic-subject>'})` — historical session context on the topic
   - `query_raw_memories({query: '<epic-subject>'})` — finer-grained reasoning trails
5. **Duplicate sweep.** Has a similar epic been filed and either closed or superseded? Run `gh search issues --owner neomjs --label epic "<subject>"` and `query_documents(type: 'ticket')` first.

## 3. The Six-Stage Chain

**Ordering is load-bearing.** Stage 1 failure halts all subsequent stages. Stage 2 failure halts stages 2.5-5. An epic that doesn't fit the roadmap should not undergo scope-coherence review — that work is wasted if the epic gets closed or pivoted. Do not short-circuit the gating to "be thorough."

### Stage 1 — Roadmap Fit

**Question:** Does this epic belong in the current strategic direction?

Checks:
- Does it conflict with or duplicate an in-flight epic? (If yes — name the sibling explicitly and propose merge or redirection.)
- Is it premature (depends on unshipped work in another epic)?
- Is it redundant (another epic already covers this work at a different abstraction level)?
- Is it misaligned with Golden Path top-weight nodes?
- Does it represent a strategic pivot without an accompanying discussion or vision doc? (Mid-flight pivots need a Discussion before becoming an Epic.)

**Stop condition:** if stage 1 fails, the comment is a **roadmap-fit challenge**. Do not run stages 2-5. Name the alternative (merge with epic X, postpone until Y ships, reframe as Z) and post the comment. The agent does not pick up subs until the challenge is resolved — either the epic body is updated defending the fit, or the epic is closed/restructured.

### Stage 2 — Approach Elegance

**Question:** Is the main architectural decision load-bearing? Would a more elegant alternative serve the same goal?

Checks:
- **Ideation Sandbox Backstop (Mandatory for Discussion-origin Epics):** if this Epic emerged from a Discussion, verify that the Double Diamond divergence matrix was captured in the Discussion body **before** graduation per `ideation-sandbox-workflow.md` "Double Diamond Divergence Guard", and that ≥1 non-author peer review cycle happened after matrix insertion. **If the matrix is missing, lacks falsifying sources, or was retro-fitted directly into the Epic body, reject the Epic and route divergence back to the Discussion.** Rationale and #11077 anchor: [`../../ideation-sandbox/audits/double-diamond-divergence-guard.md`](../../ideation-sandbox/audits/double-diamond-divergence-guard.md).
- Does the approach **reuse existing substrate**, or does it invent parallel substrate? (Parallel substrate is a strong warning sign — it usually means the author missed a reusable primitive.)
- Is the main abstraction layer the right one? (Same substrate-boundary question as `ticket-intake` prescription challenge, elevated one scope level.)
- Is there a known **Gold Standard** from prior sessions this epic diverges from without rationale? Query Memory Core for comparable epics.
- Does the epic predate, cite, conflict with, or depend on an ADR / Decision Record? If yes, apply the ADR successor-risk audit before passing approach elegance; older epic premises may be superseded by later ADRs, while later evidence must route through an explicit ADR challenge path.
- Does the approach **compound** existing capability, or does it fight against it?
- Is the epic's main decision testable — can it be empirically validated, or is it an unfalsifiable preference?

**Stop condition:** if stage 2 fails (including missing-divergence-matrix on Discussion-origin Epics), the comment proposes one or more **alternative approaches** with rationale OR routes the divergence back to the Discussion. Stages 2.5-5 skip. Agent does not pick up subs until the elegance question is resolved — either the original approach is defended (epic body updated with rationale), the alternative is adopted (epic restructured), OR the upstream Discussion is amended with a proper divergence matrix and re-graduated.

Stage 2 is the most empirically valuable gate. A non-elegant approach that passes structural review can waste N subs worth of effort before `pr-review` catches the foundational issue.

### Stage 2.5 — Source Discussion Criteria Mapping Gate

*(Runs only if stages 1-2 pass and the Epic cites a Discussion origin.)*

<!-- trigger: Epic cites a Discussion origin, Signal Ledger, or [GRADUATED_TO_TICKET] → read ../../epic-resolution/audits/source-discussion-reconciliation-audit.md -->

**Question:** Do the Epic and its live leaf bodies carry every binding enumeration and judged contract from the source Discussion without needing the Discussion to implement or review?

Run the entry pass of [`../../epic-resolution/audits/source-discussion-reconciliation-audit.md`](../../epic-resolution/audits/source-discussion-reconciliation-audit.md):
- **Trigger:** If the Epic cites no Discussion origin, mark N/A and proceed to Stage 3.
- **Enumerable rows first:** Run `node scripts/check-discussion-fidelity.mjs` against the source Discussion and the Epic + live leaf bodies. Every marked `binding-inventory` (exact paths/modules, schemas, API/wire vocabulary) must pass exact set equality; *"materially present"* or folder placeholders fail.
- **Judged rows & Decision Record:** Verify every judged row (ownership, exclusions, sequencing, Decision Record `REQUIRED`/`OPTIONAL`/`NOT_NEEDED` authority) is materially present in the Epic intended solution or exact owning leaf. Link-only, criterion-ID-only, compressed-away, or orphan rows are `LOST`.
- **Receipt:** When Stage 2.5 passes, record `discussion-needed-to-implement: false` (or `discussion-needed-to-implement:false`).

**Stop condition:** Any entry-time `LOST` row or enumerable mismatch requires **REVISIONS_REQUESTED** (blocks Greenlight and first sub pickup; stages 3-5 skip) until the Epic/leaf bodies are corrected. Do not compensate from reviewer memory of the Discussion.

### Stage 3 — Sub-Structure Coherence

*(Runs only if stages 1-2.5 pass.)*

**Question:** Do the subs collectively close the epic's success criteria?

Checks:
- **Coverage**: every item in the epic's acceptance criteria maps to at least one sub that closes it
- **Overlaps**: two subs claiming to deliver the same outcome — flag for merge or scope-split
- **Phase boundaries**: sub N's outputs feed sub N+1's inputs cleanly; no circular `blocked_by` dependencies
- **Missing phases**: a prerequisite sub implied by the arc but not filed (e.g. a migration ticket, a schema ticket, a doc-update ticket)
- **Scope creep risk**: subs whose titles or bodies exceed the parent epic's scope
- **Structural Pre-Flight Sweep**: when subs prescribe new `.mjs` files (new daemon, new service, new script, new helper), validate each prescribed directory against `.agents/skills/structural-pre-flight/SKILL.md` Stage 0/1 BEFORE the sub is picked up. Each sub's PR will eventually have to satisfy this gate; surfacing mismatches at epic-review time is cheaper than at sub-PR-review time. Empirical anchor: M3 epic where sub PR #11008 misplaced `orchestrator-daemon.mjs` in `ai/scripts/` instead of the Brain-owned [v13 path M3 split](https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/v13-path.md) (`ai/scripts/orchestrator-daemon.mjs` thin wrapper + `ai/daemons/Orchestrator.mjs` Neo-class + `ai/daemons/services/`); a Stage-3 sweep at epic-review would have caught the directory-choice mismatch in the prescription before sub pickup.

#### Stage 3.1 — Evidence Matrix Producer Hook (entry side of the closeout contract)

*(Required when any of the epic's acceptance criteria describe observable runtime effect on a surface the CI / agent sandbox cannot reach — i.e., when the Brain-owned [Substrate Evidence Ladder](https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/process/evidence-ladder.md) trigger applies. Mark N/A for epics where ACs are fully covered by unit tests / static contract.)*

The `epic-review` skill is the *entry pass* of the closeout contract; `epic-resolution` is the *exit pass* (sibling skill, runs at sub-closure time). Both consume the same matrix shape on the parent epic body. **Stage 3.1 is where the entry pass SEEDS the matrix** so the exit pass has a contract to reconcile against.

For each parent AC of the epic, Stage 3 must produce columns 1–3 of the shared matrix and seed columns 4–6 as placeholders:

```md
| Parent AC | Required evidence | Owning sub(s) | Delivered PR(s) | Achieved evidence | Residual state |
|---|---|---|---|---|---|
| AC1 (...) | L2 | #NNNN | (pending) | (pending) | (pending) |
| AC2 (...) | L4 | #NNNN, #NNNN | (pending) | (pending) | (pending) |
```

**Required-evidence assignment:** for each AC, classify as L1 / L2 / L3 / L4 per the ladder. L1 = static contract; L2 = mock dispatch; L3 = live non-destructive probe; L4 = operator-gated destructive handoff. If any AC requires L3+ verification on a surface the sandbox can't reach, the matrix MUST mark it explicitly so `epic-resolution` knows operator-handoff residuals are expected at closeout.

**Where the matrix lives:** post the Stage 3.1 matrix as a comment on the epic ticket, OR amend the epic body to include a `## Closeout Matrix (entry-seeded)` section. The closeout pass (`epic-resolution`) reads the most recent matrix-shaped artifact and reconciles columns 4–6 against the actual delivered PRs.

**Cross-reference:** the Brain-owned [Substrate Evidence Ladder](https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/process/evidence-ladder.md) for L1-L4 ladder + sandbox-vs-achievable ceiling distinction + complete schema definitions.

### Stage 4 — Prescription Layer

*(Runs only if stages 1-2 pass.)*

**Question:** For each sub, is the work at the right layer?

Apply the same six-stage challenge chain from `ticket-intake`, but across the sub-graph rather than individual sub:
- **Premise**: is each sub's stated problem real and reproducible?
- **Prescription**: is the fix at the right substrate, or does it treat a symptom?
- **Substrate**: service-layer / framework-core / daemon / documentation / config — right owner?
- **Consumer**: who reads the output — human, agent, Memory Core, Native Edge Graph?
- **Service-boundary**: does any sub cross a boundary it shouldn't (e.g. shipping config to a service that doesn't own the concern)?
- **Decision Record impact**: does any sub depend on, amend, supersede, or challenge an ADR / Decision Record?

You are not running `ticket-intake` on each sub — that runs at sub pickup. You are checking that the sub-graph's prescription layer is architecturally coherent from the epic-level view.

### Stage 5 — Avoided Traps Completeness

*(Runs only if stages 1-2 pass.)*

**Question:** What obvious wrong paths should the epic name as rejected?

Checks:
- Does the epic have an "Avoided Traps" section naming rejected alternatives with rationale?
- Are there common failure modes (e.g., standard industry patterns that don't fit Neo's multi-threaded / Scene-Graph / Memory-Core-native architecture) the epic should preemptively flag?
- Are **training-data anchor drift** candidates (e.g., "Neo is a framework" miscategorization, outdated model-name references, temporal anchors from training data) relevant to this epic's framing?
- Does the epic's approach resemble one that was previously rejected in another session? Memory Core query may surface this.

Missing traps are an **extension opportunity**, not a blocker — flag them in the comment for the epic author to add. Stage 5 never halts downstream work on its own.

## 4. Comment Output Format

Post the review as a comment on the epic ticket using `manage_issue_comment` with action `create` only if the two-review cap is not full. Use the template at `.agents/skills/epic-review/assets/epic-review-comment-template.md` as the structural skeleton.

**Short form** (stage 1, 2, or 2.5 failure):
- Header: `Epic Review — Stage [1|2|2.5] Challenge by [model-identity]`
- Named stage that failed
- Specific challenge or alternative proposal with rationale
- No stage 3-5 content
- Session ID footer

**Long form** (stages 1-2.5 pass; stages 3-5 run):
- Header: `Epic Review by [model-identity]`
- Stage 1 — Roadmap Fit: ✅ with 1-2 sentence rationale
- Stage 2 — Approach Elegance: ✅ with 1-2 sentence rationale
- Stage 2.5 — Source Discussion Mapping: ✅ or N/A
- Stage 3 — Sub-Structure Coherence: findings (gaps/overlaps/boundary issues) or ✅
- Stage 4 — Prescription Layer: per-sub findings or ✅
- Stage 5 — Avoided Traps Completeness: suggested additions or ✅
- Verdict line (Greenlight / Revisions Requested / Block)
- Session ID footer

Use the agent field on `manage_issue_comment` to self-identify: format `"[Model Name] ([Harness])"` — matches the `pr-review` self-identification pattern.

## 5. Per-Agent-Per-Epic One-Shot And Cap-Full Citation

Once your model-identity has posted an epic-review comment, subsequent sub pickups from the same epic by the same identity cite the prior review by URL reference:

> *Previously reviewed this epic: [comment URL]. Proceeding with sub pickup per `ticket-intake`.*

If the epic already has two structured epic-review comments and your identity has not posted one, cite the capped reviews instead of posting a third:

> *Epic-review cap already satisfied by: [comment URL 1], [comment URL 2]. Proceeding with sub pickup per `ticket-intake`; no third structured epic-review posted.*

If both capped reviews are from the same model-family and cross-family coverage is materially needed, do not bypass the cap. Name the missing-coverage concern in a targeted A2A or narrow correction/blocker comment to the epic lead/operator instead of posting a third structured review.

These citations belong in the `ticket-intake` reflection step for the sub, not as a new epic comment.

## 6. Relationship to Sibling Skills

| Skill | When | Scope | Relationship to epic-review |
|---|---|---|---|
| `ticket-create` | Epic/sub birth | Creation-time | Produces the Fat Ticket body evaluated here. |
| `ticket-intake` | Sub pickup | Sub-scope | Runs *after* epic-review on first sub pickup per identity. |
| `pull-request` / `pr-review` | PR open / review | PR-scope | Catches execution drift *after* work; epic-review catches scope/approach drift *before*. |
| `epic-resolution` | Epic closeout | Sub-closure | Exit-pass sibling; reconciles the Stage 3.1 matrix defined in the Brain-owned [Substrate Evidence Ladder](https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/process/evidence-ladder.md) and [`../../epic-resolution/audits/source-discussion-reconciliation-audit.md`](../../epic-resolution/audits/source-discussion-reconciliation-audit.md). |

## 7. Anti-Patterns

| Anti-pattern | Why it harms |
|---|---|
| Running all 6 stages unconditionally | Wastes effort when stage 1 or 2 fails |
| Skipping epic-review because "I read the body" | Cross-model readback requires the comment artifact |
| Picking up an Epic body directly | Epics coordinate; sub-issues are the execution units |
| Re-running per sub or exceeding the 2-review cap | One-shot per identity; cap is 2 per epic (use remaining slot for family diversity) |
| Editing the Epic body instead of commenting, or omitting Session ID | Provenance and Memory Core lookup live in comments |

## 8. Cross-Model Asymmetry

Cross-model review (up to two distinct model-identities per epic) surfaces different dimensions of architectural risk. Do **not** pre-disclose a family-stereotype ("per §8 my family over-flags X") — per-family failure modes are unmeasured (#10756) and carry no authority. Prefer a second reviewer from a different active model-family while a slot is open; once capped, route unique blockers via targeted comments or A2A.

## 9. Verification Before Posting

Before calling `manage_issue_comment`, confirm:

- [ ] Stage ordering respected (1-2 gate 3-5)
- [ ] Short form vs long form matches gating outcome
- [ ] Session ID footer present
- [ ] Comment references epic # correctly
- [ ] Agent field self-identifies per `pr-review` convention
- [ ] No adversarial or "proving-wrong" language — review targets architectural risk, not author competence
- [ ] Verdict line is accurate (Greenlight / Revisions Requested / Block)

If the review is a **Block** or **Revisions Requested**, the agent does not pick up subs from this epic until the blocking concern is resolved. File a follow-up comment or close the epic if the concern is load-bearing.
