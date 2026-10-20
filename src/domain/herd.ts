import { addDays, diffDays, inRange, monthKey, monthLabel } from './dates';

export const GESTATION_DEFAULT = 114;
export const WEAN_AGE_DEFAULT = 21;
export const HEAT_CYCLE_DEFAULT = 21;
export const FARROW_INTERVAL_DEFAULT = 142;

export type Stage = 'piglet' | 'weaner' | 'gilt' | 'sow' | 'boar' | 'barrow';
export type Gender = 'male' | 'female';
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

export function activeWithdrawals(
  events: {
    id: string;
    pigId: string | null;
    eventType: string;
    withdrawalEnds: string | null;
    drugName: string | null;
    deletedAt?: string | null;
  }[],
  pigId: string,
  today: string,
): WithdrawalHit[] {
  return events
    .filter(
      (event) =>
        event.pigId === pigId &&
        !event.deletedAt &&
        (event.eventType === 'treatment' || event.eventType === 'deworming' || event.eventType === 'vaccination') &&
        event.withdrawalEnds != null &&
        event.withdrawalEnds > today,
    )
    .map((event) => ({
      eventId: event.id,
      drug: event.drugName || 'Treatment',
      ends: event.withdrawalEnds as string,
    }))
    .sort((a, b) => b.ends.localeCompare(a.ends));
}

export function saleBlockReason(hits: WithdrawalHit[]): string | null {
  if (!hits.length) return null;
  const hold = hits[0];
  return `${hold.drug} withdrawal runs through ${hold.ends}. This pig is not sale-ready until that date.`;
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
  const { inn, out } = fosterCounts(litter.id, fosters);
  const weaned = litter.weanedCount ?? 0;
  return Math.max(0, litter.bornAlive + inn - out - weaned);
}

export type BreedingMath = {
  id: string;
  pigId: string | null;
  eventDate: string;
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

function isOpenBreeding(breeding: BreedingMath, outcomes: OutcomeMath[]): boolean {
  if (breeding.deletedAt) return false;
  return !outcomes.some((event) => {
    if (event.deletedAt || event.breedingEventId !== breeding.id) return false;
    if (event.eventType === 'farrowing' || event.eventType === 'aborted') return true;
    if (event.eventType === 'pregnancy_check' && event.pregResult === 'open') return true;
    return false;
  });
}

export type KpiSnapshot = {
  farrowingRate: number | null;
  matings: number;
  farrowed: number;
  preweanMortality: number | null;
  psy: number | null;
  littersPerSow: number | null;
  weanedPerLitter: number | null;
  npd: number | null;
  sowCount: number;
};

export function herdKpis(input: {
  today: string;
  gestationDays: number;
  weaningAgeDays: number;
  pigs: { id: string; stage: string; status: string }[];
  litters: LitterMath[];
  fosters: FosterMath[];
  breedings: BreedingMath[];
  outcomes: OutcomeMath[];
}): KpiSnapshot {
  const from = addDays(input.today, -364);
  const sows = input.pigs.filter((pig) => pig.stage === 'sow' && pig.status === 'active');
  const sowCount = sows.length;
  const breedings = input.breedings.filter(
    (event) => !event.deletedAt && inRange(event.eventDate, from, input.today),
  );
  let matings = 0;
  let farrowed = 0;
  for (const breeding of breedings) {
    const due = expectedFarrowDate(breeding.eventDate, input.gestationDays);
    const linked = input.outcomes.filter((event) => !event.deletedAt && event.breedingEventId === breeding.id);
    const didFarrow = linked.some((event) => event.eventType === 'farrowing');
    const opened = linked.some((event) => event.eventType === 'pregnancy_check' && event.pregResult === 'open');
    const aborted = linked.some((event) => event.eventType === 'aborted');
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
  for (const litter of litters) {
    born += litter.bornAlive;
    if (litter.weanedCount == null) continue;
    weanedLitters += 1;
    weaned += litter.weanedCount;
    const { inn, out } = fosterCounts(litter.id, input.fosters);
    deaths += litter.bornAlive - litter.weanedCount + inn - out;
  }
  const littersPerSow = sowCount > 0 ? litters.length / sowCount : null;
  const weanedPerLitter = weanedLitters > 0 ? weaned / weanedLitters : null;
  const psy =
    littersPerSow != null && weanedPerLitter != null ? littersPerSow * weanedPerLitter : null;
  const lactation = input.weaningAgeDays || WEAN_AGE_DEFAULT;
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
    sowCount,
  };
}

export type MoneyTxn = { kind: 'income' | 'expense'; date: string; amountCents: number; categoryId: string | null };

export type MoneyBucket = { key: string; label: string; incomeCents: number; expenseCents: number };

export function moneyBuckets(txns: MoneyTxn[], from: string | null, to: string): MoneyBucket[] {
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
  const stages: Stage[] = ['piglet', 'weaner', 'gilt', 'sow', 'boar', 'barrow'];
  return stages.map((stage) => ({
    stage,
    count: pigs.filter((pig) => pig.status === 'active' && pig.stage === stage).length,
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
  const open = input.breedings.filter((breeding) => isOpenBreeding(breeding, input.outcomes));
  for (const breeding of open) {
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
    const checked = input.outcomes.some(
      (event) => !event.deletedAt && event.breedingEventId === breeding.id && event.eventType === 'pregnancy_check',
    );
    const checkOn = heatCheckDate(breeding.eventDate, input.heatCycleDays);
    if (!checked && checkOn <= addDays(input.today, 3) && input.today < due) {
      items.push({
        id: `heat-${breeding.id}`,
        tone: checkOn < input.today ? 'warn' : 'info',
        kicker: 'Heat check',
        title: pigName(breeding.pigId),
        detail: `Bred ${breeding.eventDate}. Check around ${checkOn}.`,
        href: breeding.pigId ? `/events/new?pig=${breeding.pigId}&type=pregnancy_check&breeding=${breeding.id}` : '/events',
      });
    }
  }
  for (const pig of input.pigs) {
    const breedingHerd = pig.stage === 'sow' || (pig.stage === 'gilt' && pig.breedingHerd);
    if (pig.status !== 'active' || !breedingHerd) continue;
    const gestating = open.some((breeding) => breeding.pigId === pig.id);
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

export { isOpenBreeding };
