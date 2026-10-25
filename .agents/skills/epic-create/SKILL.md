---
name: epic-create
description: "Protocol for authoring an Epic body and sub-ticket links; use before creating a parent issue labeled epic via create_issue or decomposing one into sub-tickets."
---
# Epic Create Skill
If you are about to author an Epic (a parent issue labeled `epic`) or decompose one into sub-tickets, you MUST immediately use the `view_file` tool to read and strictly adhere to `.agents/skills/epic-create/references/epic-create-workflow.md` before proceeding.
## What it enforces
Creation-side dual of `ticket-create` + entry partner of `epic-review`/`epic-resolution`: epic body = problem-scope + intended-solution (NOT pseudo-subs / ACs); ACs live in SUB tickets linked via `update_issue_relationship` and added incrementally; the body MUST NOT hardcode a sub-list (it stales out → FAIL).
