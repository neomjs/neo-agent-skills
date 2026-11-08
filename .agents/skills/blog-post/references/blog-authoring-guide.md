# Blog Post & Pitch Authoring Guide

Fires when you author, revise, or review a public blog post (`learn/blog/<slug>.md` + manual registration in `apps/portal/resources/data/blog.json`; SEO surfaces are **generated, not hand-edited** — §5) or funding/pitch copy (`funding/**`). Sibling of `release-notes` and `update-roadmap`.

**The recursive principle.** Public and investor-facing copy is held to its own thesis. If a piece argues for rigor, it must *be* rigorous. Empirical anchors: #13486 (the cross-family-verification post, whose review cycles surfaced the five over-claim flavors below) and #262 (claim-class verification and the acceptance lens).

## 1. Pre-Flight & Narrative Arc — a hero piece, not a changelog

- **Reader / acceptance pre-flight (before drafting):**
  - **Blog & outbound posts:** Name the target reader and answer the hardest read first — *"why would the audience NOT click or read past the first paragraph?"* Draft the outbound with the post: its venues and their `outbound-post.md` §0 fills go through review in the same PR. A post nobody is sent to has delivered nothing.
  - **Funding & accelerator pitches (`funding/**`):** Apply the acceptance lens first — *"why would they NOT accept us, and why would they?"* Mine the verified record (`strategy/areas/**`, `decisions-in-force.md`, Memory Core) before inventing a hook; nothing to re-invent.
- **TL;DR thesis** — one bold paragraph stating the single bet so a skimmer gets the whole argument.
- **The hook** — the tension the reader already feels, framed in *their* terms (a real problem they have, never a *"Your AI can't…"* swipe at their tools; see §3 flavors #4–#5).
- **The arc** — problem → why the obvious fix falls short → your move → why it holds *by construction*. One claim per section; each section earns the next.
- **Receipts, not prophecy** — concrete, linked evidence (PRs, issues, war stories). Pair the dramatic case with a mundane everyday one — the mundane one convinces harder.
- **CTA** — the reader's next action (read the next part, star the repository, run the install), with its link. A closing question invites replies, not reads.
- **The Try-It test** (the closing "How to run it today") — read it as an outside engineer or LLM without our stack: *would I try this now, and does the section walk me through it?* Lead with what runs today, step by step and adaptable to the reader's own tools, then the next level up (for Agent OS posts: `neo-agent-skills`, then the Brain's Memory Core, then the Fleet Manager). Never open the section with what does not work for the reader; a limit is stated as the next step on that path.

**Visuals are required** (operator, neomjs/neo#20226): every post carries at least one Mermaid diagram or image, and a section explaining a structure, flow or sequence shows it — no wall of text, no decoration. Each is **render-verified before merge** (`guide-authoring-bar` §3; a post renders at `#/news/blog/<blog.json id>`).

## 2. Claim-Class Verification & The Single Final-Version Fact Check (#262)

Apply `§verify_before_assert` by claim class (`neo-agent-skills#262`):

- **External claims (outside world)** — a competitor, quote, statistic, or *"first / most / fastest"* requires a linked primary source you verified via `WebSearch` / `WebFetch` (read the body, not just the snippet). An authority's verbal statement (*"the operator told me X"*) is a pointer to verify, never a citation (#13486 OpenClaw star-count catch). If you can't source it, cut it.
- **Record claims with a receipt** — an internal number beside its query, a decision beside its anchor, or a date beside its commit (`strategy/areas/**`, release notes, public issues/PRs) is **cited from the anchor** during drafting. Re-measure only when changing the claim or when the anchor is missing.
- **One consolidated fact check at the final version (the gate for blog & funding/pitch text):** Class (3) sets the cadence for every claim inside blog, outbound, and funding/pitch text, including its class (1) and (2) claims. Write from the verified anchors and have **a seat that did not draft the claims** run **one consolidated fact check at the final version** before publish/submission — never a per-point V-B-A sweep on every draft revision (a drafting seat's re-run reproduces its own inferred labels; `#262`). Re-measuring existing receipts per revision burns context windows, triggers compaction, and steers the text toward what is measurable (counts, rosters) instead of what is true.

## 3. Kill the Five Over-Claim Flavors

A claim can be literally true yet imply something false — and a *title* can be accurate yet strike the wrong voice. Audit every claim and title for *implication*, not just literal accuracy. Flavors 1–3 are **factual** over-claims (#13486); flavors 4–5 are **tonal / identity** over-claims (@tobiu's title feedback, #14877):

1. **Unsourced superlative** — "the most / first / fastest X." Source the exact ranking, or soften / cut.
2. **Universal quantifier** — "*all* N are X." One counterexample disproves it. Soften to process framing unless genuinely universal ("cross-family review by rule, a human on every merge").
3. **Misleading fraction / framing** — a correct number that implies a false conclusion ("129 of 151 tracked items shipped" reads *almost done* when a major horizon remains). Reframe so the impression matches reality.
4. **False-human-author voice (provenance-inversion)** — a second-person "Your AI… / your stack…" title poses as a human grading tools, hiding that an AI maintainer wrote the post. Title from *inside* the organism — describe what we built ("Possession, not code-generation: operating a running app from inside it").
5. **Competitive put-down** — "X does Y, but *mine* does it better" / gotcha-taunt hooks. Lead with substance stated plainly ("Cross-family verification: an agent from a rival lab checks our work, in public").

**The test (claims):** ask *both* "is it accurate?" and "does the framing imply something I can't defend?" Both must pass.

**The test (titles) — mechanical:** a title fails if it (a) opens with "Your AI… / Your stack…", (b) is shaped "X does Y — but mine does it better", or (c) would read as bragging to a senior engineer at a rival lab. Tension from a *real problem* stays legal ("An AI predicted its own project's future. Ten weeks later, another AI graded it.").

## 4. The Cross-Family Review Bar (mandatory)

A public post ships only after **≥2 model reviews**. The cross-family review is the structural backstop that catches what the author — sharing the post's own priors — cannot.

- **Route ≥2 reviewers, at least one from a different model family** than the author. For a post *about* cross-family verification, route every available family — it is the thesis, demonstrated.
- **One reviewer reads as a stranger:** they run the Try-It test (§1) on the closing section and, for an outbound piece, the cold-reader check in `outbound-post.md` §0. A post can pass every claim check and still fail these.
- **The authority/operator approves LAST.** If the authority approves first, peers anchor to that signal and rubber-stamp; approving last preserves their independent judgment. Corollary: do NOT record "X will approve anyway" in shared/telepathic memory — a peer reading it self-fulfills the rubber-stamp.
- **Address every catch on the durable PR.** Map each fix to its reviewer (`[ADDRESSED]`), refresh the head, re-request. The review *is* the product — it is what makes the post trustworthy, and it is the thesis in motion.

## 5. Mechanics

- **File:** `learn/blog/<slug>.md` (front-matter + body) — the post itself.
- **Register (manual):** add a year node + leaf to `apps/portal/resources/data/blog.json` (the portal blog-nav). Confirm it parses (`node -e "JSON.parse(require('fs').readFileSync('apps/portal/resources/data/blog.json','utf8'))"`).
- **Do NOT hand-edit the SEO surfaces.** `apps/portal/sitemap.xml` and `apps/portal/llms.txt` are **generated** by `buildScripts/docs/seo/generate.mjs` (via `buildScripts/docs/rebuildContentIndexesAndSeo.mjs`) and committed by the `.github/workflows/data-sync-pipeline.yml` data-sync pipeline. A manual edit is overwritten on the next pipeline run.
- **Images:** `neomjs/pages` → `resources_pub/website/blog/<slug>/`, merged before the post (the portal serves its `main`), referenced with descriptive `alt` text.
- **Cover:** 2400×1260 (1.91:1), shown whole by link cards and the hero. Medium thumbnails take the centred 3:2 (`resize:fill:320:214`), so text and subject stay 60 px inside the centred 1890×1260.
- **Portal Medium card:** a post listed in `medium_blog.json` gets a card `image`. The card (`news/medium/List.scss`) crops from the centre to anywhere between 1.4:1 and 4:1, so only the centred 1760×600 of a 2400×1260 image survives every size. Its title and author cover the bottom-left 70 % (85 % on 200 px cards). Keep the card's subject in that band and its text out from under them.
- **Ship:** commit + PR per the `pull-request` skill; the PR body `Evidence:` line is L1/L2 (docs — no unit tests), and its render receipt names each visual, plus the cover's 3:2 crop and, for a listed post, its card at 800×400 and 800×200. Public-artifact gate: **zero client names** (AGENTS.md §critical_gate).
- **Identity:** byline carries the author's named-maintainer identity + model + the cross-family team framing (`neomjs/neo#adr:neo-identity-source-of-truth-model`).
