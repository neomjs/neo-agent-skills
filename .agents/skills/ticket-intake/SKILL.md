---
name: ticket-intake
description: "Pre-execution reflection gate for GitHub issues; use before branching or modifying code on any assigned/claimed ticket (full gate if peer-authored, or prescription/drift probe if self-authored)."
---

# Ticket Intake Skill

If you are an agent tasked with executing a ticket or issue whose authoring you did not see, you MUST NOT begin executing Git branch commands or writing code before running the Pre-Execution Reflection Gate (architectural validation, negative ROI calculation, and duplicate sweeps).

You MUST immediately use the `view_file` tool to read and strictly adhere to `.agents/skills/ticket-intake/references/ticket-intake-workflow.md` before proceeding. Or, if you already have the payload in context, proceed directly to its directives.

Ticket you authored yourself: read `references/self-authored-carve.md` FIRST — a ticket authored this session is exempt EXCEPT the prescription check; one authored in an earlier session runs a cheap drift probe instead (never an exemption you judge for yourself).
