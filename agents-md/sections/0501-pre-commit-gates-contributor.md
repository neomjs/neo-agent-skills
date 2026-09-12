---
id: pre_commit_gates_contributor
order: 501
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: contributor
---
## §pre_commit_gates
Before executing `git commit`, pass the Contextual Completeness gate: apply the 'Anchor & Echo'
strategy to new and modified classes and methods, and never commit code lacking JSDoc or `@summary`
tags. Commit subjects follow `type(scope): message`.

Open an issue describing the problem before a non-trivial change, and link it from the pull request.
