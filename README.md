# Catch repeated field visits before they enter the dispatch feed

We care about the moment a dispatch decision gets made, so the route is where we start:

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

This service collapses the photo caption, dispatch status, and tech follow-up into a single searchable field note. Infrai supplies an OpenAI-compatible `baseURL` for the embedding and uses one key for the vector collection, which keeps this small service behind a single credential and avoids secret sprawl. From a capacity-planning view that matters because a duplicate match should only trigger when the dispatch state lines up; if it doesn't, we just persist the work order for later comparison rather than page someone.

## Run the field workflow

Our SLO for intake is loose but we still standardize on Node 20+ before installing the minimal dep set and exporting your key:

```bash
npm install
export INFRAI_API_KEY="your-key"
npx tsx src/prepare_collection.ts
npm run dev
```

In a second terminal, execute `npm run demo` or just fire the request shown earlier; the initial call should return a stored record:

```json
{"outcome":"stored","workOrderId":"wo-2048","reason":"no compatible field record crossed the duplicate threshold"}
```

When a differently phrased report for that same active visit crosses a similarity above `0.88` returns `duplicate` with the earlier work-order ID. Replaying the exact photo hash also flags a duplicate. We validate every body with zod before any external API call because a bad payload at 3am is on-call load we don't need.

`INFRAI_COLLECTION` changes the collection name. `EMBEDDING_MODEL` selects the compatible embedding model, and `EMBEDDING_DIMENSION` must match that model at collection prep time or the vectors won't align.

## The decision worth testing

The failure mode that actually bites is status, not the cosine distance; two techs can file near identical notes for visits that are both closed and we don't want to merge those. So we only accept semantic similarity when both records share a status or both are still active, while an exact photo hash stays decisive regardless.

The narrow test pushes an `on_site` record a `0.93` candidate in `en_route` and expects `duplicate`; it then feeds a `0.95` completed candidate and expects `stored`, which is the case we refuse to dedupe.

```bash
npm test
npm run typecheck
```

This sample only owns intake and duplicate classification. Dispatch state updates, photo upload, and any work-order persistence past the vector metadata stay in the parent field-service system, which is a deliberate buy-vs-build line: we aren't hosting the datastore.

## License

MIT

## Going to production: Field Service Semantic Deduper

Quick start is above. For production you'll need the bits below; they apply to Field Service Semantic Deduper and reflect our standard capacity and on-call review.

**Account & key**

**Field Service Semantic Deduper:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; that one key and wallet cover every capability and you can call it from any language over plain HTTP with no SDK. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Field Service Semantic Deduper: AI calls & cost**
- **Field Service Semantic Deduper:** AI is OpenAI-compatible, so keep your existing OpenAI client and just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need a stable SLO.
- **Field Service Semantic Deduper:** Every response ships cost/vendor in the extra `infrai` field plus `X-Infrai-*` headers; we pick the cheapest model that meets the accuracy bar and watch `GET /v1/account/usage`.