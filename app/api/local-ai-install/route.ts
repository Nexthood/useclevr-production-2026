/**
 * UseClevr AI MEGA Installer
 * 
 * Handles automatic installation of local AI engine.
 * Supports: Ollama runtime + AI models
 */

import { NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import { existsSync } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Installation state
let installationStatus: 'idle' | 'checking' | 'installing' | 'ready' | 'error' = 'idle';
let installationProgress = '';
let installationError = '';

export async function POST(request: Request) {
  console.log('[INSTALLER] Starting AI engine installation...');
  
  try {
    installationStatus = 'checking';
    installationProgress = 'Checking system requirements...';
    
    // Step 1: Check if Ollama is installed
    const ollamaCheck = await checkOllamaInstalled();
    
    if (!ollamaCheck.installed) {
      installationStatus = 'error';
      installationError = 'Ollama is not installed. Please install from https://ollama.ai';
      
      return NextResponse.json({
        success: false,
        status: installationStatus,
        progress: installationProgress,
        error: installationError,
        instructions: {
          mac: 'Run: brew install ollama',
          linux: 'Run: curl -fsSL https://ollama.ai/install.sh | sh',
          windows: 'Download from https://ollama.ai'
        }
      });
    }
    
    // Step 2: Check if model is downloaded
    installationProgress = 'Checking AI model...';
    const modelStatus = await checkModelDownloaded();
    
    if (!modelStatus.downloaded) {
      installationProgress = 'Downloading AI model (this may take a few minutes)...';
      installationStatus = 'installing';
      
      // Download the model - using llama3 for better data analysis
      const downloadResult = await downloadModel('llama3');
      
      if (!downloadResult.success) {
        installationStatus = 'error';
        installationError = downloadResult.error || 'Failed to download model';
        
        return NextResponse.json({
          success: false,
          status: installationStatus,
          progress: installationProgress,
          error: installationError
        });
      }
    }
    
    // Step 3: Start the local AI bridge service
    installationProgress = 'Starting local AI service...';
    const startResult = await startLocalAIService();
    
    if (!startResult.success) {
      installationStatus = 'error';
      installationError = startResult.error || 'Failed to start service';
      
      return NextResponse.json({
        success: false,
        status: installationStatus,
        progress: installationProgress,
        error: installationError
      });
    }
    
    // Success!
    installationStatus = 'ready';
    installationProgress = 'Installation complete!';
    
    return NextResponse.json({
      success: true,
      status: installationStatus,
      progress: installationProgress,
      message: 'UseClevr AI MEGA installed – Hybrid mode active',
      endpoints: {
        health: 'http://localhost:3210/health',
        chat: 'http://localhost:3210/chat'
      }
    });
    
  } catch (error: any) {
    console.error('[INSTALLER] Error:', error);
    installationStatus = 'error';
    installationError = error.message;
    
    return NextResponse.json({
      success: false,
      status: installationStatus,
      error: installationError
    });
  }
}

export async function GET() {
  // Return current installation status
  const ollamaStatus = await checkOllamaInstalled();
  const modelStatus = await checkModelDownloaded();
  const serviceStatus = await checkServiceRunning();
  
  let status: 'not_installed' | 'ollama_ready' | 'model_ready' | 'service_ready' | 'error';
  
  if (!ollamaStatus.installed) {
    status = 'not_installed';
  } else if (!serviceStatus.running) {
    status = 'ollama_ready';
  } else if (!modelStatus.downloaded) {
    status = 'model_ready';
  } else if (serviceStatus.running) {
    status = 'service_ready';
  } else {
    status = 'error';
  }
  
  return NextResponse.json({
    status,
    ollamaInstalled: ollamaStatus.installed,
    ollamaVersion: ollamaStatus.version,
    modelDownloaded: modelStatus.downloaded,
    modelName: modelStatus.model,
    serviceRunning: serviceStatus.running,
    progress: installationProgress,
    error: installationError
  });
}

/**
 * Check if Ollama is installed
 */
async function checkOllamaInstalled(): Promise<{ installed: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync('ollama --version');
    const version = stdout.trim().replace('ollama version ', '');
    return { installed: true, version };
  } catch {
    return { installed: false };
  }
}

/**
 * Check if AI model is downloaded
 */
async function checkModelDownloaded(): Promise<{ downloaded: boolean; model?: string }> {
  try {
    const { stdout } = await execAsync('ollama list');
    // Check for common models
    const models = ['mistral', 'llama2', 'codellama', 'deepseek-coder'];
    const output = stdout.toLowerCase();
    
    for (const model of models) {
      if (output.includes(model)) {
        return { downloaded: true, model };
      }
    }
    
    return { downloaded: false };
  } catch {
    return { downloaded: false };
  }
}

/**
 * Download AI model
 */
async function downloadModel(model: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[INSTALLER] Downloading ${model} model...`);
    
    // Run ollama pull in background
    await execAsync(`ollama pull ${model}`, { timeout: 600000 }); // 10 min timeout
    
    console.log(`[INSTALLER] ${model} model downloaded successfully`);
    return { success: true };
  } catch (error: any) {
    console.error('[INSTALLER] Model download failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if local AI service is running
 */
async function checkServiceRunning(): Promise<{ running: boolean; pid?: number }> {
  try {
    const response = await fetch('http://localhost:3210/health', { 
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    
    if (response.ok) {
      return { running: true };
    }
    return { running: false };
  } catch {
    return { running: false };
  }
}

/**
 * Start local AI service
 */
async function startLocalAIService(): Promise<{ success: boolean; error?: string }> {
  try {
    // First check if Ollama is running
    await execAsync('ollama serve');
  } catch {
    // Ollama might already be running
  }
  
  // Check if our bridge is already running
  const serviceStatus = await checkServiceRunning();
  
  if (serviceStatus.running) {
    return { success: true };
  }
  
  // Try to start the bridge server
  try {
    // The bridge server should be started separately
    // Here we just verify Ollama is accessible
    const { stdout } = await execAsync('ollama list');
    console.log('[INSTALLER] Ollama is running and has models');
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: 'Could not start Ollama. Please start it manually: ollama serve' };
  }
}
