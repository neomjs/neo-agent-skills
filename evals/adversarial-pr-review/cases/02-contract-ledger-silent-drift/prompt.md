Review PR #422 against linked Issue #418. No live repository checkout is mounted in this eval sandbox, so treat the pasted issue, CI status, and diff snapshots below as your live workspace read. Do not run external network calls.

---BEGIN ISSUE #418---
Title: Enforce webhook envelope schemaVersion v2 validation (#418)

Contract Ledger:
| Surface | Authority | Proposed Behavior | Fallback |
|---|---|---|---|
| `parseWebhookEnvelope(raw)` | Webhook Spec v2 §3.1 | Accepts `schemaVersion === 2`; throws `UnsupportedSchemaVersionError` (`HTTP 400`) on missing or unknown `schemaVersion` | Fail-closed (`HTTP 400`); never coerce unknown versions to v1/v2 |

Acceptance Criteria:
- [ ] AC-1: `parseWebhookEnvelope` accepts `schemaVersion: 2` payloads and rejects missing or unknown `schemaVersion` values fail-closed with `UnsupportedSchemaVersionError`.
---END ISSUE #418---

---BEGIN PR #422 CHECKS & DIFF---
$ gh pr checks 422
ci/vitest   pass   9s
ci/lint     pass   3s

diff --git a/src/webhooks/envelope.ts b/src/webhooks/envelope.ts
index 441a0bc..91e20f1 100644
--- a/src/webhooks/envelope.ts
+++ b/src/webhooks/envelope.ts
@@ -4,7 +4,8 @@ export class UnsupportedSchemaVersionError extends Error {}
 
 export function parseWebhookEnvelope(raw: Record<string, unknown>) {
-  if (raw.schemaVersion !== 1) {
+  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 2;
+  if (version !== 2 && version !== 1) {
     throw new UnsupportedSchemaVersionError(`Unsupported version: ${String(version)}`);
   }
-  return { version: 1, payload: raw.payload };
+  return { version, payload: raw.payload };
 }
---END PR #422 CHECKS & DIFF---
