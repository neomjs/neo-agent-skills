# The self-authored carve

You are here because you authored the ticket you were just assigned. This file exists so that
learning you may skip the gate costs ~1KB rather than the 31KB workflow it may retire.

## Three cases, keyed on what you have SEEN

| What you hold | Action |
|---|---|
| Neither artifact nor reasoning — **another agent authored it** | **Full gate.** Unchanged, and the majority case. This is what intake is for. |
| Artifact **and** reasoning — **you authored it this session** | **Exempt, except stage 2** — see below. `ticket-create`'s six-stage chain ran in this same context window. |
| Artifact but not reasoning — **you authored it in an earlier session** | **Drift probe below.** Full gate only if it fires. |

## Stage 2 is never exempt

The exemption rests on the chain having run in this context window. That holds for every stage testing
facts about the codebase. It **inverts** for stage 2, **Prescription**: that stage challenges the fix
*you* chose, so "the chain ran in this same context" means it was run by the author of the thing under
challenge. Same-session authorship removes stage 2's independence rather than supplying it.

The read is the **prerequisite**. What discharges the gate is stage 2's own question, answered where
a reader can see the answer:

1. Name the mechanism the ticket prescribes — the class, module or layer you would subclass, extend,
   or place beside.
2. Open it.
3. Answer, in the intake record: *is the stated fix the right substrate, or does it treat a symptom —
   could a different layer (config, service, daemon, schema) solve it better?*

   `Prescription checked: <path> — owns the concern`
   `Prescription checked: <path> — better owner: <path>`

A path on its own would prove only that a file was opened, and an unopened file is not what fails
this stage. A ticket naming no mechanism has nothing to build yet, and that absence is the finding.
Stricter, never looser.

Anchor: `neomjs/neo#18460` → `#18473`, dropped after three review cycles. Premise real, ticket hours
old, prescription wrong — with `src/controller/Component.mjs` one open away the whole time. What
survived three cycles was not an unread file but an unasked question.

## The drift probe

```bash
git log origin/dev --since="<ticket createdAt>" --name-only --pretty=format: | sort -u
```

Intersect the result with the paths the ticket declares under **Architectural Reality** and **Fix**.

- **Zero intersection** — Neo reality did not move underneath this ticket. Intake's core question is
  answered `no`; proceed without the payload, and say so in the PR body.
- **Non-empty** — this is exactly when the gate earns its cost, and the intersection names the
  specific files to re-check. Run the full workflow.

**Scope is the edit surface, decided rather than incidental.** A ticket's premise may also cite
*precedent* that moved — a sibling skill reshaped, a related PR merged. That updates a reference; it
does not invalidate the work. Do not widen the probe to chase citations.

**Why not "less than 24 hours old".** `origin/dev` takes 29–41 commits/day. A day is 30–40 merges of
drift, so a wall-clock rule exempts tickets sitting under 30+ merges while still gating a week-old
ticket whose surface nobody touched. The probe measures what the gate actually cares about.

## The failure mode this must never become

Every input above is externally checkable — session identity, the issue's GitHub author, `git log`.
The moment an exemption rests on *"I judged this ticket still valid"*, the carve has become the
loophole it was written to replace: **a gate you can talk yourself out of is not a gate.** If you
find yourself adding a judgment call *that lets you skip something*, that is the signal to run the
full workflow.

Stage 2's comparison is the other kind, and the distinction is the direction it points. A judgment
that widens the exemption is the loophole; a judgment the gate obliges you to make and write down is
the gate doing its work. The check is not whether an opinion is involved — it is whether skipping
leaves a visible hole. An unanswered stage 2 does.

## Same-session is not the same as same-context

After a compaction, your own reasoning may be as gone as another agent's. Session identity is the
available proxy, not a guarantee. If the ticket's reasoning is not actually in your context — you
recovered from a summary, or you cannot recall the six-stage chain without re-reading it — treat it
as the earlier-session case and run the probe. That judgment is allowed to make the gate *stricter*,
never looser.
