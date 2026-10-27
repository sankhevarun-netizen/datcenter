'use client';
import CCLayout from '@/components/command-center/CCLayout';
import SwitchoverPlanner from '@/components/nexus/SwitchoverPlanner';

export default function SwitchoverPage() {
  return (
    <CCLayout title="Switchover Planner">
      <SwitchoverPlanner />
    </CCLayout>
  );
}
