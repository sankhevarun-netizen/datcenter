'use client';
import { useState, useMemo, useRef } from 'react';
import {
  ShoppingCart, FileText, Truck, Warehouse, Package, TrendingUp, CheckCircle, Star,
  Eye, MoreVertical, ExternalLink, ChevronDown,
  AlertCircle, ArrowUpRight,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  ResponsiveContainer, Tooltip as RTooltip, Legend as RLegend,
} from 'recharts';

import {
  PURCHASE_ORDERS, SHIPMENTS, VENDORS, INVENTORY_BY_LOCATION,
  SPEND_BY_CATEGORY, LEAD_TIME_TREND, FLOW_STAGES, DEMAND_PLANNING,
  getPOStats, getInventoryTotal, getVendorKPIs, STATUS_COLORS,
} from '@/data/eaiSupplyChainMock';

import DonutChart    from '@/components/eai/widgets/DonutChart';
import FlowPipeline  from '@/components/eai/widgets/FlowPipeline';
import DataTable     from '@/components/eai/widgets/DataTable';
import RouteMap      from '@/components/eai/widgets/RouteMap';
import QuickActionsMenu from '@/components/eai/widgets/QuickActionsMenu';
import DetailDrawer, { DrawerTable, DrawerStatRow, DrawerPill } from '@/components/eai/widgets/DetailDrawer';
import { useToast } from '@/components/eai/widgets/Toast';

// ── export helper (same pattern used across the EAI platform) ───────────────
async function exportCsv(rows, filename) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
const BG   = '#F4F6F9';
const CARD = '#FFFFFF';
const BORD = '#E2E8F0';
const DIM  = '#6B7280';
const DIMMER = '#9CA3AF';
const PER_PAGE = 7;

// ─── Derived data (module-level, derived from arrays) ─────────────────────────
const poStats  = getPOStats();
const invTotal = getInventoryTotal();
const vndKPIs  = getVendorKPIs();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Card({ title, action, children, style }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)', ...style }}>
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${BORD}`, flexShrink: 0 }}>
          {title && <span style={{ fontSize: 11, fontWeight: 700, color: '#1A1F36' }}>{title}</span>}
          {action}
        </div>
      )}
      <div style={{ flex: 1, padding: 14 }}>{children}</div>
    </div>
  );
}

function DropBtn({ children }) {
  return (
    <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F8FAFC', border: `1px solid ${BORD}`, borderRadius: 7, padding: '4px 9px', cursor: 'pointer', color: DIM, fontSize: 9 }}>
      {children}
    </button>
  );
}

// Page-specific KPI card (supply chain icons don't fit the shared KpiCard icon dict)
function ScKpiCard({ label, value, unit, sublabel, delta, up, Icon, color, bg, onClick }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }) : undefined}
      style={{ background: CARD, border: `1px solid ${BORD}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, overflow: 'hidden', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)', cursor: onClick ? 'pointer' : 'default', transition: 'background 0.15s' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = '#F4F6F9'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.background = CARD; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={13} style={{ color }} />
        </div>
        <p style={{ fontSize: 8, color: DIM, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right', lineHeight: 1.3, height: '20.8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{label}</p>
      </div>
      <p style={{ fontSize: 20, fontWeight: 700, color: '#1A1F36', fontFamily: 'ui-monospace,monospace', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}{unit && <span style={{ fontSize: 11, color: DIM, marginLeft: 2 }}>{unit}</span>}
      </p>
      {sublabel && <p style={{ fontSize: 9, color: DIMMER, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sublabel}</p>}
      {delta && (
        <p style={{ fontSize: 8, fontWeight: 600, color: up ? '#00A36C' : '#DC2626', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginTop: 'auto' }}>
          {up ? '↑' : '↓'} {delta}
        </p>
      )}
    </div>
  );
}

// Status badge
function StatusBadge({ status }) {
  const m = STATUS_COLORS[status] ?? { color: '#6B7280', bg: 'rgba(107,114,128,0.15)' };
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, color: m.color, background: m.bg, border: `1px solid ${m.color}44`, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

// Quality score badge
function QScore({ score }) {
  const color = score >= 85 ? '#00A36C' : score >= 75 ? '#F59E0B' : '#DC2626';
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: color + '18', border: `1px solid ${color}44`, borderRadius: 5, padding: '2px 6px', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap' }}>
      {score}/100
    </span>
  );
}

// Utilization bar
function UtilBar({ pct }) {
  const color = pct >= 75 ? '#EF4444' : pct >= 50 ? '#F59E0B' : '#00A36C';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <div style={{ flex: 1, height: 5, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden', minWidth: 40 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 9, color: DIM, width: 28, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
    </div>
  );
}

// PO progress bar
function ProgressBar({ pct, status }) {
  const m = STATUS_COLORS[status] ?? { color: '#6B7280' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden', minWidth: 50 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: m.color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 9, color: DIM, width: 28, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
    </div>
  );
}

// ─── PO table column definitions ─────────────────────────────────────────────
const PO_COLS = [
  { key:'poNumber',     label:'PO Number',      width: 104, render: v => <span style={{ color:'#0077C8', fontWeight:600, fontFamily:'ui-monospace,monospace', fontSize:9 }}>{v}</span> },
  { key:'vendor',       label:'Vendor',          width: 132 },
  { key:'category',     label:'Category',        width: 100 },
  { key:'orderDate',    label:'Order Date',      width: 92  },
  { key:'expectedDate', label:'Expected Date',   width: 92  },
  { key:'valueFmt',     label:'Value',           width: 70, align:'right', render: v => <span style={{ fontWeight:700, color:'#1A1F36', fontFamily:'ui-monospace,monospace' }}>{v}</span> },
  { key:'status',       label:'Status',          width: 100, render: v => <StatusBadge status={v} /> },
  { key:'progressPct',  label:'Progress',        width: 120, render: (v, row) => <ProgressBar pct={v} status={row.status} /> },
  { key:'_actions',     label:'Actions',         width: 58, render: () => (
    <div style={{ display:'flex', gap:6 }}>
      <button style={{ background:'none',border:'none',cursor:'pointer',color:DIM,padding:2 }}><Eye size={12}/></button>
      <button style={{ background:'none',border:'none',cursor:'pointer',color:DIM,padding:2 }}><MoreVertical size={12}/></button>
    </div>
  )},
];

// Shipment table columns
const SHIP_COLS = [
  { key:'shipmentId',  label:'Shipment ID',  width: 104, render: v => <span style={{ color:'#0077C8', fontFamily:'ui-monospace,monospace', fontSize:9 }}>{v}</span> },
  { key:'origin',      label:'Origin',        width: 94  },
  { key:'destination', label:'Destination',   width: 80  },
  { key:'eta',         label:'ETA',           width: 88  },
  { key:'status',      label:'Status',        width: 84, render: v => <StatusBadge status={v} /> },
  { key:'trackingUrl', label:'Tracking', width:60, render: () => <a href="#" style={{ color:'#0077C8' }}><ExternalLink size={11}/></a> },
];

// ─── PO tab config ────────────────────────────────────────────────────────────
const PO_TABS = ['All','Open','Confirmed','In Transit','At Warehouse','Delivered','Cancelled'].map(s => ({
  key: s,
  label: s,
  count: s === 'All' ? PURCHASE_ORDERS.length : PURCHASE_ORDERS.filter(p => p.status === s).length,
}));

// ─── Demand Planning quarterly forecast colors ────────────────────────────────
const Q_COLORS = { itHardware:'#0077C8', networking:'#7C3AED', powerCooling:'#F59E0B', others:'#6B7280' };

// Flow-stage key → PO status (drives "click stage → filter Purchase Orders")
const STAGE_TO_STATUS = {
  ordered:   'Open',
  confirmed: 'Confirmed',
  intransit: 'In Transit',
  warehouse: 'At Warehouse',
  delivered: 'Delivered',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SupplyChainPage() {
  const [activeSection, setActiveSection] = useState(null);
  const [activeTab,     setActiveTab]     = useState('All');
  const [poPage,        setPoPage]        = useState(1);
  const [highlightKey,  setHighlightKey]  = useState(null);
  const [drawer,        setDrawer]        = useState(null); // { kind: 'po'|'shipment'|'vendor'|'inventory', data }
  const closeDrawer = () => setDrawer(null);
  const { showToast, ToastHost } = useToast();

  async function handleExportInventory() {
    try {
      const rows = INVENTORY_BY_LOCATION.map(l => ({ Location: l.location, 'On Hand Value ($M)': l.onHandValue, 'On Hand Qty': l.onHandQty, 'Utilization (%)': l.utilizationPct }));
      await exportCsv(rows, `supply-chain-inventory-${new Date().toISOString().slice(0, 10)}.csv`);
      showToast(`Exported inventory for ${rows.length} locations`, 'success');
    } catch {
      showToast('Export failed — please try again', 'error');
    }
  }

  // Filter POs by tab
  const filteredPOs = useMemo(() =>
    activeTab === 'All' ? PURCHASE_ORDERS : PURCHASE_ORDERS.filter(p => p.status === activeTab),
    [activeTab]
  );
  const poTotal    = filteredPOs.length;
  const poPageData = filteredPOs.slice((poPage - 1) * PER_PAGE, poPage * PER_PAGE);

  const handleTab = tab => { setActiveTab(tab); setPoPage(1); };

  // Refs for "click card/stage → jump to the underlying list" navigation
  const poSectionRef  = useRef(null);
  const leadTimeRef   = useRef(null);
  const inventoryRef  = useRef(null);
  const vendorsRef    = useRef(null);

  const scrollToSection = (ref, key) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlightKey(key);
    window.clearTimeout(scrollToSection._t);
    scrollToSection._t = window.setTimeout(() => setHighlightKey(null), 1800);
  };

  // Jump to the Purchase Orders table filtered to a given status
  const goToPOStatus = status => {
    setActiveTab(status);
    setPoPage(1);
    scrollToSection(poSectionRef, 'po');
  };

  // Budget allocation data for donut
  const budgetPct  = Math.round((DEMAND_PLANNING.budgetUsedM / DEMAND_PLANNING.budgetTotalM) * 100);
  const budgetDonut = [
    { name: 'Used',      value: budgetPct,       color: '#7C3AED' },
    { name: 'Remaining', value: 100 - budgetPct, color: '#E2E8F0' },
  ];

  // ── Drawer content, by kind ────────────────────────────────────────────────
  function renderDrawer() {
    if (!drawer) return <DetailDrawer open={false} onClose={closeDrawer} />;
    const { kind, data } = drawer;

    if (kind === 'po') {
      return (
        <DetailDrawer open title={data.poNumber} subtitle={data.vendor} icon={<FileText size={16} color="#0077C8" />} accentColor="#0077C8" onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'Value', value: data.valueFmt },
            { label: 'Progress', value: `${data.progressPct}%` },
            { label: 'Category', value: data.category },
          ]} />
          <DrawerTable
            columns={[{ key: 'label', label: 'Field' }, { key: 'value', label: 'Detail' }]}
            rows={[
              { id: 'status',   label: 'Status',        value: <DrawerPill label={data.status} color={STATUS_COLORS[data.status]?.color ?? '#6B7280'} /> },
              { id: 'ordered',  label: 'Order Date',     value: data.orderDate },
              { id: 'expected', label: 'Expected Date',  value: data.expectedDate },
              { id: 'vendor',   label: 'Vendor',         value: data.vendor },
            ]}
            keyField="id"
          />
        </DetailDrawer>
      );
    }

    if (kind === 'shipment') {
      return (
        <DetailDrawer open title={data.shipmentId} subtitle={`${data.origin} → ${data.destination}`} icon={<Truck size={16} color="#06B6D4" />} accentColor="#06B6D4" onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'ETA', value: data.eta },
            { label: 'Status', value: data.status },
          ]} />
          <p style={{ fontSize: 10, color: DIM }}>Origin <b style={{ color: '#1A1F36' }}>{data.origin}</b> → Destination <b style={{ color: '#1A1F36' }}>{data.destination}</b></p>
        </DetailDrawer>
      );
    }

    if (kind === 'vendor') {
      return (
        <DetailDrawer open title={data.name} subtitle="Supplier scorecard" icon={<Star size={16} color="#F59E0B" />} accentColor="#F59E0B" onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'Spend (YTD)', value: `$${data.spendYtd}M` },
            { label: 'On-Time Delivery', value: `${data.onTimeDeliveryPct}%`, color: '#00A36C' },
            { label: 'Quality Score', value: `${data.qualityScore}/100` },
          ]} />
          <p style={{ fontSize: 10, color: DIM }}>All active purchase orders with {data.name} are visible in the Purchase Orders table above — filter by vendor there for the full history.</p>
        </DetailDrawer>
      );
    }

    if (kind === 'inventory') {
      return (
        <DetailDrawer open title={data.location} subtitle="Spares & inventory" icon={<Warehouse size={16} color="#10B981" />} accentColor="#10B981" onClose={closeDrawer}>
          <DrawerStatRow items={[
            { label: 'On Hand Value', value: `$${data.onHandValue}M` },
            { label: 'On Hand Qty', value: data.onHandQty.toLocaleString() },
            { label: 'Utilization', value: `${data.utilizationPct}%` },
          ]} />
        </DetailDrawer>
      );
    }

    return <DetailDrawer open={false} onClose={closeDrawer} />;
  }

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BG }}>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

          {/* Page header (inside scroll area) */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 700, color: '#1A1F36', lineHeight: 1 }}>Supply Chain</h1>
              <p style={{ fontSize: 11, color: DIM, marginTop: 3 }}>End-to-end visibility of asset procurement, logistics and fulfillment</p>
            </div>
            <QuickActionsMenu items={[
              { iconKey: 'ShoppingCart',label: 'Create Purchase Order' },
              { iconKey: 'Search',      label: 'Track Shipment'        },
              { iconKey: 'FileCheck',   label: 'GRN (Goods Receipt)'   },
              { iconKey: 'Truck',       label: 'Create Supplier'       },
              { iconKey: 'Download',    label: 'Export Inventory', onClick: handleExportInventory },
            ]} />
          </div>

          {/* ── 8 KPI cards ─────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, flexShrink: 0 }}>
            <ScKpiCard label="Total PO Value"        value={`$${poStats.totalValueM}M`} delta="18.4% vs last 30 days" up Icon={ShoppingCart} color="#0077C8" bg="rgba(0,119,200,0.18)" onClick={() => goToPOStatus('All')} />
            <ScKpiCard label="Open POs"              value={poStats.openCount} sublabel={`$${poStats.openValueM}M`} delta="12 vs last month" up Icon={FileText} color="#7C3AED" bg="rgba(124,58,237,0.18)" onClick={() => goToPOStatus('Open')} />
            <ScKpiCard label="In Transit"            value={poStats.inTransitCount} sublabel={`$${poStats.inTransitValueM}M`} delta="5 vs last month" up Icon={Truck} color="#06B6D4" bg="rgba(6,182,212,0.18)" onClick={() => goToPOStatus('In Transit')} />
            <ScKpiCard label="Received (This Month)" value={poStats.receivedCount} sublabel={`$${poStats.receivedValueM}M`} delta="16 vs last month" up Icon={Package} color="#F59E0B" bg="rgba(245,158,11,0.18)" onClick={() => goToPOStatus('Delivered')} />
            <ScKpiCard label="Inventory Value"       value={`$${invTotal.totalM}M`} delta="6.7% vs last month" up Icon={Warehouse} color="#10B981" bg="rgba(16,185,129,0.18)" onClick={() => scrollToSection(inventoryRef, 'inventory')} />
            <ScKpiCard label="Avg Lead Time"         value="18.6" unit="Days" delta="2.1 days vs last month" up={false} Icon={TrendingUp} color="#0077C8" bg="rgba(0,119,200,0.18)" onClick={() => scrollToSection(leadTimeRef, 'leadtime')} />
            <ScKpiCard label="On-Time Delivery"      value={`${vndKPIs.onTimeDeliveryPct}%`} delta="3.6% vs last month" up Icon={CheckCircle} color="#00A36C" bg="rgba(0,163,108,0.18)" onClick={() => scrollToSection(vendorsRef, 'vendors')} />
            <ScKpiCard label="Supplier Score (Avg)"  value={vndKPIs.avgQualityScore} unit="/100" delta="4.2 vs last month" up Icon={Star} color="#F59E0B" bg="rgba(245,158,11,0.18)" onClick={() => scrollToSection(vendorsRef, 'vendors')} />
          </div>

          {/* ── Row: Flow | Donut | TrendChart ──────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px 300px', gap: 10, flexShrink: 0, alignItems: 'stretch' }}>

            {/* Supply Chain Flow */}
            <Card title="Supply Chain Flow">
              <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                <FlowPipeline
                  stages={FLOW_STAGES}
                  onStageClick={stage => goToPOStatus(STAGE_TO_STATUS[stage.key] ?? 'All')}
                />
              </div>
            </Card>

            {/* Spend by Category */}
            <Card title="Spend by Category">
              <DonutChart
                data={SPEND_BY_CATEGORY.map(c => ({ name: c.name, value: c.pct, color: c.color, mw: c.amountM }))}
                centerLabel="$248.7M"
                centerSublabel="Total Spend"
                height={140}
                innerRadius={44}
                outerRadius={62}
                showLegend
              />
            </Card>

            {/* Lead Time Trend (dual-line) */}
            <div ref={leadTimeRef} className={highlightKey === 'leadtime' ? 'sc-highlight' : ''} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <Card
                title="Lead Time Trend (Days)"
                action={<DropBtn>Last 6 Months <ChevronDown size={9} /></DropBtn>}
                style={{ flex: 1 }}
              >
                <div style={{ width: '100%', overflow: 'hidden' }}>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={LEAD_TIME_TREND} margin={{ top: 4, right: 6, bottom: 0, left: -28 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 7, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 7, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                      <RTooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 10, boxShadow: '0 2px 8px rgba(16,24,40,0.08)' }} itemStyle={{ color: '#1A1F36' }} labelStyle={{ color: '#6B7280', fontSize: 9 }} />
                      <Line type="monotone" dataKey="average" stroke="#0077C8" strokeWidth={2} dot={{ r: 3, fill: '#0077C8', strokeWidth: 0 }} name="Average Lead Time (Days)" />
                      <Line type="monotone" dataKey="target"  stroke="#00A36C" strokeWidth={2} dot={{ r: 3, fill: '#00A36C', strokeWidth: 0 }} name="Target Lead Time (Days)" strokeDasharray="5 3" />
                    </LineChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 14, marginTop: 4, justifyContent: 'center' }}>
                    {[{c:'#0077C8', l:'Average Lead Time (Days)'},{c:'#00A36C', l:'Target Lead Time (Days)'}].map(e => (
                      <div key={e.l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 8, color: DIM }}>
                        <span style={{ width: 16, height: 2, background: e.c, display: 'inline-block' }} />
                        {e.l}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* ── Purchase Orders table + Right column ──────────────────────── */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>

            {/* PO DataTable */}
            <div ref={poSectionRef} className={highlightKey === 'po' ? 'sc-highlight' : ''} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <DataTable
                title="Purchase Orders"
                tabs={PO_TABS}
                activeTab={activeTab}
                onTabChange={handleTab}
                columns={PO_COLS}
                data={poPageData}
                keyField="poNumber"
                onRowDoubleClick={po => setDrawer({ kind: 'po', data: po })}
                pagination={{ page: poPage, perPage: PER_PAGE, total: poTotal, onChange: setPoPage }}
                style={{ flex: 1 }}
              />
            </div>

            {/* Right column: Shipments + Map */}
            <div style={{ width: 374, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Shipments in Transit */}
              <DataTable
                title="Shipments in Transit"
                viewAllHref="#"
                columns={SHIP_COLS}
                data={SHIPMENTS.filter(s => s.status === 'In Transit')}
                keyField="shipmentId"
                onRowDoubleClick={s => setDrawer({ kind: 'shipment', data: s })}
                compact
              />

              {/* Deliveries Map */}
              <RouteMap
                shipments={SHIPMENTS}
                height={260}
                title="Deliveries Map"
              />
            </div>
          </div>

          {/* ── Bottom row ───────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>

            {/* Inventory by Location */}
            <div ref={inventoryRef} className={highlightKey === 'inventory' ? 'sc-highlight' : ''} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <DataTable
                title="Inventory by Location"
                viewAllHref="#"
                columns={[
                  { key:'location',      label:'Location',       width:160 },
                  { key:'onHandValue',   label:'On Hand Value',  width:96,  align:'right', render: v => <span style={{ fontWeight:700, fontFamily:'ui-monospace,monospace' }}>${v}M</span> },
                  { key:'onHandQty',     label:'On Hand Qty',    width:80,  align:'right', render: v => v.toLocaleString() },
                  { key:'utilizationPct',label:'Utilization',    render:(v) => <UtilBar pct={v} /> },
                ]}
                data={INVENTORY_BY_LOCATION}
                keyField="location"
                onRowDoubleClick={loc => setDrawer({ kind: 'inventory', data: loc })}
                compact
                style={{ flex: 1 }}
              />
            </div>

            {/* Top Vendors by Spend */}
            <div ref={vendorsRef} className={highlightKey === 'vendors' ? 'sc-highlight' : ''} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <DataTable
                title="Top Vendors by Spend"
                viewAllHref="#"
                columns={[
                  { key:'name',                label:'Vendor',            width:148 },
                  { key:'spendYtd',            label:'Spend (YTD)',       width:80, align:'right', render: v => <span style={{ fontWeight:700, fontFamily:'ui-monospace,monospace' }}>${v}M</span> },
                  { key:'onTimeDeliveryPct',   label:'On-Time Delivery',  width:104, align:'right', render: v => <span style={{ color:'#00A36C', fontWeight:600 }}>{v}%</span> },
                  { key:'qualityScore',        label:'Quality Score',     width:90, render: v => <QScore score={v} /> },
                ]}
                data={VENDORS}
                keyField="name"
                onRowDoubleClick={v => setDrawer({ kind: 'vendor', data: v })}
                compact
                style={{ flex: 1 }}
              />
            </div>

            {/* Demand Planning Overview */}
            <Card title="Demand Planning Overview"
              action={<a href="#" style={{ fontSize:9, color:DIM, textDecoration:'none' }}>View All</a>}
              style={{ flex: 1.2, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>

                {/* Stat tiles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 110 }}>
                  {[
                    { label:'Assets Reaching EOL\n(Next 12 Months)', value: DEMAND_PLANNING.assetsReachingEol, delta: DEMAND_PLANNING.eolDelta, up: true, color: '#F59E0B' },
                    { label:'Forecasted Demand\n(Next 12 Months)',   value: `$${DEMAND_PLANNING.forecastedDemandM}M`, delta: DEMAND_PLANNING.forecastDelta, up: true, color: '#0077C8' },
                  ].map(tile => (
                    <div key={tile.label} style={{ background: '#F8FAFC', border: `1px solid ${BORD}`, borderRadius: 10, padding: '8px 10px' }}>
                      <p style={{ fontSize: 8, color: DIM, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{tile.label}</p>
                      <p style={{ fontSize: 22, fontWeight: 700, color: '#1A1F36', fontFamily: 'ui-monospace,monospace', lineHeight: 1.2 }}>{tile.value}</p>
                      <p style={{ fontSize: 8, color: tile.up ? '#00A36C' : '#DC2626', marginTop: 2 }}>
                        {tile.up ? '↑' : '↓'} {tile.delta} vs last month
                      </p>
                    </div>
                  ))}
                </div>

                {/* Budget Allocation donut */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '0 0 110px' }}>
                  <p style={{ fontSize: 9, color: DIM, textAlign: 'center', marginBottom: 2 }}>Budget Allocation</p>
                  <DonutChart
                    data={budgetDonut}
                    centerLabel={`${budgetPct}%`}
                    height={110}
                    innerRadius={32}
                    outerRadius={46}
                    showLegend={false}
                  />
                  <p style={{ fontSize: 8, color: DIMMER, textAlign: 'center' }}>${DEMAND_PLANNING.budgetUsedM}M / ${DEMAND_PLANNING.budgetTotalM}M</p>
                </div>

                {/* Quarterly Demand Forecast bars */}
                <div style={{ flex: 1, minWidth: 120 }}>
                  <p style={{ fontSize: 9, color: DIM, marginBottom: 6 }}>Quarterly Demand Forecast</p>
                  <div style={{ width: '100%', overflow: 'hidden' }}>
                    <ResponsiveContainer width="100%" height={130}>
                      <BarChart data={DEMAND_PLANNING.quarterlyForecast} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                        <XAxis dataKey="quarter" tick={{ fontSize: 7, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 7, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                        <RTooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 10, boxShadow: '0 2px 8px rgba(16,24,40,0.08)' }} itemStyle={{ color: '#1A1F36' }} />
                        <Bar dataKey="itHardware"   fill={Q_COLORS.itHardware}   stackId="a" radius={[0,0,0,0]} maxBarSize={28} name="IT Hardware" />
                        <Bar dataKey="networking"   fill={Q_COLORS.networking}   stackId="a" maxBarSize={28} name="Networking" />
                        <Bar dataKey="powerCooling" fill={Q_COLORS.powerCooling} stackId="a" maxBarSize={28} name="Power & Cooling" />
                        <Bar dataKey="others"       fill={Q_COLORS.others}       stackId="a" radius={[2,2,0,0]} maxBarSize={28} name="Others" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      {Object.entries(Q_COLORS).map(([k, c]) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, color: DIM }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />
                          {k === 'itHardware' ? 'IT Hardware' : k === 'powerCooling' ? 'Power & Cooling' : k.charAt(0).toUpperCase() + k.slice(1)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Bottom spacer */}
          <div style={{ height: 8, flexShrink: 0 }} />
        </div>
      </div>

      {renderDrawer()}
      <ToastHost />
    </div>
  );
}
