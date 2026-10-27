'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LENSES } from '@/lib/platform-registry';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Building2, Server, Cpu, Users, Leaf, Brain,
  AlertTriangle, Wrench, FileText, Settings, Bell, ChevronLeft,
  ChevronRight, Search, Sparkles, Layers, Home,
  Package, Shield, Plug, Globe, Gauge, Radar, Droplets, ShieldAlert, FileCheck2, Map, Network, Scale, SunMedium, Shuffle,
} from 'lucide-react';
import AICopilotPanel from './AICopilotPanel';

// Lens names and routes come from the platform registry, shared with AI Stack and Services.
const lensOf = (id) => LENSES.find((l) => l.id === id);

const NAV_GROUPS = [
  {
    label: 'Core',
    items: [
      { id: 'command-center', label: 'Command Center', icon: LayoutDashboard, href: '/command-center' },
      { id: 'global-infrastructure', label: 'Global Infrastructure Intelligence', icon: Globe, href: '/global-infrastructure' },
      { id: 'nexus-portfolio', label: 'Nexus Portfolio', icon: Map, href: '/command-center/portfolio' },
      { id: 'portfolio',      label: 'Portfolio Explorer', icon: Building2,      href: '/portfolio' },
      { id: 'datacenters',    label: 'Datacenters',        icon: Server,          href: '/datacenters' },
      { id: 'assets',         label: 'Asset Intelligence', icon: Cpu,             href: '/assets' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'tenants',     label: 'Tenant Operations', icon: Users,  href: '/tenants' },
      { id: 'sustain',     label: 'Sustainability',    icon: Leaf,   href: '/sustainability' },
      { id: 'ai-insights', label: 'AI Insights',       icon: Brain,  href: '/ai-insights' },
    ],
  },
  {
    label: 'Management',
    items: [
      { id: 'incidents',   label: 'Incidents',   icon: AlertTriangle, href: '/incidents' },
      { id: 'maintenance', label: 'Maintenance', icon: Wrench,        href: '/maintenance' },
      { id: 'reports',     label: 'Reports',     icon: FileText,      href: '/reports' },
      { id: 'settings',    label: 'Settings',    icon: Settings,      href: '/settings' },
    ],
  },
  {
    label: 'V3 Features',
    items: [
      { id: 'capacity-sim', label: lensOf('capacity').label, icon: Gauge, href: lensOf('capacity').href },
      { id: 'predictive', label: lensOf('predictive').label, icon: Radar, href: lensOf('predictive').href },
      { id: 'water', label: lensOf('water').label, icon: Droplets, href: lensOf('water').href },
      { id: 'clean-energy', label: lensOf('clean-energy').label, icon: SunMedium, href: lensOf('clean-energy').href },
      { id: 'site-risk', label: lensOf('site-risk').label, icon: ShieldAlert, href: lensOf('site-risk').href },
      { id: 'esg', label: lensOf('esg').label, icon: FileCheck2, href: lensOf('esg').href },
      { id: 'compliance', label: lensOf('policy').label, icon: Scale, href: lensOf('policy').href },
      { id: 'switchover', label: lensOf('switchover').label, icon: Shuffle, href: lensOf('switchover').href },
      { id: 'patterns',     label: 'Pattern Memory',      icon: Network, href: '/wiki?mode=patterns' },
      { id: 'deployments',  label: 'Loading Bay',   icon: Package, href: '/deployments' },
      { id: 'scenarios',    label: 'Scenarios',     icon: Shield,  href: '/scenarios' },
      { id: 'integrations', label: 'Integrations',  icon: Plug,    href: '/integrations' },
    ],
  },
];

function Sidebar({ collapsed, onToggle }) {
  const pathname = usePathname();
  const w = collapsed ? 'w-16' : 'w-64';

  return (
    <div className={`${w} flex-shrink-0 bg-[#00338D] border-r border-white/10 flex flex-col transition-all duration-300 overflow-hidden h-full`}>
      <div className="flex items-center justify-end px-2 py-3 border-b border-white/10">
        <button
          onClick={onToggle}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-4 px-2">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/55 px-2 mb-1.5">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/command-center' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors group ${
                      isActive
                        ? 'bg-[#005EB8] border border-white/15 text-white shadow-sm'
                        : 'text-white/75 hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <Icon size={16} className={`flex-shrink-0 ${isActive ? 'text-white' : 'group-hover:text-white'}`} />
                    {!collapsed && <span className="text-xs font-semibold truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 px-2 py-3 space-y-2">
        <div className="flex items-center gap-2 px-2">
          <div className="relative flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#00B0A0] block" />
            <span className="absolute inset-0 rounded-full bg-[#00B0A0] animate-ping opacity-50" />
          </div>
          {!collapsed && <span className="text-[10px] text-white/70">All Systems Operational</span>}
        </div>
        <Link href="/settings" className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition-colors">
          <div className="relative flex-shrink-0">
            <Bell size={16} />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#C8102E] text-white text-[8px] font-bold flex items-center justify-center">7</span>
          </div>
          {!collapsed && <span className="text-xs">Notifications</span>}
        </Link>
        <div className="flex items-center gap-2.5 px-2.5 py-1.5">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#005EB8] to-[#00338D] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-bold">AM</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">Arjun Mehta</p>
              <p className="text-white/60 text-[10px] truncate">Facility Director</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ title, onCopilotOpen }) {
  return (
    <div className="h-14 flex-shrink-0 bg-[#00338D] border-b border-white/10 flex items-center gap-3 px-4">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
            <span className="text-white">K-Nexus</span><span style={{ color: '#9CC7EE' }}>.AI</span>
          </span>
          <span className="text-white/40 text-sm">|</span>
          <span className="text-white/85 text-sm">{title}</span>
        </div>
      </div>

      <div className="flex-1 max-w-xs mx-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60" />
          <input
            type="text"
            placeholder="Search assets, incidents, tenants..."
            className="w-full bg-white/10 border border-white/20 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/60 focus:outline-none focus:border-white/50 transition-colors"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 text-[10px]">⌘K</span>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="relative">
          <span className="w-2 h-2 rounded-full bg-[#00B0A0] block" />
          <span className="absolute inset-0 rounded-full bg-[#00B0A0] animate-ping opacity-60" />
        </div>
        <span className="text-xs text-white/85 font-semibold">Live</span>
      </div>

      <Link
        href="/"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white/90 hover:text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
      >
        <Home size={13} />
        Home
      </Link>

      <Link
        href="/agentic-stack"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white/90 hover:text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
      >
        <Layers size={13} />
        AI Stack
      </Link>

      <button
        onClick={onCopilotOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#E6EEF8] text-[#00338D] text-xs font-bold rounded-lg transition-colors flex-shrink-0"
      >
        <Sparkles size={13} />
        AI Copilot
      </button>

      <div className="w-7 h-7 rounded-full bg-[#005EB8] border border-white/40 flex items-center justify-center flex-shrink-0 cursor-pointer">
        <span className="text-white text-[10px] font-bold">AM</span>
      </div>
    </div>
  );
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 20, x: '-50%' }}
      className="fixed bottom-6 left-1/2 z-[100] bg-[#00338D] border border-white/15 rounded-xl px-5 py-3 text-white text-sm shadow-2xl whitespace-nowrap pointer-events-none"
    >
      {message}
    </motion.div>
  );
}

export default function CCLayout({ title, children }) {
  // Read the persisted preference after mount — reading localStorage during the
  // initial render made the client's first paint differ from the server HTML,
  // which made React discard and rebuild the whole page on every load.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem('cc-sidebar-collapsed') === 'true') setCollapsed(true);
    } catch {}
  }, []);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof window !== 'undefined') localStorage.setItem('cc-sidebar-collapsed', String(next));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F0F2F5]">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={title} onCopilotOpen={() => setCopilotOpen(true)} />
        <div className="flex-1 overflow-y-auto">
          {typeof children === 'function' ? children({ showToast: setToast }) : children}
        </div>
      </div>
      <AICopilotPanel forceOpen={copilotOpen} onOpenChange={setCopilotOpen} />
      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  return { toast, showToast: setToast, ToastEl: () => (
    <AnimatePresence>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </AnimatePresence>
  )};
}
