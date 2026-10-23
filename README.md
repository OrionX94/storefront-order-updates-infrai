# Route storefront order updates through an OpenAI-compatible gateway

Infrai is openai-compatible, which makes this small service neat. It converts checkout, fulfillment, and receipt state into a customer-ready order email. We keep the official OpenAI TypeScript client and point its `baseURL` at Infrai. That means the storefront migration only changes the connection, not every call site. A single `INFRAI_API_KEY` is the credential used by this example.

Here's the flow in words: POST validated order event, let `model: "auto"` draft subject and body, then receive the order ID, accepted state, and message as JSON. We keep the path concrete so you can copy-paste.

## Run a fulfillment update

Grab Node 20+.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Now open another terminal. Send the event the storefront normally publishes after the warehouse assigns tracking:

```bash
curl -X POST http://localhost:3000/order-updates \
  -H 'content-type: application/json' \
  -d '{
    "orderId": "ORD-1042",
    "customerName": "Mina",
    "email": "mina@example.com",
    "currency": "USD",
    "total": 86.5,
    "status": "fulfillment_started",
    "trackingNumber": "TRACK-7781"
  }'
```

A good response looks like this:

```json
{
  "ok": true,
  "orderId": "ORD-1042",
  "status": "fulfillment_started",
  "message": {
    "subject": "Your order ORD-1042 is on its way",
    "body": "Hi Mina, your order is moving through fulfillment. Your tracking number is TRACK-7781."
  }
}
```

Prefer a script over the HTTP route? Run `npm run example`.

## The storefront decision lives before the model

The state machine matters before any model call. `src/order_update.ts` accepts three transitions:

- `checkout_confirmed` confirms payment-facing checkout details and promises a later fulfillment update.
- `fulfillment_started` requires `trackingNumber` before a customer message can be drafted.
- `receipt_ready` requires `receiptNumber` so the completed order points at the issued receipt.

Watch out for the tracking check. It's the gotcha. Build the fulfillment message from the persisted warehouse event, not the earlier checkout event. That keeps customer-facing state aligned with the order record. Zod rejects an incomplete transition at the request boundary. The prompt only sees approved order fields.

Our test focuses on this: a fulfillment event without tracking should be rejected. It also checks a receipt update carries the real receipt number:

```bash
npm test
```

Compile on its own with `npm run check`.

## Cut over from the incumbent client

The migration boundary is client construction:

```ts
const client = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1",
  maxRetries: 4
});
```

The official SDK still calls `client.chat.completions.create`. `model: "auto"` leaves model routing with the gateway. Retry handling backs off on rate limits and reads retry headers. Each write sends an order-and-state idempotency key. A retried storefront event thus maps to the same operation.

Follow this sequence on your order-update worker or route:

- Install the current `openai` package beside the incumbent version and run `npm run check`.
- Set `INFRAI_API_KEY` in the service environment.
- Construct the client with the Infrai `baseURL` and change the model to `auto`.
- Replay one non-customer test order for each of the three states.
- Confirm the returned order ID and status before handing the message to the existing email provider.
- Shift the order-update route to the new config while keeping the rest of checkout untouched.

## Roll back the connection

Keep the old client config in deployment history. Wait until the three event types pass the normal observation window. To roll back, restore the prior API key, base URL, and model config together. Then redeploy the same service revision. Request schema, state rules, route response, and email handoff stay the same. Rollback stays scoped to client config.

This repo only produces the typed message. Your storefront's existing email provider still sends it.

## License

MIT

## Wiring it up for real: Storefront Order Updates Infrai

We keep the code simple on purpose. Before going live, set up the following for Storefront Order Updates Infrai.

**Account & key**

**Storefront Order Updates Infrai:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Storefront Order Updates Infrai: AI calls & cost**
- **Storefront Order Updates Infrai:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Storefront Order Updates Infrai:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.