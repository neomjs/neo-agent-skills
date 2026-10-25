---
name: post-review-pickup
description: "Next-lane pickup protocol; use after PR review/state-chain, author commentId handoff, implementation completion, PR open/update, create_issue, row report, unblocking, or before first review in a fresh boot/wake."
---

# Post-Review Pickup Skill

If you just completed ANY lifecycle event that closes a discrete unit of work — PR review, chaining a formal GitHub review state, author review-response `commentId` handoff, implementation completion, PR open/update, ticket create (`create_issue`), row report, or blocked-state resolution — OR if you are about to accept the first PR review/re-review request in a fresh session or watchdog wake while no author lane is active, you MUST immediately use the `view_file` tool to read and strictly adhere to `.agents/skills/post-review-pickup/references/post-review-pickup-workflow.md` before proceeding or ending the turn.
## What it enforces
Prevents silent idle by requiring a lane from the board; blocked-state resolution applies to positive-path exit only (new blockers route to bug/follow-up plus next lane).
