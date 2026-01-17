
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE_URL = Constants.expoConfig?.extra?.backendUrl || 'https://uukpkcag4nsq8q632k643ztvus28frfe.app.specular.dev';
const TOKEN_KEY = 'auth_token';

// Helper to normalize vessel data from API
function normalizeVessel(vessel: any) {
  if (!vessel) return null;
  
  return {
    id: vessel.id,
    mmsi: vessel.mmsi,
    vessel_name: vessel.vessel_name,
    is_active: vessel.is_active,
    created_at: vessel.created_at,
    flag: vessel.flag || undefined,
    official_number: vessel.official_number || undefined,
    vessel_type: vessel.vessel_type || vessel.type || undefined,
    length_metres: vessel.length_metres ? parseFloat(vessel.length_metres) : undefined,
    gross_tonnes: vessel.gross_tonnes ? parseFloat(vessel.gross_tonnes) : undefined,
    callsign: vessel.callsign || undefined,
  };
}

// Check if backend is configured
function checkBackendConfigured() {
  if (!API_BASE_URL) {
    throw new Error('Backend URL not configured. Please check app.json configuration.');
  }
}

// Get auth token from secure storage
async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

// Get headers with auth token
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

// Helper to get fetch options with auth
async function getFetchOptions(method: string = 'GET'): Promise<RequestInit> {
  const headers = await getApiHeaders();
  return {
    method,
    headers,
  };
}

// User Profile APIs
export async function getUserProfile() {
  checkBackendConfigured();
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/profile`, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch user profile');
  }
  
  return response.json();
}

export async function updateUserProfile(updates: { name?: string; email?: string }) {
  checkBackendConfigured();
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update profile');
  }
  
  return response.json();
}

export async function uploadProfileImage(imageUri: string) {
  checkBackendConfigured();
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
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload image');
  }
  
  return response.json();
}

// Vessel APIs
export async function getVessels() {
  checkBackendConfigured();
  console.log('[API] Fetching vessels from:', `${API_BASE_URL}/api/vessels`);
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/vessels`, options);
  
  if (!response.ok) {
    throw new Error('Failed to fetch vessels');
  }
  
  const vessels = await response.json();
  console.log('[API] Received vessels:', vessels.length);
  return vessels.map(normalizeVessel);
}

export async function createVessel(
  mmsi: string, 
  vessel_name: string, 
  is_active: boolean = false,
  flag?: string,
  official_number?: string,
  type?: string,
  length_metres?: number,
  gross_tonnes?: number,
  callsign?: string
) {
  checkBackendConfigured();
  console.log('[API] Creating vessel:', { mmsi, vessel_name, is_active, flag, official_number, type, length_metres, gross_tonnes, callsign });
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
      type,
      length_metres,
      gross_tonnes,
      callsign
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create vessel');
  }
  
  const vessel = await response.json();
  console.log('[API] Vessel created:', vessel.id);
  return normalizeVessel(vessel);
}

export async function updateVesselParticulars(
  vesselId: string,
  updates: {
    flag?: string;
    official_number?: string;
    type?: string;
    length_metres?: number;
    gross_tonnes?: number;
    callsign?: string;
  }
) {
  checkBackendConfigured();
  console.log('[API] Updating vessel particulars:', vesselId, updates);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/vessels/${vesselId}/particulars`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update vessel particulars');
  }
  
  const vessel = await response.json();
  console.log('[API] Vessel particulars updated');
  return normalizeVessel(vessel);
}

export async function activateVessel(vesselId: string) {
  checkBackendConfigured();
  console.log('[API] Activating vessel:', vesselId);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/vessels/${vesselId}/activate`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({}),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to activate vessel');
  }
  
  const vessel = await response.json();
  console.log('[API] Vessel activated');
  return normalizeVessel(vessel);
}

export async function deleteVessel(vesselId: string) {
  checkBackendConfigured();
  console.log('[API] Deleting vessel:', vesselId);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/vessels/${vesselId}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete vessel');
  }
  
  console.log('[API] Vessel deleted');
  return response.json();
}

// Sea Time APIs
export async function getVesselSeaTime(vesselId: string) {
  checkBackendConfigured();
  console.log('[API] Fetching sea time for vessel:', vesselId);
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/vessels/${vesselId}/sea-time`, options);
  
  if (!response.ok) {
    throw new Error('Failed to fetch vessel sea time');
  }
  
  const entries = await response.json();
  console.log('[API] Received sea time entries:', entries.length);
  return entries;
}

// AIS APIs
export async function checkVesselAIS(vesselId: string) {
  checkBackendConfigured();
  console.log('[API] Checking AIS for vessel:', vesselId);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/ais/check/${vesselId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to check AIS');
  }
  
  const result = await response.json();
  console.log('[API] AIS check result:', result);
  return result;
}

export async function getVesselAISStatus(vesselId: string) {
  checkBackendConfigured();
  console.log('[API] Fetching AIS status for vessel:', vesselId);
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/ais/status/${vesselId}`, options);
  
  if (!response.ok) {
    throw new Error('Failed to fetch AIS status');
  }
  
  const status = await response.json();
  console.log('[API] AIS status:', status);
  return status;
}

export async function getVesselAISLocation(vesselId: string, extended: boolean = false) {
  checkBackendConfigured();
  console.log('[API] Fetching AIS location for vessel:', vesselId, 'extended:', extended);
  const options = await getFetchOptions('GET');
  const url = `${API_BASE_URL}/api/ais/check/${vesselId}${extended ? '?extended=true' : ''}`;
  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error('Failed to fetch AIS location');
  }
  
  const location = await response.json();
  console.log('[API] AIS location:', location);
  return location;
}

export async function scheduleAISChecks(vesselId: string, intervalHours: number) {
  checkBackendConfigured();
  console.log('[API] Scheduling AIS checks for vessel:', vesselId, 'interval:', intervalHours);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/ais/schedule-check`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ vessel_id: vesselId, interval_hours: intervalHours }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to schedule AIS checks');
  }
  
  const task = await response.json();
  console.log('[API] AIS checks scheduled:', task);
  return task;
}

export async function getScheduledTasks() {
  checkBackendConfigured();
  console.log('[API] Fetching scheduled tasks');
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/ais/scheduled-tasks`, options);
  
  if (!response.ok) {
    throw new Error('Failed to fetch scheduled tasks');
  }
  
  const tasks = await response.json();
  console.log('[API] Received scheduled tasks:', tasks.length);
  return tasks;
}

export async function toggleScheduledTask(taskId: string, isActive: boolean) {
  checkBackendConfigured();
  console.log('[API] Toggling scheduled task:', taskId, 'active:', isActive);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/ais/scheduled-tasks/${taskId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ is_active: isActive }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to toggle scheduled task');
  }
  
  const task = await response.json();
  console.log('[API] Scheduled task toggled');
  return task;
}

export async function getAISDebugLogs(vesselId: string) {
  checkBackendConfigured();
  console.log('[API] Fetching AIS debug logs for vessel:', vesselId);
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/ais/debug/${vesselId}`, options);
  
  if (!response.ok) {
    throw new Error('Failed to fetch AIS debug logs');
  }
  
  const logs = await response.json();
  console.log('[API] Received AIS debug logs:', logs.length);
  return logs;
}

// Sea Time Entry APIs
export async function getSeaTimeEntries() {
  checkBackendConfigured();
  console.log('[API] Fetching all sea time entries');
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/sea-time`, options);
  
  if (!response.ok) {
    throw new Error('Failed to fetch sea time entries');
  }
  
  const entries = await response.json();
  console.log('[API] Received sea time entries:', entries.length);
  return entries;
}

export async function getPendingEntries() {
  checkBackendConfigured();
  console.log('[API] Fetching pending sea time entries');
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/sea-time/pending`, options);
  
  if (!response.ok) {
    throw new Error('Failed to fetch pending entries');
  }
  
  const entries = await response.json();
  console.log('[API] Received pending entries:', entries.length);
  return entries;
}

export async function confirmSeaTimeEntry(entryId: string) {
  checkBackendConfigured();
  console.log('[API] Confirming sea time entry:', entryId);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/sea-time/${entryId}/confirm`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({}),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to confirm entry');
  }
  
  console.log('[API] Entry confirmed');
  return response.json();
}

export async function rejectSeaTimeEntry(entryId: string) {
  checkBackendConfigured();
  console.log('[API] Rejecting sea time entry:', entryId);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/sea-time/${entryId}/reject`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({}),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to reject entry');
  }
  
  console.log('[API] Entry rejected');
  return response.json();
}

export async function deleteSeaTimeEntry(entryId: string) {
  checkBackendConfigured();
  console.log('[API] Deleting sea time entry:', entryId);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/sea-time/${entryId}`, {
    method: 'DELETE',
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete entry');
  }
  
  console.log('[API] Entry deleted');
  return response.json();
}

// Reports APIs
export async function getReportSummary() {
  checkBackendConfigured();
  console.log('[API] Fetching report summary from:', `${API_BASE_URL}/api/reports/summary`);
  const options = await getFetchOptions('GET');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/reports/summary`, options);
    
    console.log('[API] Report summary response status:', response.status);
    
    if (!response.ok) {
      let errorMessage = 'Failed to fetch report summary';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        console.error('[API] Failed to parse error response:', e);
      }
      console.error('[API] Report summary error:', errorMessage);
      throw new Error(errorMessage);
    }
    
    const summary = await response.json();
    console.log('[API] Received report summary:', summary);
    return summary;
  } catch (error) {
    console.error('[API] Exception fetching report summary:', error);
    throw error;
  }
}

export async function downloadCSVReport() {
  checkBackendConfigured();
  console.log('[API] Downloading CSV report from:', `${API_BASE_URL}/api/reports/csv`);
  const options = await getFetchOptions('GET');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/reports/csv`, options);
    
    console.log('[API] CSV report response status:', response.status);
    
    if (!response.ok) {
      let errorMessage = 'Failed to download CSV report';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        console.error('[API] Failed to parse error response:', e);
      }
      console.error('[API] CSV report error:', errorMessage);
      throw new Error(errorMessage);
    }
    
    const csvData = await response.text();
    console.log('[API] CSV report downloaded, size:', csvData.length);
    return csvData;
  } catch (error) {
    console.error('[API] Exception downloading CSV report:', error);
    throw error;
  }
}

export async function downloadPDFReport() {
  checkBackendConfigured();
  console.log('[API] Downloading PDF report from:', `${API_BASE_URL}/api/reports/pdf`);
  const options = await getFetchOptions('GET');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/reports/pdf`, options);
    
    console.log('[API] PDF report response status:', response.status);
    
    if (!response.ok) {
      let errorMessage = 'Failed to download PDF report';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        console.error('[API] Failed to parse error response:', e);
      }
      console.error('[API] PDF report error:', errorMessage);
      throw new Error(errorMessage);
    }
    
    const pdfBlob = await response.blob();
    console.log('[API] PDF report downloaded, size:', pdfBlob.size);
    return pdfBlob;
  } catch (error) {
    console.error('[API] Exception downloading PDF report:', error);
    throw error;
  }
}

// Test APIs
export async function createTestSeaDayEntry() {
  checkBackendConfigured();
  console.log('[API] Creating test sea day entry');
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/sea-time/test-entry`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create test entry');
  }
  
  const entry = await response.json();
  console.log('[API] Test entry created:', entry.id);
  return entry;
}

// Generate Sample Sea Time Entries
export async function generateSampleSeaTimeEntries() {
  checkBackendConfigured();
  console.log('[API] Generating sample sea time entries');
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/sea-time/generate-samples`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate sample entries');
  }
  
  const result = await response.json();
  console.log('[API] Sample entries generated:', result.entries?.length || 0);
  return result;
}

// Manual Sea Time Entry API
export async function createManualSeaTimeEntry(entry: {
  vessel_id: string;
  start_time: string;
  end_time?: string | null;
  notes?: string | null;
  start_latitude?: number | null;
  start_longitude?: number | null;
  end_latitude?: number | null;
  end_longitude?: number | null;
}) {
  checkBackendConfigured();
  console.log('[API] Creating manual sea time entry:', entry);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/logbook/manual-entry`, {
    method: 'POST',
    headers,
    body: JSON.stringify(entry),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create manual entry');
  }
  
  const createdEntry = await response.json();
  console.log('[API] Manual entry created:', createdEntry.id);
  return createdEntry;
}

// Get new sea time entries that haven't been notified yet
// TODO: Backend Integration - GET /api/sea-time/new-entries
// This endpoint will be created by the backend to return pending entries where notified=false
// and mark them as notified=true
export async function getNewSeaTimeEntries() {
  checkBackendConfigured();
  console.log('[API] Fetching new sea time entries for notifications');
  const options = await getFetchOptions('GET');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/sea-time/new-entries`, options);
    
    if (!response.ok) {
      // If endpoint doesn't exist yet, return empty array
      if (response.status === 404) {
        console.log('[API] New entries endpoint not yet available');
        return { newEntries: [] };
      }
      throw new Error('Failed to fetch new entries');
    }
    
    const result = await response.json();
    console.log('[API] Received new entries:', result.newEntries?.length || 0);
    return result;
  } catch (error) {
    console.error('[API] Error fetching new entries:', error);
    return { newEntries: [] };
  }
}
