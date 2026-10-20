import { useRouter } from 'expo-router';
import { can } from '@/domain/herd';
import { prettyDate } from '@/domain/dates';
import { money } from '@/domain/format';
import { named, pigLabel } from '@/lib/view';
import type { Snapshot } from '@/data/types';
import { Gate } from './Gate';
import { useStickyAdd } from './Shell';
import { TxnForm } from './TxnForm';
import { useSave } from './useSave';
import { Button, Card, Empty, Notice, Page, StackList, confirmAsync } from './ui';
import { Text } from 'react-native';
import { ui } from '@/theme';

export function MoneyList({ kind }: { kind: 'income' | 'expense' }) {
  const title = kind === 'income' ? 'Income' : 'Expenses';
  const href = kind === 'income' ? '/income/new' : '/expenses/new';
  return (
    <Gate title={title}>
      {(snap) => <List snap={snap} kind={kind} title={title} href={href} />}
    </Gate>
  );
}

function List({ snap, kind, title, href }: { snap: Snapshot; kind: 'income' | 'expense'; title: string; href: string }) {
  const router = useRouter();
  const writable = can(snap.actor.role, 'write');
  useStickyAdd(writable ? { label: `Add ${kind}`, href } : null);
  const rows = snap.transactions.filter((txn) => txn.kind === kind);
  const total = rows.reduce((sum, txn) => sum + txn.amountCents, 0);
  const categories = kind === 'income' ? snap.incomeCategories : snap.expenseCategories;
  return (
    <Page
      title={title}
      lede={`${money(total)} across ${rows.length} rows. Feed purchases share one stock movement, so they are not entered again under Feed.`}
      action={writable ? <Button label={`Add ${kind}`} onPress={() => router.push(href)} /> : null}
    >
      {rows.length === 0 ? <Empty title={`No ${kind} yet`} body="Sales from the event form land here automatically." /> : null}
      <StackList
        rows={rows.map((txn) => ({
          key: txn.id,
          title: txn.title,
          meta: money(txn.amountCents),
          tone: kind === 'income' ? 'good' : 'warn',
          detail: `${prettyDate(txn.txnDate)} · ${txn.txnType.replace(/_/g, ' ')} · ${named(categories, txn.categoryId)}${txn.pigId ? ` · ${pigLabel(snap.pigs.find((pig) => pig.id === txn.pigId))}` : ''}`,
          onPress: () => router.push(kind === 'income' ? `/income/${txn.id}` : `/expenses/${txn.id}`),
        }))}
      />
    </Page>
  );
}

export function MoneyEdit({ kind, id }: { kind: 'income' | 'expense'; id?: string }) {
  const router = useRouter();
  const { error, busy, submit } = useSave();
  const title = id ? `Edit ${kind}` : kind === 'income' ? 'Add income' : 'Add expense';
  return (
    <Gate title={title}>
      {(snap) => {
        const txn = id ? snap.transactions.find((row) => row.id === id && row.kind === kind) : undefined;
        if (id && !txn) {
          return (
            <Page title={title}>
              <Empty title="Transaction not found" body="It may have been deleted with the sale or the feed delivery." />
            </Page>
          );
        }
        return (
          <Page title={title} lede="Change the type if it was filed in the wrong place. Amounts stay in dollars and cents.">
            {error ? <Notice tone="bad" text={error} /> : null}
            <Card>
              <TxnForm snap={snap} kind={kind} txn={txn} />
            </Card>
            {txn && can(snap.actor.role, 'delete') ? (
              <Button
                tone="danger"
                label={busy ? 'Deleting…' : 'Delete'}
                disabled={busy}
                onPress={() => {
                  void (async () => {
                    const ok = await confirmAsync('Delete this transaction? A linked feed delivery is removed with it.');
                    if (!ok) return;
                    const done = await submit((repo, actor) => repo.deleteTransaction(actor, txn.id));
                    if (done) router.replace(kind === 'income' ? '/income' : '/expenses');
                  })();
                }}
              />
            ) : null}
            {txn?.feedMoveId ? <Text style={ui.small}>This row is tied to a feed delivery. Editing the quantity updates that stock movement.</Text> : null}
          </Page>
        );
      }}
    </Gate>
  );
}
