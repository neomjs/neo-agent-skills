---
id: app_skills
order: 902
repos: neo-app-workspace
audiences: app
---
## §skills
Two skills ship with this workspace, in `.agents/skills/` and `.claude/skills/`:
- **`neo-app-authoring`** — read it before writing or changing anything under `apps/`. It covers
  the class shape, reactive configs, stores and models, state providers and styles.
- **`neural-link`** — use it to inspect and verify the running app. The app connects in development
  (`useAiClient` in `neo-config.json`) once the Neural Link MCP server is configured for your harness.

**Verify in the running app before you call a change done.** A passing build says the code parses.
The component tree, a store's records or a computed style says it works.
