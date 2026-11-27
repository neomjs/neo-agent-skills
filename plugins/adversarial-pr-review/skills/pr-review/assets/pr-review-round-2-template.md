# PR Review — Round 2 (disposition only)

**Status:** [Approved / Approve+Follow-Up / Comment]

*Exactly one, and your table picks it: any `STILL_OPEN` row ⇒ `Comment`. Request Changes is not a Round-2 status — a discharged round approves, an open one comments.*

**Opening:** [One sentence: which prior actions this dispositions, at which head.]

### ⚓ Anchor

*   **PR / Target Issue:** #[PR] / #[Issue]
*   **Round-1 Review ID:** [reviewId or URL] · **Author Response:** [commentId or URL]
*   **Head under review:** [short SHA]
*   **Origin Session ID:** [Memory Core UUID — its own line, and the full UUID; provenance is checked mechanically across every documented review format]

### 📋 Disposition

One row per Round-1 required action (a micro review's Findings too), **quoted verbatim** — no re-wording, no re-ordering, no additions.

| # | Required Action (verbatim from Round 1) | Disposition | Evidence |
|---|---|---|---|
| RA-1 | [exact prior text] | ADDRESSED / DEFENDED / STILL_OPEN | [file:line, commit, or the author's rationale you accepted] |

*   **ADDRESSED** — the action is discharged; name where.
*   **DEFENDED** — the author argued it should not be done and you accept the argument. Record the argument, not just the outcome.
*   **STILL_OPEN** — the original Round-1 review stays authoritative for this item. It does **not** become a new action list, and the item keeps its original number.

### 📊 Final Evaluation Metrics

On `Approved` / `Approve+Follow-Up`, use the [rubric and decile anchors](../references/pr-review-guide.md#3-structural-evaluation-metrics) for this head. On `Comment`, omit this section. After a Micro-Review, write `N/A — Cycle 1 was Micro-Review`.

| Metric and value | Evidence at this head |
|---|---|
| **`[ARCH_ALIGNMENT]`**: [0-100] | [Reason] |
| **`[CONTENT_COMPLETENESS]`**: [0-100] | [Reason] |
| **`[EXECUTION_QUALITY]`**: [0-100] | [Reason] |
| **`[PRODUCTIVITY]`**: [0-100] | [Reason] |
| **`[IMPACT]`**: [0-100] | [Reason] |
| **`[COMPLEXITY]`**: [0-100] | [Reason] |
| **`[EFFORT_PROFILE]`**: [profile] | [Why this profile fits the whole PR] |

### 🔚 Verdict

[Approve · Approve+Follow-Up (only if it passes the standalone-ticket counterfactual) · **COMMENT** if any item is STILL_OPEN]

The formal review state is the hand-off (`pr-review-guide.md` §10); send no DM.

---

Keep the disposition scoped to the original actions (§6.2–§6.3). Skip the premise snapshot, Depth Floor and new action checklists.

🖖 Sign with your Social Name, model, harness, and Memory Core session id.
