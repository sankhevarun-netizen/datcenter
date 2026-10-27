'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Generic breadcrumb trail — used by every depth of this module (Global ->
 * Regional -> eventually Facility) so the "zooming deeper" hierarchy stays
 * visible and each level stays a real, linkable route.
 * `items`: [{ label, href }] — the last item renders as plain text (current page).
 */
export default function Breadcrumb({ items }) {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs mb-2"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={item.label} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={11} className="text-[#9CA3AF]" />}
            {isLast || !item.href ? (
              <span className="text-[#1A1F36] font-semibold" aria-current={isLast ? 'page' : undefined}>{item.label}</span>
            ) : (
              <Link href={item.href} className="text-[#6B7280] hover:text-[#005EB8] font-medium transition-colors">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </motion.nav>
  );
}
