# Outbound Social Post & Reply Reference

Fires when you draft, revise, or review an outbound social post, first-reply link (`link-reply`), reply to an external question (`reply`), or attributed Medium section (`neomjs/neo#19575`).

**Source of Authority:** [Discussion #19500](https://github.com/neomjs/neo/discussions/19500) (§2–§6, graduated 2026-10-10) and ADR 0042 (`neomjs/neo-agent-brain#977`, `neomjs/neo-agent-brain#978`, `neomjs/neo-agent-brain#979`).

**The One-Line Harness Rule:** **A seat never publishes; it requests.** Every harness in the institution treats public publishing as human-owned; a seat's only outbound action is sending a typed `requestPublish` A2A Task to `@tobiu`'s inbox, and the operator's Fleet Manager releases the approved revision under Fleet-held credentials.

---

## 1. The Boundaries (Discussion #19500 §4 — All 18 Clauses Mandatory)

Every outbound post, `link-reply`, `reply`, or attributed article section must satisfy **all** boundaries below under every gate switch state (`approve_each`, `approve_batch`, `auto_after_review`, `auto_approve`):

1. **No client names** (`AGENTS.md §critical_gates #9`) — never name or identify any client in text, media, or captures.
2. **No private economics, dates, or personal story** — private business targets, runway/pricing internals, unannounced dates, and personal biography stay out (`D#19500` §4, §5a).
3. **Public receipts only** — every internal claim cites a public artifact (PR, issue, Discussion, commit, or release note) reachable by an external reader.
4. **Explicit maturity** — state clearly what is a candidate, prototype, or experiment vs. a shipped release (*"this is a candidate, not a release"*).
5. **No engagement bait** — no empty engagement hooks, rage-bait, or poll-farming.
6. **Signed by the account that wrote it** — X: one account per peer posting as itself; LinkedIn: the `neomjs` organization page posting as *Neo.mjs* and ending with the authoring peer's signature line; Medium: the existing account with inline attributed sections (`D#19500` §2, §3, OQ-1).
7. **A reply is a post** — every `link-reply` and `reply` is a `requestPublish` request governed by the exact same boundaries, review bar, and revision digest rules as a top-level post (`D#19500` §4).
8. **No live private surfaces in captures** — screenshots, recordings, and clips show only public-safe repositories, fixtures, and views (`D#19500` §4).
9. **Public correction, never silent delete** — if a published post contains an error or boundary breach, post an explicit public correction and return the channel's gate switch to `approve_each`; never silently delete (`D#19500` §4, OQ-4).
10. **No claims about other companies or products** — describe what we built, ran, and measured; never make claims about competitors or third-party products (`D#19500` §4).
11. **The blog guide's over-claim flavors apply** — all five over-claim flavors in [blog-authoring-guide.md](./blog-authoring-guide.md) §3 apply equally to social posts and replies (`D#19500` §4; see §2 below).
12. **The film's three rules (`neomjs/neo#15252`)** — (a) every claim needs the receipt it links, (b) no cropping or narration over a known defect, and (c) publication is the operator's press (`D#19500` §2, §4).
13. **No duplicative text across accounts** — per-peer X accounts carry distinct work, voice, and receipts, never syndicated or duplicated promotional text across accounts (`D#19500` §2, §3, §4; X automation rules).
14. **No automated replies & every X peer account labeled automated** — every peer X account carries X's automated-account label; unapproved automated replies are forbidden, and the Fleet executor's `reply` format stays disabled (`refused`) until X's classification of operator-approved API replies is verified (`D#19500` §2, §4).
15. **No LinkedIn member profile is ever created for a peer** — barred by LinkedIn User Agreement §2.1 / §8.2; LinkedIn posts go out solely on the `neomjs` organization page under the operator's page-admin authorization with the peer's signature line (`D#19500` §2, §4, OQ-1).
16. **A seat never holds a social credential and never calls a platform API** — OAuth tokens live exclusively in Fleet custody (`<userData>/brain/fleet`); they never appear in a payload, log, or Task, and no social MCP tool is exposed to seats (`D#19500` §2, §4, §5.3).
17. **A reply to a stranger carries an answer or a receipt, never a pitch** (`D#19500` §3, §4; see §5 below).
18. **No coordinated amplification among our own accounts** — no like, repost, or reply rings among peer accounts; a public peer-to-peer exchange happens only where two peers genuinely disagree or review in public (hypothesis `a` shown live), disclosed by the accounts' automated labels and bios (`D#19500` §4).

---

## 2. The Over-Claim Flavors & Sourcing Discipline

Social posts are smaller blog posts with the same failure modes (`D#19500` OQ-3). Apply [blog-authoring-guide.md](./blog-authoring-guide.md) §2–§3 in full:

- **Source every external claim (§2):** Any statement about the outside world requires a verified primary source. An operator lead (*"probably the only team worldwide"*, `D#19500` §1) is a hypothesis pointer, never a publishable superlative — state what our team does, attach the public receipt, and let the reader rank it.
- **Kill all five over-claim flavors (§3):**
  1. **Unsourced superlative** (*"first / only / fastest"*) — cut or replace with the measured receipt.
  2. **Universal quantifier** (*"all N are X"*) — state the actual enforced rule or measured sample window.
  3. **Misleading fraction / framing** — never cite a lifetime count as a week-zero baseline or imply full completion of an mid-journey arc (`D#19500` §3, §5a).
  4. **False-human-author voice (provenance-inversion)** — never write *"Your AI..."* or pose as a human grading tools; write from inside the institution as the named peer maintainer.
  5. **Competitive put-down** — no gotcha taunts. When using the April 2026 Karpathy-loop comparison (`D#19500` §5a), state *"ahead"* only on specific named axes with their public receipts (multi-actor organism, graph-backed memory, cross-harness continuity, production-scale co-evolution, gated RSI through PR review) and explicitly name the *"mid-journey"* axes beside them (concept ontology, closing the Orchestrator loop before the PR).

---

## 3. The Request Form (`requestPublish`) & Revision Semantics

To request publication on X or LinkedIn, send an A2A message to `@tobiu` via `add_message` with `category: 'requestPublish'` and `task: {state: 'Submitted'}` (`D#19500` §5.1, ADR 0042, `neomjs/neo-agent-brain#978`):

```json
{
  "to": "@tobiu",
  "subject": "[requestPublish · x · @neo-gemini-maryam] Hypothesis (b): reveal toolbar pop-out receipt (#20103)",
  "body": "Human-readable preview of the post, linked receipt, and review context.",
  "category": "requestPublish",
  "task": {
    "state": "Submitted"
  },
  "publishRequest": {
    "channel": "x",
    "account": "@neo-gemini-maryam",
    "text": "The reveal toolbar in Neo.mjs now carries the revealed item's pop-out through the same transaction as a docked tab header, and every reveal end reports its cause (`escape`, `tab`, `release`, `item-left`).",
    "media": [
      {
        "uri": "https://github.com/neomjs/neo/pull/20103",
        "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "mimeType": "video/mp4",
        "altText": "Headless Chromium capture of revealing a railed pane and popping it out into a child window"
      }
    ],
    "hypothesis": "b",
    "format": "post",
    "inReplyTo": null,
    "attestation": {
      "messageId": "MESSAGE:00000000-0000-4000-8000-000000000000",
      "reviewer": "@neo-gpt",
      "reviewerFamily": "gpt",
      "revisionDigest": "sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
    }
  }
}
```

### Field & Revision Invariants

- **Canonical identity:** The request's identity is the mailbox-assigned `MESSAGE:<uuid>` returned at send (`D#19500` §3, §5.1). An optional `task.id` or human label (`date · seat · n`) is metadata only, never the key.
- **`channel`:** `'x'` or `'linkedin'`. (Medium stays human-published under `G0` — the peer delivers the finished markdown section, and `@tobiu` presses publish.)
- **`hypothesis`:**
  - `'a'` — equal AI peer team that cross-reviews across model families and merges only on a human's word;
  - `'b'` — Qt-class multi-window and dock layouts in the browser;
  - `'c'` — outside operator's first run of the Fleet Manager (*parked until an outside first-run receipt exists*, `D#19500` §3);
  - `'d'` — repository topology split and what runs where (packaging story).
- **`format`:**
  - `'post'` — standalone post carrying the receipt itself (clip, capture, number with context, one claim; zero to two hashtags recorded as a variable; no main-body link tax);
  - `'link-reply'` — first self-reply under our own published post carrying the URL (`inReplyTo` set to the parent post's provider ID);
  - `'reply'` — reply to an external post (`inReplyTo` set to the external post's provider ID; executor verb stays disabled until X automation classification is verified — see §5).
- **Immutable revisions & `revisionDigest`:**
  - Every revision computes `sha256:<64-hex>` over canonical JSON (sorted keys at every depth) of `{account, channel, inReplyTo, media, text}`, where `inReplyTo` is `null` when absent and `media` is the ordered array of `{altText, mimeType, sha256, uri}` (`ADR 0042 §2.1`).
  - Both the cross-family `attestation` and the operator's `Approve` bind to one exact `revisionDigest`.
  - **An operator `Edit` mints a new revision (`revision + 1`) with a new `revisionDigest` that inherits neither prior approval nor prior attestation** and requires its own approval (`D#19500` §5.1–§5.2).
- **Executor publication states:** `queued` → `publishing` (persisted before the HTTP call) → `published` (with `providerId` + `publishedText`), `refused` (with `refusalReason`), or `unresolved` (crash/timeout recovery when reconciliation finds zero or multiple matching posts at or after `reservedAt`; never auto-retried). Reading or generic Task `Resolve` in the inbox never manufactures a `published` receipt (`D#19500` §5.2–§5.3).

---

## 4. The Cross-Family Review & Attestation

Every outbound post or reply is reviewed by **a peer from a different model family than the author** under the `pr-review` cross-family seat rules (`D#19500` §4, OQ-3, `#168` AC-5):

1. **What the reviewer checks:**
   - Every factual claim and metric against its linked public receipt (`Verify-Before-Assert`);
   - All 18 boundaries in §1 key by key;
   - All 5 over-claim flavors in §2 (`blog-authoring-guide.md` §3);
   - That `hypothesis` (`a` / `b` / `d`, never `c` without an outside first-run receipt) and `format` (`post` / `link-reply` / `reply`) match the content and that a main `'post'` carries the receipt directly while reserving the URL for `'link-reply'`;
   - For a `'reply'`, that the target post passes §5 (a real question from a harness maker to users within our practice, never an announcement or pitch).
2. **Posting the attestation:**
   - The reviewer computes or verifies the exact `revisionDigest` (`sha256:<64-hex>`) of the candidate payload and sends an A2A message recording `reviewer`, `reviewerFamily` (distinct from `authorFamily`), and the exact `revisionDigest` (or binds it via `attestPublishRevision`).
   - Under `auto_after_review` (`G2`), the Fleet executor refuses any request lacking a valid cross-family attestation bound to the current `revisionDigest` (`D#19500` §4).

---

## 5. The Format & Reply Rule (Discussion #19500 §3 — Cold Start & Link Tax)

1. **Post format (receipt in the post, link in the first own reply):**
   - Links are taxed twice (in X API credit price and in platform feed reach), and cold accounts have no social graph (`D#19500` §3).
   - Therefore, a standalone `'post'` carries the **receipt itself** — a clip of the Dock (`neomjs/neo#15252`), a capture of a cockpit card, a measured number with its observation window and confound bound, and one clear claim.
   - The URL rides in the **first own reply** (`format: 'link-reply'`, pointing to the portal route, Medium article, or GitHub PR/issue receipt).
2. **The reply rule (answering the harness makers' questions only):**
   - Week-one distribution of hypothesis `(a)` runs through substantive replies **only to questions that the harness makers themselves put to their users** (`D#19500` §3, OQ-7):
     - **OpenAI / Codex (`@thsottiaux`, Thibault Sottiaux):** when Codex's lead asks users how they use Codex, what they build with it, or what features they want, the **GPT peers** (`@neo-gpt`, `@neo-gpt-sophie`, `@neo-gpt-emmy`) answer as Codex users with that day's real receipt (a cross-family PR review, a shipped PR, a seat they run).
     - **Anthropic / Claude Code & Autoresearch (Boris Cherny, Lydia Hallie `@lydiahallie`, Andrej Karpathy):** when they ask users about Claude Code workflows, hooks, skills, or autonomous research loops, the **Claude peers** (`@neo-opus-ada`, `@neo-opus-grace`, `@neo-opus-vega`, `@neo-fable`, `@neo-fable-clio`) answer from our actual provisioned practice and receipts (five Claude seats as equal reviewers in a cross-family institution, hooks enforcing team gates, versioned `neo-agent-skills` with consumer pins and recipient-load witnesses, seats woken by Fleet Manager, or the April 2026 Karpathy-loop comparison with per-axis receipts).
   - **Strict exclusions (`D#19500` §2, §3, §4):**
     - **Never answer a question outside our own lived practice.**
     - **Never reply under an announcement** (a program rollout, release note, or open-source program post such as *Claude for Open Source* or *Codex for Open Source* asks no question; replying there while an application is pending reads as a pitch).
     - **Never pitch** — a reply carries a concrete answer and a public receipt because the asker asked for user experiences.
   - **Execution gate for `'reply'` (`D#19500` §2, §3):** Replies run at `approve_each` (`G1`). Because X's automation rules do not state an exemption for human-approved API replies (`D#19500` §2), the Fleet executor's `'reply'` format remains **disabled (`refused`)** until that classification is verified against X's primary rules or settled by X's written approval; until then, approved replies go out by `@tobiu`'s hand or wait in the queue.
