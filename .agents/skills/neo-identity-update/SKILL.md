---
name: neo-identity-update
description: "Protocol for coherent Neo identity updates across all surfaces; use when changing taglines/positioning/descriptions/keywords/pillars/CTAs, asked to update identity/README/branding, framing is outgrown, or facts drift."
---

# Neo Identity Update Skill

Neo's identity is distributed across ~30+ surfaces; editing one (e.g. README) leaves machine-facing JSON, build-generated SEO files, external platform settings, and CTA targets drifting silently. Before changing ANY identity surface (tagline, description, keywords, pillar story, CTA / next-step door, or a drifted fact like version / MCP-server-count / Node-req), you MUST read `.agents/skills/neo-identity-update/references/update-protocol.md` and follow it — it routes to the surface inventory, facts ledger, framing-governance payload, and CTA-governance payload.

**Non-negotiables:** FACTS converge to one source (derive/coherence-check the rest); FRAMING stays audience-segmented against the README apex (escalate contradictions, never find-replace); ACTIONS / CTAs keep pitches from dead-ending and surface proof without inventing business-owned offer content; never edit build-generated output (edit the generator `buildScripts/docs/seo/generate.mjs`); every identity-surface PR needs a cross-family review; never name a client/partner/customer. Foundation: [ADR 0018](https://github.com/neomjs/neo/blob/dev/learn/agentos/decisions/0018-neo-identity-source-of-truth-model.md).
