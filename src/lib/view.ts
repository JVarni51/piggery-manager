import { diffDays, prettyDate, todayISO } from '@/domain/dates';
import {
  activeWithdrawals,
  clusterHeats,
  expectedFarrowDate,
  heatIsOpen,
  recentAdg,
  type WeightPoint,
} from '@/domain/herd';
import type { HerdEvent, NamedRow, Pig, Snapshot } from '@/data/types';

export function oneParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export function cleanParams(
  params: Record<string, string | string[] | undefined>,
  patch: Record<string, string | null | undefined>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const one = oneParam(value);
    if (one) next[key] = one;
  }
  for (const [key, value] of Object.entries(patch)) {
    if (!value) delete next[key];
    else next[key] = value;
  }
  return next;
}

export function pigLabel(pig: { tag: string; name?: string | null } | undefined): string {
  if (!pig) return 'Unknown pig';
  return pig.name ? `${pig.tag} ${pig.name}` : pig.tag;
}

export function findPig(snap: Snapshot, id: string | null | undefined): Pig | undefined {
  if (!id) return undefined;
  return snap.pigs.find((pig) => pig.id === id);
}

export function named(rows: { id: string; name: string }[], id: string | null | undefined): string {
  if (!id) return '—';
  return rows.find((row) => row.id === id)?.name || 'Removed';
}

export function inventoryPigs(snap: Snapshot) {
  return snap.pigs.map((pig) => ({
    id: pig.id,
    stage: pig.stage,
    status: pig.status,
    gender: pig.gender,
    entryDate: pig.entryDate,
    dob: pig.dob,
    breedingHerd: inBreedingHerd(pig, snap.groups),
    leftOn:
      snap.events
        .filter((event) => event.pigId === pig.id && (event.eventType === 'sale' || event.eventType === 'death' || event.eventType === 'cull'))
        .map((event) => event.eventDate)
        .sort()[0] || null,
  }));
}

export function inBreedingHerd(pig: Pig, groups: NamedRow[]): boolean {
  if (pig.stage === 'sow') return true;
  if (pig.stage !== 'gilt') return false;
  const group = groups.find((row) => row.id === pig.groupId);
  return group?.name.trim().toLowerCase() === 'gilts';
}

export function ageLabel(dob: string | null, today = todayISO()): string {
  if (!dob) return 'Age unknown';
  const days = diffDays(dob, today);
  if (days < 0) return `Born ${prettyDate(dob)}`;
  if (days < 21) return `${days} days old`;
  const weeks = Math.floor(days / 7);
  if (weeks < 20) return `${weeks} weeks old`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} months old`;
  return `${(days / 365.25).toFixed(1)} years old`;
}

export function weightPoints(events: HerdEvent[], pigId: string): WeightPoint[] {
  return events
    .filter((event) => event.pigId === pigId && event.eventType === 'weight' && event.weightLb != null)
    .map((event) => ({ date: event.eventDate, lb: event.weightLb as number }));
}

export function openBreeding(events: HerdEvent[], pigId: string, gestationDays: number) {
  const mine = events.filter((event) => event.pigId === pigId);
  const breedings = mine.filter((event) => event.eventType === 'breeding');
  const open = clusterHeats(
    breedings.map((event) => ({
      id: event.id,
      pigId: event.pigId,
      eventDate: event.eventDate,
      heatId: event.heatId,
    })),
  )
    .filter((heat) => heatIsOpen(heat, mine, breedings))
    .sort((a, b) => b[0].eventDate.localeCompare(a[0].eventDate));
  const latest = open[0];
  if (!latest) return null;
  const first = latest[0];
  const stored = breedings.find((event) => event.id === first.id);
  return {
    event: stored || breedings[0],
    due: expectedFarrowDate(first.eventDate, gestationDays),
    recordedDue: stored?.dueDate ?? null,
  };
}

/** Parity is how many farrowings are recorded, not a hand-typed number. */
export function parityOf(snap: Snapshot, pigId: string): number {
  return snap.litters.filter((litter) => litter.sowId === pigId).length;
}

export function pigSummary(snap: Snapshot, pig: Pig, today = todayISO()) {
  const left = pig.status === 'sold' || pig.status === 'dead' || pig.status === 'culled';
  const breeding = left ? null : openBreeding(snap.events, pig.id, snap.farm.gestationDays);
  const weights = weightPoints(snap.events, pig.id);
  const lastWeight = [...weights].sort((a, b) => b.date.localeCompare(a.date))[0];
  const holds = activeWithdrawals(snap.events, pig.id, today);
  return {
    breeding,
    parity: parityOf(snap, pig.id),
    adg: recentAdg(weights),
    lastWeight,
    holds,
    weights,
  };
}

export function searchHerd(snap: Snapshot, query: string) {
  const needle = query.trim().toLowerCase();
  if (needle.length < 1) return { pigs: [], events: [], txns: [], shows: [] };
  const pigs = snap.pigs
    .filter((pig) =>
      [pig.tag, pig.name, pig.earNotch, pig.showTag, pig.registrationNo, pig.litterNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    )
    .slice(0, 8);
  const events = snap.events
    .filter((event) =>
      [event.notes, event.drugName, event.vaccineName, event.cause, event.customName, event.buyerName, pigLabel(findPig(snap, event.pigId))]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    )
    .slice(0, 5);
  const txns = snap.transactions
    .filter((txn) => txn.title.toLowerCase().includes(needle) || (txn.notes || '').toLowerCase().includes(needle))
    .slice(0, 5);
  const shows = snap.shows.filter((show) => show.name.toLowerCase().includes(needle)).slice(0, 4);
  return { pigs, events, txns, shows };
}
