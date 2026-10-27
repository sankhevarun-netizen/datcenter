'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Globe2, Building2, RefreshCw, Truck, CircleDollarSign,
  Brain, Wrench, Link2, BarChart3, ShieldCheck, Satellite,
  Zap, ChevronLeft, ChevronRight, ArrowRight, X,
} from 'lucide-react';

const MODULES = [
  { id: 'global-portfolio',     label: 'Global Portfolio',     icon: Globe2,           href: '/eai/global-portfolio'     },
  { id: 'real-estate-explorer', label: 'Real Estate Explorer', icon: Building2,        href: '/eai/real-estate-explorer' },
  { id: 'asset-lifecycle',      label: 'Asset Lifecycle',      icon: RefreshCw,        href: '/eai/asset-lifecycle'      },
  { id: 'supply-chain',         label: 'Supply Chain',         icon: Truck,            href: '/eai/supply-chain'         },
  { id: 'finops-esg',           label: 'FinOps & ESG',         icon: CircleDollarSign, href: '/eai/finops-esg'           },
  { id: 'intelligence-center',  label: 'Intelligence Center',  icon: Brain,            href: '/eai/intelligence-center'  },
  { id: 'risk-signals',         label: 'Risk Signals',         icon: Satellite,        href: '/eai/risk-signals'         },
  { id: 'operations-hub',       label: 'Operations Hub',       icon: Wrench,           href: '/eai/operations-hub'       },
  { id: 'integration-hub',      label: 'Integration Hub',      icon: Link2,            href: '/eai/integration-hub'      },
  { id: 'reports-analytics',    label: 'Reports & Analytics',  icon: BarChart3,        href: '/eai/reports-analytics'    },
  { id: 'administration',       label: 'Administration',       icon: ShieldCheck,      href: '/eai/administration'       },
];

const QUICK_ACCESS = [
  { label: 'Singapore Campus', href: '/eai/real-estate-explorer' },
  { label: 'Mumbai DC',        href: '/eai/real-estate-explorer' },
  { label: 'Hamina DC',        href: '/eai/real-estate-explorer' },
  { label: 'Asset Search',     href: '/eai/asset-lifecycle'      },
  { label: 'Create Work Order', href: '/eai/operations-hub'      },
];

export default function EAISidebar({ collapsed = false, onToggle, onHide }) {
  const pathname = usePathname();
  const W = collapsed ? 56 : 240;

  return (
    <aside style={{
      width: W, minWidth: W, maxWidth: W,
      height: '100vh',
      background: '#0D1428',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.28s ease, min-width 0.28s ease, max-width 0.28s ease',
      overflow: 'hidden',
      flexShrink: 0,
    }}>

      {/* ── Branding ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: collapsed ? '14px 12px' : '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(135deg, #00338D, #0077C8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={14} color="#fff" />
        </div>
        {!collapsed && (
          <>
            <div style={{ minWidth: 0, overflow: 'hidden', flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>EAI Platform</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 1, whiteSpace: 'nowrap' }}>Enterprise Asset Intelligence</p>
            </div>
            <button
              onClick={onHide}
              title="Hide sidebar"
              style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                background: 'transparent', border: '1px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'rgba(255,255,255,0.25)',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.70)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; e.currentTarget.style.border = '1px solid transparent'; }}
            >
              <X size={12} />
            </button>
          </>
        )}
      </div>

      {/* ── Module nav ──────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {MODULES.map(mod => {
          const Icon     = mod.icon;
          const isActive = pathname?.startsWith(mod.href);
          return (
            <Link
              key={mod.id}
              href={mod.href}
              title={collapsed ? mod.label : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '8px 10px' : '7px 10px',
                borderRadius: 8,
                background: isActive ? 'rgba(0,119,200,0.18)' : 'transparent',
                border: isActive ? '1px solid rgba(0,119,200,0.28)' : '1px solid transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                textDecoration: 'none',
                transition: 'all 0.12s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={15} style={{ flexShrink: 0, color: isActive ? '#0077C8' : 'inherit' }} />
              {!collapsed && (
                <>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{mod.label}</span>
                  {isActive && <div style={{ width: 4, height: 16, borderRadius: 2, background: '#0077C8', flexShrink: 0 }} />}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Quick Access ─────────────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ flexShrink: 0, padding: '8px 8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.20)', textTransform: 'uppercase', letterSpacing: '0.12em', padding: '0 8px', marginBottom: 4 }}>Quick Access</p>
          {QUICK_ACCESS.map(qa => (
            <Link key={qa.label} href={qa.href} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 8px', borderRadius: 6,
              color: 'rgba(255,255,255,0.30)', textDecoration: 'none', fontSize: 10,
              transition: 'color 0.12s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.60)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.30)')}>
              <ArrowRight size={9} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qa.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* ── System Status + Collapse ─────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px' }}>
            <span style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00A36C', display: 'block' }} />
            </span>
            <div>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.40)', lineHeight: 1 }}>All Systems Operational</p>
              <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.20)', marginTop: 2 }}>Last updated: 1 min ago</p>
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: collapsed ? '7px 10px' : '6px 8px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'rgba(255,255,255,0.30)', fontSize: 10, fontWeight: 600,
            transition: 'color 0.12s',
            width: '100%',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.60)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.30)')}
        >
          {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>&lt;&lt; Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
