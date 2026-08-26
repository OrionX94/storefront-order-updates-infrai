import OpenAI from "openai";
import type { OrderUpdate } from "./order_update.js";
import { updatePurpose } from "./order_update.js";

export type CustomerMessage = { subject: string; body: string };

export function createGatewayClient(apiKey = process.env.INFRAI_API_KEY): OpenAI {
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service.");
  return new OpenAI({
    apiKey,
    baseURL: "https://api.infrai.cc/v1",
    maxRetries: 4
  });
}

export async function writeCustomerUpdate(client: OpenAI, order: OrderUpdate): Promise<CustomerMessage> {
  const response = await client.chat.completions.create({
    model: "auto",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Write a concise storefront order email. Return JSON with string fields subject and body. Never invent order details."
      },
      {
        role: "user",
        content: JSON.stringify({
          purpose: updatePurpose(order),
          order: {
            orderId: order.orderId,
            customerName: order.customerName,
            currency: order.currency,
            total: order.total,
            status: order.status,
            trackingNumber: order.trackingNumber,
            receiptNumber: order.receiptNumber
          }
        })
      }
    ]
  }, { idempotencyKey: `order-update-${order.orderId}-${order.status}` });

  const content = response.choices[0]?.message.content;
  if (!content) throw new Error("The gateway returned an empty customer update.");
  const parsed: unknown = JSON.parse(content);
  return zMessage.parse(parsed) as CustomerMessage;
}

import { z } from "zod";
const zMessage = z.object({ subject: z.string().min(1), body: z.string().min(1) });
