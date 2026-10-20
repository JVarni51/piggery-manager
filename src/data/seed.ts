import { addDays, shiftDate } from '../domain/dates';
import { seedId, type SqlValue } from './ids';

export const SEED_VERSION = '2';
const ANCHOR = '2026-10-20';

export const ID = {
  farm: seedId(1),
  duroc: seedId(10),
  hampshire: seedId(11),
  yorkshire: seedId(12),
  berkshire: seedId(13),
  spotted: seedId(14),
  cross: seedId(15),
  sows: seedId(20),
  boars: seedId(21),
  gilts: seedId(22),
  barrows: seedId(23),
  show: seedId(24),
  nursery: seedId(25),
  feedSow: seedId(30),
  feedShow: seedId(31),
  feedCreep: seedId(32),
  feedNursery: seedId(33),
  incShow: seedId(40),
  incFeeder: seedId(41),
  incBreed: seedId(42),
  incPremium: seedId(43),
  expVet: seedId(50),
  expBed: seedId(51),
  expShow: seedId(52),
  expEquip: seedId(53),
  expSemen: seedId(55),
  priya: seedId(60),
  cole: seedId(61),
  vet: seedId(62),
  feedCo: seedId(63),
  userOwner: seedId(70),
  userManager: seedId(71),
  userEntry: seedId(72),
  hazel: seedId(101),
  juniper: seedId(102),
  clementine: seedId(103),
  willa: seedId(104),
  nell: seedId(105),
  patsy: seedId(106),
  redford: seedId(107),
  boone: seedId(108),
  ticker: seedId(109),
  sable: seedId(110),
  lark: seedId(111),
  matchstick: seedId(112),
  button: seedId(113),
  pebble: seedId(114),
  nim: seedId(115),
  lost: seedId(116),
  marigold: seedId(117),
  stub: seedId(118),
  litHazelJan: seedId(201),
  litClem: seedId(202),
  litJun: seedId(203),
  litWilla: seedId(204),
  litHazelSep: seedId(205),
  showFair: seedId(301),
  showJackpot: seedId(302),
  showWinter: seedId(303),
  brHazelJan: seedId(401),
  brClem: seedId(402),
  brJun: seedId(403),
  brWillaSpring: seedId(404),
  brHazelFall: seedId(405),
  brPatsy: seedId(406),
  brClemFall: seedId(407),
  brJunFall: seedId(408),
  brWillaFall: seedId(409),
  brNell: seedId(410),
};

export type SeedRow = { table: string; row: Record<string, SqlValue> };

export function buildSeed(today: string): SeedRow[] {
  const day = (iso: string) => shiftDate(iso, ANCHOR, today);
  const at = (iso: string) => `${day(iso)}T16:00:00.000Z`;
  const bags: SeedRow[] = [];
  const add = (table: string, row: Record<string, SqlValue>) => bags.push({ table, row });
  const audit = (when: string) => ({
    created_at: at(when),
    updated_at: at(when),
    deleted_at: null,
    sync_status: 'synced',
  });
  const byline = { updated_by: 'Ranch office' };
  const named = (id: string, name: string, when = '2024-01-15') => ({
    id,
    farm_id: ID.farm,
    name,
    created_at: at(when),
    updated_at: at(when),
    deleted_at: null,
    sync_status: 'synced',
  });

  add('farms', {
    id: ID.farm,
    name: 'CG Ranch',
    premises_id: null,
    gestation_days: 114,
    weaning_age_days: 21,
    heat_cycle_days: 21,
    farrowing_interval_days: 142,
    low_feed_lb: 50,
    created_at: at('2023-03-01'),
    updated_at: at('2026-10-01'),
    deleted_at: null,
    sync_status: 'synced',
  });

  for (const [id, name] of [
    [ID.duroc, 'Duroc'],
    [ID.hampshire, 'Hampshire'],
    [ID.yorkshire, 'Yorkshire'],
    [ID.berkshire, 'Berkshire'],
    [ID.spotted, 'Spotted'],
    [ID.cross, 'Crossbred'],
  ] as const) add('breeds', named(id, name));

  for (const [id, name] of [
    [ID.sows, 'Sows'],
    [ID.boars, 'Boars'],
    [ID.gilts, 'Gilts'],
    [ID.barrows, 'Barrows'],
    [ID.show, 'Show string'],
    [ID.nursery, 'Nursery'],
  ] as const) add('pig_groups', named(id, name));

  const feeds: [string, string, number][] = [
    [ID.feedSow, 'Sow 15%', 80],
    [ID.feedShow, 'Show 18%', 100],
    [ID.feedCreep, 'Creep', 80],
    [ID.feedNursery, 'Nursery 20%', 80],
  ];
  for (const [id, name, reorder] of feeds) {
    add('feed_types', { ...named(id, name), unit: 'lb', reorder_lb: reorder });
  }

  for (const [id, name] of [
    [ID.incShow, 'Show pigs'],
    [ID.incFeeder, 'Feeder pigs'],
    [ID.incBreed, 'Breeding stock'],
    [ID.incPremium, 'Premiums'],
  ] as const) add('income_categories', named(id, name));

  for (const [id, name] of [
    [ID.expVet, 'Veterinary'],
    [ID.expBed, 'Bedding'],
    [ID.expShow, 'Show entries'],
    [ID.expEquip, 'Equipment'],
    [ID.expSemen, 'Semen & breeding'],
  ] as const) add('expense_categories', named(id, name));

  add('contacts', { ...named(ID.priya, 'Priya Shah'), kind: 'buyer', phone: '515-555-0142', email: 'priya@example.com', notes: 'Cedar 4-H' });
  add('contacts', { ...named(ID.cole, 'Cole Brennan'), kind: 'buyer', phone: '515-555-0177', email: 'cole@example.com', notes: 'FFA, buys feeders' });
  add('contacts', { ...named(ID.vet, 'Dr. Elena Voss'), kind: 'vet', phone: '515-555-0108', email: null, notes: 'Clinic on the highway' });
  add('contacts', { ...named(ID.feedCo, 'Northline Feed'), kind: 'supplier', phone: null, email: null, notes: null });

  add('farm_users', { ...named(ID.userOwner, 'Ranch office'), email: 'office@cgranch.example', role: 'owner', status: 'enabled' });
  add('farm_users', { ...named(ID.userManager, 'Barn lead'), email: 'lead@cgranch.example', role: 'manager', status: 'enabled' });
  add('farm_users', { ...named(ID.userEntry, 'Saturday help'), email: 'help@cgranch.example', role: 'data_entry', status: 'enabled' });

  const pig = (row: Record<string, SqlValue>) =>
    add('pigs', {
      litter_number: null,
      weight_lb: null,
      source_detail: null,
      sire_id: null,
      sire_text: null,
      dam_id: null,
      dam_text: null,
      notes: null,
      photo_uri: null,
      ear_notch: null,
      show_tag: null,
      registration_no: null,
      litter_id: null,
      castrated: 0,
      ...audit(String(row.entry_date || row.dob || '2024-01-01')),
      ...row,
      dob: row.dob ? day(String(row.dob)) : null,
      entry_date: row.entry_date ? day(String(row.entry_date)) : null,
      farm_id: ID.farm,
      ...byline,
    });

  pig({ id: ID.hazel, tag: '14-2', name: 'Hazel', gender: 'female', stage: 'sow', status: 'active', breed_id: ID.yorkshire, group_id: ID.sows, weight_lb: 480, dob: '2024-01-18', entry_date: '2024-01-18', source: 'born', sire_text: 'OK Dusty', notes: 'Foundation sow. Recently weaned and open.' });
  pig({ id: ID.juniper, tag: '11-8', name: 'Juniper', gender: 'female', stage: 'sow', status: 'active', breed_id: ID.berkshire, group_id: ID.sows, weight_lb: 510, dob: '2023-11-02', entry_date: '2023-11-02', source: 'born', notes: 'Bred in August and still gestating.' });
  pig({ id: ID.clementine, tag: '9-3', name: 'Clementine', gender: 'female', stage: 'sow', status: 'active', breed_id: ID.duroc, group_id: ID.sows, weight_lb: 455, dob: '2023-06-14', entry_date: '2023-06-14', source: 'born', notes: 'Closest to farrowing. She farrowed a heavy litter earlier this year.' });
  pig({ id: ID.willa, tag: '16-1', name: 'Willa', gender: 'female', stage: 'sow', status: 'active', breed_id: ID.hampshire, group_id: ID.sows, weight_lb: 420, dob: '2024-03-22', entry_date: '2024-03-22', source: 'purchased', source_detail: 'County gilt sale', notes: 'Bred October 1. Needs a pregnancy check.' });
  pig({ id: ID.nell, tag: '22-6', name: 'Nell', gender: 'female', stage: 'gilt', status: 'active', breed_id: ID.yorkshire, group_id: ID.gilts, weight_lb: 310, dob: '2025-08-09', entry_date: '2025-08-09', source: 'born', dam_id: ID.hazel, sire_id: ID.redford, notes: 'First service was October 12.' });
  pig({ id: ID.patsy, tag: '23-1', name: 'Patsy', gender: 'female', stage: 'gilt', status: 'active', breed_id: ID.cross, group_id: ID.gilts, weight_lb: 295, dob: '2025-09-01', entry_date: '2025-09-01', source: 'born', notes: 'Checked open in June. Still waiting on a service.' });
  pig({ id: ID.redford, tag: '7-1', name: 'Redford', gender: 'male', stage: 'boar', status: 'active', breed_id: ID.duroc, group_id: ID.boars, weight_lb: 620, dob: '2023-04-02', entry_date: '2023-04-02', source: 'purchased', source_detail: 'Boar stud', notes: 'Herd boar for the Duroc line.' });
  pig({ id: ID.boone, tag: '4-9', name: 'Boone', gender: 'male', stage: 'boar', status: 'active', breed_id: ID.hampshire, group_id: ID.boars, weight_lb: 580, dob: '2022-12-11', entry_date: '2022-12-11', source: 'purchased', notes: 'Older Hampshire boar.' });
  pig({ id: ID.ticker, tag: '26-14', name: 'Ticker', gender: 'male', stage: 'finisher', castrated: 1, status: 'active', breed_id: ID.duroc, group_id: ID.show, weight_lb: 262, dob: '2026-04-12', entry_date: '2026-04-12', source: 'born', sire_id: ID.redford, dam_id: ID.clementine, litter_id: ID.litClem, ear_notch: '4-2', show_tag: '4412', notes: 'Aimed at 280 for the Cedar Valley Jackpot.' });
  pig({ id: ID.sable, tag: '26-18', name: 'Sable', gender: 'male', stage: 'finisher', castrated: 1, status: 'active', breed_id: ID.berkshire, group_id: ID.show, weight_lb: 210, dob: '2026-04-18', entry_date: '2026-04-18', source: 'born', sire_id: ID.boone, dam_id: ID.juniper, litter_id: ID.litJun, ear_notch: '4-6', show_tag: '4418', notes: 'Behind the gain he needs for November.' });
  pig({ id: ID.lark, tag: '26-7', name: 'Lark', gender: 'female', stage: 'gilt', status: 'active', breed_id: ID.yorkshire, group_id: ID.show, weight_lb: 268, dob: '2026-01-20', entry_date: '2026-01-20', source: 'born', sire_id: ID.redford, dam_id: ID.hazel, litter_id: ID.litHazelJan, ear_notch: '1-3', show_tag: '4407', notes: 'January gilt kept for the jackpot.' });
  pig({ id: ID.matchstick, tag: '26-21', name: 'Matchstick', gender: 'male', stage: 'finisher', castrated: 1, status: 'active', breed_id: ID.cross, group_id: ID.show, weight_lb: 248, dob: '2026-04-20', entry_date: '2026-05-02', source: 'purchased', sire_text: 'Shadow Oak Titan', dam_text: 'Unknown', show_tag: '4421', notes: 'Swollen knee after a pen move. On withdrawal.' });
  pig({ id: ID.button, tag: '26-3', name: 'Button', gender: 'female', stage: 'gilt', status: 'active', breed_id: ID.spotted, group_id: ID.show, weight_lb: 178, dob: '2026-05-01', entry_date: '2026-05-01', source: 'born', sire_id: ID.boone, dam_id: ID.willa, litter_id: ID.litWilla, ear_notch: '5-1', show_tag: '4503', notes: 'Later prospect for the December classic.' });
  pig({ id: ID.pebble, tag: '26-31', name: 'Pebble', gender: 'female', stage: 'nursery', status: 'active', breed_id: ID.yorkshire, group_id: ID.nursery, weight_lb: 28, dob: '2026-09-22', entry_date: '2026-09-22', source: 'born', sire_id: ID.redford, dam_id: ID.hazel, litter_id: ID.litHazelSep, litter_number: 'H-5' });
  pig({ id: ID.nim, tag: '26-32', name: 'Nim', gender: 'male', stage: 'nursery', castrated: 1, status: 'active', breed_id: ID.yorkshire, group_id: ID.nursery, weight_lb: 26, dob: '2026-09-22', entry_date: '2026-09-22', source: 'born', sire_id: ID.redford, dam_id: ID.hazel, litter_id: ID.litHazelSep, litter_number: 'H-5', notes: 'Castrated October 5. Still a nursery pig.' });
  pig({ id: ID.lost, tag: '26-40', name: null, gender: 'female', stage: 'piglet', status: 'dead', breed_id: ID.yorkshire, group_id: ID.nursery, weight_lb: 3, dob: '2026-09-22', entry_date: '2026-09-22', source: 'born', sire_id: ID.redford, dam_id: ID.hazel, litter_id: ID.litHazelSep, litter_number: 'H-5' });
  pig({ id: ID.marigold, tag: '24-11', name: 'Marigold', gender: 'female', stage: 'gilt', status: 'sold', breed_id: ID.yorkshire, group_id: ID.gilts, weight_lb: 215, dob: '2025-02-02', entry_date: '2025-02-02', source: 'born', sire_id: ID.redford, dam_id: ID.hazel, notes: 'Sold to Priya Shah for a 4-H project.' });
  pig({ id: ID.stub, tag: '25-2', name: 'Stub', gender: 'male', stage: 'finisher', castrated: 1, status: 'culled', breed_id: ID.cross, group_id: ID.barrows, weight_lb: 190, dob: '2025-03-11', entry_date: '2025-03-11', source: 'born', notes: 'Culled for a hernia.' });

  const litter = (row: Record<string, SqlValue>) =>
    add('litters', {
      sire_id: null,
      breeding_event_id: null,
      parity: null,
      birth_weight_lb: null,
      litter_number: null,
      weaned_count: null,
      wean_weight_lb: null,
      notes: null,
      ...audit(String(row.farrow_date)),
      ...row,
      farm_id: ID.farm,
      farrow_date: day(String(row.farrow_date)),
      wean_date: row.wean_date ? day(String(row.wean_date)) : null,
    });

  litter({ id: ID.litHazelJan, sow_id: ID.hazel, sire_id: ID.redford, breeding_event_id: ID.brHazelJan, farrow_date: '2026-01-20', parity: 2, born_alive: 11, stillborn: 1, mummies: 0, weaned_count: 9, wean_date: '2026-02-10', wean_weight_lb: 220, litter_number: 'H-4' });
  litter({ id: ID.litClem, sow_id: ID.clementine, sire_id: ID.redford, breeding_event_id: ID.brClem, farrow_date: '2026-04-12', parity: 5, born_alive: 10, stillborn: 1, mummies: 0, weaned_count: 9, wean_date: '2026-05-03', wean_weight_lb: 190, litter_number: 'C-5' });
  litter({ id: ID.litJun, sow_id: ID.juniper, sire_id: ID.boone, breeding_event_id: ID.brJun, farrow_date: '2026-04-18', parity: 4, born_alive: 9, stillborn: 0, mummies: 1, weaned_count: 9, wean_date: '2026-05-09', wean_weight_lb: 175, litter_number: 'J-4' });
  litter({ id: ID.litWilla, sow_id: ID.willa, sire_id: ID.boone, breeding_event_id: ID.brWillaSpring, farrow_date: '2026-05-01', parity: 2, born_alive: 8, stillborn: 0, mummies: 0, weaned_count: 8, wean_date: '2026-05-22', wean_weight_lb: 150, litter_number: 'W-2' });
  litter({ id: ID.litHazelSep, sow_id: ID.hazel, sire_id: ID.redford, breeding_event_id: ID.brHazelFall, farrow_date: '2026-09-22', parity: 3, born_alive: 12, stillborn: 1, mummies: 0, weaned_count: 10, wean_date: '2026-10-13', wean_weight_lb: 310, litter_number: 'H-5' });

  add('foster_moves', {
    id: seedId(951),
    farm_id: ID.farm,
    move_date: day('2026-04-20'),
    from_litter_id: ID.litClem,
    to_litter_id: ID.litJun,
    count: 1,
    reason: 'Even the litters',
    notes: 'Moved one piglet off Clementine onto Juniper.',
    ...audit('2026-04-20'),
  });

  const event = (id: string, pigId: string | null, type: string, date: string, extra: Record<string, SqlValue> = {}) =>
    add('events', {
      id,
      farm_id: ID.farm,
      pig_id: pigId,
      mass_event_id: null,
      event_type: type,
      event_date: day(date),
      notes: null,
      weight_lb: null,
      weight_context: null,
      sire_id: null,
      sire_name: null,
      mating_method: null,
      technician: null,
      due_date: null,
      breeding_event_id: null,
      preg_result: null,
      preg_method: null,
      litter_id: null,
      born_alive: null,
      stillborn: null,
      mummies: null,
      birth_weight_lb: null,
      weaned_count: null,
      wean_weight_lb: null,
      drug_name: null,
      dose: null,
      route: null,
      withdrawal_days: null,
      withdrawal_ends: null,
      diagnosis: null,
      symptoms: null,
      treated_by: null,
      vet_name: null,
      vfd_number: null,
      vaccine_name: null,
      next_due_date: null,
      buyer_id: null,
      buyer_name: null,
      sale_amount_cents: null,
      cause: null,
      custom_name: null,
      transaction_id: null,
      ...audit(date),
      ...byline,
      ...extra,
    });

  const breed = (id: string, pigId: string, date: string, sireId: string, sireName: string) =>
    event(id, pigId, 'breeding', date, {
      sire_id: sireId,
      sire_name: sireName,
      mating_method: 'natural',
      technician: 'Ranch office',
      due_date: addDays(day(date), 114),
    });

  breed(ID.brHazelJan, ID.hazel, '2025-09-28', ID.redford, '7-1 Redford');
  breed(ID.brClem, ID.clementine, '2025-12-19', ID.redford, '7-1 Redford');
  breed(ID.brJun, ID.juniper, '2025-12-25', ID.boone, '4-9 Boone');
  breed(ID.brWillaSpring, ID.willa, '2026-01-07', ID.boone, '4-9 Boone');
  breed(ID.brHazelFall, ID.hazel, '2026-05-31', ID.redford, '7-1 Redford');
  breed(ID.brPatsy, ID.patsy, '2026-06-01', ID.redford, '7-1 Redford');
  breed(ID.brClemFall, ID.clementine, '2026-07-02', ID.redford, '7-1 Redford');
  breed(ID.brJunFall, ID.juniper, '2026-08-07', ID.boone, '4-9 Boone');
  breed(ID.brWillaFall, ID.willa, '2026-10-01', ID.redford, '7-1 Redford');
  breed(ID.brNell, ID.nell, '2026-10-12', ID.redford, '7-1 Redford');

  event(seedId(421), ID.patsy, 'pregnancy_check', '2026-06-28', { breeding_event_id: ID.brPatsy, preg_result: 'open', preg_method: 'ultrasound', notes: 'Open. Recycle her.' });
  event(seedId(422), ID.clementine, 'pregnancy_check', '2026-07-30', { breeding_event_id: ID.brClemFall, preg_result: 'pregnant', preg_method: 'ultrasound' });
  event(seedId(423), ID.juniper, 'pregnancy_check', '2026-09-04', { breeding_event_id: ID.brJunFall, preg_result: 'pregnant', preg_method: 'ultrasound' });

  const farrow = (id: string, pigId: string, date: string, breedingId: string, litterId: string, alive: number, still: number, mummies: number) =>
    event(id, pigId, 'farrowing', date, { breeding_event_id: breedingId, litter_id: litterId, born_alive: alive, stillborn: still, mummies });
  farrow(seedId(431), ID.hazel, '2026-01-20', ID.brHazelJan, ID.litHazelJan, 11, 1, 0);
  farrow(seedId(432), ID.clementine, '2026-04-12', ID.brClem, ID.litClem, 10, 1, 0);
  farrow(seedId(433), ID.juniper, '2026-04-18', ID.brJun, ID.litJun, 9, 0, 1);
  farrow(seedId(434), ID.willa, '2026-05-01', ID.brWillaSpring, ID.litWilla, 8, 0, 0);
  farrow(seedId(435), ID.hazel, '2026-09-22', ID.brHazelFall, ID.litHazelSep, 12, 1, 0);

  const wean = (id: string, pigId: string, date: string, litterId: string, count: number, weight: number) =>
    event(id, pigId, 'weaning', date, { litter_id: litterId, weaned_count: count, wean_weight_lb: weight });
  wean(seedId(441), ID.hazel, '2026-02-10', ID.litHazelJan, 9, 220);
  wean(seedId(442), ID.clementine, '2026-05-03', ID.litClem, 9, 190);
  wean(seedId(443), ID.juniper, '2026-05-09', ID.litJun, 9, 175);
  wean(seedId(444), ID.willa, '2026-05-22', ID.litWilla, 8, 150);
  wean(seedId(445), ID.hazel, '2026-10-13', ID.litHazelSep, 10, 310);

  event(seedId(451), ID.lost, 'death', '2026-09-24', { cause: 'Laid on', litter_id: ID.litHazelSep });
  event(seedId(452), ID.stub, 'cull', '2026-06-11', { cause: 'Hernia' });
  event(seedId(453), ID.marigold, 'sale', '2026-09-05', {
    buyer_id: ID.priya,
    buyer_name: 'Priya Shah',
    sale_amount_cents: 45000,
    transaction_id: seedId(801),
    weight_lb: 215,
    notes: '4-H project gilt.',
  });
  event(seedId(454), ID.nim, 'castration', '2026-10-05', { notes: 'Marked as a barrow.' });
  event(seedId(455), ID.matchstick, 'treatment', '2026-10-14', {
    drug_name: 'Penicillin G procaine',
    dose: 'As recorded on the bottle',
    route: 'IM',
    withdrawal_days: 14,
    withdrawal_ends: addDays(day('2026-10-14'), 14),
    symptoms: 'Swollen knee',
    diagnosis: 'Suspected joint infection',
    treated_by: 'Ranch office',
    vet_name: 'Dr. Elena Voss',
    vfd_number: 'VFD-2026-14',
    notes: 'Record only. This is not a dosing instruction.',
  });

  const weights: [string, string, string, number][] = [
    [ID.ticker, '2026-08-20', '185', 185],
    [ID.ticker, '2026-09-17', '230', 230],
    [ID.ticker, '2026-10-15', '262', 262],
    [ID.sable, '2026-09-01', '170', 170],
    [ID.sable, '2026-10-01', '198', 198],
    [ID.sable, '2026-10-18', '210', 210],
    [ID.lark, '2026-08-01', '210', 210],
    [ID.lark, '2026-09-10', '245', 245],
    [ID.lark, '2026-10-18', '268', 268],
    [ID.matchstick, '2026-09-20', '200', 200],
    [ID.matchstick, '2026-10-10', '240', 240],
    [ID.button, '2026-09-15', '140', 140],
    [ID.button, '2026-10-16', '178', 178],
    [ID.hazel, '2026-09-01', '490', 490],
    [ID.hazel, '2026-10-15', '480', 480],
  ];
  weights.forEach((row, index) => {
    event(seedId(501 + index), row[0], 'weight', row[1], { weight_lb: row[3], weight_context: row[0] === ID.hazel ? 'routine' : 'show' });
  });

  const massVax = seedId(601);
  const massWorm = seedId(602);
  add('mass_events', {
    id: massVax,
    farm_id: ID.farm,
    event_date: day('2026-09-01'),
    event_type: 'vaccination',
    group_id: ID.show,
    medicine_name: 'Erysipelas bacterin',
    custom_name: null,
    notes: 'Whole show string.',
    withdrawal_days: null,
    cost_cents: null,
    expense_id: null,
    ...audit('2026-09-01'),
    ...byline,
  });
  add('mass_events', {
    id: massWorm,
    farm_id: ID.farm,
    event_date: day('2026-08-15'),
    event_type: 'deworming',
    group_id: ID.show,
    medicine_name: 'Ivermectin',
    custom_name: null,
    notes: 'Show string plus both boars.',
    withdrawal_days: 5,
    cost_cents: null,
    expense_id: null,
    ...audit('2026-08-15'),
    ...byline,
  });

  const vaxPigs = [ID.ticker, ID.sable, ID.lark, ID.matchstick, ID.button];
  const wormPigs = [...vaxPigs, ID.redford, ID.boone];
  let seq = 700;
  for (const pigId of vaxPigs) {
    const link = seedId(seq++);
    const child = seedId(seq++);
    add('mass_event_pigs', { id: link, mass_event_id: massVax, pig_id: pigId, ...audit('2026-09-01') });
    event(child, pigId, 'vaccination', '2026-09-01', { mass_event_id: massVax, vaccine_name: 'Erysipelas bacterin' });
  }
  for (const pigId of wormPigs) {
    const link = seedId(seq++);
    const child = seedId(seq++);
    add('mass_event_pigs', { id: link, mass_event_id: massWorm, pig_id: pigId, ...audit('2026-08-15') });
    event(child, pigId, 'deworming', '2026-08-15', {
      mass_event_id: massWorm,
      drug_name: 'Ivermectin',
      withdrawal_days: 5,
      withdrawal_ends: addDays(day('2026-08-15'), 5),
    });
  }

  const txn = (id: string, row: Record<string, SqlValue>) =>
    add('transactions', {
      id,
      farm_id: ID.farm,
      category_id: null,
      feed_type_id: null,
      quantity: null,
      receipt_no: null,
      notes: null,
      pig_id: null,
      buyer_id: null,
      feed_move_id: null,
      event_id: null,
      ...audit(String(row.txn_date)),
      ...byline,
      ...row,
      txn_date: day(String(row.txn_date)),
    });

  txn(seedId(801), { kind: 'income', txn_date: '2026-09-05', txn_type: 'pig_sale', category_id: ID.incShow, title: 'Marigold 24-11 to Priya Shah', amount_cents: 45000, pig_id: ID.marigold, buyer_id: ID.priya, event_id: seedId(453), receipt_no: '1055' });
  txn(seedId(802), { kind: 'income', txn_date: '2026-08-09', txn_type: 'category', category_id: ID.incPremium, title: 'County fair premium, Ticker 3rd', amount_cents: 8000 });
  txn(seedId(803), { kind: 'income', txn_date: '2026-10-04', txn_type: 'category', category_id: ID.incFeeder, title: 'Feeder pig to Cole Brennan', amount_cents: 18000, buyer_id: ID.cole, receipt_no: '1062' });
  txn(seedId(804), { kind: 'expense', txn_date: '2026-10-02', txn_type: 'feed_purchase', category_id: null, feed_type_id: ID.feedShow, quantity: 500, title: 'Show 18% — 500 lb', amount_cents: 18600, feed_move_id: seedId(821), receipt_no: 'NL-441' });
  txn(seedId(805), { kind: 'expense', txn_date: '2026-10-02', txn_type: 'feed_purchase', feed_type_id: ID.feedSow, quantity: 400, title: 'Sow 15% — 400 lb', amount_cents: 13200, feed_move_id: seedId(822), receipt_no: 'NL-442' });
  txn(seedId(806), { kind: 'expense', txn_date: '2026-09-12', txn_type: 'feed_purchase', feed_type_id: ID.feedCreep, quantity: 100, title: 'Creep — 100 lb', amount_cents: 4800, feed_move_id: seedId(823) });
  txn(seedId(807), { kind: 'expense', txn_date: '2026-08-20', txn_type: 'feed_purchase', feed_type_id: ID.feedNursery, quantity: 300, title: 'Nursery 20% — 300 lb', amount_cents: 9600, feed_move_id: seedId(824) });
  txn(seedId(808), { kind: 'expense', txn_date: '2026-10-14', txn_type: 'category', category_id: ID.expVet, title: 'Vet call, Matchstick knee', amount_cents: 7500, receipt_no: 'V-88' });
  txn(seedId(809), { kind: 'expense', txn_date: '2026-10-06', txn_type: 'category', category_id: ID.expBed, title: 'Shavings', amount_cents: 2800 });
  txn(seedId(810), { kind: 'expense', txn_date: '2026-10-11', txn_type: 'category', category_id: ID.expShow, title: 'Cedar Valley Jackpot entry', amount_cents: 4000 });
  txn(seedId(811), { kind: 'expense', txn_date: '2026-08-02', txn_type: 'category', category_id: ID.expSemen, title: 'Semen & breeding supplies', amount_cents: 24000 });
  txn(seedId(812), { kind: 'expense', txn_date: '2026-06-18', txn_type: 'category', category_id: ID.expEquip, title: 'Sorting panel repair', amount_cents: 6400 });

  const move = (id: string, row: Record<string, SqlValue>) =>
    add('feed_movements', {
      id,
      farm_id: ID.farm,
      cost_cents: null,
      remark: null,
      done_by: null,
      notes: null,
      expense_id: null,
      ...audit(String(row.move_date)),
      ...byline,
      ...row,
      move_date: day(String(row.move_date)),
    });
  move(seedId(821), { feed_type_id: ID.feedShow, movement: 'addition', move_date: '2026-10-02', quantity: 500, cost_cents: 18600, expense_id: seedId(804), notes: 'Linked to the feed expense.' });
  move(seedId(822), { feed_type_id: ID.feedSow, movement: 'addition', move_date: '2026-10-02', quantity: 400, cost_cents: 13200, expense_id: seedId(805) });
  move(seedId(823), { feed_type_id: ID.feedCreep, movement: 'addition', move_date: '2026-09-12', quantity: 100, cost_cents: 4800, expense_id: seedId(806) });
  move(seedId(824), { feed_type_id: ID.feedNursery, movement: 'addition', move_date: '2026-08-20', quantity: 300, cost_cents: 9600, expense_id: seedId(807) });
  move(seedId(825), { feed_type_id: ID.feedShow, movement: 'reduction', move_date: '2026-08-28', quantity: 20, remark: 'spoilt', notes: 'Got wet in the corner bin.' });
  move(seedId(826), { feed_type_id: ID.feedShow, movement: 'reduction', move_date: '2026-10-08', quantity: 80, remark: 'consumed', done_by: 'Barn lead' });
  move(seedId(827), { feed_type_id: ID.feedShow, movement: 'reduction', move_date: '2026-10-18', quantity: 90, remark: 'consumed', done_by: 'Barn lead' });
  move(seedId(828), { feed_type_id: ID.feedSow, movement: 'reduction', move_date: '2026-10-10', quantity: 120, remark: 'consumed' });
  move(seedId(829), { feed_type_id: ID.feedCreep, movement: 'reduction', move_date: '2026-09-20', quantity: 40, remark: 'consumed' });
  move(seedId(830), { feed_type_id: ID.feedNursery, movement: 'reduction', move_date: '2026-09-01', quantity: 100, remark: 'consumed' });

  add('shows', { id: ID.showFair, farm_id: ID.farm, name: 'County fair prospect show', show_date: day('2026-08-08'), location: 'County fairgrounds', target_weight_lb: 260, notes: 'Ticker stood third.', ...audit('2026-07-01') });
  add('shows', { id: ID.showJackpot, farm_id: ID.farm, name: 'Cedar Valley Jackpot', show_date: day('2026-11-14'), location: 'Cedar Rapids', target_weight_lb: 280, notes: 'Main jackpot for the show string. Target matches the barrow and gilt entries.', ...audit('2026-09-01') });
  add('shows', { id: ID.showWinter, farm_id: ID.farm, name: 'Winter Classic', show_date: day('2026-12-12'), location: 'Des Moines', target_weight_lb: 250, notes: 'Later gilt show.', ...audit('2026-09-15') });

  const entry = (id: string, row: Record<string, SqlValue>) =>
    add('show_entries', { id, farm_id: ID.farm, exhibitor: 'CG Ranch', class_name: null, target_weight_lb: null, weigh_in_lb: null, placing: null, premium_cents: null, ...audit('2026-09-01'), ...row });
  entry(seedId(901), { show_id: ID.showFair, pig_id: ID.ticker, class_name: 'Barrow', target_weight_lb: 260, weigh_in_lb: 175, placing: '3rd', premium_cents: 8000 });
  entry(seedId(902), { show_id: ID.showJackpot, pig_id: ID.ticker, class_name: 'Barrow', target_weight_lb: 280 });
  entry(seedId(903), { show_id: ID.showJackpot, pig_id: ID.sable, class_name: 'Barrow', target_weight_lb: 280 });
  entry(seedId(904), { show_id: ID.showJackpot, pig_id: ID.lark, class_name: 'Gilt', target_weight_lb: 280 });
  entry(seedId(905), { show_id: ID.showWinter, pig_id: ID.button, class_name: 'Gilt', target_weight_lb: 245 });

  add('meta', { key: 'seed_version', value: SEED_VERSION });
  add('meta', { key: 'active_user_id', value: ID.userOwner });
  add('meta', { key: 'user_modified', value: '0' });

  return bags;
}
