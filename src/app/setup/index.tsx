import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { can } from '@/domain/herd';
import { parseNumber } from '@/domain/format';
import { prettyDate } from '@/domain/dates';
import type { LookupKind, Snapshot } from '@/data/types';
import { ui } from '@/theme';
import { Gate } from '@/components/Gate';
import { useSave } from '@/components/useSave';
import { Button, Card, Field, Fields, Notice, Page, confirmAsync } from '@/components/ui';

export default function SetupPage() {
  return (
    <Gate title="Farm setup">
      {(snap) => <Setup snap={snap} />}
    </Gate>
  );
}

function Setup({ snap }: { snap: Snapshot }) {
  const { error, busy, submit } = useSave();
  const manager = can(snap.actor.role, 'setup');
  const settings = can(snap.actor.role, 'farm_settings');
  const [farmName, setFarmName] = useState(snap.farm.name);
  const [gestation, setGestation] = useState(String(snap.farm.gestationDays));
  const [wean, setWean] = useState(String(snap.farm.weaningAgeDays));
  const [heat, setHeat] = useState(String(snap.farm.heatCycleDays));
  const [interval, setInterval] = useState(String(snap.farm.farrowingIntervalDays));
  const [low, setLow] = useState(String(snap.farm.lowFeedLb));

  return (
    <Page title="Farm setup" lede={`${snap.farm.name}. Lists and barn timing live here. Roles for this device are under This device.`}>
      {error ? <Notice tone="bad" text={error} /> : null}
      {!manager ? <Notice tone="warn" text="Data entry can use the herd book but cannot change setup lists." /> : null}
      <Card>
        <Text style={ui.h2}>Barn timing</Text>
        <Text style={ui.small}>Gestation 100–130 days (114 is the usual figure). Weaning age 7–56. Heat cycle 14–42. Open breedings recalculate their expected farrow from the gestation you save.</Text>
        <Fields>
          <Field label="Farm name" value={farmName} onChange={setFarmName} />
          <Field label="Gestation days" value={gestation} onChange={setGestation} />
          <Field label="Weaning age (days)" value={wean} onChange={setWean} />
          <Field label="Heat cycle (days)" value={heat} onChange={setHeat} />
          <Field label="Farrowing interval (days)" value={interval} onChange={setInterval} />
          <Field label="Default low-feed line (lb)" value={low} onChange={setLow} />
        </Fields>
        <Button
          label={busy ? 'Saving…' : 'Save farm'}
          disabled={busy || !settings}
          onPress={() => {
            void submit((repo, actor) =>
              repo.saveFarm(actor, {
                name: farmName,
                gestationDays: parseNumber(gestation) || 0,
                weaningAgeDays: parseNumber(wean) || 0,
                heatCycleDays: parseNumber(heat) || 0,
                farrowingIntervalDays: parseNumber(interval) || 0,
                lowFeedLb: parseNumber(low) || 0,
              }),
            );
          }}
        />
      </Card>
      <Lookup snap={snap} kind="breed" title="Breeds" />
      <Lookup snap={snap} kind="group" title="Groups" />
      <FeedLookups snap={snap} />
      <Lookup snap={snap} kind="income" title="Income categories" />
      <Lookup snap={snap} kind="expense" title="Expense categories" />
      <Card>
        <Text style={ui.h2}>Removed on this device</Text>
        {snap.removed.length === 0 ? <Text style={ui.body}>Nothing is waiting to be restored.</Text> : null}
        {snap.removed.map((row) => (
          <ViewLine key={`${row.table}-${row.id}`}>
            <Text style={ui.body}>{row.label}</Text>
            <Text style={ui.small}>{row.table} · {prettyDate(row.deletedAt.slice(0, 10))}</Text>
            {can(snap.actor.role, 'delete') ? (
              <Button tone="ghost" label="Restore" onPress={() => void submit((repo, actor) => repo.restore(actor, row.table, row.id))} />
            ) : null}
          </ViewLine>
        ))}
      </Card>
    </Page>
  );
}

function Lookup({ snap, kind, title }: { snap: Snapshot; kind: LookupKind; title: string }) {
  const rows = kind === 'breed' ? snap.breeds : kind === 'group' ? snap.groups : kind === 'income' ? snap.incomeCategories : snap.expenseCategories;
  const { error, busy, submit } = useSave();
  const [name, setName] = useState('');
  const allowed = can(snap.actor.role, 'setup');
  return (
    <Card>
      <Text style={ui.h2}>{title}</Text>
      {error ? <Notice tone="bad" text={error} /> : null}
      {rows.map((row) => (
        <ViewLine key={row.id}>
          <Text style={ui.body}>{row.name}</Text>
          {allowed ? (
            <Button
              tone="ghost"
              label="Delete"
              disabled={busy}
              onPress={() => {
                void (async () => {
                  const ok = await confirmAsync(`Delete ${row.name}? In-use items stay put.`);
                  if (!ok) return;
                  await submit((repo, actor) => repo.deleteLookup(actor, kind, row.id));
                })();
              }}
            />
          ) : null}
        </ViewLine>
      ))}
      {allowed ? (
        <Fields>
          <Field label={`New ${title.toLowerCase().replace(/s$/, '')}`} value={name} onChange={setName} />
          <Button
            label="Add"
            disabled={busy || !name.trim()}
            onPress={() => {
              void submit(async (repo, actor) => {
                await repo.saveLookup(actor, kind, { name });
                setName('');
              });
            }}
          />
        </Fields>
      ) : null}
    </Card>
  );
}

function FeedLookups({ snap }: { snap: Snapshot }) {
  const { error, busy, submit } = useSave();
  const [name, setName] = useState('');
  const [reorder, setReorder] = useState(String(snap.farm.lowFeedLb));
  const allowed = can(snap.actor.role, 'setup');
  return (
    <Card>
      <Text style={ui.h2}>Feed types</Text>
      <Text style={ui.small}>Quantities are pounds. The reorder line flags the dashboard when stock falls under it.</Text>
      {error ? <Notice tone="bad" text={error} /> : null}
      {snap.feedTypes.map((feed) => (
        <ViewLine key={feed.id}>
          <Text style={ui.body}>{feed.name}</Text>
          <Text style={ui.small}>{feed.unit} · reorder {feed.reorderLb}</Text>
          {allowed ? (
            <Button tone="ghost" label="Delete" onPress={() => void submit((repo, actor) => repo.deleteLookup(actor, 'feed', feed.id))} />
          ) : null}
        </ViewLine>
      ))}
      {allowed ? (
        <Fields>
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Reorder at (lb)" value={reorder} onChange={setReorder} />
          <Button
            label="Add feed"
            disabled={busy || !name.trim()}
            onPress={() => {
              void submit(async (repo, actor) => {
                await repo.saveLookup(actor, 'feed', { name, unit: 'lb', reorderLb: parseNumber(reorder) });
                setName('');
              });
            }}
          />
        </Fields>
      ) : null}
    </Card>
  );
}

function ViewLine({ children }: { children: ReactNode }) {
  return <View style={{ gap: 4, paddingVertical: 6 }}>{children}</View>;
}
