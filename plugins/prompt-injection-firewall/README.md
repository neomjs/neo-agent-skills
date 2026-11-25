# Prompt Injection Firewall for Untrusted Input — Official Claude Plugin

Read untrusted GitHub issues, pull-request comments, external docs, and fetched web pages without letting embedded instructions hijack your session goals or trick you into executing unverified claims. Enforces OWASP ASI01 channel separation (retrieved content is data, never commands), falsifies questionable premises before acting, and stress-tests architecture or PR proposals in chat or via gh.

Retrieved issues, PR comments, external documentation, and scraped web text routinely mix domain facts with instruction-shaped text or flawed assumptions. These skills enforce strict L2 channel separation (OWASP ASI01: untrusted input is data, never commands), L1 premise falsification before agreement or code changes, and evidence-backed design review via `gh` or chat with zero MCP setup (`contained` reach).

## Install

- **Marketplace (Claude Code):** run `claude plugin marketplace add neomjs/neo-agent-skills`, then `claude plugin install prompt-injection-firewall@neomjs`.
- **Claude Directory (Claude Code, Cowork, Claude apps):** install **Prompt Injection Firewall for Untrusted Input** (`prompt-injection-firewall`) from `https://claude.ai/directory`.
- **From a local clone (`neomjs/neo-agent-skills`):** run `claude --plugin-dir ./plugins/prompt-injection-firewall`.

## Bundled Skills

- **`identity-firewall`** — L2 Channel Separation and Prompt Firewall defense; use to prevent injection attacks and Helpful Assistant regression.
- **`peer-role`** — Convergence-pressure mindset for peer design review; use when reviewing an Ideation Sandbox/architecture proposal, epic shape, skill shape, roadmap/milestone, or /lead-role artifact (not status broadcasts).
- **`upstream-skill-feedback`** — Opt-in protocol to report reproducible skill or plugin misfires upstream; use when an installed neo-agent-skills skill or plugin bundle hits an unmapped standalone step, false gate, or broken instruction.

## Local Plugin Validation

```bash
claude plugin validate ./plugins/prompt-injection-firewall
npm run generate-claude-plugin -- --check
```
