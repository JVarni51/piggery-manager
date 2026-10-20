import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { can } from '@/domain/herd';
import { inRange, prettyDate, todayISO } from '@/domain/dates';
import { EVENT_LABELS } from '@/domain/labels';
import { eventSummary } from '@/domain/labels';
import { toCsv } from '@/domain/csv';
import { cleanParams, named, oneParam, pigLabel } from '@/lib/view';
import { downloadText } from '@/lib/download';
import { Gate } from '@/components/Gate';
import { useStickyAdd } from '@/components/Shell';
import { Button, Card, Chips, DateField, Empty, Fields, Page, Select, StackList, useNarrow } from '@/components/ui';
import { ui } from '@/theme';

const TYPES = ['all', 'breeding', 'pregnancy_check', 'farrowing', 'weaning', 'weight', 'treatment', 'vaccination', 'sale', 'death', 'cull'];

export default function EventsPage() {
  return (
    <Gate title="Events">
      {(snap) => <Events snap={snap} />}
    </Gate>
  );
}

function Events({ snap }: { snap: import('@/data/types').Snapshot }) {
  const router = useRouter();
  const { narrow } = useNarrow();
  const params = useLocalSearchParams<{ type?: string; pig?: string; from?: string; to?: string }>();
  const type = oneParam(params.type) || 'all';
  const pigId = oneParam(params.pig);
  const from = oneParam(params.from);
  const to = oneParam(params.to);
  const today = todayISO();
  const writable = can(snap.actor.role, 'write');
  useStickyAdd(writable ? { label: 'Add event', href: '/events/new' } : null);
  function setQuery(patch: Record<string, string | null>) {
    router.replace({ pathname: '/events', params: cleanParams(params, patch) });
  }
  const rangeError = from && to && from > to ? 'The From date has to be on or before the To date.' : '';
  const rows = useMemo(
    () =>
      snap.events.filter((event) => {
        if (type !== 'all' && event.eventType !== type) return false;
        if (pigId && event.pigId !== pigId) return false;
        if (rangeError) return false;
        if ((from || to) && !inRange(event.eventDate, from || null, to || null)) return false;
        return true;
      }),
    [snap.events, type, pigId, from, to, rangeError],
  );
  return (
    <Page
      title="Events"
      lede="Every breeding-cycle event is recorded in this list, alongside weights, treatments, and sales."
      action={
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button
            tone="secondary"
            label="Download CSV"
            onPress={() => {
              void downloadText(
                'herdkeep-events.csv',
                toCsv(
                  ['Date', 'Pig', 'Type', 'Detail'],
                  rows.map((event) => [
                    event.eventDate,
                    pigLabel(snap.pigs.find((pig) => pig.id === event.pigId)),
                    EVENT_LABELS[event.eventType] || event.eventType,
                    eventSummary(event),
                  ]),
                ),
              );
            }}
          />
          {writable && !narrow ? <Button label="Add event" onPress={() => router.push('/events/new')} /> : null}
        </View>
      }
    >
      {writable ? <Button tone="secondary" label="Group event" onPress={() => router.push('/events/group')} /> : null}
      <Chips
        value={type}
        onChange={(value) => setQuery({ type: value === 'all' ? null : value })}
        options={TYPES.map((value) => ({ value, label: value === 'all' ? 'All' : EVENT_LABELS[value] || value }))}
      />
      <Fields>
        <Select
          label="Pig"
          value={pigId}
          onChange={(value) => setQuery({ pig: value })}
          options={[{ value: '', label: 'Any pig' }, ...snap.pigs.map((pig) => ({ value: pig.id, label: pigLabel(pig) }))]}
        />
        <DateField label="From" value={from} onChange={(value) => setQuery({ from: value })} />
        <DateField label="To" value={to} onChange={(value) => setQuery({ to: value })} />
      </Fields>
      {rangeError ? <Text style={ui.small}>{rangeError}</Text> : null}
      {!from && !to ? <Text style={ui.small}>Showing every date. Today is {today}.</Text> : null}
      {rows.length === 0 ? <Empty title="No events" body="Add a breeding, weight, or treatment to start the timeline." /> : null}
      <StackList
        rows={rows.slice(0, 80).map((event) => ({
          key: event.id,
          title: `${EVENT_LABELS[event.eventType] || event.eventType} · ${pigLabel(snap.pigs.find((pig) => pig.id === event.pigId))}`,
          meta: event.massEventId ? 'Group' : prettyDate(event.eventDate),
          tone: event.eventType === 'sale' ? 'info' : event.eventType === 'death' || event.eventType === 'cull' ? 'bad' : 'neutral',
          detail: `${prettyDate(event.eventDate)} · ${eventSummary(event)}`,
          onPress: () => router.push(`/events/${event.id}`),
        }))}
      />
      <Card>
        <Text style={ui.h2}>Group events</Text>
        <Text style={ui.small}>Each group event keeps the group and the pigs that were covered that day.</Text>
        {snap.massEvents.length === 0 ? <Text style={ui.body}>No group events yet.</Text> : null}
        <StackList
          rows={snap.massEvents.map((mass) => {
            const pigs = snap.massPigs.filter((link) => link.massEventId === mass.id);
            const names = pigs
              .map((link) => pigLabel(snap.pigs.find((pig) => pig.id === link.pigId)))
              .slice(0, 6)
              .join(', ');
            return {
              key: mass.id,
              title: EVENT_LABELS[mass.eventType] || mass.eventType,
              meta: prettyDate(mass.eventDate),
              detail: `${pigs.length} pigs${mass.groupId ? ` · ${named(snap.groups, mass.groupId)}` : ''}${names ? ` · ${names}` : ''}`,
              onPress: () => router.push(`/events/group?id=${mass.id}`),
            };
          })}
        />
      </Card>
    </Page>
  );
}
