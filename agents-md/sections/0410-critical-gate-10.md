---
id: critical_gate_10
order: 410
listGroup: gates
listNumber: 10
repos: neo-agent-brain
audiences: maintainer
---
**No AiConfig work without reading ADR-0019 first.** Before authoring OR reviewing ANY `ai/` config touch, read [`0019-aiconfig-reactive-provider-ssot.md`](https://github.com/neomjs/neo-agent-brain/blob/dev/learn/agentos/decisions/0019-aiconfig-reactive-provider-ssot.md) in the Brain repository — no exception, no approval signal, no CI-green substitute (diligence is empirically insufficient: #12420 missed 4/4; #14499 shipped ≥2 violations past 2 reviews). The ADR §3 catalog is the forbidden-pattern list (pass-along/thread, re-derive/env-read, defensive `?.`, hidden defaults, runtime mutation, non-entrypoint `import AiConfig`/C1).
