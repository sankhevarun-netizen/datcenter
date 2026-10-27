import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Two modes:
//   AUTH_REQUIRED unset — open access (the default today). The middleware only
//     refreshes the Supabase session cookie so a signed-in user is recognised.
//   AUTH_REQUIRED=true — every page needs a session (redirect to /login) and
//     every API returns 401 without one. If Supabase cannot be reached the gate
//     fails closed. Set this on every deployment a client can reach.
// The offline flag (?demo=1) skips network calls only in open-access mode; it
// never bypasses the gate.

const PUBLIC_PATHS = [/^\/login(\/|$)/, /^\/auth\//, /^\/api\/health$/];
const SESSION_TIMEOUT_MS = 5000;

export async function middleware(request) {
  const gated = process.env.AUTH_REQUIRED === 'true';
  const { pathname, searchParams } = request.nextUrl;

  if (!gated && searchParams.get('demo') === '1') {
    return NextResponse.next({ request });
  }
  if (gated && PUBLIC_PATHS.some((re) => re.test(pathname))) {
    return NextResponse.next({ request });
  }

  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!configured) {
    return gated ? deny(request, 'Sign-in is not configured') : NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  // A Supabase outage or hung connection must not hang every request. In open
  // access it degrades to an unrefreshed session; behind the gate it denies.
  let user = null;
  try {
    const { data } = await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase auth timed out')), SESSION_TIMEOUT_MS)),
    ]);
    user = data?.user ?? null;
  } catch (err) {
    console.error('[middleware] Supabase session refresh failed:', err.message);
    return gated ? deny(request, 'Sign-in service unavailable') : NextResponse.next({ request });
  }

  if (gated && !user) return deny(request, 'Sign in required');
  return supabaseResponse;
}

function deny(request, reason) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: reason }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|fonts/|favicon.ico|.*\\.svg).*)'],
};
