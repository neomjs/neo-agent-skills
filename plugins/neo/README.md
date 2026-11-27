# Neo.mjs — Official Claude Plugin

Build data grids, Gantt charts, schedulers, kanban boards and multi-window web desktops with Neo.mjs, which runs components, stores and state in workers, off the main thread. Includes the Neural Link workflow: inspect and patch a running app's live component tree, stores and DOM instead of reloading and screenshotting.

Neo.mjs keeps UI components, data stores, and state providers alive as persistent object graphs off the main thread. Pair these bundled skills with the published `neo-neural-link` MCP bridge so Claude can inspect the live component tree, query stores and state providers, simulate events, measure DOM geometry, and hot-patch running code without reloads.

## Install

- **Marketplace (Claude Code):** run `claude plugin marketplace add neomjs/neo-agent-skills`, then `claude plugin install neomjs@neomjs`.
- **Claude Directory (Claude Code, Cowork, Claude apps):** install **Neo.mjs** (`neomjs`) from `https://claude.ai/directory`.
- **From a local clone (`neomjs/neo-agent-skills`):** run `claude --plugin-dir ./plugins/neo`.

## Connect the Live Neural Link MCP Bridge

The bundled `neural-link` skill drives the `neo-neural-link` MCP tools. Because unverified directory plugins do not auto-start local `stdio` servers, register the published `neo-neural-link` server (`Node.js >= 24.0.0`) once in your workspace:

```bash
claude mcp add neo-neural-link -- npx -y neo-neural-link
```

## Bundled Skills

- **`context-recovery`** — Reconstruct exact branch, PR, issue, and task state from live records; use immediately after /compact, context compression, resuming a summarized session, or detecting a lossy summary.
- **`neo-app-authoring`** — Write Neo.mjs engine, app, and example code idiomatically: classes, reactive configs, [mergeFrom], stores, state providers, CSS. Use before writing or changing anything under src/, apps/, or examples/.
- **`neural-link`** — Tactical guide for Neural Link MCP tools on live Neo.mjs apps; use when asked to interact with the browser, inspect UI natively, patch live code, or use the Neural Link.
- **`upstream-skill-feedback`** — Opt-in protocol to report reproducible skill or plugin misfires upstream; use when an installed neo-agent-skills skill or plugin bundle hits an unmapped standalone step, false gate, or broken instruction.

## Local Plugin Validation

```bash
claude plugin validate ./plugins/neo
npm run generate-claude-plugin -- --check
```
