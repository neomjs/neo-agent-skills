# Rendered-Surface Audit

**Trigger:** the PR changes what a rendered surface shows: a Stage frame, a Portal page, an app,
an example, a cover.

**Authority:** the operator merges no Stage PR without a before/after pair. The example card of
neo #20724 passed its design read and its review (neo #20813) on measured criteria, and the
operator read the tab at 5 of 10 beside the released list: nothing had compared the whole (#409).

## The gate (Required-Action tier)

1. **The whole surface, as a pair.** The body embeds the page, tab or frame a visitor sees as
   released (base) and as changed (head), never a crop of the changed part, in a form the PR-body
   check accepts (a `raw.githubusercontent.com` embed 404s in a private repository). A missing pair
   is Request Changes; for an outside contributor the reviewer captures it. Read the body's
   `Frame critique:` line against the frames: a defect a frame shows that it leaves out is a finding.
2. **A cold look for a new or re-composed surface.** The body carries `## Cold look`: two readers
   without session context grade the unlabelled pair from 1 to 10, in swapped order. A change that
   composes nothing new (a bug, a token) needs the pair only.
3. **The verdict first.** Before any criterion the review says whether the new whole beats the
   released one. `NOT_BETTER` is Request Changes that no criterion fix clears.

## Retirement trigger

Item 1 retires when the shared PR-body check requires the pair on a rendered-surface diff. Items
2 and 3 stay reviewer discipline.
