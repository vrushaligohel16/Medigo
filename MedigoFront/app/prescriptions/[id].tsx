import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { medicineService } from '@/services/medicineService';
import { prescriptionService } from '@/services/prescriptionService';
import type { ExtractedMedicine, Prescription } from '@/types/prescription';

const IMAGE_HEIGHT = Math.min(Dimensions.get('window').height * 0.42, 360);

function formatUploadDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ZoomableImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const next = savedScale.value * event.scale;
      scale.value = Math.min(Math.max(next, 1), 4);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) {
        scale.value = withTiming(1);
        savedScale.value = 1;
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
      } else {
        scale.value = withTiming(2);
        savedScale.value = 2;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, doubleTap)}>
      <View style={styles.imageFrame}>
        <Animated.Image
          source={{ uri }}
          style={[styles.image, animatedStyle]}
          resizeMode="contain"
        />
        <Text style={styles.zoomHint}>Pinch or double-tap to zoom</Text>
      </View>
    </GestureDetector>
  );
}

export default function PrescriptionDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!id) {
        setIsLoading(false);
        setPrescription(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await prescriptionService.getById(id);
        if (mounted) {
          setPrescription(data);
        }
      } catch {
        if (mounted) {
          setPrescription(null);
          setError('Unable to load this prescription.');
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

  const handleAddToMedicines = async (medicine: ExtractedMedicine) => {
    setAddingId(medicine.id);
    setError(null);

    try {
      await medicineService.create({
        name: medicine.name,
        dosage: medicine.dosage || 'As prescribed',
        form: 'tablet',
        frequency: 1,
        reminderTimes: ['08:00'],
        startDate: new Date().toISOString().slice(0, 10),
        quantity: 30,
        notes: prescription
          ? `Added from prescription by ${prescription.doctorName}`
          : undefined,
      });
      setAddedIds((current) => [...current, medicine.id]);
    } catch {
      setError(`Could not add ${medicine.name}. Please try again.`);
    } finally {
      setAddingId(null);
    }
  };

  const handleShare = async () => {
    if (!prescription) {
      return;
    }

    const medicineLines = prescription.medicines
      .map((item) => `• ${item.name}${item.dosage ? ` (${item.dosage})` : ''}`)
      .join('\n');

    try {
      await Share.share({
        message: [
          `Prescription from ${prescription.doctorName}`,
          `Uploaded ${formatUploadDate(prescription.uploadedAt)}`,
          '',
          'Medicines:',
          medicineLines || 'No medicines listed',
          '',
          prescription.imageUrl,
        ].join('\n'),
      });
    } catch {
      setError('Unable to share this prescription.');
    }
  };

  const handleDelete = () => {
    if (!prescription) {
      return;
    }

    Alert.alert(
      'Delete prescription?',
      'This will permanently remove the uploaded prescription.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsDeleting(true);
              try {
                await prescriptionService.delete(prescription.id);
                router.replace('/prescriptions' as Href);
              } catch {
                setError('Delete failed. Please try again.');
                setIsDeleting(false);
              }
            })();
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

  if (!prescription) {
    return (
      <View style={styles.centered}>
        <Text style={styles.missing}>{error ?? 'Prescription not found'}</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Prescription</Text>
        <Pressable onPress={() => void handleShare()} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="share-outline" size={22} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {prescription.imageUrl ? (
          <ZoomableImage uri={prescription.imageUrl} />
        ) : (
          <View style={[styles.imageFrame, styles.imagePlaceholder]}>
            <Ionicons name="document-text-outline" size={40} color={Colors.primary} />
            <Text style={styles.emptyMedicines}>No image available</Text>
          </View>
        )}

        <Text style={styles.doctor}>{prescription.doctorName}</Text>
        <Text style={styles.date}>Uploaded {formatUploadDate(prescription.uploadedAt)}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.sectionTitle}>Extracted Medicines</Text>
        {prescription.medicines.length === 0 ? (
          <Text style={styles.emptyMedicines}>No medicines were extracted.</Text>
        ) : (
          prescription.medicines.map((item) => {
            const isAdded = addedIds.includes(item.id);
            const isAdding = addingId === item.id;

            return (
              <View key={item.id} style={styles.medCard}>
                <View style={styles.medInfo}>
                  <Text style={styles.medName}>{item.name}</Text>
                  <Text style={styles.medDosage}>{item.dosage || 'Dosage not specified'}</Text>
                </View>
                <Pressable
                  onPress={() => void handleAddToMedicines(item)}
                  disabled={isAdded || isAdding}
                  style={({ pressed }) => [
                    styles.addButton,
                    isAdded && styles.addButtonDone,
                    pressed && !isAdded && !isAdding ? styles.pressed : null,
                  ]}
                >
                  {isAdding ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={[styles.addButtonText, isAdded && styles.addButtonTextDone]}>
                      {isAdded ? 'Added' : 'Add to My Medicines'}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })
        )}

        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => void handleShare()}
            style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
          >
            <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
            <Text style={styles.shareButtonText}>Share</Text>
          </Pressable>
          <Pressable
            onPress={handleDelete}
            disabled={isDeleting}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && !isDeleting ? styles.pressed : null,
              isDeleting ? styles.disabled : null,
            ]}
          >
            {isDeleting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={Colors.white} />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </>
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
    gap: 12,
    paddingHorizontal: 24,
  },
  missing: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  backLink: {
    padding: 8,
  },
  backLinkText: {
    color: Colors.primary,
    fontWeight: '700',
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
    gap: 12,
  },
  imageFrame: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.mint,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholder: {
    gap: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  zoomHint: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    fontSize: 11,
    color: Colors.textSecondary,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  doctor: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
  },
  date: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  emptyMedicines: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  medCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  medInfo: {
    gap: 2,
  },
  medName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  medDosage: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  addButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  addButtonDone: {
    backgroundColor: Colors.mint,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  addButtonTextDone: {
    color: Colors.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  shareButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.mint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  deleteButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.75,
  },
});
