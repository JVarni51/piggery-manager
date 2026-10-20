import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activeWithdrawals, saleBlockReason, stockOf } from '../domain/herd';
import { createRepo, HerdError } from './repo';
import { openMemoryDatabase } from './sqljs';
import type { EventInput, MassInput, PigInput } from './types';

describe('seeded herd book', () => {
  it('loads the demo ranch and enforces withdrawal, stock, and roles', async () => {
    const db = await openMemoryDatabase();
    const repo = createRepo(db);
    const snap = await repo.ensureReady('2026-10-20');
    assert.equal(snap.farm.name, 'CG Ranch');
    assert.equal(snap.farm.gestationDays, 114);
    assert.equal(snap.pigs.length, 18);
    assert.equal(snap.litters.length, 5);

    const show = snap.feedTypes.find((feed) => feed.name === 'Show 18%');
    const creep = snap.feedTypes.find((feed) => feed.name === 'Creep');
    assert.ok(show && creep);
    assert.equal(stockOf(snap.feedMoves, show.id), 310);
    assert.equal(stockOf(snap.feedMoves, creep.id), 60);

    const match = snap.pigs.find((pig) => pig.tag === '26-21');
    assert.ok(match);
    const block = saleBlockReason(activeWithdrawals(snap.events, match.id, '2026-10-20'));
    assert.match(block || '', /not sale-ready/);
    await assert.rejects(
      () =>
        repo.saveEvent(snap.actor, {
          pigId: match.id,
          eventType: 'sale',
          eventDate: '2026-10-20',
          notes: '',
          weightLb: null,
          weightContext: null,
          sireId: null,
          sireName: '',
          matingMethod: null,
          technician: '',
          breedingEventId: null,
          pregResult: null,
          pregMethod: null,
          bornAlive: null,
          stillborn: null,
          mummies: null,
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
          buyerName: 'Test buyer',
          saleAmountCents: 10000,
          cause: '',
          customName: '',
          markBarrow: false,
        }),
      (error: unknown) => error instanceof HerdError && /sale-ready/.test(error.message),
    );

    const hazel = snap.pigs.find((pig) => pig.name === 'Hazel');
    const redford = snap.pigs.find((pig) => pig.name === 'Redford');
    assert.ok(hazel && redford);
    await repo.saveEvent(snap.actor, {
      pigId: hazel.id,
      eventType: 'breeding',
      eventDate: '2026-10-20',
      notes: '',
      weightLb: null,
      weightContext: null,
      sireId: redford.id,
      sireName: '',
      matingMethod: 'natural',
      technician: 'Ranch office',
      breedingEventId: null,
      pregResult: null,
      pregMethod: null,
      bornAlive: null,
      stillborn: null,
      mummies: null,
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
      markBarrow: false,
    });
    const after = await repo.load();
    const breeding = after.events.find(
      (event) => event.pigId === hazel.id && event.eventType === 'breeding' && event.eventDate === '2026-10-20',
    );
    assert.equal(breeding?.dueDate, '2027-02-11');

    const entry = after.users.find((user) => user.role === 'data_entry');
    assert.ok(entry);
    await repo.setActiveUser(entry.id);
    const asEntry = await repo.load();
    await assert.rejects(
      () => repo.deletePig(asEntry.actor, hazel.id),
      (error: unknown) => error instanceof HerdError,
    );
  });

  it('blocks a backdated sale, a group spray, and a show weigh-in while withdrawal covers that day', async () => {
    const db = await openMemoryDatabase();
    const repo = createRepo(db);
    const snap = await repo.ensureReady('2026-10-20');
    const button = snap.pigs.find((pig) => pig.name === 'Button');
    const lark = snap.pigs.find((pig) => pig.name === 'Lark');
    const jackpot = snap.shows.find((show) => show.name === 'Cedar Valley Jackpot');
    const sable = snap.pigs.find((pig) => pig.name === 'Sable');
    assert.ok(button && lark && jackpot && sable);
    assert.equal(jackpot.targetWeightLb, 280);
    const sableEntry = snap.entries.find((entry) => entry.showId === jackpot.id && entry.pigId === sable.id);
    assert.equal(sableEntry?.targetWeightLb, 280);

    await repo.saveEvent(
      snap.actor,
      eventInput({
        pigId: button.id,
        eventType: 'treatment',
        eventDate: '2026-10-01',
        drugName: 'Penicillin G procaine',
        withdrawalDays: 14,
        lotNo: 'LOT-14',
        productExpiry: '2027-01-01',
      }),
    );
    await assert.rejects(
      () =>
        repo.saveEvent(
          snap.actor,
          eventInput({
            pigId: button.id,
            eventType: 'sale',
            eventDate: '2026-10-10',
            buyerName: 'Late entry',
            saleAmountCents: 12000,
          }),
        ),
      (error: unknown) => error instanceof HerdError && /not sale-ready until 2026-10-16/.test(error.message),
    );
    const cleared = await repo.saveEvent(
      snap.actor,
      eventInput({
        pigId: button.id,
        eventType: 'sale',
        eventDate: '2026-10-16',
        buyerName: 'Clear day',
        saleAmountCents: 12000,
      }),
    );
    assert.ok(cleared);

    await assert.rejects(
      () => repo.saveMass(snap.actor, massInput({ pigIds: [lark.id], withdrawalDays: -1 })),
      (error: unknown) => error instanceof HerdError && /negative/.test(error.message),
    );
    const showId = await repo.saveShow(snap.actor, {
      name: 'Withdrawal week',
      showDate: '2026-10-22',
      location: 'Barn',
      targetWeightLb: 270,
      notes: '',
    });
    const entryId = await repo.saveEntry(snap.actor, {
      showId,
      pigId: lark.id,
      exhibitor: 'CG Ranch',
      className: 'Gilt',
      targetWeightLb: 270,
    });
    await repo.saveMass(
      snap.actor,
      massInput({
        pigIds: [lark.id],
        eventType: 'herd_spray',
        medicineName: 'Pour-on',
        eventDate: '2026-10-18',
        withdrawalDays: 7,
        lotNo: 'SP-7',
      }),
    );
    const sprayed = await repo.load();
    const hold = saleBlockReason(activeWithdrawals(sprayed.events, lark.id, '2026-10-20'));
    assert.match(hold || '', /not sale-ready until 2026-10-26/);
    await assert.rejects(
      () =>
        repo.saveEntry(
          snap.actor,
          {
            showId,
            pigId: lark.id,
            exhibitor: 'CG Ranch',
            className: 'Gilt',
            targetWeightLb: 270,
            weighInLb: 260,
          },
          entryId,
        ),
      (error: unknown) => error instanceof HerdError && /Withdrawal conflict/.test(error.message),
    );
    await repo.saveEntry(
      snap.actor,
      {
        showId,
        pigId: lark.id,
        exhibitor: 'CG Ranch',
        className: 'Gilt',
        targetWeightLb: 275,
        division: 'Cross',
      },
      entryId,
    );
  });

  it('rejects bad dates and causes, links a litter, and closes a returned heat', async () => {
    const db = await openMemoryDatabase();
    const repo = createRepo(db);
    const snap = await repo.ensureReady('2026-10-20');
    const hazel = snap.pigs.find((pig) => pig.name === 'Hazel');
    const patsy = snap.pigs.find((pig) => pig.name === 'Patsy');
    const redford = snap.pigs.find((pig) => pig.name === 'Redford');
    const nim = snap.pigs.find((pig) => pig.name === 'Nim');
    const pebble = snap.pigs.find((pig) => pig.name === 'Pebble');
    assert.ok(hazel && patsy && redford && nim && pebble);

    await assert.rejects(
      () => repo.saveEvent(snap.actor, eventInput({ pigId: pebble.id, eventType: 'death', eventDate: '2026-10-19', cause: '  ' })),
      (error: unknown) => error instanceof HerdError && /cause/.test(error.message),
    );
    await assert.rejects(
      () =>
        repo.saveEvent(
          snap.actor,
          eventInput({ pigId: hazel.id, eventType: 'farrowing', eventDate: '2026-12-01', bornAlive: 8, parity: null }),
        ),
      (error: unknown) => error instanceof HerdError && /before today/.test(error.message),
    );
    await assert.rejects(
      () =>
        repo.saveEvent(
          snap.actor,
          eventInput({ pigId: pebble.id, eventType: 'treatment', eventDate: '2026-10-01', drugName: 'X', withdrawalDays: -2 }),
        ),
      (error: unknown) => error instanceof HerdError && /negative/.test(error.message),
    );
    await assert.rejects(
      () =>
        repo.saveEvent(
          snap.actor,
          eventInput({
            pigId: pebble.id,
            eventType: 'treatment',
            eventDate: '2026-10-01',
            drugName: 'X',
            eldu: true,
            withdrawalDays: null,
          }),
        ),
      (error: unknown) => error instanceof HerdError && /Extra-label/.test(error.message),
    );
    await assert.rejects(
      () =>
        repo.savePig(snap.actor, pigInput({ tag: '99-9', gender: 'female', stage: 'piglet', dob: '2026-09-22', sireId: nim.id, damId: hazel.id })),
      (error: unknown) => error instanceof HerdError && /castrated/.test(error.message),
    );

    const linked = await repo.savePig(
      snap.actor,
      pigInput({
        tag: '99-1',
        name: 'QA piglet',
        gender: 'female',
        stage: 'piglet',
        dob: '2026-09-22',
        damId: hazel.id,
        litterNumber: 'H-5',
      }),
    );
    const litter = snap.litters.find((row) => row.litterNumber === 'H-5' && row.sowId === hazel.id);
    assert.ok(litter);
    const afterLink = await repo.load();
    assert.equal(afterLink.pigs.find((pig) => pig.id === linked)?.litterId, litter.id);

    await repo.saveEvent(
      snap.actor,
      eventInput({
        pigId: hazel.id,
        eventType: 'farrowing',
        eventDate: '2026-10-19',
        bornAlive: 2,
        stillborn: 0,
        mummies: 0,
        parity: null,
        litterNumber: 'H-6',
      }),
    );
    const farrowed = await repo.load();
    const next = farrowed.litters.find((row) => row.litterNumber === 'H-6');
    assert.equal(next?.parity, 3);

    const first = await repo.saveEvent(
      snap.actor,
      eventInput({
        pigId: patsy.id,
        eventType: 'breeding',
        eventDate: '2026-10-01',
        sireId: redford.id,
        matingMethod: 'natural',
      }),
    );
    await repo.saveEvent(
      snap.actor,
      eventInput({
        pigId: patsy.id,
        eventType: 'breeding',
        eventDate: '2026-10-22',
        sireId: redford.id,
        matingMethod: 'natural',
      }),
    );
    const returned = await repo.load();
    const close = returned.events.find(
      (event) => event.pigId === patsy.id && event.eventType === 'pregnancy_check' && event.pregResult === 'returned',
    );
    assert.equal(close?.breedingEventId, first);
    const second = returned.events.find(
      (event) => event.pigId === patsy.id && event.eventType === 'breeding' && event.eventDate === '2026-10-22',
    );
    assert.equal(second?.dueDate, '2027-02-13');
    assert.notEqual(second?.heatId, first);
  });
});

function eventInput(overrides: Partial<EventInput> & Pick<EventInput, 'pigId' | 'eventType' | 'eventDate'>): EventInput {
  return {
    notes: '',
    weightLb: null,
    weightContext: null,
    sireId: null,
    sireName: '',
    matingMethod: null,
    technician: '',
    breedingEventId: null,
    pregResult: null,
    pregMethod: null,
    bornAlive: null,
    stillborn: null,
    mummies: null,
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
    markBarrow: false,
    ...overrides,
  };
}

function massInput(overrides: Partial<MassInput> & Pick<MassInput, 'pigIds'>): MassInput {
  return {
    eventDate: '2026-10-01',
    eventType: 'treatment',
    groupId: null,
    medicineName: 'Product',
    customName: '',
    notes: '',
    withdrawalDays: null,
    lotNo: '',
    productExpiry: null,
    eldu: false,
    elduVet: '',
    vfdExpiry: null,
    vfdDocUri: '',
    costCents: null,
    ...overrides,
  };
}

function pigInput(overrides: Partial<PigInput> & Pick<PigInput, 'tag'>): PigInput {
  return {
    name: '',
    litterNumber: '',
    gender: 'female',
    stage: 'piglet',
    status: 'active',
    breedId: null,
    groupId: null,
    weightLb: null,
    dob: null,
    entryDate: null,
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
    ...overrides,
  };
}
