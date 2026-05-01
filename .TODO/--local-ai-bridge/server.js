/**
 * UseClevr AI MEGA Local Bridge Server
 * 
 * Bridges the dashboard to a local AI model via Ollama.
 * Run with: node local-ai-bridge/server.js
 * 
 * Requirements:
 * - Ollama installed: https://ollama.ai
 * - Start Ollama: ollama serve
 * 
 * Environment:
 * - PORT: Server port (default: 3210)
 * - AI_MODEL: AI model to use (default: mistral)
 */

const http = require('http');
const { spawn } = require('child_process');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3210;
const AI_MODEL = process.env.AI_MODEL || 'llama3';
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';

/**
 * Check if Ollama is running
 */
function checkOllama() {
  try {
    execSync('ollama list', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate AI response using Ollama
 */
async function generateAIResponse(prompt, datasetContext = null) {
  const hasOllama = checkOllama();
  
  if (!hasOllama) {
    return {
      response: `Ollama is not running. Please start it with: ollama serve`,
      model: AI_MODEL,
      ollama: false
    };
  }
  
  // Build the full prompt with context
  let fullPrompt = prompt;
  if (datasetContext) {
    fullPrompt = `Dataset context:\n${JSON.stringify(datasetContext, null, 2)}\n\nUser question: ${prompt}\n\nProvide a concise, helpful answer based on the data.`;
  }
  
  try {
    // Call Ollama API
    const response = await fetch(`${OLLAMA_ENDPOINT}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      response: data.response,
      model: AI_MODEL,
      ollama: true
    };
  } catch (error) {
    console.error('[BRIDGE] Ollama error:', error.message);
    return {
      response: `Error connecting to Ollama: ${error.message}\n\nMake sure Ollama is running with: ollama serve`,
      model: AI_MODEL,
      ollama: false,
      error: error.message
    };
  }
}

/**
 * Health check endpoint
 */
function handleHealth(res) {
  const ollamaAvailable = checkOllama();
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'ok',
    ollama: ollamaAvailable,
    model: AI_MODEL,
    port: PORT
  }));
}

/**
 * Chat endpoint
 */
async function handleChat(req, res) {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      const { prompt, datasetContext } = JSON.parse(body);
      
      if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'prompt is required' }));
        return;
      }
      
      console.log(`[BRIDGE] Processing prompt: ${prompt.substring(0, 50)}...`);
      
      const result = await generateAIResponse(prompt, datasetContext);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      
      console.log(`[BRIDGE] Response generated using ${result.model}`);
    } catch (error) {
      console.error('[BRIDGE] Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

/**
 * Main request handler
 */
function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Route requests
  if (url.pathname === '/health' && req.method === 'GET') {
    return handleHealth(res);
  }
  
  if (url.pathname === '/chat' && req.method === 'POST') {
    return handleChat(req, res);
  }
  
  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

// Create and start server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  const ollamaStatus = checkOllama();
  
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║          UseClevr AI MEGA - Local Bridge Server                 ║
╠═══════════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                         ║
║  AI Model: ${AI_MODEL.padEnd(48)}║
║  Ollama:  ${(ollamaStatus ? 'Available ✓' : 'Not running ✗').padEnd(48)}║
╠═══════════════════════════════════════════════════════════════════╣
║  Endpoints:                                                       ║
║    GET  /health    - Health check                                ║
║    POST /chat      - Send prompt to AI                          ║
╚═══════════════════════════════════════════════════════════════════╝
${ollamaStatus ? '' : `
⚠️  Ollama is not running. To enable AI:
   1. Install Ollama: https://ollama.ai
   2. Start Ollama: ollama serve
   3. Pull a model:  ollama pull mistral
`}
`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[BRIDGE] Shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
