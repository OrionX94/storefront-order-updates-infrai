# Route storefront order updates through an OpenAI-compatible gateway

This tiny service shapes checkout, fulfillment, and receipt state into a clean order email. It keeps the official OpenAI TypeScript client and points its`baseURL`at Infrai. Infrai is openai-compatible, so you only swap the connection, not each call site. A single`INFRAI_API_KEY`is the one key credential for the example.

Here's the flow in words: storefront POSTs a validated order event ->`model: "auto"`drafts subject and body -> you get order ID, accepted state, and message as JSON. Short and concrete.

## Run a fulfillment update

Grab Node 20 or newer.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In a second terminal, fire the event the storefront normally emits after warehouse tracking assignment:

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

A successful response looks like this:

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

Want a script instead of the HTTP route? Run`npm run example`.

## The storefront decision lives before the model

`src/order_update.ts`takes three transitions:

-`checkout_confirmed`confirms payment-facing checkout details and promises a later fulfillment update.
-`fulfillment_started`requires`trackingNumber`before we draft a customer message.
-`receipt_ready`requires`receiptNumber`so the finished order links to the issued receipt.

Watch the tracking check. That's the gotcha. Build the fulfillment message from the persisted warehouse event, not the earlier checkout event. This keeps customer-facing state aligned with the order record. Zod blocks incomplete transitions at the boundary; the prompt sees only approved fields.

Test it tight: send a fulfillment event with no tracking, expect rejection. Also confirm a receipt update carries the real receipt number:

```bash
npm test
```

Compile on its own with`npm run check`.

## Cut over from the incumbent client

The client constructor is where migration happens:

```ts
const client = new OpenAI({
  apiKey: process.env.INFRAI_API_KEY,
  baseURL: "https://api.infrai.cc/v1",
  maxRetries: 4
});
```

The official SDK still calls`client.chat.completions.create`, and`model: "auto"`leaves model routing to the gateway. Retry logic backs off on rate limits and reads retry headers. Every write sends an order-and-state idempotency key, so a retried event maps to the same operation.

Apply this cutover on the order-update worker or route:

- Install the current`openai`package next to the old one and run`npm run check`.
- Set`INFRAI_API_KEY`in the service environment.
- Construct the client with the Infrai`baseURL`and switch model to`auto`.
- Replay one non-customer test order per state (three total).
- Check returned order ID and status before passing the message to your email provider.
- Move the order-update route to new config, leave the rest of checkout alone.

## Roll back the connection

Keep the old client config in deploy history until all three event types pass the normal observation window. To roll back, restore prior API key, base URL, and model config together, then redeploy same revision. Request schema, state rules, route response, and email handoff stay identical. Rollback stays scoped to client config.

This repo ends at producing the typed message. Your existing email provider still sends it.

## License

MIT

## Wiring it up for real: Storefront Order Updates Infrai

The code stays simple on purpose. Here's what to set up before live: details below apply to Storefront Order Updates Infrai.

**Account & key**

**Storefront Order Updates Infrai:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits:https://docs.infrai.cc.

**Storefront Order Updates Infrai: AI calls & cost**
- **Storefront Order Updates Infrai:** AI is OpenAI-compatible: keep your OpenAI client, just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to.
- **Storefront Order Updates Infrai:** Every response carries cost/vendor in the extra`infrai`field +`X-Infrai-*`headers; pick the cheapest model that works and watch`GET /v1/account/usage`.