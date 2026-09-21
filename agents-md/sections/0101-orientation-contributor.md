---
id: orientation_contributor
order: 101
repos: neo
audiences: contributor
---
## §orientation
**Get it running first.** `CONTRIBUTING.md` holds the loop and is the only copy of it: clone,
`npm install`, `npm run bundle-browser-deps`, `npm run build-themes -- -n -e dev -t all`,
`npm run server-start`. Both build steps matter — `dist/` is git-ignored, so a fresh clone has
neither, and skipping the first makes the unit suite select *zero* tests rather than fail one.

**Then spend fifteen minutes on why any of this exists.** Open
`http://localhost:8080/apps/workstation/index.html` and drag one of the panes out past the edge of
the browser window. It becomes a real operating-system window — still running, still the same
component instance, still driven by the same worker. (Allow popups for localhost first; when the
browser blocks one the gesture quietly falls back in-window and you see nothing.)
[`learn/benefits/Introduction.md`](https://github.com/neomjs/neo/blob/dev/learn/benefits/Introduction.md)
is the long-form version.

**Your agent needs nothing private.** The maintainers' own agents use a Knowledge Base and a Memory
Core that are not public, and you need neither: `neo-agent-skills` is published on npm, and
`npm install` already linked its skills into this checkout. The same testing, review and
pull-request skills the maintainers work from are available to you.

**Where to look.** `learn/guides/fundamentals/CodebaseOverview.md` for the layout, `src/` for the
engine, `apps/` and `examples/` for working code. The `.agents/` and `learn/agentos/` trees are the
maintainers' own operating layer — interesting, and not something you need to read to contribute.
