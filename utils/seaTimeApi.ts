
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.backendUrl || '';

// Log the backend URL for debugging
console.log('[SeaTimeAPI] Backend URL configured:', API_BASE_URL);

export interface Vessel {
  id: string;
  mmsi: string;
  vessel_name: string;
  is_active: boolean;
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

export interface ApiSettings {
  apiKeyConfigured: boolean;
  apiUrl: string;
  lastUpdated?: string;
}

// Helper function to check if backend is configured
function checkBackendConfigured() {
  if (!API_BASE_URL) {
    throw new Error('Backend URL not configured. Please rebuild the app or check app.json configuration.');
  }
}

// Helper function to get API headers
function getApiHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  return headers;
}

// Settings Management
export async function getApiSettings(): Promise<ApiSettings> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/settings/api`;
  console.log('[API] Fetching API settings:', url);
  const headers = getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch API settings:', response.status, errorText);
    throw new Error('Failed to fetch API settings');
  }
  const data = await response.json();
  console.log('[API] API settings fetched:', data);
  return data;
}

export async function updateApiKey(apiKey: string): Promise<{ success: boolean; message: string; lastUpdated: string }> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/settings/api`;
  console.log('[API] Updating API key');
  const headers = getApiHeaders();
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ apiKey }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to update API key:', response.status, errorText);
    throw new Error('Failed to update API key');
  }
  const data = await response.json();
  console.log('[API] API key updated:', data);
  return data;
}

// Vessel Management
export async function getVessels(): Promise<Vessel[]> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels`;
  console.log('[API] Fetching vessels:', url);
  const headers = getApiHeaders();
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

export async function createVessel(mmsi: string, vessel_name: string, is_active?: boolean): Promise<Vessel> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels`;
  console.log('[API] Creating vessel:', { mmsi, vessel_name, is_active });
  const headers = getApiHeaders();
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ mmsi, vessel_name, is_active }),
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

export async function activateVessel(vesselId: string): Promise<Vessel> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels/${vesselId}/activate`;
  console.log('[API] Activating vessel:', vesselId);
  const headers = getApiHeaders();
  const response = await fetch(url, {
    method: 'PUT',
    headers,
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to activate vessel:', response.status, errorText);
    throw new Error('Failed to activate vessel');
  }
  const data = await response.json();
  console.log('[API] Vessel activated:', data);
  return data;
}

export async function deleteVessel(vesselId: string): Promise<{ success: boolean }> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels/${vesselId}`;
  console.log('[API] Deleting vessel:', vesselId);
  const headers = getApiHeaders();
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

export async function getVesselSeaTime(vesselId: string): Promise<SeaTimeEntry[]> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels/${vesselId}/sea-time`;
  console.log('[API] Fetching sea time for vessel:', vesselId);
  const headers = getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch vessel sea time:', response.status, errorText);
    throw new Error('Failed to fetch vessel sea time');
  }
  const data = await response.json();
  console.log('[API] Vessel sea time entries fetched:', data.length);
  return data;
}

// AIS Tracking
export async function checkVesselAIS(vesselId: string): Promise<AISCheckResult> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/ais/check/${vesselId}`;
  console.log('[API] Checking vessel AIS:', vesselId);
  const headers = getApiHeaders();
  const response = await fetch(url, {
    method: 'POST',
    headers,
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to check vessel AIS:', response.status, errorText);
    
    // Provide more helpful error messages
    if (response.status === 500 && errorText.includes('API key not configured')) {
      throw new Error('MyShipTracking API key not configured. Please configure it in Settings.');
    }
    if (response.status === 502) {
      throw new Error('Failed to connect to MyShipTracking API. Please try again later.');
    }
    
    throw new Error('Failed to check vessel AIS');
  }
  const data = await response.json();
  console.log('[API] AIS check result:', data);
  return data;
}

export interface AISStatus {
  is_moving: boolean;
  current_check: any;
  recent_checks: any[];
}

export async function getVesselAISStatus(vesselId: string): Promise<AISStatus> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/ais/status/${vesselId}`;
  console.log('[API] Getting vessel AIS status:', vesselId);
  const headers = getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to get vessel AIS status:', response.status, errorText);
    throw new Error('Failed to get vessel AIS status');
  }
  const data = await response.json();
  console.log('[API] AIS status:', data);
  return data;
}

// Sea Time Management
export async function getSeaTimeEntries(): Promise<SeaTimeEntry[]> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time`;
  console.log('[API] Fetching sea time entries:', url);
  const headers = getApiHeaders();
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
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time/pending`;
  console.log('[API] Fetching pending entries:', url);
  const headers = getApiHeaders();
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
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time/${entryId}/confirm`;
  console.log('[API] Confirming sea time entry:', entryId, notes);
  const headers = getApiHeaders();
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
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time/${entryId}/reject`;
  console.log('[API] Rejecting sea time entry:', entryId, notes);
  const headers = getApiHeaders();
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
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time/${entryId}`;
  console.log('[API] Deleting sea time entry:', entryId);
  const headers = getApiHeaders();
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
  checkBackendConfigured();
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const url = `${API_BASE_URL}/api/reports/summary${params.toString() ? '?' + params.toString() : ''}`;
  console.log('[API] Fetching report summary:', url);
  const headers = getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch report summary:', response.status, errorText);
    throw new Error('Failed to fetch report summary');
  }
  return response.json();
}

export async function downloadCSVReport(startDate?: string, endDate?: string): Promise<string> {
  checkBackendConfigured();
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const url = `${API_BASE_URL}/api/reports/csv${params.toString() ? '?' + params.toString() : ''}`;
  console.log('[API] Downloading CSV report:', url);
  const headers = getApiHeaders();
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to download CSV report:', response.status, errorText);
    throw new Error('Failed to download CSV report');
  }
  return response.text();
}
