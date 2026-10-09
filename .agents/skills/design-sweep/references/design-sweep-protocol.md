# Design Sweep Protocol

One view, read as a stranger would read it, by a peer who did not build it, on the
installed candidate, ending in one bound receipt. The protocol is D#19493 OQ-4 as
graduated on 2026-10-09 (the seven steps with the riders on 1, 4 and 7); the views
epic that collects the receipts is neomjs/neo-agent-institution#505.

**Why it exists.** Peers build and test the views; nobody uses them as their reader.
The operator's reads of 2026-10-09 (Home's dead doors and its system-state line; the
setup card's foot fade) are what one sweep step yields, and a visual suite cannot
yield them: neo #19522 had 51/51 visual tests green while rapid real clicks lost the
accepted reveal.

**Retirement trigger (decay clause).** Steps 4–6 retire into an instrument when the
Institution's Neural Link suite produces the bound receipt from an installed candidate.
The trigger is the first receipt on #505 produced by a script; then this payload keeps
the stranger reads (steps 2, 3, 7) and the rota, and steps 4–6 compress to a pointer.

## 1. Who sweeps, and when

- **A peer who did not build the view.** The builder's sweep is the blind spot by
  construction; a builder may answer the receipt's questions, never sign it.
- **The weekly slot the planning law already names**, as a rota that makes coverage
  visible: one view per sweep, the next uncovered view first. The rota is a list on
  #505, never a fleet wake and never authority to interrupt another seat; the weekly
  planning slot and peer self-selection stand.
- **Also on demand:** an operator's screenshot of a view, a design read requested on
  a ticket or PR, and before filing a design leaf — the same steps, the same receipt.

## 2. Bind the receipt before you look

A receipt that cannot say what it read is not a receipt. Fill the binding block of
`assets/design-sweep-receipt.md` first:

| Field | What it holds |
|---|---|
| build | `installed candidate <letter · sha>` or `source build` — labelled. A source or fixture capture **cannot retire an installed check**; it may only add evidence. |
| pins | Engine, Brain and Institution shas. Installed: read `organism-build-info.json` in the bundle. Source: the checkout heads. |
| profile | the running profile (team instance, fixture plane, …) |
| view key | the stable key (§3) |
| pane | actual dimensions in CSS px and the pane state (docked, split, popped out, which perspective) |
| data scope | the team's own data, or the fixture and which |
| states exercised | the list you will walk (empty, loading, degraded, error, selected, …) |
| asynchronous transition | at least one per view: which, and how it was observed |

**Stable view keys.** Panes by their dock item id: `fleet`, `stream`, `memories`,
`operator`, `tasks`, `catchUp`, `goldenPath`, `detail`. Route views by route: `home`,
`observatory`, `system`, `accounts`, `setup`, `chat`. Seats by Fleet agent id. A key
the table does not carry is added to the table in the same PR as the view.

## 3. The seven steps

1. **One view per sweep**, on the installed candidate with the team's own data, by a
   peer who did not build it. The receipt is bound (§2): installed or source build,
   labelled; Engine and Brain pins; profile; the stable view key; actual pane
   dimensions; data scope; states exercised.
2. **Say in one sentence, as a stranger, what the view is for.** If the sentence
   needs the ticket to be written, the view does not say it.
3. **Read every sentence on it aloud: does it speak to the reader or to the
   system?** A line that names a reader's state ("not listed yet", "could not be
   read", a service id, a reason code) speaks to the system; list it.
4. **Press every control and say what happened.** On a live team only reversible
   reading and navigation; Stop/Start, delete, import, credential, permission and
   publication controls only in an isolated fixture or the existing approved
   operator/affected-peer window. An unexercised control is `unknown`, never passed.
   At least one asynchronous transition per view, not only static frames — a reveal,
   a reload, a selection change, a stream update — observed as it happens.
5. **The four questions of #505:** one move (is the view reachable in one move),
   room (does it have the room it needs at the actual pane size), renders (does it
   render correctly, incl. dark theme), read in full (can the content be read in full
   without the reader scrolling the wrong axis).
6. **Compare to the view's design page and the token and card contracts.** A gap
   between the page and the view is a finding; a gap between the page and the
   operator's eye is a design question, routed to the design seat, not a defect.
7. **Write:** a capture per surface; defect-notes on the board (the zero-ceremony
   channel); a leaf only for a verified design defect, carrying its design-authority
   line; **each observed defect recorded with its class and owner** and routed to the
   existing owning ticket where one exists, related lines batched; one "needs love"
   line per view, keyed by the view key; the pre-sweep view state restored where the
   test permits.

## 4. Evidence, not impressions

- **Captures:** one per surface and state, on the installed candidate; through the
  Neural Link (`capture_perspective`, `observe_motion` for the transition, `get_dom_rect`
  for the pane size — see each tool's description for its use) when the bridge is up,
  otherwise the browser pane's screenshot with the pane size read from the DOM.
  A capture names its build, pane size and state in the receipt, never only in its
  file name.
- **The asynchronous transition** is observed, not inferred from two frames: count
  the frames or the DOM states between the action and the settled view.
- **A missing read is `unknown`.** A control you could not press, a state you could
  not reach, a transition you could not observe — write `unknown` with the reason.
  `unknown` is a finding about the sweep's reach, not a pass.

## 5. Defect classes and routing

Every defect line reads `class · what was observed · owner · routed to #N`:

| Class | It covers |
|---|---|
| reachability | the view or a control cannot be reached in one move, or at all |
| scrolling | the wrong axis scrolls, the content hides behind a scrollbar, scroll position is lost |
| width | the view needs more width than its pane has, or wastes it |
| content or state | a wrong, stale, system-voiced or missing line; a state the view does not show |
| keyboard or restore | focus, keyboard reach, or the view's state after a restore or reload |
| function | a control does nothing, or does the wrong thing |

- **Owner first.** The class names the kind; the owner is the existing ticket or the
  view's steward. Route to the existing owning ticket where one exists; batch the
  related lines of one view into one comment there.
- **Defect-note on the board** for anything observed (one A2A line to `AGENT:*`;
  capture is exempt from ceremony). **A leaf only for a verified design defect**, with
  the design-authority line the ticket skill requires; an impression is not a leaf.
- **A design question** (the page and the eye disagree) goes to the design seat on
  the view's design page or #505, never into a defect line.

## 6. The receipt

One comment on neomjs/neo-agent-institution#505 per sweep, from the template, in this
order: the binding block, the seven steps' answers, the defect lines, the needs-love
line, the captures, the restore line. The needs-love line is the only line another
instrument reads (Brain #957's `## Focus (v1)` views block), so it is one line and it
is keyed:

```
view: <key> · needs love: <one sentence, or "none observed">
```

A sweep that found nothing still posts its receipt: coverage is the point.

## 7. Anti-patterns

| Anti-pattern | Why it harms |
|---|---|
| The builder sweeps their own view | the blind spot the protocol exists to remove |
| A source or fixture capture retires an installed check | the candidate the operator runs was never read |
| Static frames only | #19522: 51/51 green while real clicks lost the reveal |
| A sweep as a wake or an interruption | the rota makes coverage visible; it holds no authority over a seat |
| Tool mechanics copied into this payload | the tool description is the source; a copy rots |
| A second vocabulary for classes or keys | the receipts stop being comparable |
| A hand-kept ledger file | the needs-love line lives in the receipt; the ledger is generated |

Provenance: D#19493 OQ-4 (body of 2026-10-09T21:38Z, Sophie's riders on steps 1, 4
and 7); neo #19522; the operator's reads of 2026-10-09; Brain #957 (the reader).
