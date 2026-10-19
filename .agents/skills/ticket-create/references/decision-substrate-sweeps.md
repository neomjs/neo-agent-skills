# Decision-substrate sweeps — arms `(iii)`, `(iv)` and `(v)` of §1a

§1a's artifact sweeps find tickets, not decision rationale. A `NOT_PLANNED` predecessor is a ruling: read its reason, not only its title.

## (iii) Memory Core rationale sweep

Immediately before `create_issue`, run at least one `query_raw_memories` keyed on the **problem's nouns**: repo, package, file/symbol and existing failed mechanism, never the proposed solution.

**Query the PROBLEM's nouns, never the SOLUTION's.** This is the distinction the arm turns on, and it is not "search harder":

| | example | finds |
|---|---|---|
| ❌ the solution's nouns — the mechanism you are about to build | *"MC gate for ticket-create"* | only prior art that chose the same fix |
| ❌ structural / boilerplate phrasing | *"should we add a gate for…"* | session boilerplate; Memory Core indexes artifacts |
| ✅ the problem's nouns — the symptom as observed | *"vast amounts of additional tickets"*, *"different casualty each run"* | prior art that solved the same problem **differently** |

Use the operator's symptom vocabulary; searching only your proposed mechanism hides other solutions.

> **2026-08-31 anchors:** `neo-agent-skills#32` missed `neomjs/neo#16212` by querying the proposed mechanism instead of *"vast amounts of additional tickets"*. `neomjs/neo#18000` missed `neomjs/neo#17796` by querying a suite name instead of *"different casualty each run"*. Match the symptom across different solutions and suites.

`query_summaries` and `explore_lane_landscape` widen the sweep when the first call returns only noise.

## (iv) Own-assignment sweep

```bash
gh issue list --repo <r> --state open --assignee @me --json number,title
```

Read the **bodies** of the two or three same-surface hits, including tables and deferred clauses. Old open self-assignments escape both `(i)`'s recency window and closed-state queries; incidental discoveries need this check too.

## (v) Epic-layer outcome-authority sweep

Fires only on **epic-labeled** filings.

```bash
gh issue list --repo <r> --label epic --state open --json number,title
```

Compare **terminal predicates**, not titles: *what state of the world does this Epic declare finished?* Two Epics that finish the same sentence are one Epic, however differently they open.

**Read every predicate, then selected bodies.** `epic-create` puts `Terminal predicate:` first to keep this exhaustive read affordable:

1. **Every row:** read each open epic's terminal predicate.
2. **Ranked bodies:** for missing or arguably overlapping predicates, run the semantic outcome-overlap query and read its ranked candidates. Retrieval proposes; the reader judges overlap.

**Cost control:** read predicates exhaustively, bodies selectively. On 2026-09-02, 29 Engine epics implied ~290k characters for an all-body read; re-query populations rather than calling them small. Standing outcomes can predate `(i)`'s window and use different nouns, splitting ownership when missed.

> **Anchor — `neomjs/neo-agent-brain#38` vs open `#54`, 2026-08-13.** Two roots, 17 and 16 children, the same two terminal predicates. The author's §1a sweep ran honestly and **passed**; a peer's epic review caught it after filing.

## Attestation

Record what ran, in the body, beside the live-open attestation:

```
MC sweep: <queries>, <n> results, no prior decision found
Own-assignment sweep: <n> open, none overlapping
Epic sweep: <n> open epics read, no shared terminal predicate    # epic-labeled filings only
```

Prose discipline that leaves no artifact cannot be checked, and these arms exist because prose discipline failed.

## Same-turn reconciliation

If content belongs on a surviving parent, port it there in the same turn. An accepted direction-changing fold, graduation or successor publication must also reconcile the older work it replaces. A new exploratory option alone retires nothing.

Reuse adjacency results: read affected tickets, drafts, research recommendations, tool assumptions and active handovers/checklists, following links as needed. Identify predecessors before filing; apply dispositions once successor IDs exist. Abandonment without a new successor reconciles immediately against existing outcome/research owners:

1. Cite the accepted decision and compare each recommendation with the **current outcome and required interactions**, not just its technical feasibility. A reusable reference does not authorize a superseded research/delivery path. Keep, narrow, transfer or retire each prescription; move unique obligations, evidence and dissent to a named surviving owner first. Existing research can own the remainder without another ticket.
2. Update the old entry heads and both sides' successor links. Retire obsolete unchecked instructions explicitly; preserve history under a historical heading. A finally rejected narrow implementation closes `not_planned` per `ticket-intake` §4. Its unresolved quality outcome, research or epic does not close with it; partial overlap leaves remaining obligations current. Epic closure uses `epic-resolution`.
3. Apply own-authored or explicitly authorized changes. For foreign bodies/ACs, follow `ticket-create` §11: propose exact text and record the owner/application still owed. A pending proposal is not applied reconciliation.
4. Read back bodies, links and states: each old entry must reveal its disposition and current owner without archaeology. For immutable memories/handovers, record exact superseded IDs → current authority; preserve history. Record pending owner actions separately from verified updates; unapplied cleanup is not complete.

## Empirical anchor

**`neomjs/neo#17997`, 2026-08-31.** Re-filed **row 3** of `#17868` — open, older than the `(i)` window, and assigned to the filer — four hours after that same filer's own `#17961` closing comment recorded that row 3's blocker belonged **on `#17868`**.

The missed decision can live in an older parent, a closed decline, a prior self-assignment or someone else's standing outcome; a latest-open artifact scan alone covers none of those cases.

**Why the sweeps run LAST.** `#12856`, 2026-06-10: four agents raced one prompt into three duplicates, each having swept honestly; the one who re-checked immediately before filing produced none. Check-at-start decays across a multi-minute protocol.

## Sunset

When `ticket-create` gains a mechanical pre-flight that runs the sweeps itself, arms `(i)`–`(iv)` collapse into that runner and this payload retires with them. `(v)` survives it as a prompt rather than a check: a runner can list open Epics, but *"do these two finish the same sentence?"* is not a judgement a lint makes.
