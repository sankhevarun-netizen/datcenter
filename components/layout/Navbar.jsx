'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut, User, BookOpen, LayoutDashboard,
  Route,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useSession } from '@/components/SupabaseProvider';

function NavLink({ href, children, active }) {
  return (
    <Link
      href={href}
      className={`px-3.5 py-2 rounded-xl text-sm transition-colors whitespace-nowrap ${
        active ? 'text-white font-semibold' : 'text-white/65 font-medium hover:text-white hover:bg-white/5'
      }`}
      style={active ? { background: '#2B57A8' } : undefined}
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { session, supabase } = useSession() ?? {};

  const userInitial = session?.user?.email?.[0]?.toUpperCase() ?? 'D';

  async function handleSignOut() {
    await supabase?.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, delay: 0.15 }}
      className="fixed top-0 left-0 right-0 z-50 h-16"
      style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
    >
      <div className="bg-[#00338D] border-b border-white/10 h-full">
        <div className="max-w-screen-2xl mx-auto px-6 h-full flex items-center gap-4">

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0 group">
            <div
              className="flex items-center gap-3 whitespace-nowrap"
              style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
            >
              <span className="font-extrabold text-[17px] tracking-tight">
                <span className="text-white">DCiQ</span>
              </span>
              <span className="w-px h-5 bg-white/20" />
              <span className="text-white/60 font-normal text-[13px] tracking-wide">Data Centre Intelligence</span>
            </div>
          </Link>

          <div className="flex-1" />

          {/* ── Nav links ── */}
          <div className="flex items-center gap-0.5">

            <NavLink href="/" active={pathname === '/'}>Overview</NavLink>

            {/* Global DC (Global Dashboard) is hidden from the navigation; the route still works. */}

            {/* Asset Portfolio is hidden from the navigation; the route still works. */}

            <NavLink href="/command-center" active={pathname?.startsWith('/command-center')}>
              Command Centre
            </NavLink>

            <NavLink href="/wiki" active={pathname?.startsWith('/wiki')}>
              Knowledge Wiki
            </NavLink>

            <NavLink href="/services" active={pathname?.startsWith('/services')}>
              <span className="flex items-center gap-1.5">
                <Route size={12} />
                Services
              </span>
            </NavLink>

          </div>

          <div className="flex-1" />

          {/* ── Avatar + user menu ── */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[#005EB8] to-[#00338D] flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-[#005EB8]/40 transition-all"
            >
              <span className="text-white text-xs font-bold">{userInitial}</span>
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-2 w-52 rounded-xl shadow-2xl overflow-hidden"
                  style={{ background: '#00338D', border: '1px solid rgba(255,255,255,0.10)' }}
                  onMouseLeave={() => setUserMenuOpen(false)}
                >
                  {session?.user?.email && (
                    <div className="px-4 py-2.5 text-xs text-white/40 truncate border-b border-white/[0.08]">
                      {session.user.email}
                    </div>
                  )}
                  <Link
                    href="/user-dashboard"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <User size={14} />
                    My Dashboard
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </motion.nav>
  );
}
