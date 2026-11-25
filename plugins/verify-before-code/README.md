# GitHub Issue & Epic Pre-Code Spec Gate — Official Claude Plugin

Before coding a GitHub issue, filing a bug or feature spec, or starting a multi-issue epic, falsify every assumption against live source, git history, and open/closed issues first so you never implement stale, duplicate, or wrong-premise tickets. Enforces pre-code prescription checks, explicit API/schema contracts, duplicate sweeps, and six-stage epic validation via gh and git.

Coding agents picking up GitHub issues or decomposing multi-issue epics routinely implement stale assumptions, prescribe fixes in the wrong architectural layer, or file duplicate specs. These bundled skills falsify issue claims against live source and open/closed `gh` history before branching, enforce six-stage prescription and Contract-Ledger specs when drafting issues, and gate multi-issue epics on roadmap fit, approach elegance, and sub-issue coherence (`contained` reach, zero MCP setup).

## Install

- **Marketplace (Claude Code):** run `claude plugin marketplace add neomjs/neo-agent-skills`, then `claude plugin install verify-before-code@neomjs`.
- **Claude Directory (Claude Code, Cowork, Claude apps):** install **GitHub Issue & Epic Pre-Code Spec Gate** (`verify-before-code`) from `https://claude.ai/directory`.
- **From a local clone (`neomjs/neo-agent-skills`):** run `claude --plugin-dir ./plugins/verify-before-code`.

## Bundled Skills

- **`epic-review`** — Use before starting the first sub-issue of an unreviewed multi-issue epic, when asked to review or pre-validate an epic, or after its source RFC/Discussion: checks roadmap fit, prerequisites, and sub-issue overlap.
- **`ticket-create`** — Use before drafting or filing a GitHub issue, bug report, or feature spec (via gh issue create or create_issue): sweeps open/closed duplicates, challenges wrong-layer prescriptions, and structures ACs.
- **`ticket-intake`** — Use before branching or writing code for a GitHub issue or ticket: falsifies its claims and prescribed fix against live source, git log, ADRs, and open/closed issues (full gate, or drift check if self-authored).
- **`upstream-skill-feedback`** — Opt-in protocol to report reproducible skill or plugin misfires upstream; use when an installed neo-agent-skills skill or plugin bundle hits an unmapped standalone step, false gate, or broken instruction.

## Local Plugin Validation

```bash
claude plugin validate ./plugins/verify-before-code
npm run generate-claude-plugin -- --check
```
