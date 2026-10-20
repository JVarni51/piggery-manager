import { useCallback, useState } from 'react';
import { useHerd } from '@/data/context';
import type { Actor } from '@/data/types';
import type { Repo } from '@/data/repo';

export function useSave() {
  const { run } = useHerd();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (work: (repo: Repo, actor: Actor) => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await run(work);
        return true;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'That did not save.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [run],
  );

  return { error, busy, submit, setError };
}
