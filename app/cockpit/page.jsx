import { redirect } from 'next/navigation';
import { DEFAULT_COCKPIT, cockpitPath } from '@/data/cockpit';

export default function CockpitIndex() {
  redirect(cockpitPath(DEFAULT_COCKPIT));
}
