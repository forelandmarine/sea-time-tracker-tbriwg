/**
 * Paywall Screen
 *
 * Shows subscription options and handles purchases.
 * On web, displays features and prompts user to download the app.
 * Customize the FEATURES array and styling for your app.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { PurchasesPackage } from "react-native-purchases";

import { useSubscription } from "@/contexts/SubscriptionContext";

// Customize: Your app's premium features
const FEATURES = [
  {
    icon: "star",
    title: "Premium Feature 1",
    description: "Description of your first premium feature",
  },
  {
    icon: "zap",
    title: "Premium Feature 2",
    description: "Description of your second premium feature",
  },
  {
    icon: "shield",
    title: "Premium Feature 3",
    description: "Description of your third premium feature",
  },
  {
    icon: "cloud",
    title: "Premium Feature 4",
    description: "Description of your fourth premium feature",
  },
];

// Customize: Your app's colors
const colors = {
  primary: "#007AFF",
  success: "#34C759",
  warning: "#FF9500",
};

export default function PaywallScreen() {
  const router = useRouter();

  // Get subscription state and methods from context
  const {
    packages,
    loading,
    isSubscribed,
    isWeb,
    purchasePackage,
    restorePurchases,
  } = useSubscription();

  const [selectedPackage, setSelectedPackage] =
    useState<PurchasesPackage | null>(packages[0] || null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Update selected package when packages load
  React.useEffect(() => {
    if (packages.length > 0 && !selectedPackage) {
      setSelectedPackage(packages[0]);
    }
  }, [packages, selectedPackage]);

  // Handle purchase
  const handlePurchase = async () => {
    if (!selectedPackage) return;

    try {
      setPurchasing(true);
      const success = await purchasePackage(selectedPackage);
      if (success) {
        Alert.alert("Welcome!", "Thank you for your purchase.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      Alert.alert("Purchase Failed", error.message || "Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  // Handle restore
  const handleRestore = async () => {
    try {
      setRestoring(true);
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert("Restored!", "Your subscription has been restored.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(
          "No Purchases Found",
          "We couldn't find any previous purchases."
        );
      }
    } catch (error: any) {
      Alert.alert("Restore Failed", error.message || "Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  // Handle app store links for web
  const handleDownloadApp = () => {
    // TODO: Replace with your actual app store URLs
    const iosUrl = "https://apps.apple.com/app/your-app-id";
    const androidUrl = "https://play.google.com/store/apps/details?id=your.app.id";

    // On web, we can't detect which device the user has, so show both options
    Alert.alert(
      "Download the App",
      "To subscribe, please download our app from your device's app store.",
      [
        { text: "App Store (iOS)", onPress: () => Linking.openURL(iosUrl) },
        { text: "Google Play", onPress: () => Linking.openURL(androidUrl) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  // Already subscribed - show confirmation
  if (isSubscribed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContainer}>
          <Text style={styles.title}>You're Subscribed!</Text>
          <Text style={styles.subtitle}>
            You have access to all premium features.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleClose}>
            <Text style={styles.primaryButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Close Button */}
      <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
        <Text style={styles.closeButtonText}>x</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Upgrade to Premium</Text>
          <Text style={styles.subtitle}>
            Unlock all features and get the most out of the app
          </Text>
        </View>

        {/* Features List */}
        <View style={styles.featuresContainer}>
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>{feature.icon}</Text>
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Web platform message */}
        {isWeb && (
          <View style={styles.webMessageContainer}>
            <Text style={styles.webMessageTitle}>📱 Download the App</Text>
            <Text style={styles.webMessageText}>
              In-app purchases are only available in our mobile app.
              Download the app to subscribe and unlock all premium features.
            </Text>
          </View>
        )}

        {/* Package Selection - only show on native */}
        {!isWeb && packages.length > 0 && (
          <View style={styles.packagesContainer}>
            {packages.map((pkg) => {
              const isSelected = selectedPackage?.identifier === pkg.identifier;
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[
                    styles.packageCard,
                    isSelected && styles.packageCardSelected,
                  ]}
                  onPress={() => setSelectedPackage(pkg)}
                >
                  <View style={styles.packageHeader}>
                    <Text style={styles.packageTitle}>{pkg.product.title}</Text>
                    {isSelected && <Text style={styles.checkmark}>check</Text>}
                  </View>
                  <Text style={styles.packagePrice}>
                    {pkg.product.priceString}
                  </Text>
                  {pkg.product.description && (
                    <Text style={styles.packageDescription}>
                      {pkg.product.description}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* No packages available - only show on native */}
        {!isWeb && packages.length === 0 && !loading && (
          <View style={styles.noPackagesContainer}>
            <Text style={styles.noPackagesText}>
              No subscription options available at this time.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        {/* Web: Show download button */}
        {isWeb ? (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleDownloadApp}
            >
              <Text style={styles.primaryButtonText}>Download App to Subscribe</Text>
            </TouchableOpacity>
            <Text style={styles.legalText}>
              Subscriptions are managed through the App Store or Google Play.
              Download our app to subscribe and access premium features.
            </Text>
          </>
        ) : (
          <>
            {/* Native: Subscribe Button */}
            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!selectedPackage || purchasing) && styles.buttonDisabled,
              ]}
              onPress={handlePurchase}
              disabled={!selectedPackage || purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {selectedPackage
                    ? `Subscribe for ${selectedPackage.product.priceString}`
                    : "Select a plan"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Restore Button */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRestore}
              disabled={restoring}
            >
              {restoring ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
              )}
            </TouchableOpacity>

            {/* Legal Text - Required by App Store */}
            <Text style={styles.legalText}>
              Payment will be charged to your{" "}
              {Platform.OS === "ios" ? "Apple ID" : "Google Play"} account.
              Subscription automatically renews unless canceled at least 24 hours
              before the end of the current period.
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
  },
  closeButton: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 18,
    color: "#666",
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
  },
  featuresContainer: {
    gap: 16,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  featureIconText: {
    fontSize: 20,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  featureDescription: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  packagesContainer: {
    gap: 12,
  },
  packageCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  packageCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  packageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  checkmark: {
    fontSize: 20,
    color: colors.primary,
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.primary,
    marginTop: 8,
  },
  packageDescription: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  noPackagesContainer: {
    padding: 24,
    alignItems: "center",
  },
  noPackagesText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  webMessageContainer: {
    backgroundColor: "#F0F7FF",
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#D0E3FF",
  },
  webMessageTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
    textAlign: "center",
  },
  webMessageText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  bottomActions: {
    padding: 24,
    paddingBottom: 32,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    color: colors.primary,
  },
  legalText: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    lineHeight: 16,
  },
});
