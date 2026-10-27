'use client';
// Moves between the global reference portfolio and the Nexus operating
// portfolio, which share this module's map and panels.
import Link from 'next/link';

const SOURCES = [
  { id: 'global', label: 'Global reference sites', href: '/global-infrastructure' },
  { id: 'nexus', label: 'Nexus portfolio', href: '/command-center/portfolio' },
];

export default function SourceSwitch({ active }) {
  return (
    <div className="flex bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg p-0.5 gap-0.5" role="tablist" aria-label="Portfolio">
      {SOURCES.map((s) => (
        <Link key={s.id} href={s.href} role="tab" aria-selected={active === s.id}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${active === s.id ? 'bg-[#00338D] text-white' : 'text-[#6B7280] hover:text-[#1A1F36]'}`}>
          {s.label}
        </Link>
      ))}
    </div>
  );
}
