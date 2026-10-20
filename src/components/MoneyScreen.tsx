import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { can } from '@/domain/herd';
import { inRange, prettyDate } from '@/domain/dates';
import { money, titleCase } from '@/domain/format';
import { toCsv } from '@/domain/csv';
import { cleanParams, named, oneParam, pigLabel } from '@/lib/view';
import { downloadText } from '@/lib/download';
import type { Snapshot } from '@/data/types';
import { ui } from '@/theme';
import { Gate } from './Gate';
import { useStickyAdd } from './Shell';
import { TxnForm } from './TxnForm';
import { useSave } from './useSave';
import { Button, Card, DateField, Empty, Fields, Notice, Page, Select, StackList, confirmAsync, useNarrow } from './ui';

export function MoneyList({ kind }: { kind: 'income' | 'expense' }) {
  const title = kind === 'income' ? 'Income' : 'Expenses';
  const href = kind === 'income' ? '/income/new' : '/expenses/new';
  return (
    <Gate title={title}>
      {(snap) => <List snap={snap} kind={kind} title={title} href={href} />}
    </Gate>
  );
}

function List({ snap, kind, title, href }: { snap: Snapshot; kind: 'income' | 'expense'; title: string; href: string }) {
  const router = useRouter();
  const { narrow } = useNarrow();
  const params = useLocalSearchParams<{ from?: string; to?: string; pig?: string }>();
  const from = oneParam(params.from);
  const to = oneParam(params.to);
  const pigId = oneParam(params.pig);
  const writable = can(snap.actor.role, 'write');
  useStickyAdd(writable ? { label: `Add ${kind}`, href } : null);
  const rangeError = from && to && from > to ? 'The From date has to be on or before the To date.' : '';
  const rows = snap.transactions.filter((txn) => {
    if (txn.kind !== kind) return false;
    if (pigId && txn.pigId !== pigId) return false;
    if (rangeError) return false;
    if ((from || to) && !inRange(txn.txnDate, from || null, to || null)) return false;
    return true;
  });
  const total = rows.reduce((sum, txn) => sum + txn.amountCents, 0);
  const categories = kind === 'income' ? snap.incomeCategories : snap.expenseCategories;
  const categoryTotals = rollup(rows, (txn) => (txn.txnType === 'feed_purchase' ? 'feed' : txn.categoryId || 'none'), (txn) =>
    txn.txnType === 'feed_purchase' ? 'Feed' : named(categories, txn.categoryId),
  );
  const typeTotals = rollup(rows, (txn) => txn.txnType, (txn) => titleCase(txn.txnType));
  const lede =
    kind === 'expense'
      ? `${money(total)} across ${rows.length} rows. Feed purchases share one stock movement, so they are not entered again under Feed.`
      : `${money(total)} across ${rows.length} rows. A pig sale from the event form lands here with the buyer and the price.`;
  function setQuery(patch: Record<string, string | null>) {
    router.replace({ pathname: kind === 'income' ? '/income' : '/expenses', params: cleanParams(params, patch) });
  }
  return (
    <Page
      title={title}
      lede={lede}
      action={
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button
            tone="secondary"
            label="Download CSV"
            onPress={() => {
              void downloadText(
                `herdkeep-${kind}.csv`,
                toCsv(
                  ['Date', 'Title', 'Type', 'Category', 'Amount', 'Pig'],
                  rows.map((txn) => [
                    txn.txnDate,
                    txn.title,
                    titleCase(txn.txnType),
                    named(categories, txn.categoryId),
                    (txn.amountCents / 100).toFixed(2),
                    txn.pigId ? pigLabel(snap.pigs.find((pig) => pig.id === txn.pigId)) : '',
                  ]),
                ),
              );
            }}
          />
          {writable && !narrow ? <Button label={`Add ${kind}`} onPress={() => router.push(href)} /> : null}
        </View>
      }
    >
      <Fields>
        <DateField label="From" value={from} onChange={(value) => setQuery({ from: value })} />
        <DateField label="To" value={to} onChange={(value) => setQuery({ to: value })} />
        <Select
          label="Pig"
          value={pigId}
          onChange={(value) => setQuery({ pig: value })}
          options={[{ value: '', label: 'Any pig' }, ...snap.pigs.map((pig) => ({ value: pig.id, label: pigLabel(pig) }))]}
        />
      </Fields>
      {rangeError ? <Notice tone="bad" text={rangeError} /> : null}
      <Card>
        <Text style={ui.h2}>By category</Text>
        {categoryTotals.length === 0 ? <Text style={ui.small}>Nothing in this list.</Text> : null}
        {categoryTotals.map((row) => (
          <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, minHeight: 32 }}>
            <Text style={ui.body}>{row.label}</Text>
            <Text style={ui.body}>{money(row.cents)}</Text>
          </View>
        ))}
        <Text style={[ui.h2, { marginTop: 8 }]}>By type</Text>
        {typeTotals.length === 0 ? <Text style={ui.small}>Nothing in this list.</Text> : null}
        {typeTotals.map((row) => (
          <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, minHeight: 32 }}>
            <Text style={ui.body}>{row.label}</Text>
            <Text style={ui.body}>{money(row.cents)}</Text>
          </View>
        ))}
      </Card>
      {rows.length === 0 ? <Empty title={`No ${kind} yet`} body="Sales from the event form land here automatically." /> : null}
      <StackList
        rows={rows.map((txn) => ({
          key: txn.id,
          title: txn.title,
          meta: money(txn.amountCents),
          tone: kind === 'income' ? 'good' : 'warn',
          detail: `${prettyDate(txn.txnDate)} · ${titleCase(txn.txnType)} · ${txn.txnType === 'feed_purchase' ? 'Feed' : named(categories, txn.categoryId)}${txn.pigId ? ` · ${pigLabel(snap.pigs.find((pig) => pig.id === txn.pigId))}` : ''}`,
          onPress: () => router.push(kind === 'income' ? `/income/${txn.id}` : `/expenses/${txn.id}`),
        }))}
      />
    </Page>
  );
}

export function MoneyEdit({ kind, id }: { kind: 'income' | 'expense'; id?: string }) {
  const router = useRouter();
  const { error, busy, submit } = useSave();
  const title = id ? `Edit ${kind}` : kind === 'income' ? 'Add income' : 'Add expense';
  return (
    <Gate title={title}>
      {(snap) => {
        const txn = id ? snap.transactions.find((row) => row.id === id && row.kind === kind) : undefined;
        if (id && !txn) {
          return (
            <Page title={title}>
              <Empty title="Transaction not found" body="It may have been deleted with the sale or the feed delivery." />
            </Page>
          );
        }
        return (
          <Page title={title} lede="Change the type if it was filed in the wrong place. Amounts stay in dollars and cents.">
            {error ? <Notice tone="bad" text={error} /> : null}
            <Card>
              <TxnForm snap={snap} kind={kind} txn={txn} />
            </Card>
            {txn && can(snap.actor.role, 'delete') ? (
              <Button
                tone="danger"
                label={busy ? 'Deleting…' : 'Delete'}
                disabled={busy}
                onPress={() => {
                  void (async () => {
                    const ok = await confirmAsync('Delete this transaction? A linked feed delivery is removed with it.');
                    if (!ok) return;
                    const done = await submit((repo, actor) => repo.deleteTransaction(actor, txn.id));
                    if (done) router.replace(kind === 'income' ? '/income' : '/expenses');
                  })();
                }}
              />
            ) : null}
            {txn?.feedMoveId ? <Text style={ui.small}>This row is tied to a feed delivery. Editing the quantity updates that stock movement.</Text> : null}
          </Page>
        );
      }}
    </Gate>
  );
}

function rollup<T>(rows: T[], keyOf: (row: T) => string, labelOf: (row: T) => string): { label: string; cents: number }[] {
  const totals = new Map<string, { label: string; cents: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const current = totals.get(key) || { label: labelOf(row), cents: 0 };
    current.cents += (row as { amountCents: number }).amountCents;
    totals.set(key, current);
  }
  return [...totals.values()].sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label));
}
