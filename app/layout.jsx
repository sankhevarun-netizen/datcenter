import './globals.css';
import { createClient } from '@/lib/supabase-server';
import SupabaseProvider from '@/components/SupabaseProvider';
import WebVitals from '@/components/WebVitals';

export const metadata = {
  title: 'K-Nexus — Datacenter Lifecycle Intelligence',
  description: "KPMG's AI-powered datacenter lifecycle management platform",
  icons: { icon: '/favicon.svg' },
};

export default async function RootLayout({ children }) {
  let session = null;
  try {
    const supabase = await createClient();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      session = data.session;
    }
  } catch {
    // Supabase not configured — run without auth session
  }

  return (
    <html lang="en">
      <head>
        {/* Self-hosted (scripts/vendor-fonts.mjs): a hanging fonts.googleapis.com
            request on a poor network would otherwise block first paint. */}
        <link href="/fonts/fonts.css" rel="stylesheet" />
      </head>
      <body>
        <SupabaseProvider initialSession={session}>
          {children}
        </SupabaseProvider>
        <WebVitals />
      </body>
    </html>
  );
}
