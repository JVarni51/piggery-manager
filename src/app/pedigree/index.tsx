import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { named, oneParam, pigLabel } from '@/lib/view';
import type { Pig, Snapshot } from '@/data/types';
import { colors, sans, ui } from '@/theme';
import { Gate } from '@/components/Gate';
import { Card, Empty, Page, Select } from '@/components/ui';

export default function PedigreePage() {
  const params = useLocalSearchParams<{ pig?: string }>();
  const pigId = oneParam(params.pig);
  return (
    <Gate title="Family tree">
      {(snap) => <Tree snap={snap} pigId={pigId || snap.pigs.find((pig) => pig.stage === 'sow')?.id || snap.pigs[0]?.id || ''} />}
    </Gate>
  );
}

function Tree({ snap, pigId }: { snap: Snapshot; pigId: string }) {
  const router = useRouter();
  const focus = snap.pigs.find((pig) => pig.id === pigId);
  if (!focus) {
    return (
      <Page title="Family tree">
        <Empty title="No pig selected" body="Open a pig and choose Family tree, or pick one below once the herd has animals." />
      </Page>
    );
  }
  const ancestors = climb(focus, snap, 3);
  const children = offspring(focus.id, snap);
  return (
    <Page title="Family tree" lede="Ancestors sit above the pig. Descendants sit below. A node opens that pig’s record.">
      <Select
        label="Pig"
        value={focus.id}
        onChange={(id) => router.replace(`/pedigree?pig=${id}`)}
        options={snap.pigs.map((pig) => ({ value: pig.id, label: pigLabel(pig) }))}
      />
      <Card>
        <Text style={ui.h2}>Ancestors</Text>
        {ancestors.length === 0 ? <Text style={ui.body}>No sire or dam is recorded for {pigLabel(focus)}.</Text> : null}
        {ancestors.map((row, index) => (
          <View key={index} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {row.map((node) => (
              <Node key={node.key} snap={snap} pig={node.pig} text={node.text} sex={node.sex} onPress={node.pig ? () => router.push(`/pigs/${node.pig?.id}`) : undefined} />
            ))}
          </View>
        ))}
      </Card>
      <Card>
        <Text style={ui.h2}>This pig</Text>
        <Node snap={snap} pig={focus} sex={focus.gender} onPress={() => router.push(`/pigs/${focus.id}`)} current />
      </Card>
      <Card>
        <Text style={ui.h2}>Descendants</Text>
        {children.length === 0 ? <Text style={ui.body}>No offspring are on the farm list.</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {children.map((child) => (
            <View key={child.id} style={{ gap: 8, maxWidth: 420 }}>
              <Node snap={snap} pig={child} sex={child.gender} onPress={() => router.push(`/pigs/${child.id}`)} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 12 }}>
                {offspring(child.id, snap).map((grand) => (
                  <Node key={grand.id} snap={snap} pig={grand} sex={grand.gender} onPress={() => router.push(`/pigs/${grand.id}`)} />
                ))}
              </View>
            </View>
          ))}
        </View>
      </Card>
    </Page>
  );
}

function climb(pig: Pig, snap: Snapshot, depth: number) {
  const layers: { key: string; pig?: Pig; text?: string; sex: 'male' | 'female' }[][] = [];
  let current = [pig];
  for (let level = 0; level < depth; level += 1) {
    const next: Pig[] = [];
    const row: { key: string; pig?: Pig; text?: string; sex: 'male' | 'female' }[] = [];
    for (const animal of current) {
      const sire = snap.pigs.find((row) => row.id === animal.sireId);
      const dam = snap.pigs.find((row) => row.id === animal.damId);
      if (sire) {
        row.push({ key: `${animal.id}-s`, pig: sire, sex: 'male' });
        next.push(sire);
      } else if (animal.sireText) {
        row.push({ key: `${animal.id}-st`, text: animal.sireText, sex: 'male' });
      }
      if (dam) {
        row.push({ key: `${animal.id}-d`, pig: dam, sex: 'female' });
        next.push(dam);
      } else if (animal.damText) {
        row.push({ key: `${animal.id}-dt`, text: animal.damText, sex: 'female' });
      }
    }
    if (!row.length) break;
    layers.unshift(row);
    current = next;
  }
  return layers;
}

function offspring(id: string, snap: Snapshot) {
  return snap.pigs.filter((pig) => pig.sireId === id || pig.damId === id);
}

function Node({
  snap,
  pig,
  text,
  sex,
  onPress,
  current,
}: {
  snap: Snapshot;
  pig?: Pig;
  text?: string;
  sex: 'male' | 'female';
  onPress?: () => void;
  current?: boolean;
}) {
  const color = sex === 'male' ? colors.male : colors.female;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={{
        minWidth: 148,
        minHeight: 72,
        padding: 12,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: current ? colors.copper : color,
        backgroundColor: current ? '#F8EFE8' : colors.card,
        gap: 2,
      }}
    >
      <Text style={{ fontFamily: sans, fontSize: 16, fontWeight: '700', color }}>{pig ? pig.tag : 'Outside'}</Text>
      <Text style={{ fontFamily: sans, fontSize: 16, color: colors.text }}>{pig?.name || text || 'Unnamed'}</Text>
      <Text style={ui.small}>{pig ? named(snap.breeds, pig.breedId) : 'Not in this herd'}</Text>
    </Pressable>
  );
}
