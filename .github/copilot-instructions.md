# Project Guidelines

## Code Style

- **Strict TypeScript** (`strict: true`), ESM (`"type": "module"`)
- **Prettier**: single quotes, trailing commas, 100 char width, 2-space indent (see [.prettierrc](../.prettierrc))
- **ESLint**: `no-console: 'error'` in `app/api/**` and `lib/**` — use `logger` from `@/lib/middleware/logger` instead
- **Path alias**: always use `@/` for imports (e.g., `@/lib/auth/...`, `@/components/ui/...`)
- **Import order**: 1) `next/*` 2) `@/app/*` 3) `@/lib/*` grouped by domain 4) third-party packages
- **Language**: UI labels and user-facing text are in **French**; code, comments, and docs are in **English**

## Architecture

- **Next.js 16 App Router** with React 19, Tailwind CSS 4, Prisma 6, PostgreSQL, Redis
- **Prisma client output**: `app/generated/prisma` — always import types/enums from `@/app/generated/prisma`, not `@prisma/client`. Import the client instance from `@/lib/middleware/prismaConfig`
- **API routes** (`app/api/`): export HTTP method handlers wrapped with middleware from `@/app/api/middleware` (`requireAuth`, `requireAdmin`, `requireSuperAdmin`, `requireCronAuth`, `publicRoute`, or `createAuthMiddleware(options)`)
- **Client components**: use `'use client'` directive, fetch data via `fetchJsonWithAuth` from `@/lib/api/fetchWithAuth`, use `useUser()` context, icons from `@deemlol/next-icons`, toasts via `@/lib/utils/toast`
- **Server components**: default in App Router, access DB directly via Prisma
- **Validation**: all API input validated with Zod schemas from `@/lib/validation/validationSchemas`
- **Labels**: centralized French translations in `@/lib/config/labelMappings` — never hardcode label strings

## Build and Test

```bash
npm run dev              # Dev server (Turbopack)
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run format           # Prettier write
npm test                 # Jest (once)
npm run coverage         # Jest + coverage
npm run ci               # Full pipeline: format:check → lint → typecheck → test → build
npx jest path/to/test    # Single test file
npx prisma db push       # Sync Prisma schema to DB without migration
npx prisma db seed       # Seed database (tsx prisma/seed.ts)
```

- **Jest**: `ts-jest` preset, `jsdom` env, 100% coverage threshold on `lib/**` and `hooks/**`
- **Test locations**: `__tests__/` (integration), `lib/__tests__/` (unit), co-located `__tests__/` folders
- **Mocks**: Toast component and `@deemlol/next-icons` are auto-mocked (see `__mocks__/`)

## Project Conventions

- **Middleware pattern** for API routes — see [app/api/middleware.ts](../app/api/middleware.ts):
  ```typescript
  export const GET = async (req: NextRequest) =>
    requireAuth(req, async (authReq: AuthenticatedRequest) => {
      /* handler */
    });
  ```
- **CSRF required** for all state-changing methods (POST/PUT/PATCH/DELETE) — handled by middleware
- **Rate limiting** configs: `auth` (5/15min), `api` (100/min), `search` (300/min), `sensitive` (10/min)
- **Security logging**: use `SecurityLogger.log()` for auth events; sanitize logs via `@/lib/security/logSanitization`
- **Cron endpoints**: protected by `requireCronAuth` (not `requireAdmin`), require `CRON_SECRET` Bearer token
- **DB field naming**: `snake_case` (e.g., `created_at`, `institution_ids`); IDs are CUIDs
- **CSP nonces**: use `getCSPNonce()` from `@/lib/cspNonce` for inline scripts/styles

## Key Files and Directories

- **`app/api/middleware.ts`** — auth/CSRF/rate-limit middleware wrappers; always start here for API routes
- **`lib/middleware/prismaConfig.ts`** — singleton Prisma client instance (default export)
- **`lib/middleware/logger.ts`** — `logger` singleton; use instead of `console.log`
- **`lib/validation/validationSchemas.ts`** — all Zod schemas for API input validation
- **`lib/config/labelMappings.ts`** — centralized French enum → label translations
- **`lib/api/fetchWithAuth.ts`** — `fetchJsonWithAuth` for client-side authenticated API calls
- **`lib/utils/toast.ts`** — `toast(message, type)` wrapper for client-side notifications
- **`context/UserContext.tsx`** — `useUser()` hook providing auth state in client components
- **`components/guards/`** — `ProtectedRoute` and `GuestRoute` for route protection
- **`components/ui/`** — shared UI: `Loader`, `ConfirmationModal`, `Toast`, `MultiSelect`, `NotificationDropdown`, `ContactModal`
- **`types/api.ts`** — shared API response types (`SafeUser`, etc.); always uses `@/app/generated/prisma` as base
- **`proxy.ts`** — Next.js middleware handling CSP nonces, security headers

## Component Naming

- Client components follow `*Client.tsx` pattern (e.g., `AdminDashboardClient`, `EventDetailClient`)
- Page files (`page.tsx`) are typically thin server components that render a `*Client` component
- Admin components organized by domain: `components/admin/events/`, `components/admin/users/`, `components/admin/institutions/`, `components/admin/scoring/`

## Integration Points

- **WordPress API**: event scraping from `opera-orchestre-montpellier.fr/wp-json/wp/v2/programme` — see `lib/cron/eventsScraper.ts`
- **SMTP2GO**: email delivery via API (not SMTP); config in `lib/notifications/emailService.ts`
- **Redis** (`ioredis`): distributed CSRF/rate-limit/cache storage — see `lib/middleware/redisConfig.ts`
- **data.education.gouv.fr**: school holiday API for progressive event opening — see `lib/services/holidays.service.ts`
- **Cron jobs**: scraping, status updates, reminders — all at `app/api/cron/`, authenticated with `CRON_SECRET` Bearer token

## Security

- Never use `console.log` in API/lib code — use `logger` and `sanitizeLogMessage()`
- Validate all inputs with Zod; sanitize user content with `xss` library
- Use `crypto.randomBytes()` for tokens, never `Math.random()`
- Passwords: min 10 chars, 1 upper, 1 lower, 1 digit, 1 special; last 5 passwords tracked
- Redis required for production (CSRF, rate limiting, sessions); in-memory fallback for dev only
- Account lockout: 10 failed attempts → 1 hour lock; counter resets after 15 min inactivity
