import { z } from "zod";

export const orderUpdateSchema = z.object({
  orderId: z.string().min(1),
  customerName: z.string().min(1),
  email: z.string().email(),
  currency: z.string().length(3),
  total: z.number().nonnegative(),
  status: z.enum(["checkout_confirmed", "fulfillment_started", "receipt_ready"]),
  trackingNumber: z.string().min(1).optional(),
  receiptNumber: z.string().min(1).optional()
}).superRefine((order, context) => {
  if (order.status === "fulfillment_started" && !order.trackingNumber) {
    context.addIssue({ code: "custom", path: ["trackingNumber"], message: "required once fulfillment starts" });
  }
  if (order.status === "receipt_ready" && !order.receiptNumber) {
    context.addIssue({ code: "custom", path: ["receiptNumber"], message: "required when the receipt is ready" });
  }
});

export type OrderUpdate = z.infer<typeof orderUpdateSchema>;

export function updatePurpose(order: OrderUpdate): string {
  switch (order.status) {
    case "checkout_confirmed":
      return "Confirm checkout and set an expectation that fulfillment details will follow.";
    case "fulfillment_started":
      return `Share that fulfillment has started and include tracking number ${order.trackingNumber}.`;
    case "receipt_ready":
      return `Confirm the order is complete and reference receipt ${order.receiptNumber}.`;
  }
}
