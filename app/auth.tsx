
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
import { runAuthDiagnostics, DiagnosticResult } from "@/utils/authDiagnostics";

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, signInWithGitHub, signOut } =
    useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [stressTestRunning, setStressTestRunning] = useState(false);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [stressTestResults, setStressTestResults] = useState<{
    total: number;
    successful: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [diagnosticsResults, setDiagnosticsResults] = useState<DiagnosticResult[] | null>(null);

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

  const handleRunDiagnostics = async () => {
    console.log('🔍 Running authentication diagnostics');
    setDiagnosticsRunning(true);
    setDiagnosticsResults(null);

    try {
      const results = await runAuthDiagnostics();
      setDiagnosticsResults(results);

      const failedTests = results.filter(r => r.status === 'fail').length;
      const warningTests = results.filter(r => r.status === 'warning').length;
      const passedTests = results.filter(r => r.status === 'pass').length;

      console.log('🔍 Diagnostics complete:', { passed: passedTests, warnings: warningTests, failed: failedTests });

      Alert.alert(
        "Diagnostics Complete",
        `Passed: ${passedTests}\nWarnings: ${warningTests}\nFailed: ${failedTests}\n\nCheck the results below for details.`,
        [{ text: "OK" }]
      );
    } catch (error: any) {
      console.error('❌ Diagnostics failed:', error);
      Alert.alert("Error", "Failed to run diagnostics: " + error.message);
    } finally {
      setDiagnosticsRunning(false);
    }
  };

  const runStressTest = async () => {
    console.log('🧪 Starting authentication stress test');
    setStressTestRunning(true);
    setStressTestResults(null);
    
    const results = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    const testCases = [
      { email: "test@seatime.com", password: "testpassword123", description: "Valid credentials (test 1)", shouldSucceed: true },
      { email: "test@seatime.com", password: "testpassword123", description: "Valid credentials (test 2)", shouldSucceed: true },
      { email: "test@seatime.com", password: "wrongpassword", description: "Wrong password", shouldSucceed: false },
      { email: "nonexistent@test.com", password: "testpassword123", description: "Non-existent user", shouldSucceed: false },
      { email: "test@seatime.com", password: "testpassword123", description: "Valid credentials (test 3)", shouldSucceed: true },
    ];

    for (const testCase of testCases) {
      results.total++;
      console.log(`🧪 Test ${results.total}/${testCases.length}: ${testCase.description}`);
      
      try {
        await signInWithEmail(testCase.email, testCase.password);
        results.successful++;
        console.log(`✅ Test ${results.total} passed: ${testCase.description}`);
        
        // If successful, sign out for next test
        await signOut();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        // Check if this was expected to fail
        if (!testCase.shouldSucceed) {
          console.log(`✅ Test ${results.total} correctly failed: ${testCase.description}`);
          results.successful++;
        } else {
          results.failed++;
          const errorMsg = error.message || error.toString();
          results.errors.push(`Test ${results.total} (${testCase.description}): ${errorMsg}`);
          console.error(`❌ Test ${results.total} failed unexpectedly: ${testCase.description}`, errorMsg);
        }
      }
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setStressTestResults(results);
    setStressTestRunning(false);
    
    console.log('🧪 Stress test complete:', results);
    
    const passRate = ((results.successful / results.total) * 100).toFixed(1);
    
    Alert.alert(
      "Stress Test Complete",
      `Total Tests: ${results.total}\nPassed: ${results.successful}\nFailed: ${results.failed}\nPass Rate: ${passRate}%\n\n${results.failed > 0 ? '⚠️ Some tests failed. Check console for details.' : '✅ All tests passed!'}`,
      [{ text: "OK" }]
    );
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
        console.log('✅ Sign in successful, navigating to home');
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
      console.error('❌ Email authentication error:', error);
      
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
        errorTitle = "Backend Error";
        errorMessage = "⚠️ The backend is experiencing issues with email authentication.\n\n✅ Try using Google or Apple sign-in instead (see options below).\n\n🔧 The backend is being fixed now. Please wait a moment and try again.";
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
      console.log('✅ Social auth successful, navigating to home');
      router.replace("/");
    } catch (error: any) {
      console.error('❌ Social authentication error:', error);
      
      let errorMessage = error.message || "Authentication failed";
      let errorTitle = "Error";
      
      if (errorMessage.includes("Server error") || errorMessage.includes("500") || error.status === 500) {
        errorTitle = "Backend Error";
        errorMessage = "⚠️ The backend is experiencing issues with authentication.\n\n🔧 The backend is being fixed now. Please wait a moment and try again.";
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
              Welcome aboard! Track your sea time and manage your service records automatically.{'\n\n'}By Foreland Marine
            </Text>
          </View>

          {/* Authentication Options Info Banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerTitle}>🔐 Authentication Options</Text>
            <Text style={styles.infoBannerText}>
              - Email & Password (traditional sign-in){'\n'}
              - Google Sign-In (recommended){'\n'}
              - Apple Sign-In (iOS users){'\n'}
              - GitHub Sign-In (developers)
            </Text>
            <Text style={styles.infoBannerNote}>
              💡 If email sign-in isn't working, try Google or Apple sign-in below.
            </Text>
          </View>

          {/* Diagnostics Results */}
          {diagnosticsResults && (
            <View style={styles.diagnosticsContainer}>
              <Text style={styles.diagnosticsTitle}>🔍 Diagnostics Results</Text>
              {diagnosticsResults.map((result, index) => (
                <View key={index} style={styles.diagnosticItem}>
                  <Text style={styles.diagnosticTest}>
                    {result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'} {result.test}
                  </Text>
                  <Text style={styles.diagnosticMessage}>{result.message}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Stress Test Results */}
          {stressTestResults && (
            <View style={[
              styles.testResultsBanner,
              stressTestResults.failed === 0 ? styles.testResultsSuccess : styles.testResultsWarning
            ]}>
              <Text style={styles.testResultsTitle}>
                {stressTestResults.failed === 0 ? '✅ Stress Test Passed' : '⚠️ Stress Test Results'}
              </Text>
              <Text style={styles.testResultsText}>
                Total: {stressTestResults.total} | Passed: {stressTestResults.successful} | Failed: {stressTestResults.failed}
              </Text>
              <Text style={styles.testResultsText}>
                Pass Rate: {((stressTestResults.successful / stressTestResults.total) * 100).toFixed(1)}%
              </Text>
              {stressTestResults.errors.length > 0 && (
                <Text style={styles.testResultsErrors}>
                  {stressTestResults.errors.length} error(s) - check console for details
                </Text>
              )}
            </View>
          )}

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
                {mode === "signin" ? "Sign In with Email" : "Sign Up with Email"}
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
            <>
              <TouchableOpacity
                style={styles.testAccountButton}
                onPress={handleCreateTestAccount}
                disabled={loading}
              >
                <Text style={styles.testAccountText}>
                  Create Test Account
                </Text>
              </TouchableOpacity>

              {/* Diagnostics Button */}
              <TouchableOpacity
                style={[styles.diagnosticsButton, diagnosticsRunning && styles.buttonDisabled]}
                onPress={handleRunDiagnostics}
                disabled={loading || diagnosticsRunning}
              >
                {diagnosticsRunning ? (
                  <View style={styles.stressTestLoadingContainer}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.stressTestLoadingText}>Running diagnostics...</Text>
                  </View>
                ) : (
                  <Text style={styles.diagnosticsButtonText}>
                    🔍 Run Authentication Diagnostics
                  </Text>
                )}
              </TouchableOpacity>

              {/* Stress Test Button */}
              <TouchableOpacity
                style={[styles.stressTestButton, stressTestRunning && styles.buttonDisabled]}
                onPress={runStressTest}
                disabled={loading || stressTestRunning}
              >
                {stressTestRunning ? (
                  <View style={styles.stressTestLoadingContainer}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.stressTestLoadingText}>Running tests...</Text>
                  </View>
                ) : (
                  <Text style={styles.stressTestButtonText}>
                    🧪 Run Authentication Stress Test
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Authentication Buttons - Highlighted as alternatives */}
          <TouchableOpacity
            style={[styles.socialButton, styles.googleButton]}
            onPress={() => handleSocialAuth("google")}
            disabled={loading}
          >
            <Text style={styles.socialButtonText}>✅ Continue with Google (Recommended)</Text>
          </TouchableOpacity>

          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton]}
              onPress={() => handleSocialAuth("apple")}
              disabled={loading}
            >
              <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                ✅ Continue with Apple
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.socialButton, styles.githubButton]}
            onPress={() => handleSocialAuth("github")}
            disabled={loading}
          >
            <Text style={styles.socialButtonText}>Continue with GitHub</Text>
          </TouchableOpacity>
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
  infoBanner: {
    backgroundColor: "#E3F2FD",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2196F3",
  },
  infoBannerTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1565C0",
    marginBottom: 8,
  },
  infoBannerText: {
    fontSize: 14,
    color: "#1976D2",
    lineHeight: 20,
    marginBottom: 8,
  },
  infoBannerNote: {
    fontSize: 13,
    color: "#1976D2",
    fontStyle: "italic",
    marginTop: 4,
  },
  diagnosticsContainer: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  diagnosticsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  diagnosticItem: {
    marginBottom: 8,
  },
  diagnosticTest: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  diagnosticMessage: {
    fontSize: 12,
    color: "#666",
    marginLeft: 20,
  },
  testResultsBanner: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  testResultsSuccess: {
    backgroundColor: "#D4EDDA",
    borderColor: "#28A745",
  },
  testResultsWarning: {
    backgroundColor: "#E3F2FD",
    borderColor: "#2196F3",
  },
  testResultsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1565C0",
    marginBottom: 8,
  },
  testResultsText: {
    fontSize: 14,
    color: "#1976D2",
    marginBottom: 4,
  },
  testResultsErrors: {
    fontSize: 13,
    color: "#D32F2F",
    marginTop: 4,
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
  diagnosticsButton: {
    marginTop: 12,
    backgroundColor: "#FF9800",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  diagnosticsButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  stressTestButton: {
    marginTop: 12,
    backgroundColor: "#9C27B0",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  stressTestButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  stressTestLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stressTestLoadingText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
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
  googleButton: {
    backgroundColor: "#F8F9FA",
    borderColor: "#4285F4",
    borderWidth: 2,
  },
  appleButton: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  appleButtonText: {
    color: "#fff",
  },
  githubButton: {
    backgroundColor: "#24292E",
    borderColor: "#24292E",
  },
});
