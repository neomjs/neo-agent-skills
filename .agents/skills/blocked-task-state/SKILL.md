---
name: blocked-task-state
description: "Protocol for signaling blocked or input-required task states; use when execution becomes blocked, requires operator input, or hits a halting failure."
---

# Blocked Task-State Coordination

If you are an agent and your task transitions into a blocked, input-required, or failed state, you MUST NOT broadcast a global idle signal; this protocol mandates targeted A2A pings using the `Task.state` envelope rather than global capacity broadcasts.

You MUST immediately use the `view_file` tool to read and strictly adhere to `.agents/skills/blocked-task-state/references/blocked-task-state-workflow.md` before sending any A2A messages.
