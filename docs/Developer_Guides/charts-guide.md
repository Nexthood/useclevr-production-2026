# Application Charts

## User-Facing Chart

Product journey from a user's point of view.

```mermaid
flowchart LR
    Visitor[Visitor] --> PublicPages[Public pages<br/>Landing, pricing, demo, contact, legal]
    PublicPages --> Auth[Login or signup]
    Auth --> AppShell[Authenticated app shell]

    AppShell --> Dashboard[Dashboard]
    AppShell --> Upload[Upload dataset]
    AppShell --> Datasets[Datasets]
    AppShell --> Assistant[AI assistant]
    AppShell --> Downloads[Downloads]
    AppShell --> Settings[Settings]

    Upload --> Parse[CSV parsed and validated]
    Parse --> Analyze[Dataset analysis]
    Analyze --> Dashboard
    Analyze --> Reports[Generated report]

    Datasets --> Explore[View metrics, tables, charts, and breakdowns]
    Assistant --> Ask[Ask business questions]
    Ask --> Verified[Verified computation when numbers are required]
    Verified --> Explanation[AI explanation based on computed result]

    Reports --> Downloads
    Downloads --> Export[PDF and downloadable files]
```

### Responsibilities

| Area | Understanding |
| --- | --- |
| Public pages | Product, pricing, demo, legal, contact, security. |
| Authentication | Moves users from public to protected area. |
| Upload | Accepts CSV, starts parsing, validation, analysis. |
| Dashboard | KPIs, charts, breakdowns, forecasts, reports. |
| Datasets | View uploaded data and insights. |
| Assistant | Answers questions; delegates numeric answers to verified computation. |
| Reports/downloads | Generates and serves PDF/report files. |
| Settings | Account/profile configuration and preferences. |

## Production Technical Chart

Production internals and system cooperation.

```mermaid
flowchart TB
    Browser[Browser<br/>React UI] --> NextPages[Next.js app routes<br/>app/]
    Browser --> NextApi[Next.js API routes<br/>app/api/]

    NextPages --> Components[components/<br/>UI and product components]
    NextPages --> AuthGate[Auth/session checks<br/>Auth.js / NextAuth]

    NextApi --> AuthGate
    NextApi --> Services[lib/<br/>business logic and orchestration]

    Services --> UploadHandler[Upload and parsing<br/>PapaParse]
    Services --> Deterministic[Deterministic analysis<br/>metrics, pipeline, forecasts]
    Services --> QueryEngine[Verified query engine<br/>safe computation]
    Services --> Reports[Report generation<br/>jsPDF]
    Services --> AI[AI layer<br/>Gemini via AI SDK]
    Services --> LocalAgent[Local AI bridge<br/>same-origin proxy]
    Services --> DB[Drizzle ORM]

    DB --> Neon[(Neon PostgreSQL)]
    LocalAgent --> LocalRuntime[Local runtime<br/>127.0.0.1:5143]

    Runtime[Next.js production server<br/>0.0.0.0:$PORT] --> NextPages
    Runtime --> NextApi
```

### Layer Responsibilities

| Layer | Files/Folders | Responsibility |
| --- | --- | --- |
| Frontend routes | `app/`, `app/app/` | Public pages and authenticated screens. |
| API routes | `app/api/` | Upload, chat, query, reports, datasets, forecast, local AI, health. |
| UI components | `components/`, `components/ui/` | UI, layouts, upload, data views, chat, reports. |
| Business logic | `lib/` | Data processing, AI orchestration, metrics, forecasts, storage, permissions. |
| Database | `lib/db/` | Drizzle schema, Neon connections, migrations. |
| Verified computation | `lib/queryEngine.ts`, `lib/queryIntentPrompt.ts`, `app/api/query/route.ts` | Converts computational questions into validated operations. |
| AI analysis | `lib/ai-*`, `lib/llmAdapter.ts`, `app/api/chat/route.ts` | Generates analysis while avoiding unsupported numeric claims. |
| Reports | `lib/report-generator.ts`, `lib/pdf-report-generator.ts`, `app/api/reports/route.ts` | Builds report content and PDF output. |
| Local AI | `lib/local-agent.ts`, `app/api/local-ai-*`, `app/api/local-agent/contract.md` | Connects app to local runtime for local AI features. |

### Data and AI Sequence

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant API as Next API
    participant Lib as lib/ services
    participant DB as Neon PostgreSQL
    participant AI as Gemini

    User->>UI: Upload CSV
    UI->>API: POST /api/upload
    API->>Lib: Parse and validate dataset
    Lib->>DB: Store dataset metadata and rows/analysis data
    Lib-->>API: Return upload result
    API-->>UI: Show dataset and dashboard state

    User->>UI: Ask a dataset question
    UI->>API: POST /api/chat or /api/query
    API->>Lib: Detect whether computation is needed
    Lib->>DB: Fetch schema/data needed for calculation
    Lib-->>API: Return verified computed result
    API->>AI: Ask for explanation using verified result
    AI-->>API: Return explanation text
    API-->>UI: Show answer, metrics, and supporting context
```

### User-Facing Responsibilities

| Area | What Team Members Should Understand |
| --- | --- |
| Public pages | Explain the product, pricing, demo, legal, contact, and security information. |
| Authentication | Moves users from public pages into the protected product area. |
| Upload | Accepts CSV/business datasets and starts parsing, validation, and analysis. |
| Dashboard | Presents KPIs, charts, breakdowns, forecasts, and report entry points. |
| Datasets | Lets users inspect uploaded data and generated insights. |
| Assistant | Answers dataset questions and delegates numeric answers to verified computation when needed. |
| Reports and downloads | Generates and serves PDF/report files for users. |
| Settings | Holds account/profile-level configuration and product preferences. |

## Production Technical Flow

This diagram shows the production application internals and how the main systems cooperate behind the scenes.

```mermaid
flowchart TB
    Browser[Browser<br/>React UI] --> NextPages[Next.js app routes<br/>app/]
    Browser --> NextApi[Next.js API routes<br/>app/api/]

    NextPages --> Components[components/<br/>UI and product components]
    NextPages --> AuthGate[Auth/session checks<br/>Auth.js / NextAuth]

    NextApi --> AuthGate
    NextApi --> Services[lib/<br/>business logic and orchestration]

    Services --> UploadHandler[Upload and parsing<br/>PapaParse]
    Services --> Deterministic[Deterministic analysis<br/>metrics, pipeline, forecasts]
    Services --> QueryEngine[Verified query engine<br/>safe computation]
    Services --> Reports[Report generation<br/>jsPDF]
    Services --> AI[AI layer<br/>Gemini via AI SDK]
    Services --> LocalAgent[Local AI bridge<br/>same-origin proxy]
    Services --> DB[Drizzle ORM]

    DB --> Neon[(Neon PostgreSQL)]
    LocalAgent --> LocalRuntime[Local runtime<br/>127.0.0.1:5143]

    Runtime[Next.js production server<br/>0.0.0.0:$PORT] --> NextPages
    Runtime --> NextApi
```

### Technical Responsibilities

| Layer | Main Files/Folders | Responsibility |
| --- | --- | --- |
| Frontend routes | `app/`, `app/app/` | Public pages and authenticated product screens. |
| API routes | `app/api/` | Server endpoints for upload, chat, query, reports, datasets, forecast, local AI, and health checks. |
| UI components | `components/`, `components/ui/` | Shared product UI, layouts, upload controls, data views, chat, and report interactions. |
| Business logic | `lib/` | Data processing, AI orchestration, deterministic metrics, forecasts, storage, permissions, and utilities. |
| Database | `lib/db/` | Drizzle schema, Neon connection setup, and migrations. |
| Verified computation | `lib/queryEngine.ts`, `lib/queryIntentPrompt.ts`, `app/api/query/route.ts` | Converts computational questions into validated operations and returns computed results. |
| AI analysis | `lib/ai-*`, `lib/llmAdapter.ts`, `app/api/chat/route.ts` | Generates natural-language analysis while avoiding unsupported numeric claims. |
| Reports | `lib/report-generator.ts`, `lib/pdf-report-generator.ts`, `app/api/reports/route.ts` | Builds report content and downloadable PDF output. |
| Local AI | `lib/local-agent.ts`, `app/api/local-ai-*`, `app/api/local-agent/contract.md` | Connects the app to a local runtime for local AI features. |

### Data And AI Sequence

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant API as Next API
    participant Lib as lib/ services
    participant DB as Neon PostgreSQL
    participant AI as Gemini

    User->>UI: Upload CSV
    UI->>API: POST /api/upload
    API->>Lib: Parse and validate dataset
    Lib->>DB: Store dataset metadata and rows/analysis data
    Lib-->>API: Return upload result
    API-->>UI: Show dataset and dashboard state

    User->>UI: Ask a dataset question
    UI->>API: POST /api/chat or /api/query
    API->>Lib: Detect whether computation is needed
    Lib->>DB: Fetch schema/data needed for calculation
    Lib-->>API: Return verified computed result
    API->>AI: Ask for explanation using verified result
    AI-->>API: Return explanation text
    API-->>UI: Show answer, metrics, and supporting context
```
