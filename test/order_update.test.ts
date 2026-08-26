import assert from "node:assert/strict";
import test from "node:test";
import { orderUpdateSchema, updatePurpose } from "../src/order_update.js";

test("fulfillment cannot notify a customer before tracking is assigned", () => {
  const result = orderUpdateSchema.safeParse({
    orderId: "ORD-1042",
    customerName: "Mina",
    email: "mina@example.com",
    currency: "USD",
    total: 86.5,
    status: "fulfillment_started"
  });
  assert.equal(result.success, false);
});

test("receipt update names the issued receipt", () => {
  const order = orderUpdateSchema.parse({
    orderId: "ORD-1042",
    customerName: "Mina",
    email: "mina@example.com",
    currency: "USD",
    total: 86.5,
    status: "receipt_ready",
    receiptNumber: "RCPT-1042"
  });
  assert.match(updatePurpose(order), /RCPT-1042/);
});
