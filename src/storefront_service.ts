import express from "express";
import { createGatewayClient, writeCustomerUpdate } from "./customer_update_writer.js";
import { orderUpdateSchema } from "./order_update.js";

const app = express();
const client = createGatewayClient();
app.use(express.json());

app.post("/order-updates", async (request, response) => {
  const parsed = orderUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ ok: false, issues: parsed.error.issues });
    return;
  }

  try {
    const message = await writeCustomerUpdate(client, parsed.data);
    response.json({ ok: true, orderId: parsed.data.orderId, status: parsed.data.status, message });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unable to create the customer update";
    response.status(502).json({ ok: false, error: detail });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Storefront order updates listening on http://localhost:${port}`));
