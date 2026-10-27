'use client';
// The ~1.8 s "analysing" beat between the Guide and a presentation cockpit.
// Fixed timeline, no network: overlay at 0.1 s, title at 0.3 s, a status line
// every 0.3 s from 0.6 s, then onDone at 1.8 s (the caller routes).
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';

const T = { title: 300, firstLine: 600, lineStep: 300, done: 1800 };

export default function TransitionOverlay({ lines, onDone }) {
  const [mounted, setMounted] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setMounted(true);
    // From here to the cockpit nothing should touch the network (see WebVitals).
    document.body.dataset.presenting = '1';
    const timers = [
      setTimeout(() => setShowTitle(true), T.title),
      ...lines.map((_, i) => setTimeout(() => setShown(i + 1), T.firstLine + i * T.lineStep)),
      setTimeout(() => onDone?.(), T.done),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: 'rgba(12,40,71,0.92)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', cursor: 'progress' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: 0.1 }}
      role="status" aria-live="polite"
    >
      <div className="w-[420px]" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <AnimatePresence>
          {showTitle && (
            <motion.div key="title" className="flex items-center gap-4 mb-6" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <motion.span className="w-9 h-9 rounded-full flex-shrink-0" style={{ border: '3px solid rgba(168,196,224,0.25)', borderTopColor: '#7DB4F0' }}
                animate={{ rotate: 360 }} transition={{ duration: 0.9, ease: 'linear', repeat: Infinity }} />
              <span style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 600 }}>Analysing client requirement</span>
            </motion.div>
          )}
        </AnimatePresence>
        <ul className="space-y-3 pl-[52px]">
          {lines.slice(0, shown).map((l) => (
            <motion.li key={l} className="flex items-center gap-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#10B981' }}>
                <Check size={13} strokeWidth={3} color="#FFFFFF" />
              </span>
              <span style={{ color: '#E2ECF8', fontSize: 15 }}>{l}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>,
    document.body,
  );
}
