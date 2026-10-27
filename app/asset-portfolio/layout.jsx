'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, Building2, LayoutDashboard, Radar, Layers, Home, ExternalLink } from 'lucide-react';
import PortfolioAgentPanel from '@/components/asset-portfolio/PortfolioAgentPanel';

const TABS = [
  // { href: '/asset-portfolio/asset-management', label: 'Asset Lifecycle', Icon: Boxes },
  // { href: '/asset-portfolio/dashboards', label: 'Dashboards', Icon: LayoutDashboard },
  // { href: '/asset-portfolio/asset-drilldown', label: 'Asset Drilldown', Icon: Layers },
  { href: '/asset-portfolio/global-cockpit', label: 'Global Cockpit', Icon: Radar },
];

export default function AssetPortfolioLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-grey-border bg-white px-6 py-3 flex items-center gap-6 sticky top-0 z-30">
        <Link
          href="/"
          className="flex items-center justify-center w-7 h-7 rounded-lg text-text-secondary hover:bg-grey-bg hover:text-navy transition-colors"
          title="Home"
        >
          <Home size={14} />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-navy/10 flex items-center justify-center">
            <Building2 size={14} className="text-navy" />
          </div>
          <span className="font-extrabold text-text-primary text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            Asset Portfolio
          </span>
        </div>
        <div className="flex items-center gap-1">
          {TABS.map(({ href, label, Icon }) => {
            const active = href === '/asset-portfolio' ? pathname === href : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active ? 'bg-navy text-white' : 'text-text-secondary hover:bg-grey-bg'
                }`}
              >
                <Icon size={13} />
                {label}
              </Link>
            );
          })}
          <a
            href="https://web.eam.tecorelabs.com/PYUAPSAM/"
            target="_blank"
            rel="noopener noreferrer"
            title="Enterprise Asset Management"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-text-secondary hover:bg-grey-bg"
          >
            <ExternalLink size={13} />
            EAM
          </a>
        </div>
      </div>

      {children}

      <PortfolioAgentPanel />
    </div>
  );
}
