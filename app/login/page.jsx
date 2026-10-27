'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/components/SupabaseProvider';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/eai/administration/data-import';
  const { supabase } = useSession() ?? {};

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  // Single sign-on only: no local passwords, no self sign-up.
  const ssoOnly = process.env.NEXT_PUBLIC_SSO_ONLY === 'true';

  async function signInWithMicrosoft() {
    if (!supabase) { setError('Auth is not configured.'); return; }
    setLoading(true);
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: ssoError } = await supabase.auth.signInWithOAuth({ provider: 'azure', options: { scopes: 'email openid profile', redirectTo } });
    if (ssoError) { setError(ssoError.message); setLoading(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!supabase) { setError('Auth is not configured.'); return; }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push(next);
        router.refresh();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (data.session) {
          router.push(next);
          router.refresh();
        } else {
          setNotice('Account created — check your email to confirm it, then sign in.');
          setMode('signin');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    display: 'block', width: '100%', marginTop: 4, padding: '9px 12px',
    borderRadius: 8, border: '1px solid #D8DCE3', fontSize: 13, color: '#1A1F36',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#FFFFFF', border: '1px solid #D8DCE3', borderRadius: 16, padding: 32, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A1F36', margin: 0, marginBottom: 4 }}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h1>
        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 0, marginBottom: 22 }}>
          {mode === 'signin'
            ? (ssoOnly ? 'Sign in with your organisation account.' : 'Sign in to upload and manage your master data.')
            : 'Create an account to upload and manage your master data.'}
        </p>

        <button type="button" onClick={signInWithMicrosoft} disabled={loading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#FFFFFF', color: '#1A1F36', border: '1px solid #CBD5E1', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer', marginBottom: ssoOnly ? 0 : 16 }}>
          <span aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: '7px 7px', gap: 1 }}>
            <span style={{ width: 7, height: 7, background: '#F25022' }} /><span style={{ width: 7, height: 7, background: '#7FBA00' }} />
            <span style={{ width: 7, height: 7, background: '#00A4EF' }} /><span style={{ width: 7, height: 7, background: '#FFB900' }} />
          </span>
          Sign in with Microsoft
        </button>
        {ssoOnly && error && <p style={{ fontSize: 11, color: '#C8102E', marginTop: 10 }}>{error}</p>}

        {!ssoOnly && <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: '#9CA3AF', fontSize: 11 }}><span style={{ flex: 1, height: 1, background: '#D8DCE3' }} />or<span style={{ flex: 1, height: 1, background: '#D8DCE3' }} /></div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
            Email
            <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
            Password
            <input
              type="password" required minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password} onChange={e => setPassword(e.target.value)} style={inputStyle}
            />
          </label>

          {error && <p style={{ fontSize: 11, color: '#C8102E', margin: 0 }}>{error}</p>}
          {notice && <p style={{ fontSize: 11, color: '#00B0A0', margin: 0 }}>{notice}</p>}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 4, background: loading ? '#94A3B8' : '#005EB8', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(m => (m === 'signin' ? 'signup' : 'signin')); setError(null); setNotice(null); }}
          style={{ marginTop: 16, fontSize: 11, color: '#005EB8', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', width: '100%' }}
        >
          {mode === 'signin' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
        </button>
        </>}

        <Link href="/" style={{ display: 'block', marginTop: 18, fontSize: 11, color: '#9CA3AF', textAlign: 'center', textDecoration: 'none' }}>
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
