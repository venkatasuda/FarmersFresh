# Visual search — recogniser interface

The app's visual search (`/api/visual-search`) is provider-agnostic. It takes a
photo, asks a **recogniser** what's in it, and searches the catalogue for the
resulting word. You can use Google Vision, or **plug in your own model** — the
app never changes; you only set env vars.

## Switching provider (env)

| Provider | `VISION_PROVIDER` | Required env |
|---|---|---|
| Google Cloud Vision | `google` | `GOOGLE_VISION_API_KEY` |
| Your own model | `custom` | `VISION_ENDPOINT_URL` (+ optional `VISION_ENDPOINT_TOKEN`) |

Also set `NEXT_PUBLIC_VISUAL_SEARCH=1` to reveal the camera button in the UI.
If nothing is configured, the route returns 503 and the button stays hidden.

## Your model's contract (`VISION_PROVIDER=custom`)

The app calls your endpoint like this:

```
POST  <VISION_ENDPOINT_URL>
Authorization: Bearer <VISION_ENDPOINT_TOKEN>   # only if you set the token
Content-Type: application/json

{ "image": "<base64 JPEG/PNG, no data-url prefix>" }
```

Your endpoint must reply with JSON — **either** a single best term (preferred):

```json
{ "term": "coriander" }
```

**or** an ordered list, most-specific first:

```json
{ "labels": ["coriander", "cilantro", "herb"] }
```

That's it. The app then:
1. drops generic words (`food`, `vegetable`, `herb`, …),
2. takes the top remaining term,
3. searches the catalogue → shows the product, or "no results" if you don't
   stock it / it's out.

## Notes for building the model

- **Output your own catalogue's product names** where you can (e.g. return
  `"Coriander"` exactly as the product is named) — then step 3 is an exact hit.
  Returning generic English labels also works via search, just less precisely.
- Keep latency low (< ~2 s) — the customer is standing in the app waiting.
- Handle "don't know" by returning `{ "term": null }` or `{ "labels": [] }`;
  the app shows a friendly "couldn't recognise, try typing it".
- The endpoint only ever receives an image; no customer data. Host it wherever
  you like (FastAPI/TorchServe/Triton/etc.) as long as it's reachable over HTTPS.
