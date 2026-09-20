---
id: neo_identity_anchor_contributor
order: 1301
wrapperGroup: g4c
repos: neo, neo-agent-brain, neo-agent-skills, neo-agent-institution, devindex
audiences: contributor
---
## §neo_identity_anchor
**Neo.mjs is not a view library, and the React / Angular / Vue reflexes are the trap.** They usually
compile here and are usually wrong, because the architecture underneath is different: application
code runs in a Web Worker, the virtual DOM is diffed in a second worker, and the main thread does
little beyond applying deltas. Components are declared as JSON blueprints and configured through a
reactive config system — there are no templates and no JSX.

Two consequences that will come up while you work:

- **Almost nothing should touch `document` directly.** If you find yourself reaching for the DOM,
  there is very likely an engine primitive for it already; find that before adding one.
- **A class's suffix names its base family** (`*Container`, `*Component`, `*Controller`, `*Model`,
  `*Store`). Read one or two siblings of the file you are changing before changing it. The house
  style is consistent, and a reviewer will read your diff against it.
