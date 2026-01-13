
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.backendUrl || '';

// MyShipTracking API key - Replace with your actual API key
// Get your API key from: https://www.myshiptracking.com/
const MYSHIPTRACKING_API_KEY = 'YOUR_MYSHIPTRACKING_API_KEY_HERE';

// Log the backend URL for debugging
console.log('[SeaTimeAPI] Backend URL configured:', API_BASE_URL);
console.log('[SeaTimeAPI] MyShipTracking API key configured:', MYSHIPTRACKING_API_KEY !== 'YOUR_MYSHIPTRACKING_API_KEY_HERE');

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

// Helper function to check if backend is configured
function checkBackendConfigured() {
  if (!API_BASE_URL) {
    throw new Error('Backend URL not configured. Please rebuild the app or check app.json configuration.');
  }
}

// Helper function to get API headers (no API key - backend handles that)
function getApiHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  return headers;
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
    body: JSON.stringify({}),
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
  const response = await fetch(url, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to delete vessel:', response.status, errorText);
    throw new Error('Failed to delete vessel');
  }
  console.log('[API] Vessel deleted successfully');
  return { success: true };
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
    body: JSON.stringify({}),
  });
  
  if (!response.ok) {
    let errorMessage = 'Failed to check vessel AIS';
    
    try {
      const errorData = await response.json();
      console.error('[API] Failed to check vessel AIS:', response.status, errorData);
      
      // Provide specific error messages based on the backend response
      if (errorData.error) {
        if (errorData.error.includes('API key not configured') || errorData.error.includes('Invalid MyShipTracking API key')) {
          errorMessage = '⚠️ MyShipTracking API Configuration Required\n\nThe MyShipTracking API key is not configured or invalid. Please contact the app developer to set up the API key.\n\nTo configure:\n1. Get an API key from myshiptracking.com\n2. Set the MYSHIPTRACKING_API_KEY environment variable on the backend';
        } else if (errorData.error.includes('not found in AIS system')) {
          errorMessage = '🔍 Vessel Not Found in AIS System\n\nThe vessel MMSI could not be found in the MyShipTracking database. This could mean:\n\n• The MMSI number is incorrect\n• The vessel is not broadcasting AIS signals\n• The vessel is out of AIS coverage range\n\nPlease verify the MMSI number is correct and the vessel is actively transmitting AIS data.';
        } else if (errorData.error.includes('temporarily unavailable')) {
          errorMessage = '🌐 AIS Service Temporarily Unavailable\n\nThe MyShipTracking API is currently unavailable. Please try again in a few minutes.\n\nIf the problem persists, the service may be experiencing downtime.';
        } else {
          errorMessage = errorData.error;
        }
      }
    } catch (parseError) {
      // If we can't parse the error response, try to get text
      try {
        const errorText = await response.text();
        console.error('[API] Failed to check vessel AIS (text):', response.status, errorText);
        if (errorText) {
          errorMessage = errorText;
        }
      } catch (textError) {
        console.error('[API] Could not parse error response:', textError);
      }
    }
    
    throw new Error(errorMessage);
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
    body: JSON.stringify({}),
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
