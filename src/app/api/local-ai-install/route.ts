import { debugError, debugLog } from "@/lib/utils/debug";
import { requireDevelopmentOrSuperAdmin } from "@/lib/auth/require-session";
import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate";

/**
 * UseClevr AI MEGA Installer
 * 
 * Handles automatic installation of local AI engine.
 * Supports: Ollama runtime + AI models
 */

import { exec } from 'child_process';
import { NextResponse } from 'next/server';
import { promisify } from 'util';

const execAsync = promisify(exec);
const DEFAULT_LOCAL_AI_BRIDGE_BASE = 'http://localhost:3210';

function getLocalAIBridgeBase() {
  return (process.env.LOCAL_AI_BRIDGE_BASE_URL || DEFAULT_LOCAL_AI_BRIDGE_BASE).replace(/\/$/, '');
}

function hasConfiguredLocalAIBridge() {
  return Boolean(process.env.LOCAL_AI_BRIDGE_BASE_URL?.trim())
}

// Installation state
let installationStatus: 'idle' | 'checking' | 'installing' | 'ready' | 'error' = 'idle';
let installationProgress = '';
let installationError = '';

export async function POST(_request: Request) {
  const access = await requireDevelopmentOrSuperAdmin()
  if (!access.success) return access.error
  if (!("mode" in access) || access.mode !== "development") {
    const gate = await requireHybridAiFeature("helperRoadmap")
    if (!gate.success) return gate.error
  }

  debugLog('[INSTALLER] Starting AI engine installation...');
  
  try {
    installationStatus = 'checking';
    installationProgress = 'Checking system requirements...';
    
    // Step 1: Check if UseClevr Helper is installed
    const helperCheck = await checkOllamaInstalled();
    
    if (!helperCheck.installed) {
      installationStatus = 'error';
      installationError = 'UseClevr Helper is not installed. Please download and install from the settings page.';
      
      return NextResponse.json({
        success: false,
        status: installationStatus,
        progress: installationProgress,
        error: installationError,
        instructions: {
          mac: 'Download UseClevr Helper from settings',
          linux: 'Download UseClevr Helper from settings',
          windows: 'Download UseClevr Helper from settings'
        }
      });
    }
    
    // Step 2: Check if UseClevr Private AI is set up
    installationProgress = 'Checking Private AI engine...';
    const modelStatus = await checkModelDownloaded();
    
    if (!modelStatus.downloaded) {
      installationProgress = 'Installing Private AI engine (this may take a few minutes)...';
      installationStatus = 'installing';
      
      // Install the model - using llama3 for better data analysis
      const downloadResult = await downloadModel('llama3');
      
      if (!downloadResult.success) {
        installationStatus = 'error';
        installationError = downloadResult.error || 'Private AI engine needs setup';
        
        return NextResponse.json({
          success: false,
          status: installationStatus,
          progress: installationProgress,
          error: installationError
        });
      }
    }
    
    // Step 3: Start the Private AI service
    installationProgress = 'Starting Private AI Engine...';
    const startResult = await startLocalAIService();
    
    if (!startResult.success) {
      installationStatus = 'error';
      installationError = startResult.error || 'Private AI engine is not running';
      
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
      message: 'UseClevr Hybrid AI installed – Private mode active',
      endpoints: {
        health: `${getLocalAIBridgeBase()}/health`,
        chat: `${getLocalAIBridgeBase()}/chat`
      }
    });
    
  } catch (error: any) {
    debugError('[INSTALLER] Error:', error);
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
  const access = await requireDevelopmentOrSuperAdmin()
  if (!access.success) return access.error
  if (!("mode" in access) || access.mode !== "development") {
    const gate = await requireHybridAiFeature("helperRoadmap")
    if (!gate.success) return gate.error
  }

  // Return current installation status
  const helperStatus = await checkOllamaInstalled();
  const modelStatus = await checkModelDownloaded();
  const serviceStatus = await checkServiceRunning();
  
  let status: 'not_installed' | 'helper_ready' | 'model_ready' | 'service_ready' | 'error';
  
  if (!helperStatus.installed) {
    status = 'not_installed';
  } else if (!serviceStatus.running) {
    status = 'helper_ready';
  } else if (!modelStatus.downloaded) {
    status = 'model_ready';
  } else if (serviceStatus.running) {
    status = 'service_ready';
  } else {
    status = 'error';
  }
  
  return NextResponse.json({
    status,
    helperInstalled: helperStatus.installed,
    helperVersion: helperStatus.version,
    modelDownloaded: modelStatus.downloaded,
    modelName: modelStatus.model,
    serviceRunning: serviceStatus.running,
    progress: installationProgress,
    error: installationError
  });
}

/**
 * Check if UseClevr Helper is installed
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
 * Check if Private AI Engine is downloaded
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
 * Install Private AI Engine
 */
async function downloadModel(model: string): Promise<{ success: boolean; error?: string }> {
  try {
    debugLog(`[INSTALLER] Installing ${model} engine...`);
    
    // Install the engine - using llama3 for better data analysis
    await execAsync(`ollama pull ${model}`, { timeout: 600000 }); // 10 min timeout
    
    debugLog(`[INSTALLER] ${model} model downloaded successfully`);
    return { success: true };
  } catch (error: any) {
    debugError('[INSTALLER] Model download failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if Private AI service is running
 */
async function checkServiceRunning(): Promise<{ running: boolean; pid?: number }> {
  if (process.env.NODE_ENV === "production" && !hasConfiguredLocalAIBridge()) {
    return { running: false };
  }

  try {
    const response = await fetch(`${getLocalAIBridgeBase()}/health`, { 
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
 * Start Private AI Engine
 */
async function startLocalAIService(): Promise<{ success: boolean; error?: string }> {
  try {
    // First check if Private AI Engine is running
    await execAsync('ollama serve');
  } catch {
    // Private AI Engine might already be running
  }
  
  // Check if our bridge is already running
  const serviceStatus = await checkServiceRunning();
  
  if (serviceStatus.running) {
    return { success: true };
  }
  
  // Try to start the bridge server
  try {
    // The bridge server should be started separately
    // Here we just verify Private AI Engine is accessible
    await execAsync('ollama list');
    debugLog('[INSTALLER] Private AI Engine is running and has models');
    
    return { success: true };
  } catch {
    return { success: false, error: 'Private AI engine is not running. Please restart the UseClevr Helper.' };
  }
}
