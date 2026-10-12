# AAHARAM backend setup (Supabase)

One-time steps to connect the app to your own free Supabase project. Run each command from
the project folder.

## 1. Create the project

1. Sign in at https://supabase.com and create a new project (free tier is fine).
2. Wait until it finishes provisioning.
3. In **Project Settings → API**, copy the **Project URL** and the **anon** (or `sb_publishable_…`) key.
4. Copy `.env.example` to `.env` and paste both values.

## 2. Link the CLI

```bash
npx supabase login
```

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

`YOUR_PROJECT_REF` is the part of the Project URL before `.supabase.co`.

## 3. Create the database and load the catalog

```bash
npx supabase db push --include-seed
```

This applies everything in `supabase/migrations/` (tables, security rules, tracking job,
Realtime) and loads `supabase/seed.sql`.

## 4. Deploy the server functions

```bash
npx supabase functions deploy --use-api
```

If your CLI version says `--use-api` is unknown, run it without that flag (newer CLIs deploy
without Docker by default).

## 5. Make sign-in emails contain the code

In **Authentication → Emails → Templates → Magic Link**, set:

- Subject: `Your AAHARAM sign-in code`
- Body:

```html
<h2>Your AAHARAM sign-in code</h2>
<p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
<p>It expires in 1 hour. If you didn't ask for it, you can ignore this email.</p>
```

The app accepts 6–8 digit codes, so the **Email OTP Length** setting can stay at its default.

## 6. (Optional) Let anyone sign in

Supabase's built-in email only delivers to members of your Supabase organization, about 2 per
hour. To let other people (for example recruiters) sign in, connect a free SMTP provider such as
Brevo under **Authentication → Emails → SMTP Settings**. No code changes are needed.

## 7. Run the app

```bash
npx expo start --clear
```

## 8. Verify the backend (optional but recommended)

Copy `.env.local.example` to `.env.local` and paste the **service_role** (or secret) key. Never
commit this file or put this key in the app.

```bash
npx tsx scripts/verify-rls.ts
```

```bash
npx tsx scripts/smoke-test.ts
```

Both print `PASS`/`FAIL` per check and clean up the throwaway users they create.

## Updating the catalog later

Edit `data/seed/*.ts`, then:

```bash
npx tsx scripts/generate-seed-sql.ts
```

```bash
npx supabase db push --include-seed
```
