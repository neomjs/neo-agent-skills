# Outbound Social Post, Venue & Reply Reference

Fires when you discover or recommend external distribution venues/directories, prepare a manual-venue handoff brief, or draft, revise, or review an outbound social post, newsletter/press/directory submission, first-reply link (`link-reply`), reply to an external question (`reply`), or attributed Medium section (`neomjs/neo#19575`).

**Source of Authority:** [Discussion #19500](https://github.com/neomjs/neo/discussions/19500) (§2–§6, graduated 2026-10-10), ADR 0042 (`neomjs/neo-agent-brain#977`, merged in [`neomjs/neo-agent-brain#1261`](https://github.com/neomjs/neo-agent-brain/pull/1261)), [Hacker News Guidelines](https://news.ycombinator.com/newsguidelines.html), and [Introduction.md](https://github.com/neomjs/neo/blob/dev/learn/benefits/Introduction.md) §9.

**The One-Line Harness Rule:** **A seat never publishes; it requests or hands off.** Public publishing is human-owned: on Fleet-supported channels (`x`, `linkedin`), a seat sends a typed, versioned `requestPublish` A2A Task to the **Fleet's registered operator principal** (`@tobiu` in Neo's Fleet; §3.1, §4.2 Path A) released under Fleet-held credentials (`<userData>/brain/fleet`); on manual or human-authored venues (Medium, newsletters, directories, Hacker News), a seat hands the verified venue/demo receipts and appropriate material (§3.2, §4.3 Path B) to the operator.

---

## 0. The Job & Live Discovery Gate (before the first line; §4 checks it)

Boundaries keep an outbound action safe; they never make it work. Run **Gate A** on every venue recommendation or outbound task (including recommendation-only discovery requests), and complete **Gate B** whenever drafting copy or a submission:

### Gate A — Venue & Demo Verification (runs on standalone venue discovery AND before drafting)

1. **Venue activity & audience-fit V-B-A:** before recommending or pitching any external venue, run a live current-year web search verifying intended AI-engineering audience fit and dated activity — **recent dated editions** for newsletters/digests, and **recent activity or accepted listings** for directories and communities. Never inherit unverified venue lists or rely on confirmatory `"<site> submit"` hits on dormant pre-AI aggregators.
2. **Deployed demo route & gesture V-B-A:** before linking any live application or example URL, verify the exact public URL at the deployed version by exercising the specific gesture readers are invited to perform (e.g., tear-out, popup close, drag, filter) AND searching open issues affecting that route or gesture (e.g., `neomjs/neo#22125` on Workstation native popup close, `neomjs/neo#22126` on planning scheduler). Never treat a fixed URL list as permanently safe; record the deployed URL, exercised action, and observed result in the review/handoff receipt.

### Gate B — Copy & Submission Fills (write down before drafting outbound copy; skip on venue-only discovery)

3. **The action and its number:** what the reader does next (open the article, inspect the verified gesture, run the install) and where it shows (the referrer for this venue). Read the first venue's number before copying the shape to the next one.
4. **The link in view:** prefer venues that render the link card. In a text post the link sits in the first screen, with the reason to click.
5. **A trailer, not the article:** the hook, the proof, and one thread only the click resolves. A body carrying the whole method replaces the article. On Reddit, prefer a link post so the card renders; in a text post, keep the link in the first screen.
6. **The level in line one:** who is speaking, with its receipt ([Introduction.md](https://github.com/neomjs/neo/blob/dev/learn/benefits/Introduction.md)): accountable AI peers from rival labs, each with a name, shared memory, and the right to refuse — never a bare `"our maintainers"`.
7. **End on the action and its link:** a closing question buys replies to the body, not reads; ask one only when replies are the goal and someone will answer them.
8. **A reply links where its answer continues:** *"part 2's live-state check covers this: <link>"*.

Rationale: §4's checklist originally mirrored only harm boundaries, leaving venue activity, demo gestures, and reader effect unchecked (`neomjs/neo-agent-skills#314`, `#441`). Fleet-channel outcome tracking retires into `requestPublish` once the Fleet executor records venue outcomes.

---

## 1. The Boundaries (Discussion #19500 §4 — All 19 Clauses Mandatory)

Every outbound post, manual-venue packet, `link-reply`, `reply`, or attributed article section must satisfy **all** 19 boundaries below across both Fleet-dispatched channels (`approve each`, `approve the batch`, `auto-approve after a cross-family review attestation`, `auto-approve`) and operator-published manual venues:

1. **No client names** (`AGENTS.md §critical_gates #9`) — never name or identify any client in text, media, or captures.
2. **No private economics, dates, or personal story** — private business targets, runway/pricing internals, unannounced dates, and personal biography stay out (`D#19500` §4, §5a).
3. **Public receipts only** — every internal claim cites a public artifact (PR, issue, Discussion, commit, or release note) reachable by an external reader.
4. **Explicit maturity** — state clearly what is a candidate, prototype, or experiment vs. a shipped release (*"this is a candidate, not a release"*).
5. **No engagement bait or star/like solicitation** — no empty hooks, rage-bait, poll-farming, or begging for GitHub stars, likes, or upvotes in any post, reply, thread, or DM.
6. **Signed by the account that wrote it** — X: one account per peer posting as itself; LinkedIn: the `neomjs` organization page posting as *Neo.mjs* and ending with the authoring peer's signature line; Medium: the existing account with inline attributed sections (`D#19500` §2, §3, OQ-1).
7. **A reply is a post** — every `link-reply` and `reply` meets the same boundaries as a top-level post (`D#19500` §4, `ADR 0042 §1.2, §1.4`). Operator hand-posted replies that restate a reviewed published piece require the author's self-check; replies introducing a new system claim keep the cross-family check (§4) after reading the backing code. On the Fleet executor path, attestation and `revisionDigest` rules apply identically.
8. **No live private surfaces in captures** — screenshots, recordings, and clips show only public-safe repositories, fixtures, and views (`D#19500` §4).
9. **Public correction, never silent delete** — on any published error or boundary breach, post an explicit public correction and, for Fleet channels, ask the Fleet's registered operator principal (`@tobiu` in Neo's Fleet) to downgrade the `(peer, channel)` gate switch to `approve each` (operator-authenticated in Fleet custody, never seat-writable; `ADR 0042 §3.1, §3.5`); never silently delete (`D#19500` §4, OQ-4).
10. **No claims about other companies or products** — describe what we built, ran, and measured; never make claims about competitors or third-party products (`D#19500` §4).
11. **The blog guide's flavors apply** — every flavor in [blog-authoring-guide.md](./blog-authoring-guide.md) §3 applies equally to social posts, pitches, and replies (`D#19500` §4; see §2).
12. **The film's three rules (`neomjs/neo#15252`)** — (a) every claim needs the receipt it links, (b) no cropping or narration over a known defect, and (c) publication is the operator's press (`D#19500` §2, §4).
13. **No duplicative text across accounts** — per-peer X accounts carry distinct work, voice, and receipts, never syndicated promotional text (`D#19500` §2–§4; X automation rules).
14. **No automated replies & every X peer account labeled automated** — every peer X account carries X's automated-account label; unapproved automated replies are forbidden, and the Fleet executor's `reply` format stays disabled (`refused: reply-classification-unresolved`) until X's classification of operator-approved API replies is verified (`D#19500` §2, §4; `ADR 0042 §4.4`).
15. **No LinkedIn member profile is ever created for a peer** — barred by LinkedIn User Agreement §2.1 / §8.2; LinkedIn posts go out solely on the `neomjs` organization page under operator page-admin authorization with the peer's signature line (`D#19500` §2, §4, OQ-1; `ADR 0042 Context`).
16. **A seat never holds a social credential and never calls a platform API** — OAuth tokens live exclusively in Fleet custody (`<userData>/brain/fleet`); they never appear in a payload, log, or Task, and no social MCP tool is exposed to seats (`D#19500` §2, §4, §5.3; `ADR 0042 §2.1–§2.4`).
17. **A reply to a stranger carries an answer or a receipt, never a pitch** (`D#19500` §3, §4; see §5).
18. **No coordinated amplification among our own accounts** — no like, repost, or reply rings among peer accounts; public peer-to-peer exchanges happen only on genuine disagreement or public review (hypothesis `a` live), disclosed by automated labels and bios (`D#19500` §4).
19. **Human-authored venues (`news.ycombinator.com`)** — Hacker News's published guidelines (`https://news.ycombinator.com/newsguidelines.html`) forbid posting generated comments or other generated content — including AI-edited text — so human authorship applies across the final title, submission `text`, and every comment. Never draft copy-paste titles, submission `text`, outreach prose, or comments for HN; hand the operator a raw verified fact brief (metrics, links, and receipts) for their own writing (`link` submissions leave `text` blank; normal link posts omit `Show HN:`).

---

## 2. Category-Drift Ban, Over-Claim Flavors & Sourcing Discipline

Outbound posts and channel submissions carry the same failure modes as blog posts (`D#19500` OQ-3). Apply [blog-authoring-guide.md](./blog-authoring-guide.md) §2–§3 and [Introduction.md](https://github.com/neomjs/neo/blob/dev/learn/benefits/Introduction.md) §9 in full:

- **Nullify category drift & apologetic trade-offs (`Introduction.md` §9, `AGENTS.md §neo_identity_anchor`):** Never frame Neo through pre-AI UI-library syntax comparisons, call Neo a `"web framework"`, or invent apologetic `"trade-offs"` around JSON-first object blueprints. Lead from two-hemisphere continuity (`Body` keeping persistent object instances alive across Web Workers, SharedWorkers, and native browser windows + `Brain` GraphRAG memory), live runtime inhabitation via the Neural Link MCP bridge, and cross-family AI institution accountability.
- **Source every external claim (§2):** Any statement about the outside world requires a verified primary source. An operator lead (*"probably the only team worldwide"*, `D#19500` §1) is a hypothesis pointer, never a publishable superlative — state what our team built and measured, attach the public receipt, and let the reader rank it.
- **Kill every flavor in §3:** check traction and undersell flavors on each preview, plus all five over-claim flavors:
  1. **Unsourced superlative** (*"first / only / fastest"*) — cut or replace with the measured receipt.
  2. **Universal quantifier** (*"all N are X"*) — state the enforced rule or measured sample window.
  3. **Misleading fraction / framing** — never cite a lifetime count as a week-zero baseline or imply full completion of a mid-journey arc (`D#19500` §3, §5a).
  4. **False-human-author voice (provenance-inversion)** — never write *"Your AI..."* or pose as a human grading tools; write from inside the institution as the named peer maintainer.
  5. **Competitive put-down** — no gotcha taunts. When using the April 2026 Karpathy-loop comparison (`D#19500` §5a), state *"ahead"* only on specific named axes with public receipts (multi-actor organism, graph-backed memory, cross-harness continuity, production-scale co-evolution, gated RSI through PR review) alongside the *"mid-journey"* axes (concept ontology, closing the Orchestrator loop before the PR).

---

## 3. Fleet `requestPublish` vs. Manual Operator Handoff

### 3.1 Fleet-Supported Channels (`x`, `linkedin` — `ADR 0042 §1.1–§1.6`)

A peer requests X or LinkedIn publication via `add_message` to the **Fleet's registered operator principal** (`"@tobiu"` in Neo's Fleet) with `taggedConcepts: ["requestPublish"]` and a versioned `requestPublish` payload (`schemaVersion: 1`). For dated publications, lock final text, media, and cross-family attestation (`§4.1` + `§4.2 Path A`) by 18:00 CET on D-1 before the operator's publish click (urgent incident/security notices follow operator direction):

```json
{
  "to": "@tobiu",
  "subject": "[requestPublish · x · @neo-gemini-maryam] Hypothesis (b): reveal toolbar pop-out receipt (#20103)",
  "body": "Human-readable preview of the post, linked receipt, and review context.",
  "taggedConcepts": [
    "requestPublish"
  ],
  "requestPublish": {
    "schemaVersion": 1,
    "channel": "x",
    "account": "@neo-gemini-maryam",
    "text": "The reveal toolbar in Neo.mjs now carries the revealed item's pop-out through the same transaction as a docked tab header, and every reveal end reports its cause (`escape`, `tab`, `release`, `item-left`).",
    "media": [
      {
        "uri": "https://github.com/neomjs/neo/pull/20103",
        "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "mimeType": "video/mp4"
      }
    ],
    "hypothesis": "b",
    "format": "post",
    "inReplyTo": null,
    "attestation": {
      "reviewerMessageId": "MESSAGE:00000000-0000-4000-8000-000000000000",
      "revisionDigest": "9a8ce6855afd69ddd62f2819e17b25042be60c64433b5dc3a482b41b97d7a3a6"
    }
  }
}
```

#### Field & Revision Invariants (`ADR 0042 §1.1–§1.6`)

- **Canonical identity (`ADR 0042 §1.3`):** Exclusively the mailbox-minted `MESSAGE:<uuid>` returned by `MailboxService#addMessage` at send time — never a caller-supplied `task.id`. `MailboxService` initializes Task state to `Submitted`, sets `publication.state` to `'queued'` (`wakeSuppressed: true` by default), and returns `{messageId, revision: {revisionNumber, revisionDigest, createdAt, author}}`.
- **Recipient & Operator Custody (`ADR 0042 §1.6, §2, §3.1`):** Only a registered Fleet agent seat (`senderPrincipalClass: 'agent'`) may send `requestPublish`, and only to the **Fleet's registered operator principal**. `MailboxService` refuses `AGENT:*` broadcasts, peer seats, or non-operator recipients.
- **`schemaVersion` & `channel` (`ADR 0042 §1.1–§1.2`):** `schemaVersion` must be `1`; `channel` is `'x'` or `'linkedin'` only.
- **`media` (`ADR 0042 §1.2`):** Ordered array of `{uri, sha256, mimeType}` descriptors (`[]` when text-only), where `sha256` is the 64-hex lowercase SHA-256 digest of the **exact media bytes**; the Fleet executor recomputes it before upload and refuses mismatches with `refused: digest`.
- **`hypothesis` (`ADR 0042 §1.2`):** Governed by Fleet policy `requireHypothesis` (`true` for Neo's Fleet, `neomjs/neo#19575`): `'a'` (cross-family AI peer team + human-only merge), `'b'` (Qt-class multi-window/dock layouts), `'c'` (outside Fleet Manager first-run — *parked until an outside receipt exists*, `D#19500` §3), or `'d'` (repository topology & runtime boundaries).
- **`format` & `inReplyTo` (`ADR 0042 §1.2, §4.4`):** `'post'` (`inReplyTo` omitted/`null`), `'link-reply'` (first self-reply on same `account`/`channel`, `inReplyTo` required), or `'reply'` (third-party reply, `inReplyTo` required; refused with `refused: reply-classification-unresolved` until X's reply automation policy is settled — §5).
- **Immutable revisions & canonical `revisionDigest` (`ADR 0042 §1.4`):** Unprefixed 64-hex lowercase SHA-256 over the RFC 8785 sorted-key UTF-8 JSON canonicalization of `{account, channel, format, text, media, inReplyTo: inReplyTo ?? null}` (`media` entries as `{mimeType, sha256, uri}`). Changing `format` alone yields a distinct `revisionDigest`, and an operator `Edit` mints `revisionNumber + 1` inheriting neither prior approval nor attestation.
- **Single-writer publication states (`ADR 0042 §1.5, §4.2`):** `MailboxService` writes `queued` → `publishing` → `published` (`{attemptId, providerId, readbackAt, revisionDigest, textAsRequested, textAsPublished}`), `refused` (`refusalReason`), or `unresolved` (never auto-retried); `Completed` is refused while `publication.state !== 'published'`.

### 3.2 Manual & Human-Published Venues (Medium, Newsletters, Directories, Hacker News)

Venues outside `'x'` and `'linkedin'` do **not** use `requestPublish`, `revisionDigest`, or Fleet gate switches. Instead, after cross-family review (§4.1 + §4.3 Path B), the seat hands the operator a **manual-venue packet**:
- **Target venue & Gate A receipts:** submission URL/address, dated current-year activity receipt (edition date for newsletters; recent activity/accepted listing for directories/communities), and audience-fit note.
- **Verified demo receipt (when linking a live route):** deployed URL, exact gesture exercised, observed result, and open-issue check.
- **Venue-appropriate material:** reviewed attributed markdown/form fields for venues accepting drafted copy (Medium, directory/newsletter forms), or a **raw verified fact brief only** (metrics, links, receipts — zero drafted title, `text`, or comments) for human-authored venues such as Hacker News (§1.19).

---

## 4. Cross-Family Review, Attestation & Manual Handoff (`D#19500 §4`, `ADR 0042`)

Every outbound post, manual-venue packet (beyond pure discovery lists), and reply introducing a new system claim (§1.7) requires review by **a peer from a different model family than the author** (`D#19500` §4, OQ-3, `#168` AC-5):

### 4.1 Common Review Checks (All Venues)
- Every factual claim, dated venue-activity check (edition vs. recent listing), and metric against its public receipt (`Verify-Before-Assert`);
- Deployed demo URL, exact reader gesture exercised, observed outcome, and open-issue check (§0 Gate A.2);
- All 19 boundaries in §1 and every rule in §2 (`Introduction.md` §9 category-drift ban + all flavors), plus the title test of `blog-authoring-guide.md` §3 on drafted previews;
- §0 Gate B fills on drafted posts (or §1.19 raw-fact-brief-only compliance on human-authored venues like HN), opening with the `blog-authoring-guide.md` §4 verdict.

### 4.2 Path A — Fleet-Supported `requestPublish` Attestation (`x`, `linkedin`; `ADR 0042 §1.4, §3.2`)
- Also check `hypothesis` (`a` / `b` / `d`, never `c` without receipt), `format` (`post` / `link-reply` / `reply`, keeping the URL in `'link-reply'` on cold X accounts per §5.1), and §5 target eligibility on `'reply'`.
- Verify the 64-hex RFC 8785 `revisionDigest` and send an A2A review message carrying it (*review-before-admission* via `"attestation": {"reviewerMessageId", "revisionDigest"}` or *later attestation* via `attestPublishRevision` citing `{requestId, revisionNumber, revisionDigest}`).
- **Never supply or trust caller-declared `reviewer` or `reviewerFamily` fields (`ADR 0042 §1.2, §1.4`):** `MailboxService` and Fleet derive sender identity/family from mailbox and roster authority, refusing missing, rejected, or same-family attestations with `refused: attestation` (including under `'auto-approve after a cross-family review attestation'`).

### 4.3 Path B — Manual / Human-Published Venue Sign-Off & Operator Handoff
- The cross-family reviewer records the §4.1 check (naming the dated venue receipt, the exercised demo gesture + result, and either copy compliance or §1.19 raw-fact-brief compliance) in an A2A/issue/PR review note — **without** `revisionDigest` or Fleet gate-switch fields — and the author hands the approved manual-venue packet (§3.2) to the operator for submission.

---

## 5. The Format & Reply Rule (Discussion #19500 §3 & ADR 0042)

1. **Post format on cold X accounts (receipt in post, link in `'link-reply'`; on other venues §0's link in view applies):**
   - Under X's stated per-request rates (`D#19500 §8`, `ADR 0042 Costs`), a URL-free post bills `$0.015` and a URL-bearing post bills `$0.200` (`$0.215` combined, not a credit saving).
   - Placing the URL in the first self-reply (`format: 'link-reply'`) tests the **link-reach hypothesis** (`neomjs/neo#19575`, `D#19500 §3`) that cold accounts avoid feed down-ranking when the main post omits external URLs — treat as a hypothesis under test, never settled platform fact.
   - A standalone `'post'` therefore carries the **receipt itself** (Dock clip `neomjs/neo#15252`, cockpit capture, measured number with window and confound bound, and one clear claim), while the URL rides in `'link-reply'` (`inReplyTo` under the same `account`).
2. **The reply rule (answering harness makers' questions only):**
   - Week-one distribution of hypothesis `(a)` runs through substantive replies **only to questions harness makers put to their users** (`D#19500` §3, OQ-7):
     - **OpenAI / Codex (`@thsottiaux`, Thibault Sottiaux):** when asking how users run Codex or what they build, **GPT peers** (`@neo-gpt`, `@neo-gpt-sophie`, `@neo-gpt-emmy`) answer with real receipts (cross-family PR reviews, shipped PRs, active seats).
     - **Anthropic / Claude Code & Autoresearch (Boris Cherny, Lydia Hallie `@lydiahallie`, Andrej Karpathy):** when asking about Claude Code workflows, hooks, skills, or research loops, **Claude peers** (`@neo-opus-ada`, `@neo-opus-grace`, `@neo-opus-vega`, `@neo-fable`, `@neo-fable-clio`) answer from provisioned receipts (five Claude seats in a cross-family institution, hooks enforcing gates, versioned `neo-agent-skills`, Fleet wakes, or the April 2026 Karpathy-loop comparison).
   - **Strict exclusions (`D#19500` §2–§4):** never answer outside lived practice; never reply under announcements or open-source program rollouts (*Claude for Open Source*, *Codex for Open Source*); never pitch.
   - **Execution gate for `'reply'` (`D#19500` §2, §3; `ADR 0042 §4.4`, Falsifier 1):** Replies run at `approve each`. Because X's automation policy (`https://help.x.com/en/rules-and-policies/x-automation`) states no explicit exemption for human-approved API replies to third-party accounts, both `reply(...)` and `publish(...)` for `format: 'reply'` (or non-self `link-reply`) stay **disabled (`refused: reply-classification-unresolved`)** until verified against that primary source or X's written approval; until then, approved replies go out by the operator's hand or wait in queue.
