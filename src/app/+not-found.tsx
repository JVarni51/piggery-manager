import { useRouter } from 'expo-router';
import { Gate } from '@/components/Gate';
import { Button, Empty, Page } from '@/components/ui';

export default function NotFound() {
  const router = useRouter();
  return (
    <Gate title="Missing page">
      {() => (
        <Page title="That page is not in the herd book">
          <Empty title="Nothing lives at this address" body="The barn list, events, and reports are on the menu." action={<Button label="Back to today" onPress={() => router.replace('/')} />} />
        </Page>
      )}
    </Gate>
  );
}
