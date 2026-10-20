import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { can } from '@/domain/herd';
import { prettyDate, todayISO } from '@/domain/dates';
import { adgLabel, pounds } from '@/domain/format';
import { EVENT_LABELS, STAGE_LABELS, STATUS_LABELS } from '@/domain/labels';
import { eventSummary } from '@/domain/labels';
import { ageLabel, named, oneParam, pigLabel, pigSummary } from '@/lib/view';
import { colors, sans, ui } from '@/theme';
import { Gate } from '@/components/Gate';
import { useSave } from '@/components/useSave';
import { confirmAsync, Badge, Button, Card, Chips, Empty, Notice, Page } from '@/components/ui';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'breeding', label: 'Breeding' },
  { value: 'pregnancy_check', label: 'Pregnancy' },
  { value: 'farrowing', label: 'Farrowing' },
  { value: 'weaning', label: 'Weaning' },
  { value: 'weight', label: 'Weights' },
  { value: 'health', label: 'Health' },
  { value: 'exit', label: 'Sale & loss' },
];

function matches(type: string, filter: string) {
  if (filter === 'all') return true;
  if (filter === 'health') return ['treatment', 'vaccination', 'deworming'].includes(type);
  if (filter === 'exit') return ['sale', 'death', 'cull'].includes(type);
  return type === filter;
}

export default function PigDetailPage() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = oneParam(params.id);
  return (
    <Gate title="Pig">
      {(snap) => {
        const pig = snap.pigs.find((row) => row.id === id);
        if (!pig) {
          return (
            <Page title="Pig not on the list">
              <Empty title="That pig is gone" body="It may have been removed from this device. Restore it from Farm setup if it is still in the removed list." />
            </Page>
          );
        }
        return <Detail pigId={pig.id} />;
      }}
    </Gate>
  );
}

function Detail({ pigId }: { pigId: string }) {
  const router = useRouter();
  const { error, busy, submit } = useSave();
  const [tab, setTab] = useState<'record' | 'events'>('record');
  const [filter, setFilter] = useState('all');
  return (
    <Gate title="Pig">
      {(snap) => {
        const pig = snap.pigs.find((row) => row.id === pigId);
        if (!pig) return null;
        const summary = pigSummary(snap, pig);
        const canDelete = can(snap.actor.role, 'delete');
        const events = snap.events.filter((event) => event.pigId === pig.id && matches(event.eventType, filter));
        const sire = snap.pigs.find((row) => row.id === pig.sireId);
        const dam = snap.pigs.find((row) => row.id === pig.damId);
        const kids = snap.pigs.filter((row) => row.sireId === pig.id || row.damId === pig.id);
        return (
          <Page
            title={pigLabel(pig)}
            lede={`${STAGE_LABELS[pig.stage]} · ${ageLabel(pig.dob)} · ${named(snap.breeds, pig.breedId)}`}
            action={<Button label="Edit" tone="secondary" onPress={() => router.push(`/pigs/${pig.id}/edit`)} />}
          >
            {error ? <Notice tone="bad" text={error} /> : null}
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              {pig.photoUri ? (
                <Image source={{ uri: pig.photoUri }} style={{ width: 72, height: 72, borderRadius: 36 }} />
              ) : (
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: pig.gender === 'male' ? colors.male : colors.female, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.white, fontSize: 28, fontFamily: sans }}>{(pig.name || pig.tag).slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Badge label={STATUS_LABELS[pig.status] || pig.status} tone={pig.status === 'active' ? 'good' : 'warn'} />
                  <Badge label={pig.gender === 'female' ? 'Female' : 'Male'} tone="info" />
                  {summary.holds[0] ? <Badge label={`Hold until ${summary.holds[0].ends}`} tone="bad" /> : null}
                </View>
                <Text style={ui.small}>Updated {prettyDate(pig.updatedAt.slice(0, 10))}{pig.updatedBy ? ` by ${pig.updatedBy}` : ''}.</Text>
              </View>
            </View>
            <Card>
              <Text style={ui.h2}>Where this pig stands</Text>
              <Line k="Status" v={STATUS_LABELS[pig.status] || pig.status} />
              <Line k="Expected farrow" v={summary.breeding ? prettyDate(summary.breeding.due) : 'Not gestating'} />
              <Line k="Parity" v={String(summary.parity)} />
              <Line k="Last weight" v={summary.lastWeight ? `${pounds(summary.lastWeight.lb, 1)} on ${prettyDate(summary.lastWeight.date)}` : pounds(pig.weightLb, 1)} />
              <Line k="Recent gain" v={adgLabel(summary.adg)} />
              {summary.holds[0] ? <Line k="Withdrawal" v={`${summary.holds[0].drug} clears ${prettyDate(summary.holds[0].ends)}`} /> : null}
            </Card>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => setTab('record')} style={tabBtn(tab === 'record')}><Text style={tabText(tab === 'record')}>Record</Text></Pressable>
              <Pressable onPress={() => setTab('events')} style={tabBtn(tab === 'events')}><Text style={tabText(tab === 'events')}>Events</Text></Pressable>
            </View>
            {tab === 'record' ? (
              <Card>
                <Line k="Group" v={named(snap.groups, pig.groupId)} />
                <Line k="Born" v={prettyDate(pig.dob)} />
                <Line k="Entered" v={prettyDate(pig.entryDate)} />
                <Line k="Source" v={pig.sourceDetail || pig.source} />
                <Line k="Ear notch" v={pig.earNotch || '—'} />
                <Line k="Show tag" v={pig.showTag || '—'} />
                <Line k="Registration" v={pig.registrationNo || '—'} />
                <Text style={[ui.label, { marginTop: 8 }]}>Sire</Text>
                {sire ? <Button tone="ghost" label={pigLabel(sire)} onPress={() => router.push(`/pigs/${sire.id}`)} /> : <Text style={ui.body}>{pig.sireText || 'Not recorded'}</Text>}
                <Text style={ui.label}>Dam</Text>
                {dam ? <Button tone="ghost" label={pigLabel(dam)} onPress={() => router.push(`/pigs/${dam.id}`)} /> : <Text style={ui.body}>{pig.damText || 'Not recorded'}</Text>}
                <Text style={ui.label}>Offspring on the farm</Text>
                {kids.length === 0 ? <Text style={ui.body}>None recorded here.</Text> : kids.map((kid) => (
                  <Button key={kid.id} tone="ghost" label={pigLabel(kid)} onPress={() => router.push(`/pigs/${kid.id}`)} />
                ))}
                {pig.notes ? <Text style={ui.body}>{pig.notes}</Text> : null}
                <Button label="Family tree" tone="secondary" onPress={() => router.push(`/pedigree?pig=${pig.id}`)} />
                <Button label="Add event" onPress={() => router.push(`/events/new?pig=${pig.id}`)} />
                {canDelete ? (
                  <View style={{ marginTop: 12 }}>
                    <Button
                      tone="danger"
                      label={busy ? 'Removing…' : 'Remove from herd list'}
                      disabled={busy}
                      onPress={() => {
                        void (async () => {
                          const ok = await confirmAsync(`Remove ${pigLabel(pig)} from the herd list? The record can be restored later.`);
                          if (!ok) return;
                          const done = await submit((repo, actor) => repo.deletePig(actor, pig.id));
                          if (done) router.replace('/pigs');
                        })();
                      }}
                    />
                  </View>
                ) : (
                  <Text style={ui.small}>Data entry can add and edit. Removing a pig needs a manager or the owner, on this device.</Text>
                )}
              </Card>
            ) : (
              <View style={{ gap: 10 }}>
                <Button label="Add event" onPress={() => router.push(`/events/new?pig=${pig.id}`)} />
                <Chips options={FILTERS} value={filter} onChange={setFilter} />
                {events.length === 0 ? <Empty title="No events of this kind" body="Breeding, weights, treatments, and sales for this pig show up in this list." /> : null}
                {events.map((event) => (
                  <Card key={event.id}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontFamily: sans, fontWeight: '700', fontSize: 16 }}>{EVENT_LABELS[event.eventType] || event.eventType}</Text>
                        <Text style={ui.small}>{prettyDate(event.eventDate)} · {eventSummary(event)}</Text>
                        <Text style={ui.small}>Updated {prettyDate(event.updatedAt.slice(0, 10))}{event.updatedBy ? ` by ${event.updatedBy}` : ''}.</Text>
                      </View>
                      <Button tone="secondary" label="Edit" onPress={() => router.push(`/events/${event.id}`)} />
                    </View>
                    {canDelete ? (
                      <Button
                        tone="ghost"
                        label="Delete event"
                        onPress={() => {
                          void (async () => {
                            const ok = await confirmAsync('Delete this event? A sale, death, or cull will reopen the pig if nothing else closed it.');
                            if (!ok) return;
                            await submit((repo, actor) => repo.deleteEvent(actor, event.id));
                          })();
                        }}
                      />
                    ) : null}
                  </Card>
                ))}
              </View>
            )}
            <Text style={ui.small}>Today is {todayISO()}.</Text>
          </Page>
        );
      }}
    </Gate>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, minHeight: 28 }}>
      <Text style={ui.small}>{k}</Text>
      <Text style={{ fontFamily: sans, fontSize: 15, color: colors.text, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );
}

function tabBtn(on: boolean) {
  return {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center' as const,
    backgroundColor: on ? colors.ink : colors.card,
    borderWidth: 1,
    borderColor: on ? colors.ink : colors.line,
  };
}

function tabText(on: boolean) {
  return { color: on ? colors.white : colors.text, fontFamily: sans, fontWeight: '700' as const, fontSize: 16 };
}
