import { useLocalSearchParams } from 'expo-router';
import { Gate } from '@/components/Gate';
import { PigForm } from '@/components/PigForm';
import { Card, Empty, Page } from '@/components/ui';
import { oneParam, pigLabel } from '@/lib/view';

export default function EditPigPage() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = oneParam(params.id);
  return (
    <Gate title="Edit pig">
      {(snap) => {
        const pig = snap.pigs.find((row) => row.id === id);
        if (!pig) {
          return (
            <Page title="Edit pig">
              <Empty title="Pig not found" body="This edit link does not match a pig on the device." />
            </Page>
          );
        }
        return (
          <Page title={`Edit ${pigLabel(pig)}`} lede="The tag can be changed here. Sold, dead, and culled stay tied to their events.">
            <Card>
              <PigForm snap={snap} pig={pig} />
            </Card>
          </Page>
        );
      }}
    </Gate>
  );
}
