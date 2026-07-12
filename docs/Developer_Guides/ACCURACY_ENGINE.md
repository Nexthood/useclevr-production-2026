# UseClevr Accuracy Engine

This guide records the Phase 1 Neon Lakebase Search foundation.

## Phase 0 Audit

- Database client: Drizzle ORM with Neon serverless HTTP, Neon WebSocket pool, or node-postgres selected from the existing database URL.
- Migration system: Drizzle schema lives in `src/lib/db/schema.ts`; SQL migrations live in `src/lib/db/migrations/`.
- Neon environment variables: `DATABASE_URL` is the runtime source; `DIRECT_URL` is accepted by Drizzle config and database tooling.
- Dataset tables: `Dataset` stores uploaded file metadata, parsed preview data, analysis fields, and `datasetType`; `DatasetRow` stores parsed rows.
- User tables: `User`, `Profile`, `Session`, and related auth tables hold user identity and billing/profile state.
- Workspace tables: `Workspace`, `WorkspaceMember`, and invitations exist, but current datasets use `Dataset.userId` as the active tenant key.
- AI tables: `AiInteractionTrace`, `AiRequestAuditLog`, `AiProviderConfig`, `AICostLog`, and usage tables record AI calls, providers, credits, and cost metadata.
- Tenant ownership: current dataset access resolves by `Dataset.userId`; admin and superadmin access uses role-aware helpers.
- AI provider implementation: UseClevr uses Gemini through AI SDK for default cloud output and the Universal AI Adapter for configured BYOAI providers.
- Embedding implementation: Phase 1 adds a server-only accuracy embedding adapter with deterministic hash embeddings by default and an OpenAI-compatible embedding endpoint when configured.
- Dataset categories: UseClevr supports `standard`, `retail`, `profitability`, `accountancy`, and `prebookkeeping`; upload and report routing remain separate.

## Retrieval Principle

- SQL calculates exact KPIs.
- Accuracy retrieval finds relevant context.
- The LLM explains validated results.
- The LLM must not invent KPI values.

## Capability Modes

The server detects installed database capabilities without exposing credentials:

- `lakebase_hybrid`: `lakebase_vector` and `lakebase_text` are installed.
- `pgvector_fts`: `vector` and PostgreSQL full-text search are available.
- `fts_only`: PostgreSQL full-text search is the available retrieval backend.

Superadmin can inspect the sanitized mode through the Accuracy Engine status API.

## Migration Behavior

The Phase 1 migration tries to enable:

```sql
CREATE EXTENSION IF NOT EXISTS lakebase_vector CASCADE;
CREATE EXTENSION IF NOT EXISTS lakebase_text CASCADE;
CREATE EXTENSION IF NOT EXISTS vector CASCADE;
```

Each extension activation runs inside a guarded block. Unsupported Neon branches continue with `RetrievalDocument`, `AccuracyIngestionJob`, JSONB embedding storage, and PostgreSQL full-text search.

The migration creates:

- a PostgreSQL GIN full-text index on the generated `contentTsv` column
- a guarded Lakebase BM25 index on `contentTsv` when `lakebase_text` is installed

Lakebase ANN vector indexing requires a `VECTOR(n)` column where `n` exactly matches the production embedding model dimension. Phase 1 stores JSONB embeddings with `embeddingDimensions` and does not create a `VECTOR(n)` column until the selected embedding model is fixed.

## Embedding Configuration

Default local test mode:

```bash
ACCURACY_EMBEDDING_PROVIDER=hash
ACCURACY_EMBEDDING_DIMENSIONS=384
```

OpenAI-compatible embedding endpoint:

```bash
ACCURACY_EMBEDDING_PROVIDER=openai-compatible
ACCURACY_EMBEDDING_BASE_URL=https://provider.example/v1
ACCURACY_EMBEDDING_API_KEY=<server-only secret>
ACCURACY_EMBEDDING_MODEL=<embedding-model>
```

The stored `embeddingDimensions` value always comes from the generated vector length.

## Tenant Isolation

Every ingestion and retrieval call resolves the dataset through the authenticated user and existing role-aware dataset access helper. Retrieval queries use the dataset owner as the tenant key and require a dataset ID.

Run the tenant isolation test against a migrated database:

```bash
pnpm test:accuracy-tenant-isolation
```
