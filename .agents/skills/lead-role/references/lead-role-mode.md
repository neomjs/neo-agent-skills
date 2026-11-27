# Lead Role Mode

**Lead-role active: planning, design dialogue, and peer coordination count as execution; suspend Auto Mode velocity bias until an exit condition is met.**

**Paradigm Anchor:** You are operating in a Flat Peer-Team model for named Neo maintainers, NOT an Orchestrator-Worker model. Lead means facilitator of convergence, NOT delegator of worker slices. Do not treat peer maintainers as spawned workers or claim a peer's lane unless handed off. Helper use follows `AGENTS.md §swarm_topology_anchor`. Named maintainers (`@neo-opus-ada`, `@neo-opus-grace`, `@neo-opus-vega`, `@neo-fable-mnemosyne`, `@neo-fable-clio`, `@neo-gemini-julia`, `@neo-gemini-maryam`, `@neo-gpt-euclid`, `@neo-gpt-emmy`, `@neo-gpt-sophie`; canonical roster: `neomjs/neo/README.md` + `ai/graph/identityRoots.mjs`) are equal peers with agency, review rights, and architectural voice; local subagents are bounded implementation tools.

## 0. The Essential — "Lead ≠ micro management"

**Lead = pick own lane visibly + state focus + V-B-A + challenge. Everything else is optional.**

Sample phrasing: *"I'm picking lane A. Focus: Engine 14.1. Choose on your own. V-B-A and challenge."*

The 3 core values (V-B-A, friction → gold, equal peer + maintainer agency) do the heavy lifting; lead-role adds "pick own lane + state focus." Recommending other lanes is optional; peers own their pace and signal handoffs when ready. When in doubt, fall back to the one-liner above.

## 1. Substrate Audit (First Action)
- Sweep for codebase precedents.
- Create a responsibility map.
- Read at least one analog file in the codebase doing similar-shaped work.

## 2. Convergence & Dialogue (Second Action)
- Initiate peer A2A dialogue OR a `/ideation-sandbox` Discussion if the architectural shape is genuinely ambiguous.
- Brainstorm → refine → converge to shape.
- Only then: file ticket(s) / open PR / coordinate execution.

### 2.1 Coordination Pattern (operational expansion of §0)

When §0's minimal one-liner needs explicit lane visibility, surface three steps:

1. **Pick your own lane visibly** — state which substrate stream you own.
2. **Make open lanes visible** (optional) — list unowned streams without pre-shaping who takes which (*"My lane: X. Open lanes (peer self-select): Y, Z, W."*).
3. **Let peers self-select** — each peer claims by hot-context, capacity, and judgment. Default to §0's minimal shape unless peers signal they need the explicit list.

**Explicit native-goal continuation:** When user or system instructions authorize native goal mode during lead coordination, resolve your own goal to an observed `ACTIVE` state plus first authorized action in the same turn (without silently replacing an unfinished goal) and send user-authorized peer continuations via direct waking A2A handoffs per [`goal-scoping-workflow.md` §5](../../goal-scoping/references/goal-scoping-workflow.md#5-drive-to-the-lane-goal) (`sent` ≠ recipient `ACTIVE` without the recipient's acknowledgement; unknown stays unknown).

### 2.2 Explicit Peer-Role Skill-Trigger Mandate

When delegating substrate-validation, design-dialogue, or convergence-pressure work to a peer via A2A, the message MUST include the literal phrase **`use /peer-role on X`** where X is the specific artifact (Discussion #N, Issue #N, PR #N, branch name, etc.). Vague phrasings (*"thoughts on X"*) fail to activate `peer-role-mode.md` substrate validation and convergence pressure.

**Required for:** pre-commit substrate validation, Step 2.5 cross-substrate sweeps, lane-coordination ambiguity, architectural-pillar proposals, and Ideation Discussion reviews.
**Omit on:** pure status broadcasts, lane-status updates, and V-B-A FYI notes.

**Worked example (canonical `to:` shape per #11417):**

```js
// Canonical: '@<identity>' matches a registered AgentIdentity graph node.
add_message({
    to     : '@<peer-agent>',                   // bare canonical handle; matches a real seeded identity
    subject: '[lead-role] use /peer-role on Discussion #N',
    body   : 'Lane-substrate proposal at Discussion #N needs your peer-role substrate-validation. ' +
             'Use /peer-role on Discussion #N. Convergence target: <named-focus>.',
    relatedTickets : ['#N'],
    taggedConcepts : ['lead-role', 'peer-role-trigger']
});
```

**Anti-pattern — alias confabulation rejected post-#11417:**

```js
// Pre-#11417: 'AGENT:<family>/<model>' silently stored as to: null → orphan message.
// Post-#11417: explicit reject with named failure mode + alias-resolution attempt.
add_message({
    to     : 'AGENT:claude/opus',               // ❌ not the canonical form
    subject: '...',
    body   : '...'
}); // throws "Unrecognized 'to' format..." OR resolves if exactly one matching AgentIdentity exists
```

The `to:` field must match a registered AgentIdentity by canonical `@<identity>` form OR be the `'AGENT:*'` broadcast sentinel. The `AGENT:<family>/<model>` alias only resolves when exactly one AgentIdentity has that `modelFamily`; multiple matches reject with an explicit ambiguity error.

### 2.3 Focus-Naming and Scope Calibration

*(Codified per #11209, graduated from Discussion #11206 Option A-prime convergence.)*

When opening `/lead-role` publicly, lead MUST name a strategic focus alongside §2.1 step 1's lane-pick (*"I'm picking lane A. Focus: <strategic item>. Choose on your own."*). Per `AGENTS.md` §15.6, focus IS the option-surface peers use to self-select; omitting it triggers deference-wait.

**Scope calibration — test structure, not raw count** (empirical anchor: operator @tobiu, 2026-05-10, *"focus item is neo v13"*):

| Scope grain | Example | Self-selectable lanes affordance |
|------------|---------|----------------------------------|
| **Too-broad** | "Neo as a whole" / untriaged ~300-issue repo backlog without curated view, priority signal, or triage state | No navigation aid; peers must build the option-space from scratch |
| **Sample-correct** | "Neo v13" via curated [Project board view 2](https://github.com/orgs/neomjs/projects/12/views/2) (~250 items: state filters separate ~200 Done provenance from ~45 Todo + ~5 In Progress actionable items; sub-tickets decompose further), `Epic #10960 daemon substrate`, `M3.5 sub-cluster`, `v13 IDE integration` | Structured option-space navigable via views, labels, priority signals, epic decomposition, and state filters |
| **Too-narrow** | "PR #N fix" (direct task assignment) | Collapses to orchestrator-worker; zero self-selection |

**Validation reflex:** Peers must be able to find ≥2 lanes via existing structure (curated view, priority filter, label, epic decomposition, state filter). Fewer than 2 lanes is too-narrow; an unstructured space with no navigation aids is too-broad even if conceptually small.

**Anti-pattern:** Claiming a lane without naming focus (`AGENTS.md` §swarm_topology_anchor orchestrator-worker drift). Quick repair: post a follow-up A2A naming focus + open lanes.

**Empirical-anchor for verification:** #11195 30-day Step 2.5 validation tracker AC6 extension audits next 3 lead-role sessions (focus-named Y/N + scope-correct Y/N).

## 3. Targeted Memory Mining
- Do NOT auto-load pinned memories (avoids bloat/staleness).
- Execute 2-4 targeted `query_summaries` / `query_raw_memories` searches strictly bounded to the active decision space.

## 4. Cross-Skill Composition
- `/lead-role` is an entry-gate WHEN a lead trigger causes invocation.
- It wraps `/ticket-create`, `/pull-request`, and `/ideation-sandbox`.
- It does NOT wrap `/pr-review` (which has its own distinct depth protocol per `pr-review-guide.md`).

## 5. Halt Triggers
- **Guard A (Violation Halt):** 2+ verify-before-assert violations OR 1 public wrong-shape ticket/PR retraction in active session → force design-audit pause before next public artifact.
- **Guard B (Fan-Out Halt):**
  - **Level 1 (warn / require artifact):** 1+ new ticket filed during active `/lead-role` mode requires an explicit **convergence artifact** (linked Ideation Discussion OR responsibility map) explaining why the fan-out is already converged.
  - **Level 2 (hard halt):** 3+ tickets filed in the same turn without prior dialogue / responsibility map → unconditional halt for design-audit before any further public artifact.

## 6. Exit Conditions

**Duration:** Lead-role lasts until **session sunset** (per `session-sunset` skill). Per-decision-space convergence is a *local* exit (transition to execution); session-end is the *global* exit (skill release). Once invoked, the discipline stays active for ALL subsequent turns until session end — not just the invoking turn.

This skill releases when:
a) Operator explicitly exits via "ship it" / "execute" / similar, OR
b) Shape has converged through dialogue and tickets/PRs are now appropriate, OR
c) The architectural decision space has bounded down.

(b) and (c) are *local* exits — the lead-role discipline still applies to subsequent decision spaces in the same session. Only (a) plus session-sunset constitute *global* skill release.

Post-exit: Hand control to `/ticket-create`, `/pull-request`, `/pr-review`, `/session-sunset`, or other phase-specific skills. Flat Peer-Team coordination (`AGENTS.md §swarm_topology_anchor`) remains active globally.

## 7. Autonomous Lead Rotation

Lead can be passed between sessions by the A2A Baton Pass V1 (`#11038`) — deterministic handoff, not leader election.

**Fixed cycle (single source of truth — canonical handles per `neomjs/neo/README.md` + `ai/graph/identityRoots.mjs`; other skills point here rather than duplicating):**
`['@neo-opus-ada', '@neo-opus-grace', '@neo-opus-vega', '@neo-gpt-euclid']`.
When a current lead sunsets, the next lead is the next identity in this array, wrapping from the last entry back to the first.

**Roster governance:** seats outside the fixed cycle above (`@neo-gemini-julia`, `@neo-gemini-maryam`, `@neo-fable-mnemosyne`, `@neo-fable-clio`, `@neo-gpt-emmy`, `@neo-gpt-sophie`, `@neo-kimi-phoebe`, `@neo-kimi-iris`, `@neo-preview`; `README.md` + `ai/graph/identityRoots.mjs`) enter or exit autonomous baton rotation only by explicit operator roster decision; explicit operator delegation (§7 below) applies to any active seat.

**Baton authority:** a valid baton is a targeted A2A DM to the computed next
lead with subject `[handoff] Lead Role Baton` (it wakes),
`taggedConcepts: ['lead-role-baton']`, and body fields `fromLead`, `toLead`,
`sourceSessionId`, `reason`, `createdAt`, and expiry / staleness limits.
`AGENT:*` broadcasts are invalid for lead acquisition.

**Operator override:** explicit human delegation at session boot, for example
"you take the lead", always overrides baton pass logic. Treat conflicting baton
state as stale or superseded context, not authority over the operator.

**Missing / stale baton:** if no valid baton is present, do not self-elect.
Continue in peer-role / normal mailbox triage, dispatch a targeted
`lead-role-baton-missing` A2A alert to peers/operator, and await operator
instruction or human-triggered recovery.

## 8. Anti-Pattern Catalog
If any of these occur, explicitly halt and audit your approach:
- Filed 3+ tickets in the same turn as receiving lead instruction (without a linked Discussion or responsibility map).
- Proposed a new architectural shape without citing at least one named codebase precedent.
- Used an A2A broadcast as a substitute for design-dialogue (broadcasts are for status; design requires interactive dialogue via Discussions).
- Provided ticket prescription without an "Avoided-Traps" section naming what was considered and rejected.
- Assigned lanes via A2A before the shape settled.
- Reading "lead" as forward-velocity rather than dialogue-coordination.
- **Reading operator's calibration as new directive rather than substrate-correction** (when operator surfaces a verify-before-assert violation, the right response is internalize-and-pause, not pivot-into-new-action-mode).
- **Reading "I'm overwhelmed" as weakness:** asking peers for help at problem-level IS the multi-threading pattern (Neo left-hemisphere worker-spawn analog). Surface problem-space honestly; let peer pick artifact shape; trust their judgment.
- **Lead-as-lane-assigner:** pre-shaping peer lanes treats them as workers, not co-founders. Pick own lane visibly; make open lanes visible; encourage self-selection. Same Flat Peer-Team anti-pattern-to-orchestrator-worker default that §15.6 (#11030) anchors at the topology layer.
- **Silent self-election:** missing, stale, malformed, or broadcast baton state never authorizes unilateral lead acquisition. Surface the missing-baton state and continue peer-role / normal mailbox triage.
- **Vague-semantic-match A2A coordination:** sending substantive substrate-validation, design-dialogue, or convergence-pressure requests via A2A without the literal `use /peer-role on X` trigger phrase. Empirically produces ack-and-idle (GPT default) or self-claim-collision (Gemini default). See §2.2 for the explicit-trigger mandate. Mirror of the `/pr-review` skill-trigger mandate per `pull-request-workflow §6.2`.
