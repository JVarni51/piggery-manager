import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { can } from '@/domain/herd';
import { prettyDate } from '@/domain/dates';
import { EVENT_LABELS } from '@/domain/labels';
import { eventSummary } from '@/domain/labels';
import { named, pigLabel } from '@/lib/view';
import { Gate } from '@/components/Gate';
import { useStickyAdd } from '@/components/Shell';
import { Button, Card, Chips, Empty, Page, StackList } from '@/components/ui';
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
  const [type, setType] = useState('all');
  const writable = can(snap.actor.role, 'write');
  useStickyAdd(writable ? { label: 'Add event', href: '/events/new' } : null);
  const rows = useMemo(
    () => snap.events.filter((event) => type === 'all' || event.eventType === type),
    [snap.events, type],
  );
  return (
    <Page
      title="Events"
      lede="Every breeding-cycle event is recorded in this list, alongside weights, treatments, and sales."
      action={
        writable ? (
          <Button label="Add event" onPress={() => router.push('/events/new')} />
        ) : null
      }
    >
      {writable ? <Button tone="secondary" label="Group event" onPress={() => router.push('/events/group')} /> : null}
      <Chips
        value={type}
        onChange={setType}
        options={TYPES.map((value) => ({ value, label: value === 'all' ? 'All' : EVENT_LABELS[value] || value }))}
      />
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
