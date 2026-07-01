# Service culturel - Plateforme web

> **Version 1.7.0** - Production-ready (June 30, 2026)

A full-stack web application for managing school and association registrations for cultural events at the Opéra de Montpellier. Built to replace a legacy Google Forms + Excel workflow with a centralized platform featuring separate portals for institutions and administrators.

The system handles multi-institution user management, automated event scraping from the Opera's WordPress API, role-based access control, and comprehensive security measures including CSRF protection, rate limiting, and distributed session management.

## Project Status

✅ **Production-ready** - All core features are implemented, tested, and documented. The application is in maintenance mode with bug fixes and minor enhancements.

**Latest Release**: July 1, 2026 (v1.7.1)

**Latest Release Highlights (v1.7.1)**:

- Reverted Prisma ORM from v7 back to v6 — production runs on a Node version the v7 client does not support. Standard client, imports consolidated to `@prisma/client`.

**Previous Release Highlights (v1.7.0)**:

- Migrated to Prisma ORM v7 with Direct TCP PostgreSQL adapter (later reverted, see v1.7.1)
- Event registration season now starts on June 10 for the following academic year
- Events are automatically archived one year after their latest date
- Admin events can now define multiple reusable pedagogical registration blocks (formations, ateliers, etc.) with custom titles, explanatory text, dates, and mandatory participation
- Public event listing loads faster by rendering immediately, deferring the calendar bundle, and using a resilient Opera/local fallback image chain for events without a visual

**Previous Release (v1.6.7)**:

- Fixed registration edit API to properly handle all registration fields
- Removed fuzzy matching from import functionality (exact match only for institutions and events)

### Recent Releases

- **v1.7.1** (Jul 1, 2026): Reverted Prisma ORM v7 → v6.19 (production Node too old for the v7 Rust-free client); removed the `@prisma/adapter-pg` driver adapter and `prisma.config.ts`, restored the `url` in the schema `datasource`, and consolidated all Prisma imports (enums, model types, `Prisma` namespace) to `@prisma/client`
- **v1.7.0** (Jun 30, 2026): Migrated to Prisma ORM v7 (Rust-free client over a Direct TCP driver adapter, `@prisma/adapter-pg`); dropped Prisma Accelerate; enum imports moved to the runtime-free `/enums` subpath; local Postgres dev via Docker Compose; event registration season starts on June 10; events auto-archive one year after their latest date **— Prisma changes reverted in v1.7.1**
- **v1.6.7** (Feb 27, 2026): Fixed registration edit API, removed fuzzy matching from import
- **v1.6.6** (Feb 26, 2026): Admin notes system, improved import error display with category grouping
- **v1.6.5** (Feb 26, 2026): Fixed import type mapping with accent normalization, multiple type support with "+" separator, pending welcome emails system
- **v1.6.4** (Feb 22, 2026): Automated Backup System with comparison and restore functionalities, Prisma Accelerate support
- **v1.6.3** (Feb 19, 2026): Fixed import script transaction handling, refined public category labels
- **v1.6.2** (Feb 19, 2026): Import existing registrations system with Excel file upload, automatic user/institution matching, and comprehensive validation
- **v1.6.1** (Feb 13, 2026): Added `AESH_COUNT` scoring criterion, scoring breakdown display, event-data-complete scoring input, and advanced Excel export options (sheets/anonymization/cover)
- **v1.6.0** (Feb 12, 2026): Complete migration from legacy `sub_category`/`age_range` to `grades` + `age_ranges`, removal of deprecated scoring criterion, scraper and labels refactoring, CI fully green with 100% test coverage gate
- **v1.5.2** (Feb 6, 2026): New scoring criterion (EVENT_CATEGORY_MATCH), improved scoring UX with better layout
- **v1.5.1** (Feb 5, 2026): Legacy cleanup and scoring UX improvements, removed obsolete `public_type_labels` category, enhanced scoring criteria descriptions and UI
- **v1.5.0** (Feb 5, 2026): PublicType → PublicCategory/PublicSubCategory refactoring with hierarchical two-level system for institution types and age ranges
- **v1.4.3** (Feb 5, 2026): Redis distributed caching for configuration service, immediate cache invalidation across instances, 100% test coverage for configService, all hardcoded labels replaced with dynamic configuration
- **v1.4.2** (Jan 30, 2026): Dynamic label system with async functions for server components, improved scoring criteria definitions, admin user institution inline editing, enhanced UI/UX across platform
- **v1.4.1** (Jan 29, 2026): Event scraping protection system, musical preparation email notifications, user institutions display in selector, interactive style guide
- **v1.4.0** (Jan 23, 2026): Major refactoring - Class to Group renaming, dynamic configuration system, component reorganization, accessibility enhancements (NEUROATYPICAL/OTHER), preparation request system
- **v1.3.3** (Jan 19, 2026): Removed CAPTCHA protection from authentication forms, simplified user experience with security maintained through rate limiting and account lockout
- **v1.3.2** (Jan 15, 2026): Progressive event opening based on school holidays (Toussaint/Christmas) using external API
- **v1.3.1** (Jan 8, 2026): Centralized label mappings for improved maintainability (14 files refactored)
- **v1.3.0** (Dec 19, 2025): Enhanced admin dashboard with comprehensive statistics, advanced fuzzy search for institutions, skip email verification option
- **v1.2.2** (Dec 11, 2025): Bug fixes for image optimization and password reset
- **v1.2.1** (Dec 7, 2025): Migrated from SendGrid to SMTP2GO for email services
- **v1.2.0** (Dec 4, 2025): Admin event management (full CRUD), CI/CD pipeline, enhanced filtering

### Features Implemented

- ✅ Full authentication system with JWT, refresh tokens, and role-based access control
- ✅ Multi-institution user management with junction table architecture
- ✅ Event scraping and synchronization from Opera WordPress API, with June 10 season rollover
- ✅ Optimized public event listing with server-side data loading, lazy calendar view, first-image prioritization, and resilient fallback imagery
- ✅ Progressive event opening and automatic archival one year after the latest event date
- ✅ Registration management with automatic scoring algorithms (14 criteria including `EVENT_CATEGORY_MATCH` and `AESH_COUNT`)
- ✅ Admin dashboard with comprehensive statistics, analytics, and event management (full CRUD)
- ✅ Admin event management with create, edit, delete, rich text descriptions, and normalized manual edit tracking
- ✅ Reusable pedagogical registration blocks on events (formations, ateliers, etc.) with custom title/text/dates, hidden/optional/mandatory user modes
- ✅ Dynamic configuration system for customizable labels (accessibility, event types, public categories, school grades, age ranges, statuses)
- ✅ Async label retrieval system for server components with database integration
- ✅ Redis distributed caching with 5-minute TTL and immediate invalidation across instances
- ✅ 100% test coverage for configuration service (statements, branches, functions, lines)
- ✅ Inline admin institution management for users from detail page
- ✅ Group management with optional naming for better organization
- ✅ Musical preparation request system for events with automatic email notifications to Opera staff
- ✅ Event field protection system to prevent scraping from overwriting manual edits (protected fields: title, description, type, category, grades, age_ranges, location, duration, total_seats, caretaker, image_url, event_dates, accessibility, slug)
- ✅ User institutions display in selector with dedicated section for attached institutions
- ✅ Direct Opera website links from event detail pages using event slugs
- ✅ Interactive style guide with live components (slider, multi-select dropdown, button variants)
- ✅ Advanced institution search with fuzzy matching (Levenshtein distance algorithm)
- ✅ Excel export with advanced filters/options (sheet selection, anonymization, cover summary, groups sheet) and French translations
- ✅ Email notification system (SMTP2GO API) with server-side templates
- ✅ In-app notification system with real-time updates
- ✅ Comprehensive security (CSRF, rate limiting, account lockout, CSP)
- ✅ Redis-backed distributed caching for horizontal scaling
- ✅ Full test suite with Jest (100% coverage for critical modules)
- ✅ CI/CD pipeline with GitHub Actions (Lint, Typecheck, Test, Build, Audit)
- ✅ Complete documentation and code comments

## Stack

- **Next.js 16.0.7** (App Router, React Server Components, Turbopack)
- **React 19.2.0** with TypeScript 5
- **PostgreSQL** with [Prisma 6.19 ORM](https://www.prisma.io/) (standard client)
- **Redis** ([ioredis 5.8.2](https://github.com/redis/ioredis)) for distributed state
- **JWT** authentication with refresh token rotation
- **Tailwind CSS 4** for styling
- **Zod 4.1.12** for validation

## Techniques

### Security Architecture

- \*\*[lib/auth/csrfProtection.ts](lib/auth/csrfProtection.ts)(lib/csrfProtection.ts)
- **Distributed Rate Limiting**: Redis-backed request throttling with memory fallback across multiple endpoint types (auth, API, search, sensitive operations) in [lib/middleware/serverRateLimit.ts](lib/middleware/serverRateLimit.ts)(lib/serverRateLimit.ts)
- **CSRF Protection**: Token-based validation with 15-minute expiration, tied to user/IP identifiers, with client-side caching (14 min) to reduce server load in [lib/auth/csrfProtection.ts](lib/auth/csrfProtection.ts)(lib/csrfProtection.ts)
- **JWT Rotation**: Short-lived access tokens (15 min) with HTTP-only refresh cookies (7 days), token blacklist on logout in [lib/auth/refreshTokenManager.ts](lib/auth/refreshTokenManager.ts)(lib/refreshTokenManager.ts)
- **Password History**: Prevents reuse of last 5 passwords using bcrypt comparison in [lib/auth/passwordHistory.ts](lib/auth/passwordHistory.ts)(lib/passwordHistory.ts)
- **Log Sanitization**: Automatic redaction of sensitive data (emails, tokens, passwords) from application logs in [lib/security/logSanitization.ts](lib/security/logSanitization.ts)(lib/logSanitization.ts)
- **[CSP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)**: Strict Content Security Policy with whitelisted origins configured in [`next.config.ts`](next.config.ts)

### Authentication & Authorization

- **Middleware System**: Composable auth wrappers (`requireAuth`, `requireAdmin`, `requireSuperAdmin`, `requireAdminOrSameUser`) in [`app/api/middleware.ts`](app/api/middleware.ts)
- **Role Hierarchy**: `USER` < `ADMIN` < `SUPERADMIN` with granular permission checks
- **Multi-Institution Support**: Users can belong to multiple institutions via junction table (`UserInstitution`), tracked in JWT payload as `institution_ids` array
- **Automatic Token Refresh**: Client-side fetch wrapper transparently refreshes expired tokens in [lib/api/fetchWithAuth.ts](lib/api/fetchWithAuth.ts)(lib/fetchWithAuth.ts)
- **Session Timeout**: 30-minute inactivity tracking via `User.lastActivity` field

### Data Fetching & State

- **React Server Components**: Direct database queries in server components (no API layer needed for initial renders)
- **Client-Side Hydration**: Interactive components use `'use client'` directive with API calls via [lib/api/fetchWithAuth.ts](lib/api/fetchWithAuth.ts)(lib/fetchWithAuth.ts)
- **Context Providers**: Global auth state ([`context/UserContext.tsx`](context/UserContext.tsx)) and notifications ([`context/NotificationContext.tsx`](context/NotificationContext.tsx))
- **Zod Validation**: Type-safe input validation with [lib/validation/validationSchemas.ts](lib/validation/validationSchemas.ts)(lib/validationSchemas.ts) schemas on all API endpoints

### Database

- **Custom Prisma Output**: Client generated to [`app/generated/prisma`](app/generated/prisma) instead of `node_modules/@prisma/client` (see [`prisma/schema.prisma`](prisma/schema.prisma))
- **Array Fields**: PostgreSQL native arrays for `Event.event_dates` (DateTime[]), `Event.type` (EventType[]), `Event.category` (PublicCategory[]), `Event.grades` (SchoolGrade[]), `Event.age_ranges` (AgeRange[]), `Institution.type` (PublicCategory[]), `Institution.grades` (SchoolGrade[]), `Institution.age_ranges` (AgeRange[])
- **Pedagogical Registration Blocks**: `EventRegistrationBlock` stores reusable blocks attached to an event (title, description, dates, visibility, registration enabled, mandatory flag). `RegistrationBlockSelection` stores each registration's answer and selected block date. Legacy `has_initial_formation` / `want_formation` fields are retained for backward compatibility.
- **Soft Relations**: User-to-institution many-to-many via `UserInstitution` with cascade deletes
- **Security Tables**: Dedicated models for `SecurityLog`, `RefreshTokenBlacklist`, `PasswordResetToken`, `PasswordHistory`

### Web Scraping

- **[Cheerio](https://cheerio.js.org/)**: Parse Opera WordPress API responses ([`lib/cron/eventsScraper.ts`](lib/cron/eventsScraper.ts))
- **Cron Authentication**: Secret token-based endpoint protection using [lib/middleware/cronAuth.ts](lib/middleware/cronAuth.ts)(lib/cronAuth.ts) with timing-safe comparison
- **Upsert Logic**: Events are created or updated based on external ID to prevent duplicates
- **ACF Mapping**: Advanced Custom Fields from WordPress mapped to internal enums (`EventType`, `PublicCategory`, `SchoolGrade`, `AgeRange`)

### Email System

- \*\*[lib/notifications/emailService.ts](lib/notifications/emailService.ts)(lib/emailService.ts)
- **Template-based**: Server-side templates managed in SMTP2GO dashboard
- **Use Cases**: Account verification, password resets, registration confirmations, event reminders
- **Features**: Exponential backoff retry (up to 3 attempts), template data substitution, custom headers support

### Redis Integration

- **Singleton Pattern**: Single Redis client instance with connection pooling and automatic reconnection in [lib/middleware/redisConfig.ts](lib/middleware/redisConfig.ts)(lib/redisConfig.ts)
- **Graceful Fallback**: In-memory Map-based storage when Redis unavailable (dev/single-instance deployments only)
- **Distributed Sessions**: CSRF tokens and rate limit counters shared across multiple server instances
- **Production Requirement**: Redis mandatory for horizontal scaling (load-balanced environments)

### Error Handling

- **Error Boundaries**: User-friendly error pages at page level (global, account, admin, events) in [`app/**/error.tsx`](app/error.tsx) with "Try again" and "Go home" options

## Non-Obvious Technologies

- **[Turbopack](https://turbo.build/pack)**: Next.js bundler (replaces Webpack) enabled via `next dev --turbopack`
- **[ioredis](https://github.com/redis/ioredis)**: High-performance Redis client with cluster support and automatic reconnection
- \*\*[lib/utils/excelExportService.ts](lib/utils/excelExportService.ts)(lib/excelExportService.ts)
- **[xss](https://github.com/leizongmin/js-xss)**: User-generated content sanitization to prevent XSS attacks
- **Rich text event descriptions**: Admin descriptions are stored as restricted sanitized HTML; list cards use plain-text previews and detail pages render sanitized rich HTML
- **[@tailwindcss/postcss](https://tailwindcss.com/docs/installation/framework-guides)**: Tailwind CSS 4 PostCSS plugin (new architecture)
- **[@deemlol/next-icons](https://www.npmjs.com/package/@deemlol/next-icons)**: Optimized icon library for Next.js
- **[ts-jest](https://kulshekhar.github.io/ts-jest/)**: TypeScript preprocessor for Jest with type checking

## Fonts

- **[Poppins](https://fonts.google.com/specimen/Poppins)**: Primary sans-serif (400, 700)
- **[IBM Plex Serif](https://fonts.google.com/specimen/IBM+Plex+Serif)**: Secondary serif (400, 700)

Both loaded via [`next/font/google`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) with automatic font optimization.

## Project Structure

```text
Service-culturel-plateforme-web/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # REST API endpoints (auth, users, events, admin, cron)
│   ├── account/           # User account management pages
│   ├── admin/             # Admin dashboard pages
│   ├── auth/              # Login, register, password reset pages
│   ├── events/            # Public and authenticated event pages
│   └── legal-notices/     # Legal pages (GDPR, ToS)
├── lib/                    # Business logic and utilities
│   ├── cron/              # Event scraper and scheduled tasks
│   ├── emailTemplates/    # HTML email templates
│   └── __tests__/         # Jest unit tests for services
├── components/             # React components
│   ├── ui/                # Reusable UI (Toast, Loader, Modal)
│   ├── guards/            # Route guards (ProtectedRoute, GuestRoute)
│   ├── auth/              # Auth-specific components
│   ├── layout/            # Navigation (Navbar, Sidebar, Footer)
│   ├── account/           # Account-related components
│   ├── admin/             # Admin-specific components
│   │   ├── events/        # Event management
│   │   ├── institutions/  # Institution management
│   │   ├── users/         # User management
│   │   ├── scoring/       # Scoring configuration
│   │   └── misc/          # Other admin components
│   └── events/            # Event-related components
├── context/                # React Context providers (Auth, Notifications)
├── prisma/                 # Database schema and Prisma configuration
│   └── schema.prisma      # Prisma data model
├── public/                 # Static assets
├── scripts/                # Build and utility scripts
├── types/                  # Global TypeScript definitions
├── __tests__/              # Integration tests
└── __mocks__/              # Jest mocks
```

**Key Directories:**

- **[`app/api/`](app/api/)**: All API routes follow HTTP method exports (`GET`, `POST`, `PUT`, `DELETE`) wrapped with middleware from [`app/api/middleware.ts`](app/api/middleware.ts)
- **[`lib/`](lib/)**: Contains security utilities (CSRF, rate limiting, JWT), email service, validation schemas, config service, and the Redis configuration
- **[`lib/cron/`](lib/cron/)**: Automated event scraping system that pulls from the Opera's WordPress API and syncs to PostgreSQL
- **[`prisma/schema.prisma`](prisma/schema.prisma)**: Prisma data model. Production schema changes should be applied before app deploys, preferably through Prisma Migrate when migration files are introduced.
- **[`components/admin/`](components/admin/)**: Admin-specific components organized by feature (events, institutions, users, scoring, misc)
- **[`components/account/`](components/account/)**: User account management components
- **[`components/events/`](components/events/)**: Event-related components (calendar view, event details, registration)
- **[`components/layout/`](components/layout/)**: Navigation and layout components (Navbar, Sidebar, Footer)
- **[`components/guards/`](components/guards/)**: Route protection components (ProtectedRoute, GuestRoute)

## Environment Variables

Required configuration (see [`.env.example`](.env.example)):

```bash
DATABASE_URL="postgres://user:password@localhost:5432/opera_db"
REDIS_URL="redis://localhost:6379"  # Required for production multi-instance
ACCESS_TOKEN_SECRET="your-access-secret"  # Min 32 characters
REFRESH_TOKEN_SECRET="your-refresh-secret"  # Min 32 characters
JWT_REFRESH_SECRET="your-refresh-secret"  # Alias for REFRESH_TOKEN_SECRET
CRON_SECRET="your-cron-secret"  # For /api/cron/* endpoints (generate with: openssl rand -hex 32)
SMTP2GO_API_KEY="api-YOUR_API_KEY"  # SMTP2GO API key for emails
SMTP_FROM_NAME="Plateforme de l'Opéra"
SMTP_FROM_EMAIL="noreply@example.com"
OPERA_ADMIN_EMAIL="admin@example.com"
ALLOWED_ORIGINS="http://localhost:3000,https://production.com"
APP_URL="http://localhost:3000"  # Server-side base URL
NODE_ENV="development"
```

**Security Note**: Generate secrets with `openssl rand -hex 32`. Never commit `.env` files.

## API Authentication

API routes use composable middleware:

```typescript
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';

export const GET = async (req: NextRequest) => {
  return await requireAdmin(req, async (authReq: AuthenticatedRequest) => {
    const user = authReq.user; // { id, email, role, institution_ids }
    // Implementation
  });
};
```

Client-side requests automatically handle token refresh:

```typescript
import { fetchWithAuth } from '@/lib/fetchWithAuth';

const response = await fetchWithAuth('/api/users/me');
const data = await response.json();
```

## Development

```bash
npm run dev              # Start dev server (Turbopack)
npm run build            # Production build
npm test                 # Run Jest tests once
npm run test:watch       # Run Jest in watch mode
npm run coverage         # Run tests with coverage
npm run lint             # ESLint
npm run typecheck        # TypeScript validation
npm run ci               # Full CI pipeline

npx prisma db pull       # Introspect database schema into Prisma schema
npx prisma db push       # Apply schema changes directly in local/dev environments
npx prisma studio        # GUI database browser
```

## CI/CD Pipeline

The project includes a comprehensive GitHub Actions workflow (`.github/workflows/ci.yml`) for automated quality assurance:

### Workflow Triggers

- Push to `main`, `dev`, `hotfix` branches
- Pull requests to any branch

### Pipeline Steps

1. **Code Quality**: Prettier formatting, ESLint linting, TypeScript type checking
2. **Testing**: Jest test suite with coverage reporting
3. **Security**: `npm audit` for vulnerability scanning
4. **Build Verification**: Next.js production build

### Caching Strategy

- Node modules cache for faster dependency installation
- Prisma engines cache for faster database setup
- Next.js build cache for faster compilation

All checks must pass for merge eligibility (except CI skip commits).

## Deployment Readiness

### Pre-Deployment Checklist

Before deploying to production, ensure:

- [ ] PostgreSQL database is provisioned and accessible
- [ ] Redis instance is configured for distributed caching (required for multi-instance deployments)
- [ ] All environment variables are set (see `.env.example`)
- [ ] Secrets are generated with `openssl rand -hex 32` (minimum 32 characters)
- [ ] `NODE_ENV=production` is set
- [ ] SMTP2GO API key is configured for email notifications
- [ ] Email templates are created in SMTP2GO dashboard
- [ ] `ALLOWED_ORIGINS` includes production domain(s)
- [ ] SSL certificates are configured for HTTPS
- [ ] Database migrations are applied: `npx prisma migrate deploy`
- [ ] For deployments using `db push`, apply the additive schema change before deploying the app code
- [ ] Prisma client is generated: `npx prisma generate`
- [ ] Build succeeds: `npm run build`
- [ ] CI pipeline passes: `npm run ci`

### Post-Deployment Tasks

After deployment:

1. **Set up cron jobs** for automated tasks:
   - Event scraping: `GET /api/cron/events/scraping` (requires `CRON_SECRET` header)
   - Event status update: `GET /api/cron/events/status-update` (requires `CRON_SECRET` header)
   - Event reminders: `GET /api/cron/events/reminders` (requires `CRON_SECRET` header)
   - Recommended schedule: Daily at 2 AM for scraping, daily at 3 AM for status updates, hourly for reminders

2. **Monitor security**:
   - Review CSP violations at `/api/csp-report`
   - Check security logs in `SecurityLog` table for suspicious activity
   - Monitor account lockout events

3. **Seed initial data** (if needed):
   - Create SuperAdmin account manually or via seed script
   - Import existing institutions if migrating from legacy system

4. **Performance monitoring**:
   - Monitor Redis connection health
   - Track database query performance
   - Review rate limiting effectiveness

### Known Deployment Considerations

- **Redis requirement**: In-memory fallback mode is NOT suitable for multi-instance production deployments (horizontal scaling). Redis must be configured to share CSRF tokens, rate limits, and session data across instances.
- **Event scraping**: Depends on Opera WordPress API availability. If API structure changes, scraper in `lib/cron/eventsScraper.ts` may need updates. The scraper switches to the next academic season on June 10.
- **Event lifecycle cron**: `/api/cron/events/status-update` progressively opens events, closes past events, and archives events one year after their latest date unless `status` is protected.
- **Pedagogical blocks deployment order**: this feature adds two tables (`EventRegistrationBlock`, `RegistrationBlockSelection`). Apply the schema before the application deploy; old data remains readable through the legacy formation fallback.
- **Email templates**: SMTP2GO templates must be pre-configured in the SMTP2GO dashboard before use (verification, password reset, registration notifications).
- **Email delivery**: Ensure SMTP2GO API key is valid and has sufficient quota for expected email volume.

## Contributing

Contributions are welcome. Please open an issue or submit a pull request on [GitHub](https://github.com/vincbct34/service-culturel-plateforme-web).

## License

Copyright (c) 2025 Opéra Orchestre National Montpellier Occitanie. All rights reserved.

This software is the exclusive property of the Opéra Orchestre National Montpellier Occitanie. It was developed by Vincent Bichat as a work for hire. See [LICENSE](LICENSE) for details.

## Author

### Vincent Bichat

- Email: <vincent260705@gmail.com>
- GitHub: [@vincbct34](https://github.com/vincbct34)

## Acknowledgments

Built for the **Opéra Orchestre National Montpellier Occitanie** to modernize their event registration system for schools and cultural associations.

**Version**: 1.7.0 - Production-ready (maintenance mode)
