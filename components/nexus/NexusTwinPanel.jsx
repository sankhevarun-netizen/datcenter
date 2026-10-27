'use client';
// The Nexus twin as an embeddable panel: the resting view or the thermal view
// of a facility, with rack detail on click and the view's legend.
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { idleView, thermalView } from '@/lib/nexus/twin-model';
import { thermalMap } from '@/lib/nexus/thermal-model';
import { Legend } from './ResultCards';
import RackDetail from './RackDetail';

const NexusTwin = dynamic(() => import('./NexusTwin'), { ssr: false });

export default function NexusTwinPanel({ facilityId, mode = 'idle' }) {
  const [rack, setRack] = useState(null);
  const view = useMemo(() => (mode === 'thermal' ? thermalView(facilityId, thermalMap(facilityId)) : idleView(facilityId)), [facilityId, mode]);
  return (
    <div className="absolute inset-0 bg-[#070d18]">
      <NexusTwin facilityId={facilityId} view={view} runKey={mode === 'thermal' ? 1 : 0} insetLeft={0} insetRight={0} onRackClick={(r) => setRack(r.rack_id)} />
      {rack && <RackDetail rackId={rack} left={16} onClose={() => setRack(null)} />}
      <Legend items={view.legend} left={16} />
    </div>
  );
}
