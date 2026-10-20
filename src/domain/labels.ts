export const EVENT_LABELS: Record<string, string> = {
  breeding: 'Breeding',
  pregnancy_check: 'Pregnancy check',
  farrowing: 'Farrowing',
  weaning: 'Weaning',
  castration: 'Castration',
  vaccination: 'Vaccination',
  treatment: 'Treatment',
  weight: 'Weight',
  deworming: 'Deworming',
  aborted: 'Aborted',
  dry_off: 'Dry off',
  hoof_trim: 'Hoof trimming',
  tagging: 'Tagging',
  herd_spray: 'Herd spraying',
  death: 'Death',
  cull: 'Cull',
  sale: 'Sale',
  foster: 'Foster',
  other: 'Other',
};

export const STAGE_LABELS: Record<string, string> = {
  piglet: 'Piglet',
  weaner: 'Weaner',
  gilt: 'Gilt',
  sow: 'Sow',
  boar: 'Boar',
  barrow: 'Barrow',
};

export const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  sold: 'Sold',
  dead: 'Dead',
  culled: 'Culled',
  archived: 'Archived',
};

export function eventSummary(event: {
  eventType: string;
  dueDate?: string | null;
  weightLb?: number | null;
  bornAlive?: number | null;
  stillborn?: number | null;
  mummies?: number | null;
  drugName?: string | null;
  vaccineName?: string | null;
  buyerName?: string | null;
  saleAmountCents?: number | null;
  pregResult?: string | null;
  weanedCount?: number | null;
  cause?: string | null;
  customName?: string | null;
  sireName?: string | null;
  matingMethod?: string | null;
  withdrawalEnds?: string | null;
  notes?: string | null;
}): string {
  const type = event.eventType;
  if (type === 'breeding') {
    return `Due ${event.dueDate || '—'} · ${event.matingMethod === 'ai' ? 'AI' : 'Natural'}${event.sireName ? ` · ${event.sireName}` : ''}`;
  }
  if (type === 'pregnancy_check') return event.pregResult ? `Result: ${event.pregResult}` : 'Pregnancy check';
  if (type === 'farrowing') {
    return `Born alive ${event.bornAlive ?? 0}, stillborn ${event.stillborn ?? 0}, mummies ${event.mummies ?? 0}`;
  }
  if (type === 'weaning') return `Weaned ${event.weanedCount ?? 0}`;
  if (type === 'weight') return event.weightLb != null ? `${event.weightLb} lb` : 'Weight';
  if (type === 'treatment' || type === 'deworming') {
    const hold = event.withdrawalEnds ? ` · clear ${event.withdrawalEnds}` : '';
    return `${event.drugName || 'Treatment'}${hold}`;
  }
  if (type === 'vaccination') return event.vaccineName || 'Vaccination';
  if (type === 'sale') {
    const dollars = event.saleAmountCents != null ? `$${(event.saleAmountCents / 100).toFixed(2)}` : '';
    return [dollars, event.buyerName].filter(Boolean).join(' · ') || 'Sale';
  }
  if (type === 'death' || type === 'cull') return event.cause || EVENT_LABELS[type];
  if (type === 'other' || type === 'hoof_trim' || type === 'tagging' || type === 'herd_spray') {
    return event.customName || EVENT_LABELS[type] || 'Event';
  }
  return event.notes || EVENT_LABELS[type] || type;
}
