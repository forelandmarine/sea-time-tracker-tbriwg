
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  source: string;
  timestamp: string;
  platform: string;
}

// ✅ FIXED: Changed Array<T> to T[] syntax
let logQueue: LogEntry[] = [];
let isProcessing = false;

const API_BASE_URL = Constants.expoConfig?.extra?.backendUrl || '';

async function processLogQueue() {
  if (isProcessing || logQueue.length === 0) {
    return;
  }

  isProcessing = true;
  const logsToSend = [...logQueue];
  logQueue = [];

  try {
    if (!API_BASE_URL) {
      console.warn('[ErrorLogger] Backend URL not configured, logs not sent');
      return;
    }

    await fetch(`${API_BASE_URL}/api/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ logs: logsToSend }),
    });
  } catch (error) {
    console.error('[ErrorLogger] Failed to send logs:', error);
    // Re-add logs to queue if sending failed
    logQueue = [...logsToSend, ...logQueue];
  } finally {
    isProcessing = false;
  }
}

export function logError(message: string, source: string = 'app') {
  const entry: LogEntry = {
    level: 'error',
    message,
    source,
    timestamp: new Date().toISOString(),
    platform: Platform.OS,
  };

  console.error(`[${source}]`, message);
  logQueue.push(entry);
  
  // Process queue after a short delay to batch logs
  setTimeout(processLogQueue, 1000);
}

export function logWarning(message: string, source: string = 'app') {
  const entry: LogEntry = {
    level: 'warn',
    message,
    source,
    timestamp: new Date().toISOString(),
    platform: Platform.OS,
  };

  console.warn(`[${source}]`, message);
  logQueue.push(entry);
  
  setTimeout(processLogQueue, 1000);
}

export function logInfo(message: string, source: string = 'app') {
  const entry: LogEntry = {
    level: 'info',
    message,
    source,
    timestamp: new Date().toISOString(),
    platform: Platform.OS,
  };

  console.log(`[${source}]`, message);
  logQueue.push(entry);
  
  setTimeout(processLogQueue, 1000);
}
