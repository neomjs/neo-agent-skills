---
name: context-recovery
description: "Post-compaction runbook for reconstructing active lane state; use immediately after context compaction/compression, resuming a summarized session, or detecting a lossy summary."
---

# Context Recovery Skill

If you are recovering after context compaction/compression or a summarized-session resume, immediately read the runbook matching your workspace before asserting lane state or asking the user to re-explain:
- **Agent OS maintainer workspaces (`neo-mjs-memory-core` mounted):** read `.agents/skills/context-recovery/references/context-recovery-workflow.md`.
- **Standalone / `--audience app` workspaces (no `neo-mjs-memory-core`):** read `.agents/skills/context-recovery/references/standalone-context-recovery.md`.
