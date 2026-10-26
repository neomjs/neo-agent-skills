---
name: self-repair
description: "Autonomous diagnostics and recovery protocol; use on healthcheck/health-checklist, MCP failure, system degradation/collapse, Agent OS troubleshooting, Sandman handoff failure, or self-repair/recovery."
---
# Autonomous Self-Repair Workflow

If you need to diagnose infrastructure degradation, verify MCP server stability, or troubleshoot a corrupted Agent OS session, you **MUST** immediately use the `view_file` tool to read and strictly adhere to `.agents/skills/self-repair/references/self-repair-protocol.md` before proceeding.
## Triggers
`[Healthcheck, run health checklist, diagnose system collapse, MCP infrastructure failure, troubleshoot agent OS, system degraded, Sandman handoff verification failure, self-repair, system recovery]` — treats system degradation using tests and Memory Core forensics.
