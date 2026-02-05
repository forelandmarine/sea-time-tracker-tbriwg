
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const API_BASE_URL = Constants.expoConfig?.extra?.backendUrl || '';

const VESSEL_QUERY_INTERVAL = 5 * 60 * 1000; // 5 minutes
const LAST_QUERY_TIME_PREFIX = 'last_query_time_';

// ========== DATA CACHE ==========
// Aggressive caching to prevent redundant API calls
const DATA_CACHE: {
  vessels?: { data: any; timestamp: number };
  profile?: { data: any; timestamp: number };
  summary?: { data: any; timestamp: number };
  entries?: { data: any; timestamp: number };
} = {};

const CACHE_DURATION = 60 * 1000; // 60 seconds cache - increased for better performance

// ========== REQUEST DEDUPLICATION ==========
// Prevent duplicate simultaneous requests
const PENDING_REQUESTS: Map<string, Promise<any>> = new Map();

function getCachedData(key: string): any | null {
  const cached = DATA_CACHE[key as keyof typeof DATA_CACHE];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`[seaTimeApi] Using cached ${key} (age: ${Math.floor((Date.now() - cached.timestamp) / 1000)}s)`);
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any): void {
  DATA_CACHE[key as keyof typeof DATA_CACHE] = {
    data,
    timestamp: Date.now(),
  };
  console.log(`[seaTimeApi] Cached ${key} for ${CACHE_DURATION / 1000}s`);
}

export function clearCache(): void {
  Object.keys(DATA_CACHE).forEach(key => {
    delete DATA_CACHE[key as keyof typeof DATA_CACHE];
  });
  console.log('[seaTimeApi] Cache cleared');
}

function normalizeVessel(vessel: any) {
  return {
    id: vessel.id,
    mmsi: vessel.mmsi,
    vessel_name: vessel.vessel_name,
    is_active: vessel.is_active,
    created_at: vessel.created_at,
    flag: vessel.flag || undefined,
    official_number: vessel.official_number || undefined,
    vessel_type: vessel.vessel_type || undefined,
    length_metres: vessel.length_metres || undefined,
    gross_tonnes: vessel.gross_tonnes || undefined,
    callsign: vessel.callsign || undefined,
    engine_kilowatts: vessel.engine_kilowatts || undefined,
    engine_type: vessel.engine_type || undefined,
  };
}

async function getLastQueryTime(vesselId: string): Promise<Date | null> {
  try {
    const key = `${LAST_QUERY_TIME_PREFIX}${vesselId}`;
    const timeStr = Platform.OS === 'web'
      ? localStorage.getItem(key)
      : await AsyncStorage.getItem(key);
    
    return timeStr ? new Date(timeStr) : null;
  } catch (error) {
    console.error('[seaTimeApi] Failed to get last query time:', error);
    return null;
  }
}

async function setLastQueryTime(vesselId: string, time: Date): Promise<void> {
  try {
    const key = `${LAST_QUERY_TIME_PREFIX}${vesselId}`;
    const timeStr = time.toISOString();
    
    if (Platform.OS === 'web') {
      localStorage.setItem(key, timeStr);
    } else {
      await AsyncStorage.setItem(key, timeStr);
    }
  } catch (error) {
    console.error('[seaTimeApi] Failed to set last query time:', error);
  }
}

async function shouldQueryVessel(vesselId: string, forceRefresh: boolean): Promise<boolean> {
  if (forceRefresh) {
    return true;
  }
  
  const lastQueryTime = await getLastQueryTime(vesselId);
  if (!lastQueryTime) {
    return true;
  }
  
  const timeSinceLastQuery = Date.now() - lastQueryTime.getTime();
  return timeSinceLastQuery >= VESSEL_QUERY_INTERVAL;
}

async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem('seatime_auth_token');
    }
    return await SecureStore.getItemAsync('seatime_auth_token');
  } catch (error) {
    console.error('[seaTimeApi] Failed to get auth token:', error);
    return null;
  }
}

async function getApiHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

function getFetchOptions(method: string = 'GET'): RequestInit {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

// ========== OPTIMIZED API CALLS WITH CACHING & DEDUPLICATION ==========

export async function getVessels(): Promise<any[]> {
  const cacheKey = 'vessels';
  
  // Check cache first
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  
  // Check for pending request
  if (PENDING_REQUESTS.has(cacheKey)) {
    console.log('[seaTimeApi] Deduplicating vessels request');
    return PENDING_REQUESTS.get(cacheKey)!;
  }
  
  const requestPromise = (async () => {
    try {
      console.log('[seaTimeApi] Fetching vessels from API');
      const headers = await getApiHeaders();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout - reduced for faster loading
      
      const response = await fetch(`${API_BASE_URL}/api/vessels`, {
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch vessels');
      }
      
      const data = await response.json();
      const vessels = data.map(normalizeVessel);
      
      setCachedData(cacheKey, vessels);
      return vessels;
    } catch (error: any) {
      console.error('[seaTimeApi] Failed to fetch vessels:', error.message);
      throw error;
    } finally {
      PENDING_REQUESTS.delete(cacheKey);
    }
  })();
  
  PENDING_REQUESTS.set(cacheKey, requestPromise);
  return requestPromise;
}

export async function getUserProfile(): Promise<any> {
  const cacheKey = 'profile';
  
  // Check cache first
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  
  // Check for pending request
  if (PENDING_REQUESTS.has(cacheKey)) {
    console.log('[seaTimeApi] Deduplicating profile request');
    return PENDING_REQUESTS.get(cacheKey)!;
  }
  
  const requestPromise = (async () => {
    try {
      console.log('[seaTimeApi] Fetching user profile from API');
      const headers = await getApiHeaders();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
      
      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch profile');
      }
      
      const data = await response.json();
      setCachedData(cacheKey, data);
      return data;
    } catch (error: any) {
      console.error('[seaTimeApi] Failed to fetch profile:', error.message);
      throw error;
    } finally {
      PENDING_REQUESTS.delete(cacheKey);
    }
  })();
  
  PENDING_REQUESTS.set(cacheKey, requestPromise);
  return requestPromise;
}

export async function getReportSummary(): Promise<any> {
  const cacheKey = 'summary';
  
  // Check cache first
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  
  // Check for pending request
  if (PENDING_REQUESTS.has(cacheKey)) {
    console.log('[seaTimeApi] Deduplicating summary request');
    return PENDING_REQUESTS.get(cacheKey)!;
  }
  
  const requestPromise = (async () => {
    try {
      console.log('[seaTimeApi] Fetching report summary from API');
      const headers = await getApiHeaders();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
      
      const response = await fetch(`${API_BASE_URL}/api/reports/summary`, {
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch summary');
      }
      
      const data = await response.json();
      setCachedData(cacheKey, data);
      return data;
    } catch (error: any) {
      console.error('[seaTimeApi] Failed to fetch summary:', error.message);
      throw error;
    } finally {
      PENDING_REQUESTS.delete(cacheKey);
    }
  })();
  
  PENDING_REQUESTS.set(cacheKey, requestPromise);
  return requestPromise;
}

export async function getSeaTimeEntries(): Promise<any[]> {
  const cacheKey = 'entries';
  
  // Check cache first
  const cached = getCachedData(cacheKey);
  if (cached) return cached;
  
  // Check for pending request
  if (PENDING_REQUESTS.has(cacheKey)) {
    console.log('[seaTimeApi] Deduplicating entries request');
    return PENDING_REQUESTS.get(cacheKey)!;
  }
  
  const requestPromise = (async () => {
    try {
      console.log('[seaTimeApi] Fetching sea time entries from API');
      const headers = await getApiHeaders();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
      
      const response = await fetch(`${API_BASE_URL}/api/sea-time`, {
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch entries');
      }
      
      const data = await response.json();
      setCachedData(cacheKey, data);
      return data;
    } catch (error: any) {
      console.error('[seaTimeApi] Failed to fetch entries:', error.message);
      throw error;
    } finally {
      PENDING_REQUESTS.delete(cacheKey);
    }
  })();
  
  PENDING_REQUESTS.set(cacheKey, requestPromise);
  return requestPromise;
}

// ========== NON-CACHED API CALLS (mutations) ==========

export async function createVessel(
  mmsi: string,
  vessel_name: string,
  is_active: boolean = false,
  flag?: string,
  official_number?: string,
  vessel_type?: string,
  length_metres?: number,
  gross_tonnes?: number,
  callsign?: string,
  engine_kilowatts?: number,
  engine_type?: string
): Promise<any> {
  try {
    console.log('[seaTimeApi] Creating vessel:', vessel_name);
    const headers = await getApiHeaders();
    
    const response = await fetch(`${API_BASE_URL}/api/vessels`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mmsi,
        vessel_name,
        is_active,
        flag,
        official_number,
        vessel_type,
        length_metres,
        gross_tonnes,
        callsign,
        engine_kilowatts,
        engine_type,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create vessel');
    }
    
    const data = await response.json();
    clearCache(); // Clear cache after mutation
    return normalizeVessel(data);
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to create vessel:', error.message);
    throw error;
  }
}

export async function activateVessel(vesselId: string): Promise<void> {
  try {
    console.log('[seaTimeApi] Activating vessel:', vesselId);
    const headers = await getApiHeaders();
    
    const response = await fetch(`${API_BASE_URL}/api/vessels/${vesselId}/activate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to activate vessel');
    }
    
    clearCache(); // Clear cache after mutation
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to activate vessel:', error.message);
    throw error;
  }
}

export async function deleteVessel(vesselId: string): Promise<void> {
  try {
    console.log('[seaTimeApi] Deleting vessel:', vesselId);
    const headers = await getApiHeaders();
    
    // Remove Content-Type for DELETE requests
    const headersWithoutContentType: any = { ...headers };
    delete headersWithoutContentType['Content-Type'];
    
    const response = await fetch(`${API_BASE_URL}/api/vessels/${vesselId}`, {
      method: 'DELETE',
      headers: headersWithoutContentType,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete vessel');
    }
    
    clearCache(); // Clear cache after mutation
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to delete vessel:', error.message);
    throw error;
  }
}

export async function getVesselAISLocation(vesselId: string, extended: boolean = false): Promise<any> {
  try {
    console.log('[seaTimeApi] Fetching AIS location for vessel:', vesselId);
    const headers = await getApiHeaders();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout for AIS
    
    const response = await fetch(`${API_BASE_URL}/api/ais/vessel/${vesselId}?extended=${extended}`, {
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch AIS location');
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to fetch AIS location:', error.message);
    throw error;
  }
}

export async function checkVesselAIS(vesselId: string, forceRefresh: boolean = false): Promise<any> {
  try {
    const shouldQuery = await shouldQueryVessel(vesselId, forceRefresh);
    
    if (!shouldQuery) {
      console.log('[seaTimeApi] Skipping AIS check - queried recently');
      return null;
    }
    
    console.log('[seaTimeApi] Checking vessel AIS:', vesselId);
    const headers = await getApiHeaders();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for AIS check
    
    const response = await fetch(`${API_BASE_URL}/api/ais/check/${vesselId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to check AIS');
    }
    
    await setLastQueryTime(vesselId, new Date());
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to check AIS:', error.message);
    throw error;
  }
}

export async function downloadPDFReport(): Promise<Blob> {
  try {
    console.log('[seaTimeApi] Downloading PDF report');
    const headers = await getApiHeaders();
    
    const response = await fetch(`${API_BASE_URL}/api/reports/pdf`, {
      headers,
    });
    
    if (!response.ok) {
      throw new Error('Failed to download PDF report');
    }
    
    return await response.blob();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to download PDF:', error.message);
    throw error;
  }
}

export async function downloadCSVReport(): Promise<string> {
  try {
    console.log('[seaTimeApi] Downloading CSV report');
    const headers = await getApiHeaders();
    
    const response = await fetch(`${API_BASE_URL}/api/reports/csv`, {
      headers,
    });
    
    if (!response.ok) {
      throw new Error('Failed to download CSV report');
    }
    
    return await response.text();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to download CSV:', error.message);
    throw error;
  }
}

// ========== SEA TIME ENTRY MANAGEMENT ==========

export async function getPendingEntries(): Promise<any[]> {
  try {
    console.log('[seaTimeApi] Fetching pending entries');
    const headers = await getApiHeaders();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(`${API_BASE_URL}/api/sea-time/pending`, {
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch pending entries');
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to fetch pending entries:', error.message);
    throw error;
  }
}

export async function getNewSeaTimeEntries(since?: string): Promise<any> {
  try {
    console.log('[seaTimeApi] Fetching new sea time entries');
    const headers = await getApiHeaders();
    
    const url = since 
      ? `${API_BASE_URL}/api/sea-time/new-entries?since=${encodeURIComponent(since)}`
      : `${API_BASE_URL}/api/sea-time/new-entries`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch new entries');
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to fetch new entries:', error.message);
    throw error;
  }
}

export async function confirmSeaTimeEntry(entryId: string, notes?: string, serviceType?: string): Promise<any> {
  try {
    console.log('[seaTimeApi] Confirming sea time entry:', entryId);
    const headers = await getApiHeaders();
    
    const response = await fetch(`${API_BASE_URL}/api/sea-time/${entryId}/confirm`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ notes, service_type: serviceType }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to confirm entry');
    }
    
    clearCache(); // Clear cache after mutation
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to confirm entry:', error.message);
    throw error;
  }
}

export async function rejectSeaTimeEntry(entryId: string, notes?: string): Promise<any> {
  try {
    console.log('[seaTimeApi] Rejecting sea time entry:', entryId);
    const headers = await getApiHeaders();
    
    const response = await fetch(`${API_BASE_URL}/api/sea-time/${entryId}/reject`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ notes }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to reject entry');
    }
    
    clearCache(); // Clear cache after mutation
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to reject entry:', error.message);
    throw error;
  }
}

export async function updateSeaTimeEntry(entryId: string, updates: { sea_days?: number; notes?: string; service_type?: string }): Promise<any> {
  try {
    console.log('[seaTimeApi] Updating sea time entry:', entryId);
    const headers = await getApiHeaders();
    
    const response = await fetch(`${API_BASE_URL}/api/sea-time/${entryId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update entry');
    }
    
    clearCache(); // Clear cache after mutation
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to update entry:', error.message);
    throw error;
  }
}

export async function deleteSeaTimeEntry(entryId: string): Promise<void> {
  try {
    console.log('[seaTimeApi] Deleting sea time entry:', entryId);
    const headers = await getApiHeaders();
    
    // Remove Content-Type for DELETE requests
    const headersWithoutContentType: any = { ...headers };
    delete headersWithoutContentType['Content-Type'];
    
    const response = await fetch(`${API_BASE_URL}/api/sea-time/${entryId}`, {
      method: 'DELETE',
      headers: headersWithoutContentType,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete entry');
    }
    
    clearCache(); // Clear cache after mutation
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to delete entry:', error.message);
    throw error;
  }
}

export async function createManualSeaTimeEntry(data: {
  vessel_id: string;
  start_time: string;
  end_time?: string;
  sea_days?: number;
  service_type?: string;
  notes?: string;
  start_latitude?: number;
  start_longitude?: number;
  end_latitude?: number;
  end_longitude?: number;
}): Promise<any> {
  try {
    console.log('[seaTimeApi] Creating manual sea time entry');
    const headers = await getApiHeaders();
    
    const response = await fetch(`${API_BASE_URL}/api/logbook/manual-entry`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create entry');
    }
    
    clearCache(); // Clear cache after mutation
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to create manual entry:', error.message);
    throw error;
  }
}

export async function getSeaTimeEntry(entryId: string): Promise<any> {
  try {
    console.log('[seaTimeApi] Fetching sea time entry:', entryId);
    const headers = await getApiHeaders();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    // Get all entries and find the specific one
    const response = await fetch(`${API_BASE_URL}/api/sea-time`, {
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch entry');
    }
    
    const entries = await response.json();
    const entry = entries.find((e: any) => e.id === entryId);
    
    if (!entry) {
      throw new Error('Entry not found');
    }
    
    return entry;
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to fetch entry:', error.message);
    throw error;
  }
}

// ========== VESSEL MANAGEMENT ==========

export async function getVesselSeaTime(vesselId: string): Promise<any[]> {
  try {
    console.log('[seaTimeApi] Fetching sea time for vessel:', vesselId);
    const headers = await getApiHeaders();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(`${API_BASE_URL}/api/vessels/${vesselId}/sea-time`, {
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch vessel sea time');
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to fetch vessel sea time:', error.message);
    throw error;
  }
}

export async function updateVesselParticulars(vesselId: string, updates: {
  vessel_name?: string;
  callsign?: string;
  flag?: string;
  official_number?: string;
  type?: 'Motor' | 'Sail';
  length_metres?: number;
  gross_tonnes?: number;
  engine_kilowatts?: number;
  engine_type?: string;
}): Promise<any> {
  try {
    console.log('[seaTimeApi] Updating vessel particulars:', vesselId);
    const headers = await getApiHeaders();
    
    const response = await fetch(`${API_BASE_URL}/api/vessels/${vesselId}/particulars`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update vessel particulars');
    }
    
    clearCache(); // Clear cache after mutation
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to update vessel particulars:', error.message);
    throw error;
  }
}

// ========== USER PROFILE ==========

export async function updateUserProfile(updates: {
  name?: string;
  email?: string;
  address?: string;
  tel_no?: string;
  date_of_birth?: string;
  srb_no?: string;
  nationality?: string;
  pya_membership_no?: string;
  department?: 'deck' | 'engineering';
}): Promise<any> {
  try {
    console.log('[seaTimeApi] Updating user profile');
    const headers = await getApiHeaders();
    
    const response = await fetch(`${API_BASE_URL}/api/profile`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update profile');
    }
    
    clearCache(); // Clear cache after mutation
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to update profile:', error.message);
    throw error;
  }
}

export async function uploadProfileImage(imageUri: string): Promise<any> {
  try {
    console.log('[seaTimeApi] Uploading profile image');
    const token = await getAuthToken();
    
    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'profile.jpg',
    } as any);
    
    const response = await fetch(`${API_BASE_URL}/api/profile/upload-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to upload image');
    }
    
    clearCache(); // Clear cache after mutation
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to upload image:', error.message);
    throw error;
  }
}

// ========== NOTIFICATIONS ==========

export async function getNotificationSchedule(): Promise<any> {
  try {
    console.log('[seaTimeApi] Fetching notification schedule');
    const headers = await getApiHeaders();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(`${API_BASE_URL}/api/notifications/schedule`, {
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch notification schedule');
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to fetch notification schedule:', error.message);
    throw error;
  }
}

export async function updateNotificationSchedule(updates: {
  scheduled_time?: string;
  timezone?: string;
  is_active?: boolean;
}): Promise<any> {
  try {
    console.log('[seaTimeApi] Updating notification schedule');
    const headers = await getApiHeaders();
    
    const response = await fetch(`${API_BASE_URL}/api/notifications/schedule`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update notification schedule');
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to update notification schedule:', error.message);
    throw error;
  }
}

// ========== SCHEDULED TASKS ==========

export async function getScheduledTasks(): Promise<any[]> {
  try {
    console.log('[seaTimeApi] Fetching scheduled tasks');
    const headers = await getApiHeaders();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(`${API_BASE_URL}/api/ais/scheduled-tasks`, {
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch scheduled tasks');
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to fetch scheduled tasks:', error.message);
    throw error;
  }
}

export async function toggleScheduledTask(taskId: string, isActive: boolean): Promise<any> {
  try {
    console.log('[seaTimeApi] Toggling scheduled task:', taskId, isActive);
    const headers = await getApiHeaders();
    
    const response = await fetch(`${API_BASE_URL}/api/ais/scheduled-tasks/${taskId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ is_active: isActive }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to toggle task');
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to toggle task:', error.message);
    throw error;
  }
}

// ========== DEBUG ==========

export async function getAISDebugLogs(vesselId: string, limit: number = 50): Promise<any[]> {
  try {
    console.log('[seaTimeApi] Fetching AIS debug logs for vessel:', vesselId);
    const headers = await getApiHeaders();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${API_BASE_URL}/api/ais/debug/${vesselId}?limit=${limit}`, {
      headers,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch debug logs');
    }
    
    return await response.json();
  } catch (error: any) {
    console.error('[seaTimeApi] Failed to fetch debug logs:', error.message);
    throw error;
  }
}
