'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { X, MapPin, Boxes, AlertTriangle, ExternalLink } from 'lucide-react';
import { STATUS_COLORS, assetStatus } from '@/lib/assetPortfolioCalc';

const STATUS_LABEL = { green: 'Stable', amber: 'Watch', red: 'At Risk' };

function Row({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-grey-border/60 last:border-0">
      <span className="text-[11px] text-text-secondary">{label}</span>
      <span className="text-[11px] font-semibold text-text-primary">{value}</span>
    </div>
  );
}

export default function AssetDetailPanel({ asset, intelligence = [], onClose }) {
  const router = useRouter();
  if (!asset) return null;

  const status = assetStatus(asset, {});
  const assetIntel = intelligence.filter(i => i.asset_id === asset.asset_id);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 360, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 360, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="absolute top-0 right-0 h-full w-[360px] bg-white border-l border-grey-border shadow-2xl z-30 flex flex-col"
      >
        <div className="flex items-start justify-between px-4 py-3 border-b border-grey-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[status] }} />
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: STATUS_COLORS[status] }}>
                {STATUS_LABEL[status]}
              </span>
            </div>
            <p className="font-extrabold text-text-primary text-sm mt-1 truncate" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
              {asset.asset_name}
            </p>
            <p className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5">
              <MapPin size={10} /> {asset.city}{asset.country ? `, ${asset.country}` : ''} · {asset.asset_id}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-grey-bg text-text-secondary flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-grey-bg rounded-lg p-2.5">
              <p className="text-[9px] text-text-muted uppercase tracking-wide">IT Capacity</p>
              <p className="text-sm font-bold text-text-primary font-mono">{asset.total_it_capacity_mw ?? '—'} MW</p>
            </div>
            <div className="bg-grey-bg rounded-lg p-2.5">
              <p className="text-[9px] text-text-muted uppercase tracking-wide">Utilization</p>
              <p className="text-sm font-bold text-text-primary font-mono">{asset.utilization_pct ?? '—'}%</p>
            </div>
            <div className="bg-grey-bg rounded-lg p-2.5">
              <p className="text-[9px] text-text-muted uppercase tracking-wide">PUE</p>
              <p className="text-sm font-bold text-text-primary font-mono">{asset.pue ?? '—'}</p>
            </div>
            <div className="bg-grey-bg rounded-lg p-2.5">
              <p className="text-[9px] text-text-muted uppercase tracking-wide">Tier</p>
              <p className="text-sm font-bold text-text-primary font-mono">{asset.tier_rating ?? '—'}</p>
            </div>
          </div>

          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1">Ownership & Financials</p>
          <div className="mb-4">
            <Row label="Ownership Type" value={asset.ownership_type} />
            <Row label="Facility Status" value={asset.facility_status} />
            <Row label="Current Valuation" value={asset.current_valuation_m ? `$${asset.current_valuation_m}M` : null} />
            <Row label="Capex Remaining" value={asset.capex_remaining_m ? `$${asset.capex_remaining_m}M` : null} />
            <Row label="Lease Expiry" value={asset.lease_expiry_date} />
            <Row label="Annual Rent" value={asset.annual_rent_m ? `$${asset.annual_rent_m}M` : null} />
            <Row label="PPA Provider" value={asset.ppa_provider} />
            <Row label="PPA Rate" value={asset.ppa_rate_usd_mwh ? `$${asset.ppa_rate_usd_mwh}/MWh` : null} />
            <Row label="PPA Expiry" value={asset.ppa_expiry_date} />
          </div>

          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted mb-1.5 flex items-center gap-1">
            <AlertTriangle size={11} /> Live Intelligence
          </p>
          <div className="space-y-2 mb-4">
            {assetIntel.length === 0 && <p className="text-[11px] text-text-muted">No active flags for this asset.</p>}
            {assetIntel.map((i, idx) => (
              <div key={idx} className="bg-amber-light border border-amber/20 rounded-lg p-2">
                <p className="text-[10px] font-semibold text-text-primary">{i.headline}</p>
                <p className="text-[10px] text-text-secondary mt-0.5">{i.summary}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-grey-border flex-shrink-0">
          <button
            onClick={() => router.push(`/asset-portfolio/${asset.asset_id}/twin`)}
            className="w-full flex items-center justify-center gap-2 bg-navy hover:bg-[#002A73] text-white text-xs font-semibold py-2.5 rounded-lg transition-colors"
          >
            <Boxes size={14} /> Open Digital Twin <ExternalLink size={12} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
