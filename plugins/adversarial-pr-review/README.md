# Adversarial PR Review — Premise & Ticket-AC Gate — Official Claude Plugin

Review pull requests patch-blind against the linked GitHub issue's acceptance criteria, Contract Ledger, and real-state premise ('can the handled state exist in practice?') before reading the diff—catching wrong-premise, partial-AC, and architecture-drift PRs that pass green CI and style linters. Includes canonical PR authoring gates, git/gh technical-debt sweeps, and structured review templates via gh or chat.

Green CI and line-by-line style linters still approve pull requests that solve the wrong problem, handle states that never occur in production, or quietly drop acceptance criteria from the originating issue. These bundled skills build a patch-blind premise snapshot from the linked issue, Contract Ledger, and base source before inspecting the diff, audit real-state reachability and adjacent technical debt via `gh` and `git log`, and format actionable reviews with zero MCP setup (`contained` reach).

## Install

- **Marketplace (Claude Code):** run `claude plugin marketplace add neomjs/neo-agent-skills`, then `claude plugin install adversarial-pr-review@neomjs`.
- **Claude Directory (Claude Code, Cowork, Claude apps):** install **Adversarial PR Review — Premise & Ticket-AC Gate** (`adversarial-pr-review`) from `https://claude.ai/directory`.
- **From a local clone (`neomjs/neo-agent-skills`):** run `claude --plugin-dir ./plugins/adversarial-pr-review`.

## Bundled Skills

- **`pr-review`** — Use before reviewing a pull request, writing review feedback, or auditing PR evidence: checks the linked issue's ACs, Contract Ledger, and real-state premise against base source before reading the diff.
- **`pull-request`** — Use when code changes are complete, before git commit, before opening or updating a pull request, or when replying to PR review feedback: runs pre-commit reflection, AC/evidence checks, and structured handoff.
- **`tech-debt-radar`** — Use when asked to scan for technical debt, audit architectural drift, find abandoned workarounds or rollbacks in git/issue history, or check adjacent debt during a major refactor or PR review.
- **`upstream-skill-feedback`** — Opt-in protocol to report reproducible skill or plugin misfires upstream; use when an installed neo-agent-skills skill or plugin bundle hits an unmapped standalone step, false gate, or broken instruction.

## Local Plugin Validation

```bash
claude plugin validate ./plugins/adversarial-pr-review
npm run generate-claude-plugin -- --check
```
