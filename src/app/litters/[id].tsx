import { useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { can, fosterCounts, pigsOnSow, preweanMortality } from '@/domain/herd';
import { percent, pounds, parseNumber } from '@/domain/format';
import { prettyDate, todayISO } from '@/domain/dates';
import { oneParam, pigLabel } from '@/lib/view';
import { ui } from '@/theme';
import { Gate } from '@/components/Gate';
import { useSave } from '@/components/useSave';
import { Button, Card, Empty, Field, Fields, Notice, Page, Select, StackList } from '@/components/ui';

export default function LitterPage() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = oneParam(params.id);
  return (
    <Gate title="Litter">
      {(snap) => {
        const litter = snap.litters.find((row) => row.id === id);
        if (!litter) {
          return (
            <Page title="Litter">
              <Empty title="Litter not found" body="It may have been removed with its farrowing event." />
            </Page>
          );
        }
        return <LitterDetail id={litter.id} />;
      }}
    </Gate>
  );
}

function LitterDetail({ id }: { id: string }) {
  const router = useRouter();
  const { error, busy, submit } = useSave();
  const [toLitter, setToLitter] = useState('');
  const [count, setCount] = useState('1');
  const [reason, setReason] = useState('');
  return (
    <Gate title="Litter">
      {(snap) => {
        const litter = snap.litters.find((row) => row.id === id);
        if (!litter) return null;
        const sow = snap.pigs.find((pig) => pig.id === litter.sowId);
        const sire = snap.pigs.find((pig) => pig.id === litter.sireId);
        const foster = fosterCounts(litter.id, snap.fosters);
        const piglets = snap.pigs.filter((pig) => pig.litterId === litter.id);
        const moves = snap.fosters.filter((move) => move.fromLitterId === litter.id || move.toLitterId === litter.id);
        return (
          <Page title={`${pigLabel(sow)} litter`} lede={`Farrowed ${prettyDate(litter.farrowDate)}. Parity ${litter.parity ?? '—'}.`}>
            {error ? <Notice tone="bad" text={error} /> : null}
            <Card>
              <Text style={ui.body}>Born alive {litter.bornAlive}. Stillborn {litter.stillborn}. Mummies {litter.mummies}.</Text>
              <Text style={ui.body}>Fostered in {foster.inn}, out {foster.out}. On the sow now: {pigsOnSow(litter, snap.fosters)}.</Text>
              <Text style={ui.body}>Weaned {litter.weanedCount ?? '—'} on {prettyDate(litter.weanDate)}. Pre-wean mortality {percent(preweanMortality(litter, snap.fosters))}.</Text>
              <Text style={ui.small}>Birth weight {pounds(litter.birthWeightLb)} · wean weight {pounds(litter.weanWeightLb)}</Text>
              {sire ? <Button tone="ghost" label={`Sire ${pigLabel(sire)}`} onPress={() => router.push(`/pigs/${sire.id}`)} /> : null}
              {sow ? <Button tone="ghost" label={`Sow ${pigLabel(sow)}`} onPress={() => router.push(`/pigs/${sow.id}`)} /> : null}
              {!litter.weanDate && sow ? (
                <Button label="Record weaning" onPress={() => router.push(`/events/new?pig=${sow.id}&type=weaning`)} />
              ) : null}
            </Card>
            <Card>
              <Text style={ui.h2}>Piglets on this litter</Text>
              {piglets.length === 0 ? <Text style={ui.body}>No individual piglets are linked yet. The litter counts still stand.</Text> : null}
              <StackList
                rows={piglets.map((pig) => ({
                  key: pig.id,
                  title: pigLabel(pig),
                  meta: pig.status,
                  detail: pig.stage,
                  onPress: () => router.push(`/pigs/${pig.id}`),
                }))}
              />
            </Card>
            <Card>
              <Text style={ui.h2}>Foster</Text>
              <Text style={ui.small}>Moving piglets writes a foster event on both sows.</Text>
              <Fields>
                <Select
                  label="To litter"
                  value={toLitter}
                  onChange={setToLitter}
                  options={snap.litters.filter((row) => row.id !== litter.id).map((row) => ({
                    value: row.id,
                    label: `${pigLabel(snap.pigs.find((pig) => pig.id === row.sowId))} · ${prettyDate(row.farrowDate)}`,
                  }))}
                />
                <Field label="How many" value={count} onChange={setCount} />
                <Field label="Reason" value={reason} onChange={setReason} placeholder="Sow short of milk" />
              </Fields>
              <Button
                label={busy ? 'Saving…' : 'Move piglets'}
                disabled={busy || !can(snap.actor.role, 'write')}
                onPress={() => {
                  void submit((repo, actor) =>
                    repo.saveFoster(actor, {
                      moveDate: todayISO(),
                      fromLitterId: litter.id,
                      toLitterId: toLitter,
                      count: parseNumber(count) || 0,
                      reason,
                    }),
                  );
                }}
              />
              <StackList
                rows={moves.map((move) => ({
                  key: move.id,
                  title: move.fromLitterId === litter.id ? `Out ${move.count}` : `In ${move.count}`,
                  meta: prettyDate(move.moveDate),
                  detail: move.reason || move.notes || '',
                }))}
              />
            </Card>
          </Page>
        );
      }}
    </Gate>
  );
}
