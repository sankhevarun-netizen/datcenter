import { getSessionContext } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await getSessionContext());
}
