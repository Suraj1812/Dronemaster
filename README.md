# Dronemaster

An English–Italian inspection workspace for real photo evidence, on-device photo descriptions, editable observations and bilingual reports.

## Run locally

Use Node.js 24+.

```sh
npm ci
npm run dev -- --port 5173 --hostname 127.0.0.1
```

Open http://127.0.0.1:5173. The supplied Sites development environment provides a local development identity. Hosted access is private and managed by the platform; the product has no profile/login/logout controls.

Apply the schema migrations to the local D1 database before creating records. Build once to generate the local bindings configuration:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --config dist/server/wrangler.json --persist-to .wrangler/state
```

If using an existing checkout where migrations were applied directly, do not replay them. Preserve `.wrangler/state` for local records. Production data is separate.

## Photo analysis

1. Create an inspection and upload a JPG, PNG or WebP photo.
2. Open **Describe this photo**, or ask a specific visual question.
3. Review the generated English draft. The main page shows three lines; **View details** opens the complete answer.
4. Choose **Use as observation** to edit the text, add an optional Italian translation and link the source photo before saving.
5. Mark verified observations reviewed and export a combined English–Italian Markdown report.

SmolVLM-500M runs inside a dedicated browser Web Worker using the CPU/WASM runtime. One worker session is reused, requests are queued, and Cancel terminates processing. The matching Transformers.js and ONNX runtime assets are served from the application. Public model weights download from Hugging Face on first use (about 810 MB); there is no paid inference API or API key. Adequate device memory and internet access are required. First use is substantially slower than subsequent runs.

Optional local pre-download:

```sh
node scripts/cache-vision-model.mjs
```

The development server can stream cached model files locally. Model binaries, user photos and databases are never committed. The live app downloads weights directly into the visitor's browser cache where supported.

The model can describe visible content and answer photo questions; it can also make mistakes or unsupported assumptions. It is not a validated industrial defect detector, does not measure temperatures and cannot establish equipment faults. AI drafts remain marked unreviewed in reports. Human-supplied translations are not presented as automatic translation.

## Application features

- Inspections: create, edit, delete and restore.
- Evidence photos: private upload, preview, rename, delete and restore.
- Observations: edit bilingual text, link evidence, set priority, review, delete and restore.
- Compact photo and observation cards, full detail dialogs and English/Italian interface.
- Bilingual report export from the actual saved records, with source IDs and separate AI draft sections.
- No seeded demonstration inspection records.

Deleted photos retain their underlying file for restoration and continue to count toward storage. Unlink a photo from active observations before deleting it.

## Stack

React, TypeScript, Vinext, Cloudflare Workers, D1 and R2. Python runs real local HTTP workflow checks. The deployed backend is TypeScript, not Python.

The API enforces per-record ownership, parameterized SQL, same-origin writes, bounded request bodies, validated image signatures, rate limiting and database-enforced upload quotas. Security headers protect the hosted worker. Limits: 100 inspections, 12 photos per inspection, 6 MB per photo, 100 MB storage per workspace and 40 writes per minute. These app limits are not an account-wide hosting billing guarantee.

## Verification

```sh
npx tsc --noEmit
node --test tests/backend.test.mjs
python3 tests/check_local_workflow.py
```

The Python check requires the local server and removes only its own temporary fixture. It never targets production. Backend tests run production handlers against an isolated SQLite database with D1-compatible bindings. Visual and inference testing use actual uploaded images; no model output is hardcoded.

## Routes

`/inspections`, `/inspections/new`, `/inspections/:id`, `/reports`, `/settings`, `/trash`.

## Deployment

The current application is hosted on Cloudflare through Sites. `.openai/hosting.json` identifies the hosted project and its DB/BUCKET bindings. The Sites publishing workflow applies the tracked SQL migrations and deploys the Worker plus static assets. This repository is the source; pushing to GitHub alone does not deploy it. Runtime secrets and local state are excluded from Git.

Third-party runtime notices are in `public/vendor/`. The supplied Dronemaster logo is used as provided. This is an independent application; company endorsement is not claimed. The decorative generated asset is retained with its prompt in `docs/IMAGE_PROMPT.md` and is not inspection evidence.
