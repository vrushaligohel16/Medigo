import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { aiService } from '@/services/aiService';
import { medicineService } from '@/services/medicineService';
import type { Medicine, MedicineExplanation } from '@/types/medicine';
import { cancelMedicineReminders } from '@/utils/notifications';

export default function MedicineDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    familyMemberId?: string;
    familyMemberName?: string;
  }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const familyMemberIdParam =
    typeof params.familyMemberId === 'string' ? params.familyMemberId : undefined;
  const familyMemberNameParam =
    typeof params.familyMemberName === 'string' ? params.familyMemberName : undefined;

  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [explanation, setExplanation] = useState<MedicineExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const data = await medicineService.getById(id);
        if (!mounted) {
          return;
        }
        setMedicine(data);

        if (data) {
          setIsExplaining(true);
          setExplainError(null);
          setExplanation(null);
          try {
            const ai = await aiService.explainMedicine(data.name, data.id);
            if (mounted) {
              setExplanation(ai);
            }
          } catch (error) {
            if (mounted) {
              setExplanation(null);
              setExplainError(
                error instanceof Error
                  ? error.message
                  : 'Unable to load AI explanation.',
              );
            }
          } finally {
            if (mounted) {
              setIsExplaining(false);
            }
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [id]);

  const handleDelete = () => {
    if (!medicine) {
      return;
    }

    Alert.alert(
      'Delete medicine?',
      `Remove ${medicine.name} from your list? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setIsDeleting(true);
            medicineService
              .delete(medicine.id)
              .then(async () => {
                await cancelMedicineReminders(medicine.id);
                const memberId = medicine.familyMemberId || familyMemberIdParam;
                if (memberId) {
                  router.replace(`/family/${memberId}` as Href);
                } else {
                  router.replace('/(tabs)/medicines' as Href);
                }
              })
              .catch(() => {
                Alert.alert('Delete failed', 'Please try again.');
              })
              .finally(() => {
                setIsDeleting(false);
              });
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!medicine) {
    return (
      <View style={styles.centered}>
        <Text style={styles.missingTitle}>Medicine not found</Text>
        <Pressable onPress={() => router.back()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const editHref = (() => {
    const memberId = medicine.familyMemberId || familyMemberIdParam;
    if (!memberId) {
      return `/medicines/add?id=${medicine.id}`;
    }
    const name = familyMemberNameParam
      ? `&familyMemberName=${encodeURIComponent(familyMemberNameParam)}`
      : '';
    return `/medicines/add?id=${medicine.id}&familyMemberId=${encodeURIComponent(memberId)}${name}`;
  })();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Medicine Detail</Text>
        <Pressable
          onPress={() => router.push(editHref as Href)}
          hitSlop={12}
          style={styles.iconButton}
        >
          <Ionicons name="create-outline" size={22} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={[Colors.mint, Colors.peach]} style={styles.heroCard}>
          <View style={styles.iconWrap}>
            <Ionicons name="medical" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.name}>{medicine.name}</Text>
          <Text style={styles.dosage}>
            {medicine.dosage} · {medicine.form}
          </Text>
          {familyMemberNameParam || medicine.familyMemberId ? (
            <Text style={styles.familyLabel}>
              For {familyMemberNameParam || 'family member'}
            </Text>
          ) : null}
          <View style={styles.quantityPill}>
            <Text style={styles.quantityText}>
              {medicine.remainingQuantity} of {medicine.totalQuantity} remaining
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <View style={styles.scheduleRow}>
            <Ionicons name="repeat-outline" size={18} color={Colors.primary} />
            <Text style={styles.scheduleText}>
              {medicine.frequency}× per day
              {medicine.reminderTimes.length
                ? ` · ${medicine.reminderTimes.join(', ')}`
                : ''}
            </Text>
          </View>
          <View style={styles.scheduleRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            <Text style={styles.scheduleText}>
              {medicine.startDate}
              {medicine.endDate ? ` → ${medicine.endDate}` : ' · ongoing'}
            </Text>
          </View>
          {medicine.notes ? (
            <View style={styles.scheduleRow}>
              <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
              <Text style={styles.scheduleText}>{medicine.notes}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>AI Explanation</Text>
          </View>

          {isExplaining ? (
            <View style={styles.aiLoading}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.aiLoadingText}>
                Generating explanation… this can take a few seconds.
              </Text>
            </View>
          ) : explanation ? (
            <View style={styles.aiBody}>
              <View style={styles.aiBlock}>
                <Text style={styles.aiLabel}>What it's for</Text>
                <Text style={styles.aiText}>{explanation.whatItsFor}</Text>
              </View>

              <View style={styles.aiBlock}>
                <Text style={styles.aiLabel}>Common side effects</Text>
                {explanation.sideEffects.map((item) => (
                  <View key={item} style={styles.bulletRow}>
                    <View style={styles.bullet} />
                    <Text style={styles.aiText}>{item}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.aiBlock}>
                <Text style={styles.aiLabel}>Precautions</Text>
                {explanation.precautions.map((item) => (
                  <View key={item} style={styles.bulletRow}>
                    <View style={[styles.bullet, styles.bulletWarn]} />
                    <Text style={styles.aiText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.aiText}>
              {explainError ?? 'Explanation unavailable right now.'}
            </Text>
          )}
        </View>

        <Pressable
          onPress={() => router.push('/medicines/interactions' as Href)}
          style={styles.secondaryButton}
        >
          <Ionicons name="git-compare-outline" size={18} color={Colors.primary} />
          <Text style={styles.secondaryButtonText}>Check Interactions</Text>
        </Pressable>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => router.push(editHref as Href)}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
          <Pressable
            onPress={handleDelete}
            disabled={isDeleting}
            style={[styles.deleteButton, isDeleting && styles.deleteDisabled]}
          >
            {isDeleting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.deleteButtonText}>Delete</Text>
            )}
          </Pressable>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 16,
    paddingHorizontal: 24,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
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
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  dosage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },
  familyLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  quantityPill: {
    marginTop: 8,
    backgroundColor: Colors.white,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quantityText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  scheduleText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  aiCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiLoader: {
    marginVertical: 12,
  },
  aiLoading: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  aiLoadingText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: Colors.textSecondary,
    paddingHorizontal: 8,
  },
  aiBody: {
    gap: 16,
  },
  aiBlock: {
    gap: 8,
  },
  aiLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  aiText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.text,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 7,
  },
  bulletWarn: {
    backgroundColor: Colors.warning,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.mint,
    borderRadius: 14,
    minHeight: 48,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteDisabled: {
    opacity: 0.8,
  },
  deleteButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
});
