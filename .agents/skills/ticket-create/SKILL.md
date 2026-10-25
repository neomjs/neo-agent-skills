---
name: ticket-create
description: "Protocol for authoring Neo.mjs GitHub issues (creation-side dual of ticket-intake); use immediately before calling the create_issue MCP tool."
---

# Ticket Create Skill

If you are about to create a new GitHub issue, you MUST NOT compose the title, body, or labels ad-hoc — and you MUST NOT skip the pre-creation duplicate sweep.

You MUST immediately use the `view_file` tool to read and strictly adhere to `.agents/skills/ticket-create/references/ticket-create-workflow.md` before proceeding. Or, if you already have the payload in context, proceed directly to its directives.
## What it enforces
Enforces duplicate sweep, Fat Ticket body structure, strict label rules, title hygiene, and the six-stage challenge chain at creation time. **CRITICAL:** Do NOT run default `npx playwright test` to verify issues; Neo uses multiple custom Playwright configs (`unit`, `e2e`) that must be targeted explicitly.
