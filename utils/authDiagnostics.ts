
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.backendUrl || '';

export interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export async function runAuthDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // Test 1: Check if backend URL is configured
  console.log('[Diagnostics] Test 1: Backend URL configuration');
  if (!API_URL) {
    results.push({
      test: 'Backend URL Configuration',
      status: 'fail',
      message: 'Backend URL is not configured in app.json',
      details: { backendUrl: API_URL },
    });
    return results; // Can't continue without backend URL
  } else {
    results.push({
      test: 'Backend URL Configuration',
      status: 'pass',
      message: `Backend URL configured: ${API_URL}`,
      details: { backendUrl: API_URL },
    });
  }

  // Test 2: Check if backend is reachable
  console.log('[Diagnostics] Test 2: Backend reachability');
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      results.push({
        test: 'Backend Reachability',
        status: 'pass',
        message: 'Backend is reachable',
        details: { status: response.status, statusText: response.statusText },
      });
    } else {
      results.push({
        test: 'Backend Reachability',
        status: 'warning',
        message: `Backend returned status ${response.status}`,
        details: { status: response.status, statusText: response.statusText },
      });
    }
  } catch (error: any) {
    results.push({
      test: 'Backend Reachability',
      status: 'fail',
      message: 'Failed to reach backend',
      details: { error: error.message },
    });
  }

  // Test 3: Check Better Auth endpoints
  console.log('[Diagnostics] Test 3: Better Auth endpoint availability');
  try {
    const response = await fetch(`${API_URL}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (response.ok || response.status === 401) {
      // 401 is expected if not authenticated
      results.push({
        test: 'Better Auth Endpoints',
        status: 'pass',
        message: 'Better Auth endpoints are accessible',
        details: { status: response.status },
      });
    } else {
      results.push({
        test: 'Better Auth Endpoints',
        status: 'warning',
        message: `Better Auth returned status ${response.status}`,
        details: { status: response.status, statusText: response.statusText },
      });
    }
  } catch (error: any) {
    results.push({
      test: 'Better Auth Endpoints',
      status: 'fail',
      message: 'Failed to access Better Auth endpoints',
      details: { error: error.message },
    });
  }

  // Test 4: Check if test user exists
  console.log('[Diagnostics] Test 4: Test user availability');
  try {
    const response = await fetch(`${API_URL}/api/users/debug/user/test@seatime.com`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.user) {
        results.push({
          test: 'Test User Availability',
          status: 'pass',
          message: 'Test user exists and is ready',
          details: { email: 'test@seatime.com', canSignIn: data.canSignIn },
        });
      } else {
        results.push({
          test: 'Test User Availability',
          status: 'warning',
          message: 'Test user does not exist',
          details: { email: 'test@seatime.com' },
        });
      }
    } else {
      results.push({
        test: 'Test User Availability',
        status: 'warning',
        message: 'Could not check test user status',
        details: { status: response.status },
      });
    }
  } catch (error: any) {
    results.push({
      test: 'Test User Availability',
      status: 'fail',
      message: 'Failed to check test user',
      details: { error: error.message },
    });
  }

  // Test 5: Try a direct sign-in API call
  console.log('[Diagnostics] Test 5: Direct sign-in API test');
  try {
    const response = await fetch(`${API_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: 'test@seatime.com',
        password: 'testpassword123',
      }),
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    if (response.ok) {
      results.push({
        test: 'Direct Sign-In API Test',
        status: 'pass',
        message: 'Sign-in API is working correctly',
        details: { status: response.status, hasSession: !!responseData.user },
      });
    } else if (response.status === 401) {
      results.push({
        test: 'Direct Sign-In API Test',
        status: 'warning',
        message: 'Sign-in API returned 401 (invalid credentials or user not found)',
        details: { status: response.status, response: responseData },
      });
    } else {
      results.push({
        test: 'Direct Sign-In API Test',
        status: 'fail',
        message: `Sign-in API returned error ${response.status}`,
        details: { status: response.status, response: responseData },
      });
    }
  } catch (error: any) {
    results.push({
      test: 'Direct Sign-In API Test',
      status: 'fail',
      message: 'Failed to call sign-in API',
      details: { error: error.message },
    });
  }

  console.log('[Diagnostics] All tests complete');
  return results;
}
