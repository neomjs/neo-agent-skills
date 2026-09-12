---
id: edge_case_triggers
order: 1600
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: maintainer
---
## §edge_case_triggers
*(Sections mapped to `learn/agentos/AGENTS_ATLAS.md`)*
- **Knowledge Base & Anti-Hallucination (§anti_hallucination_policy, §knowledge_base_primary_truth):** ALWAYS use `ask_knowledge_base` first for Neo concepts. Adding docs → Anchor & Echo strategy.
- **Swarm Topology / Cross-Peer Coordination:** triggers + mandate in §swarm_topology_anchor (this file).
- **Testing & Validation (§testing_validation_protocol):** Verifying code or persistent test failures. **Tripwire/Peer-Escalation:** tests fail 3-5 times → escalate via `add_message` before 25-turn limit.
- **Sunset Protocol (§a2a_contextual_bridge_protocol):** Before session handover, read `.agents/skills/session-sunset/SKILL.md`. Must explicitly declare `scope: solo-refresh | convergent` to prevent scope contagion. Stale-wake invariant: wake messages in old transcripts are noise.
- **Visual Verification (§visual_verification_protocol):** Debugging frontend UI/layout.
- **Authoring / app-work gate (`apps/**`):** Read 1–2 siblings and load `src/Neo.mjs`, `src/core/Base.mjs`, `src/state/Provider.mjs`, `src/data/Model.mjs`, and `src/data/Store.mjs` before app code. Start with the matching engine primitive; class suffix names its base family. Data UI binds a `data.Store` of `data.Model` records, never a hand-mapped array; providers stay at view roots; styles stay in SCSS. Instance/reactive work follows intake 9.6. Violations reject at ticket/commit/PR (operator 2026-07-08); retire each clause when an `apps/**` lint enforces it.
- **Ticket Creation Freshness:** Before any `create_issue`, invoke `ticket-create` (its Content Sweep requires live latest-open queue evidence beyond KB/local duplicate checks).
- **File Reading Efficiently:** Reading modified files; efficiency patterns.
- **Verify-Before-Assert:** stated in full in §verify_before_assert (this file); tool inventory + anchors in §anti_hallucination_policy.
- **Wake/Heartbeat → run the cycle (`/post-review-pickup`):** drain the lifecycle queue (own-PR changes/review → own-PR-green→request-review) before a new lane; no holding terminal (§L3_No_Hold_State). Three heartbeats with no forward artifact = critical failure → `/post-review-pickup` + `NightShiftLeasedDriver.md`.
