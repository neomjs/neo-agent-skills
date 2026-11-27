# PR Review Summary

**Status:** [Approved / Approve+Follow-Up / Request Changes / Drop+Supersede / Comment]

*Cycle-1 reviewers: run the §0 premise catalog AND line 1 of `🏛️` BEFORE any defect audit. A firing row ends the review at one premise Required Action — **Drop+Supersede** by default — never an iteration list.*

### 🪜 Strategic-Fit Decision

Per §9 Strategic-Fit Step-Back:
- **Decision**: [Approve / Approve+Follow-Up / Request Changes / Drop+Supersede]
- **Rationale**: [Firing §0 catalog row or "no row fires", plus why this shape wins (`Approve+Follow-Up` is last resort; debt-creating shortcuts get `Request Changes` or `Drop+Supersede`).]

**Required only when Decision is Drop+Supersede:**

- **Disposition:** [implementation-off | ticket-prescription-off | ticket-premise-dead]
- **Source-coordinate falsifiers:** [exact paths/lines/anchors proving the premise failure]
- **Salvage map:** [what is reusable, where it lands, and what is discarded]
- **Successor landing pad:** [ticket / amended ticket / closure artifact]
- **Successor map citation:** [successor URL or anchor that cites this salvage map]

**Peer-Review Opening:** [Thanks naming what landed well. For external/first-time contributors, include canonical pointers: what Neo is, touched subsystem, how to run it, next pickup.]

**Self-Review Opening:** [Clinical first-person assessment: approach, rejected alternative, trade-offs, and gaps.]

*(Use exactly one opening per guide §2.3.)*

---

### 🧭 Patch-Blind Premise Snapshot

*Source from substrate inputs below, never the PR's self-description.*

*   **Inputs Read Before Patch:** [Ticket (`Design authority:` first on behavior changes), changed-file list, base `dev` source, verified siblings, owning ADR/guide.]
*   **In Practice:** [Real-run or public-flow receipt for the handled state (guide §0), or scoped `N/A — no handled state`. None ⇒ Premise-invalid.]
*   **Expected Solution Shape:** [1–3 sentences: owning surface, simplest idiomatic shape, what boundary NOT to hardcode, required test isolation.]
*   **Patch Verdict:** [Matches / improves / contradicts expected shape, citing exact diff/source evidence.]
*   **Premise Coherence:** [Specific verdict against verify-before-assert · friction→gold · flat-peer-team · no-hold · two-hemisphere organism, or scoped `N/A — no value-surface (scope: …)`.]

---

### 🕸️ Context & Graph Linking
*   **Target Epic / Issue ID:** Resolves #[Issue Number]
*   **Related Graph Nodes:** [Related node IDs or conceptual tags]
*   **Origin Session ID:** [Neo Memory Core UUID, not harness/task/transcript]
- [ ] PR body attribution: `Authored by …` is the only attribution; no harness-appended backlink.

---

### 🔬 Depth Floor

**Challenge OR documented search (per guide §7.1 — provide ONE):**

- **Challenge**: [Weakness, unverified assumption, edge case, or follow-up concern — even if non-blocking.]
- **Documented search**: *"I actively looked for [thing 1], [thing 2], and [thing 3] and found no concerns."*

**Rhetorical-Drift Audit (per guide §7.4; N/A when no architectural prose/JSDoc/`[RETROSPECTIVE]`):**

- [ ] PR description: framing matches what the diff substantiates (no overshoot)
- [ ] Anchor & Echo summaries: durable codebase terms; no ticket/PR/AC/line-number archaeology
- [ ] `[RETROSPECTIVE]` tag & linked anchors: match shipped scope and cited authority

**Findings:** [Pass / specific drift Required Action / N/A]

---

### 🧠 Graph Ingestion Notes

*   **`[KB_GAP]`**: [Framework concepts misunderstood or undocumented, or N/A]
*   **`[TOOLING_GAP]`**: [Tooling, test-runner, or MCP friction hit, or N/A]
*   **`[RETROSPECTIVE]`**: [Durable architectural takeaway or praise]

---

### 🧱 Conciseness Rule — Collapsed-N/A Audits

When 2+ audit dimensions below evaluate **N/A**, collapse only the N/A emoji subset (expand every non-N/A audit individually):

```
### N/A Audits — 🏛️ 📑 🪜 📡 🔗 🧪
N/A across listed dimensions: <one-line PR-scope justification>.
```

---

### 🏛️ Neo Class & Engine Idiom Audit

*(Required per guide §7.5.1 when touching Neo classes, instances, reactive state, stateful owners, or VDOM engine paths in any dir; mark N/A for pure data-plane / non-class diffs.)*

- [ ] **Pre-branch Class Contract Ledger (line-1 gate — halt immediately with 1 premise Required Action if missing or post-hoc):** for any new or newly public `src/**` class, the close-target ticket's `## Contract Ledger` defines its class contract (configs + reactivity rationale, declared child `[mergeFrom]` hooks, events, subclass customization seam), AND the issue revision timestamp (GraphQL `issue { createdAt userContentEdits { nodes { editedAt diff } } }`) that **introduced or last modified that class contract** precedes the branch's first commit (`git log --reverse --format=%aI origin/dev..HEAD | head -1`) — ignore later unrelated typo/prose edits elsewhere on the ticket (`N/A` when no new/promoted `src/**` class)
- [ ] **`core.Base` / `Neo.mjs` & parent-default diff:** extends the matching primitive, omits unchanged ancestor `static config` defaults, batches multi-config live writes via `set({...})`, and resolves instances via `Neo.get`/`getReference` (`audits/core-idiom-audit.md`)
- [ ] **`[isDescriptor]` / `[mergeFrom]` & `StateProvider` fitness:** composite components expose keyed `items` + `[mergeFrom]` child descriptors (`src/app/content/Container.mjs` exemplar) rather than custom `mergeConfig()`/`createItems()` overrides, and bind shared view state via `state.Provider`
- [ ] **`.github/CODING_GUIDELINES.md` & extensibility:** logic lives on public/`@protected` class methods (no `#private` methods blocking subclass/`Neo.overwrites` seams; `let me = this` only when `this` > 2× in bundled code), and JSDoc expands multiline blocks for array/object defaults and `@reactive`/`@protected` tags (§12)
- [ ] **VDOM engine gate:** diffs touching `src/vdom/**`, `src/util/vdom/**`, `src/worker/VDom.mjs`, `src/manager/VDomUpdate.mjs`, `src/mixin/VdomLifecycle.mjs`, or `src/main/DeltaUpdates.mjs` align with [VDOM Engine Overview](neomjs/neo:learn/guides/vdomengine/Overview.md) ([AppWorker](neomjs/neo:learn/guides/vdomengine/AppWorker.md), [VdomWorker](neomjs/neo:learn/guides/vdomengine/VdomWorker.md), [MainThread](neomjs/neo:learn/guides/vdomengine/MainThread.md)) and [ADR 0043](neomjs/neo:learn/agentos/decisions/0043-vdom-diff-placement.md) (`N/A` when untouched)
- [ ] **Two-operation consumer check:** a second app or subclass can (1) customize a declared child via config merging alone and (2) mutate its config on a mounted instance via `set()` with focus/state intact (`N/A` for non-UI classes)

**Findings:** [Pass / halted at line-1 premise RA / specific idiom RAs / N/A]

---

### 🎯 Close-Target Audit

*(Required per guide §5.2 when the PR body carries closing keywords; mark N/A otherwise.)*

- [ ] Close-targets identified: [standalone `Resolves #N`, or "none"]
- [ ] Confirmed leaf issue (not `epic`-labeled, no `Closes`/`Fixes` or prose-bundled targets)

**Findings:** [Pass / specific target flagged / N/A]

---

### 📑 Contract Completeness Audit

*(Required per guide §5.4 when introducing or modifying consumed surfaces; mark N/A otherwise.)*

- [ ] Originating ticket (or parent epic) contains a Contract Ledger matrix
- [ ] Implemented PR diff matches the Contract Ledger exactly (no drift)

**Findings:** [Pass / missing ledger flagged / contract drift flagged / N/A]

---

### 🪜 Evidence Audit

*(Required when close-target ACs require runtime/host/visual observation beyond CI per the [Substrate Evidence Ladder](neomjs/neo-agent-brain:learn/agentos/process/evidence-ladder.md); mark N/A when unit/static CI covers all ACs.)*

- [ ] PR body contains a valid `Evidence:` line (`L<X> → L<Y>`, plus `Residual` + open non-close-target `Residual-Owner: #N` if deferred)
- [ ] Achieved evidence ≥ required evidence, OR residuals are annotated in PR `## Post-Merge Validation` and on the close-target issue
- [ ] Sandbox ceiling vs unprobed gap distinguished; L1/L2 not framed as L3/L4; pre-merge receipts come from this exact unmerged head

**Findings:** [Pass / evidence-AC mismatch flagged / N/A]

---

### 📡 MCP-Tool-Description Budget Audit

*(Required per guide §5.3 when touching `ai/mcp/server/*/openapi.yaml`; mark N/A otherwise.)*

- [ ] Single-line preferred; call-site usage only (no ticket/phase/session refs or narrative); ≤ 1024 chars

**Findings:** [Pass / specific descriptions flagged / N/A]

---

### Conditional Audit Triggers

Expand only when triggered; omit otherwise:
- **🛂 Provenance Audit:** novel core subsystem or external pattern abstraction (guide §7.3).
- **📜 Source-of-Authority Audit:** review cites operator/peer authority for a demand.
- **🔌 Wire-Format Compatibility Audit:** alters JSON-RPC, event, tool, or DB schemas.
- **🧠 Turn-Memory / Substrate-Load Audit:** touches `/turn-memory-pre-flight` IN-SCOPE files (`audits/loading-runtime-effect.md`).
- **📸 Before/After Audit:** changes rendered UI (`audits/rendered-surface-audit.md`).

---

### 🔗 Cross-Skill Integration Audit

*(Required per guide §8.1 when touching skills, `AGENTS.md`, workflow conventions, or MCP tools; mark N/A otherwise.)*

- [ ] Predecessor skills/references wired to invoke or cite the new pattern
- [ ] Owning skill payload and downstream consumers updated

**Findings:** [All checks pass — no integration gaps / specific gaps listed in Required Actions / N/A]

---

### 🧪 Test-Evidence & Location Audit

*(Required per guide §7.5.)*

- [ ] Execution evidence: exact-head required CI [green at `<SHA>` / N/A — docs-template] + non-CI surface receipt [present / gap flagged / N/A]
- [ ] AC-table cross-read: `## AC Evidence`, `## Test Evidence`, and `## Post-Merge Validation` agree
- [ ] Reviewer falsifier & test location: [N/A / command + result; canonical spec path verified]

**Findings:** [Pass / gap or contradiction flagged]

---

### 📋 Required Actions

**When changes are required:**

- [ ] Item 1
- [ ] Item 2

**When zero issues remain (never use pre-ticked `- [x]` placeholders):**

No required actions — eligible for human merge.

---

### 📊 Evaluation Metrics
*Weights: 30% premise, 30% architecture/placement, 30% diff correctness, 10% AC/audit sanity.*

*   **`[ARCH_ALIGNMENT]`**: [0-100] - [Neo paradigms + placement fit. Behavior/state change: `owner: <path> · primitive: <class/module or n/a> · retired: <mechanism> | kept: <reason>`]
*   **`[CONTENT_COMPLETENESS]`**: [0-100] - [Brief justification]
*   **`[EXECUTION_QUALITY]`**: [0-100] - [Brief justification]
*   **`[PRODUCTIVITY]`**: [0-100] - [Brief justification]
*   **`[IMPACT]`**: [0-100] - [Brief justification]
*   **`[COMPLEXITY]`**: [0-100] - [Brief justification]
*   **`[EFFORT_PROFILE]`**: [Quick Win | Heavy Lift | Maintenance | Architectural Pillar] - [Brief justification]

[Closing Remarks]
