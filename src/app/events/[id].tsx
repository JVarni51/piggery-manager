import { useLocalSearchParams, useRouter } from 'expo-router';
import { can } from '@/domain/herd';
import { prettyDate } from '@/domain/dates';
import { EVENT_LABELS, eventSummary } from '@/domain/labels';
import { oneParam, pigLabel } from '@/lib/view';
import { Gate } from '@/components/Gate';
import { EventForm, eventToInput } from '@/components/EventForm';
import { useSave } from '@/components/useSave';
import { Button, Card, Empty, Notice, Page, confirmAsync } from '@/components/ui';
import { ui } from '@/theme';
import { Text } from 'react-native';

export default function EditEventPage() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = oneParam(params.id);
  const router = useRouter();
  const { error, busy, submit } = useSave();
  return (
    <Gate title="Event">
      {(snap) => {
        const event = snap.events.find((row) => row.id === id);
        if (!event) {
          return (
            <Page title="Event">
              <Empty title="Event not found" body="It may have been deleted on this device." />
            </Page>
          );
        }
        const litter = snap.litters.find((row) => row.id === event.litterId);
        const pig = snap.pigs.find((row) => row.id === event.pigId);
        return (
          <Page
            title={EVENT_LABELS[event.eventType] || 'Event'}
            lede={`${pig ? pigLabel(pig) : 'No pig'} · ${prettyDate(event.eventDate)} · ${eventSummary(event)}`}
          >
            {error ? <Notice tone="bad" text={error} /> : null}
            <Text style={ui.small}>Updated {prettyDate(event.updatedAt.slice(0, 10))}{event.updatedBy ? ` by ${event.updatedBy}` : ''}.</Text>
            {pig ? <Button tone="ghost" label={`Open ${pigLabel(pig)}`} onPress={() => router.push(`/pigs/${pig.id}`)} /> : null}
            <Card>
              <EventForm snap={snap} initial={eventToInput(event, litter)} eventId={event.id} />
            </Card>
            {can(snap.actor.role, 'delete') ? (
              <Button
                tone="danger"
                label={busy ? 'Deleting…' : 'Delete event'}
                disabled={busy}
                onPress={() => {
                  void (async () => {
                    const ok = await confirmAsync('Delete this event?');
                    if (!ok) return;
                    const done = await submit((repo, actor) => repo.deleteEvent(actor, event.id));
                    if (done) router.replace(pig ? `/pigs/${pig.id}` : '/events');
                  })();
                }}
              />
            ) : (
              <Text style={ui.small}>Deleting an event needs a manager or the owner on this device.</Text>
            )}
          </Page>
        );
      }}
    </Gate>
  );
}
