
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
</write file>

Now I need to update the home screen files to display the timestamp along with the lat/long. I'll update both the iOS and regular versions:

<write file="app/(tabs)/(home)/index.tsx">
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  useColorScheme,
  RefreshControl,
  Platform,
  Image,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { useRouter } from 'expo-router';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Vessel {
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

interface VesselLocation {
  latitude: number | null;
  longitude: number | null;
  timestamp: string | null;
}

export default function SeaTimeScreen() {
  const router = useRouter();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newVesselName, setNewVesselName] = useState('');
  const [newMMSI, setNewMMSI] = useState('');
  const [newFlag, setNewFlag] = useState('');
  const [newOfficialNumber, setNewOfficialNumber] = useState('');
  const [newVesselType, setNewVesselType] = useState('');
  const [newLengthMetres, setNewLengthMetres] = useState('');
  const [newGrossTonnes, setNewGrossTonnes] = useState('');
  const [activeVesselLocation, setActiveVesselLocation] = useState<VesselLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);

  // Separate vessels into active and historic
  const activeVessel = vessels.find(v => v.is_active);
  const historicVessels = vessels.filter(v => !v.is_active);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeVessel) {
      loadActiveVesselLocation();
    } else {
      setActiveVesselLocation(null);
    }
  }, [activeVessel?.id]);

  const loadData = async () => {
    try {
      console.log('Loading vessels...');
      const vesselsData = await seaTimeApi.getVessels();
      setVessels(vesselsData);
      console.log('Data loaded successfully - Active vessels:', vesselsData.filter(v => v.is_active).length, 'Historic vessels:', vesselsData.filter(v => !v.is_active).length);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveVesselLocation = async () => {
    if (!activeVessel) {
      console.log('No active vessel to load location for');
      return;
    }

    try {
      setLocationLoading(true);
      console.log('Loading location for active vessel:', activeVessel.id);
      const locationData = await seaTimeApi.getVesselAISLocation(activeVessel.id, false);
      setActiveVesselLocation({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        timestamp: locationData.timestamp,
      });
      console.log('Active vessel location loaded:', locationData.latitude, locationData.longitude, 'timestamp:', locationData.timestamp);
    } catch (error: any) {
      console.error('Failed to load active vessel location:', error);
      // Don't show alert for location errors, just log them
      setActiveVesselLocation(null);
    } finally {
      setLocationLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (activeVessel) {
      await loadActiveVesselLocation();
    }
    setRefreshing(false);
  };

  const handleAddVessel = async () => {
    if (!newMMSI.trim() || !newVesselName.trim()) {
      Alert.alert('Error', 'Please enter both MMSI and vessel name');
      return;
    }

    try {
      console.log('Creating new vessel:', { 
        mmsi: newMMSI, 
        name: newVesselName,
        flag: newFlag,
        official_number: newOfficialNumber,
        vessel_type: newVesselType,
        length_metres: newLengthMetres,
        gross_tonnes: newGrossTonnes
      });
      
      await seaTimeApi.createVessel(
        newMMSI.trim(), 
        newVesselName.trim(), 
        false,
        newFlag.trim() || undefined,
        newOfficialNumber.trim() || undefined,
        newVesselType || undefined,
        newLengthMetres ? parseFloat(newLengthMetres) : undefined,
        newGrossTonnes ? parseFloat(newGrossTonnes) : undefined
      );
      
      setModalVisible(false);
      setNewMMSI('');
      setNewVesselName('');
      setNewFlag('');
      setNewOfficialNumber('');
      setNewVesselType('');
      setNewLengthMetres('');
      setNewGrossTonnes('');
      await loadData();
      Alert.alert('Success', 'Vessel added successfully');
    } catch (error: any) {
      console.error('Failed to add vessel:', error);
      Alert.alert('Error', 'Failed to add vessel: ' + error.message);
    }
  };

  const handleActivateVessel = async (vesselId: string, vesselName: string) => {
    const message = activeVessel 
      ? `Start tracking ${vesselName}? This will deactivate ${activeVessel.vessel_name}.`
      : `Start tracking ${vesselName}? The app will monitor this vessel's AIS data.`;

    Alert.alert(
      'Activate Vessel',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            try {
              console.log('Activating vessel:', vesselId, '(will deactivate others)');
              await seaTimeApi.activateVessel(vesselId);
              await loadData();
              Alert.alert('Success', `${vesselName} is now being tracked`);
            } catch (error: any) {
              console.error('Failed to activate vessel:', error);
              Alert.alert('Error', 'Failed to activate vessel: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteVessel = async (vesselId: string, vesselName: string) => {
    Alert.alert(
      'Delete Vessel',
      `Are you sure you want to delete ${vesselName}? This will also delete all associated sea time entries.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting vessel:', vesselId);
              await seaTimeApi.deleteVessel(vesselId);
              await loadData();
              Alert.alert('Success', 'Vessel deleted');
            } catch (error: any) {
              console.error('Failed to delete vessel:', error);
              Alert.alert('Error', 'Failed to delete vessel: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const handleVesselPress = (vesselId: string) => {
    console.log('Navigating to vessel detail:', vesselId);
    router.push(`/vessel/${vesselId}` as any);
  };

  const convertToDMS = (decimal: number, isLatitude: boolean): string => {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesDecimal = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = ((minutesDecimal - minutes) * 60).toFixed(1);
    
    let direction = '';
    if (isLatitude) {
      direction = decimal >= 0 ? 'N' : 'S';
    } else {
      direction = decimal >= 0 ? 'E' : 'W';
    }
    
    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
  };

  const formatLocationDMS = (lat: number | null | undefined, lon: number | null | undefined): { lat: string; lon: string } | null => {
    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      return null;
    }
    return {
      lat: convertToDMS(lat, true),
      lon: convertToDMS(lon, false)
    };
  };

  const formatTimestamp = (timestamp: string | null | undefined): string => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = new Date(timestamp);
      // Format as: "15 Jan 2024, 14:30 UTC"
      const day = date.getUTCDate();
      const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const year = date.getUTCFullYear();
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      
      return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
    } catch (error) {
      console.error('Failed to format timestamp:', error);
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Image
              source={require('@/assets/images/c13cbd51-c2f7-489f-bbbb-6b28094d9b2b.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                SeaTime Tracker
              </Text>
              <Text style={styles.headerSubtitle}>Track Your Days at Sea with AIS</Text>
            </View>
          </View>
        </View>

        {/* Active Vessel Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Vessel</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add-circle"
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          {!activeVessel ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="ferry"
                android_material_icon_name="directions-boat"
                size={64}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
              <Text style={styles.emptyText}>No active vessel</Text>
              <Text style={styles.emptySubtext}>
                {historicVessels.length > 0 
                  ? 'Tap a vessel below to view details and activate it'
                  : 'Tap the + button to add your first vessel'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.vesselCard, styles.activeVesselCard]}
              onPress={() => handleVesselPress(activeVessel.id)}
            >
              <View style={styles.vesselHeader}>
                <View style={styles.vesselInfo}>
                  <View style={styles.activeVesselBadge}>
                    <View style={styles.activeIndicatorPulse} />
                    <Text style={styles.activeVesselBadgeText}>TRACKING</Text>
                  </View>
                  <Text style={styles.vesselName}>{activeVessel.vessel_name}</Text>
                  <Text style={styles.vesselMmsi}>MMSI: {activeVessel.mmsi}</Text>
                  
                  {/* Vessel Particulars */}
                  <View style={styles.vesselParticulars}>
                    {activeVessel.flag && (
                      <Text style={styles.vesselDetail}>Flag: {activeVessel.flag}</Text>
                    )}
                    {activeVessel.official_number && (
                      <Text style={styles.vesselDetail}>Official No.: {activeVessel.official_number}</Text>
                    )}
                    {activeVessel.vessel_type && (
                      <Text style={styles.vesselDetail}>Type: {activeVessel.vessel_type}</Text>
                    )}
                    {activeVessel.length_metres && (
                      <Text style={styles.vesselDetail}>Length: {activeVessel.length_metres}m</Text>
                    )}
                    {activeVessel.gross_tonnes && (
                      <Text style={styles.vesselDetail}>Gross Tonnes: {activeVessel.gross_tonnes}</Text>
                    )}
                  </View>

                  {/* Location in DMS format with timestamp */}
                  {locationLoading ? (
                    <Text style={styles.vesselLocation}>Loading location...</Text>
                  ) : activeVesselLocation && (activeVesselLocation.latitude !== null || activeVesselLocation.longitude !== null) ? (
                    (() => {
                      const dmsLocation = formatLocationDMS(activeVesselLocation.latitude, activeVesselLocation.longitude);
                      return dmsLocation ? (
                        <View style={styles.locationContainer}>
                          <Text style={styles.vesselLocation}>Lat: {dmsLocation.lat}</Text>
                          <Text style={styles.vesselLocation}>Lon: {dmsLocation.lon}</Text>
                          <Text style={styles.vesselTimestamp}>
                            {formatTimestamp(activeVesselLocation.timestamp)}
                          </Text>
                        </View>
                      ) : null;
                    })()
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Historic Vessels Section */}
        {historicVessels.length > 0 && (
          <View style={styles.section}>
            <View style={styles.historicHeader}>
              <Text style={styles.sectionTitle}>Historic Vessels</Text>
              <Text style={styles.sectionSubtitle}>
                Tap a vessel to view its history and activate it for tracking
              </Text>
            </View>
            {historicVessels.map((vessel) => (
              <React.Fragment key={vessel.id}>
                <TouchableOpacity
                  style={styles.vesselCard}
                  onPress={() => handleVesselPress(vessel.id)}
                >
                  <View style={styles.vesselHeader}>
                    <View style={styles.vesselInfo}>
                      <Text style={styles.vesselName}>{vessel.vessel_name}</Text>
                      <Text style={styles.vesselMmsi}>MMSI: {vessel.mmsi}</Text>
                      
                      {/* Vessel Particulars for historic vessels */}
                      <View style={styles.vesselParticulars}>
                        {vessel.flag && (
                          <Text style={styles.vesselDetail}>Flag: {vessel.flag}</Text>
                        )}
                        {vessel.official_number && (
                          <Text style={styles.vesselDetail}>Official No.: {vessel.official_number}</Text>
                        )}
                        {vessel.vessel_type && (
                          <Text style={styles.vesselDetail}>Type: {vessel.vessel_type}</Text>
                        )}
                        {vessel.length_metres && (
                          <Text style={styles.vesselDetail}>Length: {vessel.length_metres}m</Text>
                        )}
                        {vessel.gross_tonnes && (
                          <Text style={styles.vesselDetail}>Gross Tonnes: {vessel.gross_tonnes}</Text>
                        )}
                      </View>
                    </View>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="chevron-right"
                      size={24}
                      color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    />
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Vessel Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setModalVisible(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardView}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Vessel</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="cancel"
                    size={28}
                    color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vessel Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., MV Serenity"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newVesselName}
                    onChangeText={setNewVesselName}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>MMSI Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 235012345"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newMMSI}
                    onChangeText={setNewMMSI}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Flag</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., United Kingdom"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newFlag}
                    onChangeText={setNewFlag}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Official No.</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 123456"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newOfficialNumber}
                    onChangeText={setNewOfficialNumber}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Type (Motor/Sail)</Text>
                  <View style={styles.typeButtonContainer}>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        newVesselType === 'Motor' && styles.typeButtonActive
                      ]}
                      onPress={() => setNewVesselType('Motor')}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        newVesselType === 'Motor' && styles.typeButtonTextActive
                      ]}>
                        Motor
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        newVesselType === 'Sail' && styles.typeButtonActive
                      ]}
                      onPress={() => setNewVesselType('Sail')}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        newVesselType === 'Sail' && styles.typeButtonTextActive
                      ]}>
                        Sail
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Length (metres)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 45.5"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newLengthMetres}
                    onChangeText={setNewLengthMetres}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Gross Tonnes</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 500"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newGrossTonnes}
                    onChangeText={setNewGrossTonnes}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleAddVessel}
                  />
                </View>

                <TouchableOpacity style={styles.submitButton} onPress={handleAddVessel}>
                  <Text style={styles.submitButtonText}>Add Vessel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    loadingText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    header: {
      padding: 20,
      paddingTop: Platform.OS === 'android' ? 48 : 20,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    appIcon: {
      width: 53,
      height: 53,
      borderRadius: 12,
    },
    headerTextContainer: {
      flex: 1,
      minWidth: 0,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
    },
    headerSubtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 4,
    },
    section: {
      padding: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    historicHeader: {
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 4,
    },
    addButton: {
      padding: 4,
    },
    vesselCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    activeVesselCard: {
      borderLeftWidth: 4,
      borderLeftColor: colors.success,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
    },
    vesselHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    vesselInfo: {
      flex: 1,
    },
    activeVesselBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.success + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      alignSelf: 'flex-start',
      marginBottom: 8,
      gap: 6,
    },
    activeIndicatorPulse: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    activeVesselBadgeText: {
      fontSize: 11,
      fontWeight: 'bold',
      color: colors.success,
      letterSpacing: 0.5,
    },
    vesselName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    vesselMmsi: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 8,
    },
    vesselParticulars: {
      marginTop: 4,
      marginBottom: 8,
    },
    vesselDetail: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 2,
    },
    locationContainer: {
      marginTop: 4,
    },
    vesselLocation: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 1,
    },
    vesselTimestamp: {
      fontSize: 12,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontStyle: 'italic',
      marginTop: 2,
    },
    statusIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    statusActive: {
      backgroundColor: colors.success,
    },
    vesselActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    vesselButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 10,
      borderRadius: 8,
      gap: 6,
    },
    activateButton: {
      backgroundColor: colors.primary,
    },
    deleteButton: {
      backgroundColor: colors.error,
      flex: 0,
      paddingHorizontal: 12,
    },
    vesselButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    emptyState: {
      alignItems: 'center',
      padding: 40,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 8,
      textAlign: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    modalKeyboardView: {
      justifyContent: 'flex-end',
      maxHeight: SCREEN_HEIGHT * 0.85,
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      height: SCREEN_HEIGHT * 0.85,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
    },
    modalScrollView: {
      flex: 1,
    },
    modalScrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    input: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 8,
      padding: 14,
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    typeButtonContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    typeButton: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      alignItems: 'center',
    },
    typeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    typeButtonTextActive: {
      color: '#fff',
    },
    submitButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 12,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
}
</write file>

Now let me update the iOS version as well:

<write file="app/(tabs)/(home)/index.ios.tsx">
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  useColorScheme,
  RefreshControl,
  Platform,
  Image,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Vessel {
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

interface VesselLocation {
  latitude: number | null;
  longitude: number | null;
  timestamp: string | null;
}

export default function SeaTimeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newVesselName, setNewVesselName] = useState('');
  const [newMMSI, setNewMMSI] = useState('');
  const [newFlag, setNewFlag] = useState('');
  const [newOfficialNumber, setNewOfficialNumber] = useState('');
  const [newVesselType, setNewVesselType] = useState('');
  const [newLengthMetres, setNewLengthMetres] = useState('');
  const [newGrossTonnes, setNewGrossTonnes] = useState('');
  const [activeVesselLocation, setActiveVesselLocation] = useState<VesselLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark, insets.top);

  // Separate vessels into active and historic
  const activeVessel = vessels.find(v => v.is_active);
  const historicVessels = vessels.filter(v => !v.is_active);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeVessel) {
      loadActiveVesselLocation();
    } else {
      setActiveVesselLocation(null);
    }
  }, [activeVessel?.id]);

  const loadData = async () => {
    try {
      console.log('Loading vessels...');
      const vesselsData = await seaTimeApi.getVessels();
      setVessels(vesselsData);
      console.log('Data loaded successfully - Active vessels:', vesselsData.filter(v => v.is_active).length, 'Historic vessels:', vesselsData.filter(v => !v.is_active).length);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveVesselLocation = async () => {
    if (!activeVessel) {
      console.log('No active vessel to load location for');
      return;
    }

    try {
      setLocationLoading(true);
      console.log('Loading location for active vessel:', activeVessel.id);
      const locationData = await seaTimeApi.getVesselAISLocation(activeVessel.id, false);
      setActiveVesselLocation({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        timestamp: locationData.timestamp,
      });
      console.log('Active vessel location loaded:', locationData.latitude, locationData.longitude, 'timestamp:', locationData.timestamp);
    } catch (error: any) {
      console.error('Failed to load active vessel location:', error);
      // Don't show alert for location errors, just log them
      setActiveVesselLocation(null);
    } finally {
      setLocationLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (activeVessel) {
      await loadActiveVesselLocation();
    }
    setRefreshing(false);
  };

  const handleAddVessel = async () => {
    if (!newMMSI.trim() || !newVesselName.trim()) {
      Alert.alert('Error', 'Please enter both MMSI and vessel name');
      return;
    }

    try {
      console.log('Creating new vessel:', { 
        mmsi: newMMSI, 
        name: newVesselName,
        flag: newFlag,
        official_number: newOfficialNumber,
        vessel_type: newVesselType,
        length_metres: newLengthMetres,
        gross_tonnes: newGrossTonnes
      });
      
      await seaTimeApi.createVessel(
        newMMSI.trim(), 
        newVesselName.trim(), 
        false,
        newFlag.trim() || undefined,
        newOfficialNumber.trim() || undefined,
        newVesselType || undefined,
        newLengthMetres ? parseFloat(newLengthMetres) : undefined,
        newGrossTonnes ? parseFloat(newGrossTonnes) : undefined
      );
      
      setModalVisible(false);
      setNewMMSI('');
      setNewVesselName('');
      setNewFlag('');
      setNewOfficialNumber('');
      setNewVesselType('');
      setNewLengthMetres('');
      setNewGrossTonnes('');
      await loadData();
      Alert.alert('Success', 'Vessel added successfully');
    } catch (error: any) {
      console.error('Failed to add vessel:', error);
      Alert.alert('Error', 'Failed to add vessel: ' + error.message);
    }
  };

  const handleActivateVessel = async (vesselId: string, vesselName: string) => {
    const message = activeVessel 
      ? `Start tracking ${vesselName}? This will deactivate ${activeVessel.vessel_name}.`
      : `Start tracking ${vesselName}? The app will monitor this vessel's AIS data.`;

    Alert.alert(
      'Activate Vessel',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            try {
              console.log('Activating vessel:', vesselId, '(will deactivate others)');
              await seaTimeApi.activateVessel(vesselId);
              await loadData();
              Alert.alert('Success', `${vesselName} is now being tracked`);
            } catch (error: any) {
              console.error('Failed to activate vessel:', error);
              Alert.alert('Error', 'Failed to activate vessel: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteVessel = async (vesselId: string, vesselName: string) => {
    Alert.alert(
      'Delete Vessel',
      `Are you sure you want to delete ${vesselName}? This will also delete all associated sea time entries.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Deleting vessel:', vesselId);
              await seaTimeApi.deleteVessel(vesselId);
              await loadData();
              Alert.alert('Success', 'Vessel deleted');
            } catch (error: any) {
              console.error('Failed to delete vessel:', error);
              Alert.alert('Error', 'Failed to delete vessel: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const handleVesselPress = (vesselId: string) => {
    console.log('Navigating to vessel detail:', vesselId);
    router.push(`/vessel/${vesselId}` as any);
  };

  const convertToDMS = (decimal: number, isLatitude: boolean): string => {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesDecimal = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = ((minutesDecimal - minutes) * 60).toFixed(1);
    
    let direction = '';
    if (isLatitude) {
      direction = decimal >= 0 ? 'N' : 'S';
    } else {
      direction = decimal >= 0 ? 'E' : 'W';
    }
    
    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
  };

  const formatLocationDMS = (lat: number | null | undefined, lon: number | null | undefined): { lat: string; lon: string } | null => {
    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      return null;
    }
    return {
      lat: convertToDMS(lat, true),
      lon: convertToDMS(lon, false)
    };
  };

  const formatTimestamp = (timestamp: string | null | undefined): string => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = new Date(timestamp);
      // Format as: "15 Jan 2024, 14:30 UTC"
      const day = date.getUTCDate();
      const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      const year = date.getUTCFullYear();
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      
      return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
    } catch (error) {
      console.error('Failed to format timestamp:', error);
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Image
              source={require('@/assets/images/c13cbd51-c2f7-489f-bbbb-6b28094d9b2b.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
                SeaTime Tracker
              </Text>
              <Text style={styles.headerSubtitle}>Track Your Days at Sea with AIS</Text>
            </View>
          </View>
        </View>

        {/* Active Vessel Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Vessel</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add-circle"
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          {!activeVessel ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="ferry"
                android_material_icon_name="directions-boat"
                size={64}
                color={isDark ? colors.textSecondary : colors.textSecondaryLight}
              />
              <Text style={styles.emptyText}>No active vessel</Text>
              <Text style={styles.emptySubtext}>
                {historicVessels.length > 0 
                  ? 'Tap a vessel below to view details and activate it'
                  : 'Tap the + button to add your first vessel'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.vesselCard, styles.activeVesselCard]}
              onPress={() => handleVesselPress(activeVessel.id)}
            >
              <View style={styles.vesselHeader}>
                <View style={styles.vesselInfo}>
                  <View style={styles.activeVesselBadge}>
                    <View style={styles.activeIndicatorPulse} />
                    <Text style={styles.activeVesselBadgeText}>TRACKING</Text>
                  </View>
                  <Text style={styles.vesselName}>{activeVessel.vessel_name}</Text>
                  <Text style={styles.vesselMmsi}>MMSI: {activeVessel.mmsi}</Text>
                  
                  {/* Vessel Particulars */}
                  <View style={styles.vesselParticulars}>
                    {activeVessel.flag && (
                      <Text style={styles.vesselDetail}>Flag: {activeVessel.flag}</Text>
                    )}
                    {activeVessel.official_number && (
                      <Text style={styles.vesselDetail}>Official No.: {activeVessel.official_number}</Text>
                    )}
                    {activeVessel.vessel_type && (
                      <Text style={styles.vesselDetail}>Type: {activeVessel.vessel_type}</Text>
                    )}
                    {activeVessel.length_metres && (
                      <Text style={styles.vesselDetail}>Length: {activeVessel.length_metres}m</Text>
                    )}
                    {activeVessel.gross_tonnes && (
                      <Text style={styles.vesselDetail}>Gross Tonnes: {activeVessel.gross_tonnes}</Text>
                    )}
                  </View>

                  {/* Location in DMS format with timestamp */}
                  {locationLoading ? (
                    <Text style={styles.vesselLocation}>Loading location...</Text>
                  ) : activeVesselLocation && (activeVesselLocation.latitude !== null || activeVesselLocation.longitude !== null) ? (
                    (() => {
                      const dmsLocation = formatLocationDMS(activeVesselLocation.latitude, activeVesselLocation.longitude);
                      return dmsLocation ? (
                        <View style={styles.locationContainer}>
                          <Text style={styles.vesselLocation}>Lat: {dmsLocation.lat}</Text>
                          <Text style={styles.vesselLocation}>Lon: {dmsLocation.lon}</Text>
                          <Text style={styles.vesselTimestamp}>
                            {formatTimestamp(activeVesselLocation.timestamp)}
                          </Text>
                        </View>
                      ) : null;
                    })()
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Historic Vessels Section */}
        {historicVessels.length > 0 && (
          <View style={styles.section}>
            <View style={styles.historicHeader}>
              <Text style={styles.sectionTitle}>Historic Vessels</Text>
              <Text style={styles.sectionSubtitle}>
                Tap a vessel to view its history and activate it for tracking
              </Text>
            </View>
            {historicVessels.map((vessel) => (
              <React.Fragment key={vessel.id}>
                <TouchableOpacity
                  style={styles.vesselCard}
                  onPress={() => handleVesselPress(vessel.id)}
                >
                  <View style={styles.vesselHeader}>
                    <View style={styles.vesselInfo}>
                      <Text style={styles.vesselName}>{vessel.vessel_name}</Text>
                      <Text style={styles.vesselMmsi}>MMSI: {vessel.mmsi}</Text>
                      
                      {/* Vessel Particulars for historic vessels */}
                      <View style={styles.vesselParticulars}>
                        {vessel.flag && (
                          <Text style={styles.vesselDetail}>Flag: {vessel.flag}</Text>
                        )}
                        {vessel.official_number && (
                          <Text style={styles.vesselDetail}>Official No.: {vessel.official_number}</Text>
                        )}
                        {vessel.vessel_type && (
                          <Text style={styles.vesselDetail}>Type: {vessel.vessel_type}</Text>
                        )}
                        {vessel.length_metres && (
                          <Text style={styles.vesselDetail}>Length: {vessel.length_metres}m</Text>
                        )}
                        {vessel.gross_tonnes && (
                          <Text style={styles.vesselDetail}>Gross Tonnes: {vessel.gross_tonnes}</Text>
                        )}
                      </View>
                    </View>
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="chevron-right"
                      size={24}
                      color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    />
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Vessel Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setModalVisible(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardView}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Vessel</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <IconSymbol
                    ios_icon_name="xmark.circle.fill"
                    android_material_icon_name="cancel"
                    size={28}
                    color={isDark ? colors.textSecondary : colors.textSecondaryLight}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Vessel Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., MV Serenity"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newVesselName}
                    onChangeText={setNewVesselName}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>MMSI Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 235012345"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newMMSI}
                    onChangeText={setNewMMSI}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Flag</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., United Kingdom"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newFlag}
                    onChangeText={setNewFlag}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Official No.</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 123456"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newOfficialNumber}
                    onChangeText={setNewOfficialNumber}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Type (Motor/Sail)</Text>
                  <View style={styles.typeButtonContainer}>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        newVesselType === 'Motor' && styles.typeButtonActive
                      ]}
                      onPress={() => setNewVesselType('Motor')}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        newVesselType === 'Motor' && styles.typeButtonTextActive
                      ]}>
                        Motor
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeButton,
                        newVesselType === 'Sail' && styles.typeButtonActive
                      ]}
                      onPress={() => setNewVesselType('Sail')}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        newVesselType === 'Sail' && styles.typeButtonTextActive
                      ]}>
                        Sail
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Length (metres)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 45.5"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newLengthMetres}
                    onChangeText={setNewLengthMetres}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Gross Tonnes</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 500"
                    placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                    value={newGrossTonnes}
                    onChangeText={setNewGrossTonnes}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleAddVessel}
                  />
                </View>

                <TouchableOpacity style={styles.submitButton} onPress={handleAddVessel}>
                  <Text style={styles.submitButtonText}>Add Vessel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(isDark: boolean, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    loadingText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    header: {
      padding: 20,
      paddingTop: topInset + 12,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    appIcon: {
      width: 53,
      height: 53,
      borderRadius: 12,
    },
    headerTextContainer: {
      flex: 1,
      minWidth: 0,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
    },
    headerSubtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 4,
    },
    section: {
      padding: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    historicHeader: {
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 4,
    },
    addButton: {
      padding: 4,
    },
    vesselCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    activeVesselCard: {
      borderLeftWidth: 4,
      borderLeftColor: colors.success,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
    },
    vesselHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    vesselInfo: {
      flex: 1,
    },
    activeVesselBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.success + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      alignSelf: 'flex-start',
      marginBottom: 8,
      gap: 6,
    },
    activeIndicatorPulse: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
    },
    activeVesselBadgeText: {
      fontSize: 11,
      fontWeight: 'bold',
      color: colors.success,
      letterSpacing: 0.5,
    },
    vesselName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    vesselMmsi: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 8,
    },
    vesselParticulars: {
      marginTop: 4,
      marginBottom: 8,
    },
    vesselDetail: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 2,
    },
    locationContainer: {
      marginTop: 4,
    },
    vesselLocation: {
      fontSize: 13,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 1,
    },
    vesselTimestamp: {
      fontSize: 12,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      fontStyle: 'italic',
      marginTop: 2,
    },
    statusIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: isDark ? colors.textSecondary : colors.textSecondaryLight,
    },
    statusActive: {
      backgroundColor: colors.success,
    },
    vesselActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    vesselButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 10,
      borderRadius: 8,
      gap: 6,
    },
    activateButton: {
      backgroundColor: colors.primary,
    },
    deleteButton: {
      backgroundColor: colors.error,
      flex: 0,
      paddingHorizontal: 12,
    },
    vesselButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    emptyState: {
      alignItems: 'center',
      padding: 40,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginTop: 8,
      textAlign: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    modalKeyboardView: {
      justifyContent: 'flex-end',
      maxHeight: SCREEN_HEIGHT * 0.85,
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      height: SCREEN_HEIGHT * 0.85,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
    },
    modalScrollView: {
      flex: 1,
    },
    modalScrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 8,
    },
    input: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 8,
      padding: 14,
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    typeButtonContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    typeButton: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      alignItems: 'center',
    },
    typeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    typeButtonTextActive: {
      color: '#fff',
    },
    submitButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 12,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
}
