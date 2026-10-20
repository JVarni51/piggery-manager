import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { can } from '@/domain/herd';
import { centsFromDollars, dollarsInput, parseNumber } from '@/domain/format';
import { prettyDate, todayISO } from '@/domain/dates';
import { EVENT_LABELS } from '@/domain/labels';
import { named, oneParam, pigLabel } from '@/lib/view';
import type { Snapshot } from '@/data/types';
import { ui } from '@/theme';
import { Gate } from '@/components/Gate';
import { useSave } from '@/components/useSave';
import { Button, Card, ChoiceList, DateField, Field, Fields, Notice, Page, Select, confirmAsync } from '@/components/ui';

const MASS_TYPES = ['vaccination', 'treatment', 'deworming', 'hoof_trim', 'tagging', 'herd_spray', 'other'];

export default function GroupEventPage() {
  const params = useLocalSearchParams<{ id?: string; pigs?: string }>();
  return (
    <Gate title="Group event">
      {(snap) => <GroupForm snap={snap} id={oneParam(params.id)} pigs={oneParam(params.pigs)} />}
    </Gate>
  );
}

function GroupForm({ snap, id, pigs }: { snap: Snapshot; id: string; pigs: string }) {
  const existing = snap.massEvents.find((row) => row.id === id);
  const router = useRouter();
  const { error, busy, submit } = useSave();
  const preset = pigs ? pigs.split(',').filter(Boolean) : [];
  const linked = existing ? snap.massPigs.filter((link) => link.massEventId === existing.id).map((link) => link.pigId) : preset;
  const [eventDate, setEventDate] = useState(existing?.eventDate || todayISO());
  const [eventType, setEventType] = useState(existing?.eventType || 'vaccination');
  const [groupId, setGroupId] = useState(existing?.groupId || '');
  const [pigIds, setPigIds] = useState<string[]>(linked);
  const [medicine, setMedicine] = useState(existing?.medicineName || '');
  const [customName, setCustomName] = useState(existing?.customName || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [hold, setHold] = useState(existing?.withdrawalDays != null ? String(existing.withdrawalDays) : '');
  const [cost, setCost] = useState(dollarsInput(existing?.costCents));
  const active = snap.pigs.filter((pig) => pig.status === 'active' || pigIds.includes(pig.id));
  const coverage = useMemo(
    () => pigIds.map((pigId) => pigLabel(snap.pigs.find((pig) => pig.id === pigId))).join(', '),
    [pigIds, snap.pigs],
  );

  function applyGroup(next: string) {
    setGroupId(next);
    if (!next) return;
    const ids = snap.pigs.filter((pig) => pig.status === 'active' && pig.groupId === next).map((pig) => pig.id);
    setPigIds(ids);
  }

  return (
    <Page
      title={existing ? 'Edit group event' : 'Group event'}
      lede="The group and the individual pigs are both stored, so the coverage stays put if someone moves pens later."
    >
      {error ? <Notice tone="bad" text={error} /> : null}
      <Card>
        <Fields>
          <DateField label="Date" value={eventDate} onChange={setEventDate} />
          <Select
            label="Event"
            value={eventType}
            onChange={setEventType}
            options={MASS_TYPES.map((value) => ({ value, label: EVENT_LABELS[value] || value }))}
          />
          <Select
            label="Group"
            value={groupId}
            onChange={applyGroup}
            options={[{ value: '', label: 'No group — pick pigs' }, ...snap.groups.map((row) => ({ value: row.id, label: row.name }))]}
          />
        </Fields>
        <Field label="Product" value={medicine} onChange={setMedicine} placeholder="Vaccine or drug name" />
        <Field label="Name, if it is not a treatment" value={customName} onChange={setCustomName} />
        <Fields>
          <Field label="Withdrawal days" value={hold} onChange={setHold} />
          <Field label="Cost (USD, optional)" value={cost} onChange={setCost} />
        </Fields>
        <Text style={ui.small}>A cost becomes one veterinary expense for the group, not a charge on every pig.</Text>
        <Field label="Notes" value={notes} onChange={setNotes} multiline />
        <Text style={ui.label}>Pigs covered ({pigIds.length})</Text>
        <ChoiceList
          value={pigIds}
          onChange={setPigIds}
          options={active.map((pig) => ({ value: pig.id, label: `${pigLabel(pig)} · ${named(snap.groups, pig.groupId)}` }))}
        />
        <Text style={ui.small}>{coverage || 'Nobody is selected yet.'}</Text>
        <Button
          label={busy ? 'Saving…' : existing ? 'Save group event' : 'Record group event'}
          disabled={busy || !can(snap.actor.role, 'write')}
          onPress={() => {
            void submit(async (repo, actor) => {
              const saved = await repo.saveMass(
                actor,
                {
                  eventDate,
                  eventType,
                  groupId: groupId || null,
                  pigIds,
                  medicineName: medicine,
                  customName,
                  notes,
                  withdrawalDays: parseNumber(hold),
                  costCents: centsFromDollars(cost),
                },
                existing?.id,
              );
              router.replace(`/events/group?id=${saved}`);
            });
          }}
        />
      </Card>
      {existing && can(snap.actor.role, 'delete') ? (
        <Button
          tone="danger"
          label="Delete group event"
          onPress={() => {
            void (async () => {
              const ok = await confirmAsync(`Delete the ${prettyDate(existing.eventDate)} group event and the pig rows it created?`);
              if (!ok) return;
              const done = await submit((repo, actor) => repo.deleteMass(actor, existing.id));
              if (done) router.replace('/events');
            })();
          }}
        />
      ) : null}
      {existing ? (
        <View>
          <Text style={ui.small}>Saved coverage is also written onto each pig’s event list.</Text>
        </View>
      ) : null}
    </Page>
  );
}
