# Neo.mjs — Claude Code Plugin Bundle

Install Neo.mjs application-authoring skills and the **Neural Link** live runtime MCP bridge in one unit.

Neo.mjs keeps UI components, data stores, and state providers alive as persistent object graphs inside Web Workers and SharedWorkers across native browser windows. Through the bundled `neo-neural-link` MCP server (`npx -y neo-neural-link`), Claude Code inspects the live component tree, queries stores and state providers, simulates events, measures DOM geometry, and hot-patches running code without reloads.

## Bundled Skills (`app` audience)

- **`context-recovery`** — Post-compaction runbook for reconstructing active lane state; use immediately after context compaction/compression, resuming a summarized session, or detecting a lossy summary.
- **`neo-app-authoring`** — Write app code in a neo.mjs workspace the engine's way: classes, reactive configs, stores, state providers, CSS. Triggers: before writing or changing anything under apps/ in a workspace built on neo.mjs.
- **`neural-link`** — Tactical guide for Neural Link MCP tools on live Neo.mjs apps; use when asked to interact with the browser, inspect UI natively, patch live code, or use the Neural Link.

## Bundled MCP Server (`.mcp.json`)

- **`neo-neural-link`** (`npx -y neo-neural-link`, Node.js `>= 24.0.0`) — whitebox runtime bridge for running Neo.mjs apps.

## Local Validation & Development

```bash
claude plugin validate ./plugins/neo
claude --plugin-dir ./plugins/neo
```
