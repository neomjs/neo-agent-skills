---
name: epic-resolution
description: "Closeout exit-gate protocol for parent epics; use when the last required sub closes, a peer claims an epic is complete/substrate-complete, before closing an epic as COMPLETED, or on an epic-readiness broadcast."
---
# Epic Resolution
If you are about to declare an epic complete, close an epic, propose creating new subs to complete one, or react to a peer broadcast that an epic is "ready for handoff" / "components look solid", you MUST immediately use the `view_file` tool to read and strictly adhere to `.agents/skills/epic-resolution/references/epic-resolution-workflow.md` before posting any verdict or recommendation.
## What it enforces
Exit-gate sibling to `epic-review`: answers "we resolved all epic subs, are we done now?" with a structured matrix + verdict recommendation (`close` / `keep open` / `create missing subs` / `retire-supersede`) reconciled against parent ACs.
