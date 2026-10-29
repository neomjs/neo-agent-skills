# Cycle-1 Premise Pre-Flight Audit

Run this catalog at the end of `pr-review-guide.md` §0, before the defect audit (§3–§8). A firing row ends the audit: the review carries one premise Required Action — Drop+Supersede by default (§9) — never a multi-item iteration list.

## Trigger Catalog

| Trigger | Diagnostic question |
|---|---|
| Premise-invalid | Is the PR's stated premise false, such as claiming to resolve a ticket or implement a feature whose substrate has a different shape? |
| Upstream not graduated | Does the PR depend on a Discussion, parent ticket, or Epic that has not reached its required graduation or closure state? |
| Author bypassed | Did the author bypass a specific authority boundary, such as self-marking another peer's Discussion as graduated or crossing `peer-role` non-execution without handoff? |
| Anti-pattern instantiation | Does the change instantiate a pattern Neo doctrine forbids, such as named-maintainer orchestrator/worker mapping, framework-category drift, or banned shell editing? |
| Strategic-misalignment | Does the work conflict with active roadmap direction, reserved lane ownership, deprecated subsystem direction, or an operator halt? |
| Better-existing-substrate | Does existing code, Memory Core, or KB evidence already solve the problem, making the PR reinvention? |
| Source-ticket stale/currency-risk | Is the linked ticket stale, `no auto close`, or plausibly superseded, and did the reviewer prove its authority is still current rather than assume it? Procedure: §Source-Ticket Currency Rule. |
| Graduated-decision reversal | Does the diff amend or reverse a graduated decision — an ADR election, a Discussion-ratified target, a merged authority model — without a reopened graduation or consensus record? Signals: `learn/agentos/decisions/` hunks inside an implementation PR; diff statements contradicting a `[GRADUATED_TO_TICKET]`-backed body; an ADR's own revalidation-trigger firing. |

Graduated-decision reversal checks for the **record**, not the change. An ADR or Discussion amendment carrying a reopened graduation or consensus record passes the row; elections are amendable through reopened authority, and this is not an ADR-edit ban.

## Source-Ticket Currency Rule

Age and exemption state are risk signals, not verdicts. For source-ticket stale/currency-risk, the reviewer must prove current authority before approval: newer tickets, newer or merged PRs without close keywords, active epics, recent Discussions, and current source/docs/tests can supersede a still-open ticket.

If currency is unverified or contradicted, request source-ticket refresh or Drop+Supersede/restart instead of iterating implementation details. This is the reviewer-side companion to #10758; do not duplicate #10758's intake-side age-band procedure here.

**Bias defended against:** salvaging work already done — green CI, partial correctness, review momentum — over a restart that is substrate-correct.

Provenance: PR #11083 (a Cycle-1 Request Changes listed five iterative actions while its RA1 needed an upstream graduation the PR could not supply) and PR #16188 (an ADR reversal approved and merged within a minute on a green checklist). Disposition: `move`, loaded from guide §0 · `DISCIPLINE-ONLY`.
