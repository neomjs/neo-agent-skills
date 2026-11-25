---
name: session-sunset
description: "Write a structured session handover before ending a long session (>75% context window), before a quiet cross-lane or topic pivot, or on human wrap-up directive (never routine task completion/waits)."
---

# Session Sunset Skill

**🛑 ANTI-TRIGGERS (Completion Bias Guard) 🛑**
**Task Completion ≠ Session Sunset.** Unless the workflow's trigger 1 holds, you must **halt and wait for the next turn** (do NOT sunset) if you are:
1. **Halting for Peer Review:** Waiting for cross-family PR review or human feedback. This is an active lifecycle state, not a boundary.
2. **Single Task Completion:** Finishing one ticket/task while your context window is still healthy. Pick up the next task.
3. **Asynchronous Delays:** Waiting for CI, test results, or A2A responses.

Sunsets are strictly reserved for the workflow's §1 triggers: **Context Exhaustion or Cost**, **Macro-Semantic Pivots**, or **Explicit Human Directives**.

If you meet a valid sunset condition, you MUST immediately read and strictly adhere to `${CLAUDE_SKILL_DIR}/references/session-sunset-workflow.md` before terminating. This prevents Zero-State Amnesia.
