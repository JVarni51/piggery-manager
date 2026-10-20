import { Gate } from '@/components/Gate';
import { PigForm } from '@/components/PigForm';
import { Card, Page } from '@/components/ui';

export default function NewPigPage() {
  return (
    <Gate title="Add pig">
      {(snap) => (
        <Page title="Add a pig" lede="Tag, parents, and a photo live in this form. Sales, deaths, and culls are events, so the reason stays attached.">
          <Card>
            <PigForm snap={snap} />
          </Card>
        </Page>
      )}
    </Gate>
  );
}
