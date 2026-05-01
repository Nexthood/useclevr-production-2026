# User-Facing App Flow

This diagram shows the product journey from a user's point of view.

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

## User-Facing Responsibilities

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
