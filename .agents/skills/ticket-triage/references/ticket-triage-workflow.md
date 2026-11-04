# Ticket Triage Workflow

Authoritative protocol for maintainer-side label triage of unlabeled tickets. Codifies the social contract for what happens when a ticket arrives without `ai`, primary, or secondary labels — typically because the author lacked maintainer permissions to apply them at create-time.

`ticket-triage` is the **maintainer-side** dual of `ticket-create` (author-side label discipline) and a **pre-step** to `ticket-intake` (pickup-side intake). When a maintainer agent encounters an unlabeled ticket, this skill governs the labeling decision **before** the ticket can be picked up under `ticket-intake`.

## 1. When to Invoke

Fire this skill when **all** conditions hold:

1. You have maintainer permission on the repository (`WRITE` permission or higher — verify via `get_viewer_permission` MCP tool).
2. You encounter a ticket that is missing **any** of:
   - The mandatory `ai` provenance label (per `ticket-create §4`)
   - A primary label (`bug` / `enhancement` / `epic`)
   - Domain-relevant secondary labels (`architecture`, `core`, `testing`, etc.)
3. You are about to either pick up the ticket OR review it as a maintainer.

**Per-ticket one-shot:** once a maintainer has triaged and labeled a ticket, subsequent maintainers cite the prior triage rather than re-running this skill. Triage is not a per-pickup step — it's a per-ticket gate.

If the ticket already has full labels (mandatory + primary + relevant secondary), skip this skill and proceed to `ticket-intake` (or PR review, if applicable).

## 2. Pre-Triage Context Pull

Before running the four-step workflow:

1. **The ticket body.** Fetch the live issue via `mcp_neo-mjs-github-workflow_get_conversation` (remote-truth-fresh per `ticket-intake §1.1`).
2. **Existing label set.** Run `list_labels` on the repo. Do NOT invent label names — if a needed label is missing, propose its creation via comment and halt triage until it exists.
3. **Author identity, permission & ticket age.** Confirm whether the author is a maintainer, external contributor, or lower-privileged agent, and note `createdAt` vs. current `HEAD` commit distance.
4. **Adjacency & surrounding-topology sweep.** Run `gh search issues --owner neomjs "<subject>"` (open and closed) to anchor secondary-label decisions; on older tickets, check current subclasses and consumers (`get_class_hierarchy` / `grep`) of the named surface.

## 3. The Four-Step Triage Workflow

### Step 1 — Retrospective Six-Stage Challenge

Apply the six-stage challenge chain from `ticket-create §2` retrospectively as a **labeling decision**:

1. **Premise:** is the stated problem real and reproducible? Has the underlying symptom been independently verified, or is it secondhand?
2. **Prescription:** is the stated fix the right substrate for the problem, or does it treat a symptom?
3. **Substrate:** where does this work belong? Service-layer / build script / CI / framework core / documentation? Match the fix to the substrate that owns the concern.
4. **Consumer:** who reads the output of this change? Human developer, agent, Memory Core, Native Edge Graph, Knowledge Base?
5. **Service-Boundary:** does the proposed work cross a service boundary it shouldn't?
6. **Decision Record impact:** does the ticket depend on, amend, supersede, or challenge an ADR / Decision Record?

**Outcome routing:**

- **All six pass:** proceed to Step 2 (apply labels).
- **Valid intent, evolved surrounding reality (`10k+` commits since `createdAt`):** when an older ticket's core **Premise / intent remains valid** (`not already-resolved` / `not superseded`), do **NOT** fail Stage 2/3 or apply `needs-re-triage` merely because its historical prescription or terse body predates newer subclasses, layout adapters, or engine idioms (`extends`, multi-sibling consumers, reactive `_` configs, workers). Proceed to Step 2–3 and **re-anchor the valid intent onto current Neo reality in your §6 triage comment** (naming the current owning substrate, evolved subclasses/consumers per `ticket-intake/references/successor-risk-audit.md §1.2`, and any scope boundary) so `ticket-intake` inherits the updated map.
- **Premise fails (false, obsolete, duplicate, or Negative ROI):** post a structured `[ARCH_ALIGNMENT]` comment flagging the failure(s), apply `needs-re-triage` (*"premise identified as stale, duplicate, or Negative ROI by Swarm Agent"*), do **NOT** apply primary or secondary labels, and halt triage (or close if `already-resolved`/`duplicate`).

**Why `needs-re-triage` on the halt path:** without a marker, an unlabeled halted ticket re-triggers `ticket-triage` on every pass; `needs-re-triage` signals that premise clarification is required before labeling. Never stamp `needs-re-triage` on an older backlog ticket whose core intent is still valid just because its surrounding architecture evolved (`#52`).

### Step 2 — Apply Primary Label

Choose **exactly one** of `bug` / `enhancement` / `epic` based on the ticket body:

- **`bug`:** real defect with reproducer ("X is broken when Y").
- **`enhancement`:** new capability or material improvement ("add X" / "improve Y").
- **`epic`:** work spanning multiple sub-issues (project-management scaffolding, NEVER a valid PR close-target per `pr-review §5.2`).

Apply via `manage_issue_labels(action: 'add', issue_number: N, labels: ['<primary-label>'])`.

**Preserve `ai` on agent-created tickets, including trivial or contributor-available work** (ticket-create §4). On a human-created ticket, add it when an agent takes implementation. It records agent involvement, not a maintainer reservation; assignment controls ownership.

### Step 3 — Apply Secondary Labels

Match the ticket's domain to relevant secondary labels:

- **Domain-vertical:** `core`, `grid`, `build`, `ai`, `testing`, etc.
- **Cross-cutting:** `architecture`, `performance`, `regression`, `refactoring`, `documentation`, `security`.

Verify each label exists in `list_labels` (**do NOT invent label names** — causes silent GitHub API rejections per `ticket-create §4`). If a needed domain label is missing, propose its creation via comment and halt triage until created. Apply via `manage_issue_labels(action: 'add', issue_number: N, labels: ['architecture', 'core', ...])`.

### Step 4 — Assignment Disposition (Optional)

After labels are applied, decide assignment (post-triage allocation choice; triage ends at Step 3 if deferred):

- **Self-assign + proceed to `ticket-intake`:** well-scoped, natural fit, no competing claim; immediately run `ticket-intake`.
- **Self-assign + park:** claim now for later pickup (starts the `ticket-intake §3a` 7-day clock).
- **Leave unassigned + invite contributor:** comment inviting the author or contributors to self-claim.
- **Leave unassigned + flag for swarm:** comment routing to `@neo-opus-ada`, `@neo-gemini-pro`, etc. when cross-family expertise applies.

## 4. Anti-Patterns

| Anti-pattern | Why it harms |
|---|---|
| Applying labels before retrospective six-stage challenge | Bypasses the gate that filters out flawed premises; downstream pickup pressure on bad work |
| Halting valid-intent older tickets (`10k+` commits) with `needs-re-triage` | Stalls valid backlog items over evolved surrounding architecture instead of re-anchoring current substrate/subclasses in the triage comment |
| Inventing label names or skipping `list_labels` | Silent GitHub API rejection or domain-label drift |
| Treating `ai` as a maintainer reservation | Hides agent-created work from contributors |
| Self-assigning without `ticket-intake` follow-through | Bypasses validation/branch-before-code gates |
| Triaging a fresh ticket the author should clarify | Premature labeling locks the author into a framing they may not endorse |
| Re-triaging a ticket already labeled by a maintainer | Duplicate work; cite prior triage instead |

## 5. Relationship to Sibling Skills

| Skill | When | Scope | Relationship |
|---|---|---|---|
| `ticket-create` | Ticket birth | Author-side label discipline | Authors apply labels at create-time; `ticket-triage` covers the case where the author *couldn't* (no maintainer permission). Same labels, different application moment. |
| `ticket-intake` | Sub pickup | Pickup-side validation | `ticket-triage` runs *before* `ticket-intake` when a ticket is unlabeled. After triage, intake proceeds per its own protocol. |
| `epic-review` | Epic pre-pickup | Epic-scope challenge | Orthogonal — `epic-review` runs once per epic per agent identity; `ticket-triage` runs once per ticket per maintainer. |
| `pr-review` | PR validation | Post-work | Orthogonal — `ticket-triage` is at ticket level; `pr-review` is at PR level. |

## 6. Cross-Reference Citations

When you complete a triage, cite the protocol in your label-apply comment:

> *"Triaged per `ticket-triage` skill. Applied: `<labels>`. Stage retrospective passed. [Optional: assignment disposition.]"*

This makes the triage decision auditable and prevents re-triage by future maintainers.

## 7. Verification Before Acting

Before calling `manage_issue_labels`:

- [ ] You have maintainer permission (`get_viewer_permission` returns `WRITE`/`MAINTAIN`/`ADMIN`)
- [ ] Stage 1 retrospective six-stage challenge passed (or you've posted the challenge comment and halted)
- [ ] Primary label chosen is exactly one of `bug`/`enhancement`/`epic`
- [ ] Secondary labels verified to exist in `list_labels` output
- [ ] No invented label names
- [ ] `ai` preserves authoring/pickup provenance, independently of ownership
- [ ] Triage decision will be cited in your follow-up comment
