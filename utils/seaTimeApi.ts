
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = Constants.expoConfig?.extra?.backendUrl || 'https://uukpkcag4nsq8q632k643ztvus28frfe.app.specular.dev';
const STORAGE_KEY_API_KEY = '@myshiptracking_api_key';
const STORAGE_KEY_API_URL = '@myshiptracking_api_url';

export interface Vessel {
  id: string;
  mmsi: string;
  vessel_name: string;
  created_at: string;
}

export interface SeaTimeEntry {
  id: string;
  vessel: Vessel;
  start_time: string;
  end_time: string | null;
  duration_hours: number | null;
  status: 'pending' | 'confirmed' | 'rejected';
  notes: string | null;
  created_at: string;
}

export interface AISCheckResult {
  check_id: string;
  is_moving: boolean;
  speed_knots: number;
  latitude: number;
  longitude: number;
  sea_time_entry_created: boolean;
}

export interface ReportSummary {
  total_hours: number;
  total_days: number;
  entries_by_vessel: {
    vessel_name: string;
    total_hours: number;
  }[];
  entries_by_month: {
    month: string;
    total_hours: number;
  }[];
}

// Helper function to get API configuration headers
async function getApiHeaders(): Promise<HeadersInit> {
  const apiKey = await AsyncStorage.getItem(STORAGE_KEY_API_KEY);
  const apiUrl = await AsyncStorage.getItem(STORAGE_KEY_API_URL);
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  // Add MyShipTracking API credentials if available
  if (apiKey) {
    headers['X-MyShipTracking-API-Key'] = apiKey;
  }
  if (apiUrl) {
    headers['X-MyShipTracking-API-URL'] = apiUrl;
  }
  
  return headers;
}

// Vessel Management
export async function getVessels(): Promise<Vessel[]> {
  const url = `${API_BASE_URL}/api/vessels`;
  console.log('[API] Fetching vessels:', url);
  const headers = await getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch vessels:', response.status, errorText);
    throw new Error('Failed to fetch vessels');
  }
  const data = await response.json();
  console.log('[API] Vessels fetched:', data.length);
  return data;
}

export async function createVessel(mmsi: string, vessel_name: string): Promise<Vessel> {
  const url = `${API_BASE_URL}/api/vessels`;
  console.log('[API] Creating vessel:', { mmsi, vessel_name });
  const headers = await getApiHeaders();
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ mmsi, vessel_name }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to create vessel:', response.status, errorText);
    throw new Error('Failed to create vessel');
  }
  const data = await response.json();
  console.log('[API] Vessel created:', data);
  return data;
}

export async function deleteVessel(vesselId: string): Promise<{ success: boolean }> {
  const url = `${API_BASE_URL}/api/vessels/${vesselId}`;
  console.log('[API] Deleting vessel:', vesselId);
  const headers = await getApiHeaders();
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to delete vessel:', response.status, errorText);
    throw new Error('Failed to delete vessel');
  }
  const data = await response.json();
  console.log('[API] Vessel deleted:', data);
  return data;
}

// AIS Tracking
export async function checkVesselAIS(vesselId: string): Promise<AISCheckResult> {
  const url = `${API_BASE_URL}/api/ais/check/${vesselId}`;
  console.log('[API] Checking vessel AIS:', vesselId);
  const headers = await getApiHeaders();
  const response = await fetch(url, {
    method: 'POST',
    headers,
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to check vessel AIS:', response.status, errorText);
    
    // Provide more helpful error messages
    if (response.status === 500 && errorText.includes('API key not configured')) {
      throw new Error('MyShipTracking API key not configured. Please add your API key in Settings.');
    }
    if (response.status === 502) {
      throw new Error('Failed to connect to MyShipTracking API. Please check your API settings.');
    }
    
    throw new Error('Failed to check vessel AIS');
  }
  const data = await response.json();
  console.log('[API] AIS check result:', data);
  return data;
}

// Sea Time Management
export async function getSeaTimeEntries(): Promise<SeaTimeEntry[]> {
  const url = `${API_BASE_URL}/api/sea-time`;
  console.log('[API] Fetching sea time entries:', url);
  const headers = await getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch sea time entries:', response.status, errorText);
    throw new Error('Failed to fetch sea time entries');
  }
  const data = await response.json();
  console.log('[API] Sea time entries fetched:', data.length);
  return data;
}

export async function getPendingEntries(): Promise<SeaTimeEntry[]> {
  const url = `${API_BASE_URL}/api/sea-time/pending`;
  console.log('[API] Fetching pending entries:', url);
  const headers = await getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch pending entries:', response.status, errorText);
    throw new Error('Failed to fetch pending entries');
  }
  const data = await response.json();
  console.log('[API] Pending entries fetched:', data.length);
  return data;
}

export async function confirmSeaTimeEntry(entryId: string, notes?: string): Promise<SeaTimeEntry> {
  const url = `${API_BASE_URL}/api/sea-time/${entryId}/confirm`;
  console.log('[API] Confirming sea time entry:', entryId, notes);
  const headers = await getApiHeaders();
  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ notes: notes || undefined }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to confirm entry:', response.status, errorText);
    throw new Error('Failed to confirm entry');
  }
  const data = await response.json();
  console.log('[API] Entry confirmed:', data);
  return data;
}

export async function rejectSeaTimeEntry(entryId: string, notes?: string): Promise<SeaTimeEntry> {
  const url = `${API_BASE_URL}/api/sea-time/${entryId}/reject`;
  console.log('[API] Rejecting sea time entry:', entryId, notes);
  const headers = await getApiHeaders();
  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ notes: notes || undefined }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to reject entry:', response.status, errorText);
    throw new Error('Failed to reject entry');
  }
  const data = await response.json();
  console.log('[API] Entry rejected:', data);
  return data;
}

export async function deleteSeaTimeEntry(entryId: string): Promise<{ success: boolean }> {
  const url = `${API_BASE_URL}/api/sea-time/${entryId}`;
  console.log('[API] Deleting sea time entry:', entryId);
  const headers = await getApiHeaders();
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to delete entry:', response.status, errorText);
    throw new Error('Failed to delete entry');
  }
  const data = await response.json();
  console.log('[API] Entry deleted:', data);
  return data;
}

// Reports
export async function getReportSummary(startDate?: string, endDate?: string): Promise<ReportSummary> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const url = `${API_BASE_URL}/api/reports/summary${params.toString() ? '?' + params.toString() : ''}`;
  console.log('[API] Fetching report summary:', url);
  const headers = await getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch report summary:', response.status, errorText);
    throw new Error('Failed to fetch report summary');
  }
  return response.json();
}

export async function downloadCSVReport(startDate?: string, endDate?: string): Promise<string> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const url = `${API_BASE_URL}/api/reports/csv${params.toString() ? '?' + params.toString() : ''}`;
  console.log('[API] Downloading CSV report:', url);
  const headers = await getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to download CSV report:', response.status, errorText);
    throw new Error('Failed to download CSV report');
  }
  return response.text();
}

// API Configuration helpers
export async function getApiConfiguration(): Promise<{ apiKey: string | null; apiUrl: string | null }> {
  const apiKey = await AsyncStorage.getItem(STORAGE_KEY_API_KEY);
  const apiUrl = await AsyncStorage.getItem(STORAGE_KEY_API_URL);
  return { apiKey, apiUrl };
}

export async function isApiConfigured(): Promise<boolean> {
  const apiKey = await AsyncStorage.getItem(STORAGE_KEY_API_KEY);
  return !!apiKey;
}
