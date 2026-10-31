---
name: session-sunset
description: "End a session without Zero-State Amnesia; use at ≤200k context tokens (the wake plane's gate; >75% window only without a gauge), a macro-semantic pivot, or human directive (never task completion/wait)."
---

# Session Sunset Skill

**🛑 ANTI-TRIGGERS (Completion Bias Guard) 🛑**
**Task Completion ≠ Session Sunset.** Unless the workflow's trigger 1 holds, you must **halt and wait for the next turn** (do NOT sunset) if you are:
1. **Halting for Peer Review:** Waiting for cross-family PR review or human feedback. This is an active lifecycle state, not a boundary.
2. **Single Task Completion:** Finishing one ticket/task while your context window is still healthy. Pick up the next task.
3. **Asynchronous Delays:** Waiting for CI, test results, or A2A responses.

Sunsets are strictly reserved for the workflow's §1 triggers: **Context Exhaustion or Cost**, **Macro-Semantic Pivots**, or **Explicit Human Directives**.

If you meet a valid sunset condition, you MUST immediately use the `view_file` tool to read and strictly adhere to `.agents/skills/session-sunset/references/session-sunset-workflow.md` before terminating. This prevents Zero-State Amnesia.
