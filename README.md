# AERIS — English–Italian Inspection Copilot

An independent portfolio prototype tailored to the Software Engineer role shared for Dronemaster. Turns synthetic industrial inspection findings into a bilingual, source-linked review workspace. No affiliation or endorsement is claimed.

## Run locally

Python 3.10+ and a modern browser. No packages to install.

```sh
cd /Users/surajsingh/Documents/Dronemaster/aeris
python3 server.py
```

Open http://127.0.0.1:8765. The backend initializes a local SQLite database on first run. Ctrl-C stops the server. Use `PORT` for another port.

## Two distinct execution modes

**Evidence search (default):** deterministic bilingual keyword matching against three pre-annotated findings. This is not LLM inference or computer vision. All demo interactions, language switching, filters, telemetry charts and bilingual Markdown report export work without credentials.

**Live AI (optional, local backend):** export `OPENAI_API_KEY` in the terminal before starting the server. Optionally set `OPENAI_MODEL` (default `gpt-4.1-mini`). The key remains server-side. The Python backend calls the OpenAI Responses API with the synthetic evidence and question, requests structured answers with valid evidence IDs, and records source IDs and mode in SQLite. Questions and evidence are transmitted to OpenAI in this mode; `store` is false. Never put a key in browser code or commit it.

Live mode was verified with a mocked API response; no credential-backed generation was run. Model availability depends on the account. A failed API call returns an error rather than a fabricated answer.

**Hosted preview:** a static, private Sites deployment serves `dist/`. It runs browser-side evidence search and contains no Python server, SQL database or live AI. The UI explicitly identifies the demo mode. The hosted link is owner-private; change access through Sites before sending it to a recruiter, or share a recording/source archive.

## Why this project fits

Dronemaster's public website describes industrial inspections, system integration, AI and cybersecurity: https://www.dronemaster.it/. The supplied role lists Python, C++/JavaScript, relational databases, testable code and cybersecurity.

| Requirement | Concrete demonstration |
| --- | --- |
| Python | HTTP API, evidence retrieval, optional Responses API adapter |
| JavaScript | Accessible interactive dashboard, EN/IT UI, filters, charts, exports |
| SQL | SQLite inspection, findings and audit tables with foreign keys and severity constraint |
| Cybersecurity | Parameterized writes, same-origin POST policy, host validation, public file allowlist, bounded inputs, CSP, safe text rendering, server-side API key |
| Testable code | Backend tests for retrieval, validation, injection strings, access boundaries and AI adapter |
| AI relevance | Evidence-grounded bilingual assistant with explicit abstention and source references |

C++ is not used. The post says C++/JavaScript; JavaScript is the implemented choice. A real edge telemetry parser would be a defensible future C++ extension only if profiling warrants it. “3+ years Informatica” in an Italian job context may mean IT/computing experience; do not assume it means Informatica ETL without asking the recruiter.

## Architecture

```text
Browser: HTML / CSS / JavaScript
    ├─ Hosted: sample.json → deterministic evidence search
    └─ Local: Python HTTP API
                 ├─ SQLite: inspections, findings, audit_events
                 └─ Optional: OpenAI Responses API → structured answer + evidence IDs
```

Endpoints: `GET /api/inspection`, `POST /api/chat` (`question`, `language`), `POST /api/export` (records report export event). Static assets are explicitly allowlisted. Reports are assembled from the evidence, not hallucinated by a model. Audit events omit raw question text and API credentials. The local HTTP server binds only to loopback and is a development server, not a production service. Before real deployment add authentication, request-rate controls, a production app server, centralized observability and data retention controls. Source IDs show traceability, not proof that all model statements are correct.

## Verify

```sh
python3 -m unittest discover -s tests -v
node --check dist/app.js
```

Manual flow: switch EN/IT → ask a suggested question → click source ID → filter findings → inspect telemetry → export bilingual report. Unknown questions should abstain in evidence-search mode. Sample source filenames are illustrative references, not attached image files. The map is a schematic, scores are synthetic annotations, and no actual image inference or aircraft control takes place.

## Deliverables

- `docs/PITCH.md`: project rationale, stack mapping, English and Italian outreach drafts, 90-second demo script and interview talking points.
- `dist/`: deployable static preview.
- `server.py`, `tests/`: Python/SQL implementation and automated checks.

Research checked 14 November 2026. LinkedIn job details were supplied by the user; direct retrieval of the job URL timed out.
