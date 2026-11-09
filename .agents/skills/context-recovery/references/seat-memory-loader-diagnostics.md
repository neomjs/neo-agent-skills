# Seat-Memory Loader Diagnostics

> **Standalone / `--audience app` workspaces:** read [`standalone-context-recovery.md`](./standalone-context-recovery.md) instead.

Read during Agent OS `context-recovery` Step 6 when the generated memory layer
(`MEMORY.md` + `identity.md`) is absent from context:

- **Kimi:** check the identity-anchor hook (`config.toml` `[[hooks]]`, emitted
  hook script, sentinel state dir).
- **OpenCode:** check `instructions` in `opencode.jsonc` and verify `MEMORY.md`
  and `identity.md` are readable.
- **Fallback vs. mechanism:** manual re-hydration from own origin/identity
  memories + the recency feed is the fallback, not the mechanism. Never read
  `turnPresence.fresh` as load proof — it belongs to the sibling presence hook
  (`#15658`-class wiring) and can be green while the anchor loader is broken.
