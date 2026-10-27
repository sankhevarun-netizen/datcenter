'use client';
import { motion } from 'framer-motion';
import { C, enter } from './tokens';

/** White panel with the blue leading edge, title and an inert "View Details" link. */
export default function Panel({ title, icon: Icon, action = 'View Details', onAction, delay = 0, className = '', children }) {
  return (
    <motion.section
      {...enter(delay)}
      className={`relative bg-white rounded-xl flex flex-col min-w-0 min-h-0 ${className}`}
      style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.blue}`, boxShadow: '0 1px 3px rgba(15,45,82,0.06)', padding: '16px 20px' }}
    >
      <header className="flex items-center justify-between gap-3 mb-2 flex-shrink-0">
        <h2 className="flex items-center gap-2" style={{ fontSize: 17, fontWeight: 700, color: C.text }}>
          {Icon && <Icon size={18} strokeWidth={2} style={{ color: C.navyBlue }} />}
          {title}
        </h2>
        {action && (onAction
          ? <button type="button" onClick={onAction} className="whitespace-nowrap hover:underline" style={{ fontSize: 12, fontWeight: 500, color: C.blue }}>{action} →</button>
          : <span className="whitespace-nowrap" style={{ fontSize: 12, fontWeight: 500, color: C.blue }}>{action}</span>)}
      </header>
      {children}
    </motion.section>
  );
}
