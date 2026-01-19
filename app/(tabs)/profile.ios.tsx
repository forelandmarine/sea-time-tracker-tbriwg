
import { IconSymbol } from '@/components/IconSymbol';
import React, { useState, useEffect } from 'react';
import * as seaTimeApi from '@/utils/seaTimeApi';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';

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

const createStyles = (isDark: boolean, topInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : '#f5f5f5',
      paddingTop: topInset,
    },
    content: {
      padding: 20,
    },
    header: {
      alignItems: 'center',
      marginBottom: 30,
      paddingTop: 20,
    },
    profileImageContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 15,
      overflow: 'hidden',
    },
    profileImage: {
      width: 100,
      height: 100,
    },
    profileInitials: {
      fontSize: 36,
      fontWeight: 'bold',
      color: '#ffffff',
    },
    profileName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 5,
    },
    profileEmail: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 10,
    },
    card: {
      backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
      borderRadius: 12,
      padding: 15,
      marginBottom: 10,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#444' : '#e0e0e0',
    },
    menuItemLast: {
      borderBottomWidth: 0,
    },
    menuItemIcon: {
      marginRight: 15,
    },
    menuItemText: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
    },
    menuItemChevron: {
      marginLeft: 10,
    },
    signOutButton: {
      backgroundColor: '#ff4444',
      borderRadius: 12,
      padding: 15,
      alignItems: 'center',
      marginTop: 20,
    },
    signOutButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    adminButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 15,
      alignItems: 'center',
      marginTop: 10,
    },
    adminButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const styles = createStyles(isDark, insets.top);
  const router = useRouter();
  const { signOut } = useAuth();

  console.log('ProfileScreen rendered (iOS)');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    console.log('Loading user profile');
    try {
      const data = await seaTimeApi.getUserProfile();
      console.log('User profile loaded:', data);
      setProfile(data);
    } catch (error) {
      console.error('Failed to load profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    console.log('User tapped Edit Profile');
    router.push('/user-profile');
  };

  const handleScheduledTasks = () => {
    console.log('User tapped Scheduled Tasks');
    router.push('/scheduled-tasks');
  };

  const handleMCARequirements = () => {
    console.log('User tapped MCA Requirements');
    router.push('/mca-requirements');
  };

  const handleAdminVerify = () => {
    console.log('User tapped Admin Verify');
    router.push('/admin-verify');
  };

  const handleSignOut = async () => {
    console.log('User tapped Sign Out');
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
            console.log('User confirmed sign out');
            try {
              await signOut();
              console.log('Sign out successful');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text }}>Failed to load profile</Text>
      </View>
    );
  }

  const imageUrl = profile.imageUrl || profile.image;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.profileImageContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.profileImage} />
            ) : (
              <Text style={styles.profileInitials}>{getInitials(profile.name)}</Text>
            )}
          </View>
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profileEmail}>{profile.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEditProfile}>
              <IconSymbol
                ios_icon_name="person.circle"
                android_material_icon_name="person"
                size={24}
                color={colors.primary}
                style={styles.menuItemIcon}
              />
              <Text style={styles.menuItemText}>Edit Profile</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={colors.textSecondary}
                style={styles.menuItemChevron}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleScheduledTasks}>
              <IconSymbol
                ios_icon_name="clock"
                android_material_icon_name="schedule"
                size={24}
                color={colors.primary}
                style={styles.menuItemIcon}
              />
              <Text style={styles.menuItemText}>Scheduled Tasks</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={colors.textSecondary}
                style={styles.menuItemChevron}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={handleMCARequirements}
            >
              <IconSymbol
                ios_icon_name="doc.text"
                android_material_icon_name="description"
                size={24}
                color={colors.primary}
                style={styles.menuItemIcon}
              />
              <Text style={styles.menuItemText}>MCA Requirements</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={colors.textSecondary}
                style={styles.menuItemChevron}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.adminButton} onPress={handleAdminVerify}>
          <Text style={styles.adminButtonText}>Admin Verification</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
