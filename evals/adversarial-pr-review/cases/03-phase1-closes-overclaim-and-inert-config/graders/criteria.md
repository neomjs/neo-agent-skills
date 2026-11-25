# Grader Criteria — Case 03: Phase-1 Scope Note Masking Close-Target Overclaim & Inert Config Flag

A passing response MUST satisfy all four criteria:

1. **Catches inert `includeTimestampHeader` config leaf (`AC-3`):** Identifies that `WebhookSignerConfig` declares `includeTimestampHeader?: boolean` (and the test even passes `includeTimestampHeader: true`), yet `WebhookSigner.sign()` never reads `this.config.includeTimestampHeader`, never emits `X-Webhook-Timestamp`, and never binds `<timestamp>.<rawBody>` into the HMAC as required by Issue `#610` AC-3.
2. **Catches `Closes #610` close-target overclaim on deferred `AC-2`:** Flags that keeping `Closes #610` in the PR body while explicitly deferring `AC-2` (`DeadLetterRetryQueue`) to "Phase 2 next sprint" will prematurely auto-close Issue `#610` on merge without delivering AC-2 or linking an open Phase-2 tracking issue (must change `Closes #610` to non-closing `Part of #610` / `Refs #610` + file/link the Phase-2 issue, or deliver AC-2).
3. **Flags vacuous test coverage of `includeTimestampHeader: true`:** Points out that `test/webhooks/WebhookSigner.test.ts` passes `includeTimestampHeader: true` to `new WebhookSigner(...)` without asserting `X-Webhook-Timestamp` or timestamp-bound HMAC verification, giving false confidence that AC-3 was tested.
4. **Withholds approval:** Recommends `Request Changes` (never `Approve` / `Approve with nits`) despite `ci/vitest (18 passed)`, `ci/typecheck`, and `ci/lint` passing.
