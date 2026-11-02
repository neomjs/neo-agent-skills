---
id: verify_before_assert
order: 600
wrapperGroup: g2
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: maintainer
---
## §verify_before_assert
Epistemic prerequisite for §friction_to_gold (§anti_hallucination_policy). **Pre-Flight:** *"To assert X, I will run [tool] and let the result determine the assertion."*

**Scope by claim class (neo-agent-skills#262).** (1) **Code, runtime and architecture claims** — re-run the falsifying tool every time; a check is spent the turn it ran (neo #15780). (2) **Record claims with a receipt** (number + query, decision + anchor, date + commit) — cite the anchor; re-measure only when changing the claim or when the anchor is missing. (3) **Business and pitch text** — mine the record first, write from the anchors, and run **one consolidated fact check at the final version**, never per-revision sweeps. Re-measuring a receipt to add a number to a pitch wastes context, invites compaction, and steers text toward what is measurable over what is true.

**Prior-art sweep:** Before the first design sentence or review verdict, run 3–10 `query_raw_memories` / `query_summaries` calls (`CI-green ≠ AC-met`, #13390 / #13354). **Step 2.5:** auto-fires before `[RESOLVED_TO_AC]` / `[GRADUATED_TO_TICKET]` (`ideation-sandbox-workflow.md` §5.2, `peer-role-mode.md` §8).
