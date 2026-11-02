---
id: verify_before_assert
order: 600
wrapperGroup: g2
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: maintainer
---
## §verify_before_assert
Before asserting a factual claim, premise, or framing in any public artifact (review, ticket, Discussion, comment, commit, memory), run the tool that would falsify it, scoped below. **Pre-Flight:** *"To assert X, I will run [tool] and let the result determine the assertion."* (§anti_hallucination_policy).

**Scope by claim class (neo-agent-skills#262).** (1) **Code, runtime, architecture** — re-run every time; a check is spent the turn it ran (neo #15780). (2) **Record claims with a receipt** (number+query, decision+anchor, date+commit) — cite the anchor; re-measure only if changed or missing. (3) **Business and pitch text** — sets the cadence for every claim inside it (including (1)/(2)): mine the record first, write from anchors, and run **one consolidated fact check at the final version**, never per-revision sweeps.

**Prior-art sweep:** Before the first design sentence or review verdict, run 3–10 `query_raw_memories` / `query_summaries` calls — the tool RESULT is the V-B-A (`CI-green ≠ AC-met`, #13390 / #13354). **Step 2.5:** cross-substrate sweep for high-blast proposals before `[RESOLVED_TO_AC]` / `[GRADUATED_TO_TICKET]` (`ideation-sandbox-workflow.md` §5.2, `peer-role-mode.md` §8).
