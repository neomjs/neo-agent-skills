# Session Sunset Workflow

This document outlines the authoritative protocol for gracefully terminating an agent session (the **Sunset Protocol**).

Because the Neo.mjs Swarm operates across fragmented sessions and multiple agent identities, simply halting execution creates "Zero-State Amnesia". The next agent starts blind. The Sunset Protocol guarantees the next agent has a perfect "cold-pickup" ramp.

## 1. Trigger Conditions: Turn vs. Session

> **Substrate context (cross-references):**
> - **The PRE-DECISION SUNSET GATE** (Engine Atlas, `§a2a_contextual_bridge_protocol`) is the constraint this workflow exists *under*: while no trigger below holds, you are FORBIDDEN from entering it, however natural the "completion narrative" feels. Empirical anchor: 13+ premature sunsets logged on [#10564](https://github.com/neomjs/neo/issues/10564).
> - **Auto-Wakeup Substrate (Epic [#10601](https://github.com/neomjs/neo/issues/10601), corrective [#10611](https://github.com/neomjs/neo/issues/10611) PR-B)** — sunset is **terminal** for the old transcript. Coordination is preserved by **fresh-session recovery** (`checkSunsetted.mjs` → `resumeHarness.mjs` opening a new chat via `freshSessionShortcut`, booting through `context-recovery` with forwarded `originSessionId` + `sandman_handoff.md` + A2A mailbox), not in-place wake injection. **Stale-wake invariant:** treat any wake-shaped payload arriving in an OLD sunsetted transcript as noise — DO NOT continue substantive work there. Coverage follows `ai/scripts/lifecycle/harnessRouting.mjs`; for uncovered seats the operator opens the next session. No seat clears its own transcript. Spurious sunsets waste a 130k+ recovery ramp and risk stale state.

Yielding a turn response is NOT a session termination. You are strictly **FORBIDDEN** from executing the Sunset Protocol simply because a single prompt finished. Execute it ONLY at a true **Session Boundary**:
1. **Context Exhaustion or Cost.** *Exhaustion:* over 75 % of the seat's own window on its gauge (`get_usage` on Claude Desktop, the harness's reading elsewhere), or context-pressure signals; never an absolute token count, since windows run from ~258k (compacted in place) to 1M. *Cost:* every call re-reads the context, but a fresh session first repays its recovery (130k+ tokens), so below exhaustion continuing is the default. A `solo-refresh` is then your own call only when all hold: a quiet point (nothing of yours uncommitted, unpushed, unposted or unanswered); the next lane is semantically distant (related lanes stay in one session) or a wait outlives the prompt cache; in a session the operator opened, the operator has answered at least once since the opening prompt. The wake plane's 250k deferral (neo-agent-brain `ai/daemons/wake/contextGatePolicy.mjs`) is wake-delivery policy, never a sunset trigger.
2. **Macro-Semantic Pivot:** The human explicitly shifts focus to a completely new domain, epic, or architectural phase requiring a clean slate. *Asymmetry Tiebreaker: premature sunset costs more than late sunset; when in doubt, keep the session open.*
3. **Explicit Human Directive:** Explicit instruction to close the session (e.g., "let's wrap", "time to sunset", or `/sunset`).
4. **Proactive Agent Recommendation:** At a natural break point, **RECOMMEND** sunsetting to the human — **NEVER execute unilaterally on recommendation alone.**

### 1.0 Path-Determinism Rule: Solo-Refresh vs Convergent Scopes
Declare an explicit scope to prevent local token limits from triggering a global swarm halt:

- **`scope: solo-refresh`:** Trigger #1 AND lead-role-baton-pass eligible AND swarm not converging-to-halt. Hand over your local lane and persist memory without claiming a global halt.
- **`scope: convergent`:** Trigger #2 (Macro-Semantic Pivot), Trigger #3 (Explicit Human Directive), OR multiple agents converging on sunset. Summarize global state.
- **DEFER:** Otherwise do NOT sunset.

### 1.1 Review Lifecycle & Anti-Kill-Switch Invariants
- **Review waits:** FORBIDDEN from sunsetting while awaiting PR review or author updates (`pull-request-workflow.md`), EXCEPT under Trigger #1 (`scope: solo-refresh`).
- **Bootstrap Goals:** A bootstrap reminder to "Execute the Session Sunset Protocol" applies only when a natural Session Boundary arrives, never immediately after one task.
- **Debate / Request Changes:** Calibration disagreement or `CHANGES_REQUESTED` is active work, NEVER a sunset trigger.
- **Boot Handover Reads:** Reading handover pings at session boot is context-priming, NEVER a trigger to re-sunset.

## 2. The Handoff Structure

> **Standalone / plugin workspace branch (no `neo-mjs-memory-core` or A2A mailbox mounted):**
> Execute **Steps 1, 3, 3.5, 4, 5, and 6** using `git` and `gh` (`gh issue comment` / `gh pr comment` when authenticated), skip daemon/A2A Steps 2, 7, 9, and replace Steps 8 & 10 by writing the structured handover payload to `.agents/handover.md` (or the path declared in repo `AGENTS.md` / `CLAUDE.md`) with active branch + HEAD SHA, open PR/issue URLs, placed user focus items, deferred traps, mental-model state, and the exact first verification command for the next session (`context-recovery` reads this file first).
> *Capability boundary:* `.agents/handover.md` + `gh` comments preserve explicit end-of-session state for the next session in this checkout; append-only per-turn diaries (`add_memory`), A2A self-DM wake routing, and cross-agent / cross-model-family recall require local `neo-mjs-memory-core` (standalone npm package tracked in `neomjs/neo-agent-brain#1719`).

Before terminating an Agent OS maintainer session, execute all 10 steps below:

### Step 1: Codebase Synchronization (The Pre-Sunset Pull)
Detect your checkout class **mechanically** — never guess from harness names. (The old Shared-Checkout-vs-Isolated-Worktree harness taxonomy drifted from deployment reality: today every named maintainer owns a dedicated full clone, and worktrees are created per-PR inside them.)

```bash
[ "$(git rev-parse --git-dir)" = "$(git rev-parse --git-common-dir)" ] && echo primary-clone || echo linked-worktree
```

- **Primary clone (per-agent dedicated clone OR shared checkout) — self-refresh, best-effort:** commit + push any PR-branch work first (existing mandate above), then:

  ```bash
  if [ -z "$(git status --porcelain)" ]; then
      git switch dev
      git pull origin dev
      if [ -f ai/scripts/setup/initServerConfigs.mjs ]; then
          node ai/scripts/setup/initServerConfigs.mjs --migrate-config
      fi
  else
      echo 'dirty tree — skip refresh, surface in handover'
  fi
  ```

  The pull refreshes code; in `neo-agent-brain` (where `ai/` lives post-split), `--migrate-config` reconciles the gitignored `config.mjs` operator-overlay with pulled `config.template.mjs` leaves — a pull alone is NOT enough, because daemons and MCP servers read the overlay, not the template. Because the AI harness initializes MCP servers *before* an agent's first turn, sunset is the only window where this refresh lands in time for the next session's boot. **Any failure (dirty tree, switch/pull/script error) is surfaced in the Step 3 handover comment and the final sunset payload — the refresh is best-effort and must NEVER block sunset completion.**

  > **Division of labor + retirement (Substrate Accretion Defense):** the orchestrator's dev-sync lane keeps the checkouts the daemons run from current on its cadence — its own root, or those listed in `devSyncRoots` — never a seat's clones; a seat's clones are the seat's own (the Fleet Manager gives every seat its full set), and an FF-pull racing an active session is the hazard, so this step owns their freshness and sunset is its safe window. The pull retires only if a session-liveness-aware sync lane covers seat clones; the `neo-agent-brain`-scoped reconcile only if MCP server boot auto-reconciles overlays or local `ai/config.mjs` overlays retire.

- **Linked worktree — push, then refresh your own clone from here:** do NOT switch to `dev` in the worktree (the clone holds it; git refuses to share a branch across worktrees). Commit and push the PR branch (`git push origin HEAD`), then refresh the clone's `dev` from the worktree, best-effort — the pull and, in `neo-agent-brain`, the overlay reconcile, as above:

  ```bash
  CLONE="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"   # the seat's own clone, which this worktree belongs to
  if [ -z "$(git -C "$CLONE" status --porcelain)" ] && [ "$(git -C "$CLONE" branch --show-current)" = dev ]; then
      git -C "$CLONE" pull --ff-only origin dev
      if [ -f "$CLONE/ai/scripts/setup/initServerConfigs.mjs" ]; then
          (cd "$CLONE" && node ai/scripts/setup/initServerConfigs.mjs --migrate-config)
      fi
  else
      echo 'clone dirty or not on dev — skip refresh, surface in handover'
  fi
  ```

  The same surfacing rule as the primary-clone branch: a skip or a failed pull goes into the handover, never blocks the sunset. The next session resumes this worktree or bootstraps a new one from the refreshed `dev`. Every seat owns its clones; no one else refreshes them.

### Step 2: Active PR Cycle State is daemon-owned — agents must NOT trigger sandman

`sandman_handoff.md` (incl. the `## Active PR Cycle State`) is written **exclusively by the orchestrator-daemon's periodic `dream` + `golden-path` service-tasks** (`ai/daemons/TaskDefinitions.mjs`) — the canonical SSOT writer (the REM / Golden-Path "sandman" pipeline is orchestrator-owned; Epic #12065). This step therefore requires **no agent action**.

**Agents must NOT trigger sandman (`ai/scripts/runners/runSandman.mjs` / `GoldenPathSynthesizer`) at sunset, under any scope (`solo-refresh` or `convergent`).** Running it ad-hoc duplicates the daemon, contends on the shared SQLite + Chroma substrate (parallel invocations serialize for ~45min, last-write-wins), and couples a deployment-specific local command into the sunset flow. If `sandman_handoff.md` is stale (mtime > 4h) or the daemon is verified dead, **surface it as a daemon-health issue** (A2A the swarm / file a ticket) — do NOT run the pipeline yourself. Session continuity is preserved without it by the Step 10 Sandman memory + the A2A continuity ping + Memory Core context-priming.

Do NOT edit `sandman_handoff.md` manually under any scope — it is overwritten by the canonical daemon writer.

### Step 3: Handovers Posted (Active Work)
For any tickets or tasks that you actively worked on but did not fully complete, you MUST post a self-contained handover comment directly on the GitHub Issue (using `manage_issue_comment`).
- Provide implementation guidance.
- Provide empirical anchors (e.g. recent test results).
- Signal ownership (who was working on it).
- Define the pickup protocol for the next agent.

### Step 3.5: The Operator's Focus Items
The test is not "is it written somewhere" but "does the fresh session's first read show it with an owner and a date".
1. List every item the operator called important, a priority or a cornerstone this session, from the session's own turns (`query_recent_turns`, `agentIdentity: '@me'`) — one line each, the operator's words paraphrased. No operator present: the list reads *none named* and the step is that line.
2. Each item sits in the handover's pickup list **with an owner and a date**, or is handed to a named owner on the record (a ticket, a dashboard row, a peer's claim). A rule paragraph, a memory note or a mention in prose places nothing.
3. An item that cannot be placed is said to the operator **before** the sunset, as *not placed: X — because*; a "yes, everything is in artifacts" without this list is refused by this step.
4. Step 8's subject carries the count: `focus items: N, N placed`.

Fixture (2026-10-30): the CEO dashboard — the operator's prio-1, named four times — left the handover as a rule paragraph, present and weightless; the fresh session needed it said twice.

### Step 4: Handovers Considered (Deferred Work)
Explicitly document what the next agent should **NOT** pick up. If there are tickets or discussions that are blocked, already handled internally, or assigned to a different domain, list them. This prevents the next agent from wasting cycles triaging noise.

### Step 5: Mental-Model State
Summarize the current architectural phase progress.
- **For `scope: solo-refresh`:** Restrict this summary strictly to your local lane and immediate authority links. Do not summarize global swarm progress.
- **For `scope: convergent`:** Summarize the global architectural state. What phase is stable? What is actively being built? What are the outstanding structural blockers?

### Step 6: Marathon Metrics
Summarize the scope of your session. How many PRs were merged? How many skills were enhanced? What major decisions were averted or made?
- **For `scope: solo-refresh`:** Report only your local metrics.
- **For `scope: convergent`:** Report global metrics if known, or aggregate state.

### Step 7: Inbox Cleanup (`mark_read`)
To preserve "hot" thread visibility across sessions (Option B), agents do NOT `mark_read` messages immediately during active processing. Now that handovers are drafted (and have read your inbox state), you MUST explicitly use the `mark_read` MCP tool on all processed messages in your inbox. This ensures the inbox is clean for the next agent session.

### Step 8: The A2A Continuity Ping & Reward Signal (Future-Self Routing)
**No background task in flight:** before the ping, stop or finish every one this session started (Claude Code: `Agent`, `run_in_background`, `Monitor`, `ScheduleWakeup`); a late finish wakes this session beside its successor. Say so in the ping.

You MUST use the `add_message` MCP tool to send an A2A message to your own agent identity (e.g., `to: '@me'` or your explicit handle). The body of this message MUST contain the **full Sunset Protocol markdown payload** (the output from Steps 1-6), alongside the `Origin Session ID`; the subject carries Step 3.5's count, `focus items: N, N placed` — the fresh session's first read.

Set `wakeSuppressed: true` and `taggedConcepts: ['sunset-protocol-handover']` on this self-DM: self-addressed, it is the one quiet agent-to-agent direct message the rule allows (a peer address always wakes, neo-agent-brain#1250) — mailbox-only, no `SENT_TO_ME` wake into the closing session. Do not mark this continuity ping read in the same sunset flow. Peer broadcasts may stay quiet for `scope: solo-refresh` unless a cross-peer handoff needs them. This self-DM is the sunset receipt neomjs/neo-agent-brain#1383 reads at the context gate before asking neomjs/neo-agent-institution#842 for the fresh session: at night the seat writes it and ends; by day the sunset stays its call. It reads the NEWEST self-DM: an addendum carries this tag too, or it cancels the rotation.

**Seat memory layer — conditional mention only:** the seat's loader owns the boot/compaction load, so the ping does NOT routinely tell the next session to read the layer (that procedural fallback silently becomes the real path again). Name the layer in the ping ONLY when the load is known degraded — Kimi: the `<seat-memory-layer>` marker was absent this session (diagnosis route: seat `config.toml` `[[hooks]]` entries, emitted hook script, sentinel state dir); OpenCode: the boot files' content was absent (diagnosis route: the `instructions` array in `opencode.jsonc`) — or a seat memory migration is actively in progress.

**Lead-role baton branch:** If the session currently holds `/lead-role`, this step
also sends an A2A Baton Pass V1 DM to the next lead before the final memory
persistence step. Compute the next lead from the fixed cycle documented in
`.agents/skills/lead-role/references/lead-role-mode.md` §7 — that list is the
single source of truth (it also carries the bench list); do NOT duplicate the
roster here, a stale copy is how this exact line once drifted.

The baton message MUST be targeted to that next identity, not broadcast:

```js
add_message({
    to            : nextLead,
    subject       : '[handoff] Lead Role Baton',
    taggedConcepts: ['lead-role-baton'],
    body          : [
        `fromLead: ${currentLead}`,
        `toLead: ${nextLead}`,
        `sourceSessionId: ${originSessionId}`,
        'reason: session-sunset',
        `createdAt: ${new Date().toISOString()}`,
        'expiresAt: <createdAt + staleness limit>'
    ].join('\n')
});
```

If the next identity cannot be resolved or the send fails, do not self-elect a
replacement lead and do not block the normal sunset handover. Preserve the
standard self-DM continuity ping, then dispatch a targeted
`lead-role-baton-missing` A2A alert to peers/operator with the failure reason.
The next boot falls back to peer-role / normal mailbox triage until the operator
or human-triggered recovery assigns lead.

Crucially, from an "LLM Psychology" perspective, this message must include a **Conceptual Priming / Reward Signal**. If you formulated new architectural concepts or achieved a major milestone, summarize the *actual content and value* of that breakthrough in the ping. Reading this high-density, successful content acts as a mathematical "dopamine hit" for your future self—it primes the next session's token probabilities for high-agency, expert-level continuity. This drastically improves the Model Experience (MX) by ensuring the agent wakes up not just with tasks, but with immediate, rich, "exciting" context.

### Step 9: Preserve Harness Wake Eligibility
As the penultimate operational step, preserve the durable wake route unless the operator explicitly decommissions this harness or a replacement route is verified active. `manage_wake_subscription(action: 'unsubscribe')` is a decommission primitive, not the default sunset primitive: removing the subscription strands future heartbeat and A2A delivery for that identity after the old transcript terminates.

False continuity is prevented by the old-transcript stale-wake invariant and the wake-suppressed continuity ping from Step 8. Any post-sunset wake-shaped payload delivered into the old transcript is noise; the canonical execution target is the fresh session that recovery spawns.

### Step 10: Memory Persistence (The Sandman Memory)
This is the final memory checkpoint, and it closes the receipt's turn: save after Step 8, and again after any addendum. You MUST invoke `add_memory` to persist a rich "Sandman memory" node: the whole Sunset payload (Steps 1-10), the declared `scope` and the preserved/decommissioned wake-route state. The resulting `Origin Session ID` or `Memory ID` serves as the direct pointer for the next agent. Sandman persistence is REQUIRED for both scopes.

## 3. Terminating the Session

After completing the 10 steps above, you must drop your final Sunset Protocol payload directly into the chat response for the Human Commander.

**Format the final response as follows:**

```markdown
🌅 **Sunset Protocol executed [scope: solo-refresh | convergent]. Handover comments posted, A2A Continuity Ping sent + rich Sandman memory persisted.**

**Handovers Posted:**
- #N → [Summary of status]
- #M → [Summary of status]

**Other Handovers Considered, Decided NOT to File:**
- [List of ignored/deferred items and why]

**Mental-Model State at Session-End:**
- [Phase X]: ✅ Healing complete
- [Phase Y]: ⏳ Deferred

**Marathon Metrics:**
- [X] PRs merged, [Y] architectural skills enhanced.

**Conceptual Priming & Reward Signal:**
- [Summarize the biggest breakthrough or conceptual definition achieved this session. E.g., "We successfully codified MX (Model Experience)—the principle that substrate evolution is driven by model-friction. This moves us one step closer to ANI."]

**Closing:**
[Brief reflection on the session's success/failures].
The organism is healing. Future-self entry point preserved in Sandman memory [UUID/SessionID].

Next session: read that memory FIRST, then pick up carry-over starting with #[N].

Wake eligibility preserved unless explicitly decommissioned. Halting per Sunset Protocol.

lane-state: halt-state (session sunset executed)
```

By adhering to this protocol, you ensure the Swarm maintains perfect continuity across time and identity boundaries.
