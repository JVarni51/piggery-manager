import type { ReactNode } from 'react';

/** Native menus stay in the field. The web build portals them so they are not trapped under the list. */
export function PopMenu({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
