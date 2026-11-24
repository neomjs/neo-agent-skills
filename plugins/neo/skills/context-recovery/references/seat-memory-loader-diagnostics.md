# Seat-Memory Loader Diagnostics

> **Standalone / `--audience app` workspaces:** read [`standalone-context-recovery.md`](./standalone-context-recovery.md) instead.

When the generated memory layer (`MEMORY.md` + `identity.md`) is absent in Step 6:

- **Kimi:** check the identity-anchor hook (`config.toml` `[[hooks]]`, emitted hook script, sentinel state dir).
- **OpenCode:** check `instructions` in `opencode.jsonc` and verify `MEMORY.md` + `identity.md` are readable.
- **Fallback:** manual re-hydration from own origin/identity memories + recency feed is the fallback, not the mechanism.
