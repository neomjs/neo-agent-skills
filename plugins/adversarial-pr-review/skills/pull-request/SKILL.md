---
name: pull-request
description: "Use when code changes are complete, before git commit, before opening or updating a pull request, or when replying to PR review feedback: runs pre-commit reflection, AC/evidence checks, and structured handoff."
---
# Pull Request Skill

Before committing, opening or updating a PR, or replying to review feedback, step back to verify every linked-issue AC and contract against real production-path evidence (never trust green CI over manufactured state or overclaim closing keywords), and read `${CLAUDE_SKILL_DIR}/references/pull-request-workflow.md`.

- **Standalone / non-`neomjs` repository:** follow that repository's own commit format, attribution, PR template, and default branch (`CONTRIBUTING.md`, recent `git log`, `gh repo view --json defaultBranchRef`); deliver drafted PR/reply text in chat unless asked to run `gh pr`, and never run `gh pr merge` unasked.
- **`neomjs` repository (`contributor` or `Agent OS maintainer`):** enforce `type(scope): summary (#N)` subjects, no `<noreply@*>` / harness backlinks, `--base dev`, canonical §9 body, custom Playwright configs (never default `npx playwright test`), and (maintainers) [Evidence Ladder](neomjs/neo-agent-brain:learn/agentos/process/evidence-ladder.md), cross-family review, and §14 A2A handoff.
