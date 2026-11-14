# Dronemaster — application and outreach pack

## Project

A private English–Italian inspection workspace: create an inspection, upload actual photos, add evidence-linked observations, review them, and export a bilingual report. Edit, delete and restore inspections, photos and observations. Optional on-device MobileViT classification requires no paid AI API and never claims industrial defect detection.

The public company website describes industrial inspection, robotics, software integration, AI and cybersecurity: https://www.dronemaster.it/. The supplied job lists Python, C++/JavaScript, relational databases and cybersecurity. This implementation demonstrates JavaScript/TypeScript, SQL, authenticated data access and Python HTTP integration tests. The deployed backend is a Cloudflare Worker, not Python; do not misrepresent that in an application. C++ is not implemented.

## English message

Hi Federico, I applied for the Software Engineer role and built an independent inspection workspace inspired by Dronemaster’s industrial inspection work. It supports actual photo uploads, evidence-linked observations, English–Italian reports, and optional image classification that runs locally in the browser without a paid AI API.

The implementation uses JavaScript/TypeScript and SQL, with per-record access checks, validated uploads and Python integration tests. I’d be happy to share the source and a brief walkthrough. Would this workflow be relevant to the team?

## Messaggio italiano

Ciao Federico, ho inviato la candidatura per il ruolo di Software Engineer e ho sviluppato uno spazio di lavoro indipendente ispirato alle attività di ispezione industriale di Dronemaster. Consente di caricare foto reali, registrare osservazioni collegate alle evidenze ed esportare rapporti in italiano e inglese. La classificazione delle immagini opzionale funziona nel browser, senza API AI a pagamento.

Ho utilizzato JavaScript/TypeScript e SQL, con controlli di accesso sui singoli record, validazione dei file caricati e test di integrazione in Python. Mi farebbe piacere condividere il codice e una breve presentazione. Un flusso di questo tipo potrebbe essere utile al team?

Choose one version. No message has been sent. The hosted application is private; verify recipient access before sharing a link. An alternative is a short screen recording plus source code.

## 60-second walkthrough

1. Create an inspection and upload a real image.
2. Optionally run the small on-device classifier; explain that general labels are not defect diagnoses.
3. Add an observation in English and Italian, link its photo, and mark it reviewed.
4. Edit a record, move an expendable item to Trash and restore it.
5. Switch interface language and export the combined EN/IT Markdown report.

No prediction scores should be presented as measured model accuracy. Ask the team about real data formats, embedded C++ work and industrial validation requirements before proposing extensions. The job's Italian “Informatica” requirement may refer to general computing experience; ask rather than assume an ETL product.
