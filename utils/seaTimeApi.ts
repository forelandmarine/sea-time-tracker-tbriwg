
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE_URL = Constants.expoConfig?.extra?.backendUrl || '';
const TOKEN_KEY = 'seatime_auth_token';

// Log the backend URL for debugging
console.log('[SeaTimeAPI] Backend URL configured:', API_BASE_URL);
console.log('[SeaTimeAPI] Authentication enabled - all endpoints require auth token');

export interface Vessel {
  id: string;
  mmsi: string;
  vessel_name: string;
  is_active: boolean;
  created_at: string;
  flag?: string;
  official_number?: string;
  vessel_type?: string;
  length_metres?: number;
  gross_tonnes?: number;
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
  start_latitude?: number | null;
  start_longitude?: number | null;
  end_latitude?: number | null;
  end_longitude?: number | null;
}

export interface AISCheckResult {
  check_id: string;
  is_moving: boolean;
  speed_knots: number;
  latitude: number;
  longitude: number;
  sea_time_entry_created: boolean;
}

export interface AISStatus {
  is_moving: boolean;
  current_check: any;
  recent_checks: any[];
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

export interface ScheduledTask {
  id: string;
  task_type: string;
  vessel_id: string | null;
  interval_hours: number;
  last_run: string | null;
  next_run: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AISDebugLog {
  id: string;
  mmsi: string;
  api_url: string;
  request_time: string;
  response_status: string;
  response_body: string | null;
  authentication_status: string;
  error_message: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  emailVerified: boolean;
  image: string | null;
  imageUrl: string | null;
  created_at: string;
  createdAt: string;
  updatedAt: string;
}

export interface AISLocationData {
  mmsi: string;
  imo: string | null;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  course: number | null;
  heading: number | null;
  timestamp: string | null;
  status: string | null;
  destination: string | null;
  eta: string | null;
}

// Helper function to normalize vessel data from API response
// Handles both 'type' and 'vessel_type' field names
function normalizeVessel(vessel: any): Vessel {
  return {
    ...vessel,
    vessel_type: vessel.vessel_type || vessel.type || undefined,
  };
}

// Helper function to check if backend is configured
function checkBackendConfigured() {
  if (!API_BASE_URL) {
    throw new Error('Backend URL not configured. Please rebuild the app or check app.json configuration.');
  }
}

// Helper function to get auth token
async function getAuthToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

// Helper function to get API headers with auth token
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

// Helper function to get fetch options
async function getFetchOptions(method: string = 'GET', body?: any): Promise<RequestInit> {
  const options: RequestInit = {
    method,
    headers: await getApiHeaders(),
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  return options;
}

// User Profile Management
export async function getUserProfile(): Promise<UserProfile> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/profile`;
  console.log('[API] Fetching user profile:', url);
  const response = await fetch(url, await getFetchOptions());
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch user profile:', response.status, errorText);
    throw new Error('Failed to fetch user profile');
  }
  const data = await response.json();
  console.log('[API] User profile fetched:', data.email);
  return data;
}

export async function updateUserProfile(updates: { name?: string; email?: string }): Promise<UserProfile> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/profile`;
  console.log('[API] Updating user profile:', updates);
  const response = await fetch(url, await getFetchOptions('PUT', updates));
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to update user profile:', response.status, errorText);
    throw new Error('Failed to update user profile');
  }
  const data = await response.json();
  console.log('[API] User profile updated:', data.email);
  return data;
}

export async function uploadProfileImage(imageUri: string): Promise<{ url: string; message: string }> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/profile/upload-image`;
  console.log('[API] Uploading profile image');
  
  const token = await getAuthToken();
  
  // Create form data
  const formData = new FormData();
  
  // For React Native, we need to create a file object
  const filename = imageUri.split('/').pop() || 'profile.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';
  
  formData.append('image', {
    uri: imageUri,
    name: filename,
    type,
  } as any);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to upload profile image:', response.status, errorText);
    throw new Error('Failed to upload profile image');
  }
  
  const data = await response.json();
  console.log('[API] Profile image uploaded:', data.url);
  return data;
}

// Vessel Management
export async function getVessels(): Promise<Vessel[]> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels`;
  console.log('[API] Fetching vessels:', url);
  const response = await fetch(url, await getFetchOptions());
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch vessels:', response.status, errorText);
    throw new Error('Failed to fetch vessels');
  }
  const data = await response.json();
  console.log('[API] Vessels fetched:', data.length);
  // Normalize vessel data to ensure vessel_type field is present
  return data.map(normalizeVessel);
}

export async function createVessel(
  mmsi: string, 
  vessel_name: string, 
  is_active?: boolean,
  flag?: string,
  official_number?: string,
  vessel_type?: string,
  length_metres?: number,
  gross_tonnes?: number
): Promise<Vessel> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels`;
  
  const body: any = { 
    mmsi, 
    vessel_name, 
    is_active 
  };
  
  // Add optional fields if provided
  if (flag) body.flag = flag;
  if (official_number) body.official_number = official_number;
  if (vessel_type) body.type = vessel_type; // Send as 'type' to backend
  if (length_metres !== undefined) body.length_metres = length_metres;
  if (gross_tonnes !== undefined) body.gross_tonnes = gross_tonnes;
  
  console.log('[API] Creating vessel:', body);
  const response = await fetch(url, await getFetchOptions('POST', body));
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to create vessel:', response.status, errorText);
    throw new Error('Failed to create vessel');
  }
  const data = await response.json();
  console.log('[API] Vessel created:', data);
  return normalizeVessel(data);
}

export async function updateVesselParticulars(
  vesselId: string,
  updates: {
    flag?: string;
    official_number?: string;
    type?: string;
    length_metres?: number;
    gross_tonnes?: number;
  }
): Promise<Vessel> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels/${vesselId}/particulars`;
  console.log('[API] Updating vessel particulars:', vesselId, updates);
  const response = await fetch(url, await getFetchOptions('PUT', updates));
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to update vessel particulars:', response.status, errorText);
    throw new Error('Failed to update vessel particulars');
  }
  const data = await response.json();
  console.log('[API] Vessel particulars updated:', data);
  return normalizeVessel(data);
}

export async function activateVessel(vesselId: string): Promise<Vessel> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels/${vesselId}/activate`;
  console.log('[API] Activating vessel:', vesselId);
  const response = await fetch(url, await getFetchOptions('PUT', {}));
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to activate vessel:', response.status, errorText);
    throw new Error('Failed to activate vessel');
  }
  const data = await response.json();
  console.log('[API] Vessel activated:', data);
  return normalizeVessel(data);
}

export async function deleteVessel(vesselId: string): Promise<{ success: boolean }> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/vessels/${vesselId}`;
  console.log('[API] Deleting vessel:', vesselId);
  const response = await fetch(url, await getFetchOptions('DELETE', {}));
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
  const response = await fetch(url, await getFetchOptions());
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch vessel sea time:', response.status, errorText);
    throw new Error('Failed to fetch vessel sea time');
  }
  const data = await response.json();
  console.log('[API] Vessel sea time entries fetched:', data.length);
  // Normalize vessel data in each entry
  return data.map((entry: any) => ({
    ...entry,
    vessel: normalizeVessel(entry.vessel),
  }));
}

// AIS Tracking
export async function checkVesselAIS(vesselId: string): Promise<AISCheckResult> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/ais/check/${vesselId}`;
  console.log('[API] Checking vessel AIS:', vesselId);
  const response = await fetch(url, await getFetchOptions('POST', {}));
  
  if (!response.ok) {
    let errorMessage = 'Failed to check vessel AIS';
    
    try {
      const errorData = await response.json();
      console.error('[API] AIS check failed:', response.status, errorData);
      
      if (errorData.error) {
        if (errorData.error.includes('API key') || errorData.error.includes('authentication failed')) {
          errorMessage = '🔐 Authentication Error\n\nThe MyShipTracking API authentication failed. The API key may be invalid or expired.\n\nThis is a backend configuration issue. Please contact support.';
        } else if (errorData.error.includes('not found in AIS system')) {
          errorMessage = '🔍 Vessel Not Found\n\nThe vessel MMSI could not be found in the MyShipTracking database.\n\nPossible reasons:\n• MMSI number is incorrect\n• Vessel is not broadcasting AIS\n• Vessel is out of coverage range\n\nPlease verify the MMSI number.';
        } else if (errorData.error.includes('temporarily unavailable')) {
          errorMessage = '🌐 Service Unavailable\n\nThe MyShipTracking API is temporarily unavailable. Please try again in a few minutes.';
        } else if (errorData.error.includes('not active')) {
          errorMessage = '⚠️ Vessel Not Active\n\nThis vessel is not active. Please activate the vessel first before checking AIS data.';
        } else {
          errorMessage = errorData.error;
        }
      }
    } catch (parseError) {
      try {
        const errorText = await response.text();
        console.error('[API] AIS check failed (text):', response.status, errorText);
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
  console.log('[API] AIS check successful:', data);
  return data;
}

export async function getVesselAISStatus(vesselId: string): Promise<AISStatus> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/ais/status/${vesselId}`;
  console.log('[API] Getting vessel AIS status:', vesselId);
  const response = await fetch(url, await getFetchOptions());
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to get vessel AIS status:', response.status, errorText);
    throw new Error('Failed to get vessel AIS status');
  }
  const data = await response.json();
  console.log('[API] AIS status:', data);
  return data;
}

export async function getVesselAISLocation(vesselId: string, extended: boolean = false): Promise<AISLocationData> {
  checkBackendConfigured();
  const params = extended ? '?extended=true' : '';
  const url = `${API_BASE_URL}/api/ais/check/${vesselId}${params}`;
  console.log('[API] Getting vessel AIS location data:', vesselId, 'extended:', extended);
  const response = await fetch(url, await getFetchOptions());
  
  if (!response.ok) {
    let errorMessage = 'Failed to get vessel AIS location';
    
    try {
      const errorData = await response.json();
      console.error('[API] AIS location fetch failed:', response.status, errorData);
      
      if (errorData.error) {
        if (errorData.error.includes('API key') || errorData.error.includes('authentication failed')) {
          errorMessage = '🔐 Authentication Error\n\nThe MyShipTracking API authentication failed. The API key may be invalid or expired.\n\nThis is a backend configuration issue. Please contact support.';
        } else if (errorData.error.includes('not found in AIS system')) {
          errorMessage = '🔍 Vessel Not Found\n\nThe vessel MMSI could not be found in the MyShipTracking database.\n\nPossible reasons:\n• MMSI number is incorrect\n• Vessel is not broadcasting AIS\n• Vessel is out of coverage range\n\nPlease verify the MMSI number.';
        } else if (errorData.error.includes('temporarily unavailable')) {
          errorMessage = '🌐 Service Unavailable\n\nThe MyShipTracking API is temporarily unavailable. Please try again in a few minutes.';
        } else {
          errorMessage = errorData.error;
        }
      }
    } catch (parseError) {
      try {
        const errorText = await response.text();
        console.error('[API] AIS location fetch failed (text):', response.status, errorText);
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
  console.log('[API] AIS location data:', data);
  return data;
}

// Scheduled Tasks
export async function scheduleAISChecks(vesselId: string, intervalHours: number = 4): Promise<ScheduledTask> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/ais/schedule-check`;
  console.log('[API] Scheduling AIS checks for vessel:', vesselId, 'every', intervalHours, 'hours');
  const response = await fetch(url, await getFetchOptions('POST', { vessel_id: vesselId, interval_hours: intervalHours }));
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to schedule AIS checks:', response.status, errorText);
    throw new Error('Failed to schedule AIS checks');
  }
  const data = await response.json();
  console.log('[API] AIS checks scheduled:', data);
  return data;
}

export async function getScheduledTasks(): Promise<ScheduledTask[]> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/ais/scheduled-tasks`;
  console.log('[API] Fetching scheduled tasks');
  
  try {
    const response = await fetch(url, await getFetchOptions());
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('[API] Scheduled tasks endpoint not found (404) - feature may not be implemented yet');
        return [];
      }
      const errorText = await response.text();
      console.error('[API] Failed to fetch scheduled tasks:', response.status, errorText);
      throw new Error('Failed to fetch scheduled tasks');
    }
    const data = await response.json();
    console.log('[API] Scheduled tasks fetched:', data.length);
    return data;
  } catch (error: any) {
    if (error.message?.includes('fetch') || error.message?.includes('Network')) {
      console.warn('[API] Scheduled tasks endpoint may not be available:', error.message);
      return [];
    }
    throw error;
  }
}

export async function toggleScheduledTask(taskId: string, isActive: boolean): Promise<ScheduledTask> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/ais/scheduled-tasks/${taskId}/toggle`;
  console.log('[API] Toggling scheduled task:', taskId, isActive);
  const response = await fetch(url, await getFetchOptions('PUT', { is_active: isActive }));
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to toggle scheduled task:', response.status, errorText);
    throw new Error('Failed to toggle scheduled task');
  }
  const data = await response.json();
  console.log('[API] Scheduled task toggled:', data);
  return data;
}

// Debug Endpoints
export async function getAISDebugLogs(vesselId: string): Promise<AISDebugLog[]> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/ais/debug/${vesselId}`;
  console.log('[API] Fetching AIS debug logs for vessel:', vesselId);
  const response = await fetch(url, await getFetchOptions());
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch debug logs:', response.status, errorText);
    throw new Error('Failed to fetch debug logs');
  }
  const data = await response.json();
  console.log('[API] Debug logs fetched:', data.length);
  return data;
}

// Sea Time Management
export async function getSeaTimeEntries(): Promise<SeaTimeEntry[]> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time`;
  console.log('[API] Fetching sea time entries:', url);
  const response = await fetch(url, await getFetchOptions());
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch sea time entries:', response.status, errorText);
    throw new Error('Failed to fetch sea time entries');
  }
  const data = await response.json();
  console.log('[API] Sea time entries fetched:', data.length);
  // Normalize vessel data in each entry
  return data.map((entry: any) => ({
    ...entry,
    vessel: entry.vessel ? normalizeVessel(entry.vessel) : null,
  }));
}

export async function getPendingEntries(): Promise<SeaTimeEntry[]> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time/pending`;
  console.log('[API] Fetching pending entries:', url);
  const response = await fetch(url, await getFetchOptions());
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to fetch pending entries:', response.status, errorText);
    throw new Error('Failed to fetch pending entries');
  }
  const data = await response.json();
  console.log('[API] Pending entries fetched:', data.length);
  // Normalize vessel data in each entry
  return data.map((entry: any) => ({
    ...entry,
    vessel: entry.vessel ? normalizeVessel(entry.vessel) : null,
  }));
}

export async function confirmSeaTimeEntry(entryId: string, notes?: string): Promise<SeaTimeEntry> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time/${entryId}/confirm`;
  console.log('[API] Confirming sea time entry:', entryId, notes);
  const response = await fetch(url, await getFetchOptions('PUT', { notes: notes || undefined }));
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to confirm entry:', response.status, errorText);
    throw new Error('Failed to confirm entry');
  }
  const data = await response.json();
  console.log('[API] Entry confirmed:', data);
  return {
    ...data,
    vessel: data.vessel ? normalizeVessel(data.vessel) : null,
  };
}

export async function rejectSeaTimeEntry(entryId: string, notes?: string): Promise<SeaTimeEntry> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time/${entryId}/reject`;
  console.log('[API] Rejecting sea time entry:', entryId, notes);
  const response = await fetch(url, await getFetchOptions('PUT', { notes: notes || undefined }));
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to reject entry:', response.status, errorText);
    throw new Error('Failed to reject entry');
  }
  const data = await response.json();
  console.log('[API] Entry rejected:', data);
  return {
    ...data,
    vessel: data.vessel ? normalizeVessel(data.vessel) : null,
  };
}

export async function deleteSeaTimeEntry(entryId: string): Promise<{ success: boolean }> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time/${entryId}`;
  console.log('[API] Deleting sea time entry:', entryId);
  const response = await fetch(url, await getFetchOptions('DELETE', {}));
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
  const response = await fetch(url, await getFetchOptions());
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
  const response = await fetch(url, await getFetchOptions());
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to download CSV report:', response.status, errorText);
    throw new Error('Failed to download CSV report');
  }
  return response.text();
}

export async function downloadPDFReport(startDate?: string, endDate?: string): Promise<Blob> {
  checkBackendConfigured();
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const url = `${API_BASE_URL}/api/reports/pdf${params.toString() ? '?' + params.toString() : ''}`;
  console.log('[API] Downloading PDF report:', url);
  
  const token = await getAuthToken();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Failed to download PDF report:', response.status, errorText);
    throw new Error('Failed to download PDF report');
  }
  
  return response.blob();
}

// Test Endpoint - Create test sea day entry from specific position records
export async function createTestSeaDayEntry(): Promise<SeaTimeEntry> {
  checkBackendConfigured();
  const url = `${API_BASE_URL}/api/sea-time/test-entry`;
  console.log('[API] Creating test sea day entry from Norwegian position records');
  const response = await fetch(url, await getFetchOptions('POST', {}));
  
  if (!response.ok) {
    let errorMessage = 'Failed to create test sea day entry';
    
    try {
      const errorData = await response.json();
      console.error('[API] Test entry creation failed:', response.status, errorData);
      
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (parseError) {
      try {
        const errorText = await response.text();
        console.error('[API] Test entry creation failed (text):', response.status, errorText);
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
  console.log('[API] Test sea day entry created successfully:', data);
  return {
    ...data,
    vessel: data.vessel ? normalizeVessel(data.vessel) : null,
  };
}
