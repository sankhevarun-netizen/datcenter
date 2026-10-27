// Tata Power Investment Cockpit. Static: renders from data/cockpit/tata-power.js.
// Drop a photograph at public/cockpit/tata-power-hero.jpg to use it behind the
// hero; without one the hero draws its own energy-infrastructure scene.
import fs from 'fs';
import path from 'path';
import CockpitView from '@/components/cockpit/CockpitView';
import { tataPower } from '@/data/cockpit/tata-power';

export const metadata = { title: 'Tata Power Investment Cockpit — K-Nexus' };

const HERO = '/cockpit/tata-power-hero.jpg';

export default function TataPowerCockpitPage() {
  const heroImage = fs.existsSync(path.join(process.cwd(), 'public', HERO)) ? HERO : null;
  return <CockpitView data={tataPower} heroImage={heroImage} />;
}
