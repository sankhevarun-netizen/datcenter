'use client';
import { Globe } from 'lucide-react';
import Breadcrumb from './Breadcrumb';

export default function GIIHeader({
  title = 'Global Infrastructure Intelligence',
  subtitle = 'Portfolio-level view of where our data centers are, how many we operate, and which regions carry risk',
  breadcrumb = null,
  actions = null,
}) {
  return (
    <div className="px-4 pt-4">
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#00338D]/10 flex items-center justify-center flex-shrink-0">
          <Globe size={18} className="text-[#00338D]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            {title}
          </h1>
          <p className="text-xs text-[#9CA3AF]">
            {subtitle}
          </p>
        </div>
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
    </div>
  );
}
