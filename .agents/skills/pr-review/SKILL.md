---
name: pr-review
description: "Use before reviewing a pull request, writing review feedback, or auditing PR evidence: checks the linked issue's acceptance criteria, API/schema contracts, and real-state premise against base source first."
---
# PR Review Skill

Build a patch-blind premise snapshot from the linked issue, its acceptance criteria and contracts, and base-branch source *before* trusting the PR's self-summary or diff: verify every issue AC is delivered, closing keywords (`Closes`/`Fixes`/`Resolves`) never overclaim partial work, and any handled state is reachable via public behavior (`CI-green != AC-met`).

- **Standalone / plugin workspace (`gh` + `git`):** read `.agents/skills/pr-review/references/pr-review-guide.md` (`Standalone` block + §0–§9), sweep prior art via `git log -S` + `gh pr/issue list --state all --search`, and deliver the review in chat unless asked to post on GitHub.
- **Agent OS maintainer (`neo-mjs-memory-core`):** read `.agents/skills/pr-review/references/pr-review-guide.md`, run `3–10` `query_raw_memories`/`query_summaries` calls (#13354) + `.agents/skills/pr-review/references/reviewer-instrument-audit.md` when the diff adds a capability gate, flag, or new field or the review claims an absence, and submit via `manage_pr_review` using `.agents/skills/pr-review/assets/pr-review-template.md` (`.agents/skills/pr-review/assets/pr-review-micro-review-template.md` §6.4; `.agents/skills/pr-review/assets/pr-review-round-2-template.md` Round 2; `.agents/skills/pr-review/audits/review-cost-circuit-breaker.md` >24KB).
