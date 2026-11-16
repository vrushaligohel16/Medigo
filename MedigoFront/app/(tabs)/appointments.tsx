import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { appointmentService } from '@/services/appointmentService';
import type { Appointment } from '@/types/appointment';
import { cancelAppointmentReminder } from '@/utils/notifications';

type AppointmentSection = {
  title: 'Upcoming' | 'Past';
  data: Appointment[];
};

function appointmentWhen(item: Appointment): number {
  return new Date(item.date || item.startsAt).getTime();
}

function formatAppointmentDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Split a single list by date (and cancelled → past). */
function buildSections(appointments: Appointment[]): AppointmentSection[] {
  const now = Date.now();

  const upcoming = appointments
    .filter(
      (item) => item.status !== 'cancelled' && appointmentWhen(item) >= now,
    )
    .sort((a, b) => appointmentWhen(a) - appointmentWhen(b));

  const past = appointments
    .filter(
      (item) => item.status === 'cancelled' || appointmentWhen(item) < now,
    )
    .sort((a, b) => appointmentWhen(b) - appointmentWhen(a));

  const sections: AppointmentSection[] = [];
  if (upcoming.length > 0) {
    sections.push({ title: 'Upcoming', data: upcoming });
  }
  if (past.length > 0) {
    sections.push({ title: 'Past', data: past });
  }
  return sections;
}

export default function AppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await appointmentService.getAll();
      setAppointments(data);
    } catch {
      setAppointments([]);
      setError('Unable to load appointments.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAppointments();
    }, [loadAppointments]),
  );

  const handleAction = async (appointment: Appointment) => {
    if (appointment.meetingUrl) {
      await Linking.openURL(appointment.meetingUrl);
      return;
    }

    if (appointment.address) {
      const query = encodeURIComponent(`${appointment.clinic}, ${appointment.address}`);
      await Linking.openURL(`https://maps.google.com/?q=${query}`);
      return;
    }

    await Linking.openURL(
      `https://maps.google.com/?q=${encodeURIComponent(appointment.clinic)}`,
    );
  };

  const handleCancelOrDelete = (appointment: Appointment) => {
    const isUpcoming =
      appointment.status !== 'cancelled' && appointmentWhen(appointment) >= Date.now();

    Alert.alert(
      isUpcoming ? 'Cancel appointment?' : 'Delete appointment?',
      isUpcoming
        ? `Cancel your visit with ${appointment.doctorName}?`
        : `Permanently remove this appointment with ${appointment.doctorName}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: isUpcoming ? 'Cancel visit' : 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(appointment.id);
              setError(null);
              try {
                if (isUpcoming) {
                  await appointmentService.cancel(appointment.id);
                  await cancelAppointmentReminder(appointment.id);
                  setAppointments((current) =>
                    current.map((item) =>
                      item.id === appointment.id
                        ? { ...item, status: 'cancelled' }
                        : item,
                    ),
                  );
                } else {
                  await appointmentService.delete(appointment.id);
                  await cancelAppointmentReminder(appointment.id);
                  setAppointments((current) =>
                    current.filter((item) => item.id !== appointment.id),
                  );
                }
              } catch {
                setError(
                  isUpcoming
                    ? 'Could not cancel appointment.'
                    : 'Could not delete appointment.',
                );
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const sections = buildSections(appointments);

  const renderItem = ({ item }: { item: Appointment }) => {
    const isUpcoming =
      item.status !== 'cancelled' && appointmentWhen(item) >= Date.now();
    const isCancelled = item.status === 'cancelled';
    const actionLabel = item.meetingUrl ? 'Join' : 'Directions';
    const isBusy = busyId === item.id;

    return (
      <View style={[styles.card, !isUpcoming && styles.cardPast]}>
        <Pressable
          onPress={() =>
            router.push(`/appointments/add?id=${encodeURIComponent(item.id)}` as Href)
          }
        >
          <View style={styles.cardHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={18} color={Colors.primary} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.doctorName}>{item.doctorName}</Text>
              <Text style={styles.specialty}>{item.specialty}</Text>
            </View>
            <Ionicons name="create-outline" size={18} color={Colors.textSecondary} />
          </View>

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.metaText}>
              {formatAppointmentDate(item.date || item.startsAt)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{item.clinic}</Text>
          </View>
        </Pressable>

        {isCancelled ? (
          <Text style={styles.pastLabel}>Cancelled</Text>
        ) : isUpcoming ? (
          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => void handleAction(item)}
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionPrimary,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={item.meetingUrl ? 'videocam-outline' : 'navigate-outline'}
                size={16}
                color={Colors.white}
              />
              <Text style={styles.actionButtonText}>{actionLabel}</Text>
            </Pressable>
            <Pressable
              onPress={() => handleCancelOrDelete(item)}
              disabled={isBusy}
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionDanger,
                pressed && styles.pressed,
                isBusy && styles.disabled,
              ]}
            >
              {isBusy ? (
                <ActivityIndicator color={Colors.error} size="small" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            <Text style={[styles.pastLabel, styles.flex]}>Completed</Text>
            <Pressable
              onPress={() => handleCancelOrDelete(item)}
              disabled={isBusy}
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionDanger,
                styles.deleteCompact,
                pressed && styles.pressed,
                isBusy && styles.disabled,
              ]}
            >
              {isBusy ? (
                <ActivityIndicator color={Colors.error} size="small" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  <Text style={styles.cancelButtonText}>Delete</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Appointments</Text>
        <Text style={styles.subtitle}>Upcoming visits and past consultations</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isLoading && appointments.length === 0 ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 96 },
          ]}
          stickySectionHeadersEnabled={false}
          refreshing={isLoading}
          onRefresh={() => void loadAppointments()}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No appointments yet. Tap + to add one.</Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        onPress={() => router.push('/appointments/add' as Href)}
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    marginBottom: 8,
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorText: {
    color: Colors.error,
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
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
    marginTop: 8,
  },
  separator: {
    height: 12,
  },
  sectionSeparator: {
    height: 8,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  cardPast: {
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  specialty: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    minHeight: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  actionPrimary: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  actionDanger: {
    backgroundColor: Colors.chipInactive,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deleteCompact: {
    paddingHorizontal: 14,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  cancelButtonText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
  pastLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  flex: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    color: Colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.7,
  },
});
