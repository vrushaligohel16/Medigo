import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import type { HealthMetricRecord } from '@/types/health';

type HealthMetricCardProps = {
  record: HealthMetricRecord;
  onPress?: () => void;
};

const TYPE_LABELS: Record<HealthMetricRecord['type'], string> = {
  bp: 'Blood Pressure',
  sugar: 'Blood Sugar',
  weight: 'Weight',
  water: 'Water Intake',
};

function formatValue(record: HealthMetricRecord): string {
  if (record.type === 'bp') {
    return `${record.systolic ?? '—'}/${record.diastolic ?? '—'} ${record.unit}`;
  }
  return `${record.value ?? '—'} ${record.unit}`;
}

export function HealthMetricCard({ record, onPress }: HealthMetricCardProps) {
  const content = (
    <>
      <View style={styles.iconWrap}>
        <Ionicons name="pulse" size={20} color={Colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{TYPE_LABELS[record.type]}</Text>
        <Text style={styles.value}>{formatValue(record)}</Text>
        <Text style={styles.meta}>
          {new Date(record.recordedAt).toLocaleString()}
          {record.sugarContext
            ? ` · ${record.sugarContext === 'fasting' ? 'Fasting' : 'Post-meal'}`
            : ''}
        </Text>
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.card}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  meta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
