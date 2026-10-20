import { useState } from 'react';
import { Text, View } from 'react-native';
import { activeWithdrawals, can, showEntryBlock, showPace } from '@/domain/herd';
import { paceLabel } from '@/domain/herd';
import { adgLabel, centsFromDollars, dollarsInput, parseNumber, pounds } from '@/domain/format';
import { prettyDate, todayISO } from '@/domain/dates';
import { toCsv } from '@/domain/csv';
import { downloadText } from '@/lib/download';
import { named, pigLabel, weightPoints } from '@/lib/view';
import type { Show, ShowEntry, Snapshot } from '@/data/types';
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

function orderedShows(shows: Show[], today: string): Show[] {
  const upcoming = shows.filter((show) => show.showDate >= today).sort((a, b) => a.showDate.localeCompare(b.showDate));
  const past = shows.filter((show) => show.showDate < today).sort((a, b) => b.showDate.localeCompare(a.showDate));
  return [...upcoming, ...past];
}

function Shows({ snap }: { snap: Snapshot }) {
  const today = todayISO();
  const { error, busy, submit } = useSave();
  const [name, setName] = useState('');
  const [showDate, setShowDate] = useState(today);
  const [location, setLocation] = useState('');
  const [target, setTarget] = useState('280');
  const [notes, setNotes] = useState('');
  const shows = orderedShows(snap.shows, today);
  const [showId, setShowId] = useState(shows.find((show) => show.showDate >= today)?.id || shows[0]?.id || '');
  const [pigId, setPigId] = useState('');
  const [className, setClassName] = useState('');
  const [division, setDivision] = useState('');
  const [weightClass, setWeightClass] = useState('');
  const [exhibitor, setExhibitor] = useState('CG Ranch');
  const [entryTarget, setEntryTarget] = useState('');
  const writable = can(snap.actor.role, 'write');
  const canDelete = can(snap.actor.role, 'delete');
  const selected = shows.find((show) => show.id === showId);
  const hold = pigId && selected ? showEntryBlock(activeWithdrawals(snap.events, pigId, selected.showDate), selected.showDate) : { block: null, warn: null };

  return (
    <Page
      title="Shows"
      lede="Pace uses the last two weights against the days left and the target. A withdrawal that runs through show day blocks the entry, the weigh-in, and a show sale. Clear the day after the withdrawal ends."
      action={
        <Button
          tone="secondary"
          label="Download CSV"
          onPress={() => {
            void downloadText(
              'herdkeep-shows.csv',
              toCsv(
                ['Show', 'Date', 'Location', 'Show target', 'Pig', 'Class', 'Division', 'Weight class', 'Entry target', 'Weigh-in', 'Buyer', 'Sale', 'Add-ons'],
                snap.entries.map((entry) => {
                  const show = snap.shows.find((row) => row.id === entry.showId);
                  return [
                    show?.name,
                    show?.showDate,
                    show?.location,
                    show?.targetWeightLb,
                    pigLabel(snap.pigs.find((pig) => pig.id === entry.pigId)),
                    entry.className,
                    entry.division,
                    entry.weightClass,
                    entry.targetWeightLb,
                    entry.weighInLb,
                    named(snap.contacts, entry.buyerContactId),
                    entry.saleCents != null ? (entry.saleCents / 100).toFixed(2) : '',
                    entry.addonCents != null ? (entry.addonCents / 100).toFixed(2) : '',
                  ];
                }),
              ),
            );
          }}
        />
      }
    >
      {error ? <Notice tone="bad" text={error} /> : null}
      {shows.map((show) => {
        const entries = snap.entries.filter((entry) => entry.showId === show.id);
        return (
          <Card key={show.id}>
            <Text style={ui.h2}>{show.name}</Text>
            <Text style={ui.small}>{prettyDate(show.showDate)}{show.location ? ` · ${show.location}` : ''} · show target {pounds(show.targetWeightLb, 0)}</Text>
            {entries.length === 0 ? <Text style={ui.body}>No pigs entered.</Text> : null}
            {entries.map((entry) => (
              <EntryRow key={entry.id} snap={snap} show={show} entry={entry} today={today} writable={writable} canDelete={canDelete} busy={busy} submit={submit} />
            ))}
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
            <Select label="Show" value={showId} onChange={setShowId} options={shows.map((show) => ({ value: show.id, label: `${show.name} · ${prettyDate(show.showDate)}` }))} />
            <Select label="Pig" value={pigId} onChange={setPigId} options={snap.pigs.filter((pig) => pig.status === 'active').map((pig) => ({ value: pig.id, label: pigLabel(pig) }))} />
            <Field label="Class" value={className} onChange={setClassName} placeholder="Barrow" />
            <Field label="Division" value={division} onChange={setDivision} placeholder="Cross" />
            <Field label="Weight class" value={weightClass} onChange={setWeightClass} placeholder="280" />
            <Field label="Exhibitor" value={exhibitor} onChange={setExhibitor} />
            <Field label="Entry target (lb)" value={entryTarget} onChange={setEntryTarget} placeholder="Uses the show target if blank" />
          </Fields>
          <Button
            label={busy ? 'Saving…' : 'Add entry'}
            disabled={busy || !showId || !pigId || Boolean(hold.block)}
            onPress={() => {
              void submit(async (repo, actor) => {
                await repo.saveEntry(actor, {
                  showId,
                  pigId,
                  exhibitor,
                  className,
                  division,
                  weightClass,
                  targetWeightLb: parseNumber(entryTarget),
                });
                setPigId('');
                setClassName('');
                setDivision('');
                setWeightClass('');
                setEntryTarget('');
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

function EntryRow({
  snap,
  show,
  entry,
  today,
  writable,
  canDelete,
  busy,
  submit,
}: {
  snap: Snapshot;
  show: Show;
  entry: ShowEntry;
  today: string;
  writable: boolean;
  canDelete: boolean;
  busy: boolean;
  submit: ReturnType<typeof useSave>['submit'];
}) {
  const pig = snap.pigs.find((row) => row.id === entry.pigId);
  const goal = entry.targetWeightLb || show.targetWeightLb || 0;
  const pace = showPace({
    currentLb: pig?.weightLb ?? null,
    targetLb: goal,
    showDate: show.showDate,
    today,
    weights: pig ? weightPoints(snap.events, pig.id) : [],
  });
  const conflict = pig ? showEntryBlock(activeWithdrawals(snap.events, pig.id, show.showDate), show.showDate) : { block: null, warn: null };
  const tone = pace.verdict === 'behind' ? 'bad' : pace.verdict === 'ahead' || pace.verdict === 'at_weight' ? 'good' : 'warn';
  const [weighIn, setWeighIn] = useState(entry.weighInLb != null ? String(entry.weighInLb) : '');
  const [buyerId, setBuyerId] = useState(entry.buyerContactId || '');
  const [sale, setSale] = useState(dollarsInput(entry.saleCents));
  const [addon, setAddon] = useState(dollarsInput(entry.addonCents));
  const buyers = snap.contacts.filter((contact) => contact.kind === 'buyer' || contact.id === entry.buyerContactId);
  return (
    <View style={{ gap: 4, paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>{pig ? pigLabel(pig) : 'Removed pig'}</Text>
        <Badge label={paceLabel(pace.verdict)} tone={tone} />
        {conflict.block ? <Badge label="Withdrawal conflict" tone="bad" /> : null}
      </View>
      <Text style={ui.small}>
        {pounds(pig?.weightLb, 0)} / {pounds(goal, 0)} · gain {adgLabel(pace.actualAdg)}
        {entry.className ? ` · ${entry.className}` : ''}
        {entry.division ? ` · ${entry.division}` : ''}
        {entry.weightClass ? ` · class ${entry.weightClass}` : ''}
        {entry.placing ? ` · ${entry.placing}` : ''}
      </Text>
      {conflict.block ? <Notice tone="bad" text={conflict.block} /> : null}
      {conflict.warn ? <Notice tone="warn" text={conflict.warn} /> : null}
      {writable ? (
        <Fields>
          <Field label="Weigh-in (lb)" value={weighIn} onChange={setWeighIn} />
          <Select label="Buyer" value={buyerId} onChange={setBuyerId} options={[{ value: '', label: 'No buyer yet' }, ...buyers.map((contact) => ({ value: contact.id, label: contact.name }))]} />
          <Field label="Sale (USD)" value={sale} onChange={setSale} />
          <Field label="Add-ons (USD)" value={addon} onChange={setAddon} />
        </Fields>
      ) : null}
      {writable ? (
        <Button
          tone="secondary"
          label={busy ? 'Saving…' : 'Save entry'}
          disabled={busy || Boolean(conflict.block && (weighIn.trim() || sale.trim()))}
          onPress={() => {
            void submit((repo, actor) =>
              repo.saveEntry(
                actor,
                {
                  showId: show.id,
                  pigId: entry.pigId,
                  exhibitor: entry.exhibitor || 'CG Ranch',
                  className: entry.className || '',
                  targetWeightLb: entry.targetWeightLb,
                  division: entry.division || '',
                  weightClass: entry.weightClass || '',
                  exhibitorContactId: entry.exhibitorContactId,
                  buyerContactId: buyerId || null,
                  saleCents: centsFromDollars(sale),
                  addonCents: centsFromDollars(addon),
                  weighInLb: parseNumber(weighIn),
                  saleEventId: entry.saleEventId,
                },
                entry.id,
              ),
            );
          }}
        />
      ) : null}
      {!writable && (entry.saleCents || entry.weighInLb) ? (
        <Text style={ui.small}>
          {entry.weighInLb != null ? `Weigh-in ${pounds(entry.weighInLb, 0)}. ` : ''}
          {entry.saleCents != null ? `Sale ${dollarsInput(entry.saleCents)}. ` : ''}
        </Text>
      ) : null}
      {canDelete ? (
        <Button tone="ghost" label="Remove entry" onPress={() => void submit((repo, actor) => repo.deleteEntry(actor, entry.id))} />
      ) : null}
    </View>
  );
}
