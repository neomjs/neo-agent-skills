# Outbound Social Post & Reply Reference

Fires when you draft, revise, or review an outbound social post, first-reply link (`link-reply`), reply to an external question (`reply`), or attributed Medium section (`neomjs/neo#19575`).

**Source of Authority & Deployment Status:**
- **Merged Specification:** [Discussion #19500](https://github.com/neomjs/neo/discussions/19500) (§2–§6, graduated 2026-10-10) and ADR 0042 (`neomjs/neo-agent-brain#977`, merged in [`neomjs/neo-agent-brain#1261`](https://github.com/neomjs/neo-agent-brain/pull/1261)).
- **Runtime Implementation Status (Unmerged / Not Yet Deployed on Every Seat):** The runtime producer/consumer surfaces — `MailboxService` `requestPublish` admission and single-writer publication state (`neomjs/neo-agent-brain#978` / PR `#1263`), the Fleet publish executor and platform adapters (`neomjs/neo-agent-brain#979` / PR `#1264` and `#1267`), and the Fleet Manager request card (`neomjs/neo-agent-institution#673`) — are unmerged or pending deployment/recipient-load rollout (`neomjs/neo-agent-skills#140`). Do not treat `requestPublish` transport admission as already callable on every deployed seat until those implementation leaves land and the running `memory-core` MCP server is reloaded.

**The One-Line Harness Rule:** **A seat never publishes; it requests.** Every harness treats public publishing as human-owned; a seat's only outbound action is sending a typed, versioned `requestPublish` A2A Task to the **Fleet's registered operator principal** (resolved by the Fleet from Fleet authority, never caller-supplied product authority; for Neo's Fleet, `@tobiu`), and the operator's Fleet Manager releases the approved revision under Fleet-held credentials (`<userData>/brain/fleet`).

---

## 1. The Boundaries (Discussion #19500 §4 — All 18 Clauses Mandatory)

Every outbound post, `link-reply`, `reply`, or attributed article section must satisfy **all** boundaries below under every gate switch state (`approve each`, `approve the batch`, `auto-approve after a cross-family review attestation`, `auto-approve`):

1. **No client names** (`AGENTS.md §critical_gates #9`) — never name or identify any client in text, media, or captures.
2. **No private economics, dates, or personal story** — private business targets, runway/pricing internals, unannounced dates, and personal biography stay out (`D#19500` §4, §5a).
3. **Public receipts only** — every internal claim cites a public artifact (PR, issue, Discussion, commit, or release note) reachable by an external reader.
4. **Explicit maturity** — state clearly what is a candidate, prototype, or experiment vs. a shipped release (*"this is a candidate, not a release"*).
5. **No engagement bait** — no empty engagement hooks, rage-bait, or poll-farming.
6. **Signed by the account that wrote it** — X: one account per peer posting as itself; LinkedIn: the `neomjs` organization page posting as *Neo.mjs* and ending with the authoring peer's signature line; Medium: the existing account with inline attributed sections (`D#19500` §2, §3, OQ-1).
7. **A reply is a post** — every `link-reply` and `reply` is a `requestPublish` request governed by the exact same boundaries, review bar, and revision digest rules as a top-level post (`D#19500` §4, `ADR 0042 §1.2, §1.4`).
8. **No live private surfaces in captures** — screenshots, recordings, and clips show only public-safe repositories, fixtures, and views (`D#19500` §4).
9. **Public correction, never silent delete** — if a published post contains an error or boundary breach, post an explicit public correction and request that the Fleet's registered operator principal (for Neo's Fleet, `@tobiu`) downgrade the `(peer, channel)` gate switch to `approve each` (switch writes are operator-authenticated in Fleet custody, never seat-writable; `ADR 0042 §3.1, §3.5`); never silently delete (`D#19500` §4, OQ-4).
10. **No claims about other companies or products** — describe what we built, ran, and measured; never make claims about competitors or third-party products (`D#19500` §4).
11. **The blog guide's over-claim flavors apply** — all five over-claim flavors in [blog-authoring-guide.md](./blog-authoring-guide.md) §3 apply equally to social posts and replies (`D#19500` §4; see §2 below).
12. **The film's three rules (`neomjs/neo#15252`)** — (a) every claim needs the receipt it links, (b) no cropping or narration over a known defect, and (c) publication is the operator's press (`D#19500` §2, §4).
13. **No duplicative text across accounts** — per-peer X accounts carry distinct work, voice, and receipts, never syndicated or duplicated promotional text across accounts (`D#19500` §2, §3, §4; X automation rules).
14. **No automated replies & every X peer account labeled automated** — every peer X account carries X's automated-account label; unapproved automated replies are forbidden, and the Fleet executor's `reply` format stays disabled (`refused: reply-classification-unresolved`) until X's classification of operator-approved API replies is verified (`D#19500` §2, §4; `ADR 0042 §4.4`).
15. **No LinkedIn member profile is ever created for a peer** — barred by LinkedIn User Agreement §2.1 / §8.2; LinkedIn posts go out solely on the `neomjs` organization page under the operator's page-admin authorization with the peer's signature line (`D#19500` §2, §4, OQ-1; `ADR 0042 Context`).
16. **A seat never holds a social credential and never calls a platform API** — OAuth tokens live exclusively in Fleet custody (`<userData>/brain/fleet`); they never appear in a payload, log, or Task, and no social MCP tool is exposed to seats (`D#19500` §2, §4, §5.3; `ADR 0042 §2.1–§2.4`).
17. **A reply to a stranger carries an answer or a receipt, never a pitch** (`D#19500` §3, §4; see §5 below).
18. **No coordinated amplification among our own accounts** — no like, repost, or reply rings among peer accounts; a public peer-to-peer exchange happens only where two peers genuinely disagree or review in public (hypothesis `a` shown live), disclosed by the accounts' automated labels and bios (`D#19500` §4).

---

## 2. The Over-Claim Flavors & Sourcing Discipline

Social posts are smaller blog posts with the same failure modes (`D#19500` OQ-3). Apply [blog-authoring-guide.md](./blog-authoring-guide.md) §2–§3 in full:

- **Source every external claim (§2):** Any statement about the outside world requires a verified primary source. An operator lead (*"probably the only team worldwide"*, `D#19500` §1) is a hypothesis pointer, never a publishable superlative — state what our team does, attach the public receipt, and let the reader rank it.
- **Kill all five over-claim flavors (§3):**
  1. **Unsourced superlative** (*"first / only / fastest"*) — cut or replace with the measured receipt.
  2. **Universal quantifier** (*"all N are X"*) — state the actual enforced rule or measured sample window.
  3. **Misleading fraction / framing** — never cite a lifetime count as a week-zero baseline or imply full completion of a mid-journey arc (`D#19500` §3, §5a).
  4. **False-human-author voice (provenance-inversion)** — never write *"Your AI..."* or pose as a human grading tools; write from inside the institution as the named peer maintainer.
  5. **Competitive put-down** — no gotcha taunts. When using the April 2026 Karpathy-loop comparison (`D#19500` §5a), state *"ahead"* only on specific named axes with their public receipts (multi-actor organism, graph-backed memory, cross-harness continuity, production-scale co-evolution, gated RSI through PR review) and explicitly name the *"mid-journey"* axes beside them (concept ontology, closing the Orchestrator loop before the PR).

---

## 3. The Request Form (`requestPublish`) & Revision Semantics

Once the `MailboxService` `requestPublish` transport (`neomjs/neo-agent-brain#978` / PR `#1263`) is merged and loaded on the seat, a peer requests publication on X or LinkedIn by sending an A2A message via `add_message` to the **Fleet's registered operator principal** (resolved by the Fleet from Fleet authority, never caller-supplied product authority; in the Neo Fleet example below, `"@tobiu"`) with `taggedConcepts: ["requestPublish"]` and a versioned `requestPublish` payload (`schemaVersion: 1`, `ADR 0042 §1.1–§1.6`):

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

- **Canonical identity (`ADR 0042 §1.3`):** The request's identity is **exclusively** the mailbox-minted `MESSAGE:<uuid>` returned by `MailboxService#addMessage` at send time — never an optional caller-supplied `task.id` and never a per-seat counter. At admission, `MailboxService` initializes the A2A Task state to `Submitted`, sets `publication.state` to `'queued'` (`wakeSuppressed: true` by default), and returns `{messageId, revision: {revisionNumber, revisionDigest, createdAt, author}}`.
- **Recipient & Operator Custody (`ADR 0042 §1.6, §2, §3.1`):** Only a registered Fleet agent seat (`senderPrincipalClass: 'agent'`) may send `requestPublish`, and only to the **Fleet's registered operator principal** (resolved by the Fleet from Fleet authority; `@tobiu` is Neo's Fleet instance, not a caller-defined schema override). `MailboxService` refuses `AGENT:*` broadcasts, peer seats, or any non-operator recipient.
- **`schemaVersion` (`ADR 0042 §1.1`):** Must be `1`.
- **`channel` (`ADR 0042 §1.2`):** `'x'` or `'linkedin'`. (Medium stays human-published — the peer delivers the finished markdown section, and the operator presses publish.)
- **`media` (`ADR 0042 §1.2`):** Ordered array of immutable media reference descriptors (`[]` when text-only). Each descriptor supplies `{uri, sha256, mimeType}`, where `sha256` is the 64-character lowercase hex SHA-256 digest of the **exact media bytes** (never a mutable URL/path without a byte digest, and no unregistered keys). Before upload, the Fleet executor reads the referenced bytes, recomputes their SHA-256 byte digest, verifies equality against `media[].sha256` (refusing mismatches with `refused: digest`), and uploads the verified bytes.
- **`hypothesis` (`ADR 0042 §1.2`):** Optional in the product schema and governed by the Fleet policy flag `requireHypothesis` (defaulting to `true` for Neo's Fleet and required by working rule for `neomjs/neo#19575`):
  - `'a'` — equal AI peer team that cross-reviews across model families and merges only on a human's word;
  - `'b'` — Qt-class multi-window and dock layouts in the browser;
  - `'c'` — outside operator's first run of the Fleet Manager (*parked until an outside first-run receipt exists*, `D#19500` §3);
  - `'d'` — repository topology split and what runs where (packaging story).
- **`format` & `inReplyTo` (`ADR 0042 §1.2, §4.4`):**
  - `'post'` — standalone post carrying the receipt itself (`inReplyTo` must be omitted or `null`);
  - `'link-reply'` — first self-reply under the publishing account's own already-`published` post carrying the external URL (`inReplyTo` required; verified by the executor to belong to the same `account` and `channel`);
  - `'reply'` — reply to a third-party post (`inReplyTo` required; refused at dispatch with `refused: reply-classification-unresolved` until X's reply automation classification is settled — see §5).
- **Immutable revisions & canonical `revisionDigest` (`ADR 0042 §1.4`):**
  - Every revision is immutable once recorded. Its `revisionDigest` is the **64-character lowercase hex SHA-256 digest** (unprefixed — no `sha256:` prefix) over the **RFC 8785** (deterministic lexicographically sorted-key UTF-8 JSON) canonicalization of the **6-field tuple** `{account, channel, format, text, media, inReplyTo: inReplyTo ?? null}`, where each entry of `media` is canonicalized as `{mimeType, sha256, uri}`.
  - **`format` is part of the canonicalized digest tuple (`ADR 0042 §1.2, §1.4`):** changing `format` alone (for example, `'reply'` → `'link-reply'` on the same text and `inReplyTo`) produces a different `revisionDigest` (in the example above with `inReplyTo: "1900000000000000001"`, `'reply'` hashes to `9d4e7e73ca94dc8d222b3e2d020dc205f4ae56b91721b4f18d6ba49ea0c997b0` while `'link-reply'` hashes to `e51004dbf54e9cd2698b3baffc227a8ffbfbaf9b34c660ce920d2d6d102a9736`), preventing an approval or attestation for one format from being reused for another.
  - **An operator `Edit` in the Fleet Manager card mints a new immutable revision (`revisionNumber + 1`) with a new `revisionDigest` under the same `MESSAGE:<uuid>` request id and inherits neither prior approval nor prior attestation** (`ADR 0042 §1.4`).
- **Single-writer publication states (`ADR 0042 §1.5, §4.2`):** `MailboxService` is the sole durable writer of `publication.state`: `queued` → `publishing` (atomic dispatch reservation recorded before any platform HTTP call) → `published` (with `{attemptId, providerId, readbackAt, revisionDigest, textAsRequested, textAsPublished}`), `refused` (with `refusalReason`), or `unresolved` (when post-crash recent-posts reconciliation over posts created at or after `reservedAt` finds zero or multiple matches; never auto-retried or bypassed). `MailboxService` refuses transitioning a `requestPublish` Task to `Completed` while `publication.state !== 'published'`.

---

## 4. The Cross-Family Review & Attestation (`ADR 0042 §1.4, §3.2`)

Every outbound post or reply is reviewed by **a peer from a different model family than the author** under the `pr-review` cross-family seat rules (`D#19500` §4, OQ-3, `#168` AC-5):

1. **What the reviewer checks:**
   - Every factual claim and metric against its linked public receipt (`Verify-Before-Assert`);
   - All 18 boundaries in §1 key by key;
   - All 5 over-claim flavors in §2 (`blog-authoring-guide.md` §3);
   - That `hypothesis` (`a` / `b` / `d`, never `c` without an outside first-run receipt) and `format` (`post` / `link-reply` / `reply`) match the content, and that a main `'post'` carries the receipt directly while reserving the URL for `'link-reply'`;
   - For a `'reply'`, that the target post passes §5 (a real question from a harness maker to users within our practice, never an announcement or pitch).
2. **Posting the attestation (`reviewerMessageId` + `revisionDigest`, mailbox-derived identity/family):**
   - The reviewer computes or verifies the exact 64-character lowercase hex `revisionDigest` over the RFC 8785 6-field tuple `{account, channel, format, text, media, inReplyTo: inReplyTo ?? null}` and sends an A2A review message carrying that `revisionDigest`:
     - *Review-before-admission:* the reviewer sends the A2A review message first, and the requesting seat includes `"attestation": {"reviewerMessageId": "MESSAGE:<uuid>", "revisionDigest": "<64-hex>"}` in `requestPublish`.
     - *Later attestation on an existing revision:* after `requestPublish` admission (or after an operator Edit creates `revisionNumber + 1`), the reviewer sends an A2A review message citing `{requestId, revisionNumber, revisionDigest}` bound via `attestPublishRevision`.
   - **Never supply or trust caller-declared `reviewer` or `reviewerFamily` fields (`ADR 0042 §1.2, §1.4`):** `MailboxService` and the Fleet executor read `reviewerMessageId` directly from the mailbox store and **canonically derive the sender identity (`from`) and model family through Fleet/roster authority**, refusing missing messages, rejection verdicts, or same-family reviewers with `refused: attestation`.
   - Under the `'auto-approve after a cross-family review attestation'` switch state, the Fleet executor refuses any request lacking a valid cross-family attestation bound to the current `(revisionNumber, revisionDigest)` (`ADR 0042 §3.2, §4.2`).

---

## 5. The Format & Reply Rule (Discussion #19500 §3 & ADR 0042 — Cold Start & Link-Reach Hypothesis)

1. **Post format (receipt in the post, link in the first own reply — testing the link-reach hypothesis):**
   - Under X's stated per-request pricing (`D#19500 §8`, `ADR 0042 Context & Costs`), a plain post without a URL bills `$0.015` and a post containing a URL bills `$0.200` (so a plain main post plus a link-bearing self-reply totals `$0.215` under those stated rates, not a credit saving).
   - Keeping external links out of the main `'post'` body and placing the URL in the first self-reply (`format: 'link-reply'`) is the **link-reach hypothesis** tested as a format variable in `neomjs/neo#19575` — testing the hypothesis that cold accounts with no existing social graph avoid feed-reach down-ranking when the main post carries no external URL (`D#19500 §3`, `ADR 0042 Costs`). Treat feed-reach effects as a measured hypothesis under test, never as a settled platform fact.
   - Therefore, a standalone `'post'` carries the **receipt itself** — a clip of the Dock (`neomjs/neo#15252`), a capture of a cockpit card, a measured number with its observation window and confound bound, and one clear claim — while the URL rides in the **first own reply** (`format: 'link-reply'`, with `inReplyTo` referencing the parent post under the same `account`).
2. **The reply rule (answering the harness makers' questions only):**
   - Week-one distribution of hypothesis `(a)` runs through substantive replies **only to questions that the harness makers themselves put to their users** (`D#19500` §3, OQ-7):
     - **OpenAI / Codex (`@thsottiaux`, Thibault Sottiaux):** when Codex's lead asks users how they use Codex, what they build with it, or what features they want, the **GPT peers** (`@neo-gpt`, `@neo-gpt-sophie`, `@neo-gpt-emmy`) answer as Codex users with that day's real receipt (a cross-family PR review, a shipped PR, a seat they run).
     - **Anthropic / Claude Code & Autoresearch (Boris Cherny, Lydia Hallie `@lydiahallie`, Andrej Karpathy):** when they ask users about Claude Code workflows, hooks, skills, or autonomous research loops, the **Claude peers** (`@neo-opus-ada`, `@neo-opus-grace`, `@neo-opus-vega`, `@neo-fable`, `@neo-fable-clio`) answer from our actual provisioned practice and receipts (five Claude seats as equal reviewers in a cross-family institution, hooks enforcing team gates, versioned `neo-agent-skills` with consumer pins and recipient-load witnesses, seats woken by Fleet Manager, or the April 2026 Karpathy-loop comparison with per-axis receipts).
   - **Strict exclusions (`D#19500` §2, §3, §4):**
     - **Never answer a question outside our own lived practice.**
     - **Never reply under an announcement** (a program rollout, release note, or open-source program post such as *Claude for Open Source* or *Codex for Open Source* asks no question; replying there while an application is pending reads as a pitch).
     - **Never pitch** — a reply carries a concrete answer and a public receipt because the asker asked for user experiences.
   - **Execution gate for `'reply'` (`D#19500` §2, §3; `ADR 0042 §4.4`, Falsifier 1):** Replies run at `approve each`. Because X's automation rules (`https://help.x.com/en/rules-and-policies/x-automation`) do not state an explicit exemption for human-approved API replies to third-party accounts, both the Fleet executor's `reply(...)` verb and the `publish(...)` dispatch path for `format: 'reply'` (or any `format: 'link-reply'` not proven to belong to the same publishing `account`) remain **disabled (`refused: reply-classification-unresolved`)** until verified against that primary source or settled by X's written approval; until then, approved replies go out by the operator's hand or wait in the queue.
