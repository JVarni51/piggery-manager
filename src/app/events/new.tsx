import { useLocalSearchParams } from 'expo-router';
import { blankEvent, EventForm } from '@/components/EventForm';
import { Gate } from '@/components/Gate';
import { Card, Page } from '@/components/ui';
import { oneParam } from '@/lib/view';
import { todayISO } from '@/domain/dates';

export default function NewEventPage() {
  const params = useLocalSearchParams<{ pig?: string; type?: string; breeding?: string }>();
  const pig = oneParam(params.pig);
  const type = oneParam(params.type) || 'weight';
  const breeding = oneParam(params.breeding);
  return (
    <Gate title="Add event">
      {(snap) => {
        const initial = blankEvent(pig, type, todayISO());
        if (breeding) initial.breedingEventId = breeding;
        return (
          <Page title="Add an event" lede="Pick the pig, the kind of event, and the date. Breeding through weaning uses this same form.">
            <Card>
              <EventForm snap={snap} initial={initial} lockedPig={Boolean(pig)} />
            </Card>
          </Page>
        );
      }}
    </Gate>
  );
}
