'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Download, CheckCircle2, Circle, BarChart2, Clock,
  Zap, Plus, Globe, Trash2, User, Calendar, TrendingUp, Award,
  ChevronDown, X, Loader2, ExternalLink,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import Navbar from '@/components/layout/Navbar';
import { useSession } from '@/components/SupabaseProvider';

const REPORT_COLORS = {
  executive:    '#00338D',
  incident:     '#C8102E',
  capacity:     '#005EB8',
  sustainability:'#00B0A0',
  tenant:       '#7C3AED',
  maintenance:  '#E87722',
  custom:       '#6B7280',
};

const REPORT_META = {
  executive:     { label: 'Executive Summary',    freq: 'Daily' },
  incident:      { label: 'Incident Analysis',    freq: 'Weekly' },
  capacity:      { label: 'Capacity Planning',    freq: 'Monthly' },
  sustainability:{ label: 'Sustainability & ESG', freq: 'Quarterly' },
  tenant:        { label: 'Tenant Operations',    freq: 'Monthly' },
  maintenance:   { label: 'Maintenance & Asset',  freq: 'Weekly' },
  custom:        { label: 'Custom Report',        freq: 'Ad-hoc' },
};

const STAGE_NAMES = [
  'Strategy & Assessment',
  'Supply Chain & Sourcing',
  'Design & Build',
  'Compliance & Risk',
  'Operations',
  'Monetization',
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function TypeBadge({ type }) {
  const color = REPORT_COLORS[type] ?? '#6B7280';
  const label = REPORT_META[type]?.label ?? type;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ backgroundColor: color + '18', color }}
    >
      {label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }) {
  return (
    <motion.div
      variants={itemVariants}
      className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-5 flex items-start gap-4"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color + '15' }}
      >
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[#9CA3AF] font-semibold uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{value}</p>
        {sub && <p className="text-xs text-[#6B7280] mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

function generatePDFForHistory(reportType, reportName) {
  import('jspdf').then(({ jsPDF }) => {
    const report = { id: reportType, name: reportName };
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const w = 210; const margin = 20;
    doc.setFillColor(0, 51, 141);
    doc.rect(0, 0, w, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('K-NEXUS', margin, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Datacenter Lifecycle Intelligence Platform', margin, 18);
    doc.setFontSize(10);
    doc.text(report.name.toUpperCase(), margin, 24);
    doc.setFontSize(8);
    doc.setTextColor(200, 220, 255);
    const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.text(`Generated: ${now} UTC`, w - margin, 24, { align: 'right' });
    let y = 40;
    doc.setFillColor(244, 246, 249);
    doc.roundedRect(margin, y, w - margin * 2, 30, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(26, 31, 54);
    doc.text('Executive Summary', margin + 5, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 90, 110);
    ['Global Health Score: 94.2/100  |  Active Incidents: 5 (3 Critical)  |  SLA Compliance: 99.7%',
     'Portfolio: 12 facilities, 847 MW capacity, 73.4% utilized across APAC / EMEA / Americas',
     'Sustainability: PUE 1.38 avg, 64% renewable energy mix, ESG Score: 82/100 (A-)']
      .forEach((line, i) => doc.text(line, margin + 5, y + 14 + i * 6));
    doc.setFillColor(244, 246, 249);
    doc.rect(0, 280, w, 17, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 160, 175);
    doc.text('CONFIDENTIAL — K-Nexus Datacenter Intelligence Platform', margin, 288);
    doc.text('Powered by K-Nexus Intelligence Platform  |  kpmg.com/knexus', w - margin, 288, { align: 'right' });
    doc.save(`KNexus_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`);
  });
}

const WIDGET_DEFS = [
  { id: 'profile',      label: 'Profile Card' },
  { id: 'stats',        label: 'KPI Stats' },
  { id: 'stages',       label: 'Stage Progress' },
  { id: 'chart',        label: 'Report Activity Chart' },
  { id: 'reports',      label: 'Reports List' },
];

const PRESETS = {
  ops:  { label: 'Operations', widgets: ['profile', 'stats', 'stages', 'reports'] },
  exec: { label: 'Executive',  widgets: ['profile', 'stats', 'chart', 'reports'] },
  esg:  { label: 'ESG View',   widgets: ['profile', 'stats', 'stages'] },
};

export default function UserDashboardPage() {
  const { session, supabase } = useSession() ?? {};
  const [reports, setReports] = useState([]);
  const [stages, setStages] = useState([]);
  const [userMeta, setUserMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [preset, setPreset] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('db_preset') || 'ops';
    return 'ops';
  });
  const [customWidgets, setCustomWidgets] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('db_widgets') || 'null'); } catch { return null; }
    }
    return null;
  });
  const [showCustomize, setShowCustomize] = useState(false);

  const activeWidgets = customWidgets || PRESETS[preset]?.widgets || PRESETS.ops.widgets;

  const applyPreset = (p) => {
    setPreset(p);
    setCustomWidgets(null);
    if (typeof window !== 'undefined') { localStorage.setItem('db_preset', p); localStorage.removeItem('db_widgets'); }
  };

  const toggleWidget = (id) => {
    const base = customWidgets || PRESETS[preset]?.widgets || [];
    const next = base.includes(id) ? base.filter(w => w !== id) : [...base, id];
    setCustomWidgets(next);
    if (typeof window !== 'undefined') localStorage.setItem('db_widgets', JSON.stringify(next));
  };

  const widgetVisible = (id) => activeWidgets.includes(id);

  useEffect(() => {
    if (!session?.user || !supabase) return;
    Promise.all([
      supabase.from('user_reports').select('*').order('generated_at', { ascending: false }),
      supabase.from('stage_progress').select('*'),
      supabase.auth.getUser(),
    ]).then(([{ data: rpts }, { data: stgs }, { data: { user } }]) => {
      setReports(rpts ?? []);
      setStages(stgs ?? []);
      setUserMeta(user);
      setLoading(false);
    });
  }, [session, supabase]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleDelete(id) {
    setDeletingId(id);
    await fetch(`/api/user-reports?id=${id}`, { method: 'DELETE' });
    setReports(prev => prev.filter(r => r.id !== id));
    setDeletingId(null);
    showToast('Report record removed');
  }

  const stagesCompleted = useMemo(
    () => stages.filter(s => s.completed).length,
    [stages]
  );

  const uniqueTypes = useMemo(
    () => [...new Set(reports.map(r => r.report_type))],
    [reports]
  );

  const filteredReports = useMemo(
    () => typeFilter === 'all' ? reports : reports.filter(r => r.report_type === typeFilter),
    [reports, typeFilter]
  );

  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const label = d.toLocaleString('en', { month: 'short' });
      const count = reports.filter(r => {
        const rd = new Date(r.generated_at);
        return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth();
      }).length;
      return { month: label, count };
    });
  }, [reports]);

  const joinDate = userMeta?.created_at
    ? new Date(userMeta.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  const email = session?.user?.email ?? '';
  const initial = email[0]?.toUpperCase() ?? 'K';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F2F5]">
        <Navbar />
        <div className="pt-16 flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-[#005EB8]" />
            <p className="text-[#6B7280] text-sm">Loading your dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <Navbar />

      <main className="pt-16">
        {/* Dashboard customization bar */}
        <div className="sticky top-14 z-20 bg-white border-b border-[#D8DCE3] shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wide">Layout:</span>
              <div className="flex items-center gap-1 p-0.5 bg-[#F0F2F5] rounded-lg border border-[#D8DCE3]">
                {Object.entries(PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      preset === key && !customWidgets ? 'bg-[#005EB8] text-white shadow' : 'text-[#9CA3AF] hover:text-[#374151]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowCustomize(!showCustomize)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                showCustomize ? 'bg-[#EFF6FF] border-[#005EB8]/30 text-[#005EB8]' : 'border-[#D8DCE3] text-[#6B7280] hover:bg-[#F8FAFC]'
              }`}
            >
              ⚙ Customize Widgets
            </button>
          </div>
          {showCustomize && (
            <div className="max-w-7xl mx-auto px-6 pb-2 flex items-center gap-3 flex-wrap border-t border-[#D8DCE3] pt-2">
              <span className="text-[10px] text-[#9CA3AF] font-medium">Widgets:</span>
              {WIDGET_DEFS.map(w => (
                <button
                  key={w.id}
                  onClick={() => toggleWidget(w.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                    activeWidgets.includes(w.id)
                      ? 'bg-[#005EB8] border-[#005EB8] text-white'
                      : 'border-[#D8DCE3] text-[#9CA3AF] hover:border-[#D1D5DB]'
                  }`}
                >
                  {activeWidgets.includes(w.id) ? '✓' : '+'} {w.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="max-w-7xl mx-auto px-6 py-10">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            {/* ── Hero Header ── */}
            {widgetVisible('profile') && <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-[#00338D] via-[#005EB8] to-[#00B0A0]" />
              <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#005EB8] to-[#00338D] flex items-center justify-center shadow-lg">
                    <span className="text-white text-3xl font-bold" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{initial}</span>
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#00B0A0] border-2 border-white flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-[#00B0A0] animate-ping" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h1 className="text-xl font-bold text-[#1A1F36] truncate" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>{email}</h1>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00338D]/10 text-[#00338D] text-[10px] font-bold border border-[#00338D]/20">
                      <Award size={10} /> KPMG Advisory
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00B0A0]/10 text-[#00B0A0] text-[10px] font-bold border border-[#00B0A0]/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00B0A0] animate-pulse" /> Active
                    </span>
                  </div>
                  <p className="text-sm text-[#6B7280] flex items-center gap-1.5">
                    <Calendar size={13} className="flex-shrink-0" />
                    K-Nexus Member since {joinDate}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link
                    href="/reports"
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#00338D] hover:bg-[#002A73] text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    <FileText size={13} /> Generate Report
                  </Link>
                  <Link
                    href="/stage/01"
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#F0F2F5] hover:bg-[#D8DCE3] text-[#1A1F36] text-xs font-bold rounded-xl border border-[#D8DCE3] transition-colors"
                  >
                    <Plus size={13} /> New Case
                  </Link>
                </div>
              </div>
            </motion.div>}

            {/* ── Stats Row ── */}
            {widgetVisible('stats') && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={FileText}    label="Total Reports"      value={reports.length}        sub="PDFs generated"                          color="#005EB8" />
              <StatCard icon={CheckCircle2} label="Stages Completed"  value={`${stagesCompleted}/6`} sub="Lifecycle progress"                    color="#00B0A0" />
              <StatCard icon={BarChart2}   label="Report Types Used"  value={uniqueTypes.length}    sub={`of ${Object.keys(REPORT_META).length} available`} color="#7C3AED" />
              <StatCard icon={Calendar}    label="Member Since"        value={joinDate.split(' ')[2] ?? '—'} sub={joinDate}                       color="#E87722" />
            </div>}

            {/* ── Main 2-col grid ── */}
            {(widgetVisible('reports') || widgetVisible('stages')) && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Reports History Table */}
              {widgetVisible('reports') && <motion.div variants={itemVariants} className="lg:col-span-2 bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#D8DCE3] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-[#00338D]" />
                    <h2 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Report History</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#F0F2F5] text-[#6B7280] font-semibold">{reports.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['all', ...Object.keys(REPORT_META)].map(t => (
                      <button
                        key={t}
                        onClick={() => setTypeFilter(t)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${
                          typeFilter === t
                            ? 'bg-[#00338D] text-white'
                            : 'bg-[#F0F2F5] text-[#6B7280] hover:bg-[#D8DCE3]'
                        }`}
                      >
                        {t === 'all' ? 'All' : REPORT_META[t]?.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#F0F2F5] flex items-center justify-center mb-3">
                      <FileText size={24} className="text-[#9CA3AF]" />
                    </div>
                    <p className="text-sm font-bold text-[#1A1F36] mb-1">No reports yet</p>
                    <p className="text-xs text-[#9CA3AF] mb-4">Generate your first report from the Reports page.</p>
                    <Link href="/reports" className="flex items-center gap-1.5 px-4 py-2 bg-[#00338D] text-white text-xs font-bold rounded-xl hover:bg-[#002A73] transition-colors">
                      <ExternalLink size={12} /> Go to Reports
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#D8DCE3] bg-[#F8FAFC]">
                          <th className="text-left px-5 py-3 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Type</th>
                          <th className="text-left px-3 py-3 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Generated</th>
                          <th className="text-left px-3 py-3 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider hidden md:table-cell">Date Range</th>
                          <th className="text-right px-5 py-3 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReports.map((r, i) => (
                          <motion.tr
                            key={r.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className="border-b border-[#F0F2F5] hover:bg-[#F8FAFC] transition-colors"
                          >
                            <td className="px-5 py-3">
                              <TypeBadge type={r.report_type} />
                            </td>
                            <td className="px-3 py-3 text-[#1A1F36] font-medium">
                              <p>{formatDate(r.generated_at)}</p>
                              <p className="text-[#9CA3AF] text-[10px]">{timeAgo(r.generated_at)}</p>
                            </td>
                            <td className="px-3 py-3 text-[#6B7280] hidden md:table-cell">
                              {r.date_from ? `${formatDate(r.date_from)} – ${formatDate(r.date_to)}` : <span className="text-[#9CA3AF]">Standard</span>}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => generatePDFForHistory(r.report_type, r.report_name)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-[#00338D] text-white rounded-lg hover:bg-[#002A73] transition-colors font-semibold"
                                >
                                  <Download size={11} /> Download
                                </button>
                                <button
                                  onClick={() => handleDelete(r.id)}
                                  disabled={deletingId === r.id}
                                  className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#C8102E] hover:bg-[#FEF2F2] transition-colors"
                                >
                                  {deletingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>}

              {/* Stage Progress */}
              {widgetVisible('stages') && <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#D8DCE3] flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#00B0A0]" />
                  <h2 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Lifecycle Progress</h2>
                </div>
                <div className="p-5">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#6B7280]">Completion</span>
                      <span className="text-xs font-bold text-[#1A1F36]">{stagesCompleted}/6 stages</span>
                    </div>
                    <div className="w-full h-2 bg-[#F0F2F5] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[#00B0A0] to-[#005EB8]"
                        initial={{ width: 0 }}
                        animate={{ width: `${(stagesCompleted / 6) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {STAGE_NAMES.map((name, i) => {
                      const stageNum = i + 1;
                      const completed = stages.some(s => s.stage_number === stageNum && s.completed);
                      return (
                        <div key={i} className="flex items-center gap-3 py-1.5">
                          {completed ? (
                            <CheckCircle2 size={16} className="text-[#00B0A0] flex-shrink-0" />
                          ) : (
                            <Circle size={16} className="text-[#D1D5DB] flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold truncate ${completed ? 'text-[#1A1F36]' : 'text-[#9CA3AF]'}`}>
                              {name}
                            </p>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            completed ? 'bg-[#00B0A0]/10 text-[#00B0A0]' : 'bg-[#F0F2F5] text-[#9CA3AF]'
                          }`}>
                            {String(stageNum).padStart(2, '0')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#D8DCE3]">
                    <Link
                      href="/stage/01"
                      className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-[#F0F2F5] hover:bg-[#D8DCE3] text-[#1A1F36] text-xs font-bold transition-colors border border-[#D8DCE3]"
                    >
                      <Plus size={12} /> Continue Lifecycle
                    </Link>
                  </div>
                </div>
              </motion.div>}
            </div>}

            {/* ── Second row ── */}
            {(widgetVisible('chart') || widgetVisible('stages')) && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Activity Chart */}
              {widgetVisible('chart') && <motion.div variants={itemVariants} className="lg:col-span-2 bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#D8DCE3] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-[#005EB8]" />
                    <h2 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Report Activity</h2>
                  </div>
                  <span className="text-[10px] text-[#9CA3AF]">Last 6 months</span>
                </div>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} barCategoryGap="35%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#D8DCE3" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#9CA3AF', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                        width={24}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#fff',
                          border: '1px solid #D8DCE3',
                          borderRadius: 10,
                          fontSize: 12,
                          color: '#1A1F36',
                        }}
                        cursor={{ fill: '#F0F2F5' }}
                        formatter={(value) => [`${value} report${value !== 1 ? 's' : ''}`, '']}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={index === chartData.length - 1 ? '#00338D' : '#005EB8'}
                            opacity={index === chartData.length - 1 ? 1 : 0.65}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-center text-[10px] text-[#9CA3AF] mt-2">
                    {reports.length === 0 ? 'Generate your first report to see activity here' : `${reports.length} total report${reports.length !== 1 ? 's' : ''} generated`}
                  </p>
                </div>
              </motion.div>}

              {/* Quick Actions */}
              <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#D8DCE3] flex items-center gap-2">
                  <Zap size={16} className="text-[#E87722]" />
                  <h2 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Quick Actions</h2>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    {
                      href: '/reports',
                      icon: FileText,
                      label: 'Generate Report',
                      desc: 'Create a new PDF report',
                      color: '#00338D',
                    },
                    {
                      href: '/stage/01',
                      icon: Plus,
                      label: 'New Business Case',
                      desc: 'Start lifecycle assessment',
                      color: '#005EB8',
                    },
                    {
                      href: '/dashboard',
                      icon: Globe,
                      label: 'Global Dashboard',
                      desc: 'Portfolio & datacenter map',
                      color: '#00B0A0',
                    },
                    {
                      href: '/command-center',
                      icon: BarChart2,
                      label: 'Command Center',
                      desc: 'Live operations overview',
                      color: '#7C3AED',
                    },
                  ].map(({ href, icon: Icon, label, desc, color }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#F8FAFC] border border-transparent hover:border-[#D8DCE3] transition-all group"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: color + '15' }}
                      >
                        <Icon size={16} style={{ color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#1A1F36] group-hover:text-[#00338D] transition-colors">{label}</p>
                        <p className="text-[10px] text-[#9CA3AF]">{desc}</p>
                      </div>
                      <ExternalLink size={12} className="text-[#D1D5DB] group-hover:text-[#005EB8] transition-colors flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </motion.div>
            </div>}

            {/* ── Recent Activity Feed ── */}
            <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#D8DCE3] flex items-center gap-2">
                <Clock size={16} className="text-[#6B7280]" />
                <h2 className="text-sm font-bold text-[#1A1F36]" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Recent Activity</h2>
              </div>
              {reports.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm text-[#9CA3AF]">No activity yet — generate a report to get started.</p>
                </div>
              ) : (
                <div className="px-5 py-4">
                  <div className="relative">
                    <div className="absolute left-[15px] top-0 bottom-0 w-px bg-[#D8DCE3]" />
                    <div className="space-y-4">
                      {reports.slice(0, 6).map((r, i) => {
                        const color = REPORT_COLORS[r.report_type] ?? '#6B7280';
                        return (
                          <motion.div
                            key={r.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-start gap-4 relative"
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 border-white"
                              style={{ backgroundColor: color + '20' }}
                            >
                              <FileText size={13} style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0 pb-1">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold text-[#1A1F36]">{r.report_name}</p>
                                  <p className="text-[10px] text-[#9CA3AF] mt-0.5">
                                    Generated · {formatDateTime(r.generated_at)}
                                    {r.date_from ? ` · ${formatDate(r.date_from)} to ${formatDate(r.date_to)}` : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <TypeBadge type={r.report_type} />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                  {reports.length > 6 && (
                    <p className="text-center text-xs text-[#9CA3AF] mt-4 pt-3 border-t border-[#D8DCE3]">
                      +{reports.length - 6} more in the table above
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        </div>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-6 left-1/2 z-[100] bg-[#00338D] border border-white/10 rounded-xl px-5 py-3 text-white text-sm shadow-2xl whitespace-nowrap pointer-events-none"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
