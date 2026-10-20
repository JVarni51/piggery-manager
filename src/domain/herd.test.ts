import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toCsv } from './csv';
import { addDays, diffDays, rangeFor, shiftDate } from './dates';
import {
  activeWithdrawals,
  can,
  expectedFarrowDate,
  herdKpis,
  isSelfOrDescendant,
  lifetimeAdg,
  moneyBuckets,
  parentAgeProblem,
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
    assert.ok(kpis.npd != null && kpis.npd > 0);
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
