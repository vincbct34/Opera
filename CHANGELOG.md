# Changelog

All notable changes to the Opéra de Montpellier Registration Platform will be documented in this file.

## [Unreleased]

### Added

- **Public Event Image Fallback**: Event cards without an `image_url` now display the Opera fallback photo instead of a text placeholder
  - If an event image or the remote fallback image fails to load, cards fall back to the local bundled hero image

- **Event Pedagogical Registration Blocks**: Admins can configure multiple reusable blocks around an event
  - Blocks support custom title, explanatory text, one or more dates, visibility, registration enabled/disabled, and mandatory participation
  - New Prisma models `EventRegistrationBlock` and `RegistrationBlockSelection`
  - Public registration form now stores per-block answers and selected block dates
  - Admin, account, event registration, and Excel export views display block answers
  - Legacy `has_initial_formation` / `want_formation` data remains supported through a fallback "Formation initiale" block

- **Rich Text Event Descriptions**: Admin event descriptions now use a restricted rich text editor
  - Supports bold, italic, underline, unordered/ordered lists, links, and clearing formatting
  - Stores descriptions as sanitized HTML in the existing `Event.description` field
  - Public event cards render plain-text previews while detail pages render sanitized rich text
  - Added `lib/richText.ts`, `components/ui/RichTextEditor.tsx`, and `components/events/EventDescription.tsx`

### Deployment Notes

- Apply the database schema before deploying the app code for the pedagogical blocks feature. The change is additive, but the new code reads the new relations from event and registration endpoints.
- Apply the updated Prisma schema so the new `Event.status` index is created before relying on the event list query optimization in production.

### Changed

- **Pedagogical Block User Modes**: Admin event blocks now expose a single user-facing mode
  - Replaced separate visibility/registration/mandatory toggles with hidden, optional registration, and mandatory registration modes
  - Visible pedagogical blocks now always collect an inscription answer
  - Admin event saves normalize visible blocks as registration-enabled and hidden blocks as non-mandatory

- **Public Event List Performance**: Optimized the `/events` listing page load path
  - Removed the global image preloader that blocked the page until every event image loaded or timed out
  - Preloads only the first visible upcoming event images through `next/image`
  - Lazy-loads the calendar view bundle when users switch from list view
  - Converts rich descriptions to plain text on the server for event cards
  - Limits Prisma event-list queries to the fields required by the public listing/API payload
  - Added a Prisma index on `Event.status` for the default non-archived event listing

### Fixed

- **Hidden Mandatory Pedagogical Blocks**: Hidden event blocks no longer block public registration even if older data marked them mandatory
  - Registration API ignores hidden blocks when validating mandatory pedagogical selections
  - Explicit selections for hidden blocks are rejected as non-inscribable

- **Event Protected Fields False Positives**: Saving an unchanged admin event no longer auto-checks scraping protection fields
  - `protected_fields` only counts as changed when the submitted list differs from the existing list
  - `image_url` comparison treats empty string and `null` as equivalent
  - rich text descriptions are compared after sanitization/normalization
  - event dates are compared at minute precision to match the `datetime-local` admin input
  - unchanged normalized fields are omitted from the Prisma update payload

### Security

- **Rich Text Sanitization**: Event descriptions are sanitized on create/update and again before rich HTML rendering
  - Allowed tags are limited to paragraphs, line breaks, basic emphasis, lists, and links
  - Unsafe link targets such as `javascript:` are stripped
  - Script/style tags and unsupported attributes are removed

## [1.7.0] - 2026-06-30

### Changed

- **Prisma ORM v6 → v7**: upgraded `prisma` and `@prisma/client` to 7.x
  - v7 ships a Rust-free client; the runtime now connects over Direct TCP using the `@prisma/adapter-pg` (node-postgres) driver adapter
  - schema generator changed from `prisma-client-js` to `prisma-client`; the `url` was removed from the `datasource` block (now provided by the adapter / `prisma.config.ts`)
  - added `prisma.config.ts` (schema, migrations, seed command, datasource via `dotenv`)
  - enum imports moved to the runtime-free `@/app/generated/prisma/enums` subpath; model types and the `Prisma` namespace stay on `/client`. This prevents the v7 client runtime (`node:module`) from being pulled into browser bundles (fixed a Turbopack chunking error)
  - `excelExportService` now reuses the shared Prisma singleton instead of instantiating its own client
  - `scripts/postinstall.js`: removed the v6-only `--no-engine` flag (removed in v7)
- **Event lifecycle schedule**:
  - Registration season rollover now happens on June 10 instead of September
  - First progressive opening phase runs from June 10 to the end of the Toussaint holidays
  - Events are automatically archived one year after their latest date by `/api/cron/events/status-update`
  - `status` remains protected from automatic closing/opening/archiving when listed in `protected_fields`

### Removed

- **Prisma Accelerate**: dropped `@prisma/extension-accelerate`; the platform connects directly to PostgreSQL

### Added

- **Local Postgres dev**: `docker-compose.dev.yml` runs Postgres over loopback (matches prod topology); `npm run db:seed` seeds dev data

## [1.6.7] - 2026-02-27

### Fixed

- **Registration Edit API**: Complete fix for registration editing functionality
  - The `/api/events/[slug]/registrations/[registrationId]` route now handles all registration fields
  - Previously only supported `status` and `was_present_comment`, now supports all fields
  - Added handling for `booked_seats`, `caretaker_count`, `aesh_count`
  - Added handling for `want_formation`, `want_preparation`, `comments`
  - Added handling for manager fields (`manager_first_name`, `manager_last_name`, `manager_email`, `manager_phone_number`)
  - Added disabilities update logic with delete/recreate pattern
  - Added handling for `category`, `grades`, `age_ranges` fields
  - Fixed notification code to use `body.status` and `body.was_present_comment` instead of destructured variables
  - Added missing `fetchWithAuth` import to `EditRegistrationModal.tsx`

### Changed

- **Import Script**: Removed fuzzy matching for institution and event names
  - Institution and event matching now requires exact name match only
  - No more approximate matching using Levenshtein distance
  - Prevents accidental mismatches during data import

## [1.6.6] - 2026-02-26

### Added

- **Admin Notes System**: Allow administrators to add custom notes on any admin page via HelpWidget
  - New Prisma model `AdminNote` for storing per-page admin notes
  - New API endpoints `GET/PUT /api/admin/notes/[pageId]` for note management
  - Notes are displayed in the HelpWidget when available on admin pages
  - Admins can create and edit notes for each page, with author tracking and timestamps

### Changed

- **Import Error Display**: Improved error presentation in Excel import preview
  - Errors are now grouped by category (Email, Institution, Event, Date, Duplicates)
  - Visual error summary with color-coded categories
  - Line numbers clearly displayed for easy Excel file correction

- **HelpWidget Component**: Enhanced with admin notes support
  - Added `isAdminPage` prop to enable notes functionality
  - All admin components now pass `isAdminPage={true}` to HelpWidget
  - Real-time note editing with save functionality

## [1.6.5] - 2026-02-26

### Fixed

- **Import Script Type Mapping**: Fixed institution type categorization during Excel import
  - Added accent normalization in `mapPublicCategory()` to handle French characters correctly
  - Types like "Collège", "Élémentaire", "Lycée" now map correctly regardless of accent/case variations
  - Previously, many institutions were incorrectly categorized as "AUTRE" due to accent mismatch
  - `inferInstitutionType()` also updated to use the same normalization for consistency

### Added

- **Multiple Type Support**: Import system now handles multiple institution types separated by "+"
  - Supports formats like "Collège + Lycée", "MATERNELLE + ELEMENTAIRE", etc.
  - Automatic deduplication of categories when duplicate types are specified
  - Handles edge cases: missing spaces, extra spaces, empty parts, mixed known/unknown types

- **Column Aliases**: Added aliases for "Type de public" column in Excel parser
  - "Type de Public", "Type Public", "Public" now map to "Type de public"
  - More robust Excel file parsing with column name variations

- **Pending Welcome Emails System**: Complete solution for sending delayed welcome emails
  - New API endpoint `GET /api/admin/users/send-welcome-emails` to get pending count
  - New API endpoint `POST /api/admin/users/send-welcome-emails` to send all pending emails
  - Admin dashboard alert banner when users are waiting for welcome emails
  - Same email template (ID: 8539404) used as during import
  - Users can now receive their welcome emails even if import was done with `sendEmails: false`

### Changed

- **Import Test Coverage**: Enhanced test suite for `importExistingRegistrations.ts`
  - Added tests for multiple types with "+" separator (7 new test cases)
  - Added tests for edge cases (empty parts, all unknown types, mixed known/unknown)
  - Achieved 100% test coverage (statements, branches, functions, lines)
  - Total test count: 1547 tests passing

## [1.6.4] - 2026-02-22

### Added

- **Backups System**: Complete database backup and restore system
  - New daily automated CRON backup (`GET /api/cron/backup`)
  - New admin backups page (`/admin/backups`)
  - Admin functionalities: list, compare with current database, and restore
  - Safety backups automatically created before any restoration
  - Table-by-table difference viewer for comparison
- **Prisma Accelerate Support**: Added fallback sequential restore logic for environments that do not support interactive transactions (e.g. Prisma Accelerate data proxy)

### Changed

- **Admin Security Page**: Redesigned header to be cleaner and more consistent with other admin pages
- **Admin API**: Added new endpoint `POST /api/admin/backups` for manual backup triggering by administrators

## [1.6.3] - 2026-02-19

- **Import Script Transaction**: Fixed transaction handling in `scripts/import/importExistingRegistrations.ts`
  - Transaction callback now properly captures the `tx` parameter
  - All helper functions (`findOrCreateInstitution`, `findOrCreateUser`, `findEvent`, `linkUserToInstitution`) now accept and use the transaction client
  - Ensures proper atomicity when creating registrations - if registration creation fails, user/institution changes are rolled back
  - Note: For one-time import scripts, this is primarily defensive programming as data consistency is manually managed

### Changed

- **Public Category Labels**: Refined institution type labels for better clarity
  - `PERISCOLAIRE`: "Centre de loisirs / Périscolaire"
  - `PUBLICS_EMPECHES`: "Publics empêchés / Santé / Handicap"
  - `ASSOCIATION`: "Association / Publics éloignés"

### Technical Notes

- **Breaking Changes**: None - all changes are backwards compatible
- **Database Migration**: Not required
- **API Changes**: No API endpoints modified

## [1.6.2] - 2026-02-19

### Added

- **Import Existing Registrations**: Complete system for importing legacy registration data from Excel files
  - New admin page at `/admin/import-existing` with file upload and preview functionality
  - New API endpoint `POST /api/admin/import-existing` for processing Excel imports
  - Support for importing registrations with user, institution, and event data
  - Automatic user/institution matching or creation based on email and institution name
  - Excel export for scored registrations via `/api/admin/events/[id]/export-scored`
  - Import script at `scripts/import/importExistingRegistrations.ts` with comprehensive validation
  - Email notifications for import status and results

- **Admin Dashboard Enhancements**: Direct link to import existing registrations from dashboard
  - New navigation menu item for import functionality
  - Enhanced dashboard statistics with import-related metrics

- **Navbar and Sidebar Updates**: New navigation entries for import feature
  - Added "Import Existing" link in admin sidebar
  - Added corresponding menu entry in navbar for quick access

### Changed

- **Email Service**: Enhanced notification system for import operations
  - Added email templates for import success/failure notifications
  - Improved error handling and logging for email delivery

- **Excel Export Service**: Enhanced export functionality with additional formatting
  - Improved column ordering and data presentation
  - Better handling of special characters and French text

- **Scoring Engine**: Minor adjustments to scoring calculations
  - Refined edge case handling in scoring algorithms

- **Institution Search**: Improved search accuracy and performance
  - Enhanced fuzzy matching algorithm for better results

- **Institution Duplicate Detection**: Improved duplicate detection logic
  - Better handling of edge cases in institution matching

### Technical Notes

- **Breaking Changes**: None - all changes are backwards compatible
- **Database Migration**: Not required
- **API Changes**: New endpoint `POST /api/admin/import-existing` added
- **Dependencies**: No new dependencies added

### Documentation

- Updated CHANGELOG.md with comprehensive release notes
- Updated API documentation for new import endpoints
- Added inline documentation for import functionality

## [1.6.1] - 2026-02-13

### Added

- **Scoring**: New `AESH_COUNT` criterion with configurable thresholds (`minCount`, `highCount`) and progressive scoring (0 / 30 / 70 / 100)
- **Scoring UI**: Per-registration score breakdown display in admin registration cards (criterion label, weight, raw score, weighted contribution)
- **Excel Export**:
  - New export options (`sheets`, `anonymize`, `includeCoverSheet`, exporter metadata)
  - New `groups` sheet for complete export
  - Cover summary sheet (`Résumé`) with filters and export context
  - Advanced filters (`eventType`, `schoolGrade`, `ageRange`, `institutionId`, `eventId`)
- **Admin Dashboard Navigation**: New direct link to `/admin/security`

### Changed

- **Scoring Data Completeness**:
  - `EVENT_CATEGORY_MATCH` now receives full event audience data (`category`, `grades`, `age_ranges`) in both registrations API and preview API
  - `GEOGRAPHIC_ZONE` scoring path now includes institution address in preview mapping
  - Registration scoring payload now includes `aesh_count`
- **Scoring Validation**:
  - Scoring config Zod schemas moved to centralized `lib/validation/validationSchemas.ts`
  - Criterion type validation now derives from Prisma enum (`ScoringCriterionType`) to reduce drift
- **Admin Event Stats UX**: Average score now computed only on registrations that actually have a score (no null→0 bias)
- **Event Ordering**:
  - Event lists now use chronological ordering by `event_dates`
  - Public event lists explicitly sort upcoming ascending and past descending by first event date
- **Admin Events List UI**: Event cards display sorted event date list instead of creation date
- **Institution Forms (Admin + User flow)**:
  - School grades are now filtered by selected school category/type
  - Invalid grades/age ranges are cleaned automatically when category selection changes
- **User/Admin creation UX**:
  - Password minimum aligned to 10 characters in all creation flows
  - Role selection and skip-email-verification behavior improved in admin modals
- **Auth Verification Email**: Added `login_url` in verify-email success email template payload

### Removed

- Removed obsolete v1.5.2 mention of `SUB_CATEGORY_SPECIFICITY` from release references
- Removed deprecated admin create page route (`/admin/users/create`) in favor of modal/detail flow

### Fixed

- Corrected scoring tests and validation coverage for full active criterion set (including `EVENT_CATEGORY_MATCH` and `AESH_COUNT`)
- Minor UI wording cleanup (`Vérifier` badge text)

## [1.6.0] - 2026-02-12

### Summary

**Complete removal of legacy audience fields and scoring cleanup.** This release finalizes the migration from legacy audience fields (`sub_category`, `age_range`, `PublicSubCategory`) to `grades` and `age_ranges` across schema, API routes, UI, scraper mappings, exports, labels, and scoring. CI is fully green with the strict 100% test coverage gate.

### Changed

- **Audience Model Finalization**: All active flows now use `grades` and `age_ranges` instead of legacy audience fields
  - API responses and payloads aligned to `grades`/`age_ranges`
  - UI forms and badges updated for school grades and age ranges
  - Scraper mappings now output `categories + grades + age_ranges`
  - Export and analytics pipelines updated to new fields

- **Scoring System Alignment**:
  - `EVENT_CATEGORY_MATCH` now evaluates audience targets through `grades` and `age_ranges`
  - Removed stale scoring type filtering issues in admin scoring configuration endpoints

- **Configuration and Labels**:
  - Label infrastructure now centers on `school_grade_labels` and `age_range_labels`
  - Legacy subcategory label category removed from active configuration flows

### Removed

- **Legacy Schema and Enums**:
  - Removed `sub_category` fields from relevant models
  - Removed `age_range` legacy usage in favor of `age_ranges`
  - Removed `PublicSubCategory` enum from Prisma schema

- **Deprecated Scoring Criterion**:
  - Removed `SUB_CATEGORY_SPECIFICITY` from criteria definitions and runtime usage

- **Obsolete Utilities**:
  - Removed legacy category mapping utility and associated tests tied to removed enum model

### Validation

- Full pipeline successful: `format:check`, `lint`, `typecheck`, `test`, `build`
- Test suites passing with global coverage threshold at 100%

---

## [1.5.2] - 2026-02-06

### Summary

**New scoring criterion and UX improvements.** This release introduces `EVENT_CATEGORY_MATCH` for finer registration prioritization and improves the admin UI for better usability.

### Added

- **EVENT_CATEGORY_MATCH Scoring Criterion**: New criterion that favors registrations whose public category (Collèges, Lycées, etc.) matches the event's target categories
  - Score 100 for perfect match (all registration categories in event)
  - Score 75 for partial match (≥50% of categories match)
  - Score 50 for minimal match (≥1 category matches)
  - Score 0 if no categories match
  - Configurable thresholds and scores

### Changed

- **Scoring Criteria Count**: Increased with the addition of `EVENT_CATEGORY_MATCH`
- **Scoring UI Improvements**: Enhanced user experience for configuration
  - Removed `line-clamp-1` from criterion descriptions - now displayed in full
  - Centered "Parameters" button vertically alongside weight slider
  - Improved flex layout with proper spacing
  - Better responsive layout on mobile devices

- **Test Suite Updates**: Updated to reflect new criteria count
  - Updated scoringEngine.test.ts header comment to reflect criteria coverage
  - All 95+ tests still passing with new criteria

### Technical Notes

- **Breaking Changes**: None - all changes are backwards compatible
- **Database Migration**: Not required
- **API Changes**: No API endpoints modified
- **User Impact**: Admins can now configure more sophisticated scoring with category matching and sub-category specificity

### Documentation

- Updated CHANGELOG.md with comprehensive release notes
- No API documentation updates required (internal enhancement only)

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.1] - 2026-02-05

### Summary

**Legacy cleanup and scoring UX improvements.** This release removes the obsolete `public_type_labels` category following the PublicType → PublicCategory/PublicSubCategory refactoring, and significantly improves the scoring criteria user interface with clearer descriptions and better visual layout for non-technical administrators.

### Removed

- **Legacy `public_type_labels` Configuration Category**: Cleaned up obsolete configuration category following the v1.5.0 refactoring
  - Removed `public_type_labels` from `ConfigCategory` type in `lib/config/configService.ts`
  - Removed `public_type_labels` from `CATEGORY_LABELS` in `components/admin/misc/AdminSettingsClient.tsx`
  - Removed `public_type_labels` from `VALID_CATEGORIES` in `app/api/admin/config/route.ts`
  - Removed `public_type_labels` from `CATEGORIES` array in `app/admin/settings/page.tsx`
  - Removed `public_type_labels` from `preloadAllConfigs()` function
  - Removed legacy case from `getDefaultValues()` switch statement
  - Updated test suite to reflect 6 configuration categories instead of 7
  - Updated module documentation to remove outdated references

### Changed

- **Scoring Criteria Descriptions**: Completely rewritten for non-technical administrator audience
  - `ATTENDANCE_RATE`: Now explains "Récompense la fiabilité" with clear scoring behavior
  - `MONTHS_SINCE_LAST`: Now emphasizes "Favorise la diversité des publics" with concrete examples
  - `TOTAL_PARTICIPATIONS`: Simplified to "Soit favoriser les nouveaux établissements (diversité des publics), soit récompenser la fidélité"
  - `RECENT_NO_SHOW`: Clarified as "Applique une pénalité si l'établissement s'est inscrit mais ne s'est pas présenté..."
  - `GEOGRAPHIC_ZONE`: Enhanced with "Permet de privilégier le public local ou régional"
  - All descriptions now use clear, concise language without technical jargon
  - Descriptions explain both the "what" and the "why" of each criterion

- **Scoring Criteria UI Improvements**: Enhanced visual layout for better readability
  - Removed `line-clamp-1` from criterion descriptions - now displayed in full
  - Centered "Parameters" button vertically alongside weight slider
  - Improved flex layout with proper spacing (`pr-2` for description container)
  - Better responsive layout on mobile devices
  - Weight slider and parameters button now in same flex container for proper vertical alignment

- **Test Suite Updates**: Updated to reflect scoring criteria changes
  - Updated scoringEngine.test.ts header comment to reflect active criteria coverage
  - Updated test count comments for each criterion section
  - No functional test changes - all 95 tests still passing

### Technical Notes

- **Breaking Changes**: None - `public_type_labels` was already obsolete and unused since v1.5.0
- **Database Migration**: Not required
- **API Changes**: No API endpoints modified
- **User Impact**: Scoring configuration page now more user-friendly for non-technical staff

### Documentation

- Updated CHANGELOG.md with comprehensive release notes
- No API documentation updates required (internal cleanup only)

---

## [1.5.0] - 2026-02-05

### Summary

**PublicType → PublicCategory/PublicSubCategory refactoring.** This release replaces the single `PublicType` enum with a hierarchical two-level system: `PublicCategory` (institution types like COLLEGE, LYCEE, ASSOCIATION) and `PublicSubCategory` (age ranges/school levels like MAT_PS, ELEM_CP_CE1, COL_6EME, AGE_6_12). Events now use `category` and `sub_category` fields instead of the single `age_range` field.

### Changed

- **Database Schema**: Event model refactoring
  - Replaced `age_range: PublicType[]` with `category: PublicCategory[]` and `sub_category: PublicSubCategory[]`
  - Institution `type` field now uses `PublicCategory[]` (was `PublicType[]`)
  - Institution `age_range` field now uses `PublicSubCategory[]` for school levels/age ranges

- **API Responses**: Updated all event-related endpoints
  - `GET /api/events` returns `category` and `sub_category` instead of `age_range`
  - `GET /api/admin/events` returns `category` and `sub_category` instead of `age_range`
  - All registration endpoints include new category fields

- **Label System**: New label mappings for categories and subcategories
  - Added `PUBLIC_CATEGORY_LABELS` and `PUBLIC_SUBCATEGORY_LABELS` constants
  - Added `getPublicCategoryLabel()`, `getPublicSubCategoryLabel()` functions
  - Added async variants for server components
  - Deprecated `getPublicTypeLabel()` and `getPublicTypeLabels()` (still available for backward compatibility)

- **Scraper Mappings**: Updated WordPress ACF field mappings
  - `mapPublicIdsToCategories()` now returns `{ categories: PublicCategory[], subCategories: PublicSubCategory[] }`
  - `mapPublicNamesToCategories()` extracts both category and subcategory from WordPress data

- **Test Suite**: Updated all tests for new schema
  - 1281 tests passing with 100% coverage
  - Updated eventsScraper.test.ts, scraperMappings.test.ts, labelMappings.test.ts

### Technical Notes

- **Breaking Changes**: API responses now return `category`/`sub_category` instead of `age_range` for events
- **Database Migration**: Required - run `npx prisma db pull` to apply schema changes
- **Backward Compatibility**: Deprecated functions maintained with `@deprecated` annotations

---

## [1.4.3] - 2026-02-05

### Summary

**Redis distributed caching and configuration system improvements.** This release introduces Redis-backed distributed caching for the configuration service, ensuring immediate cache invalidation across all server instances. All hardcoded French labels have been replaced with dynamic configuration lookups, and the configuration service now achieves 100% test coverage.

### Added

- **Redis Distributed Caching for Configuration Service**: Primary Redis cache with in-memory fallback
  - Redis cache with 5-minute TTL (300 seconds) for configuration values
  - In-memory Map-based fallback cache when Redis is unavailable
  - Immediate cache invalidation across all server instances via Redis
  - Clear separation: Redis for distributed state, memory for fallback only
  - `clearConfigCache()` now clears both Redis and in-memory caches
  - Cache entries prefixed with `app_config:` for easy identification

- **Comprehensive Redis Integration Tests**: Full test coverage for Redis caching behavior
  - Tests for Redis cache hits, misses, and errors
  - Tests for cache invalidation (specific category and all categories)
  - Tests for graceful fallback when Redis fails
  - Tests for in-memory cache clearing even when Redis fails
  - 100% code coverage for configService.ts (statements, branches, functions, lines)

### Changed

- **Configuration Service Architecture**: Enhanced caching strategy
  - Redis is now the primary cache layer (was in-memory only)
  - In-memory cache serves as fallback when Redis unavailable
  - Cache invalidation is now async and distributed
  - TTL configuration: 5 minutes for Redis (300s), 5 minutes for memory (300000ms)

- **All Hardcoded Labels Replaced**: System-wide dynamic configuration usage
  - `RegistrationsClient.tsx`: Statistics labels now use dynamic REGISTRATION_STATUS_LABELS
  - `AdminStatisticsClient.tsx`: Chart labels use dynamic registration status labels
  - `AdminEventDetailClient.tsx`: Status badges use dynamic labels
  - `EditAttendanceModal.tsx`: Added `registrationStatusLabels` prop for dynamic labels
  - `EventDetailClient.tsx`: Added `eventStatusLabels` prop for dynamic event status
  - `generateHistoryReport()`: Now accepts dynamic `registrationStatusLabels` parameter
  - `app/events/[slug]/page.tsx`: Fetches and passes eventStatusLabels to client
  - `app/api/institutions/[id]/history/route.ts`: Fetches labels for history report

### Technical Notes

- **Breaking Changes**: None - all changes are backwards compatible
- **Database Migration**: Not required
- **API Changes**: No API endpoints modified (internal implementation only)
- **Redis Requirement**: Redis remains optional (falls back to in-memory), but highly recommended for production multi-instance deployments

### Documentation

- Updated CHANGELOG.md with Redis distributed caching details
- No API documentation updates required (internal implementation)

## [1.4.2] - 2026-01-30

### Summary

**Dynamic label system and admin UX improvements.** This release introduces a dynamic label system with async functions for server components, improves the scoring criteria definitions with better descriptions, enhances admin user management with inline institution editing, and provides various UI/UX improvements across the platform.

### Added

- **Dynamic Label System for Server Components**: New async functions to retrieve dynamic labels from database configuration
  - New `getEventTypeLabelAsync()`, `getPublicTypeLabelAsync()`, `getRegistrationStatusLabelAsync()` functions in `lib/config/labelMappings.ts`
  - Server components can now use dynamic labels that reflect admin customizations
  - Automatic fallback to static defaults when database is unavailable
  - Maintains backward compatibility with existing static functions for client components
  - Simplified label retrieval pattern: `await getEventTypeLabelAsync(type)` in server components

- **Admin User Institution Management**: Inline editing of user institutions in user detail page
  - New edit mode for modifying user's associated institutions directly from detail view
  - Integrated `InstitutionSelector` component for seamless institution management
  - Visual feedback with save/cancel actions and loading states
  - No need to navigate to separate edit page for institution changes

### Changed

- **Scoring Criteria Definitions**: Improved descriptions and parameter naming for better clarity
  - `ATTENDANCE_RATE`: Updated description to clarify neutral score (50) with no history
  - `MONTHS_SINCE_LAST`: Enhanced description emphasizing diversity of publics
  - Parameter labels improved: "Seuil de bonus (%)" instead of "Seuil pour bonus (%)"
  - Better parameter descriptions explaining scoring behavior clearly
  - Updated test suite to reflect improved descriptions

- **Label System Architecture**: Enhanced `lib/config/labelMappings.ts` with dual API
  - Static functions for client components (synchronous, defaults only)
  - Async functions for server components (dynamic, database-backed)
  - Clear documentation and type definitions for both patterns
  - Comprehensive test coverage for async label functions

- **Admin User Detail Page**: Enhanced with dynamic label support and improved UX
  - Server component now passes dynamic labels to client component
  - Better visual hierarchy and information organization
  - Improved responsiveness across screen sizes

- **Admin Statistics Client**: Updated with dynamic label integration
  - Server-side label fetching for accurate status and type display
  - Fallback to static defaults for robustness

- **Admin Event Components**: Enhanced with dynamic labels and improved interactions
  - `AdminEventsClient`: Better filtering and status display
  - `AdminEventForm`: Improved field labeling and validation feedback
  - `InstitutionHistoryModal`: Enhanced registration status display

- **Export Dialog**: Improved with dynamic label support
  - Accurate French translations in export files
  - Better label consistency across admin and user interfaces

- **Institution Components**: Enhanced with dynamic labels
  - `AdminInstitutionsClient`: Improved public type display
  - `AdminInstitutionCreateModal`: Better form labeling
  - `InstitutionSelector`: Enhanced accessibility and usability

### Technical Notes

- **Breaking Changes**: None - all changes are backwards compatible
- **Database Migration**: Not required
- **API Changes**: No API endpoints modified
- **Performance**: Async label functions include caching via configService (5-minute TTL)

### Documentation

- Updated CHANGELOG.md with comprehensive release notes
- No API documentation updates required (internal implementation detail)

## [1.4.1] - 2026-01-29

### Summary

**Event scraping protection and UI improvements.** This release introduces a field protection system to prevent automatic scraping from overwriting manually edited event data, enhances the institution selector with user-specific institutions, adds email notifications for musical preparation requests, and improves the style guide with interactive components.

### Added

- **Event Field Protection System**: Administrators can now protect specific event fields from being overwritten by automatic scraping
  - New `manually_edited` boolean field on Event model to track manual modifications
  - New `protected_fields` array field on Event model to store protected field names
  - Protection available for 12 fields: title, description, type, age_range, location, duration, total_seats, caretaker, image_url, event_dates, has_initial_formation, has_musical_preparation, slug, accessibility
  - Admin interface in event form to select which fields to protect from scraping
  - Scraping route now respects protected fields and skips updating them
  - Visual indicator showing number of protected fields in event form

- **Musical Preparation Email Notifications**: Automatic email notifications to Opera staff when users request musical preparation
  - Email sent via SMTP2GO template (ID: 4049381) when registration is confirmed with `want_preparation: true`
  - Email includes user details, institution info, and event details
  - Configurable recipient via `OPERA_ADMIN_EMAIL` environment variable (defaults to `inscriptions@opera-orchestre-montpellier.fr`)
  - Logged notification events for audit trail

- **User Institutions Display in Selector**: Enhanced institution selector with user's attached institutions
  - New `userInstitutionIds` prop on `InstitutionSelector` component
  - Dedicated section showing user's attached institutions at the top of the selector
  - Improved visual feedback with grid layout and better selection indicators
  - Loading state for user institutions

- **Opera Website Link on Event Details**: Direct link to event page on Opera's official website
  - Info box displayed on event detail pages when `slug` is available
  - Direct link to `https://www.opera-orchestre-montpellier.fr/evenements/{slug}`
  - Helpful text explaining the link purpose

- **Interactive Style Guide Components**: Enhanced style guide with live interactive components
  - Converted to client component with React hooks (useState, useEffect, useRef)
  - Added slider component with live value display
  - Added multi-select dropdown component with checkbox selection
  - Added additional button variants (confirm, warning, ghost)
  - Click-outside functionality for dropdowns
  - Proper z-index layering with `z-[100]` utility

### Changed

- **Event Update API**: Enhanced to track field modifications and manage protected fields
- **lib/ Directory Structure**: Comprehensive reorganization of utility files into logical subdirectories
  - `lib/auth/`: Authentication and token management (accountLockout, cookieConfig, csrfProtection, passwordHistory, refreshTokenManager, tokenStore)
  - `lib/config/`: Configuration and constants (configService, labelDefaults, labelMappings, validateSecrets)
  - `lib/events/`: Event-related logic (events, eventUrl, registrationAnalytics)
  - `lib/search/`: Search and fuzzy matching (fuzzySearch, institutionDuplicateDetection, institutionSearch)
  - `lib/security/`: Security and logging (logSanitization, securityLogger, securityUtils)
  - `lib/validation/`: Validation schemas and utilities (errorMessages, frenchValidation, geographicZone, validationSchemas)
  - `lib/api/`: API-related utilities (fetchWithAuth)
  - `lib/notifications/`: Email and in-app notifications (emailService, notificationService, unifiedNotificationService)
  - `lib/utils/`: General utilities (excelExportService, getBaseUrl, toast)
  - `lib/middleware/`: Server middleware (admin, cronAuth, logger, prismaConfig, redisConfig, serverRateLimit)
  - `lib/cron/`, `lib/scoring/`, `lib/services/`, `lib/__tests__/`: Unchanged (already well-organized)
  - All import statements updated across the codebase to reflect new paths
  - Automatic detection of modified fields in update requests
  - Automatic merging of existing protected fields with newly modified fields
  - Events marked as `manually_edited: true` when any field is modified
  - Response includes `modified_fields` and `protected_fields` arrays

- **Institution Selector UI**: Improved user experience with grid layout
  - Changed from list view to 2-column grid for better space utilization
  - Enhanced selection indicators with blue border and ring
  - Better responsive design for mobile and desktop

- **Registration Confirmation Flow**: Enhanced email notifications
  - Added `eventLocation` to notification payload
  - Include full registration details in email templates

### Removed

- **Admin Image Upload for Homepage and 404 Page**: Removed admin image upload functionality
  - Removed endpoint: `POST /api/admin/images/upload`
  - Removed `HomepagePreviewModal.tsx` and `ImageUploadPreview.tsx` components
  - Removed image upload section from admin settings page
  - Images for homepage and 404 page must now be managed directly in the codebase

- **Preparation Request API Route**: Removed standalone endpoint (`/api/events/[slug]/preparation-request`)
  - Functionality integrated directly into registration confirmation flow
  - Preparation requests now tracked via `want_preparation` field on registration
  - Simplified API surface with single source of truth for preparation requests

### Technical Notes

- **Breaking Changes**: None - all changes are backwards compatible

- **Database Migration**: Required migration to add new Event model fields

  ```bash
  npx prisma migrate deploy
  ```

- **Environment Variables**: New optional variable
  - `OPERA_ADMIN_EMAIL`: Email address for musical preparation notifications (defaults to `inscriptions@opera-orchestre-montpellier.fr`)

- **Performance**: Protected fields reduce unnecessary database writes during scraping

### Documentation

- Updated CLAUDE.md with new field protection system
- Updated CHANGELOG.md with comprehensive release notes
- No API documentation updates required (internal implementation detail)

## [1.4.0] - 2026-01-23

### Summary

**Major refactoring: Class to Group renaming, dynamic configuration system, component reorganization, and accessibility enhancements.** This release introduces a comprehensive admin configuration system for customizable labels, reorganizes the entire component structure for better maintainability, enhances the accessibility model, and adds preparation request functionality.

### Added

- **Dynamic Configuration System**: Admin-customizable labels and settings through database-backed configuration
  - New `AppConfig` model for storing configuration in database
  - New `configService.ts` with 5-minute caching and CRUD operations
  - New `labelDefaults.ts` for static default values (client-safe)
  - Admin settings page at `/admin/settings` for label customization
  - Categories: accessibility_labels, event_type_labels, public_type_labels, registration_status_labels, event_status_labels
  - API endpoints: `GET/PUT/DELETE /api/admin/config`

- **Preparation Request System**: Musical preparation request functionality for events
  - New endpoint: `POST /api/events/[slug]/preparation-request`
  - Users can request musical preparation materials for events
  - Optional `is_formation_mandatory` field on events
  - Preparation status tracking in registrations

- **Group Management API**: Dedicated endpoints for group operations
  - New endpoint: `POST /api/users/[id]/groups` for creating groups
  - New endpoint: `GET/PATCH/DELETE /api/groups/[groupId]` for group management
  - Groups support optional naming for better identification

- **Event Archiving**: New status and endpoint for archiving past events
  - Added `ARCHIVED` status to `EventStatus` enum
  - New endpoint: `PATCH /api/admin/events/[id]/archive`
  - Archived events are protected from modifications
  - Since v1.7.0, the status cron also archives events automatically one year after their latest date unless `status` is protected

- **Enhanced Accessibility Details**: Support for detailed accessibility information
  - Added `details` field to `RegistrationDisability` and `GroupDisability` models
  - Allows capturing specific information for "OTHER" accessibility type

### Changed

- **Class → Group Renaming**: Comprehensive renaming for semantic clarity
  - `Class` model renamed to `Group`
  - `ClassDisability` renamed to `GroupDisability`
  - All API routes updated: `/api/classes/*` → `/api/groups/*`
  - All components and imports updated to use new terminology
  - Database migration applied

- **Accessibility Model Updates**: More inclusive accessibility options
  - Replaced `NONE` with `NEUROATYPICAL` and `OTHER` in `Accessibility` enum
  - Updated all accessibility mappings and labels
  - Changed accessibility label: "Aucun" → "Neuroatypique"

- **Component Structure Reorganization**: Improved code organization
  - Moved from `components/links/` to `components/layout/` (Navbar, Sidebar, Footer)
  - Moved from `components/routes/` to `components/guards/` (ProtectedRoute, GuestRoute)
  - Reorganized components into feature-specific directories:
    - `components/account/` - Account-related components
    - `components/admin/` - Admin-specific components (events, institutions, users, scoring, misc)
    - `components/events/` - Event-related components
    - `components/guards/` - Route guards

- **Registration Model Cleanup**: Removed deprecated field
  - Removed `pedagogical_needs` field from `Registration` model
  - Replaced by structured accessibility details with disabilities array

### Technical Notes

- **Breaking Changes**:
  - API endpoints changed: `/api/classes/*` → `/api/groups/*`
  - `Class` references renamed to `Group` throughout the codebase
  - `Accessibility.NONE` replaced with `Accessibility.NEUROATYPICAL`
  - Component import paths changed due to reorganization

- **Database Migration**: Required migration to apply schema changes
  - Run `npx prisma migrate deploy` to apply changes in production

- **Cache Management**: Configuration cache cleared on updates via `clearConfigCache()`
- **Label System**: Static defaults in `labelDefaults.ts` for client-side safety; dynamic values via `configService.ts`

### Dependencies

- No new dependencies added
- Internal refactoring only

### Documentation

- Updated README.md with new component structure
- Updated TECHNICAL_DOCUMENTATION.md with Group model and configuration service
- Updated swagger.json with new API endpoints and Group schema
- Updated .env.example with CONFIG_SERVICE_SECRET

## [1.3.3] - 2026-01-19

### Summary

**Removed CAPTCHA protection from authentication forms.** This release removes the Google reCAPTCHA v2 integration from login and registration forms, simplifying the user experience while maintaining security through other mechanisms (rate limiting, account lockout).

### Removed

- **CAPTCHA Integration**: Removed Google reCAPTCHA v2 from authentication flows
  - Removed CAPTCHA verification from login page (`app/auth/login/page.tsx`)
  - Removed CAPTCHA verification from login API route (`app/api/auth/login/route.ts`)
  - Removed CAPTCHA verification from registration API route (`app/api/auth/register/route.ts`)
  - Removed `ReCaptchaWrapper` component and related dependencies
  - Removed `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY` environment variables

### Security

- Security remains enforced through existing mechanisms:
  - Rate limiting on authentication endpoints
  - Account lockout after 5 failed login attempts
  - Password history enforcement (5 passwords)

## [1.3.2] - 2026-01-15

### Summary

**Progressive event opening based on school holidays.** This release implements an automated system that progressively opens events for registration based on the school holiday calendar (Toussaint, Christmas) retrieved from the official government API.

### Added

- **HolidaysService**: New service to fetch school holiday dates from `data.education.gouv.fr`
  - Automatic retrieval of Toussaint and Christmas holidays for the Montpellier academy
  - Retry logic and fallback dates for reliability
  - `getOpeningLimitDate` method to determine current opening phase

### Changed

- **Event Scraper**: Modified to set initial event status (`OPEN`/`CLOSED`) based on opening limit date
- **Status Update Cron**: Enhanced to progressively open existing events (`CLOSED` -> `OPEN`) when they enter the allowed period
  - Phase 1: June 10 -> Toussaint (Events up to Nov 7 approx)
  - Phase 2: Toussaint -> Christmas (Events up to Jan 6 approx)
  - Phase 3: Christmas -> End of Season (All remaining events)

## [1.3.1] - 2026-01-08

### Summary

**Centralized label mappings for improved maintainability.** This release refactors all display labels (status, types, accessibility) into a single centralized file, ensuring consistency across the application and simplifying future translations or modifications.

### Added

- **Centralized Label Mappings**: New `lib/labelMappings.ts` file containing all display labels
  - `EVENT_TYPE_LABELS`: 32 event type translations (e.g., OPERA → "Opéra")
  - `PUBLIC_TYPE_LABELS`: 10 public type translations (e.g., MATERNELLE → "Maternelle")
  - `EVENT_STATUS_LABELS`: Event status translations (OPEN → "Ouvert")
  - `REGISTRATION_STATUS_LABELS`: 6 registration status translations
  - `ACCESSIBILITY_LABELS`: 5 accessibility type translations
  - Helper functions for safe label retrieval with fallback values

### Changed

- **14 Files Refactored**: Replaced inline label mappings with centralized imports
  - `AdminEventsClient.tsx`: Event types, public types, and status filtering
  - `RegistrationsClient.tsx`: Status and accessibility labels, filter options
  - `RegistrationCard.tsx`: Status badge display
  - `InstitutionHistoryModal.tsx`: Registration status display
  - `AccountClient.tsx`: Public types, accessibility, and status mappings
  - `AdminUserDetailClient.tsx`: Status display in registration cards
  - `AdminInstitutionDetailClient.tsx`: Status display and age range options
  - `excelExportService.ts`: All `format*()` functions use centralized labels
  - `UserEventDetailClient.tsx`: Public type and accessibility labels
  - `ClientEvents.tsx`: Event type filtering and public type display
  - `InstitutionSelector.tsx`: Institution types and age range options
  - `AdminInstitutionCreateModal.tsx`: Type and age range options
  - `ExportDialog.tsx`: Status, event status, and public type select options

### Technical Notes

- All label mappings are typed with TypeScript for compile-time safety
- Labels are keyed by Prisma enum values for consistency
- Fallback to raw enum value if label not found, preventing runtime errors
- No functional changes to user-facing behavior - purely refactoring

## [1.3.0] - 2025-12-19

### Summary

**Enhanced admin dashboard, advanced institution search, and performance improvements.** This release introduces comprehensive admin statistics with client components, advanced fuzzy matching for institution searches, improved filter handling with debounce, and various code quality improvements.

### Added

- **Admin Dashboard Statistics API**: New API endpoint and client component for admin statistics
  - Comprehensive statistics display with visual components
  - Integrated test suite for statistics functionality
  - Real-time data visualization for admin users

- **Advanced Institution Search**: Enhanced search capabilities with fuzzy matching
  - Implemented Levenshtein distance algorithm for better search results
  - Support for searching by both name and city
  - Improved relevance scoring for search results
  - Refactored institution search API and UI components

- **Skip Email Verification Option**: New feature for user creation
  - Added option to skip email verification during user creation
  - Useful for admin-created accounts and testing scenarios

- **Event Scraper Improvements**: Enhanced utility functions
  - Exported utility functions in eventsScraper for full test coverage
  - Refactored location and type mappings for better maintainability
  - Added mapping of WordPress public IDs to age ranges

### Changed

- **Filter Handling Improvements**: Enhanced user experience
  - Implemented debounce for filter changes to reduce API calls
  - Improved search query handling for better performance
  - Sort public type badges by defined order

- **Rate Limiting Adjustments**: Security improvements
  - Increased maxAttempts for sensitive rate limit operations

- **Code Refactoring**: Improved code structure
  - Refactored code structure for improved readability and maintainability
  - Enhanced email handling with non-unique email support
  - Updated `findFirst` usage instead of `findUnique` for email existence checks

### Fixed

- **Email Handling**: Made email field non-unique to support edge cases
- **Null Import ID**: Allow null import ID in data handling
- **Prisma Mock**: Added `findFirst` to Prisma mock for better test coverage

### Dependencies

- **csv-parse**: Added new dependency for CSV parsing functionality

### Documentation

- **README Updates**: Removed outdated security.txt update instructions

## [1.2.2] - 2025-12-11

### Summary

**Bug fixes for image optimization and password reset.** This release addresses a configuration issue with image optimization and fixes the password reset endpoint.

### Fixed

- **Image Optimization**: Added `unoptimized: true` to `next.config.ts` to resolve issues with external images.
- **Password Reset**: Corrected the API endpoint for setting a new password (`app/api/auth/reset-password/route.ts`).

## [1.2.1] - 2025-12-07

### Summary

**Migration to SMTP2GO for email services.** This release replaces the SendGrid integration with SMTP2GO using standard SMTP Relay via Nodemailer, enhancing reliability and aligning with the organization's infrastructure preferences.

### Changed

- **Email Service Provider**: Migrated from SendGrid API to SMTP2GO (SMTP Relay)
  - Replaced `@sendgrid/mail` with `nodemailer`
  - Updated configuration to use standard SMTP credentials (host, port, user, pass)
  - Preserved existing retry logic and html template structure
  - Retained "Plateforme de l'Opéra" sender identity

### Security

- **Environment Variables**: Updated required variables
  - Removed `SENDGRID_API_KEY`
  - Added `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
  - Secrets should be rotated during migration

## [1.2.0] - 2025-12-04

### Summary

**Admin event management and CI/CD automation.** This release empowers administrators to manage events directly from the dashboard and introduces a robust CI/CD pipeline with GitHub Actions for automated quality assurance.

### Added

- **Admin Event Management**: Full CRUD operations for events in the admin dashboard
  - Create, edit, and delete events directly from the admin interface
  - Comprehensive validation for all event fields
  - Protection against deleting events with existing registrations
  - Security logging for all event modifications

- **CI/CD Pipeline**: Automated GitHub Actions workflow
  - Automated linting, type checking, and testing on push and pull requests
  - Build verification to ensure production readiness
  - Security auditing with `npm audit`
  - Caching strategies for faster execution times

- **Enhanced Filtering**: New `MultiSelect` component
  - Improved user experience for filtering events by type and public
  - Better visual feedback for selected filters

- **Security Logging**: Enhanced audit trails
  - Added security logging for critical email events
  - Improved log sanitization for sensitive data

### Changed

- **Email Templates**: Refactored to remove dependency on user last name
  - Simplified templates for better compatibility
  - Updated all email service calls to match new signature

- **Password Security**: Strengthened validation logic
  - Refactored password validation to use shared schema
  - Enforced 10-character minimum length across all forms

### Technical Notes

- New API endpoints: `GET/POST /api/admin/events` and `GET/PUT/DELETE /api/admin/events/[id]`
- CI workflow triggers on push to `main`, `dev`, `hotfix` branches and all PRs

### Summary

**Institution management enhancements and code quality improvements.** This release introduces institution creation capabilities, age-based event filtering, strengthened password requirements, and comprehensive code refactoring with improved test coverage.

### Added

- **Institution Creation System**: Users can now create institutions directly from the platform
  - New API endpoint (`POST /api/institutions`) with validation and duplicate detection
  - Integrated institution creation form in `InstitutionSelector` component
  - Fuzzy matching algorithm to prevent duplicate institution entries
  - Support for "not listed" institutions during registration flow

- **Institution Age Range Field**: Enhanced institution model for intelligent event filtering
  - New `age_range` field in Institution model (Array of PublicType: CRECHE, MATERNELLE, etc.)
  - Database migration to add age range support to existing institutions
  - Automatic "Tous les publics" filter on events page based on institution age range
  - Pre-filtering events to show only age-appropriate content

- **Enhanced Validation Utilities**: Dedicated modules for reusable validation logic
  - French name validation utilities (`lib/frenchValidation.ts`)
  - Fuzzy search utilities for duplicate detection (`lib/fuzzySearch.ts`)
  - Institution duplicate detection module (`lib/institutionDuplicateDetection.ts`)
  - Comprehensive unit tests for all validation utilities

### Changed

- **Password Security Enhancement**: Minimum password length increased from 8 to 10 characters
  - Updated validation schemas in `lib/securityUtils.ts`
  - Modified registration form password requirements
  - Enhanced password strength validation in `useSecureForm` hook
  - Updated all related tests to reflect new minimum length

- **Scoring Engine Improvements**: Refactored for better clarity and validation
  - Clarified validated scoring engine implementation
  - Improved test coverage for scoring algorithms
  - Added comprehensive validation tests for edge cases
  - Better documentation of scoring criteria and weight handling

- **React 19 Compatibility**: Updated dependencies and imports for React 19
  - Fixed React import compatibility with Testing Library
  - Upgraded `@testing-library/react-dom` testing utilities
  - Resolved TypeScript type conflicts with React 19

### Testing

- **New Test Suites Added**:
  - Unit tests for institution duplicate detection (`lib/__tests__/institutionDuplicateDetection.test.ts`)
  - Unit tests for fuzzy search utilities (`lib/__tests__/fuzzySearch.test.ts`)
  - Unit tests for French validation utilities (`lib/__tests__/frenchValidation.test.ts`)
  - Comprehensive validation tests for scoring engine
  - Enhanced test coverage for secure form hooks

### Technical Notes

- Institution `age_range` field is optional (nullable) to maintain backward compatibility
- Duplicate detection uses Levenshtein distance algorithm with configurable threshold
- Password length change may require existing users to update passwords on next login
- All new validation modules follow consistent error handling patterns

### Migration Guide

For existing deployments upgrading to v1.1.0:

1. Run database migration to add `age_range` field to institutions:

   ```bash
   npx prisma migrate deploy
   ```

2. Optionally update existing institutions with age range data through admin panel

3. No breaking changes to existing API endpoints or user workflows

## [1.0.5] - 2025-11-27

### Summary

**Enhanced event URL system with SEO-friendly slugs.** This release improves event identification and navigation by adding URL slug support throughout the application, enabling direct links to Opera website events and better SEO.

### Added

- **Event URL Helper Function**: New `getEventUrl()` utility function for consistent event URL generation
  - Centralized URL generation logic in `lib/eventUrl.ts`
  - Automatically constructs Opera website URLs using event slugs when available
  - Fallback to local event detail pages for events without slugs
  - Used across both client and server components for consistency

- **Event Slug Integration**: Enhanced event data structures with slug field support
  - Added `slug` field to Event model responses in all API endpoints
  - Scraped slug data from WordPress API during event synchronization
  - Included in email notification payloads for direct Opera website links
  - Added to admin statistics client for proper event linking

### Changed

- **Event Detail Navigation**: Refactored event detail components to use slugs
  - `AdminEventDetailClient` now uses event slug for API calls and navigation
  - `UserEventDetailClient` updated to leverage slug-based routing
  - Admin and user event detail pages pass slug to client components
  - Improved URL structure for better user experience and SEO

- **Event Registration API**: Enhanced registration endpoints with slug support
  - Registration API now properly handles event identification via slugs
  - Improved event lookup logic to support both ID and slug-based queries
  - Better error handling for events without slug data

### Technical Notes

- Event slugs are optional (nullable) to maintain backward compatibility
- `getEventUrl()` helper provides graceful fallback when slugs are unavailable
- Slug field included in all event API responses (events list, event detail, admin stats)
- Email notifications now contain direct Opera website links when slugs exist

### Testing

- **New Tests**: Added comprehensive tests for `getEventUrl()` helper function
  - Tests for slug-based URL generation
  - Tests for fallback behavior with missing slugs
  - Tests for null/undefined event handling
  - Ensures consistent URL generation across the application

## [1.0.4] - 2025-11-21

### Summary

**Scoring system refinements and UI improvements.** This release fixes critical scoring logic issues and enhances the admin interface for better usability.

### Fixed

- **Scoring System Logic**: Corrected penalty weight enforcement to ensure positive values only
  - Introduced `isPenalty` flag to distinguish penalty criteria from bonus criteria
  - Penalty criteria now properly enforce positive weights (0% to +100%)
  - Fixed double negation issue in scoring calculations
  - Updated UI to reflect correct weight ranges based on criterion type

- **Layout and UI Improvements**: Enhanced admin dashboard and scoring configuration displays
  - Removed unnecessary overflow handling for better content visibility
  - Adjusted sidebar height for improved usability
  - Fixed width property issues in sidebar component

### Changed

- **Geographic Zone Scoring**: Added `GEOGRAPHIC_ZONE` criterion to registration scoring system
  - Allows prioritizing registrations based on institutional location
  - Supports negative weights for geographic penalty scenarios

## [1.0.3] - 2025-11-20

### Summary

**Minor enhancements for event identification and test infrastructure.** This release adds URL slug support for events and improves test configuration for better developer experience.

### Added

- **Event Slug Field**: Added optional `slug` field to Event model for URL-friendly identifiers
  - Scraped from WordPress API and stored in database
  - Can be used for SEO-friendly URLs and direct linking to Opera website events
  - Nullable field to maintain backward compatibility with existing events

### Changed

- **Test Configuration Improvements**: Enhanced Jest configuration for better test discovery
  - Explicitly defined test root directories (`rootDir: '.'`)
  - Added test file pattern matching with `roots` directive
  - Updated test scripts: `test` now runs without watch mode, new `test:watch` and `coverage` scripts
  - More predictable test execution across different environments

- **Developer Experience**: Updated npm test scripts for better workflow
  - `npm test` - Run tests once (for CI/local verification)
  - `npm run test:watch` - Run tests in watch mode (for development)
  - `npm run coverage` - Generate coverage report

### Technical Notes

- Event slug is stored in the `Event` table as `slug: String?` (optional)
- Slug is scraped from WordPress API's `event.slug` field
- Tests now explicitly match `**/__tests__/**/*.test.[jt]s?(x)` and `**/?(*.)test.[jt]s?(x)` patterns

## [1.0.2] - 2025-11-14

### Summary

**Final production-ready release with enhanced scoring system and comprehensive data exports.** This release completes all remaining features and marks the project as ready for alpha testing in pre-production environment.

### Added

- **Negative Weight Support for Scoring Criteria**: Registration scoring system now supports negative weights (-100% to +100%) for penalty criteria
  - Visual indicators: negative weights displayed in red, positive weights with "+" prefix
  - Slider ranges automatically adjust based on criterion type (penalty vs bonus)
  - Example: "Recent No-Show" penalty can now range from -100% to +100%

- **Comprehensive Excel Export Enhancements**: All database fields now exported (excluding technical IDs)
  - **Users export**: Added 6 columns (email verified, last activity, failed login attempts, account locked status, locked until date, updated date) - Total: 17 columns
  - **Events export**: Added 9 columns (description, event types, accessibility details, image URL, initial formation, musical preparation, caretaker requirements, updated date) - Total: 22 columns
  - **Registrations export**: Added 8 columns (AESH count, formation requested, preparation requested, presence comment, updated date) - Total: 22 columns
  - **Institutions export**: Added 5 columns (street separated, postal code, city, not listed field, updated date) - Total: 15 columns

- **Complete French Translation**: All database enum values now properly translated in exports
  - 32 event types translated (e.g., CONCERT_LYRIQUE → "Concert lyrique", CHAMBRE_BAROQUE → "Chambre baroque")
  - 5 accessibility types translated (VISUAL → "Malvoyant", MOTOR → "Moteur (PMR)", AUDITORY → "Malentendant", PSYCHIC → "Psychique", NONE → "Aucun")

### Fixed

- **CSRF Token for Excel Exports**: Added missing CSRF token to export dialog preventing successful downloads
  - Export dialog now properly fetches and includes CSRF token in API requests
  - Enhanced error handling to display specific error messages from server

- **Scoring Engine Double Negation Bug**: Fixed critical bug where negative weights were being negated twice
  - `calculateRecentNoShowScore` now returns positive raw scores, letting negative weights create penalties correctly
  - Example: rawScore=100 × weight=-15% = -15 points (previously would return +15 due to double negation)

### Changed

- Updated all scoring-related tests to reflect new negative weight logic
- Enhanced Excel export service with better type safety and null handling
- Improved export dialog user experience with loading states and error messages

### Project Status

**✅ COMPLETE - Ready for Alpha Testing**

- All planned features implemented and tested
- Comprehensive documentation updated
- Production-ready pending deployment to pre-production environment
- Awaiting real-world testing and feedback collection

### Next Steps

- Deploy to pre-production environment for alpha testing
- Collect user feedback and bug reports
- Monitor system performance and error logs
- Plan future enhancements based on alpha feedback

## [1.0.1] - 2025-11-28

### Summary

**Removed Sentry monitoring integration.** As requested by the Opera, all error monitoring and observability features have been removed from the application. Error boundaries remain in place for user-friendly error pages, with errors logged to console.

### Removed

- **Sentry Integration**: Removed all error monitoring and session replay capabilities
  - Removed `@sentry/nextjs` dependency
  - Removed Sentry configuration files (`sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation-client.ts`)
  - Removed Sentry imports from error boundary components
  - Updated Next.js configuration to remove Sentry webpack plugin
  - Updated CSP headers to remove Sentry-related domains
  - Removed Sentry environment variables from documentation

### Changed

- Error boundaries now only log errors to console instead of sending to Sentry
- Simplified instrumentation.ts to only handle secret validation

## [1.0.0] - 2025-11-10

### Summary

**Project completed and ready for deployment.** All core features have been implemented, tested, and documented. The platform is fully functional and production-ready, pending final deployment to production environment.

### Project Completion Status

- ✅ User authentication and authorization system with JWT and refresh tokens
- ✅ Multi-institution user management
- ✅ Event scraping and database synchronization from Opera WordPress API
- ✅ Registration management with automatic sorting algorithms
- ✅ Admin dashboard with statistics, analytics, and data export
- ✅ Email notification system with HTML templates
- ✅ In-app notification system
- ✅ Account management with password changes and preferences
- ✅ Comprehensive security features (CSRF, rate limiting, account lockout, CAPTCHA)
- ✅ Content Security Policy with nonce-based protection
- ✅ Database migration system
- ✅ Full test coverage with Jest
- ✅ CI/CD pipeline configuration
- ✅ Complete documentation (README, CLAUDE.md, inline comments)

### Added

- Admin event management page with registration list and bulk operations
- Registration scoring system for automatic capacity management
- Manual registration approval/rejection workflow
- User account page with institution management and group information
- Event detail pages for both users and administrators
- Export functionality for users, events, registrations, and institutions to Excel
- Disability tracking for registrations with detailed counts
- Caretaker count fields for events and registrations
- Contact modal in footer for communication with Opera team
- Style guide page with UI component reference
- Security.txt file (RFC 9116) for vulnerability disclosure
- Comprehensive error handling and logging throughout the application

### Final Architecture

- **Authentication**: JWT-based with access (15min) and refresh (7 days) tokens, HTTP-only cookies
- **Security**: CSRF protection, rate limiting (auth/API/search/sensitive), account lockout (10 attempts), CAPTCHA, password history (5 passwords), CSP with nonces
- **Database**: PostgreSQL with Prisma ORM, custom client output location
- **Caching**: Redis for distributed state (CSRF, rate limits, sessions) with memory fallback
- **Email**: Nodemailer/SendGrid with HTML templates for notifications
- **Testing**: Jest with 100% coverage requirement for critical modules
- **Deployment**: Ready for production with environment variable validation

### Documentation

- Updated README with complete tech stack, architecture overview, and API examples
- Enhanced CLAUDE.md with comprehensive development guidelines
- All code comments translated to English for accessibility
- Complete environment variable documentation in .env.example

### Known Limitations

- Event scraping depends on Opera WordPress API availability and structure
- In-memory fallback mode (without Redis) not suitable for multi-instance production deployments
- CAPTCHA protection optional (system works with or without configuration)

### Next Steps (Post-Deployment)

- Monitor CSP violation reports at `/api/csp-report`
- Set up cron jobs for event scraping (`/api/cron/events/scraping`), status updates (`/api/cron/events/status-update`), and reminders (`/api/cron/events/reminders`)
- Configure Redis for production multi-instance deployments
- Monitor security logs for suspicious activity
- Gather user feedback for future enhancements

## [0.9.0] - 2025-11-08

### Added

- CAPTCHA protection (Google reCAPTCHA v2) for login and registration forms to prevent automated abuse
- Account lockout mechanism to mitigate brute-force attacks (10 failed attempts, 1-hour lockout)
- CAPTCHA trigger after 3 failed login attempts (separate from account lockout threshold)
- CSP violation reporting endpoint (`/api/csp-report`) for monitoring security policy violations
- Contact modal in footer for direct communication with the Opera team
- ReCaptchaWrapper component for seamless CAPTCHA integration
- Comprehensive test suite for CAPTCHA verification (with and without API keys)
- Comprehensive test suite for account lockout functionality
- Email enumeration prevention tests for authentication endpoints
- Events API integration tests

### Changed

- Authentication endpoints now use generic error messages to prevent email enumeration attacks
- Login route enhanced with CAPTCHA verification and account lockout checks
- Registration route enhanced with mandatory CAPTCHA verification when enabled
- Improved type safety and edge case handling in account lockout tests
- Refactored comments for clarity and translated French comments to English across the codebase
- Enhanced Next.js configuration with support for CAPTCHA provider domains
- Updated validation schemas to support CAPTCHA token validation

### Removed

- Obsolete email enumeration test files (superseded by new comprehensive tests)
- Unused events API test files

### Security

- Implemented CAPTCHA to prevent automated credential stuffing and spam registrations
- Added account lockout to prevent brute-force password attacks
- Enhanced authentication security with generic error messages to prevent user enumeration
- CSP violation monitoring for detecting and addressing policy breaches

### Database Schema

- Added `failed_login_attempts`, `account_locked_until`, and `last_failed_login` fields to User model

## [0.8.0] - 2025-11-07

### Added

- Contact modal in footer for direct communication with the Opera team
- Footer component now includes a contact button for improved user engagement

### Changed

- Refactor comments for clarity and consistency across multiple files
- Translated French comments to English for better code accessibility
- Ensured uniformity in comment style and terminology throughout the codebase

### Deployment

- **Pre-production deployment active** - Platform is now deployed in pre-production environment
- Remaining work: Admin registration management page (`/app/events/[id]`)

## [0.7.0] - 2025-11-07

### Added

- Email templates for registration notifications (confirmation, rejection, cancellation)
- Event reminder email template with enhanced design
- New event notification email template
- UnifiedNotificationService for coordinated email and in-app notifications
- Cron endpoint for sending event reminders (`/api/cron/events/reminders`)
- Change password modal in account page with password requirements validation
- API endpoint for password changes (`/api/users/change-password`)
- Caretaker count fields to Event and Registration models
- Caretaker count input in user registration form with validation
- Caretaker information display on event detail pages
- Comprehensive test suite for email templates with 100% coverage requirement
- Tests for UnifiedNotificationService

### Changed

- Enhanced password reset email template with improved design and user experience
- Improved account page UI responsiveness and layout
- Enable 100% coverage requirement in Jest configuration
- User deletion endpoint now properly cascades to all related records
- Notifications now sent automatically for new events via scraper
- Notifications sent for registration status changes (confirmation, rejection, cancellation)

### Fixed

- Cascade delete for RegistrationDisability on user deletion
- User deletion now properly handles all related records (registrations, groups, notifications, etc.)

## [0.6.0] - 2025-11-07

### Added

- GET endpoint for individual event details
- Numeric input with increment/decrement controls in account page
- Numeric input controls documented in style guide
- Registration management with disabilities tracking
- Event registration management endpoints for admin and users
- User event registration form with institution and group selection
- Registrations management page with filtering and bulk operations
- Link to registrations list on account page
- API endpoint to fetch user details (`/api/users/me`)
- API endpoint to retrieve user groups
- Layout for registrations section in account area
- Style guide page for consistent UI components

### Changed

- Standardized button styles across the application with consistent destructive variants
- Added transitions to cancel buttons for improved UX
- Enhanced registration management UI with disability tracking features
- Improved event detail display and component structure
- Adjusted grid layout for registration items in RegistrationsClient
- Loaded initial institution selections in InstitutionSelector

### Fixed

- CSRF token handling to prevent race conditions
- HTML entity decoding for &#038; in eventsScraper

## [0.5.0] - 2025-11-06

### Added

- Tests for handling 403 responses with CSRF token invalidation and retries
- Password requirements component integrated into registration and password reset forms
- Password visibility toggle for login, registration, and password reset forms
- CI skip check for merges from dev to main to optimize workflow

### Changed

- Force dynamic rendering for admin and events pages
- Refactor authentication middleware: replace `publicRoute` with `createAuthMiddleware`
- Refactor password reset and resend verification routes with improved error handling
- Update Prisma dependency to version 6.19.0
- Enhanced error logging: replaced `console.error` with `logger.error` and sanitized log arguments

### Removed

- Unused `clientIdentifier` module eliminated to streamline codebase

### Fixed

- CSRF token cache cleared on token refresh to ensure regeneration with new user.id identifier
- Enhanced mobile menu behavior with smooth closing animation on scroll

## [0.4.0] - 2025-10-31

### Added

- SendGrid email service integration replacing Nodemailer
- Email transporter connection pooling and retry logic
- Dynamic institution loading based on search query
- Node modules caching in CI workflow

### Changed

- Refactor email service to use SendGrid API
- Adjust rate limit configurations for search endpoints
- Email transporter configuration updated (port 465 with TLS)
- Enhanced email service tests with transporter management functions

### Security

- Refactor secrets validation to enforce SendGrid API key validation
- Remove SMTP-related environment variables

## [0.3.0] - 2025-10-30

### Added

- Cron job authentication with secret token protection
- Postinstall script for automated database setup
- Jest polyfills for TextEncoder and crypto API

### Changed

- Refactor CI workflow: streamline Prisma engine caching
- Enhanced CI workflow with caching for node_modules, Prisma engines, and Next.js build
- Improved CI workflow with `run_migrations` input and Prisma steps optimization

### Fixed

- JWT refresh secret handling in tests
- Refresh token manager properly using `JWT_REFRESH_SECRET`

### Security

- Read JWT secrets directly from environment variables
- Implement CORS middleware for request/response handling

## [0.2.0] - 2025-10-24

### Added

- Advanced security features: CSRF protection, rate limiting, password history
- Security logging system with `SecurityLog` table
- Log sanitization to redact sensitive data
- Toast notification system with error handling improvements
- Event detail page with refactored component architecture
- Excel export functionality with filters for users, events, registrations, and institutions
- Style guide page with color palette and UI components

### Changed

- Update dependencies to latest versions (Next.js, React, ESLint)
- Improve page structure and semantics for legal notices
- Simplify navbar and sidebar mobile menu handling
- Refactor admin routes to use `requireAdmin` middleware
- Enhanced event filtering options with location display

### Fixed

- Email verification issues
- Various linting issues and code clarity improvements
- Use Next.js `notFound()` for 404 handling in admin detail pages

### Security

- Implement refresh token rotation with token blacklist
- Add CSRF token validation on state-changing endpoints
- Distributed rate limiting with Redis backing

## [0.1.0] - 2025-10-23

### Added

- Admin statistics page with detailed analytics
- Admin dashboard with pagination support
- Registration status tracking (PENDING, CONFIRMED, REJECTED, ATTENDED, NO_SHOW, CANCELLED)
- Date range filtering for admin statistics
- Pagination for upcoming events API
- `GroupDisability` table for accessibility support
- Footer component with social media links
- Data protection information link in registration form

### Changed

- Refactor Footer component for improved layout and consistency
- Expand admin test suite with additional statistics functions
- Update RegistrationStatus enum in Prisma schema
- Refactor Navbar and Sidebar link colors

### Fixed

- Corrected Prisma mock object in admin tests
- Fixed API endpoint calls in AdminDashboardClient
- Variable name inconsistencies in rebase-all-branches script

## [0.0.8] - 2025-08-29

### Added

- Swagger UI integration and API documentation
- Event scraping from Opera WordPress API
- Database-backed events system
- Remote image pattern support for opera-orchestre domain

### Changed

- Replace scraping endpoints with DB-backed events
- Improve Home page semantics and simplify button styles
- Adjust sidebar width from one-quarter to one-fifth
- Reorganize cron event endpoints in Swagger documentation

### Removed

- Cron import route removed in favor of direct scraping

## [0.0.7] - 2025-08-29

### Added

- Dynamic school year computation when scraping events
- Loading state and skeleton placeholders for Navbar and Sidebar
- Contextual CTA on home page based on authentication state
- Loader component standardization

### Changed

- Upgrade Prisma packages and add Swagger tooling
- Standardize Loader usage across auth and route components
- Valid route filtering in Navbar

### Fixed

- Normalize newline at end of README

## [0.0.6] - 2025-08-19

### Changed

- Refactor authentication system to align with Next.js 15
- Align role hierarchy with Prisma schema
- Update Prisma configuration for better type safety

## [0.0.5] - 2025-08-01

### Added

- Event import and scraping functionality
- Improved error handling for event data extraction

### Changed

- Refactor Prisma schema: consolidate enums and enhance relationships
- Update seed data to reflect new event types and institution structure

## [0.0.4] - 2025-07-27

### Added

- Institution Selector component with search and creation capabilities
- Form validation for authentication and institution management

### Changed

- Refactor form components for better reusability

## [0.0.3] - 2025-07-25

### Added

- User authentication routes (login, logout, refresh, register)
- JWT token support with access and refresh tokens
- Protected route system

## [0.0.2] - 2025-07-17

### Added

- Hero page with call-to-action
- Navbar component with navigation
- Sidebar component with categorized navigation
- Link hover effects with transitions

### Changed

- Enhanced component styling and layout

## [0.0.1] - 2025-07-15

### Added

- Initial Next.js project setup
- Prisma ORM integration
- Dark mode implementation
- Basic project structure and configuration

### Removed

- Unused assets and package-lock.json

---

**Note**: Version 1.0.0 marks project completion. All core features are implemented, tested, and documented. The platform is production-ready and pending final deployment to production environment.
