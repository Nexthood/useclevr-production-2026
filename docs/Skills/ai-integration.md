# AI Integration Skill

## Description
Handles AI integrations using AI SDK with the Gemini provider.

## Capabilities
- Streaming responses
- Error handling
- Local runtime fallback where the app explicitly supports it

## Supported Providers
- Google Gemini (cloud)
- Local Ollama runtime where enabled by the app

## Usage

### Basic AI Call
```typescript
import { generateText } from 'ai'

const result = await generateText({
  model: google('gemini-2.0-flash'),
  prompt: 'Analyze this data...'
})
```

## Environment Variables
- GEMINI_API_KEY (required)

## Best Practices
- Handle rate limits
- Add timeout handling
- Log API errors for debugging
- Cache repeated requests when possible

## Cost Optimization
- Use streaming for large responses
- Choose appropriate model tier
- Implement request caching
- Monitor token usage
