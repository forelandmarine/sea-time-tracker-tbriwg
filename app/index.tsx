
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, Text, useColorScheme } from 'react-native';
import { colors } from '@/styles/commonStyles';

export default function Index() {
  const { user, loading } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  console.log('[Index] Rendering index route', { user: !!user, loading });

  // Show loading state while checking authentication
  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: isDark ? colors.background : colors.backgroundLight 
      }}>
        <Text style={{ 
          fontSize: 18, 
          color: isDark ? colors.text : colors.textLight,
          marginBottom: 10 
        }}>
          SeaTime Tracker
        </Text>
        <Text style={{ 
          fontSize: 14, 
          color: isDark ? colors.textSecondary : colors.textSecondaryLight 
        }}>
          Loading...
        </Text>
      </View>
    );
  }

  // Redirect based on authentication status
  if (user) {
    console.log('[Index] User authenticated, redirecting to /(tabs)');
    return <Redirect href="/(tabs)" />;
  }

  console.log('[Index] User not authenticated, redirecting to /auth');
  return <Redirect href="/auth" />;
}
