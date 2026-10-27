'use client';
import { useState } from 'react';
import { Search, Calendar, Filter, ChevronDown, ArrowRightLeft, Server } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

import KpiCard            from '@/components/eai/widgets/KpiCard';
import DonutChart         from '@/components/eai/widgets/DonutChart';
import DataTable          from '@/components/eai/widgets/DataTable';
import ListCard           from '@/components/eai/widgets/ListCard';
import ScoreRing          from '@/components/eai/widgets/ScoreRing';
import HorizontalBarList  from '@/components/eai/widgets/HorizontalBarList';
import IntegrationMapDiagram from '@/components/eai/widgets/IntegrationMapDiagram';
import IntegrationListRow, { IntegrationListHeader } from '@/components/eai/widgets/IntegrationListRow';
import QuickActionsMenu from '@/components/eai/widgets/QuickActionsMenu';
import DetailDrawer, { DrawerStatRow, DrawerPill } from '@/components/eai/widgets/DetailDrawer';

import {
  KPIS,
  INTEGRATION_HEALTH, INTEGRATIONS_BY_CATEGORY, TRANSACTIONS_TREND,
  TOP_INTEGRATIONS, INTEGRATION_MAP_NODES, INTEGRATION_ACTIVITY,
  DATA_FLOWS, API_HEALTH, ERROR_ANALYSIS, INTEGRATION_UPTIME,
} from '@/data/eaiIntegrationHubMock';

// ─── Shared styles ─────────────────────────────────────────────────────────────
const CARD = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: 12, overflow: 'hidden',
  boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
};
const CARD_HDR = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 14px',
  borderBottom: '1px solid #E2E8F0',
};
const CARD_TITLE = { fontSize: 11, fontWeight: 700, color: '#1A1F36', letterSpacing: '-0.01em' };
const LINK_STYLE = { fontSize: 9, color: '#0077C8', textDecoration: 'none', fontWeight: 600 };
const VIEW_ALL   = { fontSize: 9, color: '#6B7280', textDecoration: 'none' };
const DROPDOWN_BTN = {
  display: 'flex', alignItems: 'center', gap: 3,
  fontSize: 9, color: '#6B7280',
  background: '#F8FAFC', border: '1px solid #E2E8F0',
  borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
};

// ─── Data Flows table config ───────────────────────────────────────────────────
const FLOW_STATUS_STYLE = {
  Success: { color: '#00A36C', bg: 'rgba(0,163,108,0.15)', border: 'rgba(0,163,108,0.30)' },
  Warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.30)' },
  Failed:  { color: '#EF4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.30)'  },
};
const DATA_FLOW_COLS = [
  { key: 'flowName',    label: 'Flow Name' },
  { key: 'source',      label: 'Source',      width: 110 },
  { key: 'destination', label: 'Destination', width: 120 },
  { key: 'status',      label: 'Status',      width: 80,
    render: v => {
      const s = FLOW_STATUS_STYLE[v] ?? FLOW_STATUS_STYLE.Success;
      return (
        <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 5, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
          {v}
        </span>
      );
    },
  },
  { key: 'lastRun',     label: 'Last Run',    width: 90,
    render: v => <span style={{ fontSize: 9, color: '#6B7280' }}>{v}</span> },
];

// ─── API Health table config ───────────────────────────────────────────────────
const API_HEALTH_COLS = [
  { key: 'apiName',          label: 'API Name' },
  { key: 'statusColor',      label: 'Status', width: 60, align: 'center',
    render: v => (
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: v, display: 'inline-block', boxShadow: `0 0 5px ${v}60` }} />
    ),
  },
  { key: 'availabilityPct',  label: 'Availability',      width: 90,
    render: v => <span style={{ fontSize: 10, fontWeight: 700, color: '#1A1F36', fontFamily: 'monospace' }}>{v}%</span> },
  { key: 'avgResponseTimeMs', label: 'Avg Response Time', width: 110,
    render: v => <span style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', fontFamily: 'monospace' }}>{v} ms</span> },
];

// ─── Transactions Trend dual-series chart ──────────────────────────────────────
function TransactionsTrendChart({ data, height = 165 }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        {[
          { key: 'successful', label: 'Successful', color: '#00A36C' },
          { key: 'failed',     label: 'Failed',      color: '#EF4444' },
        ].map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#6B7280' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
            {s.label}
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#6B7280' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 8, fill: '#6B7280' }}
            axisLine={false} tickLine={false}
            width={28}
            domain={[0, 100000]}
            ticks={[0, 25000, 50000, 75000, 100000]}
            tickFormatter={v => `${Math.round(v / 1000)}K`}
          />
          <Tooltip
            contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 10, color: '#1A1F36', boxShadow: '0 2px 8px rgba(16,24,40,0.08)' }}
            labelStyle={{ color: '#6B7280' }}
            formatter={v => [v.toLocaleString(), undefined]}
          />
          <Line type="monotone" dataKey="successful" name="Successful" stroke="#00A36C" strokeWidth={2} dot={{ r: 3, fill: '#00A36C', strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="failed"     name="Failed"     stroke="#EF4444" strokeWidth={2} dot={{ r: 3, fill: '#EF4444', strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function IntegrationHubPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [drawer, setDrawer] = useState(null); // { kind: 'flow'|'api', data }
  const closeDrawer = () => setDrawer(null);

  function renderDrawer() {
    if (!drawer) return <DetailDrawer open={false} onClose={closeDrawer} />;
    const { kind, data } = drawer;

    if (kind === 'flow') {
      const s = FLOW_STATUS_STYLE[data.status] ?? FLOW_STATUS_STYLE.Success;
      return (
        <DetailDrawer open title={data.flowName} subtitle={`${data.source} → ${data.destination}`} icon={<ArrowRightLeft size={16} color="#0077C8" />} accentColor="#0077C8" onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'Status', value: <DrawerPill label={data.status} color={s.color} /> },
            { label: 'Last Run', value: data.lastRun },
          ]} />
          <p style={{ fontSize: 10, color: '#6B7280' }}>Source <b style={{ color: '#1A1F36' }}>{data.source}</b> → Destination <b style={{ color: '#1A1F36' }}>{data.destination}</b></p>
        </DetailDrawer>
      );
    }

    if (kind === 'api') {
      return (
        <DetailDrawer open title={data.apiName} subtitle="API health" icon={<Server size={16} color={data.statusColor} />} accentColor={data.statusColor} onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'Availability', value: `${data.availabilityPct}%`, color: data.statusColor },
            { label: 'Avg Response', value: `${data.avgResponseTimeMs} ms` },
          ]} />
        </DetailDrawer>
      );
    }

    return <DetailDrawer open={false} onClose={closeDrawer} />;
  }

  const activityItems = INTEGRATION_ACTIVITY.map(a => ({ color: a.color, title: a.title, sub: '', ago: a.time }));

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Sub-header ──────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 20px',
          borderBottom: '1px solid #E2E8F0',
          flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#1A1F36', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Integration Hub
            </h1>
            <p style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>
              Connect, monitor and manage integrations across your ecosystem
            </p>
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: '#F8FAFC', border: '1px solid #E2E8F0',
            borderRadius: 8, padding: '6px 12px', width: 280, flexShrink: 0,
          }}>
            <Search size={12} style={{ color: '#9CA3AF', flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: '#9CA3AF', flex: 1 }}>Search systems, APIs, data flows…</span>
            <span style={{ fontSize: 9, color: '#9CA3AF', flexShrink: 0 }}>⌘K</span>
          </div>

          {/* Date range */}
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 10, color: '#6B7280',
            background: '#F8FAFC', border: '1px solid #E2E8F0',
            borderRadius: 8, padding: '6px 11px', cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            <Calendar size={11} /> May 1 – May 31, 2025
          </button>

          {/* Filters */}
          <button style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontWeight: 600, color: '#6B7280',
            background: '#F8FAFC', border: '1px solid #E2E8F0',
            borderRadius: 7, padding: '6px 12px', cursor: 'pointer',
          }}>
            <Filter size={11} /> Filters
          </button>

          {/* + New Integration split button */}
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <button style={{
              fontSize: 11, fontWeight: 700, color: '#fff',
              background: 'linear-gradient(135deg, #00338D 0%, #0077C8 100%)',
              border: 'none', padding: '6px 14px', cursor: 'pointer',
            }}>
              + New Integration
            </button>
            <button style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #00338D 0%, #0077C8 100%)',
              border: 'none', borderLeft: '1px solid rgba(255,255,255,0.25)',
              padding: '6px 9px', cursor: 'pointer', color: '#fff',
            }}>
              <ChevronDown size={12} />
            </button>
          </div>
          <QuickActionsMenu items={[
            { iconKey: 'Plus',       label: 'New Integration'        },
            { iconKey: 'Share2',     label: 'Create Data Flow'       },
            { iconKey: 'Plug',       label: 'Add API Endpoint'       },
            { iconKey: 'UploadCloud',label: 'Import Data Source'     },
            { iconKey: 'BookOpen',   label: 'View Integration Docs'  },
          ]} />
        </div>

        {/* Scrollable content ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 6 KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
            {KPIS.map(k => <KpiCard key={k.label} {...k} />)}
          </div>

          {/* Row 1: Integration Health | Integrations by Category | Transactions Trend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: 12 }}>

            {/* Integration Health */}
            <div style={CARD}>
              <div style={CARD_HDR}>
                <span style={CARD_TITLE}>Integration Health</span>
              </div>
              <div style={{ padding: '10px 14px' }}>
                <DonutChart
                  data={INTEGRATION_HEALTH}
                  centerLabel="84"
                  centerSublabel="Total"
                  height={170}
                  innerRadius={50}
                  outerRadius={72}
                />
              </div>
              <div style={{ padding: '0 14px 10px' }}>
                <a href="#" style={LINK_STYLE}>View All Integrations →</a>
              </div>
            </div>

            {/* Integrations by Category */}
            <div style={CARD}>
              <div style={CARD_HDR}>
                <span style={CARD_TITLE}>Integrations by Category</span>
              </div>
              <div style={{ padding: '10px 14px' }}>
                <DonutChart
                  data={INTEGRATIONS_BY_CATEGORY}
                  centerLabel="84"
                  centerSublabel="Total"
                  height={170}
                  innerRadius={50}
                  outerRadius={72}
                />
              </div>
              <div style={{ padding: '0 14px 10px' }}>
                <a href="#" style={LINK_STYLE}>View Categories →</a>
              </div>
            </div>

            {/* Transactions Trend */}
            <div style={CARD}>
              <div style={CARD_HDR}>
                <span style={CARD_TITLE}>Transactions Trend</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={DROPDOWN_BTN}>Last 7 Days <ChevronDown size={9} /></button>
                </div>
              </div>
              <div style={{ padding: '10px 14px 8px' }}>
                <TransactionsTrendChart data={TRANSACTIONS_TREND} height={165} />
              </div>
              <div style={{ padding: '0 14px 10px' }}>
                <a href="#" style={LINK_STYLE}>View Analytics →</a>
              </div>
            </div>
          </div>

          {/* Row 2: Integration Map | [Top Integrations + Activity] */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, alignItems: 'start' }}>

            {/* Integration Map */}
            <div style={CARD}>
              <div style={CARD_HDR}>
                <span style={CARD_TITLE}>Integration Map</span>
                <a href="#" style={{ ...LINK_STYLE, display: 'flex', alignItems: 'center', gap: 4 }}>
                  View Full Map
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ opacity: 0.7 }}>
                    <path d="M1 7L7 1M7 1H3M7 1V5" stroke="#0077C8" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </a>
              </div>
              <div style={{ padding: '12px 14px 14px' }}>
                <IntegrationMapDiagram nodes={INTEGRATION_MAP_NODES} />
              </div>
            </div>

            {/* Right column: Top Integrations + Integration Activity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Top Integrations */}
              <div style={CARD}>
                <div style={CARD_HDR}>
                  <span style={CARD_TITLE}>Top Integrations</span>
                  <a href="#" style={VIEW_ALL}>View All</a>
                </div>
                <IntegrationListHeader />
                {TOP_INTEGRATIONS.slice(0, 6).map((item, i) => (
                  <IntegrationListRow
                    key={item.name}
                    {...item}
                    isLast={i === Math.min(TOP_INTEGRATIONS.length, 6) - 1}
                  />
                ))}
                <div style={{ padding: '8px 14px', borderTop: '1px solid #E2E8F0' }}>
                  <a href="#" style={LINK_STYLE}>View All Integrations →</a>
                </div>
              </div>

              {/* Integration Activity */}
              <ListCard
                title="Integration Activity"
                variant="alerts"
                items={activityItems}
                viewAllHref="#"
              />
            </div>
          </div>

          {/* Data Flows DataTable (full width) */}
          <DataTable
            title="Data Flows"
            viewAllHref="#"
            viewAllLabel="View All"
            columns={DATA_FLOW_COLS}
            data={DATA_FLOWS}
            keyField="id"
            onRowDoubleClick={f => setDrawer({ kind: 'flow', data: f })}
            compact
          />

          {/* Bottom 3-card row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>

            {/* API Health */}
            <DataTable
              title="API Health"
              viewAllHref="#"
              viewAllLabel="View All"
              columns={API_HEALTH_COLS}
              data={API_HEALTH}
              keyField="id"
              onRowDoubleClick={a => setDrawer({ kind: 'api', data: a })}
              compact
            />

            {/* Error Analysis */}
            <div style={CARD}>
              <div style={CARD_HDR}>
                <span style={CARD_TITLE}>Error Analysis (Last 7 Days)</span>
                <a href="#" style={LINK_STYLE}>View Details</a>
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', gap: 12 }}>
                {/* Stats */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 9, color: '#6B7280', marginBottom: 3 }}>Total Errors</p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: '#1A1F36', fontFamily: 'ui-monospace,monospace', lineHeight: 1 }}>
                    {ERROR_ANALYSIS.totalErrors.toLocaleString()}
                  </p>
                  <p style={{ fontSize: 9, fontWeight: 600, color: '#00A36C', marginTop: 3 }}>
                    ↓{Math.abs(ERROR_ANALYSIS.deltaPct)}% vs last 7 days
                  </p>
                  <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                    <div>
                      <p style={{ fontSize: 8, color: '#9CA3AF' }}>Critical Errors</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: '#EF4444', fontFamily: 'ui-monospace,monospace', lineHeight: 1 }}>
                        {ERROR_ANALYSIS.criticalErrors}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 8, color: '#9CA3AF' }}>Warning Errors</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B', fontFamily: 'ui-monospace,monospace', lineHeight: 1 }}>
                        {ERROR_ANALYSIS.warningErrors}
                      </p>
                    </div>
                  </div>
                </div>
                {/* Errors by Category donut */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 9, color: '#6B7280', textAlign: 'center', marginBottom: 2 }}>Errors by Category</p>
                  <DonutChart
                    data={ERROR_ANALYSIS.errorsByCategory}
                    height={130}
                    innerRadius={32}
                    outerRadius={50}
                  />
                </div>
              </div>
            </div>

            {/* Integration Uptime */}
            <div style={CARD}>
              <div style={CARD_HDR}>
                <span style={CARD_TITLE}>Integration Uptime</span>
                <a href="#" style={LINK_STYLE}>View SLA Dashboard</a>
              </div>
              <div style={{ padding: '12px 14px 14px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {/* ScoreRing */}
                <div style={{ flexShrink: 0 }}>
                  <ScoreRing
                    score={INTEGRATION_UPTIME.overallPct}
                    unit="%"
                    color="#00A36C"
                    size={100}
                    sublabel="Overall Uptime"
                  />
                </div>
                {/* Per-service uptime bars */}
                <div style={{ flex: 1, paddingTop: 6 }}>
                  <p style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 10 }}>
                    Uptime (Last 30 Days)
                  </p>
                  <HorizontalBarList
                    items={INTEGRATION_UPTIME.services.map(s => ({
                      label: s.name,
                      value: s.uptimePct,
                      color: '#00A36C',
                    }))}
                    maxValue={100}
                    unit="%"
                    labelWidth={82}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {renderDrawer()}
    </div>
  );
}
