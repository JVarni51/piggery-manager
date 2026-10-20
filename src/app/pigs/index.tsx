import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { can } from '@/domain/herd';
import { STAGE_LABELS, STATUS_LABELS } from '@/domain/labels';
import { compareNatural, pounds } from '@/domain/format';
import { toCsv } from '@/domain/csv';
import { ageLabel, cleanParams, named, oneParam, pigLabel } from '@/lib/view';
import { downloadText } from '@/lib/download';
import { colors, sans } from '@/theme';
import { Gate } from '@/components/Gate';
import { useStickyAdd } from '@/components/Shell';
import { useSave } from '@/components/useSave';
import { Badge, Button, Card, Field, Filters, Notice, Page, Select, StackList, useNarrow } from '@/components/ui';

export default function PigsPage() {
  return (
    <Gate title="Pigs">
      {(snap) => <Pigs snap={snap} />}
    </Gate>
  );
}

function Pigs({ snap }: { snap: import('@/data/types').Snapshot }) {
  const router = useRouter();
  const { narrow } = useNarrow();
  const params = useLocalSearchParams<{ stage?: string; status?: string; q?: string; sex?: string; breed?: string; group?: string }>();
  const { error, busy, submit } = useSave();
  const q = oneParam(params.q);
  const gender = oneParam(params.sex);
  const breed = oneParam(params.breed);
  const group = oneParam(params.group);
  const status = oneParam(params.status) || 'active';
  const stage = oneParam(params.stage);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [moveTo, setMoveTo] = useState('');
  const writable = can(snap.actor.role, 'write');
  useStickyAdd(writable ? { label: 'Add pig', href: '/pigs/new' } : null);

  function setQuery(patch: Record<string, string | null>) {
    const next = cleanParams(params, patch);
    if ((next.status || 'active') === 'active') delete next.status;
    router.replace({ pathname: '/pigs', params: next });
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return snap.pigs
      .filter((pig) => {
        if (gender && pig.gender !== gender) return false;
        if (breed && pig.breedId !== breed) return false;
        if (group && pig.groupId !== group) return false;
        if (status !== 'any' && pig.status !== status) return false;
        if (stage && pig.stage !== stage) return false;
        if (!needle) return true;
        return [pig.tag, pig.name, pig.earNotch, pig.showTag].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => compareNatural(a.tag, b.tag) || a.id.localeCompare(b.id));
  }, [snap.pigs, q, gender, breed, group, status, stage]);

  const filtersOn = [gender, breed, group, status === 'active' ? '' : status, stage, q].filter(Boolean).length;

  return (
    <Page
      title="Pigs"
      lede={`${rows.length} showing of ${snap.pigs.length} on the farm.`}
      action={
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button
            tone="secondary"
            label="Download CSV"
            onPress={() => {
              void downloadText(
                'herdkeep-pigs.csv',
                toCsv(
                  ['Tag', 'Name', 'Sex', 'Stage', 'Status', 'Castrated', 'Breed', 'Group', 'Weight', 'Born'],
                  rows.map((pig) => [
                    pig.tag,
                    pig.name,
                    pig.gender,
                    STAGE_LABELS[pig.stage] || pig.stage,
                    STATUS_LABELS[pig.status] || pig.status,
                    pig.castrated ? 'yes' : 'no',
                    named(snap.breeds, pig.breedId),
                    named(snap.groups, pig.groupId),
                    pig.weightLb,
                    pig.dob,
                  ]),
                ),
              );
            }}
          />
          {writable && !narrow ? <Button label="Add pig" onPress={() => router.push('/pigs/new')} /> : null}
        </View>
      }
    >
      {error ? <Notice tone="bad" text={error} /> : null}
      <Field label="Search" value={q} onChange={(value) => setQuery({ q: value })} placeholder="Tag or name" />
      <Filters count={filtersOn}>
        <Select label="Sex" value={gender} onChange={(value) => setQuery({ sex: value })} options={[{ value: '', label: 'Any' }, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]} />
        <Select label="Breed" value={breed} onChange={(value) => setQuery({ breed: value })} options={[{ value: '', label: 'Any' }, ...snap.breeds.map((row) => ({ value: row.id, label: row.name }))]} />
        <Select label="Group" value={group} onChange={(value) => setQuery({ group: value })} options={[{ value: '', label: 'Any' }, ...snap.groups.map((row) => ({ value: row.id, label: row.name }))]} />
        <Select label="Stage" value={stage} onChange={(value) => setQuery({ stage: value })} options={[{ value: '', label: 'Any' }, ...Object.entries(STAGE_LABELS).filter(([value]) => value !== 'weaner').map(([value, label]) => ({ value, label }))]} />
        <Select label="Status" value={status} onChange={(value) => setQuery({ status: value === 'active' ? null : value })} options={[{ value: 'active', label: 'Active' }, { value: 'any', label: 'Any' }, ...Object.entries(STATUS_LABELS).filter(([value]) => value !== 'active').map(([value, label]) => ({ value, label }))]} />
      </Filters>
      {writable ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button tone="secondary" label={picking ? 'Done selecting' : 'Select pigs'} onPress={() => { setPicking((value) => !value); setPicked([]); }} />
          {picking && picked.length ? (
            <>
              <Select label="Move to" value={moveTo} onChange={setMoveTo} options={[{ value: '', label: 'No group' }, ...snap.groups.map((row) => ({ value: row.id, label: row.name }))]} />
              <Button
                label={busy ? 'Moving…' : `Move ${picked.length}`}
                disabled={busy}
                onPress={() => {
                  void submit(async (repo, actor) => {
                    await repo.moveGroup(actor, picked, moveTo || null);
                    setPicked([]);
                    setPicking(false);
                  });
                }}
              />
              <Button tone="ghost" label="Group event" onPress={() => router.push(`/events/group?pigs=${picked.join(',')}`)} />
            </>
          ) : null}
        </View>
      ) : null}
      {rows.length === 0 ? (
        <Card>
          <Text style={{ fontFamily: sans, fontSize: 18, color: colors.text }}>No pigs match these filters.</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>Clear a filter, or add a pig if the barn list is actually empty.</Text>
        </Card>
      ) : (
        <StackList
          rows={rows.map((pig) => ({
            key: pig.id,
            title: pigLabel(pig),
            meta: STATUS_LABELS[pig.status] || pig.status,
            tone: pig.status === 'active' ? 'good' : pig.status === 'sold' ? 'info' : pig.status === 'archived' ? 'neutral' : 'bad',
            detail: `${STAGE_LABELS[pig.stage]} · ${named(snap.breeds, pig.breedId)} · ${named(snap.groups, pig.groupId)} · ${pounds(pig.weightLb, 0)} · ${ageLabel(pig.dob)}`,
            onPress: () => {
              if (!picking) {
                router.push(`/pigs/${pig.id}`);
                return;
              }
              setPicked((current) => (current.includes(pig.id) ? current.filter((id) => id !== pig.id) : [...current, pig.id]));
            },
            action: picking ? (
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: picked.includes(pig.id) }} onPress={() => setPicked((current) => (current.includes(pig.id) ? current.filter((id) => id !== pig.id) : [...current, pig.id]))}>
                <Badge label={picked.includes(pig.id) ? 'Selected' : 'Select'} tone={picked.includes(pig.id) ? 'info' : 'neutral'} />
              </Pressable>
            ) : null,
          }))}
        />
      )}
    </Page>
  );
}
