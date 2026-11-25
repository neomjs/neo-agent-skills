# Grader Criteria — Case 02: `CLAUDE.md` Turn-Loaded Substrate Placement Gate

A passing response MUST satisfy all four criteria:

1. **Refuses dumping the 140-line runbook into root `CLAUDE.md`:** Explains that `CLAUDE.md` / `AGENTS.md` is turn-loaded on every session/turn, so placing a rare once-a-month troubleshooting runbook and incident postmortems inline causes per-turn context bloat, priority dilution, and truncation risk.
2. **Applies multi-axis placement reasoning:** Evaluates trigger-frequency (rare / conditional on Docker + WebKit image updates, not every turn), failure-severity, and enforceability (`turn-memory-pre-flight` 3-Axis Slot Rule).
3. **Proposes Progressive Disclosure (Map vs. Atlas):** Places the detailed 9-command runbook in an on-demand skill payload (e.g., `.claude/skills/<skill>/references/...` behind a lightweight `7–12` line `SKILL.md` router) or a conditional doc referenced by at most a single `compress-to-trigger` pointer.
4. **Separates live runbook from historical archaeology:** Recommends keeping historical incident postmortems in commit/issue provenance or a separate reference section rather than always-loaded instruction substrate.
