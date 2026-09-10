# MyFinance — Your Personal CFO

Private, single-user finance dashboard for payday planning, bills, debt, budgets, goals, safe-to-spend, and monthly reviews.

## Local development

1. Copy `.env.example` to `.env.local` and fill all values.
2. Create a Neon PostgreSQL database and set its pooled `DATABASE_URL`.
3. Run `npm install`, `npm run db:generate`, then `npm run db:migrate`.
4. Run `npm run dev`.

Amounts are stored as integer Indonesian Rupiah; display uses `id-ID` formatting.

## Private credentials login

Choose one username and a strong password. Generate a bcrypt hash locally, then store only that hash in `.env.local` or Vercel:

```bash
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash('YOUR_PASSWORD', 12).then(console.log)"
openssl rand -base64 32
```

```env
AUTH_USERNAME=diki
AUTH_PASSWORD_HASH='$2b$12$...'
AUTH_SESSION_SECRET=the-output-from-openssl
```

`AUTH_PASSWORD_HASH` is a bcrypt hash, never the original password. Do not commit a password, hash, or session secret. Login verifies credentials on the server and stores only a signed, seven-day HttpOnly session cookie.

## Vercel

Push this repository, import it in Vercel, connect Neon, then add `DATABASE_URL`, `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, and `AUTH_SESSION_SECRET`. Apply migrations from a trusted environment with the production `DATABASE_URL`, then log in with the configured credentials.

## Scripts

- `npm run dev` — local app
- `npm run build` — production build
- `npm run lint` — lint
- `npm run db:generate` — generate Drizzle migration
- `npm run db:migrate` — apply migration
- `npm run db:studio` — inspect database
