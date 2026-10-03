# Goal-Scoping Workflow — convert a GOAL into owned LANES

The planning **front-end** of the epic lifecycle. `epic-create` authors ONE epic; `epic-review` / `epic-resolution` review and close it. This skill is the step *before* all of them: it decides **which** lanes (→ epics) a GOAL needs, and how they get owned. Output = a few coherent **owned lanes**, each a durable epic, each self-selected by an owner who drives it to the lane-goal.

## Why this exists (the friction → gold)

A goal with no scoping produces one of two failures — both observed repeatedly, both wrong:

- **No planning** → the team chases scattered **micro-tickets**; parents never close; the goal never converges; capable agents report "nothing to do."
- **Lead micro-manages** → the lead **assigns** peers to lanes ("you take X"). This violates self-assignment + flat-peer agency (`AGENTS.md` §swarm_topology_anchor) — just as bad.

The cure is neither: a planner **defines the goal + the lanes**, and **peers self-select** which lane to own.

## The process

### 1. Define the GOAL
State one observable outcome for its beneficiary, the accepted constraints and the canonical acceptance record, independently of the proposed implementation. Before decomposition, inspect the current end-to-end journey or affected consumer effect; record failures and explicit unknowns. A mechanism, directory layout or closed-child count is not the outcome.

### 2. Scope into LANES (the core discipline)
Carve the goal into a **few** (≈2–6) coherent streams — by subsystem / daemon / pillar / capability. A **lane** is *a coherent stream worth a dedicated owner driving it to a sub-goal*. It is NOT:
- a **sliver** (a 50-line change is a PR, not a lane);
- a **scrap-ticket** (do not atomize the goal into N micro-tickets);
- a **flat ticket list** (lanes are owned streams, not a backlog dump).

**The lane test:** would one accountable owner carry this whole stream in their head and drive it to a goal? If it is too small to warrant an owner, it is a *sub* of a lane, not a lane. If it spans unrelated concerns, split it.

### 3. Each lane → an epic
Author each lane as an epic via **`/epic-create`**; linked subs, not prose, are its durable ownership anchor across context wipes.

**Graduation bar:** epic exists; full v1 one-PR leaves are filed/native-linked (`blocked-by` if ordered); source Discussion is closed RESOLVED; peers can claim leaves without hidden context. #14565/#14564 are the 2026-07-04 precedent; epic shells with "subs to follow" repeat the June failure. Epic bodies stay sub-list-free.

### 4. Ownership = SELF-SELECT
The planner **defines** the goal + the lanes (the planning artifact) and **facilitates**. Peers **self-select** the lane they own. The planner **never assigns** a peer to a lane — that is micro-management and violates self-assignment. Surface the lanes; let peers claim them. Each lane needs exactly one accountable owner; if two claim, the earlier claim wins (the later contributes into it).

### 5. Drive to the lane-GOAL
The self-selected owner carries the outcome through planning, integration and acceptance. Update the same acceptance record (step or consumer effect · expected · observed · state · evidence · remaining owner/action) before decomposition, at the first integrated candidate, and before declaring readiness or handing the outcome to its user. Compare expected with observed behavior on a named candidate; retain failed, blocked and unknown checks with the next falsifying action, owner and, if deferred, its activation condition; neither a PR's close nor its parent's discharges them. Recipient-specific effects require evidence from the recipient's actual session. Installed checks that need no restart are the owner's to run (L3); only the merge, a named judgment or a destructive act waits for the operator.

## Anti-patterns

An epic enters execution only with its planned set complete in native links. The planner does not own every lane; contributors retain independent outcome ownership.
