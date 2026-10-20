import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { categoryTotals, herdKpis, moneyBuckets, showPace, stageCounts, stockOf, upcomingTasks } from '@/domain/herd';
import { RANGE_LABELS, inRange, rangeFor, todayISO, type RangePreset } from '@/domain/dates';
import { adgLabel, money, percent, pounds } from '@/domain/format';
import { paceLabel } from '@/domain/herd';
import { inBreedingHerd, pigLabel } from '@/lib/view';
import { colors, sans, ui } from '@/theme';
import { MoneyChart, StageChart } from '@/components/Charts';
import { Gate } from '@/components/Gate';
import { Badge, Card, Chips, Grid, Page, Stat } from '@/components/ui';

const PRESETS: RangePreset[] = ['7d', 'month', 'last_month', '3m', '12m', 'last_year', 'all'];

export default function Dashboard() {
  return (
    <Gate title="Today">
      {(snap) => <Today snap={snap} />}
    </Gate>
  );
}

function Today({ snap }: { snap: Parameters<Parameters<typeof Gate>[0]['children']>[0] }) {
  const router = useRouter();
  const today = todayISO();
  const [preset, setPreset] = useState<RangePreset>('month');
  const range = rangeFor(preset, today);
  const txns = snap.transactions.map((txn) => ({
    kind: txn.kind,
    date: txn.txnDate,
    amountCents: txn.amountCents,
    categoryId: txn.categoryId,
  }));
  const inRangeTxns = snap.transactions.filter((txn) => inRange(txn.txnDate, range.from, range.to));
  const income = inRangeTxns.filter((txn) => txn.kind === 'income').reduce((sum, txn) => sum + txn.amountCents, 0);
  const expense = inRangeTxns.filter((txn) => txn.kind === 'expense').reduce((sum, txn) => sum + txn.amountCents, 0);
  const buckets = moneyBuckets(txns, range.from, range.to);
  const stages = stageCounts(snap.pigs);
  const tasks = upcomingTasks({
    today,
    gestationDays: snap.farm.gestationDays,
    heatCycleDays: snap.farm.heatCycleDays,
    weaningAgeDays: snap.farm.weaningAgeDays,
    pigs: snap.pigs.map((pig) => ({
      id: pig.id,
      tag: pig.tag,
      name: pig.name || '',
      stage: pig.stage,
      status: pig.status,
      gender: pig.gender,
      breedingHerd: inBreedingHerd(pig, snap.groups),
    })),
    breedings: snap.events.filter((event) => event.eventType === 'breeding'),
    outcomes: snap.events,
    litters: snap.litters,
    withdrawals: snap.events
      .filter((event) => event.withdrawalEnds && event.withdrawalEnds > today && event.pigId)
      .map((event) => ({ pigId: event.pigId as string, drug: event.drugName || event.vaccineName || 'Treatment', ends: event.withdrawalEnds as string })),
    lowFeeds: snap.feedTypes
      .map((feed) => ({ name: feed.name, onHand: stockOf(snap.feedMoves, feed.id), unit: feed.unit, reorder: feed.reorderLb }))
      .filter((feed) => feed.onHand < feed.reorder)
      .map(({ reorder: _reorder, ...feed }) => feed),
  });
  const kpis = useMemo(
    () =>
      herdKpis({
        today,
        gestationDays: snap.farm.gestationDays,
        weaningAgeDays: snap.farm.weaningAgeDays,
        pigs: snap.pigs,
        litters: snap.litters,
        fosters: snap.fosters,
        breedings: snap.events.filter((event) => event.eventType === 'breeding'),
        outcomes: snap.events,
      }),
    [snap, today],
  );
  const showCards = snap.shows
    .filter((show) => show.showDate >= today)
    .flatMap((show) =>
      snap.entries
        .filter((entry) => entry.showId === show.id)
        .map((entry) => {
          const pig = snap.pigs.find((row) => row.id === entry.pigId);
          const target = entry.targetWeightLb || show.targetWeightLb || 0;
          const weights = snap.events
            .filter((event) => event.pigId === entry.pigId && event.eventType === 'weight' && event.weightLb != null)
            .map((event) => ({ date: event.eventDate, lb: event.weightLb as number }));
          const pace = showPace({
            currentLb: pig?.weightLb ?? null,
            targetLb: target,
            showDate: show.showDate,
            today,
            weights,
          });
          return { show, entry, pig, pace, target };
        }),
    );

  return (
    <Page title={snap.farm.name} lede={`Barn notes for ${today}. Money uses ${RANGE_LABELS[preset].toLowerCase()}.`}>
      <Chips options={PRESETS.map((value) => ({ value, label: RANGE_LABELS[value] }))} value={preset} onChange={(value) => setPreset(value as RangePreset)} />
      <Grid>
        <Stat label="Income" value={money(income)} tone="good" />
        <Stat label="Expenses" value={money(expense)} tone="bad" />
        <Stat label="Net" value={money(income - expense)} tone={income - expense >= 0 ? 'good' : 'bad'} hint="Income minus expenses in this range." />
      </Grid>
      <Card>
        <Text style={ui.h2}>Income and expenses</Text>
        <MoneyChart buckets={buckets} />
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Card style={{ flexGrow: 1, flexBasis: 280 }}>
          <Text style={ui.h2}>Pigs by stage</Text>
          <Text style={ui.small}>{stages.reduce((sum, row) => sum + row.count, 0)} active. Tap a stage to open that list.</Text>
          <StageChart counts={stages} onPress={(stage) => router.push(`/pigs?stage=${stage}`)} />
        </Card>
        <Card style={{ flexGrow: 1, flexBasis: 280 }}>
          <Text style={ui.h2}>Needs a look</Text>
          {tasks.length === 0 ? <Text style={ui.body}>Nothing is due. Farrowings, heat checks, open sows, withdrawals, and low feed show up here.</Text> : null}
          <View style={{ gap: 8 }}>
            {tasks.slice(0, 8).map((item) => (
              <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push(item.href)} style={{ minHeight: 56, justifyContent: 'center', gap: 2 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge label={item.kicker} tone={item.tone === 'bad' ? 'bad' : item.tone === 'warn' ? 'warn' : 'info'} />
                  <Text style={{ fontFamily: sans, fontWeight: '700', fontSize: 16, color: colors.text }}>{item.title}</Text>
                </View>
                <Text style={ui.small}>{item.detail}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </View>
      <Card>
        <Text style={ui.h2}>Show pace</Text>
        {showCards.length === 0 ? <Text style={ui.body}>No pigs are entered in an upcoming show.</Text> : null}
        <View style={{ gap: 10 }}>
          {showCards.map(({ show, pig, pace, target }) => (
            <Pressable key={`${show.id}-${pig?.id}`} onPress={() => pig && router.push(`/pigs/${pig.id}`)} style={{ minHeight: 56, justifyContent: 'center' }}>
              <Text style={{ fontFamily: sans, fontWeight: '700', fontSize: 16 }}>{pig ? pigLabel(pig) : 'Missing pig'} · {show.name}</Text>
              <Text style={ui.small}>
                {paceLabel(pace.verdict)} · {pounds(pace.currentLb, 0)} toward {pounds(target, 0)} · recent gain {adgLabel(pace.actualAdg)}
                {pace.requiredAdg != null ? ` · need ${adgLabel(pace.requiredAdg)}` : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <Card>
        <Text style={ui.h2}>Trailing 12 months</Text>
        <Text style={ui.small}>
          Approximate, using {kpis.sowCount} active sows. Farrowing rate counts only breedings that already resolved.
        </Text>
        <Grid>
          <Stat label="Farrowing rate" value={percent(kpis.farrowingRate)} hint={`${kpis.farrowed} farrowed of ${kpis.matings} resolved`} />
          <Stat label="Pre-wean mortality" value={percent(kpis.preweanMortality)} />
          <Stat label="Pigs weaned / sow / year" value={kpis.psy == null ? '—' : kpis.psy.toFixed(1)} />
          <Stat label="Litters / sow / year" value={kpis.littersPerSow == null ? '—' : kpis.littersPerSow.toFixed(2)} />
          <Stat label="Weaned / litter" value={kpis.weanedPerLitter == null ? '—' : kpis.weanedPerLitter.toFixed(1)} />
          <Stat label="Non-productive days" value={kpis.npd == null ? '—' : kpis.npd.toFixed(0)} hint="365 minus litters × (gestation + weaning age)." />
        </Grid>
      </Card>
      <Text style={ui.small}>
        Expense categories this range: {categoryTotals(txns, snap.expenseCategories, 'expense', range.from, range.to).slice(0, 3).map((row) => row.name).join(', ') || 'none'}.
      </Text>
    </Page>
  );
}
