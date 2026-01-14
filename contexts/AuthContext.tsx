
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import { authClient, storeWebBearerToken } from "@/lib/auth";

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function openOAuthPopup(provider: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popupUrl = `${window.location.origin}/auth-popup?provider=${provider}`;
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      popupUrl,
      "oauth-popup",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );

    if (!popup) {
      reject(new Error("Failed to open popup. Please allow popups."));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "oauth-success" && event.data?.token) {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        resolve(event.data.token);
      } else if (event.data?.type === "oauth-error") {
        window.removeEventListener("message", handleMessage);
        clearInterval(checkClosed);
        reject(new Error(event.data.error || "OAuth failed"));
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        reject(new Error("Authentication cancelled"));
      }
    }, 500);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      console.log("[AuthContext] Fetching user session...");
      setLoading(true);
      
      const session = await authClient.getSession();
      console.log("[AuthContext] Session response:", JSON.stringify(session, null, 2));
      
      if (session?.data?.user) {
        console.log("[AuthContext] User found:", session.data.user.email);
        setUser(session.data.user as User);
      } else {
        console.log("[AuthContext] No user in session");
        setUser(null);
      }
    } catch (error: any) {
      console.error("[AuthContext] Failed to fetch user:", error);
      console.error("[AuthContext] Error details:", JSON.stringify(error, null, 2));
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      console.log("[AuthContext] ========================================");
      console.log("[AuthContext] Starting email sign-in for:", email);
      console.log("[AuthContext] ========================================");
      
      const result = await authClient.signIn.email({ 
        email, 
        password,
        fetchOptions: {
          onSuccess: async (context) => {
            console.log("[AuthContext] ✅ Sign in API call successful");
            console.log("[AuthContext] Response status:", context.response.status);
            console.log("[AuthContext] Response headers:", JSON.stringify(Object.fromEntries(context.response.headers.entries()), null, 2));
            
            // Give the backend a moment to set the session cookie
            await new Promise(resolve => setTimeout(resolve, 500));
          },
          onError: (context) => {
            console.error("[AuthContext] ❌ Sign in API call failed");
            console.error("[AuthContext] Error:", context.error);
            console.error("[AuthContext] Error details:", JSON.stringify(context.error, null, 2));
          }
        }
      });
      
      console.log("[AuthContext] Sign in result:", JSON.stringify(result, null, 2));
      
      // Check if there was an error in the result
      if (result.error) {
        console.error("[AuthContext] ❌ Sign in returned error:", result.error);
        
        // Provide more specific error messages
        if (result.error.message?.includes("Invalid") || result.error.message?.includes("401")) {
          throw new Error("INVALID_EMAIL_OR_PASSWORD");
        }
        
        throw result.error;
      }
      
      // Wait a bit for the session to be established
      console.log("[AuthContext] Waiting for session to be established...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch the user session
      console.log("[AuthContext] Fetching user session after sign-in...");
      await fetchUser();
      
      // Verify we got the user
      const session = await authClient.getSession();
      console.log("[AuthContext] Session after sign-in:", JSON.stringify(session, null, 2));
      
      if (!session?.data?.user) {
        console.error("[AuthContext] ❌ Session was not established after sign-in");
        throw new Error("Sign in succeeded but session was not established. Please try again.");
      }
      
      console.log("[AuthContext] ✅ Sign in complete, user:", session.data.user.email);
      console.log("[AuthContext] ========================================");
    } catch (error: any) {
      console.error("[AuthContext] ========================================");
      console.error("[AuthContext] ❌ Email sign in failed");
      console.error("[AuthContext] Error:", error);
      console.error("[AuthContext] Error message:", error.message);
      console.error("[AuthContext] Error code:", error.code);
      console.error("[AuthContext] Full error:", JSON.stringify(error, null, 2));
      console.error("[AuthContext] ========================================");
      
      // Re-throw with a more user-friendly message
      if (error.code === "INVALID_EMAIL_OR_PASSWORD" || 
          error.message?.includes("INVALID_EMAIL_OR_PASSWORD") ||
          error.message?.includes("Invalid email or password")) {
        throw new Error("INVALID_EMAIL_OR_PASSWORD");
      }
      
      // If it's a 500 error, provide a helpful message
      if (error.message?.includes("500") || error.status === 500) {
        throw new Error("Server error during sign-in. The backend may be updating. Please try again in a moment.");
      }
      
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    try {
      console.log("[AuthContext] ========================================");
      console.log("[AuthContext] Starting email sign-up for:", email);
      console.log("[AuthContext] ========================================");
      
      const result = await authClient.signUp.email({
        email,
        password,
        name,
        fetchOptions: {
          onSuccess: async (context) => {
            console.log("[AuthContext] ✅ Sign up API call successful");
            console.log("[AuthContext] Response status:", context.response.status);
          },
          onError: (context) => {
            console.error("[AuthContext] ❌ Sign up API call failed");
            console.error("[AuthContext] Error:", context.error);
          }
        }
      });
      
      console.log("[AuthContext] Sign up result:", JSON.stringify(result, null, 2));
      
      // Check if there was an error in the result
      if (result.error) {
        console.error("[AuthContext] ❌ Sign up returned error:", result.error);
        throw result.error;
      }
      
      console.log("[AuthContext] ✅ Sign up complete");
      console.log("[AuthContext] ========================================");
      
      // Don't auto-fetch user after signup - let them sign in
    } catch (error: any) {
      console.error("[AuthContext] ========================================");
      console.error("[AuthContext] ❌ Email sign up failed");
      console.error("[AuthContext] Error:", error);
      console.error("[AuthContext] Full error:", JSON.stringify(error, null, 2));
      console.error("[AuthContext] ========================================");
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log("[AuthContext] ========================================");
      console.log("[AuthContext] Starting Google sign-in");
      console.log("[AuthContext] Platform:", Platform.OS);
      console.log("[AuthContext] ========================================");
      
      if (Platform.OS === "web") {
        const token = await openOAuthPopup("google");
        storeWebBearerToken(token);
        await fetchUser();
      } else {
        await authClient.signIn.social({
          provider: "google",
          callbackURL: "/",
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchUser();
      }
      
      console.log("[AuthContext] ✅ Google sign-in complete");
      console.log("[AuthContext] ========================================");
    } catch (error: any) {
      console.error("[AuthContext] ========================================");
      console.error("[AuthContext] ❌ Google sign in failed");
      console.error("[AuthContext] Error:", error);
      console.error("[AuthContext] Full error:", JSON.stringify(error, null, 2));
      console.error("[AuthContext] ========================================");
      throw error;
    }
  };

  const signInWithApple = async () => {
    try {
      console.log("[AuthContext] ========================================");
      console.log("[AuthContext] Starting Apple sign-in");
      console.log("[AuthContext] Platform:", Platform.OS);
      console.log("[AuthContext] ========================================");
      
      if (Platform.OS === "web") {
        const token = await openOAuthPopup("apple");
        storeWebBearerToken(token);
        await fetchUser();
      } else {
        console.log("[AuthContext] Initiating Apple OAuth flow...");
        await authClient.signIn.social({
          provider: "apple",
          callbackURL: "/",
        });
        console.log("[AuthContext] Apple OAuth initiated, waiting for callback...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchUser();
      }
      
      console.log("[AuthContext] ✅ Apple sign-in complete");
      console.log("[AuthContext] ========================================");
    } catch (error: any) {
      console.error("[AuthContext] ========================================");
      console.error("[AuthContext] ❌ Apple sign in failed");
      console.error("[AuthContext] Error:", error);
      console.error("[AuthContext] Error message:", error.message);
      console.error("[AuthContext] Full error:", JSON.stringify(error, null, 2));
      console.error("[AuthContext] ========================================");
      
      // Provide a more helpful error message
      if (error.message?.includes("500")) {
        throw new Error("Server error during Apple sign-in. The backend may be updating. Please try again in a moment.");
      }
      
      throw error;
    }
  };

  const signInWithGitHub = async () => {
    try {
      console.log("[AuthContext] ========================================");
      console.log("[AuthContext] Starting GitHub sign-in");
      console.log("[AuthContext] Platform:", Platform.OS);
      console.log("[AuthContext] ========================================");
      
      if (Platform.OS === "web") {
        const token = await openOAuthPopup("github");
        storeWebBearerToken(token);
        await fetchUser();
      } else {
        await authClient.signIn.social({
          provider: "github",
          callbackURL: "/",
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchUser();
      }
      
      console.log("[AuthContext] ✅ GitHub sign-in complete");
      console.log("[AuthContext] ========================================");
    } catch (error: any) {
      console.error("[AuthContext] ========================================");
      console.error("[AuthContext] ❌ GitHub sign in failed");
      console.error("[AuthContext] Error:", error);
      console.error("[AuthContext] Full error:", JSON.stringify(error, null, 2));
      console.error("[AuthContext] ========================================");
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log("[AuthContext] Signing out");
      await authClient.signOut();
      setUser(null);
      console.log("[AuthContext] ✅ Sign out complete");
    } catch (error: any) {
      console.error("[AuthContext] ❌ Sign out failed:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithApple,
        signInWithGitHub,
        signOut,
        fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
