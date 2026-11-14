# Dronemaster

A minimal English–Italian inspection workspace with real photo uploads, saved observations, edit/delete/restore, on-device image classification and bilingual report export.

## Local development

```sh
npm run dev -- --port 5173 --hostname 127.0.0.1
```

Open http://127.0.0.1:5173. Local D1 and R2 persist under `.wrangler/state`; production data is separate. The supplied Sites starter provides its documented local development identity. The deployed application uses the platform's private access boundary. There are no profile, login or logout controls in the product UI.

## Stack and scope

- React, TypeScript and Vinext, deployed as a Cloudflare Worker through Sites.
- Cloudflare D1 for inspections, observations, audit events and limits; R2 for private image files.
- Parameterized queries and per-record ownership checks on every API operation.
- Same-origin mutation checks, bounded uploads, input schemas, image-signature checks and security headers.
- Soft deletion with Trash and Restore. Deleted photos still count toward storage. A linked evidence photo must be unlinked from observations before deleting it.
- Maximum 100 inspections, 12 photos per inspection, 6 MB per photo and 100 MB total per workspace; 40 writes per minute. These application limits are not a guarantee about an account's total hosting usage or bill.

No sample inspection records are seeded. User-created local records remain local; they are not silently copied to production.

## Free on-device AI

The optional classifier runs full-precision (`fp32`) `Xenova/mobilevit-xx-small` through Transformers.js, inside the browser. Quantized q8 weights were removed after a real-image regression showed severe misclassification. Older unversioned results are marked outdated and excluded from report predictions. No OpenAI API key or billable inference endpoint is used. The initial public model/runtime download requires internet access; the browser caches model files where supported. Model scores are generic ImageNet classification outputs, not industrial defect detection, temperature measurements, calibrated confidence or equipment diagnoses. Low-scoring results prompt manual review. Saved classification metadata is explicitly identified as client-reported.

English and Italian interface strings are supplied by the app. Observation translations are entered by the operator; missing translations are identified in the report. The app does not pretend to perform automatic translation.

## Routing

`/inspections`, `/inspections/new`, `/inspections/:id`, `/reports`, `/settings`, `/trash`. Root and the legacy `/dashboard` route redirect to inspections. Model inference is loaded only when requested.

## Checks

```sh
npx tsc --noEmit
python3 tests/check_local_workflow.py
```

The HTTP check requires the local development server. It exercises real database and file operations, including edits, soft deletion, restoration, ownership boundaries and bilingual export, then removes only its own temporary fixture. It never targets production. A browser run also verified real on-device inference on an uploaded image.

Build and publishing use the installed Sites workflow. `.openai/hosting.json` retains the Site identity and declares `DB` and `BUCKET`; migrations under `drizzle/` are applied by Sites before deployment. Production remains private. Hosting runs on Cloudflare through Sites; this does not claim to deploy into the user's separate Cloudflare dashboard account.

## Brand assets

`public/dronemaster-logo.png` is the user-supplied logo. `public/inspection-hero.png` was generated with the built-in ImageGen tool; its prompt is in `docs/IMAGE_PROMPT.md`. The simplified application does not display the decorative hero, following the user's request to remove marketing sections. It is never treated as inspection evidence. This is an independent application, not a claim of company endorsement.

See `docs/PITCH.md` for concise English and Italian outreach drafts and a demonstration script.

Real-model regression (optional, local fixture not committed):

```sh
node tests/check_image_model.mjs /path/to/alpine-mountain-image.jpg
```
