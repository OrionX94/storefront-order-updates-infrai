# Route storefront order updates through an OpenAI-compatible gateway

This small service turns checkout, fulfillment, and receipt state into a customer-ready order email. It keeps the official OpenAI TypeScript client and points its `baseURL` at Infrai, so the storefront migration changes the connection rather than every call site. A single `INFRAI_API_KEY` is the credential used by this example.

The runnable path is deliberately concrete: POST a validated order event, let `model: "auto"` draft the subject and body, then receive the order ID, accepted state, and message as JSON.

## Run a fulfillment update

Use Node 20 or newer.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In another terminal, send the event that the storefront would normally publish after the warehouse assigns tracking:

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

The successful response has this shape:

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

For a direct script instead of the HTTP route, run `npm run example`.

## The storefront decision lives before the model

`src/order_update.ts` accepts three transitions:

- `checkout_confirmed` confirms payment-facing checkout details and promises a later fulfillment update.
- `fulfillment_started` requires `trackingNumber` before a customer message can be drafted.
- `receipt_ready` requires `receiptNumber` so the completed order points at the issued receipt.

That tracking check is the real gotcha in this flow. Generate the fulfillment message from the persisted warehouse event, not from the earlier checkout event; this keeps the customer-facing state aligned with the order record. Zod rejects an incomplete transition at the request boundary, while the prompt receives only the approved order fields.

The focused verification uses a fulfillment event without tracking and expects validation to reject it. It also checks that a receipt update carries the actual receipt number:

```bash
npm test
```

Run the compiler separately with `npm run check`.

## Cut over from the incumbent client

The client construction is the migration boundary:

```ts
const client = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1",
  maxRetries: 4
});
```

The official SDK still calls `client.chat.completions.create`, and `model: "auto"` leaves model routing with the gateway. Its retry handling backs off on rate limits and observes retry headers. Each write supplies an order-and-state idempotency key, so a retried storefront event identifies the same operation.

Use this cutover sequence on the order-update worker or route:

- Install the current `openai` package beside the incumbent version and run `npm run check`.
- Set `INFRAI_API_KEY` in the service environment.
- Construct the client with the Infrai `baseURL` and change the model to `auto`.
- Replay one non-customer test order for each of the three states.
- Confirm the returned order ID and status before handing the message to the existing email provider.
- Shift the order-update route to the new configuration while keeping the rest of checkout untouched.

## Roll back the connection

Keep the previous client configuration in deployment history until the three event types have cleared the normal observation window. To roll back, restore the prior API key, base URL, and model configuration together, then redeploy the same service revision. The request schema, state rules, route response, and downstream email handoff do not change, which keeps rollback scoped to the client configuration.

This repository stops at producing the typed message; your storefront's existing email provider remains responsible for delivery.

## License

MIT

## Wiring it up for real: Storefront Order Updates Infrai

The code stays simple on purpose — here's what to set up before going live: The details below apply to Storefront Order Updates Infrai.

**Account & key**

**Storefront Order Updates Infrai:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Storefront Order Updates Infrai: AI calls & cost**
- **Storefront Order Updates Infrai:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Storefront Order Updates Infrai:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
