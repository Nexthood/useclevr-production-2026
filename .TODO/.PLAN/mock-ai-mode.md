# Mock AI Mode Plan

## Objective
Create a Mock AI mode for development that provides fake AI responses to enable rapid UI/UX development and testing without consuming AI API credits or depending on external services.

## Scope
- Mock AI responses for all AI-powered features in the application
- Configurable to switch between real AI and mock AI modes
- Realistic response timing and variability to simulate real AI behavior
- Support for different AI providers (Gemini, Local AI, Antigravity)
- Persistent mock responses for consistent testing

## Implementation Plan

### 1. Configuration System
- Add `MOCK_AI_MODE` environment variable to enable/disable mock mode
- Add `MOCK_AI_RESPONSE_DELAY_MS` for configurable response timing
- Add `MOCK_AI_VARIABILITY_PERCENTAGE` for response variation
- Store mock responses in JSON files by feature/context

### 2. Mock Response Templates
Create mock response templates for:
- AI Assistant responses (chat, analysis, suggestions)
- Dataset analysis and insights
- Report generation and explanations
- Business recommendations and predictions
- Trend analysis and forecasting
- Anomaly detection and alerts

### 3. Implementation Details

#### AI Router Modification
Modify `src/lib/ai/ai-router.ts` to:
- Check for `MOCK_AI_MODE` environment variable
- Return mock responses instead of calling real AI providers
- Simulate network latency with configurable delays
- Return provider-specific response formats

#### Mock Response Structure
```
/src/lib/ai/mock/
├── responses/
│   ├── assistant/
│   │   ├── analysis.json
│   │   ├── suggestions.json
│   │   └── explanations.json
│   ├── dataset/
│   │   ├── insights.json
│   │   ├── trends.json
│   │   └── anomalies.json
│   └── report/
│       ├── executive-summary.json
│       ├── recommendations.json
│       └── forecasts.json
└── templates/
    ├── assistant-template.json
    ├── dataset-template.json
    └── report-template.json
```

#### Response Generation
- Load appropriate mock template based on request type
- Apply variability based on `MOCK_AI_VARIABILITY_PERCENTAGE`
- Add simulated processing delay
- Format response to match real AI provider output structure

### 4. Features to Mock
- Dataset analysis and insight generation
- AI Assistant chat responses
- Report generation and explanations
- Business recommendations and predictions
- Trend analysis and forecasting
- Anomaly detection and alerts
- Data quality assessments
- Forecasting and predictive analytics

### 5. Testing and Development Benefits
- Rapid UI iteration without API delays
- Consistent test scenarios for automated testing
- Development without API key or quota concerns
- Offline development capability
- Predictable responses for screenshot/testing consistency
- Ability to test error states and edge cases

### 6. Implementation Steps

1. Create mock response directory structure
2. Define mock response templates for each AI feature
3. Modify AI router to check for mock mode
4. Implement mock response loader with variability
5. Add environment variable configuration
6. Create helper functions for mock response generation
7. Add documentation for enabling/disabling mock mode
8. Create toggle in development settings/UI for easy switching

### 7. Environment Variables
- `MOCK_AI_MODE=true/false` - Enable/disable mock mode
- `MOCK_AI_RESPONSE_DELAY_MS=1000` - Base response delay in milliseconds
- `MOCK_AI_VARIABILITY_PERCENTAGE=20` - Response variability percentage
- `MOCK_AI_RESPONSE_SEED=12345` - Seed for reproducible responses (optional)

### 8. Response Realism Features
- Variable response lengths to simulate different complexity levels
- Context-aware responses based on dataset characteristics
- Realistic timing variations (not fixed delays)
- Response templates that match actual AI provider formats
- Error simulation capabilities for testing error handling

### 9. Integration Points
- AI router (`src/lib/ai/ai-router.ts`)
- AI analysis pipeline (`src/lib/ai/`)
- Report generation services
- Dataset analysis components
- AI Assistant interface
- MCP tool responses (if applicable)

## Acceptance Criteria
- [ ] Mock AI mode can be enabled via environment variable
- [ ] All AI-powered features return mock responses when enabled
- [ ] Response timing simulates real AI processing delays
- [ ] Mock responses are contextually appropriate and realistic
- [ ] Developers can work without external AI API dependencies
- [ ] Mock mode does not affect production builds or deployments
- [ ] Easy switching between mock and real AI modes
- [ ] Consistent responses for automated UI testing
- [ ] Ability to simulate various AI response patterns and errors

## Related Files
- `src/lib/ai/ai-router.ts` - Main AI routing logic
- `src/lib/ai/llmAdapter.ts` - LLM adapter interface
- `src/lib/ai/ai-trace.ts` - AI interaction tracing
- `src/lib/ai/prompt-library/` - Prompt templates
- `src/lib/data/queryEngine.ts` - Query execution and analysis
- `src/app/api/analyze/route.ts` - Analysis API endpoint
- `src/app/api/chat/route.ts` - Chat API endpoint
- `src/app/api/query/route.ts` - Query API endpoint

## Dependencies
- None required (uses existing JSON and file system capabilities)
- Optional: `js-yaml` or similar for YAML mock templates if preferred

## Notes
- Mock responses should be realistic but clearly identifiable as mock in development
- Consider adding visual indicators in UI when mock mode is active
- Ensure mock mode is automatically disabled in production builds
- Consider implementing response caching for improved dev performance