---
name: ticket-create
description: "Use before drafting or filing a GitHub issue, bug report, or feature spec (via gh issue create or create_issue): sweeps open/closed duplicates, challenges wrong-layer prescriptions, and structures ACs."
---
# Ticket Create Skill

Before drafting or filing an issue, sweep latest open + open/closed issues and `git log` for duplicates or prior exclusions, challenge wrong-layer prescriptions against live source and ADRs, and structure explicit acceptance criteria and API/schema contracts.

- **Standalone / plugin workspace (`gh` + `git`):** read `.agents/skills/ticket-create/references/ticket-create-workflow.md` (`Standalone` block + §1a, §2, §5), follow the repository's own issue conventions, and draft in chat before running `gh issue create` only when asked.
- **Agent OS maintainer (`neo-mjs-memory-core`):** read `.agents/skills/ticket-create/references/ticket-create-workflow.md` (A2A claim + `ask_knowledge_base`/`query_raw_memories` sweeps, Fat-Ticket + Contract-Ledger labels, targeted Playwright configs — never default `npx playwright test`), and file via `create_issue`.
