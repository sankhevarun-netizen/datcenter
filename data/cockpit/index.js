// Registered presentation cockpits, by slug. Add a client here and in app/cockpit/<slug>.
import { tataPower } from './tata-power.js';

export const COCKPITS = { [tataPower.slug]: tataPower };
export const DEFAULT_COCKPIT = tataPower.slug;
export const cockpitPath = (slug) => `/cockpit/${slug}`;
