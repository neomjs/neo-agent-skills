---
name: context-recovery
description: "Post-compaction runbook for reconstructing active lane state; use immediately after context compaction/compression, resuming a summarized session, or detecting a lossy summary."
---

# Context Recovery Skill

If you are recovering after context compaction/compression or a summarized-session resume, you MUST immediately use the `view_file` tool to read and strictly adhere to `.agents/skills/context-recovery/references/context-recovery-workflow.md` to reconstruct active lane state from Memory Core recency, semantic recall, session rollups, and A2A before asserting lane state or asking the operator to re-explain.
