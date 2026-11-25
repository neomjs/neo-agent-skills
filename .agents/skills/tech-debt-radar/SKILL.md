---
name: tech-debt-radar
description: "Use when asked to scan for technical debt, audit architectural drift, find abandoned workarounds or rollbacks in git/issue history, or check adjacent debt during a major refactor or PR review."
---
# Tech Debt Radar

Derive the living architecture canon from repo docs/ADRs before sweeping history (never invent taste-based rules), separate `authority` (canon), `observation` (current tree/LOC/churn), and `hypothesis` (candidate debt), and report findings in chat without filing issues unless asked.

- **Standalone / plugin workspace (`gh` + `git`):** read `.agents/skills/tech-debt-radar/references/tech-debt-radar-guide.md` (§5 + §2) and sweep `git log -S` / `--grep="revert|rollback|workaround|FIXME"` + `gh issue/pr list --state all`.
- **Agent OS maintainer (`neo-mjs-memory-core`):** read `.agents/skills/tech-debt-radar/references/tech-debt-radar-guide.md` (§1–§4) and sweep `ask_knowledge_base`, `query_raw_memories`, and `ai:structure-map`.
