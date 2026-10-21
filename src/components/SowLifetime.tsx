import { Text, View } from 'react-native';
import { sowLifetime, sowLifetimeSummary, type SowFarrowingRecord } from '@/domain/herd';
import { percent } from '@/domain/format';
import { colors, sans, ui } from '@/theme';
import { Grid, Stat } from '@/components/ui';

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.cream,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 5,
        minHeight: 28,
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: sans, fontSize: 13, color: colors.muted, lineHeight: 18 }}>
        {label}{' '}
        <Text style={{ color: colors.text, fontWeight: '700' }}>{value}</Text>
      </Text>
    </View>
  );
}

function deadHint(stillborn: number, mummies: number): string {
  const still = `${stillborn} stillborn`;
  if (mummies <= 0) return still;
  return `${still}, ${mummies} mummified`;
}

function weanHint(weanedLitters: number, litters: number, avg: number | null): string {
  if (avg == null) return 'No litter weaned yet.';
  const avgText = `${avg.toFixed(1)} average`;
  if (weanedLitters === litters) return `${avgText} per litter.`;
  return `${avgText} per weaned litter (${weanedLitters} of ${litters}).`;
}

/** Lifetime farrowing under a sow row, or as stat cards on her page. */
export function SowLifetimeGlance({ litters, layout }: { litters: SowFarrowingRecord[]; layout: 'row' | 'page' }) {
  const stats = sowLifetime(litters);
  const summary = sowLifetimeSummary(stats);

  if (stats.litters === 0) {
    return (
      <Text accessibilityLabel={summary} style={layout === 'page' ? ui.body : ui.small}>
        No litters yet
      </Text>
    );
  }

  if (layout === 'row') {
    return (
      <View accessibilityLabel={summary} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        <Chip label="Litters" value={String(stats.litters)} />
        <Chip label="Born alive" value={percent(stats.bornAliveRate)} />
        <Chip label="Born dead" value={percent(stats.bornDeadRate)} />
        {stats.mummies > 0 ? <Chip label="Mummified" value={percent(stats.mummyRate)} /> : null}
        <Chip label="Weaned" value={String(stats.weaned)} />
        {stats.avgWeanedPerLitter != null ? <Chip label="Avg weaned" value={stats.avgWeanedPerLitter.toFixed(1)} /> : null}
      </View>
    );
  }

  return (
    <View accessibilityLabel={summary}>
      <Grid>
        <Stat label="Litters" value={String(stats.litters)} />
        <Stat label="Born alive" value={percent(stats.bornAliveRate)} hint={`${stats.bornAlive} of ${stats.totalBorn} born`} tone="good" />
        <Stat
          label="Born dead"
          value={percent(stats.bornDeadRate)}
          hint={stats.totalBorn > 0 ? deadHint(stats.stillborn, stats.mummies) : 'No piglets recorded on these litters.'}
          tone="bad"
        />
        {stats.mummies > 0 ? (
          <Stat label="Mummified" value={percent(stats.mummyRate)} hint={`${stats.mummies} counted in born dead`} />
        ) : null}
        <Stat label="Weaned" value={String(stats.weaned)} hint={weanHint(stats.weanedLitters, stats.litters, stats.avgWeanedPerLitter)} />
      </Grid>
    </View>
  );
}
