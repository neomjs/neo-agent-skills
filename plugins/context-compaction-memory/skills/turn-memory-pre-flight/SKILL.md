---
name: turn-memory-pre-flight
description: "Use when asked to add, append or paste anything into CLAUDE.md or AGENTS.md (loaded into every session): decides whether it belongs there or in an on-demand skill or doc, before you propose or edit."
---

# Turn Memory Pre-Flight

Keep `CLAUDE.md` and `AGENTS.md` strictly for every-turn universal rules (`trigger-frequency × failure-severity × enforceability`); route task workflows and rare runbooks to on-demand skills/docs and keep incident history in commits/issues. Applies before mutating `CLAUDE.md`, `AGENTS.md`, `AGENTS_ATLAS.md`, `.claude/skills/**`, `.agents/skills/**`, `.codex/CODEX.md`, or `.agents/ANTIGRAVITY_RULES.md`.

**MANDATORY ACTION:** Read `${CLAUDE_SKILL_DIR}/references/turn-memory-pre-flight-workflow.md` before proposing or editing.
