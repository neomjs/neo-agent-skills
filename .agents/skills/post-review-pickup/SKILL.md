---
name: post-review-pickup
description: "Maintainer next-lane pickup; use after PR review/state-chain, author handback, implementation completion, PR open/update, create_issue, row report, unblocking, or before first review in a fresh boot/wake."
---

# Post-Review Pickup Skill

For a declared maintainer (the default when undeclared), after the lifecycle events above—or before first review intake with no author lane—read `.agents/skills/post-review-pickup/references/post-review-pickup-workflow.md` before proceeding or ending the turn. Contributors return the public PR/CI state to their operator; no private pickup or new lane is required. Missing tools never infer an audience.
## What it enforces
Prevents silent idle by requiring a lane from the board; blocked-state resolution applies to positive-path exit only (new blockers route to bug/follow-up plus next lane).
