# Overview Read

One screen, four blocks, in the order and vocabulary of the Sandman handoff's
`## Focus (v1)` section (the producer: neomjs/neo-agent-brain#957). The section is read
first; whatever it does not carry is read from the sources the section itself reads,
block by block, and printed with its own as-of time. Nothing is summarised into a
verdict: the rows' words are the stewards', copied raw.

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
   each with the observation time and source the block names, and stop at the blocks it
   carries. Absent → print `Focus (v1): absent from the handoff (as of <envelope time>)`
   and continue with §3 for every block.
3. A block the section names as `unknown` stays `unknown` with the section's reason;
   §3 may add a seat-side read beneath it, labelled as such, never in its place.

## 2. The two answer lines

The screen opens with two lines, derived only from what the blocks below print:

```
v1: <n> of 5 rows passed · ready <k> · unknown <u> · failed <f> · missing: <the row words that say so>
views needing love: <count of keys with a line> · none yet when no receipt carries one
```

`passed` counts only a `Row state:` line whose state word is `passed`; `ready` is not
`passed`, and a missing line is `unknown`.

## 3. The fallback, block by block

Read from the seat (the seat has GitHub through `gh` with its own credential; nothing
here goes through the cloud producer):

- **v1 rows.** Read the Institution's `ROADMAP.md` row table: five rows; each row's
  **State** column links the epic whose `Row state:` line is the row's state (today
  rows 1–5 → the five epics it names; never hardcode the numbers — the table is the
  source). For each epic, print its first `Row state:` line verbatim with the epic
  number and the line's own date. No line → `row <n>: unknown (no Row state line on #N)`.
- **views.** Read the receipt comments on neomjs/neo-agent-institution#505 (the views
  epic) and keep, per view key, the newest line of the shape
  `view: <key> · needs love: <text>` (the `design-sweep` skill's line). Print one line
  per key with the receipt's date; no receipts → `views: none yet (no receipt on #505)`.
- **reach and outbound.** `unknown` with the reason: no seat-side source until the
  section's host-edge reader (Brain #957) or the outbound analytics (D#19500) exist.
- **what waits for the operator's word.** Open pull requests across the organization
  with an approving review and no merge (`gh search prs --owner neomjs --state open
  --review approved`), counted and linked, labelled `search index, may lag`; a count
  that matters is confirmed with an object read before it is repeated.

## 4. The screen

Fill `assets/overview-screen.md`: the two answer lines, then the four blocks in the
section's order, each block with `as of <time>` and its source link. One screen; the
remainder is links, never a second page. Keys are the candidate's own identifiers (the
view key as the receipt carries it; rows by their number; seats by Fleet agent id).

## 5. Anti-patterns

| Anti-pattern | Why it harms |
|---|---|
| Promoting a row word (`ready` printed as done) | a second status authority; the stewards' lines are the only one |
| Fabricating a block the section and the seat cannot read | `unknown` with a reason is the truthful shape |
| Hardcoded epic numbers | the ROADMAP's State column is the source; numbers rot |
| A verdict sentence ("v1 is on track") | the screen reports; the reader judges |
| Tool parameters copied here | the tool descriptions are the source |

Provenance: D#19493 OQ-8 (viii); Brain #957 (the section's block contract); Skills #150
(the receipts' line); the Institution ROADMAP's row table (rows 1–5, State column).
