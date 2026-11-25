---
name: pull-request
description: "Use when code changes are complete, before git commit, before opening or updating a pull request, or when replying to PR review feedback: runs pre-commit reflection, AC/evidence checks, and structured handoff."
---
# Pull Request Skill

Step back before `git commit`, opening/updating a PR, or answering review feedback: verify every linked-issue AC and Contract-Ledger row against production-path evidence, format `type(scope): summary (#N)` commits without `<noreply@*>` footers, and read `${CLAUDE_SKILL_DIR}/references/pull-request-workflow.md` first.

- **Standalone / contributor workspace:** follow the public branch, test, canonical §9 body, and `gh pr` review-response path; never run `gh pr merge`.
- **Agent OS maintainer workspace:** follow [Evidence Ladder](neomjs/neo-agent-brain:learn/agentos/process/evidence-ladder.md) claims, custom Playwright configs (never default `npx playwright test`), cross-family review, and §14 A2A handoff.
