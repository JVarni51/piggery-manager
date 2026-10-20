import { useRouter } from 'expo-router';
import { fosterCounts, pigsOnSow, preweanMortality } from '@/domain/herd';
import { percent } from '@/domain/format';
import { prettyDate } from '@/domain/dates';
import { pigLabel } from '@/lib/view';
import { Gate } from '@/components/Gate';
import { Empty, Page, StackList } from '@/components/ui';

export default function LittersPage() {
  return (
    <Gate title="Litters">
      {(snap) => {
        const router = useRouter();
        return (
          <Page title="Litters" lede="Born alive, fostering, and weaning. Mortality is (born alive − weaned + fostered in − fostered out) / born alive.">
            {snap.litters.length === 0 ? <Empty title="No litters yet" body="A farrowing event opens a litter and keeps the sow’s parity with it." /> : null}
            <StackList
              rows={snap.litters.map((litter) => {
                const sow = snap.pigs.find((pig) => pig.id === litter.sowId);
                const foster = fosterCounts(litter.id, snap.fosters);
                const mortality = preweanMortality(litter, snap.fosters);
                const onSow = pigsOnSow(litter, snap.fosters);
                return {
                  key: litter.id,
                  title: `${pigLabel(sow)} · ${prettyDate(litter.farrowDate)}`,
                  meta: litter.weanDate ? 'Weaned' : `${onSow} on the sow`,
                  tone: litter.weanDate ? 'neutral' : 'info',
                  detail: `Born alive ${litter.bornAlive}, stillborn ${litter.stillborn}, mummies ${litter.mummies}. Foster +${foster.inn} / −${foster.out}. Weaned ${litter.weanedCount ?? '—'}. Mortality ${percent(mortality)}.`,
                  onPress: () => router.push(`/litters/${litter.id}`),
                };
              })}
            />
          </Page>
        );
      }}
    </Gate>
  );
}
