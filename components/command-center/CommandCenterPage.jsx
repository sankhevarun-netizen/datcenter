'use client';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

import KPIStrip from './KPIStrip';
import PortfolioHealthMap from './PortfolioHealthMap';
import IncidentCommandCenter from './IncidentCommandCenter';
import InfrastructureHealthMatrix from './InfrastructureHealthMatrix';
import CapacityUtilization from './CapacityUtilization';
import SustainabilityIntel from './SustainabilityIntel';
import AIOperationsFeed from './AIOperationsFeed';
import ContextPanel from './ContextPanel';
import TenantSlaPanel from './TenantSlaPanel';
import CCLayout from './CCLayout';
import BenchmarkStrip from '@/components/nexus/BenchmarkStrip';
import BenchmarkScorecard from '@/components/nexus/BenchmarkScorecard';
import { commandCenterModel } from '@/lib/nexus/command-center';
import { nexus } from '@/lib/nexus/data';
import { timeLabel } from '@/lib/nexus/time';
import { usePersistentState } from '@/lib/use-persistent-state';
import { logEvent } from '@/lib/audit-client';

const rise = (delay) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay } });

export default function CommandCenterPage() {
  const model = useMemo(() => commandCenterModel(), []);
  const [facility, setFacility] = useState('MUM-1');
  const [statuses, setStatuses] = usePersistentState('alerts:statuses', {});

  return (
    <CCLayout title="Command Center">
      {({ showToast }) => (
        <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 pt-3 text-[11px] text-[#94A3B8]">Nexus Data Infrastructure · as of {timeLabel(model.asOf)}</div>
            <KPIStrip kpis={model.kpis} />
            <div className="px-4 pb-6 space-y-4">
              <motion.div {...rise(0.05)}>
                <PortfolioHealthMap regions={model.regions} selected={facility} onSelect={setFacility} />
              </motion.div>
              <motion.div {...rise(0.1)}>
                <IncidentCommandCenter incidents={model.incidents} statuses={statuses}
                  onAcknowledge={(id) => {
                    setStatuses((s) => ({ ...s, [id]: 'acknowledged' }));
                    logEvent('action', 'acknowledge alert', { facilityId: model.incidents.find((i) => i.id === id)?.facilityId, subject: id });
                    showToast(`${id} acknowledged`);
                  }} />
              </motion.div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <motion.div {...rise(0.15)}>
                  <InfrastructureHealthMatrix facilityName={model.infrastructure.facilityName} systems={model.infrastructure.systems} />
                </motion.div>
                <motion.div {...rise(0.2)}>
                  <CapacityUtilization capacity={model.capacity} />
                </motion.div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <motion.div {...rise(0.25)}>
                  <SustainabilityIntel data={model.sustainability} />
                </motion.div>
                <motion.div {...rise(0.3)}>
                  <AIOperationsFeed risks={model.risks} />
                </motion.div>
              </div>
              <motion.div {...rise(0.35)}>
                <TenantSlaPanel tenants={model.tenants} />
              </motion.div>
              <motion.div {...rise(0.4)} className="bg-white rounded-2xl border border-[#D8DCE3] shadow-sm p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="font-bold text-[#1A1F36] text-sm" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Peer Benchmarks</h2>
                    <p className="text-[#9CA3AF] text-xs mt-0.5">Against published Indian operator percentiles</p>
                  </div>
                  <select value={facility} onChange={(e) => setFacility(e.target.value)} aria-label="Facility to benchmark"
                    className="text-xs text-[#334155] bg-[#F0F2F5] border border-[#D8DCE3] rounded-lg px-3 py-1.5 focus:outline-none">
                    {nexus.facilities.map((f) => <option key={f.facility_id} value={f.facility_id}>{f.name}</option>)}
                  </select>
                </div>
                <BenchmarkStrip facilityId={facility} />
                <h3 className="font-bold text-[#1A1F36] text-sm mt-6 mb-2" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>Portfolio scorecard</h3>
                <BenchmarkScorecard />
              </motion.div>
            </div>
          </div>
          <ContextPanel context={model.context} tenants={model.tenants} />
        </div>
      )}
    </CCLayout>
  );
}
