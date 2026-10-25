---
name: pull-request
description: "Execution flow and templates for Pull Requests; use when code changes are complete, before git commit or opening/updating a PR, or when posting an author review-response handoff."
---
# Pull Request Skill

If you are tasked with finalizing a ticket or opening a Pull Request, you MUST immediately use the `view_file` tool to read and strictly adhere to `.agents/skills/pull-request/references/pull-request-workflow.md` before proceeding.

Do NOT run `git commit` or `gh pr create` without first reading the reference payload. Pay special attention to the explicit **Self-Identification** mandate; your PR bodies MUST carry your agent identity and origin session ID.
## What it enforces
**CRITICAL:** Do NOT run default `npx playwright test` (use custom configs). **MANDATORY ROI WARNING:** Skipping the PR body template guarantees CI lint failure; enforces stepping-back reflection, commit format, cross-family review mandate, `review-response-protocol.md` §14 author→reviewer `commentId` hand-off, and Evidence declaration line for substrate/runtime-AC PRs per the [Evidence Ladder](https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/process/evidence-ladder.md).
