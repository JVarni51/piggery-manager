import { createElement, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FEMALE_STAGES, MALE_STAGES, can, isSelfOrDescendant, normalizeStage, type Gender, type Stage } from '@/domain/herd';
import { STAGE_LABELS } from '@/domain/labels';
import { parseNumber } from '@/domain/format';
import { todayISO } from '@/domain/dates';
import type { Pig, PigInput, Snapshot } from '@/data/types';
import { ui } from '@/theme';
import { Button, DateField, Field, Fields, Notice, Select } from './ui';
import { useSave } from './useSave';
import { pigLabel } from '@/lib/view';

function blank(today: string): PigInput {
  return {
    tag: '',
    name: '',
    litterNumber: '',
    gender: 'female',
    stage: 'gilt',
    status: 'active',
    breedId: null,
    groupId: null,
    weightLb: null,
    dob: '',
    entryDate: today,
    source: 'born',
    sourceDetail: '',
    sireId: null,
    sireText: '',
    damId: null,
    damText: '',
    notes: '',
    photoUri: null,
    earNotch: '',
    showTag: '',
    registrationNo: '',
    litterId: null,
    castrated: false,
  };
}

export function pigToInput(pig: Pig): PigInput {
  return {
    tag: pig.tag,
    name: pig.name || '',
    litterNumber: pig.litterNumber || '',
    gender: pig.gender,
    stage: pig.stage,
    status: pig.status,
    breedId: pig.breedId,
    groupId: pig.groupId,
    weightLb: pig.weightLb,
    dob: pig.dob || '',
    entryDate: pig.entryDate || '',
    source: pig.source || 'born',
    sourceDetail: pig.sourceDetail || '',
    sireId: pig.sireId,
    sireText: pig.sireText || '',
    damId: pig.damId,
    damText: pig.damText || '',
    notes: pig.notes || '',
    photoUri: pig.photoUri,
    earNotch: pig.earNotch || '',
    showTag: pig.showTag || '',
    registrationNo: pig.registrationNo || '',
    litterId: pig.litterId,
    castrated: Boolean(pig.castrated) || pig.stage === 'barrow',
  };
}

export function PigForm({ snap, pig }: { snap: Snapshot; pig?: Pig }) {
  const router = useRouter();
  const { error, busy, submit } = useSave();
  const [form, setForm] = useState<PigInput>(() => (pig ? pigToInput(pig) : blank(todayISO())));
  const [weight, setWeight] = useState(pig?.weightLb != null ? String(pig.weightLb) : '');
  const closed = pig ? ['sold', 'dead', 'culled'].includes(pig.status) : false;
  const stages = form.gender === 'female' ? FEMALE_STAGES : MALE_STAGES;
  const family = snap.pigs.map((row) => ({ id: row.id, sireId: row.sireId, damId: row.damId }));
  const bornBefore = (row: { dob: string | null; id: string }) => {
    if (!form.dob || !row.dob) return true;
    return row.dob < form.dob;
  };
  const keep = (id: string | null) => Boolean(id) && (id === form.sireId || id === form.damId);
  const sires = snap.pigs.filter(
    (row) =>
      row.gender === 'male' &&
      row.id !== pig?.id &&
      !row.castrated &&
      row.stage !== 'barrow' &&
      row.status === 'active' &&
      bornBefore(row) &&
      !(pig && isSelfOrDescendant(pig.id, row.id, family)),
  );
  const dams = snap.pigs.filter(
    (row) =>
      row.gender === 'female' &&
      row.id !== pig?.id &&
      (row.status === 'active' || keep(row.id)) &&
      bornBefore(row) &&
      !(pig && isSelfOrDescendant(pig.id, row.id, family)),
  );
  const set = (patch: Partial<PigInput>) => setForm((current) => ({ ...current, ...patch }));

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      window.alert('Photo has to be 3 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set({ photoUri: String(reader.result || '') });
    reader.readAsDataURL(file);
  }

  return (
    <View style={{ gap: 12 }}>
      {error ? <Notice tone="bad" text={error} /> : null}
      <Text style={ui.small}>Tag numbers are edited in this same herd book. Each tag has to be unique on the farm.</Text>
      <Fields>
        <Field label="Tag" value={form.tag} onChange={(tag) => set({ tag })} placeholder="Tag number" />
        <Field label="Name" value={form.name} onChange={(name) => set({ name })} placeholder="Name" />
        <Select
          label="Sex"
          value={form.gender}
          onChange={(gender) => {
            const next = gender as Gender;
            const allowed = next === 'female' ? FEMALE_STAGES : MALE_STAGES;
            const stage = normalizeStage(form.stage);
            set({ gender: next, stage: allowed.includes(stage) ? stage : allowed[0], castrated: next === 'male' ? form.castrated : false });
          }}
          options={[
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
          ]}
        />
        <Select
          label="Stage"
          value={form.stage}
          onChange={(stage) => {
            const next = stage as Stage;
            set({ stage: next, castrated: next === 'barrow' ? true : next === 'boar' ? false : form.castrated });
          }}
          options={stages.map((stage) => ({ value: stage, label: STAGE_LABELS[stage] || stage }))}
        />
        <Select
          label="Breed"
          value={form.breedId || ''}
          onChange={(breedId) => set({ breedId: breedId || null })}
          options={[{ value: '', label: 'Unrecorded' }, ...snap.breeds.map((row) => ({ value: row.id, label: row.name }))]}
        />
        <Select
          label="Group"
          value={form.groupId || ''}
          onChange={(groupId) => set({ groupId: groupId || null })}
          options={[{ value: '', label: 'No group' }, ...snap.groups.map((row) => ({ value: row.id, label: row.name }))]}
        />
        <Field label="Weight (lb)" value={weight} onChange={setWeight} placeholder="Pounds" />
        {form.gender === 'male' ? (
          <Select
            label="Castrated"
            value={form.castrated ? 'yes' : 'no'}
            onChange={(value) => set({ castrated: value === 'yes' })}
            options={[
              { value: 'no', label: 'Intact' },
              { value: 'yes', label: 'Castrated (barrow)' },
            ]}
          />
        ) : null}
        <DateField label="Date of birth" value={form.dob || ''} onChange={(dob) => set({ dob })} />
        <DateField label="Farm entry" value={form.entryDate || ''} onChange={(entryDate) => set({ entryDate })} />
        <Field label="Litter number" value={form.litterNumber} onChange={(litterNumber) => set({ litterNumber })} />
        <Select
          label="Source"
          value={form.source}
          onChange={(source) => set({ source })}
          options={[
            { value: 'born', label: 'Born here' },
            { value: 'purchased', label: 'Purchased' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <Field label="Source detail" value={form.sourceDetail} onChange={(sourceDetail) => set({ sourceDetail })} />
      </Fields>
      <Fields>
        <Select
          label="Sire"
          value={form.sireId || ''}
          onChange={(sireId) => set({ sireId: sireId || null })}
          options={[{ value: '', label: 'Not in the herd' }, ...sires.map((row) => ({ value: row.id, label: pigLabel(row) }))]}
        />
        <Field label="Sire, if outside the herd" value={form.sireText} onChange={(sireText) => set({ sireText })} />
        <Select
          label="Dam"
          value={form.damId || ''}
          onChange={(damId) => set({ damId: damId || null })}
          options={[{ value: '', label: 'Not in the herd' }, ...dams.map((row) => ({ value: row.id, label: pigLabel(row) }))]}
        />
        <Field label="Dam, if outside the herd" value={form.damText} onChange={(damText) => set({ damText })} />
      </Fields>
      <Text style={ui.small}>Sire and dam lists offer active pigs of the right sex who were born first. Castrated males are not sires. This pig and its descendants stay off the list.</Text>
      <Fields>
        <Field label="Ear notch" value={form.earNotch} onChange={(earNotch) => set({ earNotch })} />
        <Field label="Show tag" value={form.showTag} onChange={(showTag) => set({ showTag })} />
        <Field label="Registration" value={form.registrationNo} onChange={(registrationNo) => set({ registrationNo })} />
      </Fields>
      {closed ? (
        <Notice
          tone="warn"
          text="Sold, dead, and culled pigs stay that way until someone with delete permission reopens the record. Change the outcome from the event, not from a status dropdown."
        />
      ) : null}
      {pig && can(snap.actor.role, 'delete') && closed ? (
        <Select
          label="Status"
          value={form.status}
          onChange={(status) => set({ status })}
          options={[
            { value: pig.status, label: pig.status },
            { value: 'active', label: 'Reopen as active' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
      ) : null}
      {!closed ? (
        <Select
          label="Status"
          value={form.status === 'sold' || form.status === 'dead' || form.status === 'culled' ? 'active' : form.status}
          onChange={(status) => set({ status })}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
      ) : null}
      <Field label="Notes" value={form.notes} onChange={(notes) => set({ notes })} multiline />
      <View style={{ gap: 8 }}>
        <Text style={ui.label}>Photo, 3 MB max</Text>
        {form.photoUri ? (
          <Image source={{ uri: form.photoUri }} style={{ width: 96, height: 96, borderRadius: 16 }} accessibilityLabel="Pig photo" />
        ) : (
          <Text style={ui.small}>No photo yet. The list uses a monogram until one is added.</Text>
        )}
        {Platform.OS === 'web'
          ? createElement('input', {
              type: 'file',
              accept: 'image/*',
              'aria-label': 'Pig photo',
              onChange: (event: { target: { files?: FileList } }) => onPhoto(event.target.files?.[0]),
            })
          : null}
        {form.photoUri ? (
          <Button label="Remove photo" tone="ghost" onPress={() => set({ photoUri: null })} />
        ) : null}
      </View>
      <Button
        label={busy ? 'Saving…' : pig ? 'Save pig' : 'Add pig'}
        disabled={busy || !can(snap.actor.role, 'write')}
        onPress={() => {
          const weightLb = parseNumber(weight);
          void submit(async (repo, actor) => {
            const id = await repo.savePig(actor, { ...form, weightLb }, pig?.id);
            router.replace(`/pigs/${id}`);
          });
        }}
      />
    </View>
  );
}
