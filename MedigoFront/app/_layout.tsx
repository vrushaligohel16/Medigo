import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/context/AuthContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="medicines" />
          <Stack.Screen name="reminders" />
          <Stack.Screen name="prescriptions" />
          <Stack.Screen name="scan" />
          <Stack.Screen name="health" />
          <Stack.Screen name="appointments" />
          <Stack.Screen name="family" />
          <Stack.Screen name="sos" />
          <Stack.Screen name="ai-assistant" />
          <Stack.Screen name="profile" />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
