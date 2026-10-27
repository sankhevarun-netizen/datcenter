'use client';
import CCLayout from '@/components/command-center/CCLayout';
import NexusCapacityPage from '@/components/nexus/NexusCapacityPage';

export default function CapacitySimulation() {
  return (
    <CCLayout title="Capacity Intelligence · Nexus Mumbai-1">
      <div style={{ height: 'calc(100vh - 56px)' }}>
        <NexusCapacityPage />
      </div>
    </CCLayout>
  );
}
