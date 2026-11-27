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
- **Authoring gate (`{src,apps,examples}/**`):** Read `.github/CODING_GUIDELINES.md`, `src/core/Base.mjs`, `src/Neo.mjs`, `src/state/Provider.mjs`, and `src/data/{Model,Store}.mjs` before trusting 1–2 siblings (never copy unidiomatic siblings). Expose child hooks via `[isDescriptor]`/`[mergeFrom]`; omit ancestor defaults; prefer `@protected` over `#private` methods; bind `data.Store`/`state.Provider`; keep styles in CSS. Before VDOM engine edits (`src/vdom/**`, `src/util/vdom/**`, `src/worker/VDom.mjs`, `src/manager/VDomUpdate.mjs`, `src/mixin/VdomLifecycle.mjs`, `src/main/DeltaUpdates.mjs`), read `learn/guides/vdomengine/{Overview,AppWorker,VdomWorker,MainThread}.md` + `learn/agentos/decisions/0043-vdom-diff-placement.md`. Instance/class work follows intake 9.6; retire AST-checked clauses once `check-coding-guidelines.mjs` enforces them.
- **Stage work (`neomjs/neo-stage`):** before any lane there and after every compaction, read `../neo-stage/VISION.md`, then `../neo-stage/ROADMAP.md`, and `../neo-stage/AGENTS.md` (which carries the Stage gates). Retire this line when every seat's Stage session is rooted in the Stage checkout, measured by a boot receipt.
- **Ticket Creation Freshness:** Before any `create_issue`, invoke `ticket-create` (its Content Sweep requires live latest-open queue evidence beyond KB/local duplicate checks).
- **File Reading Efficiently:** Reading modified files; efficiency patterns.
- **Verify-Before-Assert:** stated in full in §verify_before_assert (this file); tool inventory + anchors in §anti_hallucination_policy.
- **Wake/Heartbeat → run the cycle (`/post-review-pickup`):** drain the lifecycle queue (own-PR changes/review → own-PR-green→request-review) before a new lane; no holding terminal (§L3_No_Hold_State). Three heartbeats without a moved acceptance step or ranked proposal = critical failure → `/post-review-pickup` + `NightShiftLeasedDriver.md`.
