import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';

const SPLASH_DELAY_MS = 2000;

export default function SplashScreen() {
  const { token, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const timer = setTimeout(() => {
      router.replace((token ? '/(tabs)/home' : '/onboarding') as Href);
    }, SPLASH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isLoading, token]);

  return (
    <LinearGradient
      colors={[Colors.mint, Colors.peach]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logo} />
        <Text style={styles.appName}>MediGo</Text>
        <Text style={styles.tagline}>Your Health, Simplified</Text>
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={styles.loader} />
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 28,
    backgroundColor: Colors.logoBackground,
    marginBottom: 24,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  loader: {
    marginTop: 24,
  },
});
