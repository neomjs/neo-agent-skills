# Overview Read

One screen, four blocks, in the order and vocabulary of the Sandman handoff's
`## Focus (v1)` section (the producer: neomjs/neo-agent-brain#957). The section is read
first; whatever it does not carry is read from the sources the section itself reads,
block by block, and printed with its own as-of time, build class and source. Nothing is
summarised into a verdict: the rows' words are the stewards', copied raw; a receipt's
evidence class travels with its line; an approval is a candidate, not readiness.

**Why it exists.** The two questions a session asks first — *where are we for v1, what is
missing* and *which views still need love* — cost a peer its first twenty minutes or an
operator question, because the answers live on five epics, one Discussion and one views
epic. D#19493 OQ-8 (viii) made this skill the reader of the section and the fallback
before the section exists.

**Retirement trigger (decay clause).** When the section carries all four blocks (its
`focus.v1` marker line and the four block headings), §3 retires to a pointer and this
read is one call. The trigger is the first `/overview` print whose every block came from
the section; record it on neomjs/neo-agent-skills#152's successor and shrink this file.

## 1. The section first

1. Call `get_sandman_handoff` (see its description for the freshness envelope). Read the
   envelope before the text: a stale handoff is printed as stale, with its age, never
   silently.
2. Find the level-two heading `## Focus (v1)`. Present → print the blocks it carries,
   each with the observation time, candidate or profile and source the block names
   (D#19493 OQ-8 iii), and stop at the blocks it carries. Absent → print
   `Focus (v1): absent from the handoff (as of <envelope time>)` and continue with §3
   for every block.
3. A block the section names as `unknown` stays `unknown` with the section's reason;
   §3 may add a seat-side read beneath it, labelled as such, never in its place.

## 2. The two answer lines

The screen opens with two lines, derived only from what the blocks below print:

```
v1: <n> of 5 rows passed · ready <k> · unknown <u> · failed <f> · missing: <the state words>
views: swept <s> · needing love <m> · unassessed: <the keys with no governing line>
```

- `passed` counts only a `Row state:` line whose state word is `passed`; `ready` is not
  `passed`, and a missing line is `unknown`.
- `needing love` counts only keys whose governing line (§3) is affirmative. A canonical
  `none observed` line is coverage: it raises `swept`, never `needing love`.
- `unassessed` names every declared view key with no structured receipt, and every key
  whose source could not be read. Unassessed is never "no work needed".

## 3. The fallback, block by block

Read from the seat (the seat has GitHub through `gh` with its own credential; nothing
here goes through the cloud producer):

- **v1 rows.** Read the Institution's `ROADMAP.md` row table: five rows; each row's
  **State** column links the epic whose `Row state:` line is the row's state (today
  rows 1–5 → the five epics it names; never hardcode the numbers — the table is the
  source). For each epic, print its first `Row state:` line verbatim with the epic
  number and the line's own date; the line's `plan:` tail is not state — truncate there
  and link. No line → `row <n>: unknown (no Row state line on #N)`.
- **views.** Read the receipt comments on neomjs/neo-agent-institution#505 (the views
  epic). Each `view: <key> · needs love: <text>` line arrives with its receipt's binding:
  build class (`installed candidate <sha>` or `source build`), profile, pins, observation
  time. **The governing line per key is the newest line of the highest evidence class
  present: an installed line is replaced only by a newer installed line; a source or
  fixture line never replaces, and never resolves, an installed line** (the
  `design-sweep` rule: a source capture cannot retire an installed check). Print the
  governing line with its build class, profile and time; a newer source line prints
  beneath it, labelled `source`, with no inference that the installed finding is
  resolved. A key with only source lines prints as `source`; a key with no line is
  `unassessed`. No receipts at all → `views: none yet (no receipt on #505)`.
- **reach and outbound.** `unknown` with the reason: no seat-side source until the
  section's host-edge reader (Brain #957) or the outbound analytics (D#19500) exist.
- **what waits for the operator's word.** Discovery first: open pull requests across the
  organization with an approving review (`gh search prs --owner neomjs --state open
  --review approved`; the index may lag, say so). **Then readiness, per candidate, from
  the source-owned projection only**: `get_conversation` with `projection:
  'merge-readiness'` for the candidate (see the tool's description; it feeds the fetched
  state, checks, still-requested reviewers, holds and the cross-family verdict to the
  Brain's `validateMergeReady`). The projection's `verdict` is the only source of the
  affirmative label: `ready for the operator` prints when the projection says ready and
  never otherwise; a negative verdict prints `approved · not ready: <the projection's
  reasons>`; an `unavailable` verdict prints `approved · readiness unverified` with the
  missing input the projection names. This skill computes no readiness of its own: a
  `gh pr view` of reviewers or checks may add detail beneath a line, never the label.
  Decisions that are not pull requests — a Discussion gate, a design approval, a cut —
  are **outside this read's coverage**, and the block says so in one line.

### 3a. Six cases the rules must survive (synthetic, labelled; not installed claims)

| Case | Input | Output |
|---|---|---|
| clean receipt | `memories · none observed` (installed) | `swept 1 · needing love 0` |
| clean + defect | `memories · none observed` + `system · service cards clip` (both installed) | `swept 2 · needing love 1` — `system` |
| missing / unreadable | no receipt for `tasks`; or #505 unreadable | `tasks: unassessed` · or every key `unassessed (reason)` — never 0 needing love |
| scope collision | `system · clips` installed 10:00 · `system · none observed` source 11:00 | governing: the installed 10:00 line; beneath: `source 11:00 · none observed`; `needing love 1` |
| approved, reviewer owed | approved by A, a review still requested of B; projection: not ready (reviewRequests) | `approved · not ready: a review still requested of B` |
| approved, CI red | approved, a check failing; projection: not ready (checks) | `approved · not ready: checks` |
| approved, hold | OPEN · APPROVED · CLEAN · checks green · no reviewer requested · an active reviewer hold; projection: not ready (hold) | `approved · not ready: hold by <holder>` — the fields alone would have said ready; the projection governs |
| projection unavailable | approved; the projection answers `unavailable` (an input not fetched) | `approved · readiness unverified: <missing input>` — never `ready` |

## 4. The screen

Fill `assets/overview-screen.md`: the two answer lines, then the four blocks in the
section's order, each block with `as of <time>` and its source link; each view line with
its build class, profile and observation time; each operator candidate with its
readiness label. One screen; the remainder is links, never a second page. Keys are the
candidate's own identifiers (the view key as the receipt carries it; rows by number;
seats by Fleet agent id).

## 5. Anti-patterns

| Anti-pattern | Why it harms |
|---|---|
| Promoting a row word (`ready` printed as done) | a second status authority; the stewards' lines are the only one |
| A clean receipt counted as a finding | coverage and defects collapse; the count stops meaning "work" |
| A newer source line resolving an installed finding | the candidate the operator runs was never re-read |
| An approval read as readiness | a peer's owed review or a red check becomes the operator's problem |
| Fabricating a block the section and the seat cannot read | `unknown` with a reason is the truthful shape |
| Hardcoded epic numbers | the ROADMAP's State column is the source; numbers rot |
| A verdict sentence ("v1 is on track") | the screen reports; the reader judges |
| Tool parameters copied here | the tool descriptions are the source |

Provenance: D#19493 OQ-8 (iii, viii); Brain #957 (the section's block contract); Skills
#150 (the receipts' line and binding); the Institution ROADMAP's row table (rows 1–5,
State column); Sophie's three counterexamples on PR #153 (2026-10-09).
