import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Actor } from './types';
import type { Snapshot } from './types';
import { openHerdDatabase } from './open';
import { createRepo, HerdError, type Repo } from './repo';

type HerdValue = {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  snap: Snapshot | null;
  refresh: () => Promise<void>;
  run: (work: (repo: Repo, actor: Actor) => Promise<unknown>) => Promise<void>;
};

const HerdContext = createContext<HerdValue | null>(null);

let session: Promise<{ repo: Repo; snap: Snapshot }> | null = null;

function boot() {
  if (!session) {
    session = (async () => {
      const database = await openHerdDatabase();
      const repo = createRepo(database);
      const snap = await repo.ensureReady();
      return { repo, snap };
    })();
  }
  return session;
}

export function resetSession() {
  session = null;
}

export function HerdProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [repo, setRepo] = useState<Repo | null>(null);

  useEffect(() => {
    let alive = true;
    boot()
      .then((opened) => {
        if (!alive) return;
        setRepo(opened.repo);
        setSnap(opened.snap);
      })
      .catch((reason: unknown) => {
        if (!alive) return;
        setError(reason instanceof Error ? reason.message : 'The herd book did not open.');
      });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<HerdValue>(() => {
    return {
      status: error ? 'error' : snap ? 'ready' : 'loading',
      error,
      snap,
      refresh: async () => {
        if (!repo) return;
        setSnap(await repo.load());
      },
      run: async (work) => {
        if (!repo || !snap) return;
        try {
          await work(repo, snap.actor);
          setSnap(await repo.load());
        } catch (reason) {
          if (reason instanceof HerdError) throw reason;
          throw new HerdError(reason instanceof Error ? reason.message : 'That did not save.');
        }
      },
    };
  }, [error, repo, snap]);

  return <HerdContext.Provider value={value}>{children}</HerdContext.Provider>;
}

export function useHerd() {
  const value = useContext(HerdContext);
  if (!value) throw new Error('useHerd must be used inside HerdProvider');
  return value;
}
