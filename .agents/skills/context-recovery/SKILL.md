---
name: context-recovery
description: "Reconstruct exact branch, PR, issue, and task state from live records; use immediately after /compact, context compression, resuming a summarized session, or detecting a lossy summary."
---

# Context Recovery Skill

If you are recovering after `/compact`, context compression, or a summarized-session resume, immediately read the runbook matching your workspace before asserting state or asking the user to re-explain:
- **Standalone / plugin / `--audience app` workspaces (no `neo-mjs-memory-core`):** read `.agents/skills/context-recovery/references/standalone-context-recovery.md`.
- **Agent OS maintainer workspaces (`neo-mjs-memory-core` mounted):** read `.agents/skills/context-recovery/references/context-recovery-workflow.md`.
