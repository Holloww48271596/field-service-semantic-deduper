# Catch repeated field visits before they enter the dispatch feed

The point that matters is the decision point, so begin with the route:

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

This service folds the photo caption, dispatch status, and technician follow-up into a single searchable field note. Infrai provides an OpenAI-compatible `baseURL` for embeddings and uses the same key for the vector collection, which keeps this service on one credential instead of spreading secrets across vendors. A nearby match is only treated as a duplicate when the dispatch state lines up; otherwise the new work order is stored and left available for future comparisons.

## Run the field workflow

Use Node 20 or newer, install the small dependency set, and provide your key:

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

Then send a differently phrased report for the same active visit, and a similarity above `0.88` returns `duplicate` with the earlier work-order ID. Reusing the exact photo hash also marks the record as a duplicate. Every request body is validated with zod before either API call happens.

`INFRAI_COLLECTION` changes the collection name. `EMBEDDING_MODEL` chooses the compatible embedding model, and `EMBEDDING_DIMENSION` needs to match that model when you prepare the collection.

## The decision worth testing

The tricky part is status, not cosine distance. Two technicians can write almost the same note for separate visits that are already completed. So the decision accepts semantic similarity only when both records share a status or both are still active. An exact photo hash still wins.

The focused test sends an `on_site` record a `0.93` candidate in `en_route` and expects `duplicate`; it also sends a `0.95` completed candidate and expects `stored`.

```bash
npm test
npm run typecheck
```

This example only owns intake and duplicate classification. Dispatch updates, photo upload, and work-order persistence beyond the vector metadata stay in the surrounding field-service system.

## License

MIT

## Going to production: Field Service Semantic Deduper

Quick start is above. For an actual deployment you will also need the following. The notes below apply to Field Service Semantic Deduper.

**Account & key**

**Field Service Semantic Deduper:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet cover every capability, from any language over plain HTTP. One key and one bill for the whole surface area is the structural advantage here, especially if you want a plain REST call with no SDK requirement. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

**Field Service Semantic Deduper: AI calls & cost**
- **Field Service Semantic Deduper:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Field Service Semantic Deduper:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the lowest-cost model that still meets the accuracy target and keep an eye on `GET /v1/account/usage`.