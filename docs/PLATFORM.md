# K-Nexus platform: access, audit and operations

What is built in code, and the steps that need an account or a decision.

## Turning on access control

1. **Apply the database migration.** Run `supabase/migrations/20261006_platform_hardening.sql` in the Supabase SQL editor. It creates `user_roles`, `audit_log`, `user_state`, `model_usage`, `app_events` and `wiki_pages` (with pgvector), each with row-level security. It is idempotent.
2. **Microsoft single sign-on (Azure AD / Entra ID).**
   - In Entra ID, register an application. Redirect URI: `https://<project>.supabase.co/auth/v1/callback`.
   - In Supabase → Authentication → Providers → Azure, enter the client ID, secret and tenant URL (`https://login.microsoftonline.com/<tenant-id>`).
   - In Supabase → Authentication → URL configuration, add `https://<app-domain>/auth/callback`.
   - Set `NEXT_PUBLIC_SSO_ONLY=true` to remove email/password sign-in.
3. **Assign roles.** Insert a row per person into `user_roles` (`operator`, `manager`, `partner`, `admin`). A trigger copies it into the user's token. Anyone without a row is an operator.
4. **Close the door.** Set `AUTH_REQUIRED=true` on every deployment a client can reach. Pages then redirect to sign-in, APIs return 401, and if Supabase is unreachable the gate fails closed. The offline flag never bypasses it.

## Roles

| Role | Can |
|---|---|
| operator | dashboards, twin, incidents, predictive; acknowledge alerts, declare SLA clocks; run simulations; copilot |
| manager | + penalty amounts and contractual exposure; export briefings and disclosure packs |
| partner | + audit trail and model spend |
| admin | + manage access |

Server routes enforce these (`lib/auth/session.js`, `requirePermission`).

## Audit trail and persistence

- Every acknowledgement, SLA declaration, export and agent output (with whether it was a written or template brief, and any rejected figure) is appended to `audit_log`. View and export as CSV at `/command-center/audit` (partner and admin).
- Acknowledgements and running SLA clocks persist per user (`user_state`), so closing the browser loses nothing.
- When Supabase is unreachable or the tables do not exist yet, records go to a local store outside the repository (`~/.k-nexus`, or `NEXUS_DATA_DIR`). On Vercel that fallback is `/tmp` and does not persist — production needs the tables.

## Model use

- **Metadata only.** Every prompt is checked before it is sent (`lib/nexus/prompt-policy.js`): computed facts and aggregates pass; raw telemetry fields or timestamped reading dumps are refused, and the brief falls back to its template.
- **Cost telemetry.** Every model call records tokens and list-price cost against an engagement (the facility) and a feature. See `/command-center/audit`. Prices live in `lib/model-pricing.js`.

## Monitoring

Server errors (`instrumentation.js`), client errors (`app/error.jsx`) and sampled Core Web Vitals (`components/WebVitals.jsx`) are recorded to `app_events`. To add a hosted service (Sentry, Azure Monitor), forward from `onRequestError` and `/api/telemetry`.

## Secrets

`.env.example` lists every variable. Values belong in the hosting platform's secret store; `.env.local` is ignored by git.

## Knowledge graph

- **Storage.** Pages live in Supabase `wiki_pages` (pgvector) and fall back to a folder outside the repository: `WIKI_PATH`, default `~/.k-nexus/wiki`. The repository no longer holds wiki content.
- **One node per idea.** Every write is normalised through `lib/wiki/ontology.js`: known ideas resolve to one canonical path whatever the writer called them, and the extractor is shown the existing pages so it reuses them. Add aliases there when a new duplicate appears.
- **Migration and dedupe.** `node scripts/wiki-migrate.mjs` prints the plan (dry run). `--apply` writes it to `WIKI_PATH`; add `--supabase` (with `SUPABASE_SERVICE_ROLE_KEY`) to load `wiki_pages`. `--source=<dir>` dedupes another folder, in place if it is the target. Merges are deterministic: the longest page is kept whole and new sections from the others are appended.
- **Embeddings on write.** `voyage-3-lite` (512 dimensions) when `VOYAGE_API_KEY` is set, otherwise a deterministic lexical embedding. If you switch methods, re-run the migration with `--source` pointing at `WIKI_PATH` to re-embed.
- **Retrieval into agents.** Capacity, site-risk, incident and risk briefs fetch the three closest concept, pattern and market pages as background. Engagement pages are never retrieved; client names and every figure are stripped first, so retrieved text cannot introduce a number into a brief.
- **Confidentiality.** The graph shows engagements as Client A, B, … and redacts client names from every label and preview; client folder names never leave the server.
