
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE_URL = Constants.expoConfig?.extra?.backendUrl || 'https://uukpkcag4nsq8q632k643ztvus28frfe.app.specular.dev';
const TOKEN_KEY = 'auth_token';

// Normalize vessel data from API response
function normalizeVessel(vessel: any) {
  if (!vessel) return null;
  
  return {
    id: vessel.id,
    mmsi: vessel.mmsi,
    vessel_name: vessel.vessel_name || vessel.name,
    is_active: vessel.is_active ?? false,
    created_at: vessel.created_at,
    callsign: vessel.callsign || null,
    flag: vessel.flag || null,
    official_number: vessel.official_number || null,
    vessel_type: vessel.vessel_type || vessel.type || null,
    length_metres: vessel.length_metres ? Number(vessel.length_metres) : null,
    gross_tonnes: vessel.gross_tonnes ? Number(vessel.gross_tonnes) : null,
  };
}

// Check if backend is configured
export function checkBackendConfigured(): boolean {
  console.log('Checking backend configuration:', API_BASE_URL);
  return !!API_BASE_URL && API_BASE_URL !== 'YOUR_BACKEND_URL_HERE';
}

// Get auth token from secure storage
export async function getAuthToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      // For web, use localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(TOKEN_KEY);
      }
      return null;
    }
    // For native, use SecureStore
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

// Get API headers with auth token
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

// Get user profile
export async function getUserProfile() {
  console.log('Fetching user profile from /api/profile');
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/profile`, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch profile');
  }
  
  return response.json();
}

// Update user profile
export async function updateUserProfile(updates: { 
  name?: string; 
  email?: string;
  address?: string | null;
  tel_no?: string | null;
  date_of_birth?: string | null;
  srb_no?: string | null;
  nationality?: string | null;
  pya_membership_no?: string | null;
}) {
  console.log('Updating user profile:', updates);
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

// Upload profile image
export async function uploadProfileImage(imageUri: string) {
  console.log('Uploading profile image');
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

// Get all vessels
export async function getVessels() {
  console.log('Fetching vessels from /api/vessels');
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/vessels`, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch vessels');
  }
  
  const vessels = await response.json();
  return vessels.map(normalizeVessel);
}

// Create a new vessel
export async function createVessel(mmsi: string, vessel_name: string, is_active: boolean = false) {
  console.log('Creating vessel:', { mmsi, vessel_name, is_active });
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/vessels`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ mmsi, vessel_name, is_active }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create vessel');
  }
  
  const vessel = await response.json();
  return normalizeVessel(vessel);
}

// Update vessel particulars
export async function updateVesselParticulars(vesselId: string, updates: {
    vessel_name?: string;
    flag?: string;
    official_number?: string;
    type?: string;
    length_metres?: number;
    gross_tonnes?: number;
    callsign?: string;
  }) {
  console.log('Updating vessel particulars:', vesselId, updates);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/vessels/${vesselId}/particulars`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update vessel');
  }
  
  const vessel = await response.json();
  return normalizeVessel(vessel);
}

// Activate a vessel
export async function activateVessel(vesselId: string) {
  console.log('Activating vessel:', vesselId);
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
  return normalizeVessel(vessel);
}

// Delete a vessel
export async function deleteVessel(vesselId: string) {
  console.log('Deleting vessel:', vesselId);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/vessels/${vesselId}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({}),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete vessel');
  }
  
  return response.json();
}

// Get sea time entries for a vessel
export async function getVesselSeaTime(vesselId: string) {
  console.log('Fetching sea time for vessel:', vesselId);
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/vessels/${vesselId}/sea-time`, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch sea time');
  }
  
  return response.json();
}

// Check vessel AIS
export async function checkVesselAIS(vesselId: string) {
  console.log('Checking AIS for vessel:', vesselId);
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
  
  return response.json();
}

// Get vessel AIS status
export async function getVesselAISStatus(vesselId: string) {
  console.log('Fetching AIS status for vessel:', vesselId);
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/ais/status/${vesselId}`, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch AIS status');
  }
  
  return response.json();
}

// Get vessel AIS location
export async function getVesselAISLocation(vesselId: string, extended: boolean = false) {
  console.log('Fetching AIS location for vessel:', vesselId, 'extended:', extended);
  const options = await getFetchOptions('GET');
  const url = `${API_BASE_URL}/api/ais/check/${vesselId}${extended ? '?extended=true' : ''}`;
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch AIS location');
  }
  
  return response.json();
}

// Schedule AIS checks
export async function scheduleAISChecks(vesselId: string, intervalHours: number) {
  console.log('Scheduling AIS checks:', { vesselId, intervalHours });
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
  
  return response.json();
}

// Get scheduled tasks
export async function getScheduledTasks() {
  console.log('Fetching scheduled tasks');
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/ais/scheduled-tasks`, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch scheduled tasks');
  }
  
  return response.json();
}

// Toggle scheduled task
export async function toggleScheduledTask(taskId: string, isActive: boolean) {
  console.log('Toggling scheduled task:', { taskId, isActive });
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/ais/scheduled-tasks/${taskId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ is_active: isActive }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to toggle task');
  }
  
  return response.json();
}

// Get AIS debug logs
export async function getAISDebugLogs(vesselId: string) {
  console.log('Fetching AIS debug logs for vessel:', vesselId);
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/ais/debug/${vesselId}`, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch debug logs');
  }
  
  return response.json();
}

// Get all sea time entries
export async function getSeaTimeEntries() {
  console.log('Fetching all sea time entries');
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/sea-time`, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch sea time entries');
  }
  
  return response.json();
}

// Get pending sea time entries
export async function getPendingEntries() {
  console.log('Fetching pending sea time entries');
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/sea-time/pending`, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch pending entries');
  }
  
  return response.json();
}

// Confirm sea time entry
export async function confirmSeaTimeEntry(entryId: string) {
  console.log('Confirming sea time entry:', entryId);
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
  
  return response.json();
}

// Reject sea time entry
export async function rejectSeaTimeEntry(entryId: string) {
  console.log('Rejecting sea time entry:', entryId);
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
  
  return response.json();
}

// Update sea time entry
export async function updateSeaTimeEntry(entryId: string, updates: {
    service_capacity?: string | null;
    vessel_category?: string | null;
    actual_days_at_sea?: number | null;
    standby_service_days?: number | null;
    shipyard_service_days?: number | null;
    watchkeeping_days?: number | null;
    leave_days?: number | null;
    duties_and_tasks?: string | null;
    area_cruised?: string | null;
    notes?: string | null;
    status?: string;
  }) {
  console.log('Updating sea time entry:', entryId, updates);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/sea-time/${entryId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update entry');
  }
  
  return response.json();
}

// Delete sea time entry
export async function deleteSeaTimeEntry(entryId: string) {
  console.log('Deleting sea time entry:', entryId);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/sea-time/${entryId}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({}),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete entry');
  }
  
  return response.json();
}

// Get report summary
export async function getReportSummary() {
  console.log('Fetching report summary');
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/reports/summary`, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch summary');
  }
  
  return response.json();
}

// Download CSV report
export async function downloadCSVReport() {
  console.log('Downloading CSV report');
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/reports/csv`, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to download CSV');
  }
  
  return response.text();
}

// Download PDF report
export async function downloadPDFReport() {
  console.log('Downloading PDF report');
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/reports/pdf`, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to download PDF');
  }
  
  return response.blob();
}

// Create test sea day entry
export async function createTestSeaDayEntry() {
  console.log('Creating test sea day entry');
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
  
  return response.json();
}

// Generate sample sea time entries
export async function generateSampleSeaTimeEntries() {
  console.log('Generating sample sea time entries');
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/sea-time/generate-samples`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate samples');
  }
  
  return response.json();
}

// Create manual sea time entry
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
  console.log('Creating manual sea time entry:', entry);
  const headers = await getApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/logbook/manual-entry`, {
    method: 'POST',
    headers,
    body: JSON.stringify(entry),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create entry');
  }
  
  return response.json();
}

// Get new sea time entries
export async function getNewSeaTimeEntries() {
  console.log('Fetching new sea time entries');
  const options = await getFetchOptions('GET');
  const response = await fetch(`${API_BASE_URL}/api/sea-time/new-entries`, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch new entries');
  }
  
  return response.json();
}
