import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { can, suggestCategory } from '@/domain/herd';
import { centsFromDollars, dollarsInput, parseNumber } from '@/domain/format';
import { todayISO } from '@/domain/dates';
import type { Snapshot, Transaction, TxnInput } from '@/data/types';
import { pigLabel } from '@/lib/view';
import { ui } from '@/theme';
import { Button, DateField, Field, Fields, Notice, Select } from './ui';
import { useSave } from './useSave';

const INCOME_TYPES = [
  { value: 'category', label: 'Category income' },
  { value: 'pig_sale', label: 'Pig sale' },
  { value: 'other', label: 'Other' },
];

const EXPENSE_TYPES = [
  { value: 'category', label: 'Category expense' },
  { value: 'feed_purchase', label: 'Feed purchase' },
  { value: 'other', label: 'Other' },
];

export function blankTxn(kind: 'income' | 'expense'): TxnInput {
  return {
    kind,
    txnDate: todayISO(),
    txnType: kind === 'expense' ? 'category' : 'category',
    categoryId: null,
    feedTypeId: null,
    quantity: null,
    title: '',
    amountCents: 0,
    receiptNo: '',
    notes: '',
    pigId: null,
    buyerName: '',
  };
}

export function txnToInput(txn: Transaction, buyerName = ''): TxnInput {
  return {
    kind: txn.kind,
    txnDate: txn.txnDate,
    txnType: txn.txnType,
    categoryId: txn.categoryId,
    feedTypeId: txn.feedTypeId,
    quantity: txn.quantity,
    title: txn.title,
    amountCents: txn.amountCents,
    receiptNo: txn.receiptNo || '',
    notes: txn.notes || '',
    pigId: txn.pigId,
    buyerName,
  };
}

export function TxnForm({ snap, kind, txn }: { snap: Snapshot; kind: 'income' | 'expense'; txn?: Transaction }) {
  const router = useRouter();
  const { error, busy, submit } = useSave();
  const buyer = txn?.buyerId ? snap.contacts.find((contact) => contact.id === txn.buyerId)?.name || '' : '';
  const [form, setForm] = useState<TxnInput>(txn ? txnToInput(txn, buyer) : blankTxn(kind));
  const [amount, setAmount] = useState(txn ? dollarsInput(txn.amountCents) : '');
  const [quantity, setQuantity] = useState(txn?.quantity != null ? String(txn.quantity) : '');
  const categories = kind === 'income' ? snap.incomeCategories : snap.expenseCategories;
  const suggestion = suggestCategory(`${form.title} ${form.notes}`, categories);
  const set = (patch: Partial<TxnInput>) => setForm((current) => ({ ...current, ...patch }));

  return (
    <View style={{ gap: 12 }}>
      {error ? <Notice tone="bad" text={error} /> : null}
      <Text style={ui.small}>The type can be changed after saving. A mislabeled “other” row can move onto a real category.</Text>
      <Fields>
        <DateField label="Date" value={form.txnDate} onChange={(txnDate) => set({ txnDate })} />
        <Select
          label="Type"
          value={form.txnType}
          onChange={(txnType) => set({ txnType })}
          options={kind === 'income' ? INCOME_TYPES : EXPENSE_TYPES}
        />
        <Field label="Amount (USD)" value={amount} onChange={setAmount} placeholder="0.00" />
        <Field label="Receipt number" value={form.receiptNo} onChange={(receiptNo) => set({ receiptNo })} />
      </Fields>
      {form.txnType === 'feed_purchase' ? (
        <View style={{ gap: 12 }}>
          <Notice
            tone="info"
            text="A feed purchase is one delivery: this expense and the stock addition are the same record, so the cost is not counted twice."
          />
          <Fields>
            <Select
              label="Feed"
              value={form.feedTypeId || ''}
              onChange={(feedTypeId) => set({ feedTypeId: feedTypeId || null })}
              options={snap.feedTypes.map((feed) => ({ value: feed.id, label: `${feed.name} (${feed.unit})` }))}
            />
            <Field label="Quantity (lb)" value={quantity} onChange={setQuantity} />
          </Fields>
        </View>
      ) : (
        <Fields>
          <Select
            label="Category"
            value={form.categoryId || ''}
            onChange={(categoryId) => set({ categoryId: categoryId || null })}
            options={[{ value: '', label: 'Choose' }, ...categories.map((row) => ({ value: row.id, label: row.name }))]}
          />
          <Field
            label={form.txnType === 'other' ? 'Name' : 'Description'}
            value={form.title}
            onChange={(title) => set({ title })}
            placeholder={kind === 'expense' ? 'Semen shipment' : 'Feeder pig'}
          />
        </Fields>
      )}
      {suggestion && suggestion.id !== form.categoryId && form.txnType !== 'feed_purchase' ? (
        <Button
          tone="ghost"
          label={`Use category “${suggestion.name}”`}
          onPress={() => set({ categoryId: suggestion.id, txnType: form.txnType === 'other' ? 'category' : form.txnType })}
        />
      ) : null}
      {form.txnType === 'pig_sale' ? (
        <Fields>
          <Select
            label="Pig"
            value={form.pigId || ''}
            onChange={(pigId) => set({ pigId: pigId || null })}
            options={snap.pigs.map((pig) => ({ value: pig.id, label: pigLabel(pig) }))}
          />
          <Field label="Buyer" value={form.buyerName} onChange={(buyerName) => set({ buyerName })} />
        </Fields>
      ) : null}
      <Field label="Notes" value={form.notes} onChange={(notes) => set({ notes })} multiline />
      <Button
        label={busy ? 'Saving…' : txn ? 'Save' : kind === 'income' ? 'Add income' : 'Add expense'}
        disabled={busy || !can(snap.actor.role, 'write')}
        onPress={() => {
          const next: TxnInput = {
            ...form,
            kind,
            amountCents: centsFromDollars(amount) || 0,
            quantity: parseNumber(quantity),
          };
          void submit(async (repo, actor) => {
            const id = await repo.saveTransaction(actor, next, txn?.id);
            router.replace(kind === 'income' ? `/income/${id}` : `/expenses/${id}`);
          });
        }}
      />
    </View>
  );
}
