import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import {
  formatReminderTime,
  getCurrentMinutes,
  timeToMinutes,
} from '@/services/medicineService';
import { reminderService } from '@/services/reminderService';
import type { DoseStatus, TodayReminder } from '@/types/medicine';
import { snoozeReminderNotification } from '@/utils/notifications';

type ReminderSection = {
  title: 'Earlier Today' | 'Upcoming';
  data: TodayReminder[];
};

function buildSections(reminders: TodayReminder[]): ReminderSection[] {
  const now = getCurrentMinutes();
  const earlier = reminders.filter((item) => timeToMinutes(item.time) <= now);
  const upcoming = reminders.filter((item) => timeToMinutes(item.time) > now);

  const sections: ReminderSection[] = [];
  if (earlier.length > 0) {
    sections.push({ title: 'Earlier Today', data: earlier });
  }
  if (upcoming.length > 0) {
    sections.push({ title: 'Upcoming', data: upcoming });
  }
  return sections;
}

function addMinutesToTime(time24: string, minutesToAdd: number): string {
  const total = timeToMinutes(time24) + minutesToAdd;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(wrapped / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (wrapped % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const [reminders, setReminders] = useState<TodayReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadReminders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await reminderService.getToday();
      setReminders(data);
    } catch {
      setReminders([]);
      setError('Unable to load reminders.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReminders();
    }, [loadReminders]),
  );

  const updateStatus = async (
    reminder: TodayReminder,
    status: Exclude<DoseStatus, 'pending'>,
  ) => {
    setPendingId(reminder.id);
    setError(null);

    const previous = reminder.status;
    setReminders((current) =>
      current.map((item) => (item.id === reminder.id ? { ...item, status } : item)),
    );

    try {
      const updated = await reminderService.updateStatus(reminder.id, status);
      setReminders((current) =>
        current.map((item) => (item.id === reminder.id ? updated : item)),
      );
    } catch {
      setReminders((current) =>
        current.map((item) =>
          item.id === reminder.id ? { ...item, status: previous } : item,
        ),
      );
      setError('Could not sync dose status. Please try again.');
    } finally {
      setPendingId(null);
    }
  };

  const handleSnooze = async (reminder: TodayReminder) => {
    if (reminder.status !== 'pending') {
      return;
    }

    setPendingId(reminder.id);
    setError(null);

    try {
      await snoozeReminderNotification({
        medicineId: reminder.medicineId,
        medicineName: reminder.medicineName,
        dosage: reminder.dosage,
        minutes: 10,
      });

      setReminders((current) =>
        current
          .map((item) =>
            item.id === reminder.id
              ? { ...item, time: addMinutesToTime(item.time, 10) }
              : item,
          )
          .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)),
      );
    } catch {
      setError('Unable to snooze this reminder.');
    } finally {
      setPendingId(null);
    }
  };

  const sections = buildSections(reminders);

  const renderReminder = ({ item }: { item: TodayReminder }) => {
    const isBusy = pendingId === item.id;
    const isResolved = item.status !== 'pending';

    return (
      <View style={[styles.card, isResolved && styles.cardResolved]}>
        <View style={styles.cardTop}>
          <Pressable
            onPress={() => {
              if (item.status === 'taken') {
                return;
              }
              void updateStatus(item, 'taken');
            }}
            disabled={isBusy || item.status === 'taken'}
            style={[
              styles.checkbox,
              item.status === 'taken' && styles.checkboxTaken,
              item.status === 'skipped' && styles.checkboxSkipped,
            ]}
          >
            {item.status === 'taken' ? (
              <Ionicons name="checkmark" size={16} color={Colors.white} />
            ) : item.status === 'skipped' ? (
              <Ionicons name="close" size={16} color={Colors.white} />
            ) : null}
          </Pressable>

          <View style={styles.cardInfo}>
            <Text style={styles.time}>{formatReminderTime(item.time)}</Text>
            <Text style={styles.name}>{item.medicineName}</Text>
            <Text style={styles.meta}>{item.dosage}</Text>
          </View>

          {item.status !== 'pending' ? (
            <View
              style={[
                styles.statusBadge,
                item.status === 'taken' ? styles.statusTaken : styles.statusSkipped,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  item.status === 'taken' ? styles.statusTakenText : styles.statusSkippedText,
                ]}
              >
                {item.status === 'taken' ? 'Taken' : 'Skipped'}
              </Text>
            </View>
          ) : null}
        </View>

        {item.status === 'pending' ? (
          <View style={styles.actions}>
            <Pressable
              onPress={() => void updateStatus(item, 'taken')}
              disabled={isBusy}
              style={({ pressed }) => [styles.actionButton, styles.takenButton, pressed && styles.pressed]}
            >
              {isBusy ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.takenButtonText}>Taken</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => void updateStatus(item, 'skipped')}
              disabled={isBusy}
              style={({ pressed }) => [styles.actionButton, styles.skipButton, pressed && styles.pressed]}
            >
              <Text style={styles.skipButtonText}>Skipped</Text>
            </Pressable>

            <Pressable
              onPress={() => void handleSnooze(item)}
              disabled={isBusy}
              style={({ pressed }) => [styles.actionButton, styles.snoozeButton, pressed && styles.pressed]}
            >
              <Ionicons name="alarm-outline" size={16} color={Colors.primary} />
              <Text style={styles.snoozeButtonText}>Snooze</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Reminders</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Today's Reminders</Text>
        <Text style={styles.subtitle}>
          Mark doses as taken or skipped, or snooze for 10 minutes.
        </Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isLoading && reminders.length === 0 ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderReminder}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          stickySectionHeadersEnabled={false}
          refreshing={isLoading}
          onRefresh={() => void loadReminders()}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No medicine reminders scheduled for today.</Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  loader: {
    marginTop: 40,
  },
  listContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 10,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  separator: {
    height: 10,
  },
  sectionSeparator: {
    height: 8,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  cardResolved: {
    opacity: 0.92,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    marginTop: 2,
  },
  checkboxTaken: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxSkipped: {
    backgroundColor: Colors.textSecondary,
    borderColor: Colors.textSecondary,
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  time: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  meta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusTaken: {
    backgroundColor: Colors.mint,
  },
  statusSkipped: {
    backgroundColor: Colors.chipInactive,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusTakenText: {
    color: Colors.primary,
  },
  statusSkippedText: {
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  takenButton: {
    backgroundColor: Colors.primary,
  },
  takenButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  skipButton: {
    backgroundColor: Colors.chipInactive,
  },
  skipButtonText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  snoozeButton: {
    backgroundColor: Colors.mint,
  },
  snoozeButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.9,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
