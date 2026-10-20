import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { MoneyBucket } from '@/domain/herd';
import { STAGE_LABELS } from '@/domain/labels';
import { money } from '@/domain/format';
import { colors, sans, ui } from '@/theme';

const STAGE_COLOR: Record<string, string> = {
  piglet: '#C4622D',
  nursery: '#A9792E',
  weaner: '#A9792E',
  grower: '#C4A15A',
  finisher: '#2C6B4F',
  gilt: '#A3476A',
  sow: '#8C4318',
  boar: '#2C5F8A',
  barrow: '#3D6B58',
};

export function WeightChart({ points }: { points: { date: string; lb: number }[] }) {
  const sorted = [...points].filter((point) => Number.isFinite(point.lb)).sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) {
    return <Text style={ui.body}>Record a second weight and the history chart will draw.</Text>;
  }
  const min = Math.min(...sorted.map((point) => point.lb));
  const max = Math.max(...sorted.map((point) => point.lb));
  const span = Math.max(1, max - min);
  const width = Math.max(280, sorted.length * 56);
  const height = 150;
  const coords = sorted.map((point, index) => {
    const x = 16 + (index / (sorted.length - 1)) * (width - 32);
    const y = 16 + (1 - (point.lb - min) / span) * (height - 40);
    return { ...point, x, y };
  });
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
  return (
    <View style={{ gap: 6 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={width} height={height}>
          <Path d={path} stroke={colors.copper} strokeWidth={2.5} fill="none" />
          {coords.map((point) => (
            <G key={`${point.date}-${point.lb}`}>
              <Circle cx={point.x} cy={point.y} r={4} fill={colors.ink} />
              <SvgText x={point.x} y={height - 6} fontSize={10} fill={colors.muted} textAnchor="middle" fontFamily={sans}>
                {point.date.slice(5)}
              </SvgText>
            </G>
          ))}
        </Svg>
      </ScrollView>
      <Text style={ui.small}>
        {sorted[0].lb} lb on {sorted[0].date} to {sorted[sorted.length - 1].lb} lb on {sorted[sorted.length - 1].date}.
      </Text>
    </View>
  );
}

export function StageChart({
  counts,
  onPress,
}: {
  counts: { stage: string; count: number }[];
  onPress?: (stage: string) => void;
}) {
  const max = Math.max(1, ...counts.map((row) => row.count));
  const total = counts.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) {
    return <Text style={ui.body}>No active pigs yet. Add the first sow, boar, or show pig to see the herd by stage.</Text>;
  }
  return (
    <View style={{ gap: 10 }}>
      {counts.map((row) => (
        <Pressable key={row.stage} accessibilityRole="button" onPress={() => onPress?.(row.stage)} style={{ gap: 4, minHeight: 44, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: sans, fontSize: 15, fontWeight: '700', color: colors.text }}>{STAGE_LABELS[row.stage] || row.stage}</Text>
            <Text style={ui.small}>{row.count}</Text>
          </View>
          <View style={{ height: 14, borderRadius: 7, backgroundColor: '#F3EEE6', overflow: 'hidden' }}>
            <View
              style={{
                width: `${Math.max(row.count ? 4 : 0, (row.count / max) * 100)}%`,
                height: 14,
                borderRadius: 7,
                backgroundColor: STAGE_COLOR[row.stage] || colors.copper,
              }}
            />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export function MoneyChart({ buckets }: { buckets: MoneyBucket[] }) {
  const shown = buckets.filter((bucket, index) => bucket.incomeCents || bucket.expenseCents || index === buckets.length - 1);
  const rows = shown.length ? shown : buckets.slice(-12);
  if (!rows.length) return <Text style={ui.body}>No income or expenses in this range.</Text>;
  const max = Math.max(1, ...rows.map((row) => Math.max(row.incomeCents, row.expenseCents)));
  const groupWidth = 46;
  const height = 180;
  const width = Math.max(rows.length * groupWidth, 280);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Text style={ui.small}>Moss bars are income.</Text>
        <Text style={ui.small}>Clay bars are expenses.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={width} height={height + 28}>
          {rows.map((row, index) => {
            const x = index * groupWidth;
            const incomeH = (row.incomeCents / max) * (height - 8);
            const expenseH = (row.expenseCents / max) * (height - 8);
            return (
              <G key={row.key}>
                <Rect x={x + 4} y={height - incomeH} width={14} height={Math.max(incomeH, row.incomeCents ? 2 : 0)} fill={colors.moss} rx={3} />
                <Rect x={x + 22} y={height - expenseH} width={14} height={Math.max(expenseH, row.expenseCents ? 2 : 0)} fill={colors.clay} rx={3} />
                <SvgText x={x + 20} y={height + 16} fontSize={10} fill={colors.muted} textAnchor="middle" fontFamily={sans}>
                  {row.label.length > 8 ? row.label.slice(0, 3) : row.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </ScrollView>
      <Text style={ui.small}>
        Peak bucket {money(max)}. Each pair is one day or one month, with no line drawn between them.
      </Text>
    </View>
  );
}

export function CategoryBars({ rows }: { rows: { id: string; name: string; amountCents: number }[] }) {
  if (!rows.length) return <Text style={ui.small}>Nothing in this range.</Text>;
  const max = Math.max(1, ...rows.map((row) => row.amountCents));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((row) => (
        <View key={row.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ fontFamily: sans, fontWeight: '700', color: colors.text, flex: 1 }}>{row.name}</Text>
            <Text style={ui.small}>{money(row.amountCents)}</Text>
          </View>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: '#F3EEE6' }}>
            <View style={{ width: `${(row.amountCents / max) * 100}%`, height: 10, borderRadius: 5, backgroundColor: colors.gold }} />
          </View>
        </View>
      ))}
    </View>
  );
}
