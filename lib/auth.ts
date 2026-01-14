
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

const API_URL = Constants.expoConfig?.extra?.backendUrl || "";

console.log("[Auth Client] Initializing with backend URL:", API_URL);

if (!API_URL) {
  console.error("[Auth Client] ❌ Backend URL is not configured in app.json!");
  console.error("[Auth Client] Please add 'backendUrl' to app.json extra config");
}

const BEARER_TOKEN_KEY = "seatime-tracker_bearer_token";

// Platform-specific storage: localStorage for web, SecureStore for native
const storage = Platform.OS === "web"
  ? {
      getItem: (key: string) => {
        const value = localStorage.getItem(key);
        console.log(`[Auth Storage] getItem(${key}):`, value ? 'found' : 'not found');
        return value;
      },
      setItem: (key: string, value: string) => {
        console.log(`[Auth Storage] setItem(${key})`);
        localStorage.setItem(key, value);
      },
      deleteItem: (key: string) => {
        console.log(`[Auth Storage] deleteItem(${key})`);
        localStorage.removeItem(key);
      },
    }
  : SecureStore;

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "seatimetracker",
      storagePrefix: "seatime-tracker",
      storage,
    }),
  ],
  fetchOptions: {
    credentials: "include",
    onError(context) {
      console.error("[Auth Client] ❌ Request error");
      console.error("[Auth Client] URL:", context.request?.url);
      console.error("[Auth Client] Method:", context.request?.method);
      console.error("[Auth Client] Error:", context.error);
      console.error("[Auth Client] Error details:", JSON.stringify(context.error, null, 2));
      
      // Log the full request details
      if (context.request) {
        console.error("[Auth Client] Request headers:", JSON.stringify(Object.fromEntries(context.request.headers.entries()), null, 2));
      }
    },
    onSuccess(context) {
      console.log("[Auth Client] ✅ Request successful");
      console.log("[Auth Client] URL:", context.request?.url);
      console.log("[Auth Client] Status:", context.response.status);
      console.log("[Auth Client] Response headers:", JSON.stringify(Object.fromEntries(context.response.headers.entries()), null, 2));
    },
    onRequest(context) {
      console.log("[Auth Client] 📤 Sending request");
      console.log("[Auth Client] URL:", context.url);
      console.log("[Auth Client] Method:", context.method);
      console.log("[Auth Client] Headers:", JSON.stringify(context.headers, null, 2));
      
      // Log body for POST requests (but mask passwords)
      if (context.body && context.method === 'POST') {
        try {
          const bodyObj = JSON.parse(context.body as string);
          if (bodyObj.password) {
            bodyObj.password = '***MASKED***';
          }
          console.log("[Auth Client] Body:", JSON.stringify(bodyObj, null, 2));
        } catch {
          console.log("[Auth Client] Body: (unable to parse)");
        }
      }
    },
  },
});

console.log("[Auth Client] ✅ Auth client initialized");
console.log("[Auth Client] Base URL:", API_URL);
console.log("[Auth Client] Platform:", Platform.OS);
console.log("[Auth Client] Scheme:", "seatimetracker");

export function storeWebBearerToken(token: string) {
  if (Platform.OS === "web") {
    console.log("[Auth Client] Storing bearer token in localStorage");
    localStorage.setItem(BEARER_TOKEN_KEY, token);
  }
}

export function clearAuthTokens() {
  if (Platform.OS === "web") {
    console.log("[Auth Client] Clearing bearer token from localStorage");
    localStorage.removeItem(BEARER_TOKEN_KEY);
  }
}

export { API_URL };
