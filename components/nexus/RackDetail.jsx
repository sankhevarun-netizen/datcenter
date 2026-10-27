'use client';
// Rack detail overlay for the twin: what the dataset knows about one rack —
// position, tenant, load against rating, the PDU and CRAH that serve it, and
// its estimated inlet temperature where sensors are on file.
import { useMemo } from 'react';
import { X } from 'lucide-react';
import { getRack, index } from '@/lib/nexus/data';
import { thermalMap, hasThermalData, ASHRAE } from '@/lib/nexus/thermal-model';
import { fmtUpTo } from '@/lib/nexus/format';

const MONO = { fontFamily: "'JetBrains Mono', monospace" };

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-3 text-[11px] py-0.5">
      <span className="text-white/45">{label}</span>
      <span className="text-white/90 text-right" style={MONO}>{children}</span>
    </div>
  );
}

export default function RackDetail({ rackId, left = 16, onClose }) {
  const rack = getRack(rackId);
  const inlet = useMemo(() => {
    if (!hasThermalData(rack.facility_id)) return null;
    return thermalMap(rack.facility_id).rows.find((r) => r.rowId === rack.row_id)?.racks.find((r) => r.rackId === rackId)?.baselineC ?? null;
  }, [rack, rackId]);
  const tenant = rack.tenant_id ? index.tenantById.get(rack.tenant_id) : null;
  const pct = rack.capacity_kw ? Math.round((rack.used_kw / rack.capacity_kw) * 100) : 0;

  return (
    <div className="absolute z-30 w-64 rounded-xl border border-white/10 bg-[#0b1526]/95 backdrop-blur px-3.5 py-3 shadow-2xl" style={{ left, top: 132 }} role="dialog" aria-label={`Rack ${rackId}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div>
          <p className="text-xs font-bold text-white" style={MONO}>{rackId}</p>
          <p className="text-[10px] text-white/45">Row {rack.row_id} · position {rack.position_in_row} · {index.hallById.get(rack.hall_id)?.name}</p>
        </div>
        <button onClick={onClose} aria-label="Close rack detail" className="text-white/40 hover:text-white"><X size={14} /></button>
      </div>
      <Row label="Status">{rack.status}</Row>
      <Row label="Tenant">{tenant ? tenant.name : '—'}</Row>
      <Row label="Load">{fmtUpTo(rack.used_kw, 1)} of {fmtUpTo(rack.capacity_kw, 1)} kW</Row>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden my-1"><div className="h-full rounded-full bg-[#3987e5]" style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <Row label="Power from">{rack.fed_by_pdu}</Row>
      <Row label="Cooled by">{rack.cooled_by_crah}</Row>
      <Row label="Size">{rack.u_height}U</Row>
      {inlet !== null && (
        <Row label="Inlet (estimate)">
          <span style={{ color: inlet >= ASHRAE.recommendedMaxC ? '#fbbf24' : undefined }}>{inlet} °C</span>
        </Row>
      )}
      {rack.note && <p className="text-[10px] text-white/45 mt-1.5">{rack.note}</p>}
    </div>
  );
}
