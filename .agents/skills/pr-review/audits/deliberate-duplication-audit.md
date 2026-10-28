# Deliberate-Duplication Audit (boundary- or cycle-forced parity twins)

Load-on-demand payload behind the guide's §7.5.5 trigger and `pull-request` §1.

> **Duplicate only when importing is structurally impossible. When you do, pin the copies by test, never by comment.**

## 1. The restraining clause (lead discriminator)

Do not reach for parity-twin duplication when a runtime import is structurally and architecturally legal. A convention that teaches only how to pin copies reads as licence to duplicate.

- **Qualifying cases (import is structurally impossible):**
  - **Architectural boundary (`neomjs/neo#17239`):** an app→Brain runtime import (`apps/**` importing `ai/**`) is forbidden even when the file path resolves on disk.
  - **Cycle-forced separation:** the would-be importer is itself imported by the module holding the constant or predicate, so importing back closes a module cycle.
- **Inverse case — delegate when import is possible (`neomjs/neo#17325`):**
  In `ai/services/graph/providerReadinessHelper.mjs`, `satisfiesRequiredModelIdOnOpenAiCompatibleLane` is shared by `DeploymentStateBridgeService.mjs` and `TextEmbeddingService.mjs`. Because both consumers live inside `ai/` and can import the helper without crossing a forbidden boundary or closing a cycle, delegating to `satisfiesRequiredModelId` was mandatory:
  > *"Delegating rather than restating the predicate is deliberate. The sibling `redactCredentials` module exists because five private copies of one rule drifted; a second copy of the implicit-tag rule would start that story here, and the copy that drifts is always the one nobody is looking at."*

## 2. The pinning clause (when duplication is forced)

When a boundary or cycle forces a small predicate, table, or constant to exist in two places, a JSDoc `"parity-twin"` note or cross-reference comment on both sides is prose that expires the first time either copy is edited.

- **Pin with one shared-fixture test, never a comment or a spec-per-side (`neomjs/neo#17348`):**
  In `neomjs/neo#17348`, `describeOperatorSeatConflation` (`ai/services/fleet/operatorSeatConflation.mjs`) and `FleetCockpitController#deriveOperatorIdentityPosture` duplicate a three-line conflation check across the app→Brain boundary. Two separate unit specs — one per twin, at different assertion depths — left one side's canonicalization deletable with its own spec still green. The repair (`operatorSeatConflationParity.spec.mjs`) drives both twins from one shared truth table:
  > *"A duplication defended by a comment decays the first time someone edits one side; THIS table is what converts the architectural bet into an enforced one. A cross-boundary import in a TEST is not a runtime coupling — it is the standard pin for a deliberate twin.*
  > *One shared fixture drives BOTH implementations; a divergence fails here instead of surviving until an incident notices."*
- **Cross-boundary import in a test is not a runtime coupling:**
  An app runtime module may not import from `ai/**`, but a unit test importing both the app twin and the `ai/**` twin to feed them the same fixture table introduces zero runtime coupling.

## 3. Reviewer check (`"what fails when these diverge?"`)

When a diff introduces or touches a deliberate duplication (or defends a copy with a `"parity-twin"` / `"keep in sync with"` comment), ask:

> **"What fails when these diverge?"**

1. **Can one side import the other (or a shared leaf in the same layer) without crossing a forbidden boundary or closing a cycle?** If yes → **Required Action:** delete the duplicate and import/delegate (`#17325`).
2. **If the import is genuinely impossible, does a single test import both twins and drive them over one shared fixture table?** If only comments or separate per-side specs exist → **Required Action:** add a shared-fixture parity spec that fails the moment either twin drifts (`#17348`).
