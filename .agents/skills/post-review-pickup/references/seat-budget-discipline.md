# Seat Budget Discipline (weekly-capped seats)

Loaded on trigger from lane selection, a wake turn, PR composition, and reviewer routing. Every
rule here is `keep` inside this payload and `DISCIPLINE-ONLY` unless tagged otherwise. The
authority is two operator rulings, cited by date; nothing here is a seat's private habit.

## 1. The constraint, measured

- **The cap is the provider's, not ours.** Anthropic's Max plans meter Fable separately — "You
  can use up to 50% of your weekly usage limits on Fable models at no extra cost"
  (support.claude.com article 15424964, current on 2026-09-04); the panel's `Weekly · Fable` line
  shows that half (68% there means 68% of it). OpenAI markets against exactly this (GPT-6 Astra /
  Codex campaign, 2026-09-03: "100% of the allocation towards Astra", plus a daily bank reset) —
  the flagship budget per plan-dollar differs by more than 2× between the benches, a routing fact.
- **Dated change, 2026-09-14 (@ClaudeDevs on X, quoted by BleepingComputer 2026-08-29):** the
  standard weekly limit becomes a permanent +25% over the pre-May baseline, replacing the
  temporary +50% boost that runs through 2026-09-13 — about 17% less than today. The Fable half is
  a share of that limit, so the Fable pair's week shrinks by the same ~17%; the pace in §2 holds on
  the smaller week. A report that the separate Fable meter goes on the same date has no official
  source and the Fable-plan article contradicts it: not a fact, do not plan on it.
- **2026-08-15 (operator):** "pace, don't sprint" — Fable had burned 63% of its allocation in 17 h;
  the full team could drain the pro20 in ~3 days. Anthropic hands out extra weekly resets rarely
  (one at the Fable 5.1 release, ~2 months without one before, none for Opus 5): **the Friday reset
  is the only clock — never plan around a rescue.** Codex seats get one every ~2.6 days.
- **2026-09-04 (operator panel):** weekly Fable **68% after 24 seat-hours** (two seats, one day);
  a pro10 Fable seat 61%; the GPT pair 38% over the same hours with a daily bank reset. At that
  rate the Fable seats go dark after 2–3 days of the week — the second such day; the pacing rule
  had lived in per-seat memories only.
- **The burn is context length × tool-call count.** Every call carries the whole context; a
  session of ~300 calls over hours carries hundreds of K each time. Named waste from one seat-day:
  full-file reads where a region would do, a 50-item mailbox listing in context, a reviewer's
  review read twice, the unit suite five times and the focused specs six times for one lane, five
  real stage runs, three review rounds on one PR whose findings were boundary tests the author
  could have written before opening.

## 2. Pacing (the cap, made daily)

Agents cannot read the usage panel; the operator can. Pace the `Weekly · Fable` meter as **≈ 10
points per day for the pair (≈ 5 per seat)** across the Friday-to-Friday week (from 2026-09-14
the same pace on a ~17% smaller week). A burst day over
20 points means dark seats before the reset. When the operator posts the panel numbers (an A2A budget
pulse or a paired message), they outrank every plan: over pace → finish the gated obligation,
save, stop.

## 3. Rules

1. **Bounded shifts.** Finish the gated obligation, save, stop; no lane-chaining across a day. A
   wake turn is a full-context call: do only the obligation that woke you, no exploratory reads.
2. **Region reads.** `Read` with offset/limit, grep windows; never a full file for an Edit gate;
   mailbox `limit` ≤ 10 (`MACHINE-ENFORCEABLE-CANDIDATE`); never re-read an artifact already in
   context — cite it.
3. **One batched command per round.** The focused spec while iterating; the full unit suite **once**
   before the push (`MACHINE-ENFORCEABLE-CANDIDATE`); the real e2e / stage run once, at the head.
4. **Compose for first-cycle approval.** Before the PR opens, the reviewer's falsifier at every
   consumed boundary is an ARM — the integration seam, the collision, the provenance, the
   shipped-metadata leak. The author-side review round is the most expensive token on both seats.
5. **Sub-agents, by seat.** Claude seats (1M context): **forbidden and unneeded** — measured at
   ~120 K tokens in 10 minutes against 30–50 K/h for a main agent; an idle of ~2 h loses the prompt
   cache on a long session. GPT seats (Codex caps context at 258 K): **necessary and affordable**.
   The same question gets opposite correct answers, decided by context × billing.
6. **Review routing (the family default).** Opus seats review GPT-authored PRs; GPT seats review
   Claude-authored PRs (their bank resets daily). An Opus or Fable seat takes a Claude-authored PR
   only when it is important AND semantically close to its own lane. The cross-family mandate
   stays the gate; this rule orders the choice.

## 4. Open measurement

Fresh session every ~2 h (one recovery each, small context) versus one long session with
compactions: **untested.** Measure one seat, one day each way, similar work, the operator's panel
before and after; record the delta here. Until then, §3.1 stands on the arithmetic alone.

## 5. Sunset

Retire the 50% line in §1 when the Fable-plan support article stops stating it; retire §2 when seats can read their plan usage themselves (a budget-pulse tool); retire §3.5 when
a Claude sub-agent measurement contradicts the 2026 numbers; the routing rule (§3.6) also lives
inline in `ci-green-review-routing.md` and survives this file.
