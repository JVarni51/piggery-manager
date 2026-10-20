import { addDays, todayISO } from '../domain/dates';
import {
  activeWithdrawals,
  can,
  expectedFarrowDate,
  isSelfOrDescendant,
  parentAgeProblem,
  roleLabel,
  saleBlockReason,
  showEntryBlock,
  stockOf,
  type Action,
  type Role,
} from '../domain/herd';
import type { HerdDb } from './driver';
import { blankToNull, uid, type SqlValue } from './ids';
import { rowToCamel } from './map';
import { DATA_TABLES, RESTORE_TABLES, SCHEMA_SQL } from './schema';
import { buildSeed, SEED_VERSION } from './seed';
import type {
  Actor,
  Contact,
  EntryInput,
  EventInput,
  Farm,
  FarmUser,
  FeedInput,
  FeedMove,
  FeedType,
  FosterInput,
  FosterMove,
  HerdEvent,
  Litter,
  LookupKind,
  MassEvent,
  MassInput,
  MassPig,
  NamedRow,
  Pig,
  PigInput,
  RemovedRef,
  Show,
  ShowEntry,
  ShowInput,
  Snapshot,
  Transaction,
  TxnInput,
} from './types';

export class HerdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HerdError';
  }
}

const LOOKUP_TABLE: Record<LookupKind, string> = {
  breed: 'breeds',
  group: 'pig_groups',
  feed: 'feed_types',
  income: 'income_categories',
  expense: 'expense_categories',
};

function assertCan(actor: Actor, action: Action) {
  if (!can(actor.role, action)) {
    throw new HerdError(`${roleLabel(actor.role)} can't do that on this device.`);
  }
}

export function createRepo(db: HerdDb) {
  async function insert(table: string, row: Record<string, SqlValue>) {
    const keys = Object.keys(row);
    await db.run(
      `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
      keys.map((key) => row[key] ?? null),
    );
  }

  async function patch(table: string, id: string, fields: Record<string, SqlValue>) {
    const keys = Object.keys(fields);
    await db.run(
      `UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`,
      [...keys.map((key) => fields[key] ?? null), id],
    );
  }

  async function many<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const result = await db.all<Record<string, SqlValue>>(sql, params);
    return result.map((row) => rowToCamel<T>(row));
  }

  async function one<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    const row = await db.get<Record<string, SqlValue>>(sql, params);
    return row ? rowToCamel<T>(row) : null;
  }

  async function meta(key: string): Promise<string | null> {
    const row = await db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
    return row?.value ?? null;
  }

  async function setMeta(key: string, value: string) {
    await db.run(
      `INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }

  async function markDirty() {
    await setMeta('user_modified', '1');
  }

  async function farm(): Promise<Farm> {
    const row = await one<Farm>('SELECT * FROM farms WHERE deleted_at IS NULL LIMIT 1');
    if (!row) throw new HerdError('The farm record is missing.');
    return row;
  }

  async function wipe() {
    for (const table of DATA_TABLES) await db.run(`DELETE FROM ${table}`);
    await db.run('DELETE FROM meta');
  }

  async function applySeed(today: string) {
    for (const item of buildSeed(today)) await insert(item.table, item.row);
  }

  async function load(): Promise<Snapshot> {
    const currentFarm = await farm();
    const users = await many<FarmUser>(
      'SELECT * FROM farm_users WHERE deleted_at IS NULL ORDER BY name',
    );
    const activeId = await meta('active_user_id');
    const actorUser = users.find((user) => user.id === activeId) || users.find((user) => user.role === 'owner') || users[0];
    const actor: Actor = actorUser
      ? { userId: actorUser.id, name: actorUser.name, role: actorUser.role }
      : { userId: '', name: 'Ranch office', role: 'owner' };
    const removed: RemovedRef[] = [];
    const removedQueries: [string, string][] = [
      ['pigs', "COALESCE(name, tag)"],
      ['events', 'event_type'],
      ['transactions', 'title'],
      ['litters', 'farrow_date'],
      ['shows', 'name'],
    ];
    for (const [table, label] of removedQueries) {
      const rows = await db.all<{ id: string; label: string; deleted_at: string }>(
        `SELECT id, ${label} as label, deleted_at FROM ${table} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 12`,
      );
      for (const row of rows) {
        removed.push({ table, id: row.id, label: String(row.label), deletedAt: row.deleted_at });
      }
    }
    return {
      engine: db.kind,
      farm: currentFarm,
      actor,
      users,
      breeds: await many<NamedRow>('SELECT * FROM breeds WHERE deleted_at IS NULL ORDER BY name'),
      groups: await many<NamedRow>('SELECT * FROM pig_groups WHERE deleted_at IS NULL ORDER BY name'),
      feedTypes: await many<FeedType>('SELECT * FROM feed_types WHERE deleted_at IS NULL ORDER BY name'),
      incomeCategories: await many<NamedRow>('SELECT * FROM income_categories WHERE deleted_at IS NULL ORDER BY name'),
      expenseCategories: await many<NamedRow>('SELECT * FROM expense_categories WHERE deleted_at IS NULL ORDER BY name'),
      contacts: await many<Contact>('SELECT * FROM contacts WHERE deleted_at IS NULL ORDER BY name'),
      pigs: await many<Pig>('SELECT * FROM pigs WHERE deleted_at IS NULL ORDER BY tag'),
      events: await many<HerdEvent>('SELECT * FROM events WHERE deleted_at IS NULL ORDER BY event_date DESC, created_at DESC'),
      massEvents: await many<MassEvent>('SELECT * FROM mass_events WHERE deleted_at IS NULL ORDER BY event_date DESC'),
      massPigs: await many<MassPig>('SELECT * FROM mass_event_pigs WHERE deleted_at IS NULL'),
      litters: await many<Litter>('SELECT * FROM litters WHERE deleted_at IS NULL ORDER BY farrow_date DESC'),
      fosters: await many<FosterMove>('SELECT * FROM foster_moves WHERE deleted_at IS NULL ORDER BY move_date DESC'),
      transactions: await many<Transaction>('SELECT * FROM transactions WHERE deleted_at IS NULL ORDER BY txn_date DESC'),
      feedMoves: await many<FeedMove>('SELECT * FROM feed_movements WHERE deleted_at IS NULL ORDER BY move_date DESC'),
      shows: await many<Show>('SELECT * FROM shows WHERE deleted_at IS NULL ORDER BY show_date'),
      entries: await many<ShowEntry>('SELECT * FROM show_entries WHERE deleted_at IS NULL'),
      removed,
      userModified: (await meta('user_modified')) === '1',
    };
  }

  async function ensureReady(today = todayISO()): Promise<Snapshot> {
    await db.exec(SCHEMA_SQL);
    const existing = await db.get<{ id: string }>('SELECT id FROM farms LIMIT 1');
    const version = await meta('seed_version');
    const modified = await meta('user_modified');
    if (!existing || (version !== SEED_VERSION && modified !== '1')) {
      await wipe();
      await applySeed(today);
    }
    await db.flush();
    return load();
  }

  function stamp(actor: Actor, created = false) {
    const now = new Date().toISOString();
    return {
      updated_at: now,
      sync_status: 'pending',
      updated_by: actor.name,
      ...(created ? { created_at: now, deleted_at: null } : {}),
    };
  }

  async function touchPig(actor: Actor, pigId: string | null) {
    if (!pigId) return;
    await patch('pigs', pigId, { updated_at: new Date().toISOString(), updated_by: actor.name, sync_status: 'pending' });
  }

  async function refreshWeight(pigId: string) {
    const latest = await db.get<{ weight_lb: number }>(
      `SELECT weight_lb FROM events WHERE pig_id = ? AND event_type = 'weight' AND deleted_at IS NULL AND weight_lb IS NOT NULL ORDER BY event_date DESC, created_at DESC LIMIT 1`,
      [pigId],
    );
    if (latest) await db.run('UPDATE pigs SET weight_lb = ? WHERE id = ?', [latest.weight_lb, pigId]);
  }

  async function ensureBuyer(actor: Actor, name: string, buyerId: string | null, current: Farm): Promise<string | null> {
    if (buyerId) return buyerId;
    const trimmed = name.trim();
    if (!trimmed) return null;
    const found = await db.get<{ id: string }>(
      'SELECT id FROM contacts WHERE deleted_at IS NULL AND lower(name) = lower(?) LIMIT 1',
      [trimmed],
    );
    if (found) return found.id;
    const id = uid();
    await insert('contacts', {
      id,
      farm_id: current.id,
      name: trimmed,
      kind: 'buyer',
      phone: null,
      email: null,
      notes: null,
      ...stamp(actor, true),
    });
    return id;
  }

  async function pigsForParents() {
    return many<{ id: string; gender: string; dob: string | null; sireId: string | null; damId: string | null }>(
      'SELECT id, gender, dob, sire_id, dam_id FROM pigs WHERE deleted_at IS NULL',
    );
  }

  async function savePig(actor: Actor, input: PigInput, id?: string) {
    assertCan(actor, 'write');
    const current = await farm();
    const tag = input.tag.trim();
    if (!tag) throw new HerdError('Tag number is required.');
    const duplicate = await db.get<{ id: string }>(
      'SELECT id FROM pigs WHERE deleted_at IS NULL AND farm_id = ? AND lower(tag) = lower(?) AND id != ?',
      [current.id, tag, id || ''],
    );
    if (duplicate) throw new HerdError(`Tag ${tag} is already on another pig.`);
    const female = ['piglet', 'weaner', 'gilt', 'sow'];
    const male = ['piglet', 'weaner', 'boar', 'barrow'];
    if (input.gender === 'female' && !female.includes(input.stage)) throw new HerdError('That stage does not match a female pig.');
    if (input.gender === 'male' && !male.includes(input.stage)) throw new HerdError('That stage does not match a male pig.');
    if (input.photoUri && input.photoUri.length > 4_500_000) throw new HerdError('Photo has to be 3 MB or smaller.');
    const existing = id ? await one<Pig>('SELECT * FROM pigs WHERE id = ?', [id]) : null;
    let status = input.status;
    if (['sold', 'dead', 'culled'].includes(status) && status !== existing?.status) {
      throw new HerdError('Record a sale, death, or cull as an event so the reason stays with the pig.');
    }
    if (existing && ['sold', 'dead', 'culled'].includes(existing.status) && status !== existing.status) {
      assertCan(actor, 'delete');
    }
    if (!['active', 'archived', 'sold', 'dead', 'culled'].includes(status)) status = 'active';
    const family = await pigsForParents();
    const checkParent = (parentId: string | null, expected: 'male' | 'female', label: string) => {
      if (!parentId) return;
      if (parentId === id) throw new HerdError(`A pig can't be listed as its own ${label}.`);
      const parent = family.find((pig) => pig.id === parentId);
      if (!parent) throw new HerdError(`${label} was not found.`);
      if (parent.gender !== expected) throw new HerdError(`${label} has to be ${expected}.`);
      if (id && isSelfOrDescendant(id, parentId, family.map((pig) => ({ id: pig.id, sireId: pig.sireId, damId: pig.damId })))) {
        throw new HerdError(`That ${label} is this pig or one of its descendants.`);
      }
      const age = parentAgeProblem(input.dob, parent.dob);
      if (age) throw new HerdError(age);
    };
    checkParent(input.sireId, 'male', 'sire');
    checkParent(input.damId, 'female', 'dam');
    if (input.sireId && input.sireId === input.damId) throw new HerdError('Sire and dam have to be different pigs.');
    const row: Record<string, SqlValue> = {
      tag,
      name: blankToNull(input.name),
      litter_number: blankToNull(input.litterNumber),
      gender: input.gender,
      stage: input.stage,
      status,
      breed_id: input.breedId,
      group_id: input.groupId,
      weight_lb: input.weightLb,
      dob: blankToNull(input.dob),
      entry_date: blankToNull(input.entryDate),
      source: input.source || 'born',
      source_detail: blankToNull(input.sourceDetail),
      sire_id: input.sireId,
      sire_text: blankToNull(input.sireText),
      dam_id: input.damId,
      dam_text: blankToNull(input.damText),
      notes: blankToNull(input.notes),
      photo_uri: input.photoUri,
      ear_notch: blankToNull(input.earNotch),
      show_tag: blankToNull(input.showTag),
      registration_no: blankToNull(input.registrationNo),
      litter_id: input.litterId,
      ...stamp(actor, !id),
    };
    const pigId = id || uid();
    if (id) await patch('pigs', id, row);
    else await insert('pigs', { id: pigId, farm_id: current.id, ...row });
    if (input.weightLb != null && input.weightLb !== existing?.weightLb) {
      const same = await db.get<{ id: string }>(
        `SELECT id FROM events WHERE pig_id = ? AND event_type = 'weight' AND deleted_at IS NULL AND event_date = ? AND weight_lb = ?`,
        [pigId, todayISO(), input.weightLb],
      );
      if (!same) {
        await insert('events', {
          id: uid(),
          farm_id: current.id,
          pig_id: pigId,
          mass_event_id: null,
          event_type: 'weight',
          event_date: todayISO(),
          weight_lb: input.weightLb,
          weight_context: 'routine',
          notes: 'Weight updated from the pig record.',
          ...stamp(actor, true),
        });
      }
    }
    await markDirty();
    return pigId;
  }

  async function saveEvent(actor: Actor, input: EventInput, id?: string) {
    assertCan(actor, 'write');
    const current = await farm();
    if (!input.pigId) throw new HerdError('Choose a pig.');
    if (!input.eventDate) throw new HerdError('Event date is required.');
    const pig = await one<Pig>('SELECT * FROM pigs WHERE id = ? AND deleted_at IS NULL', [input.pigId]);
    if (!pig) throw new HerdError('That pig is not on the herd list.');
    const type = input.eventType;
    if (type === 'sale') {
      if (!input.saleAmountCents || input.saleAmountCents <= 0) throw new HerdError('A sale needs a price greater than zero.');
      if (!input.buyerName.trim() && !input.buyerId) throw new HerdError('A sale needs a buyer.');
      const events = await many<HerdEvent>('SELECT * FROM events WHERE deleted_at IS NULL AND pig_id = ?', [pig.id]);
      const block = saleBlockReason(activeWithdrawals(events.filter((event) => event.id !== id), pig.id, todayISO()));
      if (block) throw new HerdError(block);
    }
    if ((type === 'death' || type === 'cull') && !input.cause.trim()) throw new HerdError('Add a cause.');
    if (type === 'weight' && (input.weightLb == null || input.weightLb <= 0)) throw new HerdError('Enter the weight in pounds.');
    if (type === 'treatment' && !input.drugName.trim()) throw new HerdError('Enter the drug that was given.');
    if (type === 'vaccination' && !input.vaccineName.trim()) throw new HerdError('Enter the vaccine.');
    if (type === 'deworming' && !input.drugName.trim()) throw new HerdError('Enter the product used.');
    if (type === 'other' && !input.customName.trim()) throw new HerdError('Name this event.');
    if (type === 'pregnancy_check' && !input.pregResult) throw new HerdError('Record whether she is pregnant or open.');
    if (type === 'farrowing' && (input.bornAlive == null || input.bornAlive < 0)) throw new HerdError('Enter pigs born alive.');
    if (type === 'weaning' && (input.weanedCount == null || input.weanedCount < 0)) throw new HerdError('Enter how many were weaned.');
    if (type === 'breeding' && !input.sireId && !input.sireName.trim()) throw new HerdError('Name the boar or the semen used.');

    if (type === 'weaning' && input.litterId) {
      const litter = await one<Litter>('SELECT * FROM litters WHERE id = ?', [input.litterId]);
      if (litter) {
        const fosters = await many<FosterMove>('SELECT * FROM foster_moves WHERE deleted_at IS NULL');
        const inn = fosters.filter((move) => move.toLitterId === litter.id).reduce((sum, move) => sum + move.count, 0);
        const out = fosters.filter((move) => move.fromLitterId === litter.id).reduce((sum, move) => sum + move.count, 0);
        const cap = litter.bornAlive + inn - out;
        if ((input.weanedCount || 0) > cap) {
          throw new HerdError(`That litter has ${cap} pigs to wean after fostering.`);
        }
      }
    }

    const withdrawalEnds =
      input.withdrawalDays != null && input.withdrawalDays >= 0 ? addDays(input.eventDate, input.withdrawalDays) : null;
    const dueDate = type === 'breeding' ? expectedFarrowDate(input.eventDate, current.gestationDays) : null;
    let sireName = blankToNull(input.sireName);
    if (input.sireId) {
      const sire = await one<Pig>('SELECT * FROM pigs WHERE id = ?', [input.sireId]);
      if (sire) sireName = sire.name ? `${sire.tag} ${sire.name}` : sire.tag;
    }
    const buyerId = type === 'sale' ? await ensureBuyer(actor, input.buyerName, input.buyerId, current) : input.buyerId;
    const eventId = id || uid();
    const existing = id ? await one<HerdEvent>('SELECT * FROM events WHERE id = ?', [id]) : null;
    const row: Record<string, SqlValue> = {
      pig_id: input.pigId,
      event_type: type,
      event_date: input.eventDate,
      notes: blankToNull(input.notes),
      weight_lb: input.weightLb,
      weight_context: input.weightContext,
      sire_id: input.sireId,
      sire_name: sireName,
      mating_method: input.matingMethod,
      technician: blankToNull(input.technician),
      due_date: dueDate,
      breeding_event_id: input.breedingEventId,
      preg_result: input.pregResult,
      preg_method: input.pregMethod,
      born_alive: input.bornAlive,
      stillborn: input.stillborn,
      mummies: input.mummies,
      birth_weight_lb: input.birthWeightLb,
      weaned_count: input.weanedCount,
      wean_weight_lb: input.weanWeightLb,
      litter_id: input.litterId,
      drug_name: blankToNull(input.drugName),
      dose: blankToNull(input.dose),
      route: blankToNull(input.route),
      withdrawal_days: input.withdrawalDays,
      withdrawal_ends: withdrawalEnds,
      diagnosis: blankToNull(input.diagnosis),
      symptoms: blankToNull(input.symptoms),
      treated_by: blankToNull(input.treatedBy),
      vet_name: blankToNull(input.vetName),
      vfd_number: blankToNull(input.vfdNumber),
      vaccine_name: blankToNull(input.vaccineName),
      next_due_date: input.nextDueDate,
      buyer_id: buyerId,
      buyer_name: blankToNull(input.buyerName),
      sale_amount_cents: input.saleAmountCents,
      cause: blankToNull(input.cause),
      custom_name: blankToNull(input.customName),
      transaction_id: existing?.transactionId ?? null,
      ...stamp(actor, !id),
    };
    if (id) await patch('events', id, row);
    else await insert('events', { id: eventId, farm_id: current.id, mass_event_id: null, ...row });

    if (type === 'farrowing') {
      let litterId = input.litterId || existing?.litterId || null;
      const litterFields: Record<string, SqlValue> = {
        sow_id: input.pigId,
        sire_id: input.sireId,
        breeding_event_id: input.breedingEventId,
        farrow_date: input.eventDate,
        parity: input.parity,
        born_alive: input.bornAlive ?? 0,
        stillborn: input.stillborn ?? 0,
        mummies: input.mummies ?? 0,
        birth_weight_lb: input.birthWeightLb,
        litter_number: blankToNull(input.litterNumber),
        ...stamp(actor, !litterId),
      };
      if (!litterId) {
        litterId = uid();
        await insert('litters', { id: litterId, farm_id: current.id, weaned_count: null, wean_date: null, wean_weight_lb: null, notes: null, ...litterFields });
        await patch('events', eventId, { litter_id: litterId });
      } else {
        await patch('litters', litterId, litterFields);
      }
      if (pig.stage === 'gilt') await patch('pigs', pig.id, { stage: 'sow', ...stamp(actor) });
    }

    if (type === 'weaning' && input.litterId) {
      await patch('litters', input.litterId, {
        weaned_count: input.weanedCount,
        wean_date: input.eventDate,
        wean_weight_lb: input.weanWeightLb,
        ...stamp(actor),
      });
    }
    if (type === 'weaning' && pig.stage === 'piglet') await patch('pigs', pig.id, { stage: 'weaner', ...stamp(actor) });
    if (type === 'castration' && input.markBarrow && pig.gender === 'male') {
      await patch('pigs', pig.id, { stage: 'barrow', ...stamp(actor) });
    }
    if (type === 'sale') {
      const title = `${pig.name ? `${pig.tag} ${pig.name}` : pig.tag} sold to ${input.buyerName.trim()}`;
      const txnId = existing?.transactionId || uid();
      const txnRow: Record<string, SqlValue> = {
        kind: 'income',
        txn_date: input.eventDate,
        txn_type: 'pig_sale',
        title,
        amount_cents: input.saleAmountCents,
        pig_id: pig.id,
        buyer_id: buyerId,
        event_id: eventId,
        notes: blankToNull(input.notes),
        ...stamp(actor, !existing?.transactionId),
      };
      if (existing?.transactionId) await patch('transactions', existing.transactionId, txnRow);
      else {
        const showCat = await db.get<{ id: string }>(
          `SELECT id FROM income_categories WHERE deleted_at IS NULL AND lower(name) LIKE '%show%' LIMIT 1`,
        );
        await insert('transactions', {
          id: txnId,
          farm_id: current.id,
          category_id: showCat?.id ?? null,
          feed_type_id: null,
          quantity: null,
          receipt_no: null,
          feed_move_id: null,
          ...txnRow,
        });
        await patch('events', eventId, { transaction_id: txnId });
      }
      await patch('pigs', pig.id, { status: 'sold', ...stamp(actor) });
    }
    if (type === 'death') await patch('pigs', pig.id, { status: 'dead', ...stamp(actor) });
    if (type === 'cull') await patch('pigs', pig.id, { status: 'culled', ...stamp(actor) });
    if (type === 'weight' || input.weightLb != null) await refreshWeight(pig.id);
    await touchPig(actor, pig.id);
    await markDirty();
    return eventId;
  }

  async function deleteEvent(actor: Actor, id: string) {
    assertCan(actor, 'delete');
    const event = await one<HerdEvent>('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!event) return;
    const now = new Date().toISOString();
    await patch('events', id, { deleted_at: now, ...stamp(actor) });
    if (event.transactionId) await patch('transactions', event.transactionId, { deleted_at: now, ...stamp(actor) });
    if (event.eventType === 'farrowing' && event.litterId) {
      const pigs = await db.get<{ id: string }>('SELECT id FROM pigs WHERE litter_id = ? AND deleted_at IS NULL LIMIT 1', [event.litterId]);
      const foster = await db.get<{ id: string }>(
        'SELECT id FROM foster_moves WHERE deleted_at IS NULL AND (from_litter_id = ? OR to_litter_id = ?) LIMIT 1',
        [event.litterId, event.litterId],
      );
      if (!pigs && !foster) await patch('litters', event.litterId, { deleted_at: now, ...stamp(actor) });
    }
    if (event.pigId && (event.eventType === 'sale' || event.eventType === 'death' || event.eventType === 'cull')) {
      const other = await db.get<{ event_type: string }>(
        `SELECT event_type FROM events WHERE pig_id = ? AND deleted_at IS NULL AND event_type IN ('sale','death','cull') ORDER BY event_date DESC LIMIT 1`,
        [event.pigId],
      );
      const status = other?.event_type === 'sale' ? 'sold' : other?.event_type === 'death' ? 'dead' : other?.event_type === 'cull' ? 'culled' : 'active';
      await patch('pigs', event.pigId, { status, ...stamp(actor) });
    }
    if (event.pigId) await refreshWeight(event.pigId);
    await markDirty();
  }

  async function saveMass(actor: Actor, input: MassInput, id?: string) {
    assertCan(actor, 'write');
    const current = await farm();
    if (!input.eventDate) throw new HerdError('Event date is required.');
    let pigIds = [...new Set(input.pigIds)];
    if (pigIds.length === 0 && input.groupId) {
      const rows = await db.all<{ id: string }>(
        `SELECT id FROM pigs WHERE deleted_at IS NULL AND status = 'active' AND group_id = ?`,
        [input.groupId],
      );
      pigIds = rows.map((row) => row.id);
    }
    if (pigIds.length === 0) throw new HerdError('Choose a group or at least one pig.');
    if ((input.eventType === 'vaccination' || input.eventType === 'treatment' || input.eventType === 'deworming') && !input.medicineName.trim()) {
      throw new HerdError('Name the product used.');
    }
    if (input.eventType === 'other' && !input.customName.trim()) throw new HerdError('Name this event.');
    const massId = id || uid();
    const existing = id ? await one<MassEvent>('SELECT * FROM mass_events WHERE id = ?', [id]) : null;
    let expenseId = existing?.expenseId ?? null;
    if (input.costCents && input.costCents > 0) {
      const category = await db.get<{ id: string }>(
        `SELECT id FROM expense_categories WHERE deleted_at IS NULL AND lower(name) LIKE '%vet%' LIMIT 1`,
      );
      const title = input.medicineName.trim() || input.customName.trim() || input.eventType;
      const txnRow: Record<string, SqlValue> = {
        kind: 'expense',
        txn_date: input.eventDate,
        txn_type: 'category',
        category_id: category?.id ?? null,
        title: `Group ${input.eventType.replace(/_/g, ' ')} · ${title}`,
        amount_cents: input.costCents,
        notes: blankToNull(input.notes),
        ...stamp(actor, !expenseId),
      };
      if (expenseId) await patch('transactions', expenseId, txnRow);
      else {
        expenseId = uid();
        await insert('transactions', {
          id: expenseId,
          farm_id: current.id,
          feed_type_id: null,
          quantity: null,
          receipt_no: null,
          pig_id: null,
          buyer_id: null,
          feed_move_id: null,
          event_id: null,
          ...txnRow,
        });
      }
    }
    const massRow: Record<string, SqlValue> = {
      event_date: input.eventDate,
      event_type: input.eventType,
      group_id: input.groupId,
      medicine_name: blankToNull(input.medicineName),
      custom_name: blankToNull(input.customName),
      notes: blankToNull(input.notes),
      withdrawal_days: input.withdrawalDays,
      cost_cents: input.costCents,
      expense_id: expenseId,
      ...stamp(actor, !id),
    };
    if (id) await patch('mass_events', id, massRow);
    else await insert('mass_events', { id: massId, farm_id: current.id, ...massRow });

    const links = id
      ? await many<MassPig>('SELECT * FROM mass_event_pigs WHERE mass_event_id = ? AND deleted_at IS NULL', [massId])
      : [];
    const children = id
      ? await many<HerdEvent>('SELECT * FROM events WHERE mass_event_id = ? AND deleted_at IS NULL', [massId])
      : [];
    const keep = new Set(pigIds);
    const now = new Date().toISOString();
    for (const link of links) {
      if (!keep.has(link.pigId)) await patch('mass_event_pigs', link.id, { deleted_at: now, sync_status: 'pending', updated_at: now });
    }
    for (const child of children) {
      if (child.pigId && !keep.has(child.pigId)) await patch('events', child.id, { deleted_at: now, ...stamp(actor) });
    }
    const withdrawalEnds = input.withdrawalDays != null ? addDays(input.eventDate, input.withdrawalDays) : null;
    for (const pigId of pigIds) {
      const child = children.find((event) => event.pigId === pigId);
      const childType = ['tagging', 'herd_spray', 'hoof_trim', 'other'].includes(input.eventType) && input.eventType !== 'hoof_trim'
        ? input.eventType
        : input.eventType;
      const fields: Record<string, SqlValue> = {
        pig_id: pigId,
        mass_event_id: massId,
        event_type: childType,
        event_date: input.eventDate,
        notes: blankToNull(input.notes),
        drug_name: input.eventType === 'vaccination' ? null : blankToNull(input.medicineName),
        vaccine_name: input.eventType === 'vaccination' ? blankToNull(input.medicineName) : null,
        custom_name: blankToNull(input.customName) || (input.eventType === 'hoof_trim' ? 'Hoof trimming' : null),
        withdrawal_days: input.withdrawalDays,
        withdrawal_ends: withdrawalEnds,
        ...stamp(actor, !child),
      };
      if (child) await patch('events', child.id, fields);
      else await insert('events', { id: uid(), farm_id: current.id, transaction_id: null, ...fields });
      if (!links.some((link) => link.pigId === pigId)) {
        await insert('mass_event_pigs', { id: uid(), mass_event_id: massId, pig_id: pigId, ...stamp(actor, true) });
      }
      await touchPig(actor, pigId);
    }
    await markDirty();
    return massId;
  }

  async function deleteMass(actor: Actor, id: string) {
    assertCan(actor, 'delete');
    const now = new Date().toISOString();
    await patch('mass_events', id, { deleted_at: now, ...stamp(actor) });
    const children = await many<HerdEvent>('SELECT * FROM events WHERE mass_event_id = ? AND deleted_at IS NULL', [id]);
    for (const child of children) await patch('events', child.id, { deleted_at: now, ...stamp(actor) });
    await db.run(
      `UPDATE mass_event_pigs SET deleted_at = ?, sync_status = 'pending', updated_at = ? WHERE mass_event_id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
    const mass = await one<MassEvent>('SELECT * FROM mass_events WHERE id = ?', [id]);
    if (mass?.expenseId) await patch('transactions', mass.expenseId, { deleted_at: now, ...stamp(actor) });
    await markDirty();
  }

  async function saveTransaction(actor: Actor, input: TxnInput, id?: string) {
    assertCan(actor, 'write');
    const current = await farm();
    if (!input.txnDate) throw new HerdError('Date is required.');
    if (!input.amountCents || input.amountCents <= 0) throw new HerdError('Amount has to be more than zero.');
    if (input.txnType === 'category' && !input.categoryId) throw new HerdError('Choose a category.');
    if (input.txnType === 'other' && !input.title.trim()) throw new HerdError('Name this transaction.');
    if (input.txnType === 'feed_purchase') {
      if (!input.feedTypeId) throw new HerdError('Choose a feed.');
      if (!input.quantity || input.quantity <= 0) throw new HerdError('Enter the quantity.');
    }
    if (input.txnType === 'pig_sale' && !input.pigId) throw new HerdError('A pig sale has to name the pig.');
    const existing = id ? await one<Transaction>('SELECT * FROM transactions WHERE id = ?', [id]) : null;
    const buyerId = input.buyerName.trim() ? await ensureBuyer(actor, input.buyerName, null, current) : null;
    let feedMoveId = existing?.feedMoveId ?? null;
    const txnId = id || uid();
    if (input.txnType === 'feed_purchase' && input.feedTypeId && input.quantity) {
      const moveRow: Record<string, SqlValue> = {
        feed_type_id: input.feedTypeId,
        movement: 'addition',
        move_date: input.txnDate,
        quantity: input.quantity,
        cost_cents: input.amountCents,
        expense_id: txnId,
        notes: 'Recorded with the expense so stock and cost stay together.',
        ...stamp(actor, !feedMoveId),
      };
      if (feedMoveId) await patch('feed_movements', feedMoveId, moveRow);
      else {
        feedMoveId = uid();
        await insert('feed_movements', { id: feedMoveId, farm_id: current.id, remark: null, done_by: actor.name, ...moveRow });
      }
    } else if (feedMoveId) {
      await patch('feed_movements', feedMoveId, { deleted_at: new Date().toISOString(), ...stamp(actor) });
      feedMoveId = null;
    }
    const feed = input.feedTypeId
      ? await one<FeedType>('SELECT * FROM feed_types WHERE id = ?', [input.feedTypeId])
      : null;
    const title =
      input.txnType === 'feed_purchase' && feed
        ? `${feed.name} — ${input.quantity} ${feed.unit}`
        : input.title.trim() || 'Transaction';
    const row: Record<string, SqlValue> = {
      kind: input.kind,
      txn_date: input.txnDate,
      txn_type: input.txnType,
      category_id: input.txnType === 'feed_purchase' ? null : input.categoryId,
      feed_type_id: input.feedTypeId,
      quantity: input.quantity,
      title,
      amount_cents: input.amountCents,
      receipt_no: blankToNull(input.receiptNo),
      notes: blankToNull(input.notes),
      pig_id: input.pigId,
      buyer_id: buyerId,
      feed_move_id: feedMoveId,
      ...stamp(actor, !id),
    };
    if (id) await patch('transactions', id, row);
    else await insert('transactions', { id: txnId, farm_id: current.id, event_id: null, ...row });
    if (existing?.eventId && input.txnType === 'pig_sale') {
      await patch('events', existing.eventId, {
        sale_amount_cents: input.amountCents,
        buyer_name: blankToNull(input.buyerName),
        buyer_id: buyerId,
        event_date: input.txnDate,
        ...stamp(actor),
      });
    }
    await markDirty();
    return txnId;
  }

  async function deleteTransaction(actor: Actor, id: string) {
    assertCan(actor, 'delete');
    const txn = await one<Transaction>('SELECT * FROM transactions WHERE id = ?', [id]);
    const now = new Date().toISOString();
    await patch('transactions', id, { deleted_at: now, ...stamp(actor) });
    if (txn?.feedMoveId) await patch('feed_movements', txn.feedMoveId, { deleted_at: now, ...stamp(actor) });
    await markDirty();
  }

  async function saveFeed(actor: Actor, input: FeedInput, id?: string) {
    assertCan(actor, 'write');
    const current = await farm();
    if (!input.feedTypeId) throw new HerdError('Choose a feed.');
    if (!input.quantity || input.quantity <= 0) throw new HerdError('Quantity has to be more than zero.');
    if (!input.moveDate) throw new HerdError('Date is required.');
    if (input.movement === 'reduction' && !input.remark) throw new HerdError('Choose why the feed left the bin.');
    const moves = await many<FeedMove>('SELECT * FROM feed_movements WHERE deleted_at IS NULL');
    const existing = id ? moves.find((move) => move.id === id) : undefined;
    let onHand = stockOf(moves, input.feedTypeId);
    if (existing && existing.feedTypeId === input.feedTypeId) {
      onHand += existing.movement === 'addition' ? -existing.quantity : existing.quantity;
    }
    if (input.movement === 'reduction' && onHand - input.quantity < -0.001) {
      throw new HerdError(`Only ${onHand} lb are on hand.`);
    }
    let expenseId = existing?.expenseId ?? null;
    const moveId = id || uid();
    if (input.movement === 'addition' && input.costCents && input.costCents > 0) {
      const feed = await one<FeedType>('SELECT * FROM feed_types WHERE id = ?', [input.feedTypeId]);
      const txnRow: Record<string, SqlValue> = {
        kind: 'expense',
        txn_date: input.moveDate,
        txn_type: 'feed_purchase',
        feed_type_id: input.feedTypeId,
        quantity: input.quantity,
        title: `${feed?.name || 'Feed'} — ${input.quantity} ${feed?.unit || 'lb'}`,
        amount_cents: input.costCents,
        feed_move_id: moveId,
        notes: 'Created from the feed delivery so it is not entered twice.',
        ...stamp(actor, !expenseId),
      };
      if (expenseId) await patch('transactions', expenseId, txnRow);
      else {
        expenseId = uid();
        await insert('transactions', {
          id: expenseId,
          farm_id: current.id,
          category_id: null,
          receipt_no: null,
          pig_id: null,
          buyer_id: null,
          event_id: null,
          ...txnRow,
        });
      }
    }
    const row: Record<string, SqlValue> = {
      feed_type_id: input.feedTypeId,
      movement: input.movement,
      move_date: input.moveDate,
      quantity: input.quantity,
      cost_cents: input.costCents,
      remark: blankToNull(input.remark),
      done_by: blankToNull(input.doneBy),
      notes: blankToNull(input.notes),
      expense_id: expenseId,
      ...stamp(actor, !id),
    };
    if (id) await patch('feed_movements', id, row);
    else await insert('feed_movements', { id: moveId, farm_id: current.id, ...row });
    await markDirty();
    return moveId;
  }

  async function deleteFeed(actor: Actor, id: string) {
    assertCan(actor, 'delete');
    const move = await one<FeedMove>('SELECT * FROM feed_movements WHERE id = ?', [id]);
    const now = new Date().toISOString();
    await patch('feed_movements', id, { deleted_at: now, ...stamp(actor) });
    if (move?.expenseId) await patch('transactions', move.expenseId, { deleted_at: now, ...stamp(actor) });
    await markDirty();
  }

  async function saveShow(actor: Actor, input: ShowInput, id?: string) {
    assertCan(actor, 'write');
    const current = await farm();
    if (!input.name.trim() || !input.showDate) throw new HerdError('A show needs a name and a date.');
    const row: Record<string, SqlValue> = {
      name: input.name.trim(),
      show_date: input.showDate,
      location: blankToNull(input.location),
      target_weight_lb: input.targetWeightLb,
      notes: blankToNull(input.notes),
      ...stamp(actor, !id),
    };
    const showId = id || uid();
    if (id) await patch('shows', id, row);
    else await insert('shows', { id: showId, farm_id: current.id, ...row });
    await markDirty();
    return showId;
  }

  async function deleteShow(actor: Actor, id: string) {
    assertCan(actor, 'delete');
    const now = new Date().toISOString();
    await patch('shows', id, { deleted_at: now, ...stamp(actor) });
    await db.run(
      `UPDATE show_entries SET deleted_at = ?, sync_status = 'pending', updated_at = ? WHERE show_id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
    await markDirty();
  }

  async function saveEntry(actor: Actor, input: EntryInput, id?: string) {
    assertCan(actor, 'write');
    const current = await farm();
    const show = await one<Show>('SELECT * FROM shows WHERE id = ? AND deleted_at IS NULL', [input.showId]);
    if (!show) throw new HerdError('Choose a show.');
    const events = await many<HerdEvent>('SELECT * FROM events WHERE deleted_at IS NULL AND pig_id = ?', [input.pigId]);
    const hold = showEntryBlock(activeWithdrawals(events, input.pigId, todayISO()), show.showDate);
    if (hold.block) throw new HerdError(hold.block);
    const row: Record<string, SqlValue> = {
      show_id: input.showId,
      pig_id: input.pigId,
      exhibitor: blankToNull(input.exhibitor) || 'CG Ranch',
      class_name: blankToNull(input.className),
      target_weight_lb: input.targetWeightLb ?? show.targetWeightLb,
      ...stamp(actor, !id),
    };
    const entryId = id || uid();
    if (id) await patch('show_entries', id, row);
    else await insert('show_entries', { id: entryId, farm_id: current.id, weigh_in_lb: null, placing: null, premium_cents: null, ...row });
    await markDirty();
    return entryId;
  }

  async function deleteEntry(actor: Actor, id: string) {
    assertCan(actor, 'delete');
    await patch('show_entries', id, { deleted_at: new Date().toISOString(), ...stamp(actor) });
    await markDirty();
  }

  async function saveFoster(actor: Actor, input: FosterInput) {
    assertCan(actor, 'write');
    const current = await farm();
    if (input.fromLitterId === input.toLitterId) throw new HerdError('Choose two different litters.');
    if (!input.count || input.count <= 0) throw new HerdError('Enter how many piglets moved.');
    const from = await one<Litter>('SELECT * FROM litters WHERE id = ?', [input.fromLitterId]);
    const to = await one<Litter>('SELECT * FROM litters WHERE id = ?', [input.toLitterId]);
    if (!from || !to) throw new HerdError('Both litters have to be on the list.');
    await insert('foster_moves', {
      id: uid(),
      farm_id: current.id,
      move_date: input.moveDate || todayISO(),
      from_litter_id: from.id,
      to_litter_id: to.id,
      count: input.count,
      reason: blankToNull(input.reason),
      notes: null,
      ...stamp(actor, true),
    });
    for (const [sowId, note] of [
      [from.sowId, `Fostered ${input.count} out`],
      [to.sowId, `Fostered ${input.count} in`],
    ] as const) {
      await insert('events', {
        id: uid(),
        farm_id: current.id,
        pig_id: sowId,
        mass_event_id: null,
        event_type: 'foster',
        event_date: input.moveDate || todayISO(),
        notes: note,
        custom_name: note,
        ...stamp(actor, true),
      });
    }
    await markDirty();
  }

  async function saveLookup(
    actor: Actor,
    kind: LookupKind,
    input: { name: string; unit?: string; reorderLb?: number | null },
    id?: string,
  ) {
    assertCan(actor, 'setup');
    const current = await farm();
    const name = input.name.trim();
    if (!name) throw new HerdError('Name is required.');
    const table = LOOKUP_TABLE[kind];
    const duplicate = await db.get<{ id: string }>(
      `SELECT id FROM ${table} WHERE deleted_at IS NULL AND lower(name) = lower(?) AND id != ?`,
      [name, id || ''],
    );
    if (duplicate) throw new HerdError(`${name} is already on the list.`);
    const row: Record<string, SqlValue> = { name, ...stamp(actor, !id) };
    if (kind === 'feed') {
      row.unit = input.unit?.trim() || 'lb';
      row.reorder_lb = input.reorderLb ?? current.lowFeedLb;
    }
    const rowId = id || uid();
    if (id) await patch(table, id, row);
    else await insert(table, { id: rowId, farm_id: current.id, ...row });
    await markDirty();
    return rowId;
  }

  async function deleteLookup(actor: Actor, kind: LookupKind, id: string) {
    assertCan(actor, 'setup');
    const checks: Record<LookupKind, [string, string]> = {
      breed: ['pigs', 'breed_id'],
      group: ['pigs', 'group_id'],
      feed: ['feed_movements', 'feed_type_id'],
      income: ['transactions', 'category_id'],
      expense: ['transactions', 'category_id'],
    };
    const [table, column] = checks[kind];
    const used = await db.get<{ id: string }>(
      `SELECT id FROM ${table} WHERE ${column} = ? AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    if (used) throw new HerdError('That item is in use. Reassign those records before deleting it.');
    await patch(LOOKUP_TABLE[kind], id, { deleted_at: new Date().toISOString(), ...stamp(actor) });
    await markDirty();
  }

  async function saveContact(actor: Actor, input: { name: string; kind: string; phone: string; email: string; notes: string }, id?: string) {
    assertCan(actor, 'write');
    const current = await farm();
    if (!input.name.trim()) throw new HerdError('Name is required.');
    const row: Record<string, SqlValue> = {
      name: input.name.trim(),
      kind: input.kind || 'buyer',
      phone: blankToNull(input.phone),
      email: blankToNull(input.email),
      notes: blankToNull(input.notes),
      ...stamp(actor, !id),
    };
    const contactId = id || uid();
    if (id) await patch('contacts', id, row);
    else await insert('contacts', { id: contactId, farm_id: current.id, ...row });
    await markDirty();
    return contactId;
  }

  async function saveUser(actor: Actor, input: { name: string; email: string; role: Role; status: string }, id?: string) {
    assertCan(actor, 'roles');
    const current = await farm();
    if (!input.name.trim() || !input.email.trim()) throw new HerdError('Name and email are required.');
    if (id) {
      const users = await many<FarmUser>('SELECT * FROM farm_users WHERE deleted_at IS NULL');
      const owners = users.filter((user) => user.role === 'owner' && user.status === 'enabled' && user.id !== id);
      const currentUser = users.find((user) => user.id === id);
      const demoting = currentUser?.role === 'owner' && (input.role !== 'owner' || input.status !== 'enabled');
      if (demoting && owners.length === 0) throw new HerdError('Keep at least one enabled owner.');
    }
    const row: Record<string, SqlValue> = {
      name: input.name.trim(),
      email: input.email.trim(),
      role: input.role,
      status: input.status || 'enabled',
      ...stamp(actor, !id),
    };
    const userId = id || uid();
    if (id) await patch('farm_users', id, row);
    else await insert('farm_users', { id: userId, farm_id: current.id, ...row });
    await markDirty();
    return userId;
  }

  async function setActiveUser(userId: string) {
    await setMeta('active_user_id', userId);
  }

  async function saveFarm(
    actor: Actor,
    input: {
      name: string;
      gestationDays: number;
      weaningAgeDays: number;
      heatCycleDays: number;
      farrowingIntervalDays: number;
      lowFeedLb: number;
    },
  ) {
    assertCan(actor, 'farm_settings');
    if (!input.name.trim()) throw new HerdError('The farm needs a name.');
    if (input.gestationDays < 100 || input.gestationDays > 130) throw new HerdError('Gestation should sit between 100 and 130 days. 114 is the usual figure.');
    if (input.weaningAgeDays < 7 || input.weaningAgeDays > 56) throw new HerdError('Weaning age should be between 7 and 56 days.');
    if (input.heatCycleDays < 14 || input.heatCycleDays > 42) throw new HerdError('Heat cycle should be between 14 and 42 days.');
    const current = await farm();
    await patch('farms', current.id, {
      name: input.name.trim(),
      gestation_days: input.gestationDays,
      weaning_age_days: input.weaningAgeDays,
      heat_cycle_days: input.heatCycleDays,
      farrowing_interval_days: input.farrowingIntervalDays,
      low_feed_lb: input.lowFeedLb,
      ...stamp(actor),
    });
    await markDirty();
  }

  async function moveGroup(actor: Actor, pigIds: string[], groupId: string | null) {
    assertCan(actor, 'write');
    for (const pigId of pigIds) await patch('pigs', pigId, { group_id: groupId, ...stamp(actor) });
    await markDirty();
  }

  async function deletePig(actor: Actor, id: string) {
    assertCan(actor, 'delete');
    await patch('pigs', id, { deleted_at: new Date().toISOString(), ...stamp(actor) });
    await markDirty();
  }

  async function restore(actor: Actor, table: string, id: string) {
    assertCan(actor, 'delete');
    if (!RESTORE_TABLES.has(table)) throw new HerdError('That record cannot be restored.');
    await patch(table, id, { deleted_at: null, ...stamp(actor) });
    await markDirty();
  }

  async function resetDemo(actor: Actor, today = todayISO()) {
    assertCan(actor, 'reset_demo');
    await wipe();
    await applySeed(today);
    await db.flush();
  }

  return {
    load,
    ensureReady,
    savePig,
    deletePig,
    saveEvent,
    deleteEvent,
    saveMass,
    deleteMass,
    saveTransaction,
    deleteTransaction,
    saveFeed,
    deleteFeed,
    saveShow,
    deleteShow,
    saveEntry,
    deleteEntry,
    saveFoster,
    saveLookup,
    deleteLookup,
    saveContact,
    saveUser,
    setActiveUser,
    saveFarm,
    moveGroup,
    restore,
    resetDemo,
  };
}

export type Repo = ReturnType<typeof createRepo>;
