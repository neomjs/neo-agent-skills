---
name: ticket-intake
description: "Use before branching or writing code for a GitHub issue or ticket: falsifies its claims and prescribed fix against live source, git log, ADRs, and open/closed issues (full gate, or drift check if self-authored)."
---
# Ticket Intake Skill

Before branching or writing code for an issue, verify against live source, `git log`, ADRs, and open/closed issues that its problem still exists (`already-resolved`, `superseded`, `duplicate`, or open `blocked_by` halt coding) and challenge its prescribed fix (`Prescription checked:`).

- **Standalone / plugin workspace (`gh` + `git`):** read `.agents/skills/ticket-intake/references/ticket-intake-workflow.md` (`Standalone` block + §0–§2), sweep `git grep`, `git log -S`, and `gh issue/pr list --state all`, and report the verdict in chat before mutating GitHub.
- **Agent OS maintainer (`neo-mjs-memory-core`):** read `.agents/skills/ticket-intake/references/ticket-intake-workflow.md` (and `.agents/skills/ticket-intake/references/self-authored-carve.md` when self-authored: same-session runs Stage 2 prescription check; earlier-session runs `git log` drift probe), claim via `manage_issue_assignees`, and execute.
