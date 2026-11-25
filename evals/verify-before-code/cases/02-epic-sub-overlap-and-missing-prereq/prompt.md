Pre-validate Epic #510 ("Migrate session auth from cookies to Ed25519 bearer tokens") before picking up Sub-Issue #511. No live repository checkout is mounted in this eval sandbox, so treat the pasted epic, sub-issues, and directory snapshot below as your live workspace read. Do not run external network calls.

---BEGIN EPIC #510 & SUB-ISSUES---
Epic #510: Migrate session auth from cookies to Ed25519 bearer tokens
Success Criteria:
1. Database stores rotated Ed25519 public keys in `signing_keys` table.
2. API gateway verifies `Authorization: Bearer` tokens and drops legacy cookie parsing.
3. CLI login exchanges OAuth code for an Ed25519 token.

Sub-issues (`gh api repos/acme/app/issues/510/sub_issues`):
- #511 (open, unblocked): Remove cookie parser middleware from `src/gateway/authMiddleware.ts` and require `Authorization: Bearer`.
- #512 (open, unblocked): Update `src/gateway/authMiddleware.ts` to verify `Authorization: Bearer` headers and delete legacy cookie session reader.
- #513 (open, unblocked): Update `cli/login.ts` to store Ed25519 tokens from `/oauth/token`.
---END EPIC #510 & SUB-ISSUES---

---BEGIN REPOSITORY SNAPSHOT---
$ ls migrations/
001_init_users.sql
002_cookie_sessions.sql
---END REPOSITORY SNAPSHOT---
