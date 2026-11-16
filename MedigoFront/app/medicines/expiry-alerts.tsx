import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { daysUntil, medicineService } from '@/services/medicineService';
import type { Medicine } from '@/types/medicine';

function formatExpiryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysLabel(days: number): string {
  if (days === 0) {
    return 'Expires today';
  }
  if (days === 1) {
    return '1 day left';
  }
  return `${days} days left`;
}

export default function ExpiryAlertsScreen() {
  const insets = useSafeAreaInsets();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refillingId, setRefillingId] = useState<string | null>(null);

  const loadExpiring = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await medicineService.getExpiringSoon();
      setMedicines(data);
    } catch {
      setError('Unable to load expiry alerts.');
      setMedicines([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadExpiring();
    }, [loadExpiring]),
  );

  const handleMarkRefilled = async (medicine: Medicine) => {
    setRefillingId(medicine.id);
    try {
      await medicineService.markAsRefilled(medicine.id);
      setMedicines((current) => current.filter((item) => item.id !== medicine.id));
    } catch {
      setError('Unable to mark as refilled. Please try again.');
    } finally {
      setRefillingId(null);
    }
  };

  const renderItem = ({ item }: { item: Medicine }) => {
    const expiry = item.expiresAt ?? item.endDate ?? '';
    const remaining = expiry ? daysUntil(expiry) : 0;
    const isRefilling = refillingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardInfo}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.expiry}>
              Expires {expiry ? formatExpiryDate(expiry) : '—'}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{daysLabel(remaining)}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => void handleMarkRefilled(item)}
          disabled={isRefilling}
          style={({ pressed }) => [
            styles.refilledButton,
            pressed && !isRefilling ? styles.refilledPressed : null,
            isRefilling ? styles.refilledDisabled : null,
          ]}
        >
          {isRefilling ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={16} color={Colors.primary} />
              <Text style={styles.refilledText}>Mark as Refilled</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Expiry Alerts</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Expiring Soon</Text>
        <Text style={styles.subtitle}>
          Medicines expiring within the next 30 days, soonest first.
        </Text>
      </View>

      {isLoading && medicines.length === 0 ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={medicines}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshing={isLoading}
          onRefresh={loadExpiring}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {error ?? 'No medicines are expiring in the next 30 days.'}
            </Text>
          }
          ListHeaderComponent={
            error && medicines.length > 0 ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null
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
    marginBottom: 12,
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
  listContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  expiry: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  badge: {
    backgroundColor: Colors.expiryBadgeBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.expiryBadge,
  },
  refilledButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: Colors.mint,
  },
  refilledPressed: {
    opacity: 0.9,
  },
  refilledDisabled: {
    opacity: 0.7,
  },
  refilledText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  loader: {
    marginTop: 40,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
});
