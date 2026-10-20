import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { categoryTotals, herdKpis, moneyBuckets, stockOf } from '@/domain/herd';
import { RANGE_LABELS, inRange, prettyDate, rangeFor, todayISO, type RangePreset } from '@/domain/dates';
import { money, percent, pounds } from '@/domain/format';
import { toCsv } from '@/domain/csv';
import { EVENT_LABELS, STAGE_LABELS, eventSummary } from '@/domain/labels';
import { inventoryPigs, named, oneParam, pigLabel } from '@/lib/view';
import { downloadText } from '@/lib/download';
import { ui } from '@/theme';
import { CategoryBars, MoneyChart } from '@/components/Charts';
import { Gate } from '@/components/Gate';
import { Button, Card, Chips, DateField, Fields, Notice, Page, Select } from '@/components/ui';

const VIEWS = [
  { value: 'money', label: 'Money' },
  { value: 'pigs', label: 'Pigs' },
  { value: 'events', label: 'Events' },
  { value: 'feed', label: 'Feed' },
  { value: 'breeding', label: 'Breeding' },
];

const PRESETS: RangePreset[] = ['7d', 'month', 'last_month', '3m', '6m', '12m', 'last_year', '3y', 'all', 'custom'];

export default function ReportsPage() {
  return (
    <Gate title="Reports">
      {(snap) => <Reports snap={snap} />}
    </Gate>
  );
}

function Reports({ snap }: { snap: import('@/data/types').Snapshot }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string; preset?: string; from?: string; to?: string; category?: string }>();
  const today = todayISO();
  const view = oneParam(params.view) || 'money';
  const requested = (oneParam(params.preset) || 'month') as RangePreset;
  const presetKnown = PRESETS.includes(requested);
  const preset: RangePreset = presetKnown ? requested : 'month';
  const from = oneParam(params.from);
  const to = oneParam(params.to);
  const category = oneParam(params.category);
  const rangeInvalid = preset === 'custom' && Boolean(from) && Boolean(to) && from > to;

  useEffect(() => {
    if (!params.view || !params.preset) {
      router.replace({ pathname: '/reports', params: { view, preset, ...(from ? { from } : {}), ...(to ? { to } : {}), ...(category ? { category } : {}) } });
    }
  }, [params.view, params.preset, view, preset, from, to, category, router]);

  function setQuery(partial: Record<string, string>) {
    const next = { view, preset, from, to, category, ...partial };
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(next)) {
      if (value) clean[key] = value;
    }
    router.replace({ pathname: '/reports', params: clean });
  }

  const range = rangeInvalid
    ? { from: from || null, to: from || today }
    : rangeFor(preset, today, { from: from || null, to: to || null });
  const txns = rangeInvalid
    ? []
    : snap.transactions.filter((txn) => inRange(txn.txnDate, range.from, range.to) && (!category || txn.categoryId === category || (category === 'feed' && txn.txnType === 'feed_purchase')));
  const income = txns.filter((txn) => txn.kind === 'income').reduce((sum, txn) => sum + txn.amountCents, 0);
  const expense = txns.filter((txn) => txn.kind === 'expense').reduce((sum, txn) => sum + txn.amountCents, 0);
  const moneyRows = txns.map((txn) => ({
    kind: txn.kind,
    date: txn.txnDate,
    amountCents: txn.amountCents,
    categoryId: txn.txnType === 'feed_purchase' && !txn.categoryId ? 'feed' : txn.categoryId,
  }));
  const buckets = moneyBuckets(moneyRows, range.from, range.to);
  const incomeCats = categoryTotals(moneyRows, snap.incomeCategories, 'income', range.from, range.to);
  const expenseCats = categoryTotals(
    moneyRows,
    [...snap.expenseCategories, { id: 'feed', name: 'Feed' }],
    'expense',
    range.from,
    range.to,
  );

  const events = useMemo(
    () => (rangeInvalid ? [] : snap.events.filter((event) => inRange(event.eventDate, range.from, range.to))),
    [snap.events, range.from, range.to, rangeInvalid],
  );
  const moves = rangeInvalid ? [] : snap.feedMoves.filter((move) => inRange(move.moveDate, range.from, range.to));
  const litters = rangeInvalid ? [] : snap.litters.filter((litter) => inRange(litter.farrowDate, range.from, range.to));
  const kpis = herdKpis({
    today,
    gestationDays: snap.farm.gestationDays,
    weaningAgeDays: snap.farm.weaningAgeDays,
    pigs: inventoryPigs(snap),
    litters: snap.litters,
    fosters: snap.fosters,
    breedings: snap.events.filter((event) => event.eventType === 'breeding'),
    outcomes: snap.events,
  });

  async function exportCsv() {
    if (view === 'money') {
      await downloadText(
        `herdkeep-money-${range.from || 'start'}-${range.to}.csv`,
        toCsv(
          ['Date', 'Kind', 'Type', 'Title', 'Category', 'Amount', 'Pig'],
          txns.map((txn) => [
            txn.txnDate,
            txn.kind,
            txn.txnType,
            txn.title,
            named(txn.kind === 'income' ? snap.incomeCategories : snap.expenseCategories, txn.categoryId),
            (txn.amountCents / 100).toFixed(2),
            txn.pigId ? pigLabel(snap.pigs.find((pig) => pig.id === txn.pigId)) : '',
          ]),
        ),
      );
      return;
    }
    if (view === 'events') {
      await downloadText(
        `herdkeep-events-${range.to}.csv`,
        toCsv(
          ['Date', 'Pig', 'Type', 'Detail'],
          events.map((event) => [event.eventDate, pigLabel(snap.pigs.find((pig) => pig.id === event.pigId)), event.eventType, eventSummary(event)]),
        ),
      );
      return;
    }
    if (view === 'feed') {
      await downloadText(
        `herdkeep-feed-${range.to}.csv`,
        toCsv(
          ['Date', 'Feed', 'Movement', 'Quantity', 'Cost'],
          moves.map((move) => [move.moveDate, named(snap.feedTypes, move.feedTypeId), move.movement, move.quantity, move.costCents != null ? (move.costCents / 100).toFixed(2) : '']),
        ),
      );
      return;
    }
    if (view === 'breeding') {
      await downloadText(
        `herdkeep-litters-${range.to}.csv`,
        toCsv(
          ['Farrow date', 'Sow', 'Born alive', 'Stillborn', 'Mummies', 'Weaned', 'Wean date'],
          litters.map((litter) => [litter.farrowDate, pigLabel(snap.pigs.find((pig) => pig.id === litter.sowId)), litter.bornAlive, litter.stillborn, litter.mummies, litter.weanedCount, litter.weanDate]),
        ),
      );
      return;
    }
    await downloadText(
      `herdkeep-pigs-${today}.csv`,
      toCsv(
        ['Tag', 'Name', 'Sex', 'Stage', 'Status', 'Breed', 'Group', 'Weight', 'Born'],
        snap.pigs.map((pig) => [pig.tag, pig.name, pig.gender, pig.stage, pig.status, named(snap.breeds, pig.breedId), named(snap.groups, pig.groupId), pig.weightLb, pig.dob]),
      ),
    );
  }

  const spanLabel = rangeInvalid ? 'Choose a From date on or before the To date.' : `${range.from ? prettyDate(range.from) : 'The start'} – ${prettyDate(range.to)}`;

  return (
    <Page title="Reports" lede={`${spanLabel}. Filters live in the address bar, so this view can be shared.`}>
      {!presetKnown ? <Notice tone="warn" text="That date range is not recognized. Showing this month." /> : null}
      {rangeInvalid ? <Notice tone="bad" text="The From date has to be on or before the To date." /> : null}
      <Chips options={VIEWS} value={view} onChange={(value) => setQuery({ view: value })} />
      <Chips options={PRESETS.map((value) => ({ value, label: RANGE_LABELS[value] }))} value={preset} onChange={(value) => setQuery({ preset: value })} />
      {preset === 'custom' ? (
        <Fields>
          <DateField label="From" value={from} onChange={(value) => setQuery({ from: value, preset: 'custom' })} />
          <DateField label="To" value={to || today} onChange={(value) => setQuery({ to: value, preset: 'custom' })} />
        </Fields>
      ) : null}
      {view === 'money' ? (
        <Select
          label="Category"
          value={category}
          onChange={(value) => setQuery({ category: value })}
          options={[{ value: '', label: 'All categories' }, ...snap.incomeCategories.map((row) => ({ value: row.id, label: `Income · ${row.name}` })), ...snap.expenseCategories.map((row) => ({ value: row.id, label: `Expense · ${row.name}` }))]}
        />
      ) : null}
      <Button label="Download CSV" tone="secondary" onPress={() => void exportCsv()} />

      {view === 'money' ? (
        <View style={{ gap: 12 }}>
          <Card>
            <Text style={ui.h2}>Totals</Text>
            <Row label="Income" value={money(income)} />
            <Row label="Expenses" value={money(expense)} />
            <Row label="Net" value={money(income - expense)} />
            <MoneyChart buckets={buckets} />
          </Card>
          <Card>
            <Text style={ui.h2}>Income by category</Text>
            <CategoryBars rows={incomeCats} />
            <Table headers={['Category', 'Amount']} rows={incomeCats.map((row) => [row.name, money(row.amountCents)])} total={['Total', money(incomeCats.reduce((sum, row) => sum + row.amountCents, 0))]} />
          </Card>
          <Card>
            <Text style={ui.h2}>Expenses by category</Text>
            <CategoryBars rows={expenseCats} />
            <Table headers={['Category', 'Amount']} rows={expenseCats.map((row) => [row.name, money(row.amountCents)])} total={['Total', money(expenseCats.reduce((sum, row) => sum + row.amountCents, 0))]} />
          </Card>
          <Card>
            <Text style={ui.h2}>Transactions</Text>
            <Table
              headers={['Date', 'Title', 'Amount']}
              rows={txns.map((txn) => [prettyDate(txn.txnDate), txn.title, `${txn.kind === 'expense' ? '−' : ''}${money(txn.amountCents)}`])}
            />
          </Card>
        </View>
      ) : null}

      {view === 'pigs' ? (
        <Card>
          <Text style={ui.h2}>Herd list</Text>
          <Text style={ui.small}>The pig list is the current herd, not limited to the date range. Events in range are on the Events view.</Text>
          {Object.entries(STAGE_LABELS).map(([stage, label]) => (
            <Row key={stage} label={label} value={String(snap.pigs.filter((pig) => pig.stage === stage && pig.status === 'active').length)} />
          ))}
          <Table
            headers={['Tag', 'Stage', 'Status', 'Weight']}
            rows={snap.pigs.map((pig) => [pigLabel(pig), STAGE_LABELS[pig.stage] || pig.stage, pig.status, pounds(pig.weightLb, 0)])}
          />
        </Card>
      ) : null}

      {view === 'events' ? (
        <Card>
          <Text style={ui.h2}>Events in range</Text>
          {Object.keys(EVENT_LABELS).map((type) => {
            const count = events.filter((event) => event.eventType === type).length;
            if (!count) return null;
            return <Row key={type} label={EVENT_LABELS[type]} value={String(count)} />;
          })}
          <Table headers={['Date', 'Pig', 'Event', 'Detail']} rows={events.slice(0, 40).map((event) => [prettyDate(event.eventDate), pigLabel(snap.pigs.find((pig) => pig.id === event.pigId)), EVENT_LABELS[event.eventType] || event.eventType, eventSummary(event)])} />
        </Card>
      ) : null}

      {view === 'feed' ? (
        <Card>
          <Text style={ui.h2}>Feed</Text>
          {snap.feedTypes.map((feed) => (
            <Row key={feed.id} label={`${feed.name} on hand`} value={pounds(stockOf(snap.feedMoves, feed.id), 0)} />
          ))}
          <Table
            headers={['Date', 'Feed', 'Move', 'Lb']}
            rows={moves.map((move) => [prettyDate(move.moveDate), named(snap.feedTypes, move.feedTypeId), move.movement, String(move.quantity)])}
          />
        </Card>
      ) : null}

      {view === 'breeding' ? (
        <Card>
          <Text style={ui.h2}>Breeding, trailing year</Text>
          <Row label="Farrowing rate" value={percent(kpis.farrowingRate)} />
          <Row label="Pre-wean mortality" value={percent(kpis.preweanMortality)} />
          <Row label="Pigs weaned per sow per year" value={kpis.psy == null ? '—' : kpis.psy.toFixed(1)} />
          <Row label="Estimated NPD" value={kpis.npd == null ? '—' : kpis.npd.toFixed(0)} />
          <Text style={[ui.h2, { marginTop: 8 }]}>Litters in range</Text>
          <Table
            headers={['Farrowed', 'Sow', 'Alive', 'Weaned']}
            rows={litters.map((litter) => [prettyDate(litter.farrowDate), pigLabel(snap.pigs.find((pig) => pig.id === litter.sowId)), String(litter.bornAlive), litter.weanedCount == null ? '—' : String(litter.weanedCount)])}
          />
        </Card>
      ) : null}
    </Page>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, minHeight: 32, alignItems: 'center' }}>
      <Text style={ui.body}>{label}</Text>
      <Text style={{ fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

function Table({ headers, rows, total }: { headers: string[]; rows: string[][]; total?: string[] }) {
  return (
    <View style={{ gap: 6, marginTop: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {headers.map((header) => (
          <Text key={header} style={[ui.label, { flex: 1, marginBottom: 0 }]}>{header}</Text>
        ))}
      </View>
      {rows.length === 0 ? <Text style={ui.small}>Nothing in this range.</Text> : null}
      {rows.map((row, index) => (
        <View key={`${row[0]}-${index}`} style={{ flexDirection: 'row', gap: 8, minHeight: 36, alignItems: 'center' }}>
          {row.map((cell, cellIndex) => (
            <Text key={cellIndex} style={[ui.small, { flex: 1, color: '#1C2430' }]}>{cell}</Text>
          ))}
        </View>
      ))}
      {total ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {total.map((cell, index) => (
            <Text key={index} style={[ui.body, { flex: 1, fontWeight: '700' }]}>{cell}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
