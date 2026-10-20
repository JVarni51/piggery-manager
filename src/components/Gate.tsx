import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { useHerd } from '@/data/context';
import type { Snapshot } from '@/data/types';
import { ui } from '@/theme';
import { Notice, Page } from './ui';

export function Gate({ title, children }: { title: string; children: (snap: Snapshot) => ReactNode }) {
  const { status, error, snap } = useHerd();
  if (status === 'error') {
    return (
      <Page title={title}>
        <Notice tone="bad" text={error || 'The herd book did not open on this device.'} />
      </Page>
    );
  }
  if (!snap) {
    return (
      <Page title="Herdkeep" lede="Opening the barn book stored on this device.">
        <Text style={ui.body}>Loading sows, show pigs, and the feed room…</Text>
      </Page>
    );
  }
  return <>{children(snap)}</>;
}
