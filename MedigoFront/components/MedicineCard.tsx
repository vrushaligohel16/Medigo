import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import type { Medicine } from '@/types/medicine';

type MedicineCardProps = {
  medicine: Medicine;
  onPress: () => void;
  memberLabel?: string;
};

export function MedicineCard({ medicine, onPress, memberLabel }: MedicineCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="medical" size={22} color={Colors.primary} />
      </View>

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {medicine.name}
        </Text>
        <Text style={styles.meta}>{medicine.dosage}</Text>
        <Text style={styles.meta}>
          {medicine.remainingQuantity} left
          {medicine.nextReminderTime ? ` · Next ${medicine.nextReminderTime}` : ''}
        </Text>
        {memberLabel ? (
          <Text style={styles.memberLabel} numberOfLines={1}>
            For {memberLabel}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
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
  memberLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
});
