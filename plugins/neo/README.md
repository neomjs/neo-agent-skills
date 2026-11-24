# Neo.mjs — Official Claude Plugin

Author and live-inspect multi-threaded **Neo.mjs** applications across Web Workers, SharedWorkers, and native browser windows.

Neo.mjs keeps UI components, data stores, and state providers alive as persistent object graphs off the main thread. Pair these bundled skills with the published `neo-neural-link` MCP bridge so Claude can inspect the live component tree, query stores and state providers, simulate events, measure DOM geometry, and hot-patch running code without reloads.

## Bundled Skills (`app` audience)

- **`context-recovery`** — Post-compaction runbook for reconstructing active lane state; use immediately after context compaction/compression, resuming a summarized session, or detecting a lossy summary.
- **`neo-app-authoring`** — Write app code in a neo.mjs workspace the engine's way: classes, reactive configs, stores, state providers, CSS. Triggers: before writing or changing anything under apps/ in a workspace built on neo.mjs.
- **`neural-link`** — Tactical guide for Neural Link MCP tools on live Neo.mjs apps; use when asked to interact with the browser, inspect UI natively, patch live code, or use the Neural Link.

## Connect the Live Neural Link MCP Bridge

Register the published `neo-neural-link` stdio server (`Node.js >= 24.0.0`) in your workspace:

```bash
claude mcp add neo-neural-link -- npx -y neo-neural-link
```

## Local Plugin Validation & Development

```bash
claude plugin validate ./plugins/neo
claude --plugin-dir ./plugins/neo
```
