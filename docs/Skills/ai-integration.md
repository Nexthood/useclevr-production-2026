# AI Integration Skill

## Description
Handles AI integrations using Vercel AI SDK with Gemini, DeepSeek, and OpenAI providers.

## Capabilities
- Multi-provider AI setup
- Streaming responses
- Error handling
- Provider fallback

## Supported Providers
- Google Gemini (primary)
- DeepSeek (fallback)
- OpenAI (optional)

## Usage

### Basic AI Call
```typescript
import { generateText } from 'ai'

const result = await generateText({
  model: google('gemini-2.0-flash'),
  prompt: 'Analyze this data...'
})
```

### With Fallback
```typescript
import { generateText } from 'ai'
import { deepseek } from '@ai-sdk/deepseek'

const result = await generateText({
  model: google('gemini-2.0-flash'),
  prompt: 'Analyze this data...',
  fallbackModels: [deepseek('deepseek-chat')]
})
```

## Environment Variables
- GEMINI_API_KEY (required)
- DEEPSEEK_API_KEY (optional)
- OPENAI_API_KEY (optional)

## Best Practices
- Always implement provider fallback
- Handle rate limits
- Add timeout handling
- Log API errors for debugging
- Cache repeated requests when possible

## Cost Optimization
- Use streaming for large responses
- Choose appropriate model tier
- Implement request caching
- Monitor token usage