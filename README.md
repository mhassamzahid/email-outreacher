# Coldbrew (frontend)

Personalized cold email dashboard: define ICPs, import leads, enrich them with recent posts and website content, and generate one email per lead from editable, versioned prompts.

This is the frontend only. There is no backend, database or real scraping/LLM call. Everything runs on mock data in client state and resets on refresh.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 (redirects to `/icps`).

## Where things live

| Path | What |
| --- | --- |
| `lib/types.ts` | All data types |
| `lib/mock-data.ts` | Seed data: 3 ICPs, 75 leads, enrichment items, generations, prompt templates and versions, settings |
| `lib/mock-actions.ts` | Every fake async call: enrichment, generation, prompt test, cost estimates. **Replace these bodies with real API calls.** |
| `lib/store.tsx` | One React Context holding app state plus the actions pages call |
| `lib/templating.ts` | Real `{{variable}}` prompt renderer (no eval) |
| `lib/import.ts`, `lib/csv.ts` | CSV parsing, column auto-mapping, dedupe, website derivation, CSV export |
| `lib/diff.ts` | Line diff for prompt version comparison |

## Plugging in a backend

1. Replace the function bodies in `lib/mock-actions.ts` with API calls, keeping the signatures.
2. Replace the `useState(mock.x)` seeds in `lib/store.tsx` with fetched data, and route the store actions through your API.
3. Pages only talk to the store, so they shouldn't need changes.

## Notes

- Costs use the per-source constants in `mock-actions.ts`. Prompt test token pricing is a placeholder, not real model pricing.
- `lib/utils.ts` has a minimal `cn` helper. Swap it for the `cn` package (`npm install cn`, then `export { cn } from "cn"`) so Tailwind class overrides merge properly. Until then, pages use the `!` modifier where they override component defaults.
