# Tech Debt Radar Guide

The radar is a **sensor, not a judge**: it measures ambient architectural debt against the repo's LIVING canon and routes findings to the lanes that own them. Its unduplicated substance is the sweep method below — the debt taxonomy itself is never stored here.

## 1. Execution Posture

Run this meta-analysis with frontier-tier capability — it synthesizes documentation, graph topology, episodic memory, and code layout at once. Tactical SML sub-agents halt and escalate. Capability class, not model names: pinned rosters decay by construction.

## 2. Pre-Flight: Derive the Canon (never copy it)

A copied canon decays by construction and eventually inverts — the radar then flags sanctioned shapes as debt. At sweep time, load the debt taxonomy FROM the living authorities, and keep three classes separate: **authority** (what the canon prescribes), **observation** (what the tree currently is), and **hypothesis** (candidate findings awaiting an owning lane):

1. The Engine's [Architecture Overview](neomjs/neo:learn/benefits/ArchitectureOverview.md) — the structural baseline (Body/Brain topology). *Authority.*
2. **The repository-qualified ADR canon** ([neomjs/neo-agent-brain#adr:adrs-as-graph-queryable-entities](neomjs/neo-agent-brain:learn/agentos/decisions/0006-adrs-as-graph-queryable-entities.md); custody redirects, 4-field keys, and `<org>/<repo>#adr:<slug>` rules in [`guide-authoring-bar.md §7`](neo-agent-skills:guide-authoring/references/guide-authoring-bar.md#7-adr-custody-redirects-repository-qualified-identity--slug-citations--machine-enforceable-candidate)) — minimum reads: `neomjs/neo-agent-brain#adr:aiconfig-reactive-provider-ssot` (the `ai/`-config antipattern catalog) for config debt; `neomjs/neo#adr:skill-anatomy-and-authoring-contract` for skill-shape debt. *Authority.* Follow `type: redirect` (`target: <canonical-key>`) / `Status: Moved` pointer stubs to their canonical target; never treat a redirect stub as retired.
3. `npm run ai:structure-map -- --files --loc` — current-tree measurement: where things ARE and how large. Brain-hosted; where absent, record N/A and never add `--silent`, which hides npm's `Missing script` behind an empty exit-1. *Observation only — no intended-placement policy; observed placement is never its own authority.*
4. The `pr-review` guide's anti-pattern tables and `AGENTS.md` §edge_case_triggers (the `apps/**` data-path/style gate, `core.Base` as the quality bar). *Authority.*

A conflict between this guide and those authorities is a bug in THIS guide — the authorities win. Freshness trigger: a pattern-canon ADR graduation invalidates this pointer list; revalidate it then.

## 3. The Multi-Vectored Sweep

### A. Ambient Artifact Traversal
Use `ask_knowledge_base(type: 'ticket')` against the backlog's conversation rows: abandoned concepts, incomplete migrations, trailing architectural directives.

### B. Episodic Memory Mining
Heavily use `query_raw_memories` and `query_summaries` for "abandoned loops" (an agent attempted X and rolled back; failed test hypotheses) — past thought-logs carry the *why* behind accrued debt.

### C. Codebase Vertical Slicing
Dive where A/B point. Classify anomalies strictly against the §2 living catalogs, never against inline taste rules that decay as ADRs evolve.

### D. Brain-Structural Debt (measure → report → route; never prescribe)
Across `ai/` (Brain) vs `src/` (Body), re-measure module and LOC balance each sweep rather than treating past ratios as frozen fact. Probes (*observation* → *hypotheses*):

- structure-map LOC outliers calibrated against the Body's densest exemplary files;
- folder-shape consistency across `ai/daemons/*` (factored vs monolith vs ad-hoc flat);
- concept↔code-home coherence: an Agent OS concept guide lacking a legible code home is a reportable CANDIDATE (calibrated against the Dream Pipeline specimen across five layer buckets, not a rigid one-guide-one-home rule).

**Two-layer rule:** route findings in this class as REPORTS to the #14304 / D#14302 canon lane (a canon-hole is itself reportable; prescribing target module moves pre-SSOT is out of scope).

## 4. Remediation Routing

Route findings into issues via `/ticket-create` (duplicate sweep, Fat Ticket, six-stage challenge chain, live label rules; no bypass) citing session/PR provenance so the implementer sees the exact ROI. Route Brain-structural findings per §3.D, never unilateral restructure tickets.

## 5. Standalone / Plugin Workspace Fallback (No Agent OS MCPs)

Without `neo-mjs-knowledge-base` or `neo-mjs-memory-core`:
1. **Derive local canon (§2):** read `ARCHITECTURE.md`, `CONTRIBUTING.md`, `CLAUDE.md` / `AGENTS.md`, and `docs/adr/` or `decisions/`; measure LOC outliers via `git ls-files '*.ts' '*.js' '*.mjs' '*.py' '*.go' '*.rs' | xargs wc -l 2>/dev/null | sort -nr | head -n 25` (*observation*, never authority).
2. **Sweep history (§3.A–B):** run `gh issue/pr list --state all --search "<concept>" --limit 30`, `git log -S "<symbol>" --oneline -n 30`, and `git log -i -E --grep="revert|rollback|workaround|fixme" --oneline -n 30` (**capability note:** surfaces committed churn and public threads, not semantic RAG over unmerged session diaries via `query_raw_memories` / `ask_knowledge_base`).
3. **Report safely (§4):** present `authority`, `observation`, and `hypothesis` findings in chat with citations; run `gh issue create` **only** when explicitly asked (Directory Policy §2D).
