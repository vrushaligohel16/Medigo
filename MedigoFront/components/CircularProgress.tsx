import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';

type CircularProgressProps = {
  taken: number;
  total: number;
  size?: number;
};

export function CircularProgress({ taken, total, size = 96 }: CircularProgressProps) {
  const progress = total > 0 ? Math.min(taken / total, 1) : 0;
  const stroke = 10;
  const trackSize = size;
  const fillSize = size - stroke * 2;

  return (
    <View style={[styles.wrap, { width: trackSize, height: trackSize }]}>
      <View
        style={[
          styles.track,
          {
            width: trackSize,
            height: trackSize,
            borderRadius: trackSize / 2,
            borderWidth: stroke,
          },
        ]}
      />
      <View
        style={[
          styles.fillOverlay,
          {
            width: trackSize,
            height: trackSize,
            borderRadius: trackSize / 2,
            borderWidth: stroke,
            borderColor: Colors.primary,
            opacity: 0.15 + progress * 0.85,
            transform: [{ scale: 0.92 + progress * 0.08 }],
          },
        ]}
      />
      <View
        style={[
          styles.inner,
          {
            width: fillSize,
            height: fillSize,
            borderRadius: fillSize / 2,
          },
        ]}
      >
        <Text style={styles.value}>
          {taken}/{total}
        </Text>
        <Text style={styles.label}>taken</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    borderColor: Colors.border,
  },
  fillOverlay: {
    position: 'absolute',
  },
  inner: {
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
