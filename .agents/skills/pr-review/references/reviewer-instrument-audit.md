# Instrument Audit (Author & Reviewer)

Three failure shapes every other authoring and review dimension is blind to, because all three produce **green code and confidently-worded claims**. Premise, placement, correctness, and evidence check the *patch*; these check the **instrument** — the count or search the **author** relies on to justify a ticket/PR, the gate the **patch** relies on at runtime, and the search the **reviewer** relies on to assert an absence.

- **Author (`ticket-create` / `pull-request`):** load when a ticket or PR makes a **load-bearing population count or absence claim** justifying premise, scope, or acceptance.
- **Reviewer (`pr-review`):** load when the diff adds a capability gate, constant guard, feature flag, or new field/config leaf; or when a review asserts an absence or audits an author's count.

---

## Author Side — load-bearing counts and absence claims carry publish-safe receipts

### 1. Role-triggered, never number-shaped

Fires **only** on **load-bearing population counts and absence claims used to justify premise, scope, or acceptance** (e.g., *"19 call sites remain"*, *"zero callers outside X"*, *"15 dock-chrome blocks duplicate Y"*, *"loaded payloads shrank by 241 B"*). The claim's **role** triggers the rule, never its numeric appearance.

Error classes caught at counting time: `lines ≠ occurrences` (two calls on one line, or one call across three) · `matches ≠ population` (comments, archived ticket prose, or symbol/app names match alongside code) · `pattern ≠ concept` (narrow tokens undercount; broad regexes match `.429` ms fragments as HTTP 429s) · `unnamed tree` (`"148 vs 150"` — both right on different refs; a count is a claim about a ref, not a repository) · `structure invisible to line tools` (raw `grep` misses multi-line YAML `run:` blocks).

### 2. Publish-safe instrument receipt shape

A qualifying claim carries: (1) **Producer** (command, MCP tool, or query class — normalized, never a raw terminal dump), (2) **Exact tree/ref or external source** (commit SHA, `origin/dev` at `<sha>`, or live API surface), (3) **Scope / filter** (path, tenant, or exclusions), and (4) **Sampled match or positive control** (a representative hit for counts, or a stage-matched positive control for `0` / absence claims per Shape 2).

- **Linked-receipt rule:** When a linked CI run or API receipt already carries producer + source + scope, link it in place of inline fields — **never duplicate it inline**.
- **Forbidden-content boundary (`ticket-create` §12):** Publish-safety outranks receipt literalism — name the instrument, never the operator's machine. **Explicitly forbidden in any public receipt:** **secrets, private identifiers, machine-local paths, and client context**.

### 3. Worked negative examples (do NOT fire)

- **Routine workflow attestations:** `"Live latest-open sweep: checked latest 20 open issues at 2026-08-22T00:35Z; no equivalent found"` — a fixed gate receipt, not a population premise.
- **CI-linked test totals:** `"26/26 green"` or `"4,115 passed"` backed by PR CI or a linked test run — producer, tree, and scope already live in the CI receipt.
- **Non-argument numbers:** dates, timestamps, versions, issue/PR IDs, and enumerations whose producer is already named in the surrounding table or heading.

### Worked author failure (`neomjs/neo#17532` RA-4)

In `neomjs/neo#17532`, a load-bearing budget-offset claim (`55,409 → 55,152 B`) was reported twice in one night without naming the merge-base vs head objects, causing two unnamed-tree receipt errors (`RA-4`) before being anchored to exact Git objects (`d959598a5b`: `21,962 + 33,447 = 55,409` → `30c5cbb5e5`: `21,991 + 33,177 = 55,168`, `−241 B`).

---

## Shape 1 — a gate that checks a capability EXISTS rather than that it RAN

> **Does satisfying this gate cause anything to happen, or does it merely describe something?**

`typeof PRODUCER !== 'function'` is satisfied by `() => {}`; a shape check over a caller-supplied object is satisfied by any matching mock. Both pass while the guarded action never ran. **Type-checking a producer is not invoking it.**

1. **Is the guarded thing ever invoked?** Follow the gate to the code behind it. If the gate opens and nothing runs, the gate is decoration.
2. **Who owns the observation?** If the protected value arrives as a *caller argument*, the caller can assert it. The consumer must invoke the producer and own what it observes.
3. **For a newly declared field or config leaf — does a WRITER exist in production code?** A field declared, read, and spec-injected still does nothing if no production code assigns it; hand-injected specs witness the read path only.

**The converse (equally a defect):** *If I am about to claim nothing invokes this — have I found the real caller?* Asserting a gate is forgeable is an absence claim subject to Shape 2; the caller may sit one layer up in a wrapper the module's error text names.

---

## Shape 2 — an absence claim from a search with no positive control (Author & Reviewer)

> **"No caller." "Nothing references it." "Not used anywhere."**

An empty result has two indistinguishable explanations: the target is absent, or the search could not find it.

1. **Carry a positive control that shares the target's blind spot.** The same command must find something known-present and traverse **every stage capable of excluding the target** (matcher, ref, path scope, downstream filters). "A control exists" is a declaration; "a control runs the failing path" is an execution. Counterexample — names the SHA, carries a control, and still publishes a false absence because `name: pr-review` survives `grep -v` while the target dies at it:

   ```sh
   git grep -n -E '<target>|name: pr-review' <sha> -- .agents/skills/pr-review \
     | grep -v 'reviewer-instrument-audit.md'
   ```

   Where one control cannot cover every stage, place a control **at each** failure-prone stage.
2. **State the tree.** Any absence claim (ticket, PR, or review) must name the **branch or SHA** searched. `git grep` on local `dev` cannot see a branch's code and exits 0 with empty output; a stage-matched control kills the error because the control is missing too.

**Caution:** A second reviewer reached the same false absence and blamed `grep -v`; an exact-object probe at the cited head showed the filter did **not** remove the proving line. Diagnosing a broken search is itself a claim subject to this audit.

---

## Empirical anchors

- **Author-side six-case series (`neomjs/neo-agent-skills#12`):** six cross-family incidents (2026-05..2026-08), culminating in the Drop+Supersede of `neomjs/neo#17513` → `#17534` (where `"19 call sites"` was a grep line count including archived ticket prose and a two-call line), showed that catching broken counting instruments only at review manufactures avoidable RC/D+S rounds.
- **Reviewer-side four-event series (one day, three PRs, two reviewers, verified at exact Git objects):**

| # | event | verified at | shape |
|---|---|---|---|
| 1 | Gate `typeof PROMOTION_REPLAY_PRODUCER !== 'function'` satisfied by no-op (`#16037`) | `de2b17d614` | 1 |
| 2 | `daemonState` / `daemonDegradedReason` read in prod, **assigned nowhere**; spec injects (`#16050`, D+S) | `c3d28ca76d` | 1 |
| 3 | Reviewer asserted gate forgeable while producer *was* invoked one layer up (`#16053`) | `6f8406178c` | 1-converse |
| 4 | `git grep` on local `dev` checkout — absence proven against wrong tree (`#16053`) | `6f8406178c` | 2 |

*(A fifth claimed row blaming `grep -v` was excluded after an exact-object probe returned the proving line intact.)*

## Why the asymmetry makes these worth a slot & Net-load accounting

A detection failure announces itself; a **permission** or **counting-instrument** failure is silent — the count reads as authority, the gate opens, CI is green, and the error surfaces only after build and review cost are paid.
- **Always-loaded cost:** `SKILL.md` routers untouched (`0 B` delta); `ticket-create-workflow.md` carries a one-line `compress-to-trigger` pointer paid in-file (`<= 0 B` net).
- **Conditional cost:** loaded only when an author makes a load-bearing count/absence claim or a reviewer audits a gate/absence/count.
- **Retirement trigger:** if a lint fails absence claims lacking a named tree/SHA, Shape 2 retires into that check.
