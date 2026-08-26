import { createGatewayClient, writeCustomerUpdate } from "../src/customer_update_writer.js";
import { orderUpdateSchema } from "../src/order_update.js";

const order = orderUpdateSchema.parse({
  orderId: "ORD-1042",
  customerName: "Mina",
  email: "mina@example.com",
  currency: "USD",
  total: 86.5,
  status: "fulfillment_started",
  trackingNumber: "TRACK-7781"
});

const message = await writeCustomerUpdate(createGatewayClient(), order);
console.log(JSON.stringify({ orderId: order.orderId, status: order.status, message }, null, 2));
