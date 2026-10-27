'use client';
// usePersistentState(key, initial): like useState, but saved per user on the
// server (/api/state) so it survives closing the browser. Loads once, writes
// debounced. If the server is unreachable it behaves as plain state.
import { useCallback, useEffect, useRef, useState } from 'react';

export function usePersistentState(key, initial) {
  const [value, setValue] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/state?key=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.value != null) setValue(d.value); })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [key]);

  const update = useCallback((next) => {
    setValue((prev) => {
      const v = typeof next === 'function' ? next(prev) : next;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value: v }) }).catch(() => {});
      }, 400);
      return v;
    });
  }, [key]);

  return [value, update, loaded];
}
