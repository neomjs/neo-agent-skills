---
name: structural-pre-flight
description: "Pre-implementation placement gate for .mjs files; use before authoring or relocating any .mjs file, or from ticket-create Stage 3, ticket-intake validation, epic-review Stage 3, or direct authoring."
---

# Structural Pre-Flight Skill

If you are about to author or relocate a `.mjs` file (new module, daemon, service, script, helper, etc.), you MUST immediately use the `view_file` tool to read and strictly adhere to `.agents/skills/structural-pre-flight/references/structural-pre-flight-workflow.md` before touching the filesystem.

The skill has two stages: Stage 0 mechanical trigger + Stage 1 30-second sibling-pattern fast-path vs full Pre-Flight (`ArchitectureOverview.md` + ADR consultation + chief-architect framing) for novel directory choices — closing the 0th-level discipline gap demonstrated by `ai/daemons/wake/daemon.mjs` and `orchestrator-daemon.mjs` (PR #11008). Always emit the explicit Pre-Flight reasoning-statement so future graph-traversal can audit the architectural choice.
