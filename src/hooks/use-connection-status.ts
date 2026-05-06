/**
 * Connection Status Hook
 * 
 * Cloud-first connection detection with health check.
 * Priority: Cloud → Hybrid → Offline
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type ConnectionMode = 'online' | 'hybrid' | 'offline';

interface ConnectionStatus {
  mode: ConnectionMode;
  isChecking: boolean;
  checkConnection: () => Promise<void>;
  isCloudAvailable: boolean;
  isLocalAvailable: boolean;
  latency?: number;
  wasOffline: boolean;
}

// Check if local AI is available
async function checkLocalAI(): Promise<boolean> {
  try {
    const response = await fetch('/api/local-ai-status', {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    if (!response.ok) return false;
    const data: { available?: boolean } = await response.json().catch(() => ({}));
    return Boolean(data.available);
  } catch {
    return false;
  }
}

// Check cloud connection with latency measurement
async function checkCloudConnection(): Promise<{ok: boolean; latency?: number}> {
  const startTime = Date.now();
  try {
    const response = await fetch('/api/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    const latency = Date.now() - startTime;
    return { ok: response.ok, latency };
  } catch {
    return { ok: false };
  }
}

export function useConnectionStatus(): ConnectionStatus {
  const [mode, setMode] = useState<ConnectionMode>('online');
  const [isChecking, setIsChecking] = useState(true);
  const [isCloudAvailable, setIsCloudAvailable] = useState(false);
  const [isLocalAvailable, setIsLocalAvailable] = useState(false);
  const [latency, setLatency] = useState<number | undefined>(undefined);
  const [wasOffline, setWasOffline] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const checkConnection = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setIsChecking(true);
    
    try {
      // First check cloud (default)
      const cloudResult = await checkCloudConnection();
      
      if (!isMountedRef.current) return;
      
      setIsCloudAvailable(cloudResult.ok);
      setLatency(cloudResult.latency);
      
      if (cloudResult.ok) {
        // Cloud is working - determine if it's fast enough
        // Latency > 3000ms means unstable/slow connection
        const isUnstable = cloudResult.latency && cloudResult.latency > 3000;
        
        if (isUnstable) {
          // Check local AI for hybrid mode
          const localOk = await checkLocalAI();
          if (!isMountedRef.current) return;
          setIsLocalAvailable(localOk);
          
          if (localOk) {
            setMode('hybrid');
          } else {
            setMode('offline');
          }
        } else {
          setMode('online');
          setIsLocalAvailable(false);
          setWasOffline(false);
        }
        setIsChecking(false);
        return;
      }
      
      // Cloud failed - check local AI for hybrid mode
      const localOk = await checkLocalAI();
      if (!isMountedRef.current) return;
      setIsLocalAvailable(localOk);
      
      if (localOk) {
        setMode('hybrid');
        setWasOffline(false);
      } else {
        setMode('offline');
        setWasOffline(true);
      }
    } catch {
      if (!isMountedRef.current) return;
      setMode('offline');
      setWasOffline(true);
    } finally {
      if (isMountedRef.current) {
        setIsChecking(false);
      }
    }
  }, []);

  // Initial check on mount
  useEffect(() => {
    isMountedRef.current = true;
    checkConnection();
    
    // Re-check every 5 seconds (as per requirements)
    intervalRef.current = setInterval(checkConnection, 5000);
    
    // Also re-check when coming back online
    const handleOnline = () => {
      if (isMountedRef.current) {
        checkConnection();
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOnline);
    
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOnline);
    };
  }, [checkConnection]);

  return {
    mode,
    isChecking,
    checkConnection,
    isCloudAvailable,
    isLocalAvailable,
    latency,
    wasOffline
  };
}

// Get status message based on mode
export function getConnectionMessage(mode: ConnectionMode): string {
  switch (mode) {
    case 'online':
      return 'Analyzing with UseClevr AI';
    case 'hybrid':
      return 'Connection unstable – switching to hybrid mode';
    case 'offline':
      return 'Offline mode active – analyzing locally';
    default:
      return 'Checking connection...';
  }
}

// Get status description based on mode
export function getConnectionDescription(mode: ConnectionMode): string {
  switch (mode) {
    case 'online':
      return 'Using cloud AI for analysis';
    case 'hybrid':
      return 'Using local AI for faster analysis';
    case 'offline':
      return 'Using local AI for offline analysis';
    default:
      return '';
  }
}
