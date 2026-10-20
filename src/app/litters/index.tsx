import { useRouter } from 'expo-router';
import { fosterCounts, parityForFarrow, pigsOnSow, preweanMortality } from '@/domain/herd';
import { percent } from '@/domain/format';
import { toCsv } from '@/domain/csv';
import { prettyDate } from '@/domain/dates';
import { downloadText } from '@/lib/download';
import { pigLabel } from '@/lib/view';
import { Gate } from '@/components/Gate';
import { Button, Empty, Page, StackList } from '@/components/ui';

export default function LittersPage() {
  return (
    <Gate title="Litters">
      {(snap) => {
        const router = useRouter();
        const parityOfLitter = (litterId: string, sowId: string, farrowDate: string) =>
          parityForFarrow(
            snap.litters.filter((row) => row.sowId === sowId && row.id !== litterId).map((row) => row.farrowDate),
            farrowDate,
          );
        return (
          <Page
            title="Litters"
            lede="Born alive, fostering, and weaning. Mortality is (born alive − weaned + fostered in − fostered out) / born alive. Parity is the count of that sow’s recorded farrowings."
            action={
              <Button
                tone="secondary"
                label="Download CSV"
                onPress={() => {
                  void downloadText(
                    'herdkeep-litters.csv',
                    toCsv(
                      ['Litter number', 'Sow', 'Farrow date', 'Parity', 'Born alive', 'Stillborn', 'Mummified', 'Weaned', 'Wean date'],
                      snap.litters.map((litter) => [
                        litter.litterNumber,
                        pigLabel(snap.pigs.find((pig) => pig.id === litter.sowId)),
                        litter.farrowDate,
                        parityOfLitter(litter.id, litter.sowId, litter.farrowDate),
                        litter.bornAlive,
                        litter.stillborn,
                        litter.mummies,
                        litter.weanedCount,
                        litter.weanDate,
                      ]),
                    ),
                  );
                }}
              />
            }
          >
            {snap.litters.length === 0 ? <Empty title="No litters yet" body="A farrowing event opens a litter and keeps the sow’s parity with it." /> : null}
            <StackList
              rows={snap.litters.map((litter) => {
                const sow = snap.pigs.find((pig) => pig.id === litter.sowId);
                const foster = fosterCounts(litter.id, snap.fosters);
                const mortality = preweanMortality(litter, snap.fosters);
                const onSow = pigsOnSow(litter, snap.fosters);
                const parity = parityOfLitter(litter.id, litter.sowId, litter.farrowDate);
                const number = litter.litterNumber || 'No litter number';
                return {
                  key: litter.id,
                  title: `${number} · ${pigLabel(sow)}`,
                  meta: `Parity ${parity}`,
                  tone: litter.weanDate ? 'neutral' : 'info',
                  detail: `${prettyDate(litter.farrowDate)}. ${litter.weanDate ? 'Weaned' : `${onSow} on the sow`}. Born alive ${litter.bornAlive}, stillborn ${litter.stillborn}, mummified ${litter.mummies}. Foster +${foster.inn} / −${foster.out}. Weaned ${litter.weanedCount ?? '—'}. Mortality ${percent(mortality)}.`,
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
