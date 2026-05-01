# Deployment Flow

This diagram shows how code becomes a running production service.

```mermaid
flowchart LR
    Dev[Developer change] --> Git[GitHub]
    Git --> Railway[Railway service]
    Railway --> Install[pnpm install<br/>frozen lockfile]
    Install --> Build[pnpm build]
    Build --> Start[pnpm start / railway:start]
    Start --> Health[/api/health]
    Start --> App[Production app]
    App --> Neon[(Neon PostgreSQL)]
```

## Deployment Responsibilities

| Step | Responsibility |
| --- | --- |
| GitHub | Stores the source code and triggers deployment workflows. |
| Railway | Installs dependencies, builds the app, starts the runtime, and runs health checks. |
| Nixpacks | Detects the Node/pnpm project and prepares the build environment. |
| pnpm | Installs dependencies and runs build/start scripts. |
| Next.js production server | Serves public pages, authenticated app routes, and API routes. |
| `/api/health` | Confirms the service is reachable and ready for Railway health checks. |
| Neon PostgreSQL | Provides the production database used by the running app. |
