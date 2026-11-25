---
name: pr-review
description: "Use before reviewing a pull request, writing review feedback, or auditing PR evidence: checks the linked issue's ACs, Contract Ledger, and real-state premise against base source before reading the diff."
---
# PR Review Skill

Build a patch-blind premise snapshot from the linked issue's ACs, Contract Ledger, and base source *before* trusting the diff; verify the handled state is reachable via public behavior (`CI-green != AC-met`, reject monkey-patched tautologies and fail-open coercion), and deliver the review in chat unless asked to post on GitHub.

- **Standalone / plugin workspace (`gh` + `git`):** read `${CLAUDE_SKILL_DIR}/references/pr-review-guide.md` (`Standalone` block + §0–§9) and sweep prior art via `git log -S` + `gh pr/issue list --state all --search`.
- **Agent OS maintainer (`neo-mjs-memory-core`):** read `${CLAUDE_SKILL_DIR}/references/pr-review-guide.md`, run `3–10` `query_raw_memories`/`query_summaries` calls (#13354) + `${CLAUDE_SKILL_DIR}/references/reviewer-instrument-audit.md` for absence claims, and use `${CLAUDE_SKILL_DIR}/assets/pr-review-template.md` (`${CLAUDE_SKILL_DIR}/assets/pr-review-micro-review-template.md` §6.4; `${CLAUDE_SKILL_DIR}/assets/pr-review-round-2-template.md` Round 2; `${CLAUDE_SKILL_DIR}/audits/review-cost-circuit-breaker.md` >24KB).
