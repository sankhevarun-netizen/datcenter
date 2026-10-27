// lib/auth/session.js — server-side: who is asking, and with which role.
import { createClient } from '@/lib/supabase-server';
import { roleFromUser, openAccessRole, authRequired, permissionsFor } from './roles';

const SESSION_TIMEOUT_MS = 3000;

async function currentUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  try {
    const supabase = await createClient();
    const { data } = await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('session timeout')), SESSION_TIMEOUT_MS)),
    ]);
    return data?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * { user, role, permissions, authenticated }. With AUTH_REQUIRED and no user,
 * role is null — callers must refuse. Otherwise an anonymous caller gets the
 * open-access role, as the app behaves today.
 */
export async function getSessionContext() {
  const user = await currentUser();
  if (user) {
    const role = roleFromUser(user);
    return { user: { id: user.id, email: user.email }, role, permissions: permissionsFor(role), authenticated: true };
  }
  if (authRequired()) return { user: null, role: null, permissions: [], authenticated: false };
  const role = openAccessRole();
  return { user: null, role, permissions: permissionsFor(role), authenticated: false };
}

/** For route handlers: returns the context, or a Response to send back. */
export async function requirePermission(permission) {
  const ctx = await getSessionContext();
  if (!ctx.role) return { error: Response.json({ error: 'Sign in required' }, { status: 401 }) };
  if (!ctx.permissions.includes(permission)) return { error: Response.json({ error: 'Not permitted for your role' }, { status: 403 }) };
  return { ctx };
}
