---
id: critical_gate_8
order: 408
listGroup: gates
listNumber: 8
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: maintainer
---
**No agent-authored PRs targeting `main`.** Agent-authored pull requests target `dev`. `main` is release-only; `main`-targeted PRs require explicit operator release direction. Release-line mutation happens via `buildScripts/release/publish.mjs` (the atomic release commit `dev` → `main`).
