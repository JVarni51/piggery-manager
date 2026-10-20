import { useState } from 'react';
import { Text, View } from 'react-native';
import { activeWithdrawals, can, showEntryBlock, showPace } from '@/domain/herd';
import { paceLabel } from '@/domain/herd';
import { adgLabel, parseNumber, pounds } from '@/domain/format';
import { prettyDate, todayISO } from '@/domain/dates';
import { pigLabel, weightPoints } from '@/lib/view';
import { ui } from '@/theme';
import { Gate } from '@/components/Gate';
import { useSave } from '@/components/useSave';
import { Badge, Button, Card, DateField, Field, Fields, Notice, Page, Select, confirmAsync } from '@/components/ui';

export default function ShowsPage() {
  return (
    <Gate title="Shows">
      {(snap) => <Shows snap={snap} />}
    </Gate>
  );
}

function Shows({ snap }: { snap: import('@/data/types').Snapshot }) {
  const today = todayISO();
  const { error, busy, submit } = useSave();
  const [name, setName] = useState('');
  const [showDate, setShowDate] = useState(today);
  const [location, setLocation] = useState('');
  const [target, setTarget] = useState('280');
  const [notes, setNotes] = useState('');
  const [showId, setShowId] = useState(snap.shows.find((show) => show.showDate >= today)?.id || snap.shows[0]?.id || '');
  const [pigId, setPigId] = useState('');
  const [className, setClassName] = useState('');
  const writable = can(snap.actor.role, 'write');
  const canDelete = can(snap.actor.role, 'delete');
  const selected = snap.shows.find((show) => show.id === showId);
  const hold = pigId && selected ? showEntryBlock(activeWithdrawals(snap.events, pigId, today), selected.showDate) : { block: null, warn: null };

  return (
    <Page title="Shows" lede="Pace uses the last two weights against the days left and the target. A withdrawal that ends on or after show day blocks the entry.">
      {error ? <Notice tone="bad" text={error} /> : null}
      {snap.shows.map((show) => {
        const entries = snap.entries.filter((entry) => entry.showId === show.id);
        return (
          <Card key={show.id}>
            <Text style={ui.h2}>{show.name}</Text>
            <Text style={ui.small}>{prettyDate(show.showDate)}{show.location ? ` · ${show.location}` : ''} · target {pounds(show.targetWeightLb, 0)}</Text>
            {entries.length === 0 ? <Text style={ui.body}>No pigs entered.</Text> : null}
            {entries.map((entry) => {
              const pig = snap.pigs.find((row) => row.id === entry.pigId);
              const goal = entry.targetWeightLb || show.targetWeightLb || 0;
              const pace = showPace({
                currentLb: pig?.weightLb ?? null,
                targetLb: goal,
                showDate: show.showDate,
                today,
                weights: pig ? weightPoints(snap.events, pig.id) : [],
              });
              const tone = pace.verdict === 'behind' ? 'bad' : pace.verdict === 'ahead' || pace.verdict === 'at_weight' ? 'good' : 'warn';
              return (
                <View key={entry.id} style={{ gap: 4, paddingVertical: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={{ fontWeight: '700', fontSize: 16 }}>{pig ? pigLabel(pig) : 'Removed pig'}</Text>
                    <Badge label={paceLabel(pace.verdict)} tone={tone} />
                  </View>
                  <Text style={ui.small}>
                    {pounds(pig?.weightLb, 0)} / {pounds(goal, 0)} · gain {adgLabel(pace.actualAdg)}
                    {entry.placing ? ` · ${entry.placing}` : ''}
                    {entry.className ? ` · ${entry.className}` : ''}
                  </Text>
                  {canDelete ? (
                    <Button tone="ghost" label="Remove entry" onPress={() => void submit((repo, actor) => repo.deleteEntry(actor, entry.id))} />
                  ) : null}
                </View>
              );
            })}
            {canDelete ? (
              <Button
                tone="danger"
                label="Delete show"
                onPress={() => {
                  void (async () => {
                    const ok = await confirmAsync(`Delete ${show.name} and its entries?`);
                    if (!ok) return;
                    await submit((repo, actor) => repo.deleteShow(actor, show.id));
                  })();
                }}
              />
            ) : null}
          </Card>
        );
      })}
      {writable ? (
        <Card>
          <Text style={ui.h2}>Enter a pig</Text>
          {hold.block ? <Notice tone="bad" text={hold.block} /> : null}
          {hold.warn ? <Notice tone="warn" text={hold.warn} /> : null}
          <Fields>
            <Select label="Show" value={showId} onChange={setShowId} options={snap.shows.map((show) => ({ value: show.id, label: show.name }))} />
            <Select label="Pig" value={pigId} onChange={setPigId} options={snap.pigs.filter((pig) => pig.status === 'active').map((pig) => ({ value: pig.id, label: pigLabel(pig) }))} />
            <Field label="Class" value={className} onChange={setClassName} placeholder="Cross barrow" />
          </Fields>
          <Button
            label={busy ? 'Saving…' : 'Add entry'}
            disabled={busy || !showId || !pigId}
            onPress={() => {
              void submit(async (repo, actor) => {
                await repo.saveEntry(actor, { showId, pigId, exhibitor: 'CG Ranch', className, targetWeightLb: null });
                setPigId('');
                setClassName('');
              });
            }}
          />
        </Card>
      ) : null}
      {writable ? (
        <Card>
          <Text style={ui.h2}>New show</Text>
          <Fields>
            <Field label="Name" value={name} onChange={setName} placeholder="County jackpot" />
            <DateField label="Date" value={showDate} onChange={setShowDate} />
            <Field label="Location" value={location} onChange={setLocation} />
            <Field label="Target weight (lb)" value={target} onChange={setTarget} />
          </Fields>
          <Field label="Notes" value={notes} onChange={setNotes} />
          <Button
            label="Save show"
            disabled={busy}
            onPress={() => {
              void submit(async (repo, actor) => {
                const id = await repo.saveShow(actor, {
                  name,
                  showDate,
                  location,
                  targetWeightLb: parseNumber(target),
                  notes,
                });
                setShowId(id);
                setName('');
                setNotes('');
              });
            }}
          />
        </Card>
      ) : null}
    </Page>
  );
}
