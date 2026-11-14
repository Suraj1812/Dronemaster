# Dronemaster application — project and outreach pack

## Recommended project

**AERIS: bilingual industrial inspection copilot.** Review inspection findings, investigate anomalies, ask evidence-grounded questions in English or Italian, and export a bilingual report with source references. This targets a plausible engineering workflow from the company's stated industrial inspection and AI integration focus. It is a portfolio proposal, not a claim about their internal tools or current product needs.

Stack: Python API + SQLite + vanilla JavaScript. Optional OpenAI Responses API for structured bilingual answers. Start with a small trustworthy demo; image ingestion, CV detection and C++ edge integration are future extensions rather than claimed implemented features.

Two other directions: (1) bilingual maintenance-manual assistant with passage citations, Python ingestion and SQL document metadata; (2) telemetry anomaly review dashboard with documented statistical rules and audit logs. AERIS combines the clearest visual demonstration with the shared job requirements.

## English LinkedIn message

Hi Federico, thanks for connecting. I applied for the Software Engineer role and built AERIS, a small independent prototype inspired by Dronemaster’s industrial inspection work: an English–Italian workspace for reviewing findings, exploring telemetry and exporting evidence-linked reports.

It uses Python, JavaScript and SQLite, with input validation, parameterized SQL and audit events. The demo works with synthetic data; an optional server-side AI integration supports bilingual answers with finding references.

I’d be happy to share a short walkthrough and the source code. Would this kind of inspection workflow be relevant to the team?

## Italian LinkedIn message

Ciao Federico, grazie per il collegamento. Ho inviato la candidatura per il ruolo di Software Engineer e ho sviluppato AERIS, un piccolo prototipo indipendente ispirato alle attività di ispezione industriale di Dronemaster: uno spazio di lavoro in italiano e inglese per esaminare i rilievi, consultare la telemetria ed esportare rapporti con riferimenti alle evidenze.

Ho utilizzato Python, JavaScript e SQLite, con validazione degli input, query parametrizzate e registrazione degli eventi. La demo usa dati sintetici; un’integrazione AI opzionale lato server consente di ottenere risposte bilingui con riferimenti ai rilievi.

Mi farebbe piacere condividere una breve presentazione e il codice sorgente. Un flusso di questo tipo potrebbe essere utile al vostro team?

## Short mixed-language version

Ciao Federico! I applied for the Software Engineer role and built a small English–Italian inspection prototype inspired by Dronemaster’s work. Python + JavaScript + SQL, with evidence-linked findings, telemetry and bilingual reports. It uses synthetic data and has an optional server-side AI integration. Mi farebbe piacere mostrarti una breve demo e condividere il codice. Would a short walkthrough be useful?

Choose one version; do not send all three. No message has been sent. Add a recording or an accessible demo link only after checking its access settings. The current hosted Sites preview is owner-private.

## 90-second demo script

1. **0–15 seconds:** “I built a review workflow for industrial inspections. Everything here is synthetic and clearly labelled.” Show coverage, findings and the inspection schematic.
2. **15–35 seconds:** Select the high severity thermal anomaly. Explain the 78.4°C observation and 42.1°C reference. Distinguish the observation from an unproven root cause.
3. **35–50 seconds:** Ask about the anomaly and click F-001 to trace the source. Explain that default mode is deterministic retrieval; live AI is available only with the local backend and a configured API key.
4. **50–65 seconds:** Switch to Italian. Show translated findings and ask about the signal drop. Do not claim that bilingual app content demonstrates personal Italian proficiency.
5. **65–80 seconds:** Show telemetry and export the combined EN/IT Markdown report.
6. **80–90 seconds:** Explain Python API, SQL audit records, security checks and tests. Offer to discuss how a real team's inspection workflow would change the design.

## Interview talking points

- Why this scope: fast human review and traceability are demonstrable without flight hardware.
- Why relational SQL: clear inspection-to-findings relationships, validation and auditable actions.
- Why JavaScript: meets the listed alternative to C++ and makes the demo easy to inspect.
- Why abstention: missing evidence should not become an invented diagnosis.
- Why no forced C++ service: no measured performance requirement in this prototype.
- What comes next: real labelled data, proper evaluation of retrieval and bilingual factuality, auth and role controls, ingestion validation, and a production backend.
- Ask the recruiter: which part of the role involves embedded C++, web applications, AI integration and cybersecurity? Does “Informatica” refer to general IT experience?

Do not present synthetic confidence annotations as measured model accuracy or promise production readiness. No prototype can guarantee recruiter interest.

## Sources

- Company: https://www.dronemaster.it/ — industrial inspections, software/firmware, AI and cybersecurity integration (checked 14 November 2026).
- Job: user-supplied Software Engineer listing, https://www.linkedin.com/jobs/view/4483459734/.
- API: https://developers.openai.com/api/reference/resources/responses/methods/create.
