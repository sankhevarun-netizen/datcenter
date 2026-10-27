'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut, User, BookOpen, LayoutDashboard, ChevronDown,
  TrendingUp, Package, Wrench, Shield, Activity, DollarSign, Globe, Route, Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef } from 'react';
import { useSession } from '@/components/SupabaseProvider';

const LIFECYCLE_STAGES = [
  { num: '01', label: 'Strategy',                path: '/stage/01', Icon: TrendingUp  },
  { num: '02', label: 'Supply Chain Management', path: '/stage/02', Icon: Package     },
  { num: '03', label: 'Design & Build',          path: '/stage/03', Icon: Wrench      },
  { num: '04', label: 'Regulatory Compliance',   path: '/stage/04', Icon: Shield      },
  { num: '05', label: 'Operations',              path: '/stage/05', Icon: Activity    },
  { num: '06', label: 'Monetisation',            path: '/stage/06', Icon: DollarSign  },
];

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
  const [stagesOpen, setStagesOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const stagesTimeout = useRef(null);
  const { session, supabase } = useSession() ?? {};

  const userInitial = session?.user?.email?.[0]?.toUpperCase() ?? 'K';

  async function handleSignOut() {
    await supabase?.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const openStages = () => {
    clearTimeout(stagesTimeout.current);
    setStagesOpen(true);
  };
  const closeStages = () => {
    stagesTimeout.current = setTimeout(() => setStagesOpen(false), 120);
  };

  const isStageActive = pathname?.startsWith('/stage');

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
                <span className="text-white">K-Nexus</span>
                <span style={{ color: '#8FC0F0' }}>.AI</span>
              </span>
              <span className="w-px h-5 bg-white/20" />
              <span className="text-white/60 font-normal text-[13px] tracking-wide">Data Centre Intelligence</span>
            </div>
          </Link>

          <div className="flex-1" />

          {/* ── Nav links ── */}
          <div className="flex items-center gap-0.5">

            <NavLink href="/" active={pathname === '/'}>Overview</NavLink>

            <NavLink href="/dashboard" active={pathname?.startsWith('/dashboard')}>
              <span className="flex items-center gap-1.5">
                <Globe size={12} />
                Global DC
              </span>
            </NavLink>

            {/* Lifecycle Stages with hover dropdown */}
            <div
              className="relative"
              onMouseEnter={openStages}
              onMouseLeave={closeStages}
            >
              <button
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm transition-colors ${
                  isStageActive ? 'text-white font-semibold' : 'text-white/65 font-medium hover:text-white hover:bg-white/5'
                }`}
                style={isStageActive ? { background: '#2B57A8' } : undefined}
              >
                Lifecycle Stages
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-200 ${stagesOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {stagesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute top-full left-0 mt-2 w-64 rounded-2xl shadow-2xl overflow-hidden"
                    style={{
                      background: 'rgba(22,28,54,0.97)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      backdropFilter: 'blur(20px)',
                    }}
                    onMouseEnter={openStages}
                    onMouseLeave={closeStages}
                  >
                    <div className="px-3 py-2.5 border-b border-white/[0.07]">
                      <p className="text-white/35 text-[10px] font-semibold uppercase tracking-widest">
                        6 Lifecycle Stages
                      </p>
                    </div>
                    <div className="py-1.5">
                      {LIFECYCLE_STAGES.map(({ num, label, path, Icon }) => (
                        <Link
                          key={num}
                          href={path}
                          onClick={() => setStagesOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.07] transition-colors group"
                        >
                          <div className="w-6 h-6 rounded-lg bg-[#00338D]/40 flex items-center justify-center flex-shrink-0 group-hover:bg-[#005EB8]/25 transition-colors">
                            <Icon size={12} className="text-white/55 group-hover:text-white/90" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-white/40 text-[9px] font-bold">0{num.replace('0','')}</span>
                            <p className="text-white/75 text-xs font-medium group-hover:text-white transition-colors leading-snug truncate">
                              {label}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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

          {/* ── EAI Platform ── */}
          <Link
            href="/eai"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors flex-shrink-0 mr-3"
            style={{ background: pathname?.startsWith('/eai') ? '#4277D4' : '#2B57A8' }}
          >
            <Layers size={14} />
            EAI Platform
          </Link>

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
