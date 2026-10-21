import { addDays, diffDays, inRange, monthKey, monthLabel } from './dates';
import { percent } from './format';

export const GESTATION_DEFAULT = 114;
export const WEAN_AGE_DEFAULT = 21;
export const HEAT_CYCLE_DEFAULT = 21;
export const FARROW_INTERVAL_DEFAULT = 142;

/** Growth stages use US terms. Gilt, sow, boar, and barrow stay as reproductive stages. */
export type Stage = 'piglet' | 'nursery' | 'grower' | 'finisher' | 'gilt' | 'sow' | 'boar' | 'barrow';
export type Gender = 'male' | 'female';

export const FEMALE_STAGES: Stage[] = ['piglet', 'nursery', 'grower', 'finisher', 'gilt', 'sow'];
export const MALE_STAGES: Stage[] = ['piglet', 'nursery', 'grower', 'finisher', 'boar', 'barrow'];
export const STAGE_ORDER: Stage[] = ['piglet', 'nursery', 'grower', 'finisher', 'gilt', 'sow', 'boar', 'barrow'];

/** Services this many days apart belong to one heat. A 17–25 day gap is a return. */
export const REPEAT_SERVICE_DAYS = 5;
export const RETURN_GAP_MIN = 17;
export const RETURN_GAP_MAX = 25;

export function normalizeStage(stage: string): Stage {
  if (stage === 'weaner') return 'nursery';
  if ((STAGE_ORDER as string[]).includes(stage)) return stage as Stage;
  return 'piglet';
}
export type PigStatus = 'active' | 'sold' | 'dead' | 'culled' | 'archived';
export type Role = 'owner' | 'manager' | 'data_entry';

export type Action =
  | 'write'
  | 'delete'
  | 'setup'
  | 'roles'
  | 'farm_settings'
  | 'reset_demo';

const ROLE_ACTIONS: Record<Role, Action[]> = {
  owner: ['write', 'delete', 'setup', 'roles', 'farm_settings', 'reset_demo'],
  manager: ['write', 'delete', 'setup', 'farm_settings'],
  data_entry: ['write'],
};

export function can(role: Role, action: Action): boolean {
  return ROLE_ACTIONS[role].includes(action);
}

export function roleLabel(role: Role): string {
  if (role === 'owner') return 'Owner';
  if (role === 'manager') return 'Manager';
  return 'Data entry';
}

export type WeightPoint = { date: string; lb: number };

export function recentAdg(weights: WeightPoint[]): number | null {
  const sorted = weights
    .filter((point) => Number.isFinite(point.lb))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;
  const previous = sorted[sorted.length - 2];
  const latest = sorted[sorted.length - 1];
  const days = diffDays(previous.date, latest.date);
  if (days <= 0) return null;
  return (latest.lb - previous.lb) / days;
}

export function lifetimeAdg(weights: WeightPoint[]): number | null {
  const sorted = weights
    .filter((point) => Number.isFinite(point.lb))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;
  const days = diffDays(sorted[0].date, sorted[sorted.length - 1].date);
  if (days <= 0) return null;
  return (sorted[sorted.length - 1].lb - sorted[0].lb) / days;
}

export type PaceVerdict = 'ahead' | 'on_pace' | 'behind' | 'no_weight' | 'past' | 'at_weight';

export type PaceResult = {
  verdict: PaceVerdict;
  daysLeft: number;
  toGain: number | null;
  requiredAdg: number | null;
  actualAdg: number | null;
  currentLb: number | null;
};

export function showPace(input: {
  currentLb: number | null;
  targetLb: number;
  showDate: string;
  today: string;
  weights: WeightPoint[];
}): PaceResult {
  const daysLeft = diffDays(input.today, input.showDate);
  const actualAdg = recentAdg(input.weights);
  if (input.currentLb == null) {
    return {
      verdict: 'no_weight',
      daysLeft,
      toGain: null,
      requiredAdg: null,
      actualAdg,
      currentLb: null,
    };
  }
  const toGain = input.targetLb - input.currentLb;
  if (daysLeft < 0) {
    return {
      verdict: 'past',
      daysLeft,
      toGain,
      requiredAdg: null,
      actualAdg,
      currentLb: input.currentLb,
    };
  }
  if (toGain <= 0) {
    return {
      verdict: 'at_weight',
      daysLeft,
      toGain,
      requiredAdg: 0,
      actualAdg,
      currentLb: input.currentLb,
    };
  }
  const requiredAdg = daysLeft === 0 ? null : toGain / daysLeft;
  let verdict: PaceVerdict = 'behind';
  if (requiredAdg == null) verdict = 'behind';
  else if (actualAdg == null) verdict = 'no_weight';
  else if (actualAdg >= requiredAdg + 0.05) verdict = 'ahead';
  else if (actualAdg >= requiredAdg - 0.05) verdict = 'on_pace';
  return {
    verdict,
    daysLeft,
    toGain,
    requiredAdg,
    actualAdg,
    currentLb: input.currentLb,
  };
}

export function paceLabel(verdict: PaceVerdict): string {
  switch (verdict) {
    case 'ahead':
      return 'Ahead of pace';
    case 'on_pace':
      return 'On pace';
    case 'behind':
      return 'Behind pace';
    case 'at_weight':
      return 'At target weight';
    case 'past':
      return 'Show date passed';
    default:
      return 'Need another weight';
  }
}

export type WithdrawalHit = {
  eventId: string;
  drug: string;
  ends: string;
};

/**
 * A pig is still in withdrawal on `asOf` when the end date is that day or later.
 * Day 0 is the treatment day. The pig is clear the day after `ends`.
 * Every event with an end date counts: sprays, pour-ons, and group events included.
 */
export function activeWithdrawals(
  events: {
    id: string;
    pigId: string | null;
    eventType: string;
    eventDate?: string | null;
    withdrawalEnds: string | null;
    drugName: string | null;
    vaccineName?: string | null;
    customName?: string | null;
    deletedAt?: string | null;
  }[],
  pigId: string,
  asOf: string,
): WithdrawalHit[] {
  return events
    .filter(
      (event) =>
        event.pigId === pigId &&
        !event.deletedAt &&
        event.withdrawalEnds != null &&
        (!event.eventDate || event.eventDate <= asOf) &&
        event.withdrawalEnds >= asOf,
    )
    .map((event) => ({
      eventId: event.id,
      drug: event.drugName || event.vaccineName || event.customName || 'Treatment',
      ends: event.withdrawalEnds as string,
    }))
    .sort((a, b) => b.ends.localeCompare(a.ends));
}

export function clearOn(ends: string): string {
  return addDays(ends, 1);
}

export function saleBlockReason(hits: WithdrawalHit[]): string | null {
  if (!hits.length) return null;
  const hold = hits[0];
  return `${hold.drug} withdrawal runs through ${hold.ends}. This pig is not sale-ready until ${clearOn(hold.ends)}.`;
}

export function showEntryBlock(hits: WithdrawalHit[], showDate: string): { block: string | null; warn: string | null } {
  if (!hits.length) return { block: null, warn: null };
  const hold = hits[0];
  if (hold.ends >= showDate) {
    return {
      block: `${hold.drug} is not clear until ${hold.ends}, which is on or after the show.`,
      warn: null,
    };
  }
  return {
    block: null,
    warn: `${hold.drug} clears ${hold.ends}, before the show. Keep the pig out of a sale until then.`,
  };
}

export type LitterMath = {
  id: string;
  sowId: string;
  farrowDate: string;
  bornAlive: number;
  stillborn: number;
  mummies: number;
  weanedCount: number | null;
  weanDate: string | null;
};

export type FosterMath = {
  fromLitterId: string;
  toLitterId: string;
  count: number;
  deletedAt?: string | null;
};

export function fosterCounts(litterId: string, fosters: FosterMath[]): { inn: number; out: number } {
  let inn = 0;
  let out = 0;
  for (const move of fosters) {
    if (move.deletedAt) continue;
    if (move.toLitterId === litterId) inn += move.count;
    if (move.fromLitterId === litterId) out += move.count;
  }
  return { inn, out };
}

/** (born alive − weaned + fostered in − fostered out) / born alive */
export function preweanMortality(litter: LitterMath, fosters: FosterMath[]): number | null {
  if (litter.weanedCount == null || litter.bornAlive <= 0) return null;
  const { inn, out } = fosterCounts(litter.id, fosters);
  return (litter.bornAlive - litter.weanedCount + inn - out) / litter.bornAlive;
}

export function pigsOnSow(litter: LitterMath, fosters: FosterMath[]): number {
  if (litter.weanDate) return 0;
  const { inn, out } = fosterCounts(litter.id, fosters);
  const weaned = litter.weanedCount ?? 0;
  return Math.max(0, litter.bornAlive + inn - out - weaned);
}

export function totalBorn(litter: { bornAlive: number; stillborn: number; mummies: number }): number {
  return litter.bornAlive + litter.stillborn + litter.mummies;
}

/** One farrowing record. Mummies are tracked apart from stillborn. */
export type SowFarrowingRecord = {
  bornAlive: number;
  stillborn: number;
  mummies: number;
  weanedCount: number | null;
};

export type SowLifetimeStats = {
  litters: number;
  totalBorn: number;
  bornAlive: number;
  stillborn: number;
  mummies: number;
  /** Stillborn plus mummified. Mummies count as born dead. */
  bornDead: number;
  bornAliveRate: number | null;
  bornDeadRate: number | null;
  stillbornRate: number | null;
  mummyRate: number | null;
  weaned: number;
  weanedLitters: number;
  /** Recorded weaned piglets divided by litters that have a wean count. */
  avgWeanedPerLitter: number | null;
};

/**
 * Lifetime farrowing for one sow. Rates are shares of total born
 * (born alive + stillborn + mummified). A null wean count is a litter
 * that has not been weaned yet, so it stays out of the average.
 */
export function sowLifetime(litters: SowFarrowingRecord[]): SowLifetimeStats {
  let bornAlive = 0;
  let stillborn = 0;
  let mummies = 0;
  let weaned = 0;
  let weanedLitters = 0;
  for (const litter of litters) {
    bornAlive += litter.bornAlive;
    stillborn += litter.stillborn;
    mummies += litter.mummies;
    if (litter.weanedCount != null) {
      weaned += litter.weanedCount;
      weanedLitters += 1;
    }
  }
  const totalBorn = bornAlive + stillborn + mummies;
  const bornDead = stillborn + mummies;
  const rate = (part: number) => (totalBorn > 0 ? part / totalBorn : null);
  return {
    litters: litters.length,
    totalBorn,
    bornAlive,
    stillborn,
    mummies,
    bornDead,
    bornAliveRate: rate(bornAlive),
    bornDeadRate: rate(bornDead),
    stillbornRate: rate(stillborn),
    mummyRate: rate(mummies),
    weaned,
    weanedLitters,
    avgWeanedPerLitter: weanedLitters > 0 ? weaned / weanedLitters : null,
  };
}

/** One line for a sow row. Zero litters stay a sentence instead of a row of zeros. */
export function sowLifetimeSummary(stats: SowLifetimeStats): string {
  if (stats.litters === 0) return 'No litters yet';
  const litterWord = stats.litters === 1 ? 'litter' : 'litters';
  const parts = [
    `${stats.litters} ${litterWord}`,
    `${percent(stats.bornAliveRate)} born alive`,
    `${percent(stats.bornDeadRate)} born dead`,
  ];
  if (stats.mummies > 0) {
    parts.push(`${stats.stillborn} stillborn`);
    parts.push(`${percent(stats.mummyRate)} mummified`);
  }
  parts.push(`${stats.weaned} weaned`);
  if (stats.avgWeanedPerLitter != null) {
    const avg = stats.avgWeanedPerLitter.toFixed(1);
    parts.push(stats.weanedLitters === stats.litters ? `${avg} avg weaned per litter` : `${avg} avg weaned per weaned litter`);
  }
  return parts.join(' · ');
}

/** Parity of a farrowing is the sow's earlier farrowings plus one. */
export function parityForFarrow(priorFarrowDates: string[], farrowDate: string): number {
  return priorFarrowDates.filter((date) => date < farrowDate).length + 1;
}

export type BreedingMath = {
  id: string;
  pigId: string | null;
  eventDate: string;
  heatId?: string | null;
  deletedAt?: string | null;
};

export type OutcomeMath = {
  id: string;
  pigId: string | null;
  eventType: string;
  eventDate: string;
  breedingEventId: string | null;
  pregResult: string | null;
  deletedAt?: string | null;
};

export function expectedFarrowDate(serviceDate: string, gestationDays: number): string {
  return addDays(serviceDate, Math.max(1, gestationDays || GESTATION_DEFAULT));
}

export function heatCheckDate(serviceDate: string, heatCycleDays: number): string {
  return addDays(serviceDate, Math.max(1, heatCycleDays || HEAT_CYCLE_DEFAULT));
}

function outcomeClosesService(event: OutcomeMath): boolean {
  if (event.deletedAt) return false;
  if (event.eventType === 'farrowing' || event.eventType === 'aborted') return true;
  return event.eventType === 'pregnancy_check' && (event.pregResult === 'open' || event.pregResult === 'returned');
}

/**
 * Explicit links win. A farrowing with no breeding id closes the nearest earlier
 * service that is still open, so Expected farrow clears without a manual link.
 */
export function assignedBreedingIds(breedings: BreedingMath[], outcomes: OutcomeMath[]): Map<string, string> {
  const assigned = new Map<string, string>();
  const taken = new Set<string>();
  for (const outcome of outcomes) {
    if (!outcome.breedingEventId || !outcomeClosesService(outcome)) continue;
    assigned.set(outcome.id, outcome.breedingEventId);
    taken.add(outcome.breedingEventId);
  }
  const unlinked = outcomes
    .filter((outcome) => !outcome.deletedAt && outcome.eventType === 'farrowing' && !outcome.breedingEventId)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.id.localeCompare(b.id));
  for (const farrow of unlinked) {
    const nearest = breedings
      .filter((service) => !service.deletedAt && service.pigId === farrow.pigId && service.eventDate <= farrow.eventDate && !taken.has(service.id))
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.id.localeCompare(b.id))
      .at(-1);
    if (!nearest) continue;
    assigned.set(farrow.id, nearest.id);
    taken.add(nearest.id);
  }
  return assigned;
}

export function heatIsOpen(services: BreedingMath[], outcomes: OutcomeMath[], allServices: BreedingMath[] = services): boolean {
  if (!services.length) return false;
  const assigned = assignedBreedingIds(allServices, outcomes);
  const closed = new Set<string>();
  for (const outcome of outcomes) {
    const breedingId = assigned.get(outcome.id);
    if (breedingId && outcomeClosesService(outcome)) closed.add(breedingId);
  }
  return services.every((service) => !service.deletedAt && !closed.has(service.id));
}

/** Another farrowing within a week, or a farrowing far short of gestation. */
export function farrowingWarnings(input: {
  eventDate: string;
  otherFarrowDates: string[];
  serviceDate?: string | null;
}): string[] {
  const warnings: string[] = [];
  for (const date of input.otherFarrowDates) {
    const gap = Math.abs(diffDays(date, input.eventDate));
    if (gap <= 7) {
      warnings.push(`A farrowing is already recorded on ${date}, ${gap === 0 ? 'the same day' : `${gap} days away`}.`);
    }
  }
  if (input.serviceDate && input.serviceDate <= input.eventDate) {
    const days = diffDays(input.serviceDate, input.eventDate);
    if (days < 100) {
      warnings.push(`This is ${days} days after the service on ${input.serviceDate}. Gestation is about ${GESTATION_DEFAULT} days.`);
    }
  }
  return warnings;
}

/** Group a sow's services into heats. Repeats within a few days share a heat. */
export function clusterHeats<T extends BreedingMath>(services: T[]): T[][] {
  const byPig = new Map<string, T[]>();
  for (const service of services) {
    if (service.deletedAt) continue;
    const key = service.pigId || '';
    const list = byPig.get(key) || [];
    list.push(service);
    byPig.set(key, list);
  }
  const heats: T[][] = [];
  for (const list of byPig.values()) {
    const sorted = [...list].sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.id.localeCompare(b.id));
    let current: T[] = [];
    for (const service of sorted) {
      if (!current.length) {
        current = [service];
        continue;
      }
      const heatKey = current[0].heatId || current[0].id;
      const explicit = Boolean(service.heatId) && (service.heatId === heatKey || service.heatId === current[0].id);
      const gap = diffDays(current[current.length - 1].eventDate, service.eventDate);
      if (explicit || (gap >= 0 && gap <= REPEAT_SERVICE_DAYS)) current.push(service);
      else {
        heats.push(current);
        current = [service];
      }
    }
    if (current.length) heats.push(current);
  }
  return heats;
}

export function planBreedingHeat(input: {
  pigId: string;
  serviceDate: string;
  newId: string;
  gestationDays: number;
  services: BreedingMath[];
  outcomes: OutcomeMath[];
}): { heatId: string; dueDate: string; returnedServiceIds: string[] } {
  const heats = clusterHeats(input.services.filter((service) => service.pigId === input.pigId && service.id !== input.newId));
  const open = heats.filter((heat) => heatIsOpen(heat, input.outcomes, input.services));
  for (const heat of open) {
    const first = heat[0];
    const last = heat[heat.length - 1];
    const afterLast = diffDays(last.eventDate, input.serviceDate);
    const afterFirst = diffDays(first.eventDate, input.serviceDate);
    if ((afterLast >= 0 && afterLast <= REPEAT_SERVICE_DAYS) || (afterFirst < 0 && Math.abs(afterFirst) <= REPEAT_SERVICE_DAYS)) {
      const anchor = afterFirst < 0 ? input.serviceDate : first.eventDate;
      return {
        heatId: first.heatId || first.id,
        dueDate: expectedFarrowDate(anchor, input.gestationDays),
        returnedServiceIds: [],
      };
    }
  }
  const returned = new Set<string>();
  for (const heat of open) {
    const gap = diffDays(heat[heat.length - 1].eventDate, input.serviceDate);
    if (gap >= RETURN_GAP_MIN && gap <= RETURN_GAP_MAX) {
      for (const service of heat) returned.add(service.id);
    }
  }
  return {
    heatId: input.newId,
    dueDate: expectedFarrowDate(input.serviceDate, input.gestationDays),
    returnedServiceIds: [...returned],
  };
}

export type InventoryPig = {
  id: string;
  stage: string;
  status: string;
  gender?: string;
  entryDate?: string | null;
  dob?: string | null;
  breedingHerd?: boolean;
  leftOn?: string | null;
};

export type KpiSnapshot = {
  farrowingRate: number | null;
  matings: number;
  farrowed: number;
  preweanMortality: number | null;
  psy: number | null;
  littersPerSow: number | null;
  weanedPerLitter: number | null;
  /** Estimated from litters per sow and lactation, not from each sow's open days. */
  npd: number | null;
  npdEstimated: boolean;
  lactationDays: number | null;
  sowCount: number;
};

function isBreedingFemale(pig: InventoryPig, bred: Set<string>): boolean {
  const female = pig.gender ? pig.gender === 'female' : pig.stage === 'sow' || pig.stage === 'gilt';
  if (!female) return false;
  if (!pig.gender) return pig.stage === 'sow' || pig.stage === 'gilt';
  if (pig.stage === 'sow' || pig.stage === 'gilt') return true;
  return Boolean(pig.breedingHerd) || bred.has(pig.id);
}

function presentOn(pig: InventoryPig, day: string): boolean {
  const start = pig.entryDate || pig.dob || null;
  if (start && start > day) return false;
  if (pig.leftOn) return day < pig.leftOn;
  if (pig.status === 'sold' || pig.status === 'dead' || pig.status === 'culled') return false;
  return true;
}

export function averageBreedingFemales(pigs: InventoryPig[], breedings: BreedingMath[], from: string, to: string): number {
  const bred = new Set(breedings.filter((row) => !row.deletedAt && row.pigId).map((row) => row.pigId as string));
  const females = pigs.filter((pig) => isBreedingFemale(pig, bred));
  const days = diffDays(from, to) + 1;
  if (days <= 0 || females.length === 0) return 0;
  let femaleDays = 0;
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    for (const pig of females) {
      if (presentOn(pig, cursor)) femaleDays += 1;
    }
  }
  return femaleDays / days;
}

export function herdKpis(input: {
  today: string;
  gestationDays: number;
  weaningAgeDays: number;
  pigs: InventoryPig[];
  litters: LitterMath[];
  fosters: FosterMath[];
  breedings: BreedingMath[];
  outcomes: OutcomeMath[];
}): KpiSnapshot {
  const from = addDays(input.today, -364);
  const sowCount = averageBreedingFemales(input.pigs, input.breedings, from, input.today);
  const heats = clusterHeats(input.breedings);
  const assignments = assignedBreedingIds(input.breedings, input.outcomes);
  let matings = 0;
  let farrowed = 0;
  for (const heat of heats) {
    const first = heat[0];
    if (!inRange(first.eventDate, from, input.today)) continue;
    const memberIds = new Set(heat.map((service) => service.id));
    const linked = input.outcomes.filter((event) => {
      const breedingId = assignments.get(event.id);
      return !event.deletedAt && breedingId != null && memberIds.has(breedingId);
    });
    const didFarrow = linked.some((event) => event.eventType === 'farrowing');
    const opened = linked.some(
      (event) => event.eventType === 'pregnancy_check' && (event.pregResult === 'open' || event.pregResult === 'returned'),
    );
    const aborted = linked.some((event) => event.eventType === 'aborted');
    const due = expectedFarrowDate(first.eventDate, input.gestationDays);
    const resolved = didFarrow || opened || aborted || due <= input.today;
    if (!resolved) continue;
    matings += 1;
    if (didFarrow) farrowed += 1;
  }
  const litters = input.litters.filter((litter) => inRange(litter.farrowDate, from, input.today));
  let born = 0;
  let deaths = 0;
  let weaned = 0;
  let weanedLitters = 0;
  const lactations: number[] = [];
  for (const litter of litters) {
    if (litter.weanedCount == null) continue;
    weanedLitters += 1;
    born += litter.bornAlive;
    weaned += litter.weanedCount;
    const { inn, out } = fosterCounts(litter.id, input.fosters);
    deaths += litter.bornAlive - litter.weanedCount + inn - out;
    if (litter.weanDate) {
      const days = diffDays(litter.farrowDate, litter.weanDate);
      if (days >= 0) lactations.push(days);
    }
  }
  const littersPerSow = sowCount > 0 ? litters.length / sowCount : null;
  const weanedPerLitter = weanedLitters > 0 ? weaned / weanedLitters : null;
  const psy =
    littersPerSow != null && weanedPerLitter != null ? littersPerSow * weanedPerLitter : null;
  const lactation =
    lactations.length > 0
      ? lactations.reduce((sum, days) => sum + days, 0) / lactations.length
      : input.weaningAgeDays || WEAN_AGE_DEFAULT;
  const npd =
    littersPerSow == null
      ? null
      : 365 - littersPerSow * ((input.gestationDays || GESTATION_DEFAULT) + lactation);
  return {
    farrowingRate: matings > 0 ? farrowed / matings : null,
    matings,
    farrowed,
    preweanMortality: born > 0 ? deaths / born : null,
    psy,
    littersPerSow,
    weanedPerLitter,
    npd,
    npdEstimated: true,
    lactationDays: lactations.length > 0 ? lactation : null,
    sowCount,
  };
}

export type MoneyTxn = { kind: 'income' | 'expense'; date: string; amountCents: number; categoryId: string | null };

export type MoneyBucket = { key: string; label: string; incomeCents: number; expenseCents: number };

export function moneyBuckets(txns: MoneyTxn[], from: string | null, to: string): MoneyBucket[] {
  if (from && from > to) return [];
  const filtered = txns.filter((txn) => inRange(txn.date, from, to));
  const span = from ? diffDays(from, to) : 400;
  const byDay = span <= 45;
  const map = new Map<string, MoneyBucket>();
  const ensure = (key: string, label: string) => {
    let bucket = map.get(key);
    if (!bucket) {
      bucket = { key, label, incomeCents: 0, expenseCents: 0 };
      map.set(key, bucket);
    }
    return bucket;
  };
  if (from && byDay) {
    for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
      ensure(cursor, cursor.slice(5));
    }
  }
  for (const txn of filtered) {
    const key = byDay ? txn.date.slice(0, 10) : monthKey(txn.date);
    const label = byDay ? key.slice(5) : monthLabel(key);
    const bucket = ensure(key, label);
    if (txn.kind === 'income') bucket.incomeCents += txn.amountCents;
    else bucket.expenseCents += txn.amountCents;
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function categoryTotals(
  txns: MoneyTxn[],
  categories: { id: string; name: string }[],
  kind: 'income' | 'expense',
  from: string | null,
  to: string,
): { id: string; name: string; amountCents: number }[] {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const totals = new Map<string, number>();
  for (const txn of txns) {
    if (txn.kind !== kind || !inRange(txn.date, from, to)) continue;
    const id = txn.categoryId || 'uncategorized';
    totals.set(id, (totals.get(id) || 0) + txn.amountCents);
  }
  return [...totals.entries()]
    .map(([id, amountCents]) => ({
      id,
      name: id === 'uncategorized' ? 'Uncategorized' : names.get(id) || 'Removed category',
      amountCents,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

export function suggestCategory(
  text: string,
  categories: { id: string; name: string }[],
): { id: string; name: string } | null {
  const hay = text.toLowerCase();
  let best: { id: string; name: string; score: number } | null = null;
  for (const category of categories) {
    const words = category.name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3);
    const full = category.name.trim().toLowerCase();
    let score = words.filter((word) => hay.includes(word)).length;
    if (full.length > 3 && hay.includes(full)) score += 2;
    if (score > 0 && (!best || score > best.score)) best = { id: category.id, name: category.name, score };
  }
  return best ? { id: best.id, name: best.name } : null;
}

export function isSelfOrDescendant(
  pigId: string,
  candidateParentId: string,
  parents: { id: string; sireId: string | null; damId: string | null }[],
): boolean {
  if (pigId === candidateParentId) return true;
  const stack = [pigId];
  const seen = new Set<string>();
  while (stack.length) {
    const current = stack.pop() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const pig of parents) {
      if (pig.sireId === current || pig.damId === current) stack.push(pig.id);
    }
  }
  return seen.has(candidateParentId);
}

export function parentAgeProblem(
  childDob: string | null,
  parentDob: string | null,
): string | null {
  if (!childDob || !parentDob) return null;
  if (parentDob >= childDob) return 'A parent has to be born before this pig.';
  return null;
}

export function stockOf(
  moves: { feedTypeId: string; movement: string; quantity: number; deletedAt?: string | null }[],
  feedTypeId: string,
): number {
  let quantity = 0;
  for (const move of moves) {
    if (move.deletedAt || move.feedTypeId !== feedTypeId) continue;
    quantity += move.movement === 'addition' ? move.quantity : -move.quantity;
  }
  return quantity;
}

export function stageCounts(pigs: { stage: string; status: string }[]): { stage: Stage; count: number }[] {
  return STAGE_ORDER.map((stage) => ({
    stage,
    count: pigs.filter((pig) => pig.status === 'active' && normalizeStage(pig.stage) === stage).length,
  }));
}

export type UpcomingItem = {
  id: string;
  tone: 'info' | 'warn' | 'bad';
  kicker: string;
  title: string;
  detail: string;
  href: string;
};

export function upcomingTasks(input: {
  today: string;
  gestationDays: number;
  heatCycleDays: number;
  weaningAgeDays: number;
  pigs: {
    id: string;
    tag: string;
    name: string;
    stage: string;
    status: string;
    gender: string;
    breedingHerd?: boolean;
  }[];
  breedings: BreedingMath[];
  outcomes: OutcomeMath[];
  litters: LitterMath[];
  withdrawals: { pigId: string; drug: string; ends: string }[];
  lowFeeds: { name: string; onHand: number; unit: string }[];
}): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  const pigName = (id: string | null) => {
    const pig = input.pigs.find((row) => row.id === id);
    if (!pig) return 'Unknown pig';
    return pig.name ? `${pig.tag} ${pig.name}` : pig.tag;
  };
  const openHeats = clusterHeats(input.breedings).filter((heat) => heatIsOpen(heat, input.outcomes, input.breedings));
  for (const heat of openHeats) {
    const breeding = heat[0];
    const due = expectedFarrowDate(breeding.eventDate, input.gestationDays);
    const days = diffDays(input.today, due);
    if (days <= 14) {
      items.push({
        id: `farrow-${breeding.id}`,
        tone: days < 0 ? 'bad' : 'warn',
        kicker: days < 0 ? 'Overdue farrow' : 'Due to farrow',
        title: pigName(breeding.pigId),
        detail: days < 0 ? `${-days} days past ${due}` : days === 0 ? `Due ${due}` : `Due ${due}, in ${days} days`,
        href: breeding.pigId ? `/pigs/${breeding.pigId}` : '/events',
      });
    }
    const memberIds = new Set(heat.map((service) => service.id));
    const checked = input.outcomes.some(
      (event) => !event.deletedAt && event.breedingEventId && memberIds.has(event.breedingEventId) && event.eventType === 'pregnancy_check',
    );
    const checkOn = heatCheckDate(breeding.eventDate, input.heatCycleDays);
    if (!checked && checkOn <= addDays(input.today, 3) && input.today < due) {
      items.push({
        id: `heat-${breeding.id}`,
        tone: checkOn < input.today ? 'warn' : 'info',
        kicker: 'Return-to-heat check',
        title: pigName(breeding.pigId),
        detail: `Served ${breeding.eventDate}. Check around ${checkOn} (about 21 days).`,
        href: breeding.pigId ? `/events/new?pig=${breeding.pigId}&type=pregnancy_check&breeding=${breeding.id}` : '/events',
      });
    }
  }
  for (const pig of input.pigs) {
    const breedingHerd = pig.stage === 'sow' || (pig.stage === 'gilt' && pig.breedingHerd);
    if (pig.status !== 'active' || !breedingHerd) continue;
    const gestating = openHeats.some((heat) => heat.some((breeding) => breeding.pigId === pig.id));
    const nursing = input.litters.some((litter) => {
      if (litter.sowId !== pig.id || litter.weanDate) return false;
      return diffDays(litter.farrowDate, input.today) <= input.weaningAgeDays + 14;
    });
    if (!gestating && !nursing) {
      items.push({
        id: `breed-${pig.id}`,
        tone: 'info',
        kicker: 'Open female',
        title: pig.name ? `${pig.tag} ${pig.name}` : pig.tag,
        detail: pig.stage === 'gilt' ? 'Gilt with no open breeding.' : 'Sow is open.',
        href: `/events/new?pig=${pig.id}&type=breeding`,
      });
    }
  }
  for (const litter of input.litters) {
    if (litter.weanDate || litter.weanedCount != null) continue;
    const due = addDays(litter.farrowDate, input.weaningAgeDays);
    if (due <= addDays(input.today, 3)) {
      items.push({
        id: `wean-${litter.id}`,
        tone: due < input.today ? 'warn' : 'info',
        kicker: 'Weaning',
        title: pigName(litter.sowId),
        detail: `Litter farrowed ${litter.farrowDate}. Target wean ${due}.`,
        href: `/litters/${litter.id}`,
      });
    }
  }
  for (const hold of input.withdrawals) {
    items.push({
      id: `hold-${hold.pigId}-${hold.ends}`,
      tone: 'bad',
      kicker: 'Not sale-ready',
      title: pigName(hold.pigId),
      detail: `${hold.drug} clears ${hold.ends}.`,
      href: `/pigs/${hold.pigId}`,
    });
  }
  for (const feed of input.lowFeeds) {
    items.push({
      id: `feed-${feed.name}`,
      tone: 'warn',
      kicker: 'Low feed',
      title: feed.name,
      detail: `${feed.onHand} ${feed.unit} on hand, under the reorder line.`,
      href: '/feed',
    });
  }
  const rank = { bad: 0, warn: 1, info: 2 };
  return items.sort((a, b) => rank[a.tone] - rank[b.tone] || a.title.localeCompare(b.title));
}
