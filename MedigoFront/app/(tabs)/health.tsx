import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import {
  formatMetricValue,
  healthService,
  METRIC_META,
} from '@/services/healthService';
import type { HealthMetricRecord, HealthMetricType } from '@/types/health';

const CARD_TYPES: HealthMetricType[] = ['bp', 'sugar', 'weight', 'water'];

type LatestMap = Partial<Record<HealthMetricType, HealthMetricRecord | null>>;

export default function HealthDashboardScreen() {
  const insets = useSafeAreaInsets();
  const [latestByType, setLatestByType] = useState<LatestMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        CARD_TYPES.map(async (type) => {
          try {
            const latest = await healthService.getLatest(type);
            return [type, latest] as const;
          } catch {
            return [type, null] as const;
          }
        }),
      );

      const next: LatestMap = {};
      for (const [type, latest] of results) {
        next[type] = latest;
      }
      setLatestByType(next);
    } catch {
      setError('Unable to load health summaries.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadLatest();
    }, [loadLatest]),
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => void loadLatest()}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Health</Text>
          <Text style={styles.subtitle}>Track vitals and daily wellness</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isLoading && Object.keys(latestByType).length === 0 ? (
          <ActivityIndicator color={Colors.primary} style={styles.loader} />
        ) : (
          <View style={styles.grid}>
            {CARD_TYPES.map((type) => {
              const meta = METRIC_META[type];
              const latest = latestByType[type];
              const hasData = latest != null;

              return (
                <Pressable
                  key={type}
                  onPress={() =>
                    router.push(`/health/history?metric=${type}` as Href)
                  }
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <Text style={styles.cardTitle}>{meta.title}</Text>
                  {hasData ? (
                    <>
                      <Text style={styles.cardValue}>
                        {formatMetricValue(latest)}
                        <Text style={styles.cardUnit}> {latest.unit || meta.unit}</Text>
                      </Text>
                      <Text style={styles.cardMeta}>
                        {new Date(latest.recordedAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.noData}>No data yet</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        <Pressable
          onPress={() => router.push('/health/add-record' as Href)}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={22} color={Colors.white} />
          <Text style={styles.addButtonText}>Log New Record</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/health/history' as Href)}
          style={styles.historyLink}
        >
          <Text style={styles.historyLinkText}>View Full History</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  header: {
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
    fontSize: 13,
  },
  loader: {
    marginVertical: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47.5%',
    minHeight: 120,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  cardUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  cardMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  noData: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 8,
  },
  addButton: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  historyLinkText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  pressed: {
    opacity: 0.9,
  },
});
