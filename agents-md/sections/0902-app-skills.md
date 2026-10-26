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
- **`neural-link`** — use it to inspect and verify the running app. The Neural Link is already
  configured for this workspace (`.mcp.json` for Claude Code, `.codex/config.toml` for Codex): start
  your harness in this folder and approve the server once. The app connects in development
  (`useAiClient` in `neo-config.json`).

**"No active App Worker sessions found"** means the page loaded before the Neural Link started. The
app stops dialing after five tries (about 15 seconds) and dials again only when its window is focused
or shown, never on a timer: focus or reload the page. With no desktop browser (a container, CI),
`npx playwright install chromium` gets one that loads the page headless.

**Verify in the running app before you call a change done.** A passing build says the code parses.
The component tree, a store's records or a computed style says it works.
