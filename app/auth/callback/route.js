// OAuth return leg for single sign-on: exchange the code for a session and
// continue to where the user was going.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/command-center';
  // Only same-site paths are allowed as a destination.
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/command-center';
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(target, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=sign-in-failed', url.origin));
}
