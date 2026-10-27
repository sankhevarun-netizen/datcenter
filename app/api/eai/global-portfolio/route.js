import { createClient } from '@/lib/supabase-server';
import { getCurrentUserId } from '@/lib/assetPortfolio';
import { getGlobalPortfolioData } from '@/lib/eaiMasterData';

// Backs app/eai/global-portfolio/page.jsx: returns the dashboard's data
// derived from whatever the user has uploaded via /eai/administration/data-import.
// `{ live: false }` tells the page to keep rendering the bundled demo dataset
// (data/eaiMockData.js) — this happens until at least one Facilities row exists.
export async function GET() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  const data = await getGlobalPortfolioData(supabase, userId);
  if (!data) return Response.json({ live: false });
  return Response.json({ live: true, data });
}
