import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { activeWithdrawals, saleBlockReason, stockOf } from '../domain/herd';
import { createRepo, HerdError } from './repo';
import { openMemoryDatabase } from './sqljs';

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
});
