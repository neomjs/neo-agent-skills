---
name: lane-intent
description: "Pre-V-B-A signal protocol for collision-prone, high-blast, or long-V-B-A lanes; use before broadcasting [lane-intent] evaluating #N (never for short single-turn V-B-A where post-V-B-A [lane-claim] suffices)."
---

# Lane-Intent Skill

Before broadcasting `[lane-intent] evaluating #N` OR explaining lane-intent semantics (for deep memory-mining, tech-debt-radar, or multi-turn architectural V-B-A; distinct from post-V-B-A `[lane-claim]`), read `.agents/skills/lane-intent/references/lane-intent-protocol.md` for the 3-condition scope-trigger gate, TTL+recovery semantics, and anti-patterns.

**Source of Authority:** AGENTS.md §0 Inv 7 (Map entry-point) + peer-role-mode §6.5 ([lane-claim] vs [lane-intent] split per #11537) + Discussion #11536 graduation + ADR 0010 (deep rationale).

**First payload line MUST declare:** "Lane-intent active: narrow non-authoritative pre-V-B-A signal, 2h TTL. Scope-trigger discipline applies — read protocol before broadcasting."
