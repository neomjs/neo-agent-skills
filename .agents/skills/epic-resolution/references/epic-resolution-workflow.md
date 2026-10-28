# Epic Resolution Workflow

Closeout gate for parent epics. Answers the canonical question: **"we resolved all epic subs, are we done now?"**

Sibling to `epic-review` (which is the *entry* gate at sub-creation time). `epic-resolution` is the *exit* gate at sub-closure time. Both skills share the same matrix shape on the parent epic body — `epic-review` seeds the AC → sub mapping; `epic-resolution` reconciles delivered evidence against required evidence and produces a verdict recommendation.

**Origin:** Discussion #10697 + issue #10698. Empirical anchor: PR #10696 / Epic #10671 cycle, where peer broadcasts of "Epic substrate side complete" went unchallenged despite RESIDUAL_L4 ACs and a BLOCKER sub. Mental model per @tobiu: "turn friction into gold."

## 1. When to invoke this skill

Trigger conditions (any one fires the workflow):

1. **Last required sub closes.** When you merge or observe-merged the final sub linked to an epic, run this workflow on the parent.
2. **Peer broadcasts epic-readiness.** Phrases like "Epic #N substrate side complete," "components look solid," "ready for human handoff" are TRIGGERS for closeout reconciliation, NOT closeouts themselves. Run the workflow before agreeing.
3. **Team member claims completion.** A team member (operator or peer agent) directly states an epic is done.
4. **Before closing an epic as COMPLETED.** Any time you would otherwise post a closure-rationale comment on an epic, run this workflow first.

**Trigger does NOT fire for:** routine sub-merge events that aren't the last required sub; epics where ACs have not been formally articulated; non-epic issues.

## 2. Concurrency guard (epic-closeout discipline-layer mutex)

Before populating the matrix, check whether another agent is already running the closeout for this epic.

**Steps:**
1. Read the recent comments on the epic. If a comment titled `## Epic Resolution Review (in progress)` exists with a timestamp less than 30 minutes old AND from a different agent identity, STOP.
2. If you stopped, A2A the active closeout reviewer with `subject: "Re: Epic #N closeout — joining your review"` and cite the active comment-id. Do NOT post a parallel verdict.
3. If no recent in-progress comment exists, post your own `## Epic Resolution Review (in progress)` comment immediately as a claim, before populating the matrix. The claim comment should be a single line: `Reviewing epic closeout — matrix population in progress. Started by @<your-identity> at <ISO-timestamp>.`
4. Update your in-progress comment to the final verdict comment via `manage_issue_comment` action `update` once the matrix is built. The same comment evolves from claim → verdict.

**Optional primary-owner restriction:** if the epic has an explicit assignee, only the assignee runs the closeout. Other agents detecting the trigger A2A-ping the assignee instead of running the workflow.

## 3. Populate the matrix

The shared matrix shape (used by both `epic-review` entry-pass and `epic-resolution` exit-pass):

```md
| Parent AC | Required evidence | Owning sub(s) | Delivered PR(s) | Achieved evidence | Residual state |
|---|---|---|---|---|---|
```

For each parent AC of the epic:

1. **Parent AC** — quote or reference the AC text from the epic body.
2. **Required evidence** — L1 / L2 / L3 / L4 per the Brain-owned [Substrate Evidence Ladder](https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/process/evidence-ladder.md). The `epic-review` entry pass should have set this; if missing, derive from the AC text (does it require runtime / live / observable behavior?).
3. **Owning sub(s)** — the sub-issue(s) addressing this AC. From the epic's native sub-issue links (`update_issue_relationship` graph) or AC-explicit references.
4. **Delivered PR(s)** — the merged PR(s) closing each sub. Use `gh pr list --search "linked-to:<sub-number>"` or check sub-issue's `closedByPullRequestsReferences`.
5. **Achieved evidence** — read the merged PR body's `Evidence:` declaration. If two ceilings (sandbox vs achievable), report both: `L2 (sandbox) / L4 (achievable)`. If no Evidence declaration, mark as `L?? — declaration missing` and flag in residuals.
6. **Residual state** — one of:
   - `none — closed` (achieved >= required)
   - `RESIDUAL_L<N> — <reason>` (operator handoff window pending, etc.)
   - `BLOCKER` (sub not started, sub failing, evidence below required with no path to close)
   - `RESIDUAL_AC<N> [#<followup-ticket>]` (split-follow-up filed for unproven AC)

## 3.5. Source Discussion Closeout Gate

<!-- trigger: Epic cites a source Discussion, Signal Ledger, or Discussion Criteria Mapping → read ../audits/source-discussion-reconciliation-audit.md -->

**Trigger:** Epic body cites a source Discussion (`Resolves/Graduates from Discussion #N`, `Signal Ledger`, or `## Discussion Criteria Mapping`). **N/A** for standalone Epics with no source Discussion — skip to §4.

Before §4 verdict computation, run the exit pass of [`../audits/source-discussion-reconciliation-audit.md`](../audits/source-discussion-reconciliation-audit.md) alongside §3's matrix:

```md
| Source Discussion criterion | Mode (`enumerable` \| `judged`) | Epic AC / `inventory-id` | Owning sub(s) | Delivered PR(s) | Achieved evidence | Residual / deferral |
|---|---|---|---|---|---|---|
```

1. **`enumerable` rows** (marked `binding-inventory` trees, schemas, API/wire vocabularies): verify exact set equality across source ↔ union(Epic, leaves) via `node scripts/check-discussion-fidelity.mjs` plus delivered PR evidence.
2. **`judged` rows** (ownership, exclusions, sequencing, ADR boundaries): verify material delivery across §3 rows.
3. **Residual / deferral:** `none — delivered via AC<N>`, `EXPLICITLY DEFERRED — <rationale>`, `CONVERTED TO FOLLOW-UP [#<followup-ticket>]`, or `LOST` (unmapped, folder-placeholder, or link/ID-only).

**Verdict integration:** Any `LOST` row blocks `RECOMMEND_CLOSE_COMPLETED` even when all §3 Epic AC rows are green (`RECOMMEND_KEEP_OPEN` if recoverable in existing subs; `RECOMMEND_CREATE_MISSING_SUBS` if new sub needed; or file a retroactive `CONVERTED TO FOLLOW-UP [#N]` ticket if deferrable).

## 4. Compute the verdict

Apply the verdict logic in this order (highest precedence first):

| Condition | Verdict |
|---|---|
| Any source Discussion criterion in `LOST` state per §3.5 Closeout Gate | `RECOMMEND_KEEP_OPEN` (if recoverable in existing subs) OR `RECOMMEND_CREATE_MISSING_SUBS` (if new sub needed) |
| Any row has `BLOCKER` state | `RECOMMEND_KEEP_OPEN` |
| Any row has `RESIDUAL_L<N>` AND no follow-up ticket exists | `RECOMMEND_CREATE_MISSING_SUBS` |
| All rows are `none — closed` OR `RESIDUAL_<X> [#<followup-ticket>]` (residuals tracked elsewhere) AND §3.5 Closeout Gate passes or is N/A | `RECOMMEND_CLOSE_COMPLETED` |
| Epic's purpose has been superseded by another effort, later ADR / Decision Record authority, or the AC framing is no longer valid | `RECOMMEND_RETIRE_OR_SUPERSEDE` |

If an epic closeout hinges on ADR chronology, apply the ADR successor-risk audit before computing the verdict. The closeout comment must name the related ADR, whether it supersedes the epic or requires a challenge/amendment path, and the public evidence that supports the route.

**Verdict authority:** the review is the gate, and the reviewer takes the terminal action its verdict names. Only `gh pr merge` is human-only (§0 Invariant 1). An issue close reopens with one click and is a maintainer act (operator, 2026-05-10 and 2026-10-28). Empirical anchors: neomjs/neo#10691 sat seven days past a clean verdict, and neomjs/neo-stage#26 waited on a retire close.

- **`RECOMMEND_CLOSE_COMPLETED`** (zero unresolved residuals): close the epic with `gh issue close --reason completed`.
- **`RECOMMEND_RETIRE_OR_SUPERSEDE`**: name what changed and what supersedes the epic, and run the [intent check](../../ticket-create/references/decision-substrate-sweeps.md#same-turn-reconciliation). Then close it as not planned with those links. Its open subs move to a live parent or close the same way.
- **`RECOMMEND_CREATE_MISSING_SUBS`**: list each gap (which AC, what evidence is missing) with a proposed owner, or A2A the team to volunteer. An owner who accepts files via `/ticket-create`.
- **`RECOMMEND_KEEP_OPEN`**: no terminal action. The review names the blockers and residuals for their owners.

## 5. Post the verdict comment

Update your `## Epic Resolution Review (in progress)` comment to the final shape via `manage_issue_comment` action `update`:

```md
## Epic Resolution Review

**Reviewer:** @<your-identity>
**Started:** <ISO-timestamp> (in-progress claim)
**Completed:** <ISO-timestamp>
**Verdict:** RECOMMEND_<CLOSE_COMPLETED | KEEP_OPEN | CREATE_MISSING_SUBS | RETIRE_OR_SUPERSEDE>

### Matrix

| Parent AC | Required evidence | Owning sub(s) | Delivered PR(s) | Achieved evidence | Residual state |
|---|---|---|---|---|---|
| ... | ... | ... | ... | ... | ... |

### Rationale

<2-4 paragraphs explaining the verdict. For KEEP_OPEN: which residuals/blockers + path to close. For CREATE_MISSING_SUBS: enumerate gaps + proposed owners. For RETIRE: superseding artifact. For CLOSE_COMPLETED: confirmation that all residuals are tracked elsewhere.>

### Terminal action

<What the review did: closed as completed; closed as not planned, with the superseding links; gaps offered to named owners; or none (keep open).>

### A2A coordination

<List peers A2A'd, with subject + commentId for the audit trail.>

Origin Session ID: <your session UUID>
```

## 6. A2A peer coordination

After posting the verdict comment, A2A the relevant peers:

- For `RECOMMEND_CLOSE_COMPLETED`: A2A all agents who had subs in the epic, FYI of the closure.
- For `RECOMMEND_KEEP_OPEN` with BLOCKER: A2A the blocked sub's owner with the blocker rationale + ask whether they need help unblocking.
- For `RECOMMEND_CREATE_MISSING_SUBS`: A2A proposed owners with the gap + ask whether they accept ownership.
- For `RECOMMEND_RETIRE_OR_SUPERSEDE`: A2A the superseding effort's owner with the link.

Per `feedback_a2a_commentid_pre_flight`: post the verdict comment FIRST, capture the literal commentId, THEN compose the A2A messages with the literal commentId substituted.

## 7. Cross-references

- Brain-owned [Substrate Evidence Ladder](https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/process/evidence-ladder.md) — L1-L4 definitions + matrix schema authority
- [`../audits/source-discussion-reconciliation-audit.md`](../audits/source-discussion-reconciliation-audit.md) — shared entry/exit source-Discussion reconciliation contract
- `.agents/skills/epic-review/`, `.agents/skills/pr-review/`, `.agents/skills/pull-request/`, `.agents/skills/ticket-create/`
- Discussion #10697 + Issue #10698 — origin and graduation artifact
