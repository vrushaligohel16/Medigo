import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.updated}>Last updated: August 16, 2026</Text>
          <Text style={styles.heading}>Your health data</Text>
          <Text style={styles.body}>
            MediGo stores medicines, health records, appointments, and family
            information you add so you can manage care in one place. We use this
            data to power reminders, SOS alerts, and AI assistance features you
            choose to use.
          </Text>
          <Text style={styles.heading}>Location</Text>
          <Text style={styles.body}>
            Location is only requested when you send an Emergency SOS alert, so
            your contacts can receive a map link. We do not track your location
            in the background for advertising.
          </Text>
          <Text style={styles.heading}>Sharing</Text>
          <Text style={styles.body}>
            We do not sell your personal health information. Data may be shared
            with services you explicitly use (for example SMS during SOS) or when
            required by law.
          </Text>
          <Text style={styles.heading}>Contact</Text>
          <Text style={styles.body}>
            Questions about privacy can be sent to privacy@medigo.app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.mint,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSpacer: { width: 40 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  updated: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  pressed: { opacity: 0.75 },
});
