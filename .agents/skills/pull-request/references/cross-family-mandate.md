# Cross-Family Mandate — rationale and exceptions

*(Atlas for `pull-request-workflow.md` §6.1, which carries the operative rule.
Load it for an exception, an outside author, or a question about the rule's
shape.)*

## Why a difference test, not a list of families

An enumeration claims completeness, needs hand-editing on every roster change,
and goes stale silently: by 2026-08-24 the old `(Claude-family <-> Gemini/GPT-family)`
named the one **benched** family and omitted the only live third seat. **If you
are tempted to list the current families to make the rule concrete, that is the
failure mode this file exists to prevent.**

## `unknown` counts as differing — and what it costs

A seat may record `modelFamily: 'unknown'`: an engine undisclosed by design,
where the bearer does not know its own model or vendor. Operator ruling
2026-08-24 — it counts as differing.

The trade should not be quietly enjoyed: a family nobody can state cannot be
*shown* uncorrelated with the author's, so admitting it assumes part of what the
mandate checks. A usable third seat, bought with a guarantee that was never
verifiable for that seat.

**Never infer a seat's family from a handle, a preview codename, or a rumour** —
the record is the only citation, and `unknown` is an accurate value, not a gap
to fill.

## Outside authors

An outside author has no record, so its family is what its PR discloses: a body
line saying what produced the change, or a `Co-Authored-By` trailer on any
commit, both in `gh pr view N --json body,commits`. Several named families all
count; a harness, a path or a topic sentence names none. Brain's
`ai/services/graph/disclosedModelFamilies.mjs` is the parse the merge-readiness
verdict and the Fleet read.

Outside PRs are presumed model-written (operator ruling 2026-11-14). One naming a
family needs an approver from a family it does not name, so a seat of a named
family hands it to an eligible seat. One naming none is open to any seat.

## Liveness is not consulted

The gate asks what an approval **was**, not who is available now. A benched
peer's past approval was still cross-family, and the correlated-blind-spot
rationale is satisfied by *who reviewed*. Requiring live seats would couple merge
validity to a hand-maintained roster file whose participation rows go stale.

## Exceptions

Narrow, and each must be stated in the PR/review thread:

- **Micro-change:** `chore` and `< 20` changed lines, or pure documentation with
  no runtime impact.
- **7-day-open fallback:** PR open >= 7 days and no cross-family thread
  engagement; cite `createdAt` and `get_conversation` evidence.
- **Emergency:** `priority: P0` or explicit Tobi override; retrospective
  cross-family review within 7 days.

If CI is green and no cross-family reviewer has engaged after ~2 hours, invite
exactly one opposite-family primary reviewer before considering fallback.
