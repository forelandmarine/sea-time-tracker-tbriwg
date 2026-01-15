
import { IconSymbol } from '@/components/IconSymbol';
import * as seaTimeApi from '@/utils/seaTimeApi';
import React, { useState, useEffect } from 'react';
import { colors } from '@/styles/commonStyles';
import * as ImagePicker from 'expo-image-picker';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useColorScheme,
  Platform,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Stack, useRouter } from 'expo-router';

interface UserProfile {
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

function createStyles(isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
    },
    scrollContent: {
      padding: 16,
      paddingTop: Platform.OS === 'android' ? 48 : 16,
      paddingBottom: 100,
    },
    header: {
      marginBottom: 24,
      alignItems: 'center',
    },
    profileImageContainer: {
      position: 'relative',
      marginBottom: 16,
    },
    profileImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
    },
    profileImagePlaceholder: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editImageButton: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: colors.primary,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: isDark ? colors.background : colors.backgroundLight,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
    },
    profileCard: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    profileRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : colors.borderLight,
    },
    profileRowLast: {
      borderBottomWidth: 0,
    },
    profileLabel: {
      fontSize: 14,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      marginBottom: 4,
    },
    profileValue: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.text : colors.textLight,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    secondaryButtonText: {
      color: colors.primary,
    },
    signOutButton: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderWidth: 1,
      borderColor: colors.error,
    },
    signOutButtonText: {
      color: colors.error,
    },
    emptyStateText: {
      fontSize: 16,
      color: isDark ? colors.textSecondary : colors.textSecondaryLight,
      textAlign: 'center',
      marginTop: 12,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: isDark ? colors.cardBackground : colors.card,
      borderRadius: 16,
      padding: 24,
      width: '90%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 20,
      textAlign: 'center',
    },
    input: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: isDark ? colors.text : colors.textLight,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      padding: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    modalButtonPrimary: {
      backgroundColor: colors.primary,
    },
    modalButtonSecondary: {
      backgroundColor: isDark ? colors.background : colors.backgroundLight,
      borderWidth: 1,
      borderColor: isDark ? colors.border : colors.borderLight,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    modalButtonTextSecondary: {
      color: isDark ? colors.text : colors.textLight,
    },
    loadingContainer: {
      padding: 20,
      alignItems: 'center',
    },
  });
}

export default function UserProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = createStyles(isDark);
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    console.log('User viewing User Profile screen');
    try {
      setLoading(true);
      
      const profileData = await seaTimeApi.getUserProfile();
      
      console.log('Profile loaded:', profileData.email);
      
      setProfile(profileData);
    } catch (error) {
      console.error('Failed to load profile data:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    console.log('User tapped Edit Profile button');
    if (profile) {
      setEditName(profile.name);
      setEditEmail(profile.email);
      setEditModalVisible(true);
    }
  };

  const handleSaveProfile = async () => {
    console.log('User saving profile changes');
    try {
      const updates: { name?: string; email?: string } = {};
      
      if (editName !== profile?.name) {
        updates.name = editName;
      }
      if (editEmail !== profile?.email) {
        updates.email = editEmail;
      }
      
      if (Object.keys(updates).length === 0) {
        setEditModalVisible(false);
        return;
      }
      
      const updatedProfile = await seaTimeApi.updateUserProfile(updates);
      console.log('Profile updated successfully');
      setProfile(updatedProfile);
      setEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleChangeProfilePicture = async () => {
    console.log('User tapped Change Profile Picture button');
    
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant permission to access your photos');
      return;
    }
    
    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      console.log('Image selected:', imageUri);
      
      try {
        setUploading(true);
        const response = await seaTimeApi.uploadProfileImage(imageUri);
        console.log('Profile image uploaded:', response.url);
        
        // Reload profile to get updated image URL
        const updatedProfile = await seaTimeApi.getUserProfile();
        setProfile(updatedProfile);
        
        Alert.alert('Success', 'Profile picture updated successfully');
      } catch (error) {
        console.error('Failed to upload profile image:', error);
        Alert.alert('Error', 'Failed to upload profile picture');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleSignOut = async () => {
    console.log('User tapped Sign Out button');
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              console.log('User signed out, navigating to auth screen');
              router.replace('/auth');
            } catch (error) {
              console.error('Sign out failed:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'User Profile',
            headerShown: true,
          }}
        />
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.emptyStateText}>Loading profile...</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'User Profile',
          headerShown: true,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.profileImageContainer}>
            {uploading ? (
              <View style={styles.profileImagePlaceholder}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : profile?.imageUrl || profile?.image ? (
              <Image source={{ uri: profile.imageUrl || profile.image || '' }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <IconSymbol
                  ios_icon_name="person.circle.fill"
                  android_material_icon_name="account-circle"
                  size={80}
                  color={colors.primary}
                />
              </View>
            )}
            <TouchableOpacity 
              style={styles.editImageButton}
              onPress={handleChangeProfilePicture}
              disabled={uploading}
            >
              <IconSymbol
                ios_icon_name="camera.fill"
                android_material_icon_name="camera"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>{profile?.name || 'Seafarer'}</Text>
          <Text style={styles.subtitle}>{profile?.email}</Text>
        </View>

        {profile && (
          <View style={styles.profileCard}>
            <View style={styles.profileRow}>
              <View>
                <Text style={styles.profileLabel}>Full Name</Text>
                <Text style={styles.profileValue}>{profile.name}</Text>
              </View>
            </View>
            <View style={styles.profileRow}>
              <View>
                <Text style={styles.profileLabel}>Email Address</Text>
                <Text style={styles.profileValue}>{profile.email}</Text>
              </View>
            </View>
            <View style={[styles.profileRow, styles.profileRowLast]}>
              <View>
                <Text style={styles.profileLabel}>Member Since</Text>
                <Text style={styles.profileValue}>{formatDate(profile.createdAt || profile.created_at)}</Text>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={handleEditProfile}
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>✏️ Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.signOutButton]} 
          onPress={handleSignOut}
        >
          <Text style={[styles.buttonText, styles.signOutButtonText]}>Sign Out</Text>
        </TouchableOpacity>

        <Modal
          visible={editModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                value={editName}
                onChangeText={setEditName}
              />
              
              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor={isDark ? colors.textSecondary : colors.textSecondaryLight}
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleSaveProfile}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </>
  );
}
