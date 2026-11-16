import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { healthService } from '@/services/healthService';
import type {
  HealthHistoryRange,
  HealthMetricRecord,
  HealthMetricType,
} from '@/types/health';

const METRIC_TABS: { key: HealthMetricType; label: string }[] = [
  { key: 'bp', label: 'BP' },
  { key: 'sugar', label: 'Sugar' },
  { key: 'weight', label: 'Weight' },
  { key: 'water', label: 'Water' },
];

function parseMetricParam(value: string | string[] | undefined): HealthMetricType {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'bp' || raw === 'sugar' || raw === 'weight' || raw === 'water') {
    return raw;
  }
  return 'bp';
}

const RANGE_OPTIONS: { key: HealthHistoryRange; label: string }[] = [
  { key: 7, label: '7D' },
  { key: 30, label: '30D' },
  { key: 90, label: '90D' },
];

const CHART_WIDTH = Dimensions.get('window').width - 40;

function metricValue(record: HealthMetricRecord): number {
  if (record.type === 'bp') {
    return record.systolic ?? 0;
  }
  return record.value ?? 0;
}

function formatRecordValue(record: HealthMetricRecord): string {
  if (record.type === 'bp') {
    return `${record.systolic}/${record.diastolic} ${record.unit}`;
  }
  return `${record.value} ${record.unit}`;
}

function buildChartData(records: HealthMetricRecord[]) {
  const chronological = [...records].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );

  if (chronological.length === 0) {
    return {
      labels: ['—'],
      datasets: [{ data: [0] }],
    };
  }

  const labels = chronological.map((item) => {
    const date = new Date(item.recordedAt);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });

  const sampledLabels = labels.map((label, index) => {
    if (labels.length <= 6) {
      return label;
    }
    const step = Math.ceil(labels.length / 5);
    return index % step === 0 || index === labels.length - 1 ? label : '';
  });

  return {
    labels: sampledLabels,
    datasets: [
      {
        data: chronological.map(metricValue),
        color: () => Colors.primary,
        strokeWidth: 2,
      },
    ],
  };
}

export default function HealthHistoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ metric?: string }>();
  const [metric, setMetric] = useState<HealthMetricType>(() =>
    parseMetricParam(params.metric),
  );
  const [range, setRange] = useState<HealthHistoryRange>(30);
  const [records, setRecords] = useState<HealthMetricRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(
    async (type: HealthMetricType, days: HealthHistoryRange) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await healthService.getRecordsByType(type, days);
        setRecords(data);
      } catch {
        setRecords([]);
        setError('Unable to load health history.');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void loadHistory(metric, range);
    }, [loadHistory, metric, range]),
  );

  const openAddRecord = () => {
    router.push(`/health/add-record?type=${metric}` as Href);
  };

  const chartData = buildChartData(records);
  const metricLabel = METRIC_TABS.find((tab) => tab.key === metric)?.label ?? 'Health';

  const handleDelete = (record: HealthMetricRecord) => {
    Alert.alert(
      'Delete entry?',
      `Remove the reading from ${new Date(record.recordedAt).toLocaleDateString()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await healthService.deleteRecord(record.id);
                setRecords((current) =>
                  current.filter((item) => item.id !== record.id),
                );
              } catch {
                Alert.alert('Delete failed', 'Could not remove this entry. Please try again.');
              }
            })();
          },
        },
      ],
    );
  };

  const renderRightActions = (record: HealthMetricRecord) => (
    <Pressable onPress={() => handleDelete(record)} style={styles.deleteAction}>
      <Ionicons name="trash-outline" size={20} color={Colors.white} />
      <Text style={styles.deleteActionText}>Delete</Text>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Health History</Text>
        <Pressable onPress={openAddRecord} hitSlop={12} style={styles.iconButton}>
          <Ionicons name="add-circle" size={26} color={Colors.primary} />
        </Pressable>
      </View>

      <View style={styles.controls}>
        <View style={styles.segmentRow}>
          {METRIC_TABS.map((tab) => {
            const selected = metric === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setMetric(tab.key)}
                style={[styles.segment, selected && styles.segmentSelected]}
              >
                <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.segmentRow}>
          {RANGE_OPTIONS.map((option) => {
            const selected = range === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setRange(option.key)}
                style={[styles.rangeChip, selected && styles.rangeChipSelected]}
              >
                <Text style={[styles.rangeText, selected && styles.rangeTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {isLoading && records.length === 0 ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 96 },
          ]}
          ListHeaderComponent={
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>
                {metricLabel} trend · last {range} days
              </Text>
              {records.length === 0 ? (
                <Text style={styles.emptyText}>No entries in this range.</Text>
              ) : (
                <LineChart
                  data={chartData}
                  width={CHART_WIDTH - 8}
                  height={200}
                  chartConfig={{
                    backgroundColor: Colors.white,
                    backgroundGradientFrom: Colors.white,
                    backgroundGradientTo: Colors.white,
                    decimalPlaces: metric === 'weight' ? 1 : 0,
                    color: () => Colors.primary,
                    labelColor: () => Colors.textSecondary,
                    propsForDots: {
                      r: '3',
                      strokeWidth: '1',
                      stroke: Colors.primary,
                    },
                    propsForBackgroundLines: {
                      stroke: Colors.border,
                    },
                  }}
                  bezier
                  style={styles.chart}
                  withInnerLines
                  withOuterLines={false}
                  fromZero={false}
                />
              )}
              <Text style={styles.listHeading}>Past Entries</Text>
              <Text style={styles.swipeHint}>Swipe left on a row to delete</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No past entries for this metric.</Text>
              <Pressable
                onPress={openAddRecord}
                style={({ pressed }) => [
                  styles.emptyAddButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="add" size={18} color={Colors.white} />
                <Text style={styles.emptyAddText}>Log {metricLabel}</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Swipeable
              overshootRight={false}
              renderRightActions={() => renderRightActions(item)}
            >
              <View style={styles.rowCard}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowValue}>{formatRecordValue(item)}</Text>
                  <Text style={styles.rowDate}>
                    {new Date(item.recordedAt).toLocaleString()}
                  </Text>
                  {item.sugarContext ? (
                    <Text style={styles.rowMeta}>
                      {item.sugarContext === 'fasting' ? 'Fasting' : 'Post-meal'}
                    </Text>
                  ) : null}
                  {item.notes ? <Text style={styles.rowMeta}>{item.notes}</Text> : null}
                </View>
                <Ionicons name="chevron-back" size={16} color={Colors.dotInactive} />
              </View>
            </Swipeable>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          onPress={openAddRecord}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={22} color={Colors.white} />
          <Text style={styles.addButtonText}>Log {metricLabel} Record</Text>
        </Pressable>
      </View>
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
  controls: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: Colors.chipInactive,
  },
  segmentSelected: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  segmentTextSelected: {
    color: Colors.white,
  },
  rangeChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rangeChipSelected: {
    backgroundColor: Colors.mint,
    borderColor: Colors.primary,
  },
  rangeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  rangeTextSelected: {
    color: Colors.primary,
  },
  errorText: {
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  loader: {
    marginTop: 40,
  },
  listContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  chartCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    gap: 8,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 4,
  },
  chart: {
    borderRadius: 12,
    marginLeft: -8,
  },
  listHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  swipeHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  separator: {
    height: 10,
  },
  rowCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  rowDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  rowMeta: {
    fontSize: 12,
    color: Colors.primary,
  },
  deleteAction: {
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    borderRadius: 14,
    marginLeft: 8,
    gap: 4,
  },
  deleteActionText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    paddingVertical: 8,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyAddText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    minHeight: 52,
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
  pressed: {
    opacity: 0.88,
  },
});
