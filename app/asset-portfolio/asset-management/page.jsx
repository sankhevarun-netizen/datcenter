'use client';
import { useRouter } from 'next/navigation';
import {
  PackageSearch,
  Send,
  Landmark,
  Repeat2,
  Building2,
  FileBarChart2,
  ClipboardCheck,
  ServerOff,
  Settings2,
  ChevronRight,
} from 'lucide-react';

const STEPS = [
  { label: 'Asset Receiving\n(GRN)',        Icon: PackageSearch,  href: '/asset-portfolio/asset-management/grn' },
  { label: 'Asset Dispatch',                Icon: Send,           href: '/asset-portfolio/asset-management/dispatch' },
  { label: 'FA Capitalization',             Icon: Landmark,       href: '/asset-portfolio/asset-management/capitalization' },
  { label: 'IMAC',                          Icon: Repeat2,        href: '/asset-portfolio/asset-management/imac' },
  { label: 'DC-to-DC\nTransfer',            Icon: Building2,      href: '/asset-portfolio/asset-management/dc-transfer' },
  { label: 'MIS & Reports',                 Icon: FileBarChart2,  href: '/asset-portfolio/asset-management/reports' },
  { label: 'Physical\nVerification (PV)',   Icon: ClipboardCheck, href: '/asset-portfolio/asset-management/pv' },
  { label: 'Decommission\n& Disposal',      Icon: ServerOff,      href: '/asset-portfolio/asset-management/decommission' },
  { label: 'Config & Admin',                Icon: Settings2,      href: '/asset-portfolio/asset-management/admin' },
];

const PHASES = [
  { label: 'Intake',      color: '#005EB8', steps: STEPS.slice(0, 3) },
  { label: 'Operations',  color: '#00B0A0', steps: STEPS.slice(3, 6) },
  { label: 'Closure',     color: '#E87722', steps: STEPS.slice(6, 9) },
];

export default function AssetLifecyclePage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2040 50%, #0a1628 100%)' }}
    >
      <div className="w-full max-w-4xl px-8 flex flex-col gap-10">
        {PHASES.map(({ label, color, steps }) => (
          <div key={label}>
            {/* Phase header */}
            <div className="flex items-center gap-3 mb-5">
              <div style={{ width: 3, height: 20, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span
                className="text-sm font-bold tracking-widest uppercase"
                style={{ color, fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
              >
                {label}
              </span>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{
                  background: `${color}18`,
                  border: `1px solid ${color}33`,
                  color: `${color}cc`,
                  fontFamily: "'Inter', 'Segoe UI', sans-serif",
                }}
              >
                {steps.length} steps
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* Cards row */}
            <div className="flex items-center gap-0">
              {steps.map(({ label: stepLabel, Icon, href }, i) => (
                <div key={stepLabel} className="flex items-center flex-1">
                  <button
                    onClick={() => router.push(href)}
                    className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl w-full"
                    style={{
                      height: 160,
                      backgroundImage: `
                        linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%),
                        repeating-linear-gradient(
                          45deg,
                          transparent, transparent 10px,
                          rgba(255,255,255,0.015) 10px,
                          rgba(255,255,255,0.015) 11px
                        )
                      `,
                      borderColor: `rgba(255,255,255,0.10)`,
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = color + '55'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'}
                  >
                    <span
                      className="absolute top-3 left-3 text-[10px] font-bold text-white/30"
                      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
                    >
                      {String(STEPS.indexOf(STEPS.find(s => s.href === href)) + 1).padStart(2, '0')}
                    </span>

                    <Icon
                      size={36}
                      strokeWidth={1.4}
                      className="text-white/75 group-hover:text-white transition-colors"
                    />

                    <span
                      className="text-white/75 group-hover:text-white text-xs font-semibold text-center leading-tight transition-colors px-3 whitespace-pre-line"
                      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
                    >
                      {stepLabel}
                    </span>
                  </button>

                  {i < steps.length - 1 && (
                    <div className="flex-shrink-0 px-1">
                      <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.2)' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
