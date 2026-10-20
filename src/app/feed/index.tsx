import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { can, stockOf } from '@/domain/herd';
import { centsFromDollars, dollarsInput, money, parseNumber, pounds } from '@/domain/format';
import { inRange, prettyDate, todayISO } from '@/domain/dates';
import { toCsv } from '@/domain/csv';
import { cleanParams, named, oneParam } from '@/lib/view';
import { downloadText } from '@/lib/download';
import { ui } from '@/theme';
import { Gate } from '@/components/Gate';
import { useSave } from '@/components/useSave';
import { Badge, Button, Card, DateField, Field, Fields, Notice, Page, Select, StackList, confirmAsync } from '@/components/ui';

export default function FeedPage() {
  return (
    <Gate title="Feed">
      {(snap) => <Feed snap={snap} />}
    </Gate>
  );
}

function Feed({ snap }: { snap: import('@/data/types').Snapshot }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  const from = oneParam(params.from);
  const to = oneParam(params.to);
  const { error, busy, submit } = useSave();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [movement, setMovement] = useState<'addition' | 'reduction'>('reduction');
  const [feedTypeId, setFeedTypeId] = useState(snap.feedTypes[0]?.id || '');
  const [moveDate, setMoveDate] = useState(todayISO());
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [remark, setRemark] = useState('fed');
  const [notes, setNotes] = useState('');
  const writable = can(snap.actor.role, 'write');
  const canDelete = can(snap.actor.role, 'delete');
  const rangeError = from && to && from > to ? 'The From date has to be on or before the To date.' : '';
  const moves = snap.feedMoves.filter((move) => !rangeError && (!(from || to) || inRange(move.moveDate, from || null, to || null)));

  function loadMove(id: string) {
    const move = snap.feedMoves.find((row) => row.id === id);
    if (!move) return;
    setEditingId(move.id);
    setMovement(move.movement);
    setFeedTypeId(move.feedTypeId);
    setMoveDate(move.moveDate);
    setQuantity(String(move.quantity));
    setCost(dollarsInput(move.costCents));
    setRemark(move.remark || 'fed');
    setNotes(move.notes || '');
  }

  return (
    <Page
      title="Feed room"
      lede="Stock is in pounds. A delivery with a cost creates the expense for you, so do not also type it under Expenses."
      action={
        <Button
          tone="secondary"
          label="Download CSV"
          onPress={() => {
            void downloadText(
              'herdkeep-feed.csv',
              toCsv(
                ['Date', 'Feed', 'Movement', 'Quantity', 'Cost', 'Remark'],
                moves.map((move) => [move.moveDate, named(snap.feedTypes, move.feedTypeId), move.movement, move.quantity, move.costCents != null ? (move.costCents / 100).toFixed(2) : '', move.remark]),
              ),
            );
          }}
        />
      }
    >
      {error ? <Notice tone="bad" text={error} /> : null}
      <Fields>
        <DateField label="From" value={from} onChange={(value) => router.replace({ pathname: '/feed', params: cleanParams(params, { from: value }) })} />
        <DateField label="To" value={to} onChange={(value) => router.replace({ pathname: '/feed', params: cleanParams(params, { to: value }) })} />
      </Fields>
      {rangeError ? <Notice tone="bad" text={rangeError} /> : null}
      <Card>
        <Text style={ui.h2}>On hand</Text>
        {snap.feedTypes.map((feed) => {
          const onHand = stockOf(snap.feedMoves, feed.id);
          const low = onHand < feed.reorderLb;
          return (
            <View key={feed.id} style={{ minHeight: 48, gap: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={{ fontWeight: '700', fontSize: 16 }}>{feed.name}</Text>
                {low ? <Badge label="Low" tone="warn" /> : <Badge label="Stocked" tone="good" />}
              </View>
              <Text style={ui.small}>{pounds(onHand, 0)} on hand · reorder at {pounds(feed.reorderLb, 0)}</Text>
            </View>
          );
        })}
      </Card>
      {writable ? (
        <Card>
          <Text style={ui.h2}>{editingId ? 'Edit movement' : movement === 'addition' ? 'Delivery' : 'Feed out'}</Text>
          <Fields>
            <Select
              label="Movement"
              value={movement}
              onChange={(value) => setMovement(value as 'addition' | 'reduction')}
              options={[
                { value: 'reduction', label: 'Reduction' },
                { value: 'addition', label: 'Addition' },
              ]}
            />
            <Select label="Feed" value={feedTypeId} onChange={setFeedTypeId} options={snap.feedTypes.map((feed) => ({ value: feed.id, label: feed.name }))} />
            <DateField label="Date" value={moveDate} onChange={setMoveDate} />
            <Field label="Quantity (lb)" value={quantity} onChange={setQuantity} />
            {movement === 'addition' ? <Field label="Cost (USD)" value={cost} onChange={setCost} placeholder="Leave blank if already expensed" /> : null}
            {movement === 'reduction' ? (
              <Select
                label="Why it left"
                value={remark}
                onChange={setRemark}
                options={[
                  { value: 'fed', label: 'Fed' },
                  { value: 'waste', label: 'Waste' },
                  { value: 'transfer', label: 'Transfer' },
                ]}
              />
            ) : null}
          </Fields>
          <Field label="Notes" value={notes} onChange={setNotes} />
          <Button
            label={busy ? 'Saving…' : editingId ? 'Save changes' : 'Save movement'}
            disabled={busy}
            onPress={() => {
              void submit(async (repo, actor) => {
                await repo.saveFeed(
                  actor,
                  {
                    movement,
                    feedTypeId,
                    moveDate,
                    quantity: parseNumber(quantity) || 0,
                    costCents: movement === 'addition' ? centsFromDollars(cost) : null,
                    remark: movement === 'reduction' ? remark : '',
                    doneBy: actor.name,
                    notes,
                  },
                  editingId || undefined,
                );
                setEditingId(null);
                setQuantity('');
                setCost('');
                setNotes('');
              });
            }}
          />
          {editingId ? <Button tone="ghost" label="Cancel edit" onPress={() => setEditingId(null)} /> : null}
        </Card>
      ) : null}
      <StackList
        rows={moves.map((move) => {
          const feed = snap.feedTypes.find((row) => row.id === move.feedTypeId);
          return {
            key: move.id,
            title: `${move.movement === 'addition' ? 'In' : 'Out'} ${move.quantity} lb ${feed?.name || 'feed'}`,
            meta: prettyDate(move.moveDate),
            tone: move.movement === 'addition' ? 'good' : 'neutral',
            detail: `${move.remark || move.notes || 'No note'}${move.costCents ? ` · ${money(move.costCents)}` : ''}${move.expenseId ? ' · linked expense' : ''}`,
            action: (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {writable ? <Button tone="ghost" label="Edit" onPress={() => loadMove(move.id)} /> : null}
                {canDelete ? (
              <Button
                tone="ghost"
                label="Delete"
                onPress={() => {
                  void (async () => {
                    const ok = await confirmAsync('Delete this feed movement and its linked expense, if it has one?');
                    if (!ok) return;
                    await submit((repo, actor) => repo.deleteFeed(actor, move.id));
                  })();
                }}
              />
            ) : null}
              </View>
            ),
          };
        })}
      />
    </Page>
  );
}
