/**
 * Offline Queue Hook for UseClevr
 * 
 * Manages offline question queue with IndexedDB persistence
 * and automatic sync when back online.
 */

import { useState, useEffect, useCallback } from 'react';

interface QueuedQuestion {
  id: string;
  datasetId: string;
  question: string;
  timestamp: number;
  synced: boolean;
}

interface OfflineQueueResult {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  queueQuestion: (datasetId: string, question: string) => void;
  clearQueue: () => void;
}

// IndexedDB database name
const DB_NAME = 'useclevr-offline';
const STORE_NAME = 'question-queue';
const DB_VERSION = 1;

/**
 * Open IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Add question to offline queue
 */
async function addToQueue(question: QueuedQuestion): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(question);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all queued questions
 */
async function getQueuedQuestions(): Promise<QueuedQuestion[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove question from queue
 */
async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear entire queue
 */
async function clearQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Cache dataset for offline access
 */
const DATASET_CACHE_NAME = 'useclevr-datasets';
const MAX_CACHED_DATASETS = 5;

interface CachedDataset {
  id: string;
  name: string;
  columns: string[];
  data: any[];
  cachedAt: number;
}

export async function cacheDataset(dataset: CachedDataset): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(['datasets'], 'readwrite');
    const store = transaction.objectStore('datasets');
    
    // Get existing cached datasets
    const getRequest = store.getAll();
    getRequest.onsuccess = async () => {
      let cached = getRequest.result || [];
      
      // Remove oldest if over limit
      if (cached.length >= MAX_CACHED_DATASETS) {
        cached.sort((a: CachedDataset, b: CachedDataset) => a.cachedAt - b.cachedAt);
        const toRemove = cached.slice(0, cached.length - MAX_CACHED_DATASETS + 1);
        for (const ds of toRemove) {
          store.delete(ds.id);
        }
      }
      
      // Add/update dataset
      store.put(dataset);
    };
  } catch (error) {
    console.warn('[OFFLINE] Failed to cache dataset:', error);
  }
}

export async function getCachedDataset(datasetId: string): Promise<CachedDataset | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['datasets'], 'readonly');
      const store = transaction.objectStore('datasets');
      const request = store.get(datasetId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[OFFLINE] Failed to get cached dataset:', error);
    return null;
  }
}

/**
 * Hook for managing offline queue
 */
export function useOfflineQueue(): OfflineQueueResult {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check online status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => {
      setIsOnline(true);
      syncQueue();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load pending count on mount
  useEffect(() => {
    loadPendingCount();
  }, []);

  // Load pending count from IndexedDB
  async function loadPendingCount() {
    try {
      const questions = await getQueuedQuestions();
      setPendingCount(questions.filter(q => !q.synced).length);
    } catch (error) {
      console.warn('[OFFLINE] Failed to load pending count:', error);
    }
  }

  // Sync queue when back online
  async function syncQueue() {
    if (isSyncing || !isOnline) return;
    
    setIsSyncing(true);
    
    try {
      const questions = await getQueuedQuestions();
      const unsynced = questions.filter(q => !q.synced);
      
      for (const q of unsynced) {
        try {
          const response = await fetch('/api/insight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              datasetId: q.datasetId,
              question: q.question
            }),
          });
          
          if (response.ok) {
            await removeFromQueue(q.id);
          }
        } catch (error) {
          console.warn('[OFFLINE] Failed to sync question:', q.id);
        }
      }
      
      await loadPendingCount();
    } catch (error) {
      console.warn('[OFFLINE] Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }

  // Add question to queue
  const queueQuestion = useCallback((datasetId: string, question: string) => {
    const queued: QueuedQuestion = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      datasetId,
      question,
      timestamp: Date.now(),
      synced: false
    };
    
    addToQueue(queued).then(() => {
      setPendingCount(prev => prev + 1);
      
      // If online, sync immediately
      if (navigator.onLine) {
        syncQueue();
      }
    });
  }, [isOnline, isSyncing]);

  // Clear queue
  const clearQueueFn = useCallback(() => {
    clearQueue().then(() => {
      setPendingCount(0);
    });
  }, []);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    queueQuestion,
    clearQueue: clearQueueFn
  };
}
