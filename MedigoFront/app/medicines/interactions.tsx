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
import { medicineService } from '@/services/medicineService';
import type { InteractionResult, InteractionSeverity, Medicine } from '@/types/medicine';

const SEVERITY_META: Record<
  InteractionSeverity,
  {
    label: string;
    color: string;
    background: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  none: {
    label: 'No interaction',
    color: Colors.success,
    background: Colors.interactionNoneBg,
    icon: 'checkmark-circle',
  },
  mild: {
    label: 'Mild — caution',
    color: Colors.warning,
    background: Colors.interactionMildBg,
    icon: 'alert-circle',
  },
  severe: {
    label: 'Severe — consult doctor',
    color: Colors.sos,
    background: Colors.interactionSevereBg,
    icon: 'warning',
  },
};

export default function MedicineInteractionsScreen() {
  const insets = useSafeAreaInsets();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [results, setResults] = useState<InteractionResult[] | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const loadMedicines = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await medicineService.getAll();
      setMedicines(data);
    } catch {
      setMedicines([]);
      setLoadError('Unable to load medicines.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMedicines();
    }, [loadMedicines]),
  );

  const toggleMedicine = (medicine: Medicine) => {
    setResults(null);
    setCheckError(null);
    setSelectedIds((current) =>
      current.includes(medicine.id)
        ? current.filter((id) => id !== medicine.id)
        : [...current, medicine.id],
    );
  };

  const selectedNames = medicines
    .filter((medicine) => selectedIds.includes(medicine.id))
    .map((medicine) => medicine.name);

  const canCheck = selectedIds.length >= 2 && !isChecking;

  const handleCheck = async () => {
    if (selectedNames.length < 2) {
      setCheckError('Select at least two medicines to check.');
      return;
    }

    setIsChecking(true);
    setCheckError(null);

    try {
      const interactions = await medicineService.checkInteractions(selectedNames);
      setResults(interactions);
    } catch (error) {
      setResults(null);
      setCheckError(
        error instanceof Error
          ? error.message
          : 'Unable to check interactions. Please try again.',
      );
    } finally {
      setIsChecking(false);
    }
  };

  const renderMedicine = ({ item }: { item: Medicine }) => {
    const selected = selectedIds.includes(item.id);

    return (
      <Pressable
        onPress={() => toggleMedicine(item)}
        style={[styles.checkRow, selected && styles.checkRowSelected]}
      >
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected ? <Ionicons name="checkmark" size={16} color={Colors.white} /> : null}
        </View>
        <View style={styles.checkContent}>
          <Text style={styles.medicineName}>{item.name}</Text>
          <Text style={styles.medicineMeta}>
            {item.dosage} · {item.form}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Drug Interactions</Text>
        <View style={styles.iconButton} />
      </View>

      <FlatList
        data={medicines}
        keyExtractor={(item) => item.id}
        renderItem={renderMedicine}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Check Interactions</Text>
            <Text style={styles.subtitle}>
              Select two or more medicines from your list, then tap Check Interactions.
            </Text>
            <Text style={styles.selectedCount}>
              {selectedIds.length} selected
              {selectedIds.length > 0 ? ` · ${selectedNames.join(', ')}` : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : (
            <Text style={styles.emptyText}>
              {loadError ?? 'No medicines available. Add medicines first.'}
            </Text>
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {checkError ? <Text style={styles.errorText}>{checkError}</Text> : null}

            <Pressable
              onPress={() => void handleCheck()}
              disabled={!canCheck}
              style={({ pressed }) => [
                styles.checkButton,
                !canCheck && styles.checkButtonDisabled,
                pressed && canCheck ? styles.checkButtonPressed : null,
              ]}
            >
              {isChecking ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.checkButtonText}>Check Interactions</Text>
              )}
            </Pressable>

            {results ? (
              <View style={styles.results}>
                <Text style={styles.resultsTitle}>Results</Text>
                {results.length === 0 ? (
                  <View
                    style={[
                      styles.resultCard,
                      { backgroundColor: SEVERITY_META.none.background },
                    ]}
                  >
                    <View style={styles.resultHeader}>
                      <Ionicons
                        name={SEVERITY_META.none.icon}
                        size={20}
                        color={SEVERITY_META.none.color}
                      />
                      <Text style={[styles.resultLabel, { color: SEVERITY_META.none.color }]}>
                        {SEVERITY_META.none.label}
                      </Text>
                    </View>
                    <Text style={styles.resultExplanation}>
                      No known interactions were found for the selected medicines.
                    </Text>
                  </View>
                ) : (
                  results.map((result) => {
                    const meta = SEVERITY_META[result.severity] ?? SEVERITY_META.mild;
                    return (
                      <View
                        key={result.id}
                        style={[styles.resultCard, { backgroundColor: meta.background }]}
                      >
                        <View style={styles.resultHeader}>
                          <Ionicons name={meta.icon} size={20} color={meta.color} />
                          <Text style={[styles.resultLabel, { color: meta.color }]}>
                            {meta.label}
                          </Text>
                        </View>
                        <Text style={styles.resultPair}>{result.medicines.join(' + ')}</Text>
                        {result.title ? (
                          <Text style={styles.resultTitleText}>{result.title}</Text>
                        ) : null}
                        <Text style={styles.resultExplanation}>{result.explanation}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />
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
  listContent: {
    paddingHorizontal: 20,
  },
  headerBlock: {
    gap: 8,
    marginBottom: 16,
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
  selectedCount: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  checkRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.mint,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkContent: {
    flex: 1,
    gap: 2,
  },
  medicineName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  medicineMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  separator: {
    height: 10,
  },
  loader: {
    marginTop: 32,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  footer: {
    marginTop: 20,
    gap: 14,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
  checkButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonPressed: {
    opacity: 0.9,
  },
  checkButtonDisabled: {
    opacity: 0.5,
  },
  checkButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  results: {
    gap: 12,
    marginTop: 4,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  resultCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  resultPair: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  resultTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  resultExplanation: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.text,
  },
});
