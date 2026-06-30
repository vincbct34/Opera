# Contributing to Service culturel - Plateforme web

Thank you for your interest in contributing to Service culturel - Plateforme web! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Project Structure](#project-structure)
- [Testing Guidelines](#testing-guidelines)
- [Security Best Practices](#security-best-practices)
- [Pull Request Guidelines](#pull-request-guidelines)
- [CI/CD Pipeline](#cicd-pipeline)

## Getting Started

1. **Clone the repository**:

   ```bash
   git clone https://github.com/vincbct34/service-culturel-plateforme-web.git
   cd service-culturel-plateforme-web
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Copy `.env.example` to `.env` and fill in the required values.

   ```bash
   cp .env.example .env
   ```

   See `README.md` for details on required environment variables.

4. **Set up the database**:
   Ensure PostgreSQL is running and apply migrations.

   ```bash
   npx prisma db pull
   npx prisma generate
   ```

5. **Start the development server**:

   ```bash
   npm run dev
   ```

## Development Workflow

1. **Create a branch**:
   Create a new branch for your feature or bug fix from the default `main` branch.

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/my-new-feature
   # or
   git checkout -b fix/my-bug-fix
   # or
   git checkout -b hotfix/critical-fix
   ```

2. **Make your changes**:
   Implement your changes, adhering to the project's coding standards.

3. **Test your changes**:
   Run the test suite to ensure no regressions.

   ```bash
   npm test                # Run tests once
   npm run test:watch      # Run tests in watch mode
   npm run coverage        # Generate coverage report
   ```

4. **Lint and Format**:
   Ensure your code passes linting and type checking.

   ```bash
   npm run lint            # ESLint
   npm run typecheck       # TypeScript validation
   npm run format          # Prettier formatting
   npm run ci              # Run all checks
   ```

5. **Commit your changes**:
   Use clear and descriptive commit messages following [Conventional Commits](https://www.conventionalcommits.org/).

   ```bash
   git commit -m "feat: add new registration filter"
   git commit -m "fix: resolve authentication token leak"
   git commit -m "docs: update API documentation"
   ```

6. **Push and Create a Pull Request**:
   Push your branch to GitHub and open a Pull Request against `main`.

## Coding Standards

### TypeScript

- **Type Safety**: All new code must be strictly typed. Avoid `any` and `unknown` without proper justification.
- **Imports**: Use path aliases (`@/`) for internal imports.
- **Interfaces vs Types**: Prefer `interface` for object shapes, `type` for unions and primitives.

### React

- **Functional Components**: Use Functional Components and Hooks. Avoid Class Components.
- **Server Components**: Default to Server Components in the App Router. Use `'use client'` directive only when necessary.
- **State Management**: Prefer React built-in state (`useState`, `useReducer`) over external libraries.

### Styling

- **Tailwind CSS**: Use Tailwind utility classes. Avoid writing custom CSS files unless absolutely necessary.
- **Responsive Design**: Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`).

### API Routes

- **Middleware**: Always wrap API routes with appropriate middleware (`requireAuth`, `requireAdmin`, `requireCronAuth`).
- **Validation**: Use Zod schemas from `lib/validation/validationSchemas.ts` for input validation.
- **Error Handling**: Return appropriate HTTP status codes with meaningful error messages.

### Naming Conventions

- **Files**: `kebab-case` for components and utilities (`user-profile.tsx`, `format-date.ts`)
- **Components**: `PascalCase` for component names (`UserProfile`, `FormatDate`)
- **Functions**: `camelCase` for function names (`getUserData`, `formatDate`)
- **Constants**: `SCREAMING_SNAKE_CASE` for constants (`MAX_RETRIES`, `API_BASE_URL`)

### Code Quality

- **Linting**: We use ESLint and Prettier. Run `npm run lint` before committing.
- **Type Safety**: Run `npm run typecheck` to ensure no TypeScript errors.
- **Comments**: Write comments in English for code clarity. Avoid obvious comments.

## Project Structure

```text
Service-culturel-plateforme-web/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # REST API endpoints
│   ├── generated/         # Custom Prisma client output
│   ├── account/           # User account pages
│   ├── admin/             # Admin dashboard pages
│   ├── auth/              # Authentication pages
│   └── events/            # Event pages
├── components/             # React components
│   ├── ui/                # Reusable UI components
│   ├── routes/            # Route guards
│   ├── auth/              # Auth-specific components
│   ├── admin/             # Admin components
│   ├── misc/              # Feature-specific client components
│   └── links/             # Navigation components
├── context/                # React Context providers
├── lib/                    # Business logic and utilities
│   ├── cron/              # Event scraper and scheduled tasks
│   ├── scoring/           # Registration scoring system
│   ├── authentication/    # Security modules (CSRF, rate limiting, etc.)
│   ├── services/          # Business logic services
│   └── utilities/         # Helper functions
├── hooks/                  # Custom React hooks
├── prisma/                 # Database schema and migrations
│   ├── migrations/        # Generated migration files
│   └── schema.prisma      # Prisma data model
├── public/                 # Static assets
├── scripts/                # Build and utility scripts
├── types/                  # Global TypeScript definitions
├── __tests__/              # Integration tests
└── __mocks__/              # Jest mocks
```

## Testing Guidelines

### Unit Tests

- Write unit tests for utility functions and services in `lib/__tests__/`
- Aim for 100% coverage for critical security modules
- Use descriptive test names that explain the behavior being tested

### Integration Tests

- Write integration tests for API endpoints in `__tests__/`
- Test both success and error scenarios
- Mock external dependencies (database, email service, etc.)

### Test Commands

```bash
npm test                # Run tests once
npm run test:watch      # Run tests in watch mode
npm run coverage        # Generate coverage report
```

### Running Specific Tests

```bash
npx jest path/to/test.test.ts
```

## Security Best Practices

When working on this codebase, always follow these security guidelines:

1. **Never commit secrets**: Never commit `.env` files or any sensitive data.
2. **Use middleware**: Always wrap API routes with appropriate authentication middleware.
3. **Validate inputs**: Use Zod schemas for all API input validation.
4. **Sanitize logs**: Use `sanitizeLogMessage()` and `sanitizeLogArgs()` to redact sensitive data.
5. **CSRF tokens**: Include CSRF tokens for all state-changing operations (POST/PUT/PATCH/DELETE).
6. **Rate limiting**: All endpoints are rate-limited by default. Adjust `rateLimitConfig` if needed.
7. **SQL injection**: Prisma handles parameterized queries automatically. Never use raw SQL without validation.
8. **XSS prevention**: Use the `xss` library for user-generated content sanitization.
9. **Password security**: Never log passwords or hash values. Use bcrypt for password hashing.

## Pull Request Guidelines

### Before Submitting

- [ ] All tests pass (`npm run test`)
- [ ] Code is formatted (`npm run format`)
- [ ] No linting errors (`npm run lint`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] New features include tests
- [ ] Documentation is updated if needed
- [ ] Commit messages follow Conventional Commits

### PR Description

Include a clear description of your changes:

- **Why**: What problem does this PR solve?
- **What**: What changes were made?
- **How**: How were these changes implemented?
- **Testing**: How did you test these changes?

### Review Process

- All PRs must pass the CI/CD pipeline before merging
- At least one approval is required
- Address review comments promptly
- Keep PRs focused and small enough to review easily

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment.

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

## Database

We use PostgreSQL with Prisma ORM (v7, Rust-free client over a Direct TCP driver adapter).

- **Start local DB**: `docker compose -f docker-compose.dev.yml up -d` (Postgres on `localhost:5434`, matches `.env`)
- **Apply schema**: `npx prisma db push` (or `npx prisma migrate dev`)
- **Seed dev data**: `npm run db:seed -- --force`
- **View database GUI**: `npx prisma studio`
- **Generate client**: `npx prisma generate` (runs automatically after install)

**Important**: Prisma v7 generates a Rust-free client to `app/generated/prisma`, not the default location. Import **enums** from `@/app/generated/prisma/enums` (runtime-free, browser-safe), **model types / the `Prisma` namespace** from `@/app/generated/prisma/client` (server only), and the **shared client instance** from `@/lib/middleware/prismaConfig`. Never import enums from `/client` — its runtime breaks client-component bundling.

## Getting Help

If you need help or have questions:

1. Check the existing documentation (`README.md`, `CLAUDE.md`)
2. Search for similar issues or PRs
3. Ask questions in your PR description
4. Contact maintainers

## License

Copyright (c) 2026 Opéra Orchestre National Montpellier Occitanie. All rights reserved.

This software is the exclusive property of the Opéra Orchestre National Montpellier Occitanie. Contributions become part of the proprietary codebase. See [LICENSE](LICENSE) for details.

---

Thank you for contributing to Service culturel - Plateforme web!
