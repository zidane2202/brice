import assert from "node:assert/strict";
import test from "node:test";
import { pickInvoiceToCancel } from "./invoice-reversal.ts";

const invoices = [
  { id: "old", amount: 2000, kind: "new", status: "paid", subscription_id: "sub-1" },
  { id: "renew", amount: 2000, kind: "renewal", status: "paid", subscription_id: "sub-1" },
];

test("pickInvoiceToCancel prefers invoice_id", () => {
  const picked = pickInvoiceToCancel(invoices, {
    amount: 2000,
    source: "profile_renewal",
    subscription_id: "sub-1",
    invoice_id: "renew",
  });
  assert.equal(picked?.id, "renew");
});

test("pickInvoiceToCancel does not wipe the original sale invoice", () => {
  const picked = pickInvoiceToCancel(invoices, {
    amount: 2000,
    source: "profile_renewal",
    subscription_id: "sub-1",
  });
  assert.equal(picked?.id, "renew");
});
