import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toCsv } from './csv';
import { addDays, diffDays, rangeFor, shiftDate } from './dates';
import { compareNatural } from './format';
import {
  activeWithdrawals,
  assignedBreedingIds,
  averageBreedingFemales,
  can,
  clusterHeats,
  expectedFarrowDate,
  farrowingWarnings,
  heatIsOpen,
  herdKpis,
  isSelfOrDescendant,
  lifetimeAdg,
  moneyBuckets,
  parentAgeProblem,
  parityForFarrow,
  pigsOnSow,
  sowLifetime,
  sowLifetimeSummary,
  planBreedingHeat,
  preweanMortality,
  recentAdg,
  saleBlockReason,
  showEntryBlock,
  showPace,
  stockOf,
  suggestCategory,
  upcomingTasks,
} from './herd';

describe('dates and gestation', () => {
  it('adds 114 days the long way around a year', () => {
    assert.equal(expectedFarrowDate('2026-07-02', 114), '2026-10-24');
    assert.equal(diffDays('2026-10-20', '2026-10-24'), 4);
  });

  it('shifts a demo date onto today', () => {
    assert.equal(shiftDate('2026-10-24', '2026-10-20', '2026-11-01'), '2026-11-05');
  });

  it('builds a calendar month range', () => {
    assert.deepEqual(rangeFor('month', '2026-10-20'), { from: '2026-10-01', to: '2026-10-20' });
    assert.deepEqual(rangeFor('last_month', '2026-10-20'), { from: '2026-09-01', to: '2026-09-30' });
    assert.deepEqual(rangeFor('custom', '2026-10-20', { from: '2026-08-01', to: '2026-08-15' }), {
      from: '2026-08-01',
      to: '2026-08-15',
    });
  });
});

describe('weights, pace, withdrawal', () => {
  it('computes recent average daily gain', () => {
    const adg = recentAdg([
      { date: '2026-09-17', lb: 230 },
      { date: '2026-10-15', lb: 262 },
    ]);
    assert.ok(adg != null && Math.abs(adg - 32 / 28) < 0.001);
    assert.equal(lifetimeAdg([{ date: '2026-08-20', lb: 185 }, { date: '2026-10-15', lb: 262 }])?.toFixed(2), '1.38');
  });

  it('marks a show pig ahead when gain beats the required pace', () => {
    const pace = showPace({
      currentLb: 262,
      targetLb: 280,
      showDate: '2026-11-14',
      today: '2026-10-20',
      weights: [
        { date: '2026-09-17', lb: 230 },
        { date: '2026-10-15', lb: 262 },
      ],
    });
    assert.equal(pace.verdict, 'ahead');
    assert.equal(pace.daysLeft, 25);
  });

  it('blocks a sale until withdrawal clears and allows a later show', () => {
    const hits = activeWithdrawals(
      [
        {
          id: 't1',
          pigId: 'p1',
          eventType: 'treatment',
          eventDate: '2026-10-14',
          withdrawalEnds: '2026-10-28',
          drugName: 'Penicillin G procaine',
        },
      ],
      'p1',
      '2026-10-20',
    );
    assert.match(saleBlockReason(hits) || '', /not sale-ready/);
    assert.equal(showEntryBlock(hits, '2026-11-14').block, null);
    assert.ok(showEntryBlock(hits, '2026-10-25').block);
  });

  it('holds a sale on the sale date, including sprays, and clears the next day', () => {
    const events = [
      {
        id: 'spray',
        pigId: 'p1',
        eventType: 'herd_spray',
        eventDate: '2026-10-01',
        withdrawalEnds: '2026-10-15',
        drugName: null,
        customName: 'Pour-on',
      },
    ];
    const during = activeWithdrawals(events, 'p1', '2026-10-10');
    const onEnd = activeWithdrawals(events, 'p1', '2026-10-15');
    const clear = activeWithdrawals(events, 'p1', '2026-10-16');
    const beforeTreatment = activeWithdrawals(events, 'p1', '2026-09-20');
    assert.match(saleBlockReason(during) || '', /not sale-ready until 2026-10-16/);
    assert.ok(saleBlockReason(onEnd));
    assert.equal(saleBlockReason(clear), null);
    assert.equal(beforeTreatment.length, 0);
    assert.equal(showEntryBlock(activeWithdrawals(events, 'p1', '2026-10-20'), '2026-10-20').block, null);
  });
});

describe('sow lifetime farrowing', () => {
  it('stays empty when the sow has no litters', () => {
    const stats = sowLifetime([]);
    assert.equal(stats.litters, 0);
    assert.equal(stats.totalBorn, 0);
    assert.equal(stats.bornAlive, 0);
    assert.equal(stats.stillborn, 0);
    assert.equal(stats.mummies, 0);
    assert.equal(stats.bornDead, 0);
    assert.equal(stats.bornAliveRate, null);
    assert.equal(stats.bornDeadRate, null);
    assert.equal(stats.stillbornRate, null);
    assert.equal(stats.mummyRate, null);
    assert.equal(stats.weaned, 0);
    assert.equal(stats.weanedLitters, 0);
    assert.equal(stats.avgWeanedPerLitter, null);
    assert.equal(sowLifetimeSummary(stats), 'No litters yet');
  });

  it('counts mummies as born dead and still reports them on their own', () => {
    const stats = sowLifetime([
      { bornAlive: 9, stillborn: 0, mummies: 1, weanedCount: 9 },
      { bornAlive: 10, stillborn: 2, mummies: 0, weanedCount: null },
    ]);
    assert.equal(stats.litters, 2);
    assert.equal(stats.totalBorn, 22);
    assert.equal(stats.bornAlive, 19);
    assert.equal(stats.stillborn, 2);
    assert.equal(stats.mummies, 1);
    assert.equal(stats.bornDead, 3);
    assert.ok(stats.bornAliveRate != null && Math.abs(stats.bornAliveRate - 19 / 22) < 1e-9);
    assert.ok(stats.bornDeadRate != null && Math.abs(stats.bornDeadRate - 3 / 22) < 1e-9);
    assert.ok(stats.stillbornRate != null && Math.abs(stats.stillbornRate - 2 / 22) < 1e-9);
    assert.ok(stats.mummyRate != null && Math.abs(stats.mummyRate - 1 / 22) < 1e-9);
    assert.equal(stats.weaned, 9);
    assert.equal(stats.weanedLitters, 1);
    assert.equal(stats.avgWeanedPerLitter, 9);
    assert.equal(
      sowLifetimeSummary(stats),
      '2 litters · 86.4% born alive · 13.6% born dead · 2 stillborn · 4.5% mummified · 9 weaned · 9.0 avg weaned per weaned litter',
    );
  });

  it('averages weaned piglets across every weaned litter', () => {
    const stats = sowLifetime([
      { bornAlive: 11, stillborn: 1, mummies: 0, weanedCount: 9 },
      { bornAlive: 12, stillborn: 1, mummies: 0, weanedCount: 10 },
    ]);
    assert.equal(stats.totalBorn, 25);
    assert.equal(stats.bornDead, 2);
    assert.equal(stats.mummies, 0);
    assert.ok(stats.bornAliveRate != null && Math.abs(stats.bornAliveRate - 23 / 25) < 1e-9);
    assert.ok(stats.bornDeadRate != null && Math.abs(stats.bornDeadRate - 2 / 25) < 1e-9);
    assert.equal(stats.weaned, 19);
    assert.equal(stats.weanedLitters, 2);
    assert.equal(stats.avgWeanedPerLitter, 9.5);
    assert.equal(
      sowLifetimeSummary(stats),
      '2 litters · 92.0% born alive · 8.0% born dead · 19 weaned · 9.5 avg weaned per litter',
    );
  });

  it('keeps a recorded litter that produced no piglets', () => {
    const stats = sowLifetime([{ bornAlive: 0, stillborn: 0, mummies: 0, weanedCount: 0 }]);
    assert.equal(stats.litters, 1);
    assert.equal(stats.totalBorn, 0);
    assert.equal(stats.bornAliveRate, null);
    assert.equal(stats.bornDeadRate, null);
    assert.equal(stats.weaned, 0);
    assert.equal(stats.avgWeanedPerLitter, 0);
    assert.equal(sowLifetimeSummary(stats), '1 litter · — born alive · — born dead · 0 weaned · 0.0 avg weaned per litter');
  });
});

describe('litters and herd KPIs', () => {
  it('counts fostering in pre-wean mortality', () => {
    const litter = {
      id: 'L',
      sowId: 'S',
      farrowDate: '2026-04-18',
      bornAlive: 9,
      stillborn: 0,
      mummies: 1,
      weanedCount: 9,
      weanDate: '2026-05-09',
    };
    const rate = preweanMortality(litter, [{ fromLitterId: 'other', toLitterId: 'L', count: 1 }]);
    assert.equal(rate, 1 / 9);
  });

  it('summarizes a trailing year for a small sow herd', () => {
    const pigs = [
      { id: 's1', stage: 'sow', status: 'active' },
      { id: 's2', stage: 'sow', status: 'active' },
    ];
    const litters = [
      {
        id: 'a',
        sowId: 's1',
        farrowDate: '2026-01-20',
        bornAlive: 10,
        stillborn: 0,
        mummies: 0,
        weanedCount: 9,
        weanDate: '2026-02-10',
      },
      {
        id: 'b',
        sowId: 's2',
        farrowDate: '2026-04-12',
        bornAlive: 8,
        stillborn: 1,
        mummies: 0,
        weanedCount: 8,
        weanDate: '2026-05-03',
      },
    ];
    const kpis = herdKpis({
      today: '2026-10-20',
      gestationDays: 114,
      weaningAgeDays: 21,
      pigs,
      litters,
      fosters: [],
      breedings: [
        { id: 'b1', pigId: 's1', eventDate: '2025-10-22' },
        { id: 'b2', pigId: 's2', eventDate: '2025-12-19' },
        { id: 'b3', pigId: 's1', eventDate: '2026-06-01' },
      ],
      outcomes: [
        { id: 'f1', pigId: 's1', eventType: 'farrowing', eventDate: '2026-01-20', breedingEventId: 'b1', pregResult: null },
        { id: 'f2', pigId: 's2', eventType: 'farrowing', eventDate: '2026-04-12', breedingEventId: 'b2', pregResult: null },
        { id: 'o1', pigId: 's1', eventType: 'pregnancy_check', eventDate: '2026-06-28', breedingEventId: 'b3', pregResult: 'open' },
      ],
    });
    assert.equal(kpis.matings, 3);
    assert.equal(kpis.farrowed, 2);
    assert.equal(kpis.farrowingRate, 2 / 3);
    assert.equal(kpis.preweanMortality, 1 / 18);
    assert.equal(kpis.weanedPerLitter, 8.5);
    assert.equal(kpis.npdEstimated, true);
    assert.ok(kpis.npd != null && kpis.npd > 0);
    assert.equal(kpis.sowCount, 2);
  });

  it('ignores litters that are not weaned and counts a repeat service as one heat', () => {
    const kpis = herdKpis({
      today: '2026-10-20',
      gestationDays: 114,
      weaningAgeDays: 21,
      pigs: [{ id: 's1', stage: 'sow', status: 'active' }],
      litters: [
        {
          id: 'weaned',
          sowId: 's1',
          farrowDate: '2026-04-01',
          bornAlive: 10,
          stillborn: 0,
          mummies: 0,
          weanedCount: 8,
          weanDate: '2026-04-29',
        },
        {
          id: 'open',
          sowId: 's1',
          farrowDate: '2026-09-01',
          bornAlive: 12,
          stillborn: 0,
          mummies: 0,
          weanedCount: null,
          weanDate: null,
        },
      ],
      fosters: [],
      breedings: [
        { id: 'a', pigId: 's1', eventDate: '2025-12-08' },
        { id: 'b', pigId: 's1', eventDate: '2025-12-09', heatId: 'a' },
      ],
      outcomes: [
        { id: 'f', pigId: 's1', eventType: 'farrowing', eventDate: '2026-04-01', breedingEventId: 'a', pregResult: null },
      ],
    });
    assert.equal(kpis.preweanMortality, 2 / 10);
    assert.equal(kpis.matings, 1);
    assert.equal(kpis.farrowed, 1);
    assert.equal(kpis.farrowingRate, 1);
    assert.equal(kpis.lactationDays, 28);
  });

  it('uses average breeding-female days and closes a return to heat', () => {
    const from = addDays('2026-10-20', -364);
    const left = addDays(from, 182);
    const average = averageBreedingFemales(
      [{ id: 's1', stage: 'sow', status: 'sold', gender: 'female', entryDate: from, leftOn: left }],
      [],
      from,
      '2026-10-20',
    );
    assert.ok(average > 0.45 && average < 0.55);
    const plan = planBreedingHeat({
      pigId: 's1',
      serviceDate: '2026-10-22',
      newId: 'second',
      gestationDays: 114,
      services: [{ id: 'first', pigId: 's1', eventDate: '2026-10-01', heatId: null }],
      outcomes: [],
    });
    assert.deepEqual(plan.returnedServiceIds, ['first']);
    assert.equal(plan.heatId, 'second');
    const heats = clusterHeats([
      { id: 'first', pigId: 's1', eventDate: '2026-10-01' },
      { id: 'repeat', pigId: 's1', eventDate: '2026-10-02' },
    ]);
    assert.equal(heats.length, 1);
    assert.equal(parityForFarrow(['2026-01-01', '2026-08-01'], '2026-08-01'), 2);
    assert.equal(parityForFarrow(['2026-04-12', '2026-10-20'], '2026-10-21'), 3);
    const services = [
      { id: 'early', pigId: 'sow', eventDate: '2026-01-01' },
      { id: 'open', pigId: 'sow', eventDate: '2026-07-02' },
    ];
    const unlinked = [
      { id: 'f', pigId: 'sow', eventType: 'farrowing', eventDate: '2026-10-20', breedingEventId: null, pregResult: null },
    ];
    assert.equal(assignedBreedingIds(services, unlinked).get('f'), 'open');
    assert.equal(heatIsOpen([services[1]], unlinked, services), false);
    assert.equal(heatIsOpen([services[0]], unlinked, services), true);
    assert.ok(farrowingWarnings({ eventDate: '2026-10-20', otherFarrowDates: ['2026-10-20'], serviceDate: '2026-10-16' }).length >= 2);
    const litter = {
      id: 'L',
      sowId: 'S',
      farrowDate: '2026-04-01',
      bornAlive: 10,
      stillborn: 1,
      mummies: 0,
      weanedCount: 9,
      weanDate: '2026-04-22',
    };
    assert.equal(pigsOnSow(litter, []), 0);
  });
});

describe('money, stock, pedigree guards, roles', () => {
  it('buckets a short range by day and escapes CSV', () => {
    const buckets = moneyBuckets(
      [
        { kind: 'income', date: '2026-10-04', amountCents: 18000, categoryId: 'a' },
        { kind: 'expense', date: '2026-10-04', amountCents: 2800, categoryId: 'b' },
      ],
      '2026-10-01',
      '2026-10-05',
    );
    const day = buckets.find((bucket) => bucket.key === '2026-10-04');
    assert.equal(day?.incomeCents, 18000);
    assert.equal(day?.expenseCents, 2800);
    assert.equal(toCsv(['Note'], [['She said "sold"']]), 'Note\r\n"She said ""sold"""');
    assert.deepEqual(
      moneyBuckets([{ kind: 'expense', date: '2026-10-10', amountCents: 1, categoryId: null }], '2026-10-10', '2026-10-01'),
      [],
    );
  });

  it('nets feed stock and suggests a category', () => {
    assert.equal(
      stockOf(
        [
          { feedTypeId: 'show', movement: 'addition', quantity: 500 },
          { feedTypeId: 'show', movement: 'reduction', quantity: 80 },
          { feedTypeId: 'sow', movement: 'addition', quantity: 10 },
        ],
        'show',
      ),
      420,
    );
    assert.equal(suggestCategory('bought semen for Nell', [{ id: '1', name: 'Semen & breeding' }])?.id, '1');
  });

  it('rejects a pig as her own dam and a descendant as a sire', () => {
    const family = [
      { id: 'sow', sireId: null, damId: null },
      { id: 'gilt', sireId: 'boar', damId: 'sow' },
    ];
    assert.equal(isSelfOrDescendant('sow', 'sow', family), true);
    assert.equal(isSelfOrDescendant('sow', 'gilt', family), true);
    assert.equal(isSelfOrDescendant('gilt', 'boar', family), false);
    assert.equal(parentAgeProblem('2026-04-12', '2026-05-01'), 'A parent has to be born before this pig.');
  });

  it('sorts tags in numeric order', () => {
    const tags = ['26-7', '4-9', '11-8', '26-14', '7-1'];
    assert.deepEqual([...tags].sort(compareNatural), ['4-9', '7-1', '11-8', '26-7', '26-14']);
  });

  it('keeps data entry from deleting', () => {
    assert.equal(can('data_entry', 'write'), true);
    assert.equal(can('data_entry', 'delete'), false);
    assert.equal(can('manager', 'delete'), true);
    assert.equal(can('owner', 'roles'), true);
    assert.equal(can('manager', 'roles'), false);
  });

  it('lists a due farrowing, an open sow, and a withdrawal', () => {
    const items = upcomingTasks({
      today: '2026-10-20',
      gestationDays: 114,
      heatCycleDays: 21,
      weaningAgeDays: 21,
      pigs: [
        { id: 'c', tag: '9-3', name: 'Clementine', stage: 'sow', status: 'active', gender: 'female' },
        { id: 'h', tag: '14-2', name: 'Hazel', stage: 'sow', status: 'active', gender: 'female' },
        { id: 'm', tag: '26-21', name: 'Matchstick', stage: 'barrow', status: 'active', gender: 'male' },
      ],
      breedings: [
        { id: 'bc', pigId: 'c', eventDate: '2026-07-02' },
        { id: 'bw', pigId: 'willa', eventDate: '2026-10-01' },
      ],
      outcomes: [],
      litters: [],
      withdrawals: [{ pigId: 'm', drug: 'Penicillin G procaine', ends: '2026-10-28' }],
      lowFeeds: [],
    });
    assert.ok(items.some((item) => item.id === 'farrow-bc'));
    assert.ok(items.some((item) => item.id === 'breed-h'));
    assert.ok(items.some((item) => item.kicker === 'Not sale-ready'));
  });
});

describe('addDays month ends', () => {
  it('steps off the end of January', () => {
    assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  });
});
