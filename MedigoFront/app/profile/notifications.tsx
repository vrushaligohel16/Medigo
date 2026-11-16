import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { ensureNotificationPermissions } from '@/utils/notifications';

const PREFS_KEY = 'notificationPreferences';

type NotificationPrefs = {
  medicineReminders: boolean;
  appointmentReminders: boolean;
  expiryAlerts: boolean;
  healthTips: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  medicineReminders: true,
  appointmentReminders: true,
  expiryAlerts: true,
  healthTips: false,
};

const ROWS: {
  key: keyof NotificationPrefs;
  label: string;
  subtitle: string;
}[] = [
  {
    key: 'medicineReminders',
    label: 'Medicine reminders',
    subtitle: 'Dose times and snooze alerts',
  },
  {
    key: 'appointmentReminders',
    label: 'Appointment reminders',
    subtitle: 'Upcoming visit notifications',
  },
  {
    key: 'expiryAlerts',
    label: 'Expiry alerts',
    subtitle: 'Medicines nearing expiry',
  },
  {
    key: 'healthTips',
    label: 'Health tips',
    subtitle: 'Occasional wellness suggestions',
  },
];

export default function NotificationPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(PREFS_KEY);
        if (raw) {
          setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(raw) as NotificationPrefs) });
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const updatePref = async (key: keyof NotificationPrefs, value: boolean) => {
    if (value) {
      await ensureNotificationPermissions();
    }
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  };

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
        <Text style={styles.headerTitle}>Notification Preferences</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <View style={[styles.card, { marginBottom: insets.bottom + 16 }]}>
          {ROWS.map((row, index) => (
            <View
              key={row.key}
              style={[styles.row, index < ROWS.length - 1 && styles.rowBorder]}
            >
              <View style={styles.rowText}>
                <Text style={styles.label}>{row.label}</Text>
                <Text style={styles.subtitle}>{row.subtitle}</Text>
              </View>
              <Switch
                value={prefs[row.key]}
                onValueChange={(value) => void updatePref(row.key, value)}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.mint,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  pressed: { opacity: 0.75 },
});
