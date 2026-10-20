import { useState } from 'react';
import { Text, View } from 'react-native';
import { can, stockOf } from '@/domain/herd';
import { centsFromDollars, money, parseNumber, pounds } from '@/domain/format';
import { prettyDate, todayISO } from '@/domain/dates';
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
  const { error, busy, submit } = useSave();
  const [movement, setMovement] = useState<'addition' | 'reduction'>('reduction');
  const [feedTypeId, setFeedTypeId] = useState(snap.feedTypes[0]?.id || '');
  const [moveDate, setMoveDate] = useState(todayISO());
  const [quantity, setQuantity] = useState('');
  const [cost, setCost] = useState('');
  const [remark, setRemark] = useState('fed');
  const [notes, setNotes] = useState('');
  const writable = can(snap.actor.role, 'write');
  const canDelete = can(snap.actor.role, 'delete');

  return (
    <Page title="Feed room" lede="Stock is in pounds. A delivery with a cost creates the expense for you, so do not also type it under Expenses.">
      {error ? <Notice tone="bad" text={error} /> : null}
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
          <Text style={ui.h2}>{movement === 'addition' ? 'Delivery' : 'Feed out'}</Text>
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
            label={busy ? 'Saving…' : 'Save movement'}
            disabled={busy}
            onPress={() => {
              void submit(async (repo, actor) => {
                await repo.saveFeed(actor, {
                  movement,
                  feedTypeId,
                  moveDate,
                  quantity: parseNumber(quantity) || 0,
                  costCents: movement === 'addition' ? centsFromDollars(cost) : null,
                  remark: movement === 'reduction' ? remark : '',
                  doneBy: actor.name,
                  notes,
                });
                setQuantity('');
                setCost('');
                setNotes('');
              });
            }}
          />
        </Card>
      ) : null}
      <StackList
        rows={snap.feedMoves.map((move) => {
          const feed = snap.feedTypes.find((row) => row.id === move.feedTypeId);
          return {
            key: move.id,
            title: `${move.movement === 'addition' ? 'In' : 'Out'} ${move.quantity} lb ${feed?.name || 'feed'}`,
            meta: prettyDate(move.moveDate),
            tone: move.movement === 'addition' ? 'good' : 'neutral',
            detail: `${move.remark || move.notes || 'No note'}${move.costCents ? ` · ${money(move.costCents)}` : ''}${move.expenseId ? ' · linked expense' : ''}`,
            action: canDelete ? (
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
            ) : undefined,
          };
        })}
      />
    </Page>
  );
}
