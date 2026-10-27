'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Bell, Mail, HelpCircle, ChevronRight, PanelLeft, Home, Upload, LogOut } from 'lucide-react';
import { useSession } from '@/components/SupabaseProvider';

const BTN = {
  width: 34, height: 34, borderRadius: 8,
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: '#6B7280',
  transition: 'all 0.12s', flexShrink: 0,
};

export default function EAITopbar({ unreadCount = 12, sidebarHidden = false, onToggleSidebar }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, supabase } = useSession() ?? {};
  const email = session?.user?.email;

  async function handleSignOut() {
    await supabase?.auth.signOut();
    router.refresh();
  }

  return (
    <header style={{
      height: 56, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 20px',
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid #E2E8F0',
    }}>

      {/* Hide/show sidebar toggle — only visible when sidebar is hidden */}
      {sidebarHidden && (
        <button
          onClick={onToggleSidebar}
          title="Show sidebar"
          style={{ ...BTN, flexShrink: 0, marginRight: -4 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#1A1F36'; e.currentTarget.style.background = '#F4F6F9'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = '#F8FAFC'; }}
        >
          <PanelLeft size={14} />
        </button>
      )}

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 400 }}>
        <button style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          background: '#F8FAFC', border: '1px solid #E2E8F0',
          borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
          color: '#9CA3AF', fontSize: 12,
          transition: 'border-color 0.12s',
        }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#CBD5E1')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
        >
          <Search size={13} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, textAlign: 'left' }}>Search for anything...</span>
          <span style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0 }}>⌘K</span>
        </button>
      </div>

      {/* Home — back to main K-Nexus.AI site */}
      <Link href="/" title="Home" style={BTN}
        onMouseEnter={e => { e.currentTarget.style.color = '#1A1F36'; e.currentTarget.style.background = '#F4F6F9'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = '#F8FAFC'; }}>
        <Home size={14} />
      </Link>

      <div style={{ flex: 1 }} />

      {/* Icon buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

        {/* Upload Data — jumps to the master data import page from anywhere in the platform */}
        <Link
          href="/eai/administration/data-import"
          title="Upload EAI master data (Excel)"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 34, padding: '0 12px', borderRadius: 8,
            background: 'rgba(0,119,200,0.10)', border: '1px solid rgba(0,119,200,0.25)',
            color: '#0077C8', fontSize: 11, fontWeight: 600,
            textDecoration: 'none', cursor: 'pointer', flexShrink: 0,
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,119,200,0.18)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,119,200,0.10)'; }}
        >
          <Upload size={13} /> Upload Data
        </Link>

        {/* Bell */}
        <div style={{ position: 'relative' }}>
          <button style={BTN}
            onMouseEnter={e => { e.currentTarget.style.color = '#1A1F36'; e.currentTarget.style.background = '#F4F6F9'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = '#F8FAFC'; }}>
            <Bell size={14} />
          </button>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              width: 16, height: 16, borderRadius: '50%',
              background: '#DC2626', color: '#fff',
              fontSize: 8, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </div>

        {/* Mail */}
        <button style={BTN}
          onMouseEnter={e => { e.currentTarget.style.color = '#1A1F36'; e.currentTarget.style.background = '#F4F6F9'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = '#F8FAFC'; }}>
          <Mail size={14} />
        </button>

        {/* Help */}
        <button style={BTN}
          onMouseEnter={e => { e.currentTarget.style.color = '#1A1F36'; e.currentTarget.style.background = '#F4F6F9'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = '#F8FAFC'; }}>
          <HelpCircle size={14} />
        </button>

        {/* User — signed in shows the real Supabase session; signed out links
            to /login so uploads (which need a real user_id) are reachable. */}
        {email ? (
          <div
            onClick={handleSignOut}
            title="Sign out"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 10px 5px 6px', borderRadius: 10, cursor: 'pointer',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F4F6F9')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #00338D, #0077C8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 10 }}>{email[0].toUpperCase()}</span>
            </div>
            <div style={{ maxWidth: 140 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1F36', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</p>
              <p style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>Sign out</p>
            </div>
            <LogOut size={12} style={{ color: '#9CA3AF', flexShrink: 0 }} />
          </div>
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent(pathname || '/eai/administration/data-import')}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px 5px 6px', borderRadius: 10, cursor: 'pointer', textDecoration: 'none',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F4F6F9')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: '#F1F5F9', border: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#9CA3AF', fontWeight: 700, fontSize: 10 }}>?</span>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1F36', lineHeight: 1 }}>Sign In</p>
              <p style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>Not signed in</p>
            </div>
            <ChevronRight size={11} style={{ color: '#9CA3AF' }} />
          </Link>
        )}
      </div>
    </header>
  );
}
