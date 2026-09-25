// Better Auth (PRD §2): email + password sessions stored in Postgres.
// The web app (Vercel) and API (replyra-api.creativeshine.id) live on different sites, so the client
// authenticates with a bearer token (`set-auth-token` header) instead of relying on third-party cookies.

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer } from 'better-auth/plugins';
import { db, schema } from '@replyra/db';

const webOrigins = (process.env.WEB_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const auth = betterAuth({
  appName: 'Replyra',
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3099',
  basePath: '/api/auth',
  trustedOrigins: webOrigins,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications
    }
  }),
  user: {
    // Existing `users` table: avatar lives in avatar_url.
    fields: { image: 'avatarUrl' },
    additionalFields: {
      // Platform operator flag — exposed on the session, never accepted from clients.
      isSuperadmin: { type: 'boolean', required: false, defaultValue: false, input: false }
    }
  },
  emailAndPassword: {
    enabled: true,
    // Accounts are provisioned by an owner (invite) or the seed; no open self sign-up yet.
    disableSignUp: process.env.AUTH_ALLOW_SIGNUP !== 'true',
    minPasswordLength: 10
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET
          }
        }
      : {})
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24 // refresh daily
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    // Brute-force guard per client IP: 10 sign-in attempts / minute.
    customRules: { '/sign-in/email': { window: 60, max: 10 } }
  },
  advanced: {
    // Behind cPanel/Apache (Passenger) or a proxy the client IP arrives in forwarding headers.
    ipAddress: { ipAddressHeaders: ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'] }
  },
  plugins: [bearer()]
});

export type AuthSession = typeof auth.$Infer.Session;
