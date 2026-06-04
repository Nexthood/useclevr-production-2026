import { debugError, debugLog } from "@/lib/utils/debug";
import { generateMockAICompletion, isMockAIMode, streamMockAICompletion } from "@/lib/ai/mock-ai";

/**
 * Antigravity Server Client
 *
 * Connects to local Antigravity proxy server for LLM inference.
 * Supports multiple cloud AI providers: Gemini, Claude, GPT, etc.
 */

const ANTIGRAVITY_BASE_URL = process.env.ANTIGRAVITY_BASE_URL || "http://127.0.0.1:8317";
const ANTIGRAVITY_API_KEY = process.env.ANTIGRAVITY_API_KEY || process.env.GEMINI_API_KEY;

export interface AntigravityModel {
  id: string;
  object: string;
  owned_by: string;
  created?: number;
}

export interface AntigravityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AntigravityRequest {
  model: string;
  messages: AntigravityMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface AntigravityResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Fetch available models from Antigravity server
 */
export async function fetchAntigravityModels(): Promise<AntigravityModel[]> {
  if (!ANTIGRAVITY_API_KEY) {
    throw new Error(
      "Antigravity API key not configured. Set ANTIGRAVITY_API_KEY or GEMINI_API_KEY environment variable."
    );
  }

  try {
    const response = await fetch(`${ANTIGRAVITY_BASE_URL}/v1/models`, {
      headers: {
        Authorization: `Bearer ${ANTIGRAVITY_API_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch models: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as { data: AntigravityModel[] };
    return data.data;
  } catch (error) {
    debugError("[Antigravity] Error fetching models:", error);
    throw error;
  }
}

/**
 * Send a request to Antigravity for LLM completion
 */
export async function generateAntigravityCompletion(
  request: AntigravityRequest
): Promise<string> {
  if (isMockAIMode()) {
    debugLog("[Antigravity] Mock AI mode enabled")
    return generateMockAICompletion({ messages: request.messages })
  }

  if (!ANTIGRAVITY_API_KEY) {
    throw new Error(
      "Antigravity API key not configured. Set ANTIGRAVITY_API_KEY or GEMINI_API_KEY environment variable."
    );
  }

  try {
    debugLog("[Antigravity] Sending request to", ANTIGRAVITY_BASE_URL, "with model:", request.model);

    const response = await fetch(`${ANTIGRAVITY_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANTIGRAVITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.max_tokens ?? 1000,
        stream: request.stream ?? false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      debugError("[Antigravity] Error response:", response.status, error);
      throw new Error(`Antigravity API error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as AntigravityResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in Antigravity response");
    }

    debugLog("[Antigravity] Response received, tokens:", data.usage?.total_tokens);
    return content;
  } catch (error) {
    debugError("[Antigravity] Error generating completion:", error);
    throw error;
  }
}

/**
 * Stream a completion from Antigravity, yielding content chunks via a ReadableStream
 */
export function generateAntigravityStream(
  request: AntigravityRequest
): ReadableStream<string> {
  if (isMockAIMode()) {
    debugLog("[Antigravity] Mock AI stream enabled")
    return streamMockAICompletion({ messages: request.messages })
  }

  const apiKey = ANTIGRAVITY_API_KEY;
  if (!apiKey) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(JSON.stringify({ error: 'AI service not configured. Please contact support.' }));
        controller.close();
      }
    });
  }

  return new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(`${ANTIGRAVITY_BASE_URL}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            temperature: request.temperature ?? 0.3,
            max_tokens: request.max_tokens ?? 1000,
            stream: true,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          controller.enqueue(JSON.stringify({ error: `Antigravity API error: ${response.status} - ${error}` }));
          controller.close();
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          controller.enqueue(JSON.stringify({ error: 'No response body stream' }));
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              controller.enqueue(JSON.stringify({ done: true }));
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(content);
              }
            } catch {
              // skip malformed JSON chunks
            }
          }
        }

        controller.enqueue(JSON.stringify({ done: true }));
        controller.close();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown streaming error';
        controller.enqueue(JSON.stringify({ error: msg }));
        controller.close();
      }
    },
  });
}

/**
 * Check if Antigravity server is available
 */
export async function checkAntigravityAvailability(): Promise<boolean> {
  try {
    const models = await fetchAntigravityModels();
    const available = models.length > 0;
    debugLog("[Antigravity] Server available:", available);
    return available;
  } catch (error) {
    debugError("[Antigravity] Server not available:", error);
    return false;
  }
}

/**
 * Get the Antigravity base URL (for testing/debugging)
 */
export function getAntigravityBaseUrl(): string {
  return ANTIGRAVITY_BASE_URL;
}

/**
 * Get available Gemini models from Antigravity
 */
export async function getAvailableGeminiModels(): Promise<string[]> {
  try {
    const models = await fetchAntigravityModels();
    return models
      .filter((m) => m.id.startsWith("gemini"))
      .map((m) => m.id);
  } catch {
    return ["gemini-2.5-flash", "gemini-2.5-pro"];
  }
}

/**
 * Get the best available Gemini model from Antigravity
 * Prefers faster, more efficient models by default
 */
export async function getBestGeminiModel(): Promise<string> {
  try {
    const models = await getAvailableGeminiModels();
    // Prefer flash models (faster) over pro models
    const flash = models.find((m) => m.includes("flash"));
    if (flash) return flash;
    return models[0] || "gemini-2.5-flash";
  } catch {
    return "gemini-2.5-flash";
  }
}
