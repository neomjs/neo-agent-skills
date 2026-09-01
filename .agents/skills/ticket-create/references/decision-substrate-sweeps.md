# Decision-substrate sweeps — arms `(iii)`, `(iv)` and `(v)` of §1a

`ticket-create-workflow.md` §1a arms `(i)` and `(ii)`, and the `resources/content` greps beside them, are all **artifact** substrates. They answer *"does a ticket exist?"* None answers *"was this already decided, and why?"*

A `NOT_PLANNED` predecessor is a **ruling**. An artifact sweep surfaces its title and never its reason, so it fails silently: a clean sweep, filed with confidence, carrying a fresh-timestamp attestation proving the sweep ran.

## (iii) Memory Core rationale sweep

Run at least one `query_raw_memories` as the last step before `create_issue`, keyed on the **problem's nouns** — repo, package, file and symbol names, and the *existing* mechanism that failed, never the one you are about to build:

```js
query_raw_memories({query: '<repo> <mechanism> <file/symbol> <prior-decision terms>', nResults: 6})
```

**Query the PROBLEM's nouns, never the SOLUTION's.** This is the distinction the arm turns on, and it is not "search harder":

| | example | finds |
|---|---|---|
| ❌ the solution's nouns — the mechanism you are about to build | *"MC gate for ticket-create"* | only prior art that chose the same fix |
| ❌ structural / boilerplate phrasing | *"should we add a gate for…"* | session boilerplate; Memory Core indexes artifacts |
| ✅ the problem's nouns — the symptom as observed | *"vast amounts of additional tickets"*, *"different casualty each run"* | prior art that solved the same problem **differently** |

The problem's nouns are frequently **the operator's own words for the symptom**, so their phrasing is a source to mine rather than one to avoid — it is your own solution vocabulary that blinds the query.

> **Empirical anchor — two independent instances, one night (2026-08-31).** `neo-agent-skills#32` was filed after a sweep on *"ticket-create duplicate sweep gate Memory Core"* — the mechanism about to be built. `neomjs/neo#16212` (operator-commissioned five weeks earlier, whose gate inventory already named this exact file) was invisible to it; a sweep on the operator's own *"vast amounts of additional tickets"* surfaces it immediately. Independently, `neomjs/neo#18000` was filed after a sweep scoped by **suite name** (*"flaky component suite"*), which could not match `neomjs/neo#17796` because that ticket names the **unit** suite — the searchable thing was the symptom shape, *"different casualty each run"*. Six days of prior art stayed invisible to four seats for that reason.

`query_summaries` and `explore_lane_landscape` widen the sweep when the first call returns only noise.

## (iv) Own-assignment sweep

```bash
gh issue list --repo <r> --state open --assignee @me --json number,title
```

Then read the **bodies** of the two or three touching the same surface — not the titles. A site table, a row table, or a "deferred" clause is where a past self parked exactly this.

Neither `(i)` (recency-bounded) nor a closed-issue search reaches an **open, old, self-assigned** parent. A defect found *while measuring something else* is the high-risk shape: it feels like discovery precisely because no retrieval preceded it.

## (v) Epic-layer outcome-authority sweep

Fires only on **epic-labeled** filings.

```bash
gh issue list --repo <r> --label epic --state open --json number,title
```

Read **every** row — there are few — plus one semantic outcome-overlap query. Compare **terminal predicates**, not titles: *what state of the world does this Epic declare finished?* Two Epics that finish the same sentence are one Epic, however differently they open.

**Why `(i)` cannot reach these.** An outcome authority is defined by not churning: it is filed once, then supervises for weeks. That places it permanently outside a latest-20 window, so the recency axis is not merely unlucky here — it is **structurally** blind. And its title is written in the vocabulary of the outcome (*"An external plane cannot recover itself…"*), which shares no keywords with a newcomer's framing of the same outcome, so title search misses it too. Both existing artifact axes fail on the same filing for different reasons.

**Why the cost is topology, not tidiness.** A duplicate leaf is one closure. Competing Epic roots split *sub-attachment, review attention and closure authority* until someone reconciles them — and each sub filed under the wrong root deepens the split.

> **Empirical anchor — `neomjs/neo-agent-brain#38` vs open `#54`, 2026-08-13.** `#38` was filed as a parentless root duplicating `#54`'s outcome authority: two roots, 17 and 16 children, the same two terminal predicates. The author's §1a sweep was run honestly and **passed** — latest-20 open, title-keyword search, A2A claim scan. A peer's Stage-1 epic review caught it after filing, and the fold cost more than the filing saved.

## Attestation

Record what ran, in the body, beside the live-open attestation:

```
MC sweep: <queries>, <n> results, no prior decision found
Own-assignment sweep: <n> open, none overlapping
Epic sweep: <n> open epics read, no shared terminal predicate    # epic-labeled filings only
```

Prose discipline that leaves no artifact cannot be checked, and these arms exist because prose discipline failed.

## Same-turn porting

If content belongs on a parent ticket, comment it onto that parent **in the same turn**. A note-to-self inside a closing comment ("record this on `#N`") has no owner and no trigger; hours later it is invisible to the agent who wrote it.

## Empirical anchor

**`neomjs/neo#17997`, 2026-08-31.** Re-filed **row 3** of `#17868` — open, older than the `(i)` window, and assigned to the filer — four hours after that same filer's own `#17961` closing comment recorded that row 3's blocker belonged **on `#17868`**.

Three blind spots, one root — the sweep searched for artifacts, never for decisions:

| Blind spot | Missed because |
|---|---|
| recency-shaped | the standing parent is older than the latest-20 window |
| open/closed-shaped | the decline lives in a closed issue; `(i)` reads open |
| ownership-shaped | the parent is open, old, and already assigned to the filer |
| authority-shaped | the standing Epic is open, old, owned by **someone else**, and titled in the outcome's vocabulary — arm `(v)` |

Another artifact query would have caught none of them.

**And the herd anchor, for why the sweeps run LAST rather than first.** `#12856`, 2026-06-10: four agents raced an operator's *"one (not all!)"* prompt into three duplicate tickets, every one of them having run the GitHub sweep honestly. The single agent who used a two-phase *claim → re-check → execute* filed zero. Check-at-start freshness decays across a multi-minute protocol; check-at-last collapses the stale window to the create-call gap.

## Sunset

When `ticket-create` gains a mechanical pre-flight that runs the sweeps itself, arms `(i)`–`(iv)` collapse into that runner and this payload retires with them. Arm `(v)` is the exception and survives it: a runner can list open Epics, but *"do these two finish the same sentence?"* is a judgement no lint makes. Expect `(v)` to become a prompt the runner asks, not a check it performs.
