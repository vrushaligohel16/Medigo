import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import type { Appointment } from '@/types/appointment';

type AppointmentCardProps = {
  appointment: Appointment;
  onPress?: () => void;
  onActionPress?: () => void;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AppointmentCard({
  appointment,
  onPress,
  onActionPress,
}: AppointmentCardProps) {
  const isUpcoming = appointment.status === 'upcoming';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && onPress ? styles.pressed : null]}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={18} color={Colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.doctor}>{appointment.doctorName}</Text>
          <Text style={styles.specialty}>{appointment.specialty}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={15} color={Colors.textSecondary} />
        <Text style={styles.meta}>{formatDate(appointment.startsAt)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={15} color={Colors.textSecondary} />
        <Text style={styles.meta}>{appointment.clinic}</Text>
      </View>

      {isUpcoming && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>
            {appointment.meetingUrl ? 'Join' : 'Directions'}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.status}>
          {appointment.status === 'upcoming' ? 'Upcoming' : 'Past'}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.92,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  doctor: {
    fontSize: 15,
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
  },
  meta: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  actionButton: {
    marginTop: 4,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
