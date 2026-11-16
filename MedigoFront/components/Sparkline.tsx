import Svg, { Polyline } from 'react-native-svg';
import { Colors } from '@/constants/colors';

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
};

export function Sparkline({
  data,
  width = 88,
  height = 32,
  color = Colors.primary,
}: SparklineProps) {
  const values = data.length > 0 ? data : [0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;

  const points = values
    .map((value, index) => {
      const x =
        values.length === 1
          ? width / 2
          : padding + (index / (values.length - 1)) * (width - padding * 2);
      const y =
        height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
