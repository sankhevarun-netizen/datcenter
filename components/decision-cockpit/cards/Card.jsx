'use client';
import { motion } from 'framer-motion';

export const ACCENTS = {
  navy: '#00338D',
  accent: '#005EB8',
  success: '#00B0A0',
  amber: '#E87722',
  danger: '#C8102E',
};

export default function Card({ children, accent = ACCENTS.accent, onDoubleClick, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onDoubleClick={onDoubleClick}
      title="Double-click for details"
      className={`group relative bg-white rounded-2xl shadow-sm h-full flex flex-col cursor-pointer hover:shadow-md transition-shadow overflow-hidden select-none ${className}`}
      style={{ border: '1px solid #D8DCE3', borderLeft: `4px solid ${accent}` }}
    >
      {children}
      <span className="absolute top-2 right-2.5 text-[8px] text-text-muted opacity-0 group-hover:opacity-60 transition-opacity">
        ⤢ double-click
      </span>
    </motion.div>
  );
}
