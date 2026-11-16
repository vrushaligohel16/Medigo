import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CircularProgress } from '@/components/CircularProgress';
import { Colors } from '@/constants/colors';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { formatReminderTime } from '@/services/medicineService';
import { reminderService } from '@/services/reminderService';
import type { TodayReminder } from '@/types/medicine';

const USER_NAME_KEY = 'userName';

const QUICK_ACTIONS = [
  {
    key: 'add',
    label: 'Add Medicine',
    icon: 'medkit-outline' as const,
    bg: Colors.mint,
    href: '/medicines/add',
  },
  {
    key: 'prescriptions',
    label: 'Prescriptions',
    icon: 'document-text-outline' as const,
    bg: Colors.peach,
    href: '/prescriptions',
  },
  {
    key: 'log',
    label: 'Log Health',
    icon: 'fitness-outline' as const,
    bg: Colors.peach,
    href: '/health/add-record',
  },
  {
    key: 'sos',
    label: 'SOS',
    icon: 'alert-circle-outline' as const,
    bg: Colors.mint,
    href: '/sos',
  },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('there');
  const [reminders, setReminders] = useState<TodayReminder[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const {
    records,
    progress,
    isLoading: healthLoading,
    refresh: refreshHealth,
  } = useHealthRecords();

  const loadReminders = useCallback(async () => {
    setRemindersLoading(true);
    try {
      const data = await reminderService.getToday();
      setReminders(data);
    } catch {
      setReminders([]);
    } finally {
      setRemindersLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReminders();
    }, [loadReminders]),
  );

  useEffect(() => {
    void AsyncStorage.getItem(USER_NAME_KEY).then((stored) => {
      if (stored?.trim()) {
        setName(stored.trim().split(' ')[0]);
      }
    });
  }, []);

  const isRefreshing = remindersLoading || healthLoading;

  const onRefresh = async () => {
    await Promise.all([loadReminders(), refreshHealth()]);
  };

  const taken =
    progress?.medicinesTaken ?? reminders.filter((item) => item.status === 'taken').length;
  const total = progress?.medicinesTotal ?? Math.max(reminders.length, 1);
  const pendingCount = reminders.filter((item) => item.status !== 'taken').length;

  const markReminderTaken = async (reminder: TodayReminder) => {
    if (reminder.status === 'taken') {
      return;
    }

    const previous = reminder.status;
    setReminders((current) =>
      current.map((item) =>
        item.id === reminder.id ? { ...item, status: 'taken' } : item,
      ),
    );

    try {
      const updated = await reminderService.updateStatus(reminder.id, 'taken');
      setReminders((current) =>
        current.map((item) => (item.id === reminder.id ? updated : item)),
      );
    } catch {
      setReminders((current) =>
        current.map((item) =>
          item.id === reminder.id ? { ...item, status: previous } : item,
        ),
      );
    }
  };

  const renderReminder = (item: TodayReminder) => {
    const isTaken = item.status === 'taken';

    return (
      <View key={item.id} style={styles.reminderCard}>
        <View style={styles.reminderIcon}>
          <Ionicons name="medical" size={20} color={Colors.primary} />
        </View>
        <Text style={styles.reminderName} numberOfLines={1}>
          {item.medicineName}
        </Text>
        <Text style={styles.reminderMeta}>{item.dosage}</Text>
        <Text style={styles.reminderTime}>{formatReminderTime(item.time)}</Text>
        <Pressable
          onPress={() => void markReminderTaken(item)}
          disabled={isTaken}
          style={[styles.checkButton, isTaken && styles.checkButtonDone]}
        >
          <Ionicons
            name={isTaken ? 'checkmark' : 'checkmark-outline'}
            size={18}
            color={isTaken ? Colors.white : Colors.primary}
          />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hi, {name} 👋</Text>
            <Text style={styles.subtitle}>Here's your health overview</Text>
          </View>
          <Pressable
            onPress={() => router.push('/reminders' as Href)}
            style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open reminders"
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.text} />
            {pendingCount > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {pendingCount > 9 ? '9+' : pendingCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.sectionTitle}>Today's Progress</Text>
          <View style={styles.progressRow}>
            <CircularProgress taken={taken} total={total} />
            <View style={styles.miniStats}>
              <View style={[styles.statChip, { backgroundColor: Colors.mint }]}>
                <Ionicons name="walk-outline" size={18} color={Colors.primary} />
                <View>
                  <Text style={styles.statValue}>{progress?.steps?.toLocaleString() ?? '—'}</Text>
                  <Text style={styles.statLabel}>Steps</Text>
                </View>
              </View>
              <View style={[styles.statChip, { backgroundColor: Colors.peach }]}>
                <Ionicons name="water-outline" size={18} color={Colors.warning} />
                <View>
                  <Text style={styles.statValue}>
                    {progress ? `${progress.waterMl} ml` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>
                    Water / {progress?.waterGoalMl ?? 2500} ml
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Reminders</Text>
          {remindersLoading && reminders.length === 0 ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : reminders.length === 0 ? (
            <Text style={styles.emptyText}>No reminders for today.</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.reminderList}
            >
              {reminders.map(renderReminder)}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => router.push(action.href as Href)}
                style={({ pressed }) => [
                  styles.actionCard,
                  { backgroundColor: action.bg },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name={action.icon} size={22} color={Colors.primary} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Health Records</Text>
          <View style={styles.recordsCard}>
            {records.length === 0 ? (
              <Text style={styles.emptyText}>No recent records yet.</Text>
            ) : (
              records.slice(0, 4).map((record, index) => (
                <View
                  key={record.id}
                  style={[
                    styles.recordRow,
                    index < Math.min(records.length, 4) - 1 && styles.recordDivider,
                  ]}
                >
                  <View style={styles.recordLeft}>
                    <Text style={styles.recordTitle}>{record.title}</Text>
                    <Text style={styles.recordMeta}>{record.recordedAt}</Text>
                  </View>
                  <Text style={styles.recordValue}>
                    {record.value}
                    {record.unit ? ` ${record.unit}` : ''}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bellBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  progressCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  miniStats: {
    flex: 1,
    gap: 10,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  section: {
    gap: 12,
  },
  loader: {
    marginVertical: 16,
  },
  reminderList: {
    gap: 12,
    paddingRight: 8,
  },
  reminderCard: {
    width: 150,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  reminderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  reminderName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  reminderMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  reminderTime: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  checkButton: {
    marginTop: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  checkButtonDone: {
    backgroundColor: Colors.primary,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '47.5%',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  pressed: {
    opacity: 0.9,
  },
  recordsCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  recordDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  recordLeft: {
    flex: 1,
    paddingRight: 12,
    gap: 2,
  },
  recordTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  recordMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  recordValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingVertical: 12,
  },
});
