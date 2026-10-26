---
id: app_orientation
order: 901
repos: neo-app-workspace
audiences: app
---
## §orientation
**The workspace.** Each app lives under `apps/<name>/`. `app.mjs` starts it with `Neo.app({mainView})`,
`view/` holds its classes, and `neo-config.json` is its engine configuration. `npm run server-start`
serves the workspace and opens it. `npm run build-themes` compiles `resources/scss/`.

**The engine runs your app in a worker.** Your classes run in the App worker; the main thread only
applies DOM deltas. A view is a tree of configs (`items`, `layout`, `cls`), not markup. You never
touch `document`; the engine renders through its own virtual DOM.

**Look things up, don't guess.** Every class and its documented configs are in
`node_modules/neo.mjs/src/`, the guides are in `node_modules/neo.mjs/learn/`, and working apps are in
`node_modules/neo.mjs/apps/` and `node_modules/neo.mjs/examples/`. Online, `https://neomjs.com/llms.txt`
indexes the docs as plain text.
