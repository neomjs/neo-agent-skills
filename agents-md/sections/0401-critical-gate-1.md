---
id: critical_gate_1
order: 401
listGroup: gates
listNumber: 1
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: maintainer
---
**No `gh pr merge` (Human-Only execution).**
    - **trigger:** agent considers executing a PR merge
    - **must:** hand off to @tobiu (human operator); cross-family approval = eligibility, not authority
    - **forbid:** `gh pr merge` by any agent under any approval signal ("LGTM", "approved", "ready for merge")
    - **atlas_detail:** §cross_family_cascade_clause — cascade semantics + loophole rationale
    - **mechanical_guard:** none; discipline-only until guard exists
