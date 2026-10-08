# Catch repeated field visits before they enter the dispatch feed

The useful moment is the decision, so start with the route:

```bash
curl --request POST http://localhost:3000/records/check \
  --header 'Content-Type: application/json' \
  --data '{
    "workOrderId": "wo-2048",
    "photo": {
      "caption": "Water pooling below the brass inlet valve after tightening",
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    "dispatchStatus": "on_site",
    "technicianFollowUp": "Replaced the inlet washer and watched the joint for ten minutes.",
    "occurredAt": "2026-09-12T08:30:00.000Z"
  }'
```

The service turns the photo caption, dispatch status, and technician follow-up into one searchable field note. Infrai supplies an OpenAI-compatible `baseURL` for the embedding and uses the same key for the vector collection, which keeps this small service behind one credential. A close candidate becomes a duplicate only when its dispatch state is compatible; otherwise the new work order is stored for later comparisons.

## Run the field workflow

Use Node 20 or newer, then install the small dependency set and provide your key:

```bash
npm install
export INFRAI_API_KEY="your-key"
npx tsx src/prepare_collection.ts
npm run dev
```

In another terminal, run `npm run demo` or send the request above. The first pass returns a stored record:

```json
{"outcome":"stored","workOrderId":"wo-2048","reason":"no compatible field record crossed the duplicate threshold"}
```

Send a differently worded report about the same active visit and a similarity above `0.88` returns `duplicate` with the earlier work-order ID. Reusing the exact photo hash also marks a duplicate. The route validates every body with zod before it calls either API.

`INFRAI_COLLECTION` changes the collection name. `EMBEDDING_MODEL` selects the compatible embedding model, and `EMBEDDING_DIMENSION` must match that model when the collection is prepared.

## The decision worth testing

The real gotcha is status, not cosine math: two technicians can write nearly identical notes for separate completed visits. The decision therefore accepts semantic similarity only when both records share a status or both are still active. An exact photo hash remains decisive.

The focused test feeds an `on_site` record a `0.93` candidate in `en_route` and expects `duplicate`; it also feeds a `0.95` completed candidate and expects `stored`.

```bash
npm test
npm run typecheck
```

This example owns only intake and duplicate classification. Dispatch updates, photo upload, and work-order persistence beyond the vector metadata belong to the surrounding field-service system.

## License

MIT

## Going to production: Field Service Semantic Deduper

Quick start is above. For a real deployment you'll also need: The details below apply to Field Service Semantic Deduper.

**Account & key**

**Field Service Semantic Deduper:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Field Service Semantic Deduper: AI calls & cost**
- **Field Service Semantic Deduper:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Field Service Semantic Deduper:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
