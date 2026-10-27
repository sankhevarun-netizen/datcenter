import { createClient } from '@/lib/supabase-server';
import { getCurrentUserId } from '@/lib/assetPortfolio';
import { getAdministrationData } from '@/lib/eaiMasterData';

// Backs app/eai/administration/page.jsx the same way /api/eai/global-portfolio
// backs the Global Portfolio dashboard — `{ live: false }` until the user has
// uploaded Users rows via /eai/administration/data-import.
export async function GET() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) return Response.json({ error: 'Not authenticated.' }, { status: 401 });

  const data = await getAdministrationData(supabase, userId);
  if (!data) return Response.json({ live: false });
  return Response.json({ live: true, data });
}
