# Source Discussion Reconciliation Audit

Single source-Discussion reconciliation contract owned by `epic-resolution` (`§3.5`) and referenced — never duplicated — at graduation (`ideation-sandbox`, `epic-create`), pre-work entry (`epic-review` Stage 2.5), leaf creation/intake (`ticket-create`, `ticket-intake`), and closeout exit (`epic-resolution` §3.5).

## 1. Unavailable-Discussion Falsifier (Entry Gate)

Before recording `[GRADUATED_TO_TICKET]`, granting `epic-review` Greenlight, or branching in `ticket-intake`, answer:

> **If the source Discussion were unavailable, would the Epic plus its live leaf bodies still determine one unambiguous implementation and review result?**

The answer must be **yes**. A Discussion link or criterion ID proves traceability, not executable authority. Reopening a closed Discussion to reconstruct requirements is archaeology, and a reviewer who already knows the Discussion is vulnerable to **reviewer-memory completion** (silently filling incomplete ticket ACs from privileged working memory).

## 2. Intended-Solution Architecture vs. Sub-Ticket Lists

When selected by a source Discussion, the following belong in the Epic's **intended solution** and/or the exact owning leaf body, Contract Ledger, and ACs as **intended-solution architecture** — they are **not** the hardcoded sub-ticket registry forbidden by `epic-create`:

- exact target paths/modules, schemas, and API/wire vocabularies;
- ownership and service boundaries;
- exclusions and explicitly rejected compatibility shapes;
- consumer witnesses and cross-repository sequencing;
- Decision Record (`REQUIRED` / `OPTIONAL` / `NOT_NEEDED`) amendment/supersession boundaries.

## 3. Row Modes: `enumerable` vs. `judged`

Every reconciliation row is typed `enumerable` or `judged`:

1. **`enumerable`** — exact paths/modules, schema identities, and API/wire vocabularies.
   - **Graduation marking:** Mark each selected binding enumeration in the Discussion with a stable `inventory-id` via `<!-- binding-inventory: <inventory-id> --> ... <!-- /binding-inventory -->` or ```` ```binding-inventory:<inventory-id> ````. Current-state censuses, rejected options, examples, and superseded filenames stay unmarked and are never inferred as binding.
   - **Predicate:** Exact set equality between the source `inventory-id` and the union of same-id blocks across the Epic and live leaves, verified by `node scripts/check-discussion-fidelity.mjs --discussion <disc.md> --epic <epic.md> --leaf <leaf.md>` (`neo-agent-skills-discussion-fidelity`). Missing or extra identities (including folder placeholders like `src/dashboard/dock/**`) fail closed; *"materially present"* is insufficient.
2. **`judged`** — prose contracts (ownership/service boundaries, exclusions, consumer witnesses, sequencing, Decision Record boundaries).
   - **Predicate:** Evidence-backed prose reconciliation. Every judged binding row must be **materially present** in the Epic intended solution or exact owning leaf body/Contract Ledger/ACs; a link or criterion ID alone is `LOST`.

## 4. Shared Reconciliation Matrix (Entry & Exit)

```md
| Source Discussion criterion | Mode (`enumerable` \| `judged`) | Epic AC / `inventory-id` | Owning sub(s) | Delivered PR(s) | Achieved evidence | Residual / deferral |
|---|---|---|---|---|---|---|
```

- **Residuals:** `none — ticket-resident` (entry) / `none — delivered via AC<N>` (exit), `EXPLICITLY DEFERRED — <rationale>`, `CONVERTED TO FOLLOW-UP [#<ticket>]`, or `LOST`.
- **Entry (`ideation-sandbox`, `epic-create`, `epic-review` Stage 2.5, `ticket-create`, `ticket-intake`):** Run `check-discussion-fidelity.mjs` before judged reconciliation. Any entry-time `LOST` row blocks `[GRADUATED_TO_TICKET]` and `epic-review` Greenlight (`REVISIONS_REQUESTED`), and routes `ticket-intake` gaps to body correction. Passing `epic-review` records `discussion-needed-to-implement: false` (`discussion-needed-to-implement:false`).
- **Exit (`epic-resolution` §3.5):** Any `LOST` row blocks `RECOMMEND_CLOSE_COMPLETED` (`RECOMMEND_KEEP_OPEN`, `RECOMMEND_CREATE_MISSING_SUBS`, or retroactive `CONVERTED TO FOLLOW-UP [#N]`).

## 5. Empirical Anchors

- **D#17818 → Engine `#17836` / `#17837`:** 30 binding `src/dashboard/dock/**` modules (amid 43 `.mjs` mentions) were compressed to folder prose at graduation and missed at review via reviewer-memory completion.
- **Engine `#18303` & `#18304`:** 100% leaf closure still hit `KEEP_OPEN` at §3.5 (`#18304` missed all 12 enumerable founding concerns) after full implementation cost.
- **D#11341 → `#11342` (`#11349`):** Origin of §3.5 closeout reconciliation.
