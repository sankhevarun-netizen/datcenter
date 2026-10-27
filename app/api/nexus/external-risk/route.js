// Live external conditions for one facility. ?offline=1 returns the dataset
// context only, with no network calls.
import { externalRisk, fetchCategory, CATEGORIES } from '@/lib/external-risk';
import { index } from '@/lib/nexus/data';
import { getSessionContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const ctx = await getSessionContext();
  if (!ctx.role) return Response.json({ error: 'Sign in required' }, { status: 401 });
  const url = new URL(request.url);
  const facilityId = url.searchParams.get('facility');
  if (!index.facilityById.has(facilityId)) return Response.json({ error: 'Unknown facility' }, { status: 400 });
  if (url.searchParams.get('offline') === '1') {
    const water = (index.waterByFacility.get(facilityId) ?? []).at(-1);
    return Response.json({
      facilityId,
      categories: Object.fromEntries(CATEGORIES.map((c) => [c, { category: c, status: 'paused', signals: [], summary: 'Live feeds paused' }])),
      waterStress: water ? { label: water.local_water_stress, index: water.stress_index, source: '14_water' } : null,
    });
  }
  // ?category=x returns one category, so a page can fill in as each answers.
  const category = url.searchParams.get('category');
  if (category) {
    if (!CATEGORIES.includes(category)) return Response.json({ error: 'Unknown category' }, { status: 400 });
    return Response.json(await fetchCategory(category, facilityId));
  }
  return Response.json(await externalRisk(facilityId));
}
