# Decision-substrate sweeps — arms `(iii)` and `(iv)` of §1a

`ticket-create-workflow.md` §1a arms `(i)` and `(ii)`, and the `resources/content` greps beside them, are all **artifact** substrates. They answer *"does a ticket exist?"* None answers *"was this already decided, and why?"*

A `NOT_PLANNED` predecessor is a **ruling**. An artifact sweep surfaces its title and never its reason, so it fails silently: a clean sweep, filed with confidence, carrying a fresh-timestamp attestation proving the sweep ran.

## (iii) Memory Core rationale sweep

Run at least one `query_raw_memories` as the last step before `create_issue`, keyed on the **system's nouns** — repo, package, mechanism, file and symbol names:

```js
query_raw_memories({query: '<repo> <mechanism> <file/symbol> <prior-decision terms>', nResults: 6})
```

Never key it on your own phrasing or on the operator's prompt wording. Memory Core indexes artifacts, so a structurally-shaped query ("should we add a gate for…") matches session boilerplate rather than the decision. `query_summaries` and `explore_lane_landscape` widen it when the first call returns only noise.

## (iv) Own-assignment sweep

```bash
gh issue list --repo <r> --state open --assignee @me --json number,title
```

Then read the **bodies** of the two or three touching the same surface — not the titles. A site table, a row table, or a "deferred" clause is where a past self parked exactly this.

Neither `(i)` (recency-bounded) nor a closed-issue search reaches an **open, old, self-assigned** parent. A defect found *while measuring something else* is the high-risk shape: it feels like discovery precisely because no retrieval preceded it.

## Attestation

Record what ran, in the body, beside the live-open attestation:

```
MC sweep: <queries>, <n> results, no prior decision found
Own-assignment sweep: <n> open, none overlapping
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

A fourth artifact query would have caught none of them.

## Sunset

When `ticket-create` gains a mechanical pre-flight that runs the sweeps itself, arms `(i)`–`(iv)` collapse into that runner and this payload retires with them.
