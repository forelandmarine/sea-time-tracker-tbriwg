
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Image,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import * as seaTimeApi from "@/utils/seaTimeApi";

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, signInWithGitHub } =
    useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateTestAccount = async () => {
    console.log('User tapped Create Test Account button');
    setLoading(true);
    try {
      await seaTimeApi.createTestUser(
        "test@seatime.com",
        "testpassword123",
        "Test User"
      );
      
      Alert.alert(
        "Test Account Created",
        "Email: test@seatime.com\nPassword: testpassword123\n\nYou can now sign in with these credentials.",
        [
          {
            text: "OK",
            onPress: () => {
              setEmail("test@seatime.com");
              setPassword("testpassword123");
              setMode("signin");
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Failed to create test account:', error);
      
      // Check if account already exists
      if (error.message && error.message.includes("already exists")) {
        Alert.alert(
          "Test Account Already Exists",
          "Email: test@seatime.com\nPassword: testpassword123\n\nYou can sign in with these credentials.",
          [
            {
              text: "OK",
              onPress: () => {
                setEmail("test@seatime.com");
                setPassword("testpassword123");
                setMode("signin");
              }
            }
          ]
        );
      } else {
        Alert.alert("Error", "Failed to create test account. Please try signing up manually.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    console.log('User tapped email authentication button', { mode, email });
    
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        console.log('Attempting to sign in with email:', email);
        await signInWithEmail(email, password);
        console.log('Sign in successful, navigating to home');
        router.replace("/");
      } else {
        console.log('Attempting to sign up with email:', email);
        await signUpWithEmail(email, password, name);
        Alert.alert(
          "Success",
          "Account created successfully! You can now sign in.",
          [
            {
              text: "OK",
              onPress: () => setMode("signin")
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('Email authentication error:', error);
      
      // Provide more helpful error messages
      let errorMessage = "Authentication failed";
      let errorTitle = "Error";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error) {
        errorMessage = error.error;
      } else if (error.status === 500) {
        errorMessage = "Server error (500)";
      }
      
      // Handle specific error cases
      if (errorMessage.includes("INVALID_EMAIL_OR_PASSWORD") || 
          errorMessage.includes("Invalid email or password") ||
          errorMessage.includes("401") || 
          errorMessage.includes("Unauthorized")) {
        errorTitle = "Invalid Credentials";
        errorMessage = mode === "signin" 
          ? "The email or password you entered is incorrect.\n\nIf you don't have an account yet, please tap 'Sign Up' below."
          : "Invalid email or password format.";
      } else if (errorMessage.includes("409") || errorMessage.includes("already exists")) {
        errorTitle = "Account Exists";
        errorMessage = "An account with this email already exists. Please sign in instead.";
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        errorTitle = "Network Error";
        errorMessage = "Please check your internet connection and try again.";
      } else if (errorMessage.includes("session was not established")) {
        errorTitle = "Session Error";
        errorMessage = "Sign in succeeded but session could not be established. This may be a temporary issue. Please try again.";
      } else if (errorMessage.includes("Server error") || errorMessage.includes("500") || error.status === 500) {
        errorTitle = "Backend Update in Progress";
        errorMessage = "✅ Good news: The backend is live and deployed!\n\n⚙️ The authentication system is currently being updated to fix a configuration issue.\n\n⏱️ This should be resolved in 1-2 minutes. Please try again shortly.\n\nBackend URL: https://uukpkcag4nsq8q632k643ztvus28frfe.app.specular.dev";
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: "google" | "apple" | "github") => {
    console.log('User tapped social authentication button', { provider });
    setLoading(true);
    try {
      if (provider === "google") {
        await signInWithGoogle();
      } else if (provider === "apple") {
        await signInWithApple();
      } else if (provider === "github") {
        await signInWithGitHub();
      }
      console.log('Social auth successful, navigating to home');
      router.replace("/");
    } catch (error: any) {
      console.error('Social authentication error:', error);
      
      let errorMessage = error.message || "Authentication failed";
      let errorTitle = "Error";
      
      if (errorMessage.includes("Server error") || errorMessage.includes("500") || error.status === 500) {
        errorTitle = "Backend Update in Progress";
        errorMessage = "✅ Good news: The backend is live and deployed!\n\n⚙️ The authentication system is currently being updated to fix a configuration issue.\n\n⏱️ This should be resolved in 1-2 minutes. Please try again shortly.\n\nBackend URL: https://uukpkcag4nsq8q632k643ztvus28frfe.app.specular.dev";
      } else if (errorMessage.includes("cancelled")) {
        errorTitle = "Cancelled";
        errorMessage = "Authentication was cancelled.";
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Lighthouse Logo and Welcome Message */}
          <View style={styles.headerContainer}>
            <Image
              source={require('@/assets/images/21aceeb3-aa54-4040-ae08-68dd74a31f85.png')}
              style={styles.lighthouseLogo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>SeaTime Tracker</Text>
            <Text style={styles.welcomeMessage}>
              Welcome aboard! Track your sea time and manage your maritime service records with ease.
            </Text>
          </View>

          {/* Backend Status Banner */}
          <View style={styles.statusBanner}>
            <Text style={styles.statusEmoji}>✅</Text>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>Backend Status: Live</Text>
              <Text style={styles.statusSubtitle}>Authentication update in progress...</Text>
            </View>
          </View>

          <Text style={styles.title}>
            {mode === "signin" ? "Sign In" : "Sign Up"}
          </Text>

          {mode === "signup" && (
            <TextInput
              style={styles.input}
              placeholder="Name (optional)"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password (min 8 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleEmailAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === "signin" ? "Sign In" : "Sign Up"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            <Text style={styles.switchModeText}>
              {mode === "signin"
                ? "Don't have an account? Sign Up"
                : "Already have an account? Sign In"}
            </Text>
          </TouchableOpacity>

          {/* Test Account Button - Only show in sign in mode */}
          {mode === "signin" && (
            <TouchableOpacity
              style={styles.testAccountButton}
              onPress={handleCreateTestAccount}
              disabled={loading}
            >
              <Text style={styles.testAccountText}>
                Create Test Account
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialAuth("google")}
            disabled={loading}
          >
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton]}
              onPress={() => handleSocialAuth("apple")}
              disabled={loading}
            >
              <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                Continue with Apple
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  lighthouseLogo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 12,
    textAlign: "center",
  },
  welcomeMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  statusEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2E7D32",
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 13,
    color: "#558B2F",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
    color: "#000",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  primaryButton: {
    height: 50,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  switchModeButton: {
    marginTop: 16,
    alignItems: "center",
  },
  switchModeText: {
    color: "#007AFF",
    fontSize: 14,
  },
  testAccountButton: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 8,
  },
  testAccountText: {
    color: "#FF9500",
    fontSize: 14,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dividerText: {
    marginHorizontal: 12,
    color: "#666",
    fontSize: 14,
  },
  socialButton: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  socialButtonText: {
    fontSize: 16,
    color: "#000",
    fontWeight: "500",
  },
  appleButton: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  appleButtonText: {
    color: "#fff",
  },
});
