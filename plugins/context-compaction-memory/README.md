# Context Compaction Recovery & Session Handover — Official Claude Plugin

After /compact or across fresh sessions, reconstruct exact branch, PR, issue, and decision state from structured git/gh and turn records instead of trusting lossy summaries. Includes session-sunset handovers to end long sessions without amnesia, prior-art mining before diagnosing regressions or proposing architecture, and Map-vs-Atlas byte-budget guards so CLAUDE.md and AGENTS.md never bloat or truncate.

Context compaction (`/compact`) and session boundaries routinely replace exact commit SHAs, review states, and rejected hypotheses with lossy summaries. These bundled skills reconstruct live state from structured `git`/`gh` and handover records, write structured `.agents/handover.md` session handovers before closing a window, mine prior commits/issues/decisions before re-deriving architecture, and enforce Map-vs-Atlas byte budgets across `CLAUDE.md`, `AGENTS.md`, and skill routers (`contained` reach, local storage, zero external account).

## Install

- **Marketplace (Claude Code):** run `claude plugin marketplace add neomjs/neo-agent-skills`, then `claude plugin install context-compaction-memory@neomjs`.
- **Claude Directory (Claude Code, Cowork, Claude apps):** install **Context Compaction Recovery & Session Handover** (`context-compaction-memory`) from `https://claude.ai/directory`.
- **From a local clone (`neomjs/neo-agent-skills`):** run `claude --plugin-dir ./plugins/context-compaction-memory`.

## Bundled Skills

- **`context-recovery`** — Reconstruct exact branch, PR, issue, and task state from live records; use immediately after /compact, context compression, resuming a summarized session, or detecting a lossy summary.
- **`memory-mining`** — Search prior commits, issues, decisions, and session memory before diagnosing regressions ('used to work', surprise validation failures), proposing architecture or roadmaps, or starting work or PR review.
- **`session-sunset`** — Write a structured session handover before ending a long session (>75% context window), at a quiet point before switching to unrelated work, or on a wrap-up request (never on task completion/waits).
- **`turn-memory-pre-flight`** — Use when asked to add, append or paste anything into CLAUDE.md or AGENTS.md (loaded into every session): decides whether it belongs there or in an on-demand skill or doc, before you propose or edit.
- **`upstream-skill-feedback`** — Opt-in protocol to report reproducible skill or plugin misfires upstream; use when an installed neo-agent-skills skill or plugin bundle hits an unmapped standalone step, false gate, or broken instruction.

## Local Plugin Validation

```bash
claude plugin validate ./plugins/context-compaction-memory
npm run generate-claude-plugin -- --check
```
