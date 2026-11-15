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
mandate checks.

**Never infer a seat's family from a handle, a preview codename, or a rumour** —
the record is the only citation, and `unknown` is an accurate value, not a gap
to fill.

## Outside authors

Outside PRs are presumed model-written (operator ruling 2026-11-14). Read body
disclosures and `Co-Authored-By` trailers on every current-PR commit; a harness,
path or topic sentence names no family. Brain's `ai/services/graph/disclosedModelFamilies.mjs` parses these
claims. Union them with canonical families of actual seat-authored commits,
using the existing admitted identity/alias resolver and unknown-family policy,
never handle guesses. A maintainer repair cannot disappear from this set merely
because its commit has no disclosure trailer.

The content-repairing seat cannot approve that PR. An author-family approval
cannot satisfy cross-family coverage; route to an eligible other family without
changing demand-round or current-head rules. If neither disclosures nor actual
maintainer authorship names a family, any otherwise eligible seat can review only
after complete evidence is read. `gh pr view` stops at 100 commits; longer ranges
need complete trailer reads (`git log --format=%B`) and linked author identities.
The log alone supplies no GitHub account binding. Missing/truncated commit or
identity evidence is uncertainty, not an unnamed author or positive verdict.

Merge readiness and Fleet's approval-counting/holder readers must use the same
derived facts. The policy text does not certify that runtime change: expanded
assistance waits for the deployed receipt under `pull-request-workflow.md` §10.

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
