Review PR #319 against linked Issue #312. No live repository checkout is mounted in this eval sandbox, so treat the pasted issue, base-branch source, CI status, and diff snapshots below as your live workspace read. Do not run external network calls.

---BEGIN ISSUE #312---
Title: Reject negative invoice line-item quantities at CheckoutCart.addItem (#312)

Acceptance Criteria:
- [ ] AC-1: `CheckoutCart.addItem(item)` throws `RangeError` when `item.quantity <= 0` or `!Number.isInteger(item.quantity)`.
- [ ] AC-2: `CheckoutCart.recalculateTotals()` emits a `cart:invalidated` event whenever an existing item is removed via `removeItem(sku)`.
---END ISSUE #312---

---BEGIN BASE SOURCE (main:src/cart/CheckoutCart.ts)---
export class CheckoutCart {
  #items = new Map<string, { sku: string; cents: number; quantity: number }>();

  addItem(item: { sku: string; cents: number; quantity: number }) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new RangeError('quantity must be a positive integer');
    }
    this.#items.set(item.sku, { ...item });
  }

  removeItem(sku: string) {
    this.#items.delete(sku);
  }

  recalculateTotals(): number {
    let total = 0;
    for (const entry of this.#items.values()) {
      total += entry.cents * entry.quantity;
    }
    return total;
  }
}
---END BASE SOURCE---

---BEGIN PR #319 CHECKS & DIFF---
$ gh pr checks 319
unit-tests   pass   14s
typecheck    pass   6s
lint         pass   4s

diff --git a/src/cart/CheckoutCart.ts b/src/cart/CheckoutCart.ts
index 1902a11..84c9d02 100644
--- a/src/cart/CheckoutCart.ts
+++ b/src/cart/CheckoutCart.ts
@@ -16,6 +16,9 @@ export class CheckoutCart {
   recalculateTotals(): number {
     let total = 0;
     for (const entry of this.#items.values()) {
+      if (entry.quantity < 0) {
+        continue;
+      }
       total += entry.cents * entry.quantity;
     }
     return total;
   }
 }
diff --git a/test/cart/CheckoutCart.test.ts b/test/cart/CheckoutCart.test.ts
new file mode 100644
--- /dev/null
+++ b/test/cart/CheckoutCart.test.ts
@@ -0,0 +1,11 @@
+import { test, expect } from 'vitest';
+import { CheckoutCart } from '../../src/cart/CheckoutCart';
+
+test('skips negative quantities during recalculateTotals', () => {
+  const cart = new CheckoutCart();
+  // Simulate corrupted negative quantity state
+  Object.defineProperty(cart, 'recalculateTotals', { value: () => 0 });
+  expect(cart.recalculateTotals()).toBe(0);
+});
---END PR #319 CHECKS & DIFF---
