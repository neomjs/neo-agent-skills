---
name: epic-review
description: "Use before starting the first sub-issue of an unreviewed multi-issue epic, when asked to review or pre-validate an epic, or after its source RFC/Discussion: checks roadmap fit, prerequisites, and sub-issue overlap."
---
# Epic Review Skill

Before starting a sub-issue or approving an epic, run the gated six-stage check (roadmap fit, approach elegance, source-Discussion mapping, sub-structure coherence, prescription layer, avoided traps), halting sub-issue pickup (`Revisions Requested`) on gaps.

- **Standalone / plugin workspace (`gh` + `git`):** read `${CLAUDE_SKILL_DIR}/references/epic-review-workflow.md` (`Standalone` block + §3), inspect sub-issues via `gh api repos/<owner>/<repo>/issues/<N>/sub_issues`, and deliver the review in chat unless asked to post on GitHub.
- **Agent OS maintainer (`neo-mjs-memory-core`):** read `${CLAUDE_SKILL_DIR}/references/epic-review-workflow.md` (never review your own epic; one-shot per identity cites prior review URL; read `${CLAUDE_SKILL_DIR}/references/participant-path.md` if you authored the epic or joined its source Discussion) and post the structured review comment.
