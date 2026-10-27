'use client';
import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Server, Thermometer } from 'lucide-react';
import HotspotCard from './HotspotCard';
import RackDetailPanel from './RackDetailPanel';

const ExteriorModel3D = dynamic(() => import('./ExteriorModel3D'), { ssr: false });
const InteriorModel3D = dynamic(() => import('./InteriorModel3D'), { ssr: false });
const ThermalHeatmapView = dynamic(() => import('../thermal/ThermalHeatmapView'), { ssr: false });
// Facilities in the Nexus dataset show the dataset-driven twin inside.
const NexusTwinPanel = dynamic(() => import('../nexus/NexusTwinPanel'), { ssr: false });
// Facilities with a full dataset layout get the twin studio: outer, inner and heatmap views.
const TwinStudio = dynamic(() => import('../nexus/TwinStudio'), { ssr: false });

export default function DigitalTwinViewer(props) {
  if (props.nexusFacilityId) return <TwinStudio facilityId={props.nexusFacilityId} />;
  return <LegacyTwinViewer {...props} />;
}

function LegacyTwinViewer({ dc, zoneHealth, onHotspotChange, isGenerated, nexusFacilityId = null }) {
  const [view, setView] = useState('exterior');
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [activeRackId, setActiveRackId] = useState(null);
  const containerRef = useRef(null);

  const handleHotspotClick = useCallback((zoneId, canvasPos) => {
    setActiveRackId(null);
    setActiveHotspot({ zoneId, position: canvasPos });
    onHotspotChange?.(zoneId);
  }, [onHotspotChange]);

  const handleRackClick = useCallback((rackId) => {
    setActiveHotspot(null);
    onHotspotChange?.(null);
    setActiveRackId(rackId);
  }, [onHotspotChange]);

  const handleClose = useCallback(() => {
    setActiveHotspot(null);
    setActiveRackId(null);
    onHotspotChange?.(null);
  }, [onHotspotChange]);

  const handleToggle = (newView) => {
    setActiveHotspot(null);
    setActiveRackId(null);
    onHotspotChange?.(null);
    setView(newView);
  };

  const zoneData = activeHotspot ? zoneHealth?.[activeHotspot.zoneId] : null;

  return (
    <div ref={containerRef} className="w-full h-full relative flex flex-col">
      {/* Toggle bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b border-[#D8DCE3]">
        <div className="flex items-center gap-1 p-0.5 bg-[#F0F2F5] rounded-lg border border-[#D8DCE3]">
          <button
            onClick={() => handleToggle('exterior')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              view === 'exterior'
                ? 'bg-[#005EB8] text-white shadow'
                : 'text-[#64748b] hover:text-[#94a3b8]'
            }`}
          >
            <Building2 size={13} />
            Outside View
          </button>
          <button
            onClick={() => handleToggle('interior')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              view === 'interior'
                ? 'bg-[#005EB8] text-white shadow'
                : 'text-[#64748b] hover:text-[#94a3b8]'
            }`}
          >
            <Server size={13} />
            Inside View
          </button>
          <button
            onClick={() => handleToggle('thermal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              view === 'thermal'
                ? 'bg-[#ef4444] text-white shadow'
                : 'text-[#64748b] hover:text-[#94a3b8]'
            }`}
          >
            <Thermometer size={13} />
            Thermal
          </button>
        </div>

        {/* DC name tag */}
        <div className="text-right">
          <div className="text-[10px] text-[#9CA3AF] font-mono uppercase tracking-widest">Digital Twin</div>
          <div className="text-xs font-semibold text-[#005EB8]">{dc?.name}</div>
        </div>
      </div>

      {/* 3D Canvas / Thermal view */}
      <div className="flex-1 relative overflow-hidden" onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}>
        <AnimatePresence mode="wait">
          {view === 'exterior' && (
            <motion.div
              key="exterior"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0"
            >
              <ExteriorModel3D dc={dc} zoneHealth={zoneHealth} onHotspotClick={handleHotspotClick} />
            </motion.div>
          )}
          {view === 'interior' && (
            <motion.div
              key="interior"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0"
            >
              {nexusFacilityId
                ? <NexusTwinPanel facilityId={nexusFacilityId} mode="idle" />
                : <InteriorModel3D dc={dc} zoneHealth={zoneHealth} onHotspotClick={handleHotspotClick} onRackClick={handleRackClick} />}
            </motion.div>
          )}
          {view === 'thermal' && (
            <motion.div
              key="thermal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0"
            >
              {nexusFacilityId ? <NexusTwinPanel facilityId={nexusFacilityId} mode="thermal" /> : <ThermalHeatmapView dc={dc} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hotspot card overlay */}
        {activeHotspot && zoneData && (
          <HotspotCard
            zoneId={activeHotspot.zoneId}
            zoneData={zoneData}
            position={activeHotspot.position}
            onClose={handleClose}
            isGenerated={isGenerated}
          />
        )}

        {/* Rack detail panel */}
        {activeRackId && (
          <RackDetailPanel
            rackId={activeRackId}
            dcId={dc?.id}
            onClose={handleClose}
          />
        )}

        {/* View label pill */}
        <div className="absolute top-3 left-3 pointer-events-none">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
            view === 'exterior'
              ? 'bg-[#060e1a]/80 border-[#1e3050] text-[#60a5fa]'
              : view === 'thermal'
              ? 'bg-[#1a0000]/80 border-[#3b0000] text-[#f87171]'
              : 'bg-[#0a1220]/80 border-[#1e3050] text-[#34d399]'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{
              background: view === 'exterior' ? '#60a5fa' : view === 'thermal' ? '#f87171' : '#34d399'
            }} />
            {view === 'exterior' ? 'EXTERIOR — SECURITY VIEW' : view === 'thermal' ? (nexusFacilityId ? 'THERMAL — INLET ESTIMATE FROM ROW SENSORS' : 'THERMAL — CFD HEATMAP') : 'INTERIOR — OPERATIONAL VIEW'}
          </div>
        </div>

        {/* Hint */}
        {!activeHotspot && !activeRackId && view !== 'thermal' && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="text-[10px] text-[#6B7280] font-mono bg-white/70 px-3 py-1 rounded-full border border-[#D8DCE3]">
              {view === 'interior' ? 'Click racks or glowing markers to inspect' : 'Click glowing markers to inspect zones'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
