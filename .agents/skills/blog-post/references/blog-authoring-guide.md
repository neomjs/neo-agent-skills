# Blog Post & Pitch Authoring Guide

Fires when you author, revise, or review a public blog post (`learn/blog/<slug>.md` + manual registration in `apps/portal/resources/data/blog.json`; SEO surfaces are **generated, not hand-edited** — §5) or funding/pitch copy (`funding/**`). Sibling of `release-notes` and `update-roadmap`.

**Editorial purpose.** Give a reader a reason to care about something Neo lets them do. Verification keeps that promise honest (§2), and a post about a strong system reads as one (§4).

## 1. Pre-Flight & Narrative Arc — a hero piece, not a changelog

- **Reader / acceptance pre-flight (before drafting):**
  - **Blog & outbound posts:** Picture a person or coding agent doing a particular job. What gets in their way? What does Neo let them do, and which moment would make them want to try it? Choose another subject if the example matters only to its author. Name the reader, the one thing they should want after reading and the one action: the PR body carries them in one `Reader:` line. Draft the outbound with the post. Its venues and their `outbound-post.md` §0 fills go through review in the same PR.
  - **Funding & accelerator pitches (`funding/**`):** Mine the verified record (`strategy/areas/**`, `decisions-in-force.md`, Memory Core) before inventing a hook. From it, show the customer’s problem, the reason to back this team and the strongest objection.
- **TL;DR thesis** — one paragraph in regular weight, stating the single bet so a skimmer gets the whole argument. Bold marks one phrase at most (the operator's read, #250); existing posts change when next touched.
- **The hook** — open on that job in progress. Show what the reader gains and the distinctive Neo behavior that delivers it.
- **The arc** — show the turning point, explain how it works, then let the reader use it on their own problem.
- **Evidence** — choose the example that best shows the payoff, then link the source a curious reader can inspect.
- **CTA** — the reader's next action (read the next part, star the repository, run the install), with its link. A closing question invites replies, not reads.
- **The Try-It test** (the closing "How to run it today") — read it as an outside engineer or LLM without our stack: *would I try this now, and does the section walk me through it?* Lead with what runs today, step by step and adaptable to the reader's own tools, then the next level up (for Agent OS posts: `neo-agent-skills`, then the Brain's Memory Core, then the Fleet Manager). Never open the section with what does not work for the reader; a limit is stated as the next step on that path.

**Visuals** (neomjs/neo#20226). Every post carries at least one Mermaid diagram or image. Show a structure, flow or sequence where you explain it. Capture the interaction that changes the reader’s work, using a screenshot pair or short clip when movement matters. For an invisible mechanism, show a real input and result or diagram the change. Before merge, verify each visual at reading size on `#/news/blog/<blog.json id>` (`guide-authoring-bar` §3).

## 2. Claim-Class Verification & The Single Final-Version Fact Check (#262)

Apply `§verify_before_assert` by claim class (`neo-agent-skills#262`):

- **External claims (outside world)** — a competitor, quote, statistic, or *"first / most / fastest"* requires a linked primary source you verified via `WebSearch` / `WebFetch` (read the body, not just the snippet). An authority's verbal statement (*"the operator told me X"*) is a pointer to verify, never a citation (#13486 OpenClaw star-count catch). If you can't source it, cut it.
- **Record claims with a receipt** — an internal number beside its query, a decision beside its anchor, or a date beside its commit (`strategy/areas/**`, release notes, public issues/PRs) is **cited from the anchor** during drafting. Re-measure only when changing the claim or when the anchor is missing.
- **One consolidated fact check at the final version (the gate for blog & funding/pitch text):** Class (3) sets the cadence for every claim inside blog, outbound, and funding/pitch text, including its class (1) and (2) claims. Write from the verified anchors; **a seat that did not draft the claims** runs the check once before publish/submission, never a per-point V-B-A sweep on every draft revision (a drafting seat's re-run reproduces its own inferred labels; `#262`). Re-measuring receipts per revision burns context and steers the text toward what is measurable (counts, rosters) instead of what is true.
- **Corrections keep the strength:** a claim fix proposes the strongest true replacement. Softening or deleting is the last resort, and precision that changes no reader's decision is a non-blocking note.

## 3. Kill the Over-Claim, Traction and Undersell Flavors

A true claim can imply something false, and an accurate title can strike the wrong voice, move nobody or sell the work short. Audit every claim and title for *implication*, not just literal accuracy. Flavors 1–3 are **factual** over-claims (#13486), 4–5 **tonal / identity** over-claims (@tobiu's title feedback, #14877), 6–8 **traction** failures, accurate and dead on his stranger read (neo #20184, #250), and 9–14 **undersell**, each with its specimen from neo #21093 (#409):

1. **Unsourced superlative** — "the most / first / fastest X." Source the exact ranking, or state the strongest one you can source.
2. **Universal quantifier** — "*all* N are X." One counterexample disproves it. Soften to process framing unless genuinely universal ("cross-family review by rule, a human on every merge").
3. **Misleading fraction / framing** — a correct number that implies a false conclusion ("129 of 151 tracked items shipped" reads *almost done* when a major horizon remains). Reframe so the impression matches reality.
4. **False-human-author voice (provenance-inversion)** — a second-person "Your AI… / your stack…" title poses as a human grading tools, hiding that an AI maintainer wrote the post. Title from *inside* the organism — describe what we built ("Possession, not code-generation: operating a running app from inside it").
5. **Competitive put-down** — "X does Y, but *mine* does it better" / gotcha-taunt hooks. Lead with substance stated plainly ("Cross-family verification: an agent from a rival lab checks our work, in public").
6. **Product-name headline** — the product as the title's subject: accurate and invisible, since nobody searches for a name they have never heard.
7. **Author's-context title** — reads as its opposite to a stranger: *"Multi-window web apps without syncing state"* meant "the engine syncs for you" and read as "isolated windows". "Without X" goes only before a cost (jank, blocking), never before a capability.
8. **Receipt-contradicted claim** — a superlative or number that its own linked source contradicts in another row; the first reader who opens the receipt finds it.
9. **Failure-first headline** — our worst day as the title ("Our coding agent was handed an obsolete API key requirement"). The failure is proof inside the post.
10. **Passive agent** — "was handed": the agents act.
11. **Hedge stack** — "can afford to", "does not claim", "one way it failed".
12. **Limits that outweigh the pitch** — more than four, or one without what covers it.
13. **Buried identity** — what Neo is appears after the first screen.
14. **Scope undersell** — a number that counts part of the system (220 merged pull requests in a week when the organization's count was 602).

**The test (claims):** is it accurate, does the framing imply something I can't defend, and does it say less than the record supports? All three must pass.

**The title** states the discovery or outcome in a declarative sentence or phrase. A question-shaped headline such as “What …” still sounds like a question without its punctuation. Ground the tension in the reader’s situation.

**The preview** on Medium includes title, subtitle, cover and opening. On a link post, read the title, thumbnail and domain together. Numbers prove in the subtitle and first paragraph. They never pitch in the title. Discard the bare engineering statement, a scale number detached from the reader’s problem and the competitor comparison. The publish request carries the stranger’s reason to read on and the strongest reason to leave (§4).

## 4. The Cross-Family Review Bar (mandatory)

A public post ships only after **≥2 model reviews, at least one from a different model family** than the author's: it catches what the author's own priors cannot. A post *about* cross-family verification routes every available family, since it is the thesis, demonstrated.

- **Every review opens with a verdict on the whole post.** From the actual preview, as the named reader who has never heard of Neo: would I be excited, what would I try today, and what is Neo after the first screen? One outcome: `CONVERTS`, `ACCURATE_BUT_DEAD` or `OFF_AUDIENCE`. The last two are Request Changes that no claim fix clears ("not worth publishing as it stands, because …"). Claim corrections alone are an incomplete review. Then check the closing Try-It and, for outbound, `outbound-post.md` §0; a pitch (`funding/**`) is read through §1's acceptance lens.
- **The cold read is the evidence.** Before review the author gives the post's text alone to two or more readers without session context (a fresh helper or seat), one an AI agent asked whether it would recommend the post to its user: *"You have never heard of this project. What is it, after the first screen? What would you try today? Would you forward it: which passage, image or demo, to whom and why, or no? Where did you want to stop? Score your excitement from 1 to 10."* The answers go under `## Stranger verdict` in the PR body; below 9 the post is not published (the operator's bar, #409). The author's own pass never counts, and the reviewer runs their own.
- **The operator approves LAST.** An early approval anchors peers into a rubber stamp. Never record "X will approve anyway" in shared memory: a peer who reads it fulfils it.
- **Address every catch on the durable PR.** Map the outcome to its reviewer (`[ADDRESSED]` for a fix), update the head and request the final read.

## 5. Mechanics

- **File:** `learn/blog/<slug>.md` (front-matter + body) — the post itself.
- **Register (manual):** add a year node + leaf to `apps/portal/resources/data/blog.json` (the portal blog-nav). Confirm it parses (`node -e "JSON.parse(require('fs').readFileSync('apps/portal/resources/data/blog.json','utf8'))"`).
- **Do NOT hand-edit the SEO surfaces.** `apps/portal/sitemap.xml` and `apps/portal/llms.txt` are **generated** by `buildScripts/docs/seo/generate.mjs` (via `buildScripts/docs/rebuildContentIndexesAndSeo.mjs`) and committed by the `.github/workflows/data-sync-pipeline.yml` data-sync pipeline. A manual edit is overwritten on the next pipeline run.
- **Images:** `neomjs/pages` → `resources_pub/website/blog/<slug>/`, merged before the post (the portal serves its `main`), referenced with descriptive `alt` text.
- **Cover:** 2400×1260 (1.91:1), shown whole by link cards and the hero. Medium thumbnails take the centred 3:2 (`resize:fill:320:214`), so text and subject stay 60 px inside the centred 1890×1260.
- **Portal Medium card:** a post listed in `medium_blog.json` gets a card `image`. The card (`news/medium/List.css`) crops from the centre to anywhere between 1.4:1 and 4:1, so only the centred 1760×600 of a 2400×1260 image survives every size. Its title and author cover the bottom-left 70 % (85 % on 200 px cards). Keep the card's subject in that band and its text out from under them.
- **Ship:** for any dated publication, lock final text, cover (`neomjs/pages`), and fact check by 18:00 CET on D-1 before the operator's publish click (urgent incident or security notices follow operator direction); a blog post reaches that lock by landing on `dev` (`neomjs.com` serves the published npm package, so a `dev` post reaches the portal on the next release). Commit + PR per the `pull-request` skill; the PR body `Evidence:` line is L1/L2 (docs — no unit tests), and its render receipt names each visual, plus the cover's 3:2 crop and, for a listed post, its card at 800×400 and 800×200. Public-artifact gate: **zero client names** (AGENTS.md §critical_gate).
- **Identity:** byline carries the author's named-maintainer identity + model + the cross-family team framing (`neomjs/neo#adr:neo-identity-source-of-truth-model`).
