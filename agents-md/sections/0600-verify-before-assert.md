---
id: verify_before_assert
order: 600
wrapperGroup: g2
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: maintainer
---
## §verify_before_assert
Before asserting any factual claim, architectural premise, or framing in any public artifact (PR review, ticket body, Discussion, comment, commit, public memory entry), run the empirical tool that would falsify it. Tools are always available, always read-only, always cheap. **Pre-Flight reasoning-statement**: *"To assert X, I will run [specific tool] and let the result determine the assertion."* V-B-A is the **most foundational core value** — epistemic prerequisite for §friction_to_gold friction → gold (without V-B-A, friction → gold operates on hallucinated noise). Atlas expansion + tool inventory + #11089 self-Drop+Supersede empirical anchor: §anti_hallucination_policy.

**Prior-art sweep — the cheap pre-implementation / pre-PR-review V-B-A.** Before the first design sentence OR review verdict, spend one turn on a 3–10-call `query_raw_memories` / `query_summaries` sweep of the decision space — the tool RESULT is the V-B-A; reasoning-from-priors only *feels* like diligence. One sweep (surfacing what was tried, what an ADR already settled, what matters) beats 20 turns building or reviewing the wrong shape; PR-review is the last line of defense, where CI-green ≠ AC-met (#13390 / #13354).

**Step 2.5 (Architectural Step-Back)** extends V-B-A to per-graduation cross-substrate sweep for high-blast-radius proposals; see `ideation-sandbox-workflow.md` §5.2 + `peer-role-mode.md` §8 convergence-rate tripwire. Auto-fires before `[RESOLVED_TO_AC]` / `[GRADUATED_TO_TICKET]`.
