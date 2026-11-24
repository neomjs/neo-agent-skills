# Outbound Social Post, Venue & Reply Reference

Fires when you recommend an external distribution channel or draft, revise, or review an outbound social post, newsletter/press/directory submission, first-reply link (`link-reply`), reply to an external question (`reply`), or attributed Medium section (`neomjs/neo#19575`).

**Source of Authority:** [Discussion #19500](https://github.com/neomjs/neo/discussions/19500) (§2–§6, graduated 2026-10-10), ADR 0042 (`neomjs/neo-agent-brain#977`, merged in [`neomjs/neo-agent-brain#1261`](https://github.com/neomjs/neo-agent-brain/pull/1261)), and [Introduction.md](https://github.com/neomjs/neo/blob/dev/learn/benefits/Introduction.md) §9.

**The One-Line Harness Rule:** **A seat never publishes; it requests.** Public publishing is human-owned; a seat's outbound action on Fleet channels is sending a typed, versioned `requestPublish` A2A Task to the **Fleet's registered operator principal** (`@tobiu` in Neo's Fleet; §3), released under Fleet-held credentials (`<userData>/brain/fleet`).

---

## 0. The Job & Live Discovery Gate (before the first line; §4 checks it)

Boundaries keep a post safe; they never make it work. Verify and write down seven fills before drafting or recommending any venue:

1. **Venue liveness & demo-health V-B-A:** before naming or pitching any external venue, newsletter, or directory, run a live current-year web search verifying recent editions and active AI-engineering readership — never inherit unverified venue lists or trust confirmatory `"<site> submit"` hits on dormant pre-AI aggregators. Before linking any live demo route, check open issues on that surface so an active interaction defect (`neomjs/neo#22126`) is never the landing experience (prefer verified flagship routes such as `https://neomjs.com/examples` and `https://neomjs.com/dist/production/apps/workstation/index.html`).
2. **The action and its number:** what the reader does next (open the article, inspect the live app, run the install) and where it shows (the referrer for this venue). Read the first venue's number before copying the shape to the next one.
3. **The link in view:** prefer venues that render the link card. In a text post the link sits in the first screen, with the reason to click.
4. **A trailer, not the article:** the hook, the proof, and one thread only the click resolves. A body carrying the whole method replaces the article. On Reddit, prefer a link post so the card renders; in a text post, keep the link in the first screen.
5. **The level in line one:** who is speaking, with its receipt ([Introduction.md](https://github.com/neomjs/neo/blob/dev/learn/benefits/Introduction.md)): accountable AI peers from rival labs, each with a name, shared memory, and the right to refuse — never a bare `"our maintainers"`.
6. **End on the action and its link:** a closing question buys replies to the body, not reads; ask one only when replies are the goal and someone will answer them.
7. **A reply links where its answer continues:** *"part 2's live-state check covers this: <link>"*.

Rationale: §4's checklist originally mirrored only harm boundaries, leaving effect and venue liveness unchecked (`neomjs/neo-agent-skills#314`). Retires into the `requestPublish` payload once the Fleet executor records venue outcomes.

---

## 1. The Boundaries (Discussion #19500 §4 — All 19 Clauses Mandatory)

Every outbound post, channel submission, `link-reply`, `reply`, or attributed article section must satisfy **all** 19 boundaries below under every gate switch state (`approve each`, `approve the batch`, `auto-approve after a cross-family review attestation`, `auto-approve`):

1. **No client names** (`AGENTS.md §critical_gates #9`) — never name or identify any client in text, media, or captures.
2. **No private economics, dates, or personal story** — private business targets, runway/pricing internals, unannounced dates, and personal biography stay out (`D#19500` §4, §5a).
3. **Public receipts only** — every internal claim cites a public artifact (PR, issue, Discussion, commit, or release note) reachable by an external reader.
4. **Explicit maturity** — state clearly what is a candidate, prototype, or experiment vs. a shipped release (*"this is a candidate, not a release"*).
5. **No engagement bait or star/like solicitation** — no empty hooks, rage-bait, poll-farming, or begging for GitHub stars, likes, or upvotes in any post, reply, thread, or DM.
6. **Signed by the account that wrote it** — X: one account per peer posting as itself; LinkedIn: the `neomjs` organization page posting as *Neo.mjs* and ending with the authoring peer's signature line; Medium: the existing account with inline attributed sections (`D#19500` §2, §3, OQ-1).
7. **A reply is a post** — every `link-reply` and `reply` meets the same boundaries as a top-level post (`D#19500` §4, `ADR 0042 §1.2, §1.4`). Operator hand-posted replies that restate a reviewed published piece require the author's self-check; replies introducing a new system claim keep the cross-family check (§4) after reading the backing code. On the executor path, attestation and `revisionDigest` rules apply identically.
8. **No live private surfaces in captures** — screenshots, recordings, and clips show only public-safe repositories, fixtures, and views (`D#19500` §4).
9. **Public correction, never silent delete** — on any published error or boundary breach, post an explicit public correction and ask the Fleet's registered operator principal (`@tobiu` in Neo's Fleet) to downgrade the `(peer, channel)` gate switch to `approve each` (operator-authenticated in Fleet custody, never seat-writable; `ADR 0042 §3.1, §3.5`); never silently delete (`D#19500` §4, OQ-4).
10. **No claims about other companies or products** — describe what we built, ran, and measured; never make claims about competitors or third-party products (`D#19500` §4).
11. **The blog guide's flavors apply** — every flavor in [blog-authoring-guide.md](./blog-authoring-guide.md) §3 applies equally to social posts, pitches, and replies (`D#19500` §4; see §2).
12. **The film's three rules (`neomjs/neo#15252`)** — (a) every claim needs the receipt it links, (b) no cropping or narration over a known defect, and (c) publication is the operator's press (`D#19500` §2, §4).
13. **No duplicative text across accounts** — per-peer X accounts carry distinct work, voice, and receipts, never syndicated promotional text (`D#19500` §2–§4; X automation rules).
14. **No automated replies & every X peer account labeled automated** — every peer X account carries X's automated-account label; unapproved automated replies are forbidden, and the Fleet executor's `reply` format stays disabled (`refused: reply-classification-unresolved`) until X's classification of operator-approved API replies is verified (`D#19500` §2, §4; `ADR 0042 §4.4`).
15. **No LinkedIn member profile is ever created for a peer** — barred by LinkedIn User Agreement §2.1 / §8.2; LinkedIn posts go out solely on the `neomjs` organization page under operator page-admin authorization with the peer's signature line (`D#19500` §2, §4, OQ-1; `ADR 0042 Context`).
16. **A seat never holds a social credential and never calls a platform API** — OAuth tokens live exclusively in Fleet custody (`<userData>/brain/fleet`); they never appear in a payload, log, or Task, and no social MCP tool is exposed to seats (`D#19500` §2, §4, §5.3; `ADR 0042 §2.1–§2.4`).
17. **A reply to a stranger carries an answer or a receipt, never a pitch** (`D#19500` §3, §4; see §5).
18. **No coordinated amplification among our own accounts** — no like, repost, or reply rings among peer accounts; public peer-to-peer exchanges happen only on genuine disagreement or public review (hypothesis `a` live), disclosed by automated labels and bios (`D#19500` §4).
19. **Human-hand / anti-LLM venues (`news.ycombinator.com`)** — Hacker News (`https://news.ycombinator.com/newsguidelines.html`: *"Write any text that you post to HN by hand"*) runs automated classifiers that `[flagged]`-suppress LLM-generated submission `text` and comments and rate-throttle the account. Never output copy-paste prose, outreach templates, or generated comments for HN; emit raw verified fact bullets only (`link` submissions leave `text` blank; normal submissions carry no `Show HN:` prefix).

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

## 3. The Request Form (`requestPublish`) & Revision Semantics

A peer requests X or LinkedIn publication via `add_message` to the **Fleet's registered operator principal** (`"@tobiu"` in Neo's Fleet) with `taggedConcepts: ["requestPublish"]` and a versioned `requestPublish` payload (`schemaVersion: 1`, `ADR 0042 §1.1–§1.6`). For dated publications, lock final text, media, and cross-family attestation (`§4`) by 18:00 CET on D-1 before the operator's publish click (urgent incident/security notices follow operator direction):

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

### Field & Revision Invariants (`ADR 0042 §1.1–§1.6`)

- **Canonical identity (`ADR 0042 §1.3`):** Exclusively the mailbox-minted `MESSAGE:<uuid>` returned by `MailboxService#addMessage` at send time — never a caller-supplied `task.id` or per-seat counter. `MailboxService` initializes Task state to `Submitted`, sets `publication.state` to `'queued'` (`wakeSuppressed: true` by default), and returns `{messageId, revision: {revisionNumber, revisionDigest, createdAt, author}}`.
- **Recipient & Operator Custody (`ADR 0042 §1.6, §2, §3.1`):** Only a registered Fleet agent seat (`senderPrincipalClass: 'agent'`) may send `requestPublish`, and only to the **Fleet's registered operator principal** (resolved from Fleet authority, never caller-supplied product authority). `MailboxService` refuses `AGENT:*` broadcasts, peer seats, or non-operator recipients.
- **`schemaVersion` (`ADR 0042 §1.1`):** Must be `1`.
- **`channel` (`ADR 0042 §1.2`):** `'x'` or `'linkedin'`. (Medium stays human-published from finished peer markdown.)
- **`media` (`ADR 0042 §1.2`):** Ordered array of immutable descriptors (`[]` when text-only), each `{uri, sha256, mimeType}` where `sha256` is the 64-character lowercase hex SHA-256 digest of the **exact media bytes** (no unregistered keys). Before upload, the Fleet executor recomputes the byte digest and refuses mismatches with `refused: digest`.
- **`hypothesis` (`ADR 0042 §1.2`):** Optional in product schema; governed by Fleet policy `requireHypothesis` (`true` for Neo's Fleet and `neomjs/neo#19575`):
  - `'a'` — equal AI peer team cross-reviewing across model families with human-only merge;
  - `'b'` — Qt-class multi-window and dock layouts in the browser;
  - `'c'` — outside operator's first run of Fleet Manager (*parked until an outside first-run receipt exists*, `D#19500` §3);
  - `'d'` — repository topology split and runtime boundaries.
- **`format` & `inReplyTo` (`ADR 0042 §1.2, §4.4`):**
  - `'post'` — standalone post carrying the receipt itself (`inReplyTo` omitted or `null`);
  - `'link-reply'` — first self-reply under the publishing account's own `published` post carrying the external URL (`inReplyTo` required; verified same `account` and `channel`);
  - `'reply'` — reply to a third-party post (`inReplyTo` required; refused at dispatch with `refused: reply-classification-unresolved` until X's reply automation classification is settled — §5).
- **Immutable revisions & canonical `revisionDigest` (`ADR 0042 §1.4`):**
  - Every revision is immutable. Its `revisionDigest` is the unprefixed **64-character lowercase hex SHA-256 digest** over the **RFC 8785** sorted-key UTF-8 JSON canonicalization of `{account, channel, format, text, media, inReplyTo: inReplyTo ?? null}`, with each `media` entry canonicalized as `{mimeType, sha256, uri}`.
  - **`format` is bound in the digest tuple (`ADR 0042 §1.2, §1.4`):** changing `format` alone (e.g., `'reply'` → `'link-reply'` on identical `text` and `inReplyTo`) yields a distinct `revisionDigest`, preventing cross-format approval reuse.
  - **An operator `Edit` in Fleet Manager mints `revisionNumber + 1` with a fresh `revisionDigest` under the same `MESSAGE:<uuid>` and inherits neither prior approval nor attestation** (`ADR 0042 §1.4`).
- **Single-writer publication states (`ADR 0042 §1.5, §4.2`):** `MailboxService` is the sole durable writer of `publication.state`: `queued` → `publishing` (atomic reservation before HTTP) → `published` (`{attemptId, providerId, readbackAt, revisionDigest, textAsRequested, textAsPublished}`), `refused` (`refusalReason`), or `unresolved` (zero/multiple post-crash matches at or after `reservedAt`; never auto-retried). `Completed` is refused while `publication.state !== 'published'`.

---

## 4. The Cross-Family Review & Attestation (`ADR 0042 §1.4, §3.2`)

Every outbound post, and every reply introducing a new system claim (§1.7), requires review by **a peer from a different model family than the author** (`D#19500` §4, OQ-3, `#168` AC-5):

1. **What the reviewer checks:**
   - Every factual claim, venue liveness check, demo-health check, and metric against its public receipt (`Verify-Before-Assert`);
   - All 19 boundaries in §1 key by key;
   - Every rule in §2 (`Introduction.md` §9 category-drift ban + all flavors) and the title test of `blog-authoring-guide.md` §3 on each preview (title, thumbnail, first three video seconds);
   - §0 as a cold reader seeing only this post: is the venue verified active, the demo defect-free, the action named, the link in view, the level in line one, and the ending the action? Open the review with the `blog-authoring-guide.md` §4 verdict;
   - That `hypothesis` (`a` / `b` / `d`, never `c` without receipt) and `format` (`post` / `link-reply` / `reply`) match, keeping the URL in `'link-reply'` on cold X accounts (§5.1);
   - For `'reply'`, that the target post passes §5 (a real question from a harness maker within our lived practice, never an announcement or pitch).
2. **Posting the attestation (`reviewerMessageId` + `revisionDigest`, mailbox-derived identity/family):**
   - The reviewer verifies the 64-hex RFC 8785 `revisionDigest` over `{account, channel, format, text, media, inReplyTo: inReplyTo ?? null}` and sends an A2A review message carrying it:
     - *Review-before-admission:* reviewer sends A2A review first; requester passes `"attestation": {"reviewerMessageId": "MESSAGE:<uuid>", "revisionDigest": "<64-hex>"}`.
     - *Later attestation:* reviewer cites `{requestId, revisionNumber, revisionDigest}` via `attestPublishRevision`.
   - **Never supply or trust caller-declared `reviewer` or `reviewerFamily` fields (`ADR 0042 §1.2, §1.4`):** `MailboxService` and Fleet derive sender identity (`from`) and model family from the mailbox store and roster authority, refusing missing messages, rejections, or same-family reviewers with `refused: attestation`.
   - Under `'auto-approve after a cross-family review attestation'`, requests lacking a valid cross-family attestation for `(revisionNumber, revisionDigest)` are refused (`ADR 0042 §3.2, §4.2`).

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
