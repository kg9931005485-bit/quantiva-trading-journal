# QUANTIVA — Next.js Trading Journal

A fresh Next.js + TypeScript app connected to the new `QUANTIVA-NEW` Supabase project.

## Included
- Email/password signup and login
- Dashboard metrics, equity curve and recent trades
- Trade journal that records **only final net P&L** (no entry, exit, or lot size fields)
- Optional notes and mistake tags
- Analytics, Long/Short breakdown, calendar and CSV export
- Starting balance settings
- Row Level Security (RLS) so users can only access their own profile/trades

## Run locally
1. Install Node.js 20+ on a computer or a supported cloud development environment.
2. In this folder run `npm install`, then `npm run dev`.
3. Open the local address shown by Next.js.

`.env.local` is preconfigured for the new Supabase project. Keep it private and do not commit it. The publishable key is designed for client-side use; never put a Supabase `service_role` or secret key in this app.

## Deploy
Push this project to a private GitHub repository and import it into Vercel. Add these environment variables in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the Supabase publishable key)

The database tables and RLS policies have already been created in `QUANTIVA-NEW`.

## Supabase auth
For production email confirmation, configure the Site URL and Redirect URLs in Supabase Authentication settings to match the deployed website URL.

## Important
This archive is the source project, not a live deployment. It needs to be run/deployed to become an online website.
