'use client';
// Client-side role context: fetched once from /api/me. Until it arrives the
// UI assumes the least-privileged role, so commercial figures never flash.
import { createContext, useContext, useEffect, useState } from 'react';
import { can } from '@/lib/auth/roles';

const RoleContext = createContext({ role: 'operator', user: null, ready: false, can: (p) => can('operator', p) });

export function RoleProvider({ children }) {
  const [state, setState] = useState({ role: 'operator', user: null, ready: false });
  useEffect(() => {
    let alive = true;
    fetch('/api/me').then((r) => r.json()).then((d) => {
      if (alive) setState({ role: d.role ?? 'operator', user: d.user, ready: true });
    }).catch(() => { if (alive) setState((s) => ({ ...s, ready: true })); });
    return () => { alive = false; };
  }, []);
  return <RoleContext.Provider value={{ ...state, can: (p) => can(state.role, p) }}>{children}</RoleContext.Provider>;
}

export const useRole = () => useContext(RoleContext);
