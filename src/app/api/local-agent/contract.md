# UseClevr Local Agent API Contract

The local agent is a local-only companion runtime used by the UseClevr web app for local AI features. The web app should reach it through same-origin Next API routes rather than direct browser calls.

Base URL:

```text
http://127.0.0.1:5143
```

## Endpoints

### `GET /status`

Reports local runtime presence and installed models.

Response `200`:

```json
{
  "runtime": "unavailable",
  "models": [{ "name": "string" }],
  "info": "optional status details"
}
```

Allowed `runtime` values:

- `unavailable`
- `installing`
- `available`
- `starting`
- `error`

### `POST /install-runtime`

Starts OS-specific runtime installation. This operation should be non-blocking.

Request:

```json
{}
```

Response `202`:

```json
{ "accepted": true }
```

### `POST /start-runtime`

Starts or ensures the local runtime is running.

Request:

```json
{}
```

Response `200`:

```json
{ "started": true }
```

### `POST /pull-model`

Downloads or installs a model through the local runtime.

Request:

```json
{ "model": "string" }
```

Response `202`:

```json
{ "accepted": true }
```

### `POST /verify`

Runs a minimal test prompt to verify the selected model.

Request:

```json
{ "model": "string" }
```

Response `200`:

```json
{ "ok": true }
```

## Implementation Notes

- All operations are local and should keep the public UX UseClevr-branded.
- Long-running operations should be asynchronous and report progress through `GET /status`.
- Technical runtime details should stay secondary in product UI unless needed for troubleshooting.
- Browser code should call the app's same-origin API routes, not `127.0.0.1:5143` directly.
