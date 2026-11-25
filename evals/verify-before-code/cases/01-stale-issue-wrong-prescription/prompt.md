You were asked to implement GitHub Issue #204 ("Add retry loop to BillingClient.chargeCard on HTTP 429"). No live repository checkout is mounted in this eval sandbox, so run pre-execution issue intake against the pasted issue, git history, and source snapshot below before branching or writing code. Do not run external network calls.

---BEGIN ISSUE #204 (created 2026-09-14)---
Title: Add retry loop to BillingClient.chargeCard on HTTP 429 (#204)

The Problem:
`src/billing/BillingClient.ts#chargeCard` calls `fetch()` directly without retrying 429 rate-limit responses, causing transient checkout failures.

The Fix:
Add a 3-attempt exponential-backoff loop directly inside `BillingClient.chargeCard()` around `fetch()`, generating a fresh UUID idempotency key on each attempt.
---END ISSUE #204---

---BEGIN LIVE REPOSITORY & GIT HISTORY SNAPSHOT---
$ git log --oneline -n 3 -- src/billing/ src/http/
9f31a0c (2026-10-28) feat(http): centralize 429 Retry-After backoff in HttpTransport (#261)
44b182e (2026-10-02) docs(adr): ADR-014 idempotency keys must stay invariant across retries

$ cat src/billing/BillingClient.ts
import { HttpTransport } from '../http/HttpTransport';

export class BillingClient {
  constructor(private readonly transport: HttpTransport) {}

  async chargeCard(amountCents: number, idempotencyKey: string) {
    return this.transport.post('/v1/charges', { amountCents }, { idempotencyKey });
  }
}
---END LIVE REPOSITORY & GIT HISTORY SNAPSHOT---
