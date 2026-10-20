import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { can, expectedFarrowDate, farrowingWarnings, heatCheckDate, parityForFarrow, planBreedingHeat, saleBlockReason, activeWithdrawals } from '@/domain/herd';
import { centsFromDollars, dollarsInput, parseNumber } from '@/domain/format';
import { prettyDate, todayISO } from '@/domain/dates';
import { EVENT_LABELS } from '@/domain/labels';
import type { EventInput, HerdEvent, Litter, Snapshot } from '@/data/types';
import { pigLabel } from '@/lib/view';
import { ui } from '@/theme';
import { Button, DateField, Field, Fields, Notice, Select } from './ui';
import { useSave } from './useSave';

export const EVENT_TYPES = [
  'breeding',
  'pregnancy_check',
  'farrowing',
  'weaning',
  'castration',
  'vaccination',
  'treatment',
  'deworming',
  'weight',
  'sale',
  'death',
  'cull',
  'aborted',
  'dry_off',
  'hoof_trim',
  'tagging',
  'herd_spray',
  'foster',
  'other',
] as const;

export function blankEvent(pigId = '', eventType = 'weight', eventDate = todayISO()): EventInput {
  return {
    pigId,
    eventType,
    eventDate,
    notes: '',
    weightLb: null,
    weightContext: 'routine',
    sireId: null,
    sireName: '',
    matingMethod: 'natural',
    technician: '',
    breedingEventId: null,
    pregResult: 'pregnant',
    pregMethod: 'visual',
    bornAlive: null,
    stillborn: 0,
    mummies: 0,
    birthWeightLb: null,
    litterNumber: '',
    parity: null,
    weanedCount: null,
    weanWeightLb: null,
    litterId: null,
    drugName: '',
    dose: '',
    route: '',
    withdrawalDays: null,
    diagnosis: '',
    symptoms: '',
    treatedBy: '',
    vetName: '',
    vfdNumber: '',
    lotNo: '',
    productExpiry: null,
    eldu: false,
    elduVet: '',
    vfdExpiry: null,
    vfdDocUri: '',
    vaccineName: '',
    nextDueDate: null,
    buyerId: null,
    buyerName: '',
    saleAmountCents: null,
    cause: '',
    customName: '',
    markBarrow: true,
  };
}

export function eventToInput(event: HerdEvent, litter?: Litter | null): EventInput {
  return {
    ...blankEvent(event.pigId || '', event.eventType, event.eventDate),
    notes: event.notes || '',
    weightLb: event.weightLb,
    weightContext: event.weightContext,
    sireId: event.sireId,
    sireName: event.sireName || '',
    matingMethod: event.matingMethod,
    technician: event.technician || '',
    breedingEventId: event.breedingEventId,
    pregResult: event.pregResult,
    pregMethod: event.pregMethod,
    bornAlive: event.bornAlive,
    stillborn: event.stillborn,
    mummies: event.mummies,
    birthWeightLb: event.birthWeightLb,
    litterNumber: litter?.litterNumber || '',
    parity: litter?.parity ?? null,
    weanedCount: event.weanedCount,
    weanWeightLb: event.weanWeightLb,
    litterId: event.litterId,
    drugName: event.drugName || '',
    dose: event.dose || '',
    route: event.route || '',
    withdrawalDays: event.withdrawalDays,
    diagnosis: event.diagnosis || '',
    symptoms: event.symptoms || '',
    treatedBy: event.treatedBy || '',
    vetName: event.vetName || '',
    vfdNumber: event.vfdNumber || '',
    lotNo: event.lotNo || '',
    productExpiry: event.productExpiry,
    eldu: Boolean(event.eldu),
    elduVet: event.elduVet || '',
    vfdExpiry: event.vfdExpiry,
    vfdDocUri: event.vfdDocUri || '',
    vaccineName: event.vaccineName || '',
    nextDueDate: event.nextDueDate,
    buyerId: event.buyerId,
    buyerName: event.buyerName || '',
    saleAmountCents: event.saleAmountCents,
    cause: event.cause || '',
    customName: event.customName || '',
    markBarrow: false,
  };
}

export function EventForm({
  snap,
  initial,
  eventId,
  lockedPig,
}: {
  snap: Snapshot;
  initial: EventInput;
  eventId?: string;
  lockedPig?: boolean;
}) {
  const router = useRouter();
  const { error, busy, submit } = useSave();
  const [form, setForm] = useState(initial);
  const [weight, setWeight] = useState(initial.weightLb != null ? String(initial.weightLb) : '');
  const [born, setBorn] = useState(initial.bornAlive != null ? String(initial.bornAlive) : '');
  const [still, setStill] = useState(initial.stillborn != null ? String(initial.stillborn) : '0');
  const [mummies, setMummies] = useState(initial.mummies != null ? String(initial.mummies) : '0');
  const [birthWeight, setBirthWeight] = useState(initial.birthWeightLb != null ? String(initial.birthWeightLb) : '');
  const [weaned, setWeaned] = useState(initial.weanedCount != null ? String(initial.weanedCount) : '');
  const [weanWeight, setWeanWeight] = useState(initial.weanWeightLb != null ? String(initial.weanWeightLb) : '');
  const [holdDays, setHoldDays] = useState(initial.withdrawalDays != null ? String(initial.withdrawalDays) : '');
  const [price, setPrice] = useState(dollarsInput(initial.saleAmountCents));
  const set = (patch: Partial<EventInput>) => setForm((current) => ({ ...current, ...patch }));
  const type = form.eventType;
  const pig = snap.pigs.find((row) => row.id === form.pigId);
  const breedings = snap.events.filter((event) => event.pigId === form.pigId && event.eventType === 'breeding');
  const litters = snap.litters.filter((litter) => !form.pigId || litter.sowId === form.pigId || litter.id === form.litterId);
  const boars = snap.pigs.filter((row) => row.gender === 'male' && row.id !== form.pigId);
  const block = useMemo(() => {
    if (type !== 'sale' || !form.pigId) return null;
    return saleBlockReason(
      activeWithdrawals(snap.events.filter((event) => event.id !== eventId), form.pigId, form.eventDate || todayISO()),
    );
  }, [type, form.pigId, form.eventDate, snap.events, eventId]);
  const heatPlan = useMemo(() => {
    if (type !== 'breeding' || !form.pigId || !form.eventDate || eventId) return null;
    return planBreedingHeat({
      pigId: form.pigId,
      serviceDate: form.eventDate,
      newId: 'new-service',
      gestationDays: snap.farm.gestationDays,
      services: snap.events
        .filter((event) => event.eventType === 'breeding' && event.pigId === form.pigId)
        .map((event) => ({ id: event.id, pigId: event.pigId, eventDate: event.eventDate, heatId: event.heatId })),
      outcomes: snap.events
        .filter((event) => event.pigId === form.pigId)
        .map((event) => ({
          id: event.id,
          pigId: event.pigId,
          eventType: event.eventType,
          eventDate: event.eventDate,
          breedingEventId: event.breedingEventId,
          pregResult: event.pregResult,
        })),
    });
  }, [type, form.pigId, form.eventDate, eventId, snap.events, snap.farm.gestationDays]);

  const due = type === 'breeding' && form.eventDate ? expectedFarrowDate(form.eventDate, snap.farm.gestationDays) : null;
  const heat = type === 'breeding' && form.eventDate ? heatCheckDate(form.eventDate, snap.farm.heatCycleDays) : null;
  const futureDate = Boolean(form.eventDate && form.eventDate > todayISO());
  const countedParity =
    type === 'farrowing' && form.pigId && form.eventDate
      ? parityForFarrow(
          snap.litters.filter((litter) => litter.sowId === form.pigId && litter.id !== form.litterId).map((litter) => litter.farrowDate),
          form.eventDate,
        )
      : null;
  const farrowNotes =
    type === 'farrowing' && form.pigId && form.eventDate
      ? farrowingWarnings({
          eventDate: form.eventDate,
          otherFarrowDates: snap.litters.filter((litter) => litter.sowId === form.pigId && litter.id !== form.litterId).map((litter) => litter.farrowDate),
          serviceDate:
            snap.events.find((event) => event.id === form.breedingEventId)?.eventDate ||
            snap.events
              .filter((event) => event.pigId === form.pigId && event.eventType === 'breeding' && event.eventDate <= form.eventDate)
              .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
              .at(-1)?.eventDate,
        })
      : [];

  return (
    <View style={{ gap: 12 }}>
      {error ? <Notice tone="bad" text={error} /> : null}
      <Text style={ui.small}>
        Breeding, pregnancy checks, farrowing, weaning, and castration are entered here, in the same book as weights and treatments.
      </Text>
      <Fields>
        <Select
          label="Pig"
          value={form.pigId}
          onChange={(pigId) => set({ pigId, breedingEventId: null, litterId: null })}
          options={snap.pigs.map((row) => ({ value: row.id, label: pigLabel(row) }))}
          placeholder="Choose a pig"
        />
        <Select
          label="Event"
          value={type}
          onChange={(eventType) => set({ eventType })}
          options={EVENT_TYPES.map((value) => ({ value, label: EVENT_LABELS[value] || value }))}
        />
        <DateField label="Date" value={form.eventDate} onChange={(eventDate) => set({ eventDate })} />
      </Fields>
      {lockedPig && pig ? <Text style={ui.small}>This event stays on {pigLabel(pig)}.</Text> : null}
      {futureDate ? <Notice tone="warn" text="That date is still in the future. Events have to be on or before today." /> : null}
      {farrowNotes.map((text) => (
        <Notice key={text} tone="warn" text={text} />
      ))}

      {type === 'breeding' ? (
        <View style={{ gap: 12 }}>
          <Fields>
            <Select
              label="Boar"
              value={form.sireId || ''}
              onChange={(sireId) => set({ sireId: sireId || null })}
              options={[{ value: '', label: 'Semen or outside boar' }, ...boars.map((row) => ({ value: row.id, label: pigLabel(row) }))]}
            />
            <Field label="Semen or boar name" value={form.sireName} onChange={(sireName) => set({ sireName })} />
            <Select
              label="Method"
              value={form.matingMethod || 'natural'}
              onChange={(matingMethod) => set({ matingMethod })}
              options={[
                { value: 'natural', label: 'Natural' },
                { value: 'ai', label: 'Artificial insemination' },
              ]}
            />
            <Field label="Technician" value={form.technician} onChange={(technician) => set({ technician })} />
          </Fields>
          {due ? (
            <Notice
              tone="info"
              text={
                heatPlan && heatPlan.heatId !== 'new-service'
                  ? `This joins the open heat. Due date stays ${prettyDate(heatPlan.dueDate)}, from the first service.`
                  : heatPlan && heatPlan.returnedServiceIds.length
                    ? `This closes the earlier service as a return to heat. Expected farrow ${prettyDate(heatPlan.dueDate)} (${snap.farm.gestationDays} days).`
                    : `Expected farrow ${prettyDate(due)} (${snap.farm.gestationDays} days). Return-to-heat check around ${prettyDate(heat)}. A repeat within 5 days stays on this heat.`
              }
            />
          ) : null}
        </View>
      ) : null}

      {type === 'pregnancy_check' || type === 'farrowing' || type === 'aborted' ? (
        <Select
          label="Breeding this follows"
          value={form.breedingEventId || ''}
          onChange={(breedingEventId) => set({ breedingEventId: breedingEventId || null })}
          options={[
            { value: '', label: 'Not linked' },
            ...breedings.map((event) => ({
              value: event.id,
              label: `${prettyDate(event.eventDate)} · due ${event.dueDate || '—'}`,
            })),
          ]}
        />
      ) : null}

      {type === 'pregnancy_check' ? (
        <Fields>
          <Select
            label="Result"
            value={form.pregResult || 'pregnant'}
            onChange={(pregResult) => set({ pregResult })}
            options={[
              { value: 'pregnant', label: 'Pregnant' },
              { value: 'open', label: 'Open' },
              { value: 'unsure', label: 'Unsure' },
            ]}
          />
          <Select
            label="Method"
            value={form.pregMethod || 'visual'}
            onChange={(pregMethod) => set({ pregMethod })}
            options={[
              { value: 'visual', label: 'Visual / heat' },
              { value: 'ultrasound', label: 'Ultrasound' },
              { value: 'blood', label: 'Blood test' },
            ]}
          />
        </Fields>
      ) : null}

      {type === 'farrowing' ? (
        <Fields>
          <Field label="Born alive" value={born} onChange={setBorn} />
          <Field label="Stillborn" value={still} onChange={setStill} />
          <Field label="Mummified" value={mummies} onChange={setMummies} />
          <Field label="Litter birth weight (lb)" value={birthWeight} onChange={setBirthWeight} />
          <Field label="Litter number" value={form.litterNumber} onChange={(litterNumber) => set({ litterNumber })} />
        </Fields>
      ) : null}
      {countedParity != null ? <Text style={ui.small}>Parity {countedParity}. Counted from this sow’s recorded farrowings.</Text> : null}

      {type === 'weaning' ? (
        <Fields>
          <Select
            label="Litter"
            value={form.litterId || ''}
            onChange={(litterId) => set({ litterId: litterId || null })}
            options={[{ value: '', label: 'Choose a litter' }, ...litters.map((litter) => ({ value: litter.id, label: `${prettyDate(litter.farrowDate)} · born ${litter.bornAlive}` }))]}
          />
          <Field label="Weaned" value={weaned} onChange={setWeaned} />
          <Field label="Wean weight (lb)" value={weanWeight} onChange={setWeanWeight} />
        </Fields>
      ) : null}

      {type === 'castration' ? (
        <Select
          label="After castration"
          value={form.markBarrow ? 'barrow' : 'keep'}
          onChange={(value) => set({ markBarrow: value === 'barrow' })}
          options={[
            { value: 'barrow', label: 'Castrated. A boar moves to finisher; a piglet moves to nursery.' },
            { value: 'keep', label: 'Castrated, and keep the current stage' },
          ]}
        />
      ) : null}

      {type === 'weight' ? (
        <Fields>
          <Field label="Weight (lb)" value={weight} onChange={setWeight} />
          <Select
            label="Context"
            value={form.weightContext || 'routine'}
            onChange={(weightContext) => set({ weightContext })}
            options={[
              { value: 'routine', label: 'Routine' },
              { value: 'show', label: 'Show weigh-in' },
              { value: 'wean', label: 'Weaning' },
              { value: 'sale', label: 'Sale' },
            ]}
          />
        </Fields>
      ) : null}

      {type === 'treatment' || type === 'deworming' || type === 'vaccination' || type === 'herd_spray' || type === 'other' ? (
        <View style={{ gap: 12 }}>
          <Text style={ui.small}>
            Record what the ranch gave. Herdkeep does not suggest a dose. Any withdrawal days hold the pig, including sprays. Keep VFD copies for 2 years. The pig is clear the day after the withdrawal ends.
          </Text>
          <Fields>
            {type === 'vaccination' ? (
              <Field label="Vaccine" value={form.vaccineName} onChange={(vaccineName) => set({ vaccineName })} />
            ) : type === 'treatment' || type === 'deworming' ? (
              <Field label="Product" value={form.drugName} onChange={(drugName) => set({ drugName })} />
            ) : null}
            <Field label="Lot number" value={form.lotNo} onChange={(lotNo) => set({ lotNo })} />
            <DateField label="Product expiry" value={form.productExpiry || ''} onChange={(productExpiry) => set({ productExpiry: productExpiry || null })} />
            <Field label="Dose recorded" value={form.dose} onChange={(dose) => set({ dose })} />
            <Field label="Route" value={form.route} onChange={(route) => set({ route })} placeholder="IM, oral, pour-on…" />
            <Field label="Withdrawal days" value={holdDays} onChange={setHoldDays} />
            <Select
              label="Extra-label use"
              value={form.eldu ? 'yes' : 'no'}
              onChange={(value) => set({ eldu: value === 'yes' })}
              options={[
                { value: 'no', label: 'Label use' },
                { value: 'yes', label: 'Extra-label (ELDU)' },
              ]}
            />
            {form.eldu ? <Field label="ELDU veterinarian" value={form.elduVet} onChange={(elduVet) => set({ elduVet })} /> : null}
            <DateField label="Next due" value={form.nextDueDate || ''} onChange={(nextDueDate) => set({ nextDueDate: nextDueDate || null })} />
            <Field label="Given by" value={form.treatedBy} onChange={(treatedBy) => set({ treatedBy })} />
            <Field label="Veterinarian" value={form.vetName} onChange={(vetName) => set({ vetName })} />
            <Field label="VFD number" value={form.vfdNumber} onChange={(vfdNumber) => set({ vfdNumber })} />
            <DateField label="VFD expiry" value={form.vfdExpiry || ''} onChange={(vfdExpiry) => set({ vfdExpiry: vfdExpiry || null })} />
            <Field label="VFD document link" value={form.vfdDocUri} onChange={(vfdDocUri) => set({ vfdDocUri })} placeholder="File name or URL" />
            <Field label="Diagnosis" value={form.diagnosis} onChange={(diagnosis) => set({ diagnosis })} />
          </Fields>
        </View>
      ) : null}

      {type === 'sale' ? (
        <View style={{ gap: 12 }}>
          {block ? <Notice tone="bad" text={block} /> : null}
          <Fields>
            <Field label="Buyer" value={form.buyerName} onChange={(buyerName) => set({ buyerName })} />
            <Field label="Price (USD)" value={price} onChange={setPrice} placeholder="450.00" />
          </Fields>
          <Text style={ui.small}>A sale needs a buyer and a price above zero. It also writes the income row and marks the pig sold.</Text>
        </View>
      ) : null}

      {type === 'death' || type === 'cull' ? <Field label="Cause (required)" value={form.cause} onChange={(cause) => set({ cause })} placeholder="Why this pig left" /> : null}

      {type === 'other' || type === 'hoof_trim' || type === 'tagging' || type === 'herd_spray' || type === 'dry_off' || type === 'foster' ? (
        <Field label="Name" value={form.customName} onChange={(customName) => set({ customName })} />
      ) : null}

      <Field label="Notes" value={form.notes} onChange={(notes) => set({ notes })} multiline />
      <Button
        label={busy ? 'Saving…' : eventId ? 'Save event' : 'Add event'}
        disabled={busy || !can(snap.actor.role, 'write') || Boolean(block) || futureDate}
        onPress={() => {
          const next: EventInput = {
            ...form,
            weightLb: parseNumber(weight),
            bornAlive: parseNumber(born),
            stillborn: parseNumber(still) ?? 0,
            mummies: parseNumber(mummies) ?? 0,
            birthWeightLb: parseNumber(birthWeight),
            weanedCount: parseNumber(weaned),
            weanWeightLb: parseNumber(weanWeight),
            parity: null,
            withdrawalDays: parseNumber(holdDays),
            saleAmountCents: centsFromDollars(price),
          };
          void submit(async (repo, actor) => {
            const id = await repo.saveEvent(actor, next, eventId);
            router.replace(form.pigId ? `/pigs/${form.pigId}` : `/events/${id}`);
          });
        }}
      />
    </View>
  );
}
