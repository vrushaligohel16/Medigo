import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { prescriptionService } from '@/services/prescriptionService';
import type { Prescription } from '@/types/prescription';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = 20;
const GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - GAP) / 2;

function formatUploadDate(value: string): string {
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

function PrescriptionThumbnail({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
        <Ionicons name="document-text-outline" size={32} color={Colors.primary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.thumbnail}
      onError={() => setFailed(true)}
    />
  );
}

export default function PrescriptionListScreen() {
  const insets = useSafeAreaInsets();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPrescriptions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await prescriptionService.getAll();
      setPrescriptions(data);
    } catch {
      setPrescriptions([]);
      setError('Unable to load prescriptions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPrescriptions();
    }, [loadPrescriptions]),
  );

  const renderItem = ({ item }: { item: Prescription }) => (
    <Pressable
      onPress={() => router.push(`/prescriptions/${item.id}` as Href)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <PrescriptionThumbnail uri={item.imageUrl} />
      <View style={styles.cardBody}>
        <Text style={styles.doctorName} numberOfLines={1}>
          {item.doctorName || 'Untitled prescription'}
        </Text>
        <Text style={styles.date}>{formatUploadDate(item.uploadedAt)}</Text>
        <Text style={styles.medCount}>
          {item.medicines.length} medicine{item.medicines.length === 1 ? '' : 's'}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Prescriptions</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Your Prescriptions</Text>
        <Text style={styles.subtitle}>Uploaded scripts with doctor details</Text>
      </View>

      {error && prescriptions.length > 0 ? (
        <Text style={styles.errorBanner}>{error}</Text>
      ) : null}

      {isLoading && prescriptions.length === 0 ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={prescriptions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 96 },
          ]}
          refreshing={isLoading}
          onRefresh={() => void loadPrescriptions()}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={40} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>No prescriptions yet</Text>
              <Text style={styles.emptyText}>
                {error ?? 'Tap + to photograph or upload a prescription.'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        onPress={() => router.push('/prescriptions/upload' as Href)}
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
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 12,
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
  errorBanner: {
    color: Colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    flexGrow: 1,
  },
  row: {
    gap: GAP,
    marginBottom: GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardPressed: {
    opacity: 0.92,
  },
  thumbnail: {
    width: '100%',
    height: CARD_WIDTH * 0.9,
    backgroundColor: Colors.mint,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 10,
    gap: 2,
  },
  doctorName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  date: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  medCount: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 56,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
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
});
