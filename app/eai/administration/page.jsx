'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, Plus, User, Clock } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

import KpiCard            from '@/components/eai/widgets/KpiCard';
import DonutChart         from '@/components/eai/widgets/DonutChart';
import DataTable          from '@/components/eai/widgets/DataTable';
import ListCard           from '@/components/eai/widgets/ListCard';
import HorizontalBarList  from '@/components/eai/widgets/HorizontalBarList';
import StatRowList        from '@/components/eai/widgets/StatRowList';
import QuickActionsMenu from '@/components/eai/widgets/QuickActionsMenu';
import DetailDrawer, { DrawerStatRow, DrawerPill } from '@/components/eai/widgets/DetailDrawer';

import {
  KPIS as mockKPIS, USER_ACTIVITY,
  USERS_BY_ROLE as mockUSERS_BY_ROLE,
  SYSTEM_HEALTH as mockSYSTEM_HEALTH, RECENT_ACTIVITY as mockRECENT_ACTIVITY, RECENT_USERS as mockRECENT_USERS,
  SYSTEM_RESOURCE_USAGE as mockSYSTEM_RESOURCE_USAGE, SECURITY_OVERVIEW as mockSECURITY_OVERVIEW,
  AUDIT_LOGS as mockAUDIT_LOGS, STORAGE_OVERVIEW as mockSTORAGE_OVERVIEW,
  SUPPORT_TICKETS as mockSUPPORT_TICKETS, LICENSES_USAGE as mockLICENSES_USAGE,
} from '@/data/eaiAdminMock';

// ─── Shared card styles ────────────────────────────────────────────────────────
const CARD = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: 12, overflow: 'hidden',
  boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
};
const CARD_HDR = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 14px', borderBottom: '1px solid #E2E8F0',
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
const GAP = 10;

// ─── User Activity dual-series chart ──────────────────────────────────────────
function UserActivityChart({ data, height = 155 }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 6 }}>
        {[['#0077C8', 'Active Users'], ['#00A36C', 'New Users']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 2.5, borderRadius: 2, background: c, display: 'inline-block' }} />
            <span style={{ fontSize: 9, color: '#6B7280' }}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{ width: '100%', overflow: 'hidden' }}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="date" tick={{ fontSize: 7, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v}
              tick={{ fontSize: 7, fill: '#6B7280' }} axisLine={false} tickLine={false}
              domain={[0, 1400]} ticks={[0, 300, 600, 900, 1200]}
            />
            <Tooltip
              contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11, color: '#1A1F36', boxShadow: '0 2px 8px rgba(16,24,40,0.08)' }}
              labelStyle={{ color: '#6B7280', fontSize: 9, marginBottom: 2 }}
            />
            <Line type="monotone" dataKey="activeUsers" name="Active Users" stroke="#0077C8" strokeWidth={2} dot={{ r: 3, fill: '#0077C8', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="newUsers"    name="New Users"    stroke="#00A36C" strokeWidth={2} dot={{ r: 3, fill: '#00A36C', strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── User status pill ──────────────────────────────────────────────────────────
const USER_STATUS = {
  Active:   { color: '#00A36C', bg: 'rgba(0,163,108,0.15)',  border: 'rgba(0,163,108,0.30)'  },
  Inactive: { color: '#6B7280', bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.30)' },
};

// ─── Table column configs ──────────────────────────────────────────────────────
const USER_COLS = [
  { key: 'name',      label: 'User',       width: 110 },
  { key: 'email',     label: 'Email',      render: v => <span style={{ fontSize: 9, color: '#6B7280' }}>{v}</span> },
  { key: 'role',      label: 'Role',       width: 132, render: v => <span style={{ fontSize: 9, color: '#6B7280' }}>{v}</span> },
  { key: 'status',    label: 'Status',     width: 68, render: v => {
    const s = USER_STATUS[v] ?? USER_STATUS.Active;
    return <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 5, color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>{v}</span>;
  }},
  { key: 'lastLogin', label: 'Last Login', width: 148, render: v => <span style={{ fontSize: 9, color: '#6B7280' }}>{v}</span> },
];

const AUDIT_COLS = [
  { key: 'time',      label: 'Time',       width: 140, render: v => <span style={{ fontSize: 9, color: '#6B7280' }}>{v}</span> },
  { key: 'user',      label: 'User',       width: 116 },
  { key: 'action',    label: 'Action',     width: 110, render: v => <span style={{ fontSize: 9, color: '#6B7280' }}>{v}</span> },
  { key: 'resource',  label: 'Resource',   render: v => <span style={{ fontSize: 9, color: '#6B7280' }}>{v}</span> },
  { key: 'ipAddress', label: 'IP Address', width: 110, render: v => <span style={{ fontSize: 9, fontFamily: 'ui-monospace,monospace', color: '#6B7280' }}>{v}</span> },
];

// ─── Support Ticket icon keys by severity ─────────────────────────────────────
const TICKET_ICON_MAP = {
  Critical: { iconKey: 'AlertCircle',   iconColor: '#EF4444' },
  High:     { iconKey: 'AlertTriangle', iconColor: '#F59E0B' },
  Medium:   { iconKey: 'AlertCircle',   iconColor: '#F97316' },
  Low:      { iconKey: 'Info',          iconColor: '#3B82F6' },
};

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function AdministrationPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [drawer, setDrawer] = useState(null); // { kind: 'user'|'audit', data }
  const closeDrawer = () => setDrawer(null);

  // Live data uploaded via /eai/administration/data-import (Users + System
  // Health/Resource/Security/Audit/Storage/Tickets/Licenses sheets). Falls
  // back to the bundled demo dataset until the user has uploaded Users rows.
  const [liveData, setLiveData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/eai/administration')
      .then(res => (res.ok ? res.json() : null))
      .then(json => { if (!cancelled && json?.live) setLiveData(json.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const isLive = !!liveData;
  const KPIS               = liveData?.kpis ?? mockKPIS;
  const USERS_BY_ROLE       = liveData?.usersByRole ?? mockUSERS_BY_ROLE;
  const SYSTEM_HEALTH       = liveData?.systemHealth ?? mockSYSTEM_HEALTH;
  const RECENT_ACTIVITY     = liveData?.recentActivity ?? mockRECENT_ACTIVITY;
  const RECENT_USERS        = liveData?.recentUsers ?? mockRECENT_USERS;
  const SYSTEM_RESOURCE_USAGE = liveData?.systemResourceUsage ?? mockSYSTEM_RESOURCE_USAGE;
  const SECURITY_OVERVIEW   = liveData?.securityOverview ?? mockSECURITY_OVERVIEW;
  const AUDIT_LOGS          = liveData?.auditLogs ?? mockAUDIT_LOGS;
  const STORAGE_OVERVIEW    = liveData?.storageOverview ?? mockSTORAGE_OVERVIEW;
  const SUPPORT_TICKETS     = liveData?.supportTickets ?? mockSUPPORT_TICKETS;
  const LICENSES_USAGE      = liveData?.licensesUsage ?? mockLICENSES_USAGE;

  // StatRowList item arrays built from mock data
  const healthItems = SYSTEM_HEALTH.map(h => ({
    label:      h.label,
    statusPill: h.status,
  }));

  const securityItems = SECURITY_OVERVIEW.map(s => ({
    label:    s.label,
    value:    s.value,
    delta:    s.delta,
    deltaUp:  s.deltaUp,
  }));

  const ticketItems = SUPPORT_TICKETS.map(t => ({
    ...TICKET_ICON_MAP[t.severity],
    label:   t.severity,
    value:   t.count,
    delta:   t.delta,
    deltaUp: t.deltaUp,
  }));

  const licenseItems = [
    { label: 'Total Licenses',     value: LICENSES_USAGE.totalLicenses.toLocaleString()                                      },
    { label: 'Used Licenses',      value: `${LICENSES_USAGE.usedLicenses.toLocaleString()} (${LICENSES_USAGE.usedPct}%)`     },
    { label: 'Available Licenses', value: `${LICENSES_USAGE.availableLicenses.toLocaleString()} (${LICENSES_USAGE.availablePct}%)` },
    { label: 'License Expiry',     value: LICENSES_USAGE.licenseExpiry, valueColor: '#EF4444'                                 },
    { label: 'Auto Renewal',       toggle: true, toggleInitial: LICENSES_USAGE.autoRenewal                                   },
  ];

  // ── Drawer content, by kind ────────────────────────────────────────────────
  function renderDrawer() {
    if (!drawer) return <DetailDrawer open={false} onClose={closeDrawer} />;
    const { kind, data } = drawer;

    if (kind === 'user') {
      const s = USER_STATUS[data.status] ?? USER_STATUS.Active;
      return (
        <DetailDrawer open title={data.name} subtitle={data.email} icon={<User size={16} color="#0077C8" />} accentColor="#0077C8" onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'Role', value: data.role },
            { label: 'Status', value: <DrawerPill label={data.status} color={s.color} /> },
          ]} />
          <p style={{ fontSize: 10, color: '#6B7280' }}>Last login <b style={{ color: '#1A1F36' }}>{data.lastLogin}</b></p>
        </DetailDrawer>
      );
    }

    if (kind === 'audit') {
      return (
        <DetailDrawer open title={data.action} subtitle={data.time} icon={<Clock size={16} color="#7C3AED" />} accentColor="#7C3AED" onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'User', value: data.user },
            { label: 'IP Address', value: data.ipAddress },
          ]} />
          <p style={{ fontSize: 10, color: '#6B7280' }}>Resource affected: <b style={{ color: '#1A1F36' }}>{data.resource}</b></p>
        </DetailDrawer>
      );
    }

    return <DetailDrawer open={false} onClose={closeDrawer} />;
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* ── Sub-header ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid #E2E8F0',
          flexShrink: 0, background: '#F4F6F9',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 16, fontWeight: 800, color: '#1A1F36', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Administration</h1>
              <span
                title={isLive ? 'Showing data from your uploaded master template' : 'Showing bundled demo data — upload a master template to see your own data here'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                  padding: '3px 7px', borderRadius: 5,
                  color: isLive ? '#00A36C' : '#9CA3AF',
                  background: isLive ? 'rgba(0,163,108,0.12)' : '#F1F5F9',
                  border: `1px solid ${isLive ? 'rgba(0,163,108,0.3)' : '#E2E8F0'}`,
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: isLive ? '#00A36C' : '#9CA3AF', flexShrink: 0 }} />
                {isLive ? 'Live Data' : 'Demo Data'}
              </span>
            </div>
            <p style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>Manage users, roles, system settings and platform governance</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* System Status pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(0,163,108,0.10)', border: '1px solid rgba(0,163,108,0.25)',
              borderRadius: 8, padding: '5px 10px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00A36C', boxShadow: '0 0 5px #00A36C90', display: 'inline-block' }} />
              <span style={{ fontSize: 9, color: '#6B7280' }}>System Status</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#00A36C' }}>Healthy</span>
            </div>
            {/* Timestamp */}
            <button style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#F8FAFC', border: '1px solid #E2E8F0',
              borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
              color: '#6B7280', fontSize: 10,
            }}>
              May 31, 2025 10:30 AM <ChevronDown size={10} />
            </button>
            {/* Create button */}
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(0,119,200,0.50)' }}>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'linear-gradient(135deg, #0077C8 0%, #005EA6 100%)',
                border: 'none', padding: '5px 12px', cursor: 'pointer',
                color: '#fff', fontSize: 10, fontWeight: 600,
              }}>
                <Plus size={11} /> Create
              </button>
              <button style={{
                background: '#005EA6', border: 'none',
                borderLeft: '1px solid rgba(0,119,200,0.50)',
                padding: '5px 7px', cursor: 'pointer', color: '#fff',
              }}>
                <ChevronDown size={10} />
              </button>
            </div>
            <QuickActionsMenu items={[
              { iconKey: 'UserPlus',        label: 'Add User'               },
              { iconKey: 'UserCog',         label: 'Create Role'            },
              { iconKey: 'SlidersHorizontal',label: 'System Settings'       },
              { iconKey: 'ClipboardList',   label: 'View Audit Logs'        },
              { iconKey: 'Ticket',          label: 'Create Support Ticket'  },
              { iconKey: 'UploadCloud',     label: 'Import EAI Master Data', href: '/eai/administration/data-import' },
            ]} />
          </div>
        </div>

        {/* ── Scrollable body ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: GAP }}>

          {/* ── 7 KPI cards ─────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: GAP }}>
            {KPIS.map(k => <KpiCard key={k.label} {...k} />)}
          </div>

          {/* ── Row 1: User Activity | Users by Role | System Health | Recent Activity ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.78fr 0.9fr', gap: GAP, alignItems: 'start' }}>

            {/* User Activity */}
            <div style={CARD}>
              <div style={CARD_HDR}>
                <span style={CARD_TITLE}>User Activity (Last 7 Days)</span>
                <button style={DROPDOWN_BTN}>Last 7 Days <ChevronDown size={9} /></button>
              </div>
              <div style={{ padding: '10px 14px 8px' }}>
                <UserActivityChart data={USER_ACTIVITY} height={155} />
              </div>
              <div style={{ padding: '0 14px 10px' }}>
                <a href="#" style={LINK_STYLE}>View full analytics →</a>
              </div>
            </div>

            {/* Users by Role */}
            <div style={{ ...CARD, display: 'flex', flexDirection: 'column' }}>
              <div style={CARD_HDR}><span style={CARD_TITLE}>Users by Role</span></div>
              <div style={{ padding: '12px 14px 6px' }}>
                <DonutChart
                  data={USERS_BY_ROLE}
                  centerLabel="1,248"
                  centerSublabel="Total Users"
                  height={160}
                  innerRadius={48}
                  outerRadius={70}
                />
              </div>
              <div style={{ padding: '0 14px 10px' }}>
                <a href="#" style={LINK_STYLE}>Manage roles →</a>
              </div>
            </div>

            {/* System Health */}
            <div style={{ ...CARD, display: 'flex', flexDirection: 'column' }}>
              <div style={CARD_HDR}><span style={CARD_TITLE}>System Health</span></div>
              <div style={{ padding: '4px 0 4px' }}>
                <StatRowList items={healthItems} />
              </div>
              <div style={{ padding: '6px 14px 10px', borderTop: '1px solid #E2E8F0' }}>
                <a href="#" style={LINK_STYLE}>View system status →</a>
              </div>
            </div>

            {/* Recent Activity */}
            <ListCard
              title="Recent Activity"
              viewAllHref="#"
              items={RECENT_ACTIVITY}
              variant="alerts"
            />
          </div>

          {/* ── Row 2: Recent Users | System Resource Usage | Security Overview ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 0.85fr 1fr', gap: GAP, alignItems: 'start' }}>

            {/* Recent Users */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <DataTable
                title="Recent Users"
                viewAllHref="#"
                viewAllLabel="View all"
                columns={USER_COLS}
                data={RECENT_USERS}
                keyField="id"
                onRowDoubleClick={u => setDrawer({ kind: 'user', data: u })}
                compact
              />
              <a href="#" style={{ ...LINK_STYLE, paddingLeft: 2 }}>Manage users →</a>
            </div>

            {/* System Resource Usage */}
            <div style={CARD}>
              <div style={CARD_HDR}><span style={CARD_TITLE}>System Resource Usage</span></div>
              <div style={{ padding: '12px 14px 8px' }}>
                <HorizontalBarList
                  items={SYSTEM_RESOURCE_USAGE}
                  maxValue={100}
                  unit="%"
                  labelWidth={80}
                />
              </div>
              <div style={{ padding: '4px 14px 10px' }}>
                <a href="#" style={LINK_STYLE}>View details</a>
              </div>
            </div>

            {/* Security Overview */}
            <div style={{ ...CARD, display: 'flex', flexDirection: 'column' }}>
              <div style={CARD_HDR}>
                <span style={CARD_TITLE}>Security Overview</span>
                <a href="#" style={VIEW_ALL}>View report</a>
              </div>
              <div style={{ padding: '4px 0 4px' }}>
                <StatRowList items={securityItems} />
              </div>
            </div>
          </div>

          {/* ── Row 3: Audit Logs | Storage Overview | Support Tickets | Licenses ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.85fr 0.75fr 0.9fr', gap: GAP, alignItems: 'start', paddingBottom: 20 }}>

            {/* Audit Logs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <DataTable
                title="Audit Logs (Latest)"
                viewAllHref="#"
                viewAllLabel="View all"
                columns={AUDIT_COLS}
                data={AUDIT_LOGS}
                keyField="id"
                onRowDoubleClick={a => setDrawer({ kind: 'audit', data: a })}
                compact
              />
              <a href="#" style={{ ...LINK_STYLE, paddingLeft: 2 }}>View all audit logs →</a>
            </div>

            {/* Storage Overview */}
            <div style={{ ...CARD, display: 'flex', flexDirection: 'column' }}>
              <div style={CARD_HDR}>
                <span style={CARD_TITLE}>Storage Overview</span>
                <a href="#" style={VIEW_ALL}>View details</a>
              </div>
              <div style={{ padding: '12px 14px 8px' }}>
                <DonutChart
                  data={STORAGE_OVERVIEW.breakdown}
                  centerLabel={STORAGE_OVERVIEW.totalUsedTb}
                  centerUnit=" TB"
                  centerSublabel="Total Used"
                  height={155}
                  innerRadius={46}
                  outerRadius={66}
                />
              </div>
            </div>

            {/* Support Tickets */}
            <div style={{ ...CARD, display: 'flex', flexDirection: 'column' }}>
              <div style={CARD_HDR}><span style={CARD_TITLE}>Support Tickets</span></div>
              <div style={{ padding: '4px 0 4px' }}>
                <StatRowList items={ticketItems} />
              </div>
              <div style={{ padding: '6px 14px 10px', borderTop: '1px solid #E2E8F0' }}>
                <a href="#" style={LINK_STYLE}>Create Ticket →</a>
              </div>
            </div>

            {/* Licenses & Usage */}
            <div style={{ ...CARD, display: 'flex', flexDirection: 'column' }}>
              <div style={CARD_HDR}>
                <span style={CARD_TITLE}>Licenses &amp; Usage</span>
                <a href="#" style={VIEW_ALL}>View details</a>
              </div>
              <div style={{ padding: '4px 0 4px' }}>
                <StatRowList items={licenseItems} />
              </div>
            </div>

          </div>
        </div>
      </div>

      {renderDrawer()}
    </div>
  );
}
