# PR Review Follow-Up — exceptional verdicts only

**Ordinary Round 2 does not use this template.** It uses `pr-review-round-2-template.md` (prior-action
disposition plus final metrics on approval). This asset is only for a validated **Drop+Supersede** or a
guarded **repair-minted re-entry** whose four-field receipt has been accepted.

**Status:** [Drop+Supersede / Request Changes (repair-minted re-entry)]

**Opening:** [One concise sentence naming the prior review state and why this round is exceptional.]

---

### 🧭 Patch-Blind Premise Snapshot

*For follow-ups, ground the expected shape in the prior review anchor plus the current delta. Do not let the author's response framing replace the source-of-authority substrate.*

*   **Inputs Read Before Patch:** [Prior review anchor / author response / changed-file list / current `dev` source / source-of-authority substrate checked before treating the delta as evidence.]
*   **Expected Solution Shape:** [1-3 sentences naming the expected delta shape, what boundary this must NOT hardcode, and what test isolation should exist.]
*   **Patch Verdict:** [Matches / improves / contradicts the expected shape, with the evidence that confirmed or changed your premise.]
*   **Premise Coherence:** [Does this delta's premise cohere with our core values — verify-before-assert · friction→gold · flat-peer-team · no-hold · the two-hemisphere organism? A specific verdict naming the value ("coheres: ..." / "conflicts: ..."), NOT a bare yes/no. OR a scoped "N/A — no value-surface (scope: ...)". A green checklist over a wrong premise is theater.]

---

### 🪜 Strategic-Fit Decision

Per §9 Strategic-Fit Step-Back:
- **Decision**: [Approve / Approve+Follow-Up / Request Changes / Drop+Supersede]
- **Rationale**: [1-2 sentences on why this meta-decision fits the current delta context. Treat Approve+Follow-Up as the worst normal outcome, not a convenient residual bucket.]

**Required only when Decision is Drop+Supersede:**

- **Disposition:** [implementation-off | ticket-prescription-off | ticket-premise-dead]
- **Source-coordinate falsifiers:** [exact paths/lines/anchors proving the premise failure]
- **Salvage map:** [what is reusable, where it lands, and what is discarded]
- **Successor landing pad:** [ticket / amended ticket / closure artifact]
- **Successor map citation:** [successor URL or anchor that cites this salvage map]

---

### ⚓ Prior Review Anchor

*   **PR:** #[PR Number]
*   **Target Issue:** #[Issue Number]
*   **Prior Review Comment ID:** [commentId / URL / N/A]
*   **Author Response Comment ID:** [commentId / URL / N/A]
*   **Latest Head SHA:** [short SHA]
*   **Origin Session ID:** [Neo Memory Core UUID, not harness/task/transcript]

---

### 🔁 Delta Scope

Summarize what changed since the prior review:

*   **Files changed:** [list files, or "PR body only"]
*   **PR body / close-target changes:** [pass / changed / N/A]
*   **Branch freshness / merge state:** [clean / stale / unknown]

---

### ✅ Previous Required Actions Audit

For each prior Required Action, mark the current state:

*   **Addressed:** [prior RA text] — [evidence: file/commit/comment]
*   **Still open:** [prior RA text] — [remaining gap]
*   **Rejected with rationale:** [prior RA text] — [author rationale + reviewer assessment]

---

### 🔬 Delta Depth Floor

*Retained for exceptional verdicts only.*

*   **Delta challenge:** [the concern that makes this verdict exceptional]

OR

*   **Documented search:** *"I actively checked [surface], [prior blocker], and [close-target] before reaching this verdict."*

---

### 🔬 Premise Falsifiers

*For Drop+Supersede, record the premise-failure evidence and reusable salvage.*

*   **Source-coordinate falsifiers:** [exact paths/lines/anchors, already listed under Strategic-Fit; restate only what a reader needs here]
*   **What survives:** [the salvage, so the successor inherits it rather than rediscovering it]

---

### 📊 Metrics Delta

Self-contained values are required (never bare `unchanged from prior review`) so graph ingestion reads every follow-up review standalone.

*   **`[ARCH_ALIGNMENT]`**: [0-100] - [Current score + reason (e.g. `92 - up from 60: boundary fixed`)]
*   **`[CONTENT_COMPLETENESS]`**: [0-100] - [Current score + reason]
*   **`[EXECUTION_QUALITY]`**: [0-100] - [Current score + reason]
*   **`[PRODUCTIVITY]`**: [0-100] - [Current score + reason]
*   **`[IMPACT]`**: [0-100] - [Current score + reason]
*   **`[COMPLEXITY]`**: [0-100] - [Current score + reason]
*   **`[EFFORT_PROFILE]`**: [Quick Win | Heavy Lift | Maintenance | Architectural Pillar] - [Current profile + reason]

---

### 📋 Required Actions

**For follow-ups with new or remaining required actions:**

To proceed with merging, please address the following:

*   [ ] Item 1
*   [ ] Item 2

**For zero-issue follow-ups:**

No required actions — eligible for human merge.

---

### 📨 Hand-Off

The formal review state is the hand-off (`pr-review-guide.md` §10).
