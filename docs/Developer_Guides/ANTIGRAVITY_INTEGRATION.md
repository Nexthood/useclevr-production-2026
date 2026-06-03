# Antigravity Server Integration

## Overview

UseClevr integrates with the **Antigravity CLI proxy server** for efficient local AI inference. Antigravity acts as a local proxy that supports multiple cloud AI providers (Gemini, Claude, GPT, etc.) without requiring direct cloud API calls during development.

## Architecture

### AI Provider Priority

The system uses intelligent fallback routing to select the best available provider:

1. **Antigravity Server** (local proxy) - ⭐ Preferred
   - Low latency, supports multiple cloud models
   - Access to Gemini, Claude, GPT, and other models
   - No need to change API keys

2. **Local AI** (Ollama) - Offline mode
   - Works without internet connection
   - Full data privacy
   - Limited to local models

3. **Cloud AI** (Direct Google Gemini) - Fallback
   - Used only when Antigravity and Local AI are unavailable
   - Direct API calls to Google

## Setup

### 1. Start the Antigravity Server

```bash
cd /home/csaba/Documents/Antigravity-CLI
./cli-proxy-api
```

The server will start at `http://127.0.0.1:8317` by default.

### 2. Configure Environment Variables

Copy the example configuration:

```bash
cp .env.local.example .env.local
```

Add or verify these variables in `.env.local`:

```env
# Antigravity Proxy Server
ANTIGRAVITY_BASE_URL=http://127.0.0.1:8317
ANTIGRAVITY_API_KEY=<antigravity-api-key>

# Fallback: Cloud AI
GEMINI_API_KEY=<gemini-api-key>
```

### 3. Start UseClevr

```bash
pnpm dev
```

## Available Models

The Antigravity server supports multiple models. Check available models:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://127.0.0.1:8317/v1/models | jq '.data[].id'
```

Current models include:

- `gemini-2.5-flash` (default - recommended for most tasks)
- `gemini-2.5-pro` (better quality, slower)
- `gemini-3.5-flash-low`
- `claude-opus-4-6-thinking`
- `claude-sonnet-4-6`
- And others...

## How It Works

### Request Flow

```
UseClevr App
    ↓
Backend (Node.js)
    ↓
Antigravity Client (/src/lib/ai/antigravity-client.ts)
    ↓
Antigravity Proxy Server (http://127.0.0.1:8317)
    ↓
Cloud AI Provider (Gemini, Claude, GPT, etc.)
```

### Health Checks

The system automatically checks provider availability:

- **On startup**: Checks if Antigravity, Local AI, or Cloud are available
- **Per request**: Uses cached availability status
- **On failure**: Falls back to next available provider

## Troubleshooting

### "Missing API key" error

**Error:**

```
{"error":"Missing API key"}
```

**Solution:**
Add the API key to your Antigravity config:

```bash
# Edit /home/csaba/Documents/Antigravity-CLI/config.yaml
api-keys:
  - "<antigravity-api-key>"
```

Then restart the Antigravity server.

### Connection refused to 127.0.0.1:8317

**Error:**

```
Error: connect ECONNREFUSED 127.0.0.1:8317
```

**Solution:**

1. Verify Antigravity server is running:

   ```bash
   curl http://127.0.0.1:8317/v1/models -H "Authorization: Bearer YOUR_KEY"
   ```

2. If not running, start it:

   ```bash
   cd /home/csaba/Documents/Antigravity-CLI
   ./cli-proxy-api
   ```

3. Verify the port (default: 8317):

   ```bash
   lsof -i :8317
   ```

### "No AI provider available"

**Error:**

```
No AI provider. Start Antigravity server (http://127.0.0.1:8317),
Local AI, or configure GEMINI_API_KEY in .env.local.
```

**Solution:**

1. Start Antigravity: `./cli-proxy-api` in the Antigravity CLI directory
2. OR start Local AI: `ollama serve` or your local AI runtime
3. OR set `GEMINI_API_KEY` in `.env.local` for cloud fallback

## Development

### Antigravity Client API

The Antigravity client provides these main functions:

```typescript
// Check if server is available
const available = await checkAntigravityAvailability();

// Generate a completion
const response = await generateAntigravityCompletion({
  model: "gemini-2.5-flash",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "What is 2+2?" },
  ],
  temperature: 0.3,
  max_tokens: 1000,
});

// Get available models
const models = await fetchAntigravityModels();
```

### Environment Variables

| Variable               | Default                        | Required | Purpose                                             |
| ---------------------- | ------------------------------ | -------- | --------------------------------------------------- |
| `ANTIGRAVITY_BASE_URL` | `http://127.0.0.1:8317`        | No       | Antigravity proxy server URL                        |
| `ANTIGRAVITY_API_KEY`  | Falls back to `GEMINI_API_KEY` | No       | API key for Antigravity (can be same as Gemini key) |
| `GEMINI_API_KEY`       | -                              | Yes\*    | Fallback cloud AI key (\*if no Antigravity)         |

## Performance

### Latency

- **Antigravity**: ~100-500ms (local proxy)
- **Direct Cloud**: ~1-2s (network round-trip to Google)
- **Local AI**: ~5-30s (depends on model size)

### Recommended Usage

- **Antigravity** for development and production (best balance)
- **Local AI** when network is unavailable or privacy is critical
- **Direct Cloud** as emergency fallback only

## Configuration Reference

### Antigravity Server Config

File: `/home/csaba/Documents/Antigravity-CLI/config.yaml`

```yaml
host: "127.0.0.1"
port: 8317
api-keys:
  - "<antigravity-api-key>"
debug: false

gemini-api-key:
  - api-key: "<gemini-api-key>"
    models:
      - name: "gemini-2.5-pro"
        alias: "gemini-2.5-pro"
      - name: "gemini-2.5-flash"
        alias: "gemini-2.5-flash"
```

### API Endpoints

#### Check Models

```bash
curl -H "Authorization: Bearer KEY" http://127.0.0.1:8317/v1/models
```

#### Send a Message

```bash
curl -X POST http://127.0.0.1:8317/v1/chat/completions \
  -H "Authorization: Bearer KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "Hello"}],
    "temperature": 0.3,
    "max_tokens": 1000
  }'
```

## Quota, Pricing, and Runtime Separation

The development environment utilizes multiple AI entry points that operate on isolated credentials and pricing structures.

### Runtime Isolation

- **App AI Integration (Antigravity/Cloud Fallback)**: Runs inside the local Next.js server context using configuration from `.env.local`. When the Antigravity key reaches its individual usage quota, the app's internal AI features (e.g., dataset profiling or chatbot) fail or fall back to direct Gemini API usage.
- **Opencode CLI Developer Agent**: Runs directly in the terminal interface under a distinct developer seat or agent platform token. It does not route through the local Antigravity server or use `.env.local` API keys. Consequently, Opencode remains fully functional even when the app's development quota is exhausted.

### Pricing and Usage Matrix

| Component | Provider / Channel | Pricing Structure | Quota and Limits |
| :--- | :--- | :--- | :--- |
| **App-Side Cloud Fallback** | Google Gemini (Direct API) | Pay-As-You-Go:<br>• Input: ~$0.075 / 1M tokens<br>• Output: ~$0.30 / 1M tokens *(based on Gemini 2.5 Flash)* | Standard Google Cloud / AI Studio limits (Free tier: 15 RPM, Paid: High limits). |
| **Antigravity CLI Proxy** | Local proxy to cloud endpoints | Seat-based subscription or org credit pool | Hard-capped per developer API key. Reaching this quota blocks app-side proxy requests. |
| **Opencode Agent** | CLI Session (via Google Gemini) | Included in platform seat license or session credentials | Managed separately from development proxy keys. Resets with developer session or billing cycle. |

## Next Steps

1. **Start Antigravity**: `./cli-proxy-api`
2. **Configure `.env.local`** with your API keys
3. **Run `pnpm dev`** and test AI features
4. **Check logs** for provider selection: `[AI-ROUTER] ═══ SELECTED ═══`

---

**Questions?** Check the main README.md or CONTRIBUTING.md for more info.
