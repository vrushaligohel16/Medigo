import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MedicineCard } from '@/components/MedicineCard';
import { Colors } from '@/constants/colors';
import { familyService } from '@/services/familyService';
import { medicineService } from '@/services/medicineService';
import type { Medicine } from '@/types/medicine';

type FilterKey = 'all' | 'mine' | 'family' | 'active' | 'expiring';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'Mine' },
  { key: 'family', label: 'Family' },
  { key: 'active', label: 'Active' },
  { key: 'expiring', label: 'Expiring' },
];

export default function MedicinesScreen() {
  const insets = useSafeAreaInsets();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const loadMedicines = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, members] = await Promise.all([
        medicineService.getAll(),
        familyService.getAll().catch(() => []),
      ]);
      setMedicines(data);
      const names: Record<string, string> = {};
      for (const member of members) {
        names[member.id] = member.name;
      }
      setMemberNames(names);
    } catch {
      setMedicines([]);
      setError('Unable to load medicines.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMedicines();
    }, [loadMedicines]),
  );

  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      medicines.filter((medicine) => {
        const memberName = medicine.familyMemberId
          ? memberNames[medicine.familyMemberId]
          : undefined;
        const matchesQuery =
          !normalized ||
          medicine.name.toLowerCase().includes(normalized) ||
          medicine.dosage.toLowerCase().includes(normalized) ||
          (memberName?.toLowerCase().includes(normalized) ?? false);

        const isFamily = Boolean(medicine.familyMemberId);
        const matchesFilter =
          filter === 'all' ||
          (filter === 'mine' && !isFamily) ||
          (filter === 'family' && isFamily) ||
          (filter === 'active' && medicine.status === 'active') ||
          (filter === 'expiring' && medicine.status === 'expiring');

        return matchesQuery && matchesFilter;
      }),
    [medicines, memberNames, normalized, filter],
  );

  const openMedicine = (medicine: Medicine) => {
    if (medicine.familyMemberId) {
      const name = memberNames[medicine.familyMemberId];
      const nameQuery = name ? `&familyMemberName=${encodeURIComponent(name)}` : '';
      router.push(
        `/medicines/${medicine.id}?familyMemberId=${medicine.familyMemberId}${nameQuery}` as Href,
      );
      return;
    }
    router.push(`/medicines/${medicine.id}` as Href);
  };

  const emptyMessage =
    medicines.length === 0
      ? 'No medicines added yet — tap + for yourself, or open Family to track for a member'
      : 'No medicines match your filters.';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Medicines</Text>
        <Text style={styles.subtitle}>Track yours and your family’s prescriptions</Text>
        <Pressable
          onPress={() => router.push('/prescriptions' as Href)}
          style={styles.prescriptionLink}
        >
          <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
          <Text style={styles.prescriptionLinkText}>View uploaded prescriptions</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search medicines or family"
          placeholderTextColor={Colors.textSecondary}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.chips}>
        {FILTERS.map((item) => {
          const selected = filter === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isLoading && medicines.length === 0 ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MedicineCard
              medicine={item}
              memberLabel={
                item.familyMemberId ? memberNames[item.familyMemberId] : undefined
              }
              onPress={() => openMedicine(item)}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 96 },
            filtered.length === 0 ? styles.listEmpty : null,
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onRefresh={() => void loadMedicines()}
          refreshing={isLoading}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="medkit-outline" size={36} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>{emptyMessage}</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        onPress={() => router.push('/medicines/add' as Href)}
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
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  prescriptionLink: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.mint,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  prescriptionLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.chipInactive,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.white,
  },
  listContent: {
    paddingTop: 4,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  separator: {
    height: 10,
  },
  loader: {
    marginTop: 40,
  },
  emptyWrap: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
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
});
