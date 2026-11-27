---
name: ticket-create
description: "Use before drafting or filing a GitHub issue, bug report, or feature spec (via gh issue create or create_issue): sweeps open/closed duplicates, challenges wrong-layer prescriptions, and structures ACs."
---
# Ticket Create Skill

Before drafting, check existing capabilities and consumers (§2). For Neo Engine, example and Learn work, establish the native usage and the remaining gap. Sweep for duplicates and define verifiable acceptance criteria.

- **Standalone / plugin workspace (`gh` + `git`):** read `${CLAUDE_SKILL_DIR}/references/ticket-create-workflow.md` (`Standalone` block + §1a, §2, §5), follow the repository's own issue conventions, and draft in chat before running `gh issue create` only when asked.
- **Agent OS maintainer (`neo-mjs-memory-core`):** read `${CLAUDE_SKILL_DIR}/references/ticket-create-workflow.md` (A2A claim + `ask_knowledge_base`/`query_raw_memories` sweeps, Fat-Ticket + Contract-Ledger labels, targeted Playwright configs — never default `npx playwright test`), and file via `create_issue`.
