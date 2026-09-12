---
id: pre_commit_gates
order: 500
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: maintainer, contributor
---
## §pre_commit_gates
For any actionable request modifying the repository, you **MUST** pass two critical gating protocols *before* executing `git commit`.
- **Gate 1: The Ticket Gate:** Never commit without a valid, narrowly scoped ticket ID (`create_issue` + its workflow).
- **Gate 2: The Contextual Completeness Gate:** Apply the 'Anchor & Echo' Knowledge Base Enhancement Strategy to new/modified classes and methods; never commit code lacking JSDoc or `@summary` tags.

**Pre-Flight Check for Commits:**
> *"Pre-Flight Check: 1. Verify ticket number. 2. Verify Contextual Completeness. 3. Format commit `type(scope): message (#TICKET_ID)` without `<noreply@*>`."*
