# Documentation Technique - Plateforme d'Inscription de l'Opéra de Montpellier

> **Version 1.7.0** | Dernière mise à jour : 30 juin 2026

## Table des Matières

1. [Vue d'Ensemble](#1-vue-densemble)
2. [Stack Technique](#2-stack-technique)
3. [Architecture du Projet](#3-architecture-du-projet)
4. [Base de Données](#4-base-de-données)
5. [API REST](#5-api-rest)
6. [Système d'Authentification](#6-système-dauthentification)
7. [Sécurité](#7-sécurité)
8. [Système de Notifications](#8-système-de-notifications)
9. [Scraping des Événements](#9-scraping-des-événements)
10. [Système de Scoring](#10-système-de-scoring)
11. [Export de Données](#11-export-de-données)
12. [Tests](#12-tests)
13. [CI/CD](#13-cicd)
14. [Déploiement](#14-déploiement)
15. [Maintenance](#15-maintenance)

---

## 1. Vue d'Ensemble

### 1.1 Objectif du Projet

La Plateforme d'Inscription de l'Opéra de Montpellier est une application web full-stack permettant aux établissements scolaires et associations culturelles de s'inscrire aux événements de l'Opéra Orchestre National Montpellier Occitanie.

Elle remplace un système basé sur Google Forms + Excel par une plateforme centralisée avec :

- **Portail Utilisateur** : Inscription aux événements, gestion de compte, suivi des inscriptions
- **Portail Administrateur** : Gestion des événements, validation des inscriptions, statistiques, exports

### 1.2 Fonctionnalités Principales

| Fonctionnalité                   | Description                                                       |
| -------------------------------- | ----------------------------------------------------------------- |
| **Authentification JWT**         | Access tokens (15min) + Refresh tokens (7 jours) avec rotation    |
| **Gestion Multi-Établissements** | Un utilisateur peut appartenir à plusieurs institutions           |
| **Scraping Automatique**         | Synchronisation des événements depuis l'API WordPress de l'Opéra  |
| **Protection des Champs**        | Système de protection des champs événements contre le scraping    |
| **Blocs Pédagogiques**           | Formations/ateliers liés aux événements, avec dates et obligation |
| **Notifications Préparation**    | Emails automatiques au staff Opéra pour demandes de préparation   |
| **Sélecteur d'Institutions**     | Affichage des établissements attachés à l'utilisateur             |
| **Style Guide Interactif**       | Guide de style avec composants interactifs (slider, dropdown)     |
| **Scoring Automatique**          | Algorithme de tri des inscriptions configurable par événement     |
| **Recherche Fuzzy**              | Algorithme Levenshtein pour la recherche d'institutions           |
| **Export Excel**                 | Export avancé (filtres, anonymisation, sélection de feuilles)     |
| **Notifications**                | Système d'emails (SMTP2GO) + notifications in-app                 |
| **Sécurité Avancée**             | CSRF, Rate Limiting, Account Lockout, CSP                         |

---

## 2. Stack Technique

### 2.1 Technologies Principales

| Catégorie           | Technologie            | Version      |
| ------------------- | ---------------------- | ------------ |
| **Framework**       | Next.js (App Router)   | 16.0.7       |
| **Frontend**        | React + TypeScript     | 19.2.0 / 5.x |
| **Styling**         | Tailwind CSS           | 4.x          |
| **ORM**             | Prisma                 | 7.8.0        |
| **Base de Données** | PostgreSQL             | 14+          |
| **Cache Distribué** | Redis (ioredis)        | 5.8.2        |
| **Validation**      | Zod                    | 4.1.12       |
| **Tests**           | Jest + Testing Library | 30.x         |
| **Bundler**         | Turbopack              | Intégré      |

### 2.2 Dépendances Clés

```text
Production:
├── @prisma/client         # Client ORM typé
├── ioredis                 # Client Redis haute performance
├── jsonwebtoken            # Gestion JWT
├── bcrypt                  # Hashage des mots de passe
├── exceljs                 # Génération de fichiers Excel
├── cheerio                 # Parsing HTML pour le scraping
├── xss                     # Sanitization XSS
├── nodemailer              # Envoi d'emails (backup)
└── zod                     # Validation de schémas

Développement:
├── jest                    # Framework de tests
├── ts-jest                 # Préprocesseur TypeScript
├── @testing-library/react  # Tests de composants
├── eslint                  # Linting
└── prettier                # Formatage du code
```

### 2.3 Polices

- **Poppins** (sans-serif) : Police principale (400, 700)
- **IBM Plex Serif** (serif) : Police secondaire (400, 700)

Chargées via `next/font/google` avec optimisation automatique.

---

## 3. Architecture du Projet

### 3.1 Structure des Répertoires

```text
Service-culturel-plateforme-web/
├── app/                          # Next.js App Router
│   ├── api/                      # Routes API REST
│   │   ├── admin/                # Endpoints d'administration
│   │   │   ├── events/           # CRUD événements admin
│   │   │   ├── export/           # Export Excel
│   │   │   ├── scoring-config/   # Configuration du scoring
│   │   │   ├── stats/            # Statistiques détaillées
│   │   │   └── upcoming-events/  # Événements à venir
│   │   ├── auth/                 # Authentification
│   │   │   ├── csrf/             # Tokens CSRF
│   │   │   ├── login/            # Connexion
│   │   │   ├── logout/           # Déconnexion
│   │   │   ├── refresh/          # Rafraîchissement JWT
│   │   │   ├── register/         # Inscription
│   │   │   ├── reset-password/   # Réinitialisation MDP
│   │   │   ├── resend-verification/ # Renvoi email vérif
│   │   │   └── verify-email/     # Vérification email
│   │   ├── groups/               # Gestion des groupes
│   │   ├── cron/                 # Tâches planifiées
│   │   │   └── events/           # Scraping & rappels
│   │   ├── csp-report/           # Rapport violations CSP
│   │   ├── events/               # Événements publics
│   │   ├── institutions/         # Gestion institutions
│   │   ├── notifications/        # Notifications utilisateur
│   │   ├── registrations/        # Inscriptions
│   │   ├── users/                # Gestion utilisateurs
│   │   └── middleware.ts         # Middleware API centralisé
│   ├── generated/                # Client Prisma généré
│   │   └── prisma/               # Types et client DB
│   ├── account/                  # Pages compte utilisateur
│   ├── admin/                    # Pages administration
│   ├── auth/                     # Pages authentification
│   ├── events/                   # Pages événements
│   └── legal-notices/            # Mentions légales
│
├── components/                   # Composants React
│   ├── admin/                    # Composants admin (7)
│   ├── auth/                     # Composants auth (5)
│   ├── links/                    # Navigation (3)
│   ├── misc/                     # Composants métier (20)
│   ├── routes/                   # Guards de routes (2)
│   └── ui/                       # Composants UI (6)
│
├── context/                      # Contextes React
│   ├── NotificationContext.tsx   # État notifications
│   └── UserContext.tsx           # État utilisateur global
│
├── hooks/                        # Hooks personnalisés
│   ├── useAuth.ts                # Authentification
│   ├── useImagesLoaded.ts        # Chargement images
│   ├── useLogout.ts              # Déconnexion
│   ├── useNotifications.ts       # Gestion notifications
│   └── useSecureForm.ts          # Formulaires sécurisés
│
├── lib/                          # Logique métier
│   ├── __tests__/                # Tests unitaires (36)
│   ├── cron/                     # Scraper & tâches cron
│   │   ├── eventsScraper.ts      # Scraping WordPress
│   │   └── scraperMappings.ts    # Mappings types/publics
│   ├── scoring/                  # Moteur de scoring
│   │   ├── scoringEngine.ts      # Calcul des scores
│   │   └── criteriaDefinitions.ts # Critères configurables
│   ├── accountLockout.ts         # Verrouillage compte
│   ├── admin.ts                  # Fonctions admin
│   ├── cookieConfig.ts           # Configuration cookies
│   ├── cronAuth.ts               # Auth endpoints cron
│   ├── csrfProtection.ts         # Protection CSRF
│   ├── emailService.ts           # Envoi d'emails SMTP2GO
│   ├── events/                   # Helpers événements (URL, blocs pédagogiques)
│   ├── excelExportService.ts     # Export Excel
│   ├── fetchWithAuth.ts          # Fetch avec auth auto
│   ├── frenchValidation.ts       # Validation caractères FR
│   ├── fuzzySearch.ts            # Recherche Levenshtein
│   ├── geographicZone.ts         # Zones géographiques
│   ├── institutionDuplicateDetection.ts # Détection doublons
│   ├── institutionSearch.ts      # Recherche institutions
│   ├── logSanitization.ts        # Anonymisation logs
│   ├── logger.ts                 # Logger applicatif
│   ├── notificationService.ts    # Service notifications
│   ├── passwordHistory.ts        # Historique MDP
│   ├── prismaConfig.ts           # Configuration Prisma
│   ├── redisConfig.ts            # Configuration Redis
│   ├── refreshTokenManager.ts    # Gestion refresh tokens
│   ├── registrationAnalytics.ts  # Analytics inscriptions
│   ├── securityLogger.ts         # Logs de sécurité
│   ├── securityUtils.ts          # Utilitaires sécurité
│   ├── serverRateLimit.ts        # Rate limiting
│   ├── tokenStore.ts             # Stockage tokens
│   ├── unifiedNotificationService.ts # Service unifié notifs
│   ├── validateSecrets.ts        # Validation secrets
│   └── validationSchemas.ts      # Schémas Zod
│
├── prisma/                       # Configuration base de données
│   ├── schema.prisma             # Schéma de données
│   └── seed.ts                   # Script de seed
│
├── public/                       # Assets statiques
│   └── swagger.json              # Documentation API Swagger
│
├── scripts/                      # Scripts utilitaires
│   └── rebase-all-branches.sh    # Script de rebase
│
├── types/                        # Types TypeScript globaux
│   ├── event.ts                  # Types événements
│   ├── registration.ts           # Types inscriptions
│   └── user.ts                   # Types utilisateurs
│
├── __mocks__/                    # Mocks Jest
├── __tests__/                    # Tests d'intégration
│
├── .env.example                  # Template variables d'env
├── jest.config.ts                # Configuration Jest
├── next.config.ts                # Configuration Next.js
├── proxy.ts                      # Middleware CSP
├── tailwind.config.ts            # Configuration Tailwind
└── tsconfig.json                 # Configuration TypeScript
```

### 3.2 Patterns Architecturaux

#### Server Components vs Client Components

```typescript
// Server Component (défaut) - Accès direct à la DB
// app/events/page.tsx
import { getEvents } from '@/lib/events/events';

export default async function EventsPage() {
  const events = await getEvents();
  return <ClientEvents events={events} />;
}

// Client Component - Interactivité
// components/events/ClientEvents.tsx
'use client';

export function ClientEvents({ events }) {
  // Filtres, tri et modale de dates côté client.
}
```

La page publique `/events` garde le chargement des données côté serveur (`getEvents()`), puis délègue uniquement les interactions au client. La requête Prisma de liste utilise `select` pour limiter le payload aux champs affichés, exclut les événements `ARCHIVED` par défaut et s'appuie sur l'index `Event.status`.

Optimisations de rendu de la liste :

- Aucun préchargement global des images : la page s'affiche immédiatement.
- Les premières images visibles des événements à venir sont priorisées avec `next/image`.
- Les événements sans `image_url` utilisent une image de secours de l'Opéra, puis l'image locale `assets/hero.jpg` si la ressource distante échoue.
- La vue calendrier est chargée dynamiquement seulement quand elle est demandée.
- Les descriptions enrichies sont converties en texte côté serveur pour les cartes de liste.

#### Pattern Middleware API

```typescript
// Toutes les routes API utilisent des wrappers middleware
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';

export const GET = async (req: NextRequest) => {
  return await requireAdmin(req, async (authReq: AuthenticatedRequest) => {
    const { user } = authReq; // { id, email, role, institution_ids }
    // Logique métier...
  });
};
```

---

## 4. Base de Données

### 4.1 Configuration Prisma

Le client Prisma (v7, sans moteur Rust) est généré dans `app/generated/prisma` (et non `node_modules/@prisma/client`). La connexion à PostgreSQL se fait en TCP direct via l'adaptateur `@prisma/adapter-pg` (configuré dans `lib/middleware/prismaConfig.ts`).

```typescript
// Énumérations — sans runtime, sûres côté navigateur :
import { Role, RegistrationStatus } from '@/app/generated/prisma/enums';

// Types de modèles + namespace Prisma — serveur uniquement :
import type { User, Event } from '@/app/generated/prisma/client';
import { Prisma } from '@/app/generated/prisma/client';

// Instance du client — singleton partagé :
import prisma from '@/lib/middleware/prismaConfig';
```

> ⚠️ Importer les énumérations depuis `/enums`, jamais `/client` : `client.ts` embarque le runtime Prisma (`node:module`), et le tirer dans un composant client casse le bundling Turbopack.

### 4.2 Modèles de Données

#### Diagramme Entité-Relation

```schema
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│    User     │──────<│ UserInstitution  │>──────│ Institution │
├─────────────┤       └──────────────────┘       ├─────────────┤
│ id          │                                   │ id          │
│ email       │       ┌──────────────────┐       │ name        │
│ password    │──────<│   Registration   │>──────│ address_id  │
│ first_name  │       ├──────────────────┤       │ type[]      │
│ last_name   │       │ id               │       │ grades[]    │
│ role        │       │ user_id          │       └──────┬──────┘
│ ...         │       │ institution_id   │              │
└──────┬──────┘       │ event_id         │       ┌──────┴──────┐
       │              │ status           │       │   Address   │
       │              │ booked_seats     │       ├─────────────┤
┌──────┴──────┐       │ ...              │       │ street      │
│    Group    │       └────────┬─────────┘       │ zip_code    │
├─────────────┤                │                 │ city        │
│ grades[]    │         ┌──────┴──────┐          └─────────────┘
│ students    │         │    Event    │
└─────────────┘         ├─────────────┤
                        │ title       │
                        │ type[]      │
                        │ age_ranges[]│
                        │ event_dates[]│
                        │ total_seats │
                        │ status      │
                        └──────┬──────┘
                               │
                  ┌────────────┴────────────┐
                  │ EventRegistrationBlock  │
                  ├─────────────────────────┤
                  │ title                   │
                  │ description             │
                  │ dates[]                 │
                  │ registration_enabled    │
                  │ mandatory               │
                  └────────────┬────────────┘
                               │
                  ┌────────────┴────────────┐
                  │ RegistrationBlockSelection
                  ├─────────────────────────┤
                  │ wants_to_attend         │
                  │ selected_date           │
                  └─────────────────────────┘
```

#### Modèles Principaux

| Modèle                         | Description                                     | Relations                                                                       |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| **User**                       | Utilisateur (enseignant, admin)                 | Groups, Notifications, Registrations, UserInstitution                           |
| **Institution**                | Établissement scolaire/association              | Address, UserInstitution, Registrations                                         |
| **Event**                      | Événement culturel                              | Registrations, EventAccessibility, EventRegistrationBlock, ScoringConfiguration |
| **EventRegistrationBlock**     | Bloc pédagogique lié à un événement             | Event, RegistrationBlockSelection                                               |
| **Registration**               | Inscription à un événement                      | User, Institution, Event, RegistrationDisability, RegistrationBlockSelection    |
| **RegistrationBlockSelection** | Réponse d'une inscription à un bloc pédagogique | Registration, EventRegistrationBlock                                            |
| **Group**                      | Groupe d'un utilisateur                         | User, GroupDisability                                                           |
| **Notification**               | Notification in-app                             | User                                                                            |
| **ScoringConfiguration**       | Config du scoring par événement                 | Event, ScoringCriterion                                                         |

#### Tables de Sécurité

| Table                     | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| **SecurityLog**           | Journal des événements de sécurité                                   |
| **RefreshTokenBlacklist** | Tokens invalidés (logout)                                            |
| **PasswordResetToken**    | Tokens de réinitialisation MDP                                       |
| **PasswordHistory**       | Historique des 5 derniers MDP                                        |
| **AppConfig**             | Configuration dynamique de l'appli (labels personnalisables par clé) |

#### Blocs pédagogiques d'événement

Les blocs pédagogiques permettent à l'admin d'ajouter plusieurs contenus autour d'un événement :
formations, ateliers, rencontres ou autres activités. Chaque bloc porte son propre titre, texte
explicatif, liste de dates, option d'inscription et indicateur obligatoire.

- `EventRegistrationBlock` stocke les blocs configurés sur un événement.
- `RegistrationBlockSelection` stocke la réponse d'une inscription à un bloc, avec la date choisie.
- Les champs historiques `Event.has_initial_formation`, `Event.is_formation_mandatory` et
  `Registration.want_formation` restent en base pour compatibilité et exports.
- Un événement ancien avec `has_initial_formation = true` mais sans bloc réel est exposé via un
  bloc synthétique "Formation initiale" par `lib/events/registrationBlocks.ts`.
- Le serveur refuse une inscription si un bloc obligatoire n'est pas sélectionné ou si la date
  choisie ne fait pas partie des dates du bloc.

### 4.3 Configuration Dynamique avec Cache Distribué

**Fichier** : `lib/config/configService.ts`

Le système de configuration dynamique permet aux administrateurs de personnaliser les labels affichés dans l'application via la base de données, avec un système de cache distribué utilisant Redis :

#### Architecture du Cache

```schema
┌─────────────────────────────────────────────────────────────┐
│                    Configuration Service                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Redis Cache (Primaire)                                   │
│     - TTL: 5 minutes (300 secondes)                         │
│     - Prefix: app_config:                                   │
│     - Invalidation immédiate multi-instances                │
│                                                              │
│  2. In-Memory Cache (Fallback)                              │
│     - TTL: 5 minutes (300000 ms)                            │
│     - Map<ConfigCategory, CacheEntry>                       │
│     - Utilisé uniquement si Redis indisponible              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Fonctionnalités Redis

- **Cache Primaire** : Redis est utilisé comme première couche de cache
- **Invalidation Distribuée** : Les mises à jour invalident immédiatement le cache sur toutes les instances
- **Fallback Graceful** : Bascule automatiquement sur le cache mémoire si Redis est indisponible
- **TTL de 5 minutes** : Les entrées expirent après 5 minutes pour garantir la fraîcheur des données

| Catégorie                    | Description                      |
| ---------------------------- | -------------------------------- |
| `accessibility_labels`       | Labels des types d'accessibilité |
| `event_type_labels`          | Labels des types d'événements    |
| `public_type_labels`         | Labels des types de public       |
| `registration_status_labels` | Labels des statuts d'inscription |
| `event_status_labels`        | Labels des statuts d'événements  |

**Fonctionnalités** :

- **Cache Redis distribué** avec TTL de 5 minutes (primaire)
- **Cache mémoire** avec TTL de 5 minutes (fallback)
- **Invalidation immédiate** du cache lors des mises à jour
- **Valeurs par défaut** dans `lib/config/labelDefaults.ts` (client-safe)
- **CRUD via** `/api/admin/config`
- **Fallback aux valeurs par défaut** si la base est vide
- **100% de couverture de tests** (statements, branches, functions, lines)

```typescript
// Exemple d'utilisation
import { getConfig, setConfigValues, clearConfigCache } from '@/lib/config/configService';

// Récupérer la configuration
const labels = await getConfig('accessibility_labels');

// Mettre à jour des labels
await setConfigValues('accessibility_labels', {
  VISUAL: 'Handicap visuel',
  AUDITORY: 'Handicap auditif',
});

// Réinitialiser aux valeurs par défaut
await resetConfigToDefaults('accessibility_labels');

// Invalider le cache (async - affecte Redis et mémoire)
await clearConfigCache('accessibility_labels');
await clearConfigCache(); // Tous les caches
```

### 4.3.1 Système de Labels Dynamiques (v1.4.2+)

**Fichier** : `lib/config/labelMappings.ts`

**Nouveauté v1.4.3** : Tous les composants utilisent maintenant les labels dynamiques. Plus aucun label français n'est hardcodé dans le code client. Tous les labels (accessibilité, types d'événements, types de public, statuts) proviennent soit de la configuration personnalisée (base de données), soit des valeurs par défaut.

Le système de labels fournit deux API pour récupérer les traductions françaises des valeurs enum :

#### Fonctions Statiques (Client Components)

Fonctions synchrones utilisant uniquement les valeurs par défaut :

```typescript
import {
  getEventTypeLabel,
  getPublicCategoryLabel,
  getSchoolGradeLabel,
  getAgeRangeLabel,
  getRegistrationStatusLabel,
  getAccessibilityLabel,
  // Deprecated functions (still available for backward compatibility):
  // getPublicTypeLabel, getPublicTypeLabels
} from '@/lib/config/labelMappings';

// Usage dans les composants clients
const label = getEventTypeLabel('OPERA'); // Returns: "Opéra"
const categoryLabel = getPublicCategoryLabel('COLLEGE'); // Returns: "Collège"
const gradeLabel = getSchoolGradeLabel('SIXIEME'); // Returns: "6ème"
const ageRangeLabel = getAgeRangeLabel('AGE_11_15'); // Returns: "11-15 ans"
```

#### Fonctions Asynchrones (Server Components)

Fonctions asynchrones qui récupèrent les labels personnalisés depuis la base de données :

```typescript
import {
  getEventTypeLabelAsync,
  getPublicCategoryLabelAsync,
  getSchoolGradeLabelsMapAsync,
  getAgeRangeLabelsMapAsync,
  getRegistrationStatusLabelAsync,
  getAccessibilityLabelAsync,
  // Deprecated async functions (still available for backward compatibility):
  // getPublicTypeLabelAsync
} from '@/lib/config/labelMappingsServer';

// Usage dans les composants serveur
const label = await getEventTypeLabelAsync('OPERA'); // Returns custom label or "Opéra"
const categoryLabel = await getPublicCategoryLabelAsync('COLLEGE'); // Returns "Collège"
const schoolGradeLabels = await getSchoolGradeLabelsMapAsync();
const ageRangeLabels = await getAgeRangeLabelsMapAsync();
```

**Fonctionnalités** :

- Import dynamique de `configService` pour éviter les dépendances Prisma côté client
- Fallback automatique aux valeurs par défaut en cas d'erreur
- Cache intégré via `configService` (TTL de 5 minutes)
- Compatible avec les composants serveur et client

**Pattern Recommandé** :

```typescript
// Server Component (app/admin/page.tsx)
import { getEventTypeLabelAsync } from '@/lib/config/labelMappings';

export default async function AdminPage() {
  const label = await getEventTypeLabelAsync('OPERA');
  return <AdminEventsClient eventTypeLabels={await getEventTypeLabelsMapAsync()} />;
}

// Client Component (components/admin/AdminEventsClient.tsx)
import { getEventTypeLabel } from '@/lib/config/labelMappings';

export function AdminEventsClient({ eventTypeLabels }) {
  const label = eventTypeLabels?.['OPERA'] || getEventTypeLabel('OPERA');
  return <span>{label}</span>;
}
```

### 4.4 Enums

```typescript
// Rôles utilisateur
enum Role {
  USER,
  ADMIN,
  SUPERADMIN,
}

// Types de public - Catégories (types d'établissement)
enum PublicCategory {
  CRECHE,
  MATERNELLE,
  ELEMENTAIRE,
  COLLEGE,
  LYCEE,
  SUPERIEUR,
  ASSOCIATION,
  CONSERVATOIRE,
  PERISCOLAIRE,
  PUBLICS_EMPECHES,
  AUTRE,
}

// Niveaux scolaires
enum SchoolGrade {
  PS,
  MS,
  GS,
  CP,
  CE1,
  CE2,
  CM1,
  CM2,
  SIXIEME,
  CINQUIEME,
  QUATRIEME,
  TROISIEME,
  SECONDE,
  PREMIERE,
  TERMINALE,
}

// Tranches d'âge
enum AgeRange {
  AGE_0_3,
  AGE_3_6,
  AGE_6_11,
  AGE_11_15,
  AGE_15_18,
  AGE_18_PLUS,
}

// Types d'événements (24 types)
enum EventType {
  OPERA,
  CONCERT_LYRIQUE,
  SYMPHONIQUE,
  CHAMBRE_BAROQUE,
  EN_FAMILLE,
  OPERA_JUNIOR,
  CINE_CONCERT,
  INSOLITE,
  THEATRE_MUSICAL,
  DANSE,
  CONTE_MUSICAL,
  CONCERT_DECENTRALISE,
  ELECTRO_ACOUSTIQUE,
  MUSIQUE_ELECTRONIQUE,
  CONCERT_LECTURE,
  PLEIN_AIR,
  JAZZ,
  LITTERATURE,
  MASTERCLASS,
  MUSIQUE_ET_BIEN_ETRE,
  MUSIQUE_ACTUELLE,
  PARTICIPATIF,
  PROMENADE_SONORE,
  ATELIER,
  GALA,
  EXPOSITION,
  PORTES_OUVERTES,
  INTERDISCIPLINAIRE,
  SPECTACLE_EDUCATIF,
  CARITATIF,
  THEATRE,
  RENDEZ_VOUS,
  MUSIQUES_DAILLEURS,
  BAROQUE,
}

// Statuts d'inscription
enum RegistrationStatus {
  PENDING, // En attente de validation
  CONFIRMED, // Confirmée
  CANCELLED, // Annulée
  REJECTED, // Refusée
  ATTENDED, // Présent à l'événement
  NO_SHOW, // Absent malgré confirmation
}

// Types de handicap
enum Accessibility {
  VISUAL,
  AUDITORY,
  MOTOR,
  PSYCHIC,
  NEUROATYPICAL,
  OTHER,
}

// Types de logs de sécurité
enum SecurityLogType {
  LOGIN_SUCCESS,
  LOGIN_FAILED,
  LOGOUT,
  REGISTER,
  PASSWORD_CHANGE,
  PASSWORD_RESET_REQUEST,
  PASSWORD_RESET_SUCCESS,
  EMAIL_VERIFICATION,
  ADMIN_ACCESS,
  DATA_MODIFIED,
  SUSPICIOUS_ACTIVITY,
  RATE_LIMIT_EXCEEDED,
  UNAUTHORIZED_ACCESS,
  CSRF_TOKEN_INVALID,
  CORS_VIOLATION,
  TOKEN_REFRESH,
  TOKEN_EXPIRED,
  ACCOUNT_LOCKED,
}
```

### 4.4 Commandes de Gestion

```bash
# Créer une nouvelle migration
npx prisma migrate dev --name <nom_migration>

# Appliquer les migrations en production
npx prisma migrate deploy

# Introspecter le schéma de base vers Prisma
npx prisma db pull

# Pusher les changements de schéma vers la base de données (dev/staging)
npx prisma db push

# Générer le client Prisma
npx prisma generate

# Ouvrir l'interface graphique
npx prisma studio

# Réinitialiser la base (DEV uniquement)
npx prisma migrate reset

# Seed des données de test
npx prisma db seed
```

---

## 5. API REST

### 5.1 Conventions

| Aspect         | Convention                                      |
| -------------- | ----------------------------------------------- |
| **Format**     | JSON                                            |
| **Auth**       | Bearer token (JWT) dans header `Authorization`  |
| **CSRF**       | Token requis pour POST/PUT/PATCH/DELETE         |
| **Erreurs**    | `{ error: string, details?: object }`           |
| **Pagination** | `?page=1&limit=20`                              |
| **Filtrage**   | Query params (ex: `?status=PENDING&type=OPERA`) |

### 5.2 Endpoints d'Authentification

| Méthode | Endpoint                           | Description             | Auth      |
| ------- | ---------------------------------- | ----------------------- | --------- |
| POST    | `/api/auth/register`               | Inscription utilisateur | ❌        |
| POST    | `/api/auth/login`                  | Connexion               | ❌        |
| POST    | `/api/auth/logout`                 | Déconnexion             | ✅        |
| POST    | `/api/auth/refresh`                | Rafraîchir tokens       | Cookie    |
| GET     | `/api/auth/csrf`                   | Obtenir token CSRF      | ❌        |
| GET     | `/api/auth/verify-email`           | Vérifier email          | Token URL |
| POST    | `/api/auth/resend-verification`    | Renvoyer email verif    | ❌        |
| POST    | `/api/auth/reset-password`         | Demander reset MDP      | ❌        |
| POST    | `/api/auth/reset-password/confirm` | Confirmer reset MDP     | Token     |

### 5.3 Endpoints Utilisateurs

| Méthode | Endpoint                     | Description               | Auth |
| ------- | ---------------------------- | ------------------------- | ---- |
| GET     | `/api/users/me`              | Infos utilisateur courant | ✅   |
| PUT     | `/api/users/me`              | Modifier profil           | ✅   |
| POST    | `/api/users/change-password` | Changer mot de passe      | ✅   |
| GET     | `/api/users/groups`          | Lister ses groupes        | ✅   |
| POST    | `/api/users/groups`          | Créer un groupe           | ✅   |
| GET     | `/api/users/registrations`   | Lister ses inscriptions   | ✅   |

### 5.4 Endpoints Événements

| Méthode | Endpoint                           | Description       | Auth |
| ------- | ---------------------------------- | ----------------- | ---- |
| GET     | `/api/events`                      | Lister événements | ✅   |
| GET     | `/api/events/[slug]`               | Détails événement | ✅   |
| POST    | `/api/events/[slug]/registrations` | S'inscrire        | ✅   |

`GET /api/events` utilise une projection Prisma explicite (`select`) pour renvoyer uniquement les champs nécessaires à la liste et aux sélecteurs d'export : identité, titre, slug, description, typologies, publics, niveaux, lieu, capacités, statut, image, dates, indicateurs de formation/préparation et accessibilité. Les relations non nécessaires, notamment les inscriptions, ne sont pas chargées.

`GET /api/events/[slug]` renvoie `registrationBlocks` pour la section "Autour du spectacle".
Les blocs legacy synthétiques ont un id préfixé par `legacy-` et servent uniquement à préserver
l'affichage des anciennes formations initiales.

`POST /api/events/[slug]/registrations` accepte `registration_block_selections` :

```json
[
  {
    "block_id": "block-id",
    "wants_to_attend": true,
    "selected_date": "2026-10-01T10:00:00.000Z"
  }
]
```

Le serveur valide les blocs obligatoires, les dates choisies et l'appartenance des blocs à
l'événement avant de créer l'inscription.

### 5.5 Endpoints Institutions

| Méthode | Endpoint                         | Description             | Auth |
| ------- | -------------------------------- | ----------------------- | ---- |
| GET     | `/api/institutions`              | Lister institutions     | ✅   |
| GET     | `/api/institutions/search`       | Recherche fuzzy         | ❌   |
| POST    | `/api/institutions`              | Créer institution       | ✅   |
| GET     | `/api/institutions/[id]`         | Détails institution     | ✅   |
| GET     | `/api/institutions/[id]/history` | Historique inscriptions | ✅   |

### 5.6 Endpoints Inscriptions

| Méthode | Endpoint                  | Description          | Auth |
| ------- | ------------------------- | -------------------- | ---- |
| GET     | `/api/registrations/[id]` | Détails inscription  | ✅   |
| PUT     | `/api/registrations/[id]` | Modifier inscription | ✅   |
| DELETE  | `/api/registrations/[id]` | Annuler inscription  | ✅   |

### 5.7 Endpoints Administration

| Méthode | Endpoint                                 | Description             | Auth  |
| ------- | ---------------------------------------- | ----------------------- | ----- |
| GET     | `/api/admin/stats`                       | Statistiques résumées   | Admin |
| GET     | `/api/admin/stats/detailed`              | Statistiques détaillées | Admin |
| POST    | `/api/admin/export`                      | Export Excel            | Admin |
| GET     | `/api/admin/events`                      | Lister événements       | Admin |
| POST    | `/api/admin/events`                      | Créer événement         | Admin |
| GET     | `/api/admin/events/[id]`                 | Détails événement       | Admin |
| PUT     | `/api/admin/events/[id]`                 | Modifier événement      | Admin |
| DELETE  | `/api/admin/events/[id]`                 | Supprimer événement     | Admin |
| GET     | `/api/admin/upcoming-events`             | Événements à venir      | Admin |
| GET     | `/api/admin/scoring-config`              | Config scoring          | Admin |
| POST    | `/api/admin/scoring-config`              | Créer config scoring    | Admin |
| PATCH   | `/api/admin/scoring-config/[id]`         | Modifier scoring        | Admin |
| POST    | `/api/admin/scoring-config/[id]/preview` | Prévisualiser scoring   | Admin |
| GET     | `/api/admin/backups`                     | Lister sauvegardes      | Admin |
| POST    | `/api/admin/backups`                     | Créer une sauvegarde    | Admin |
| POST    | `/api/admin/backups/compare`             | Comparer avec DB        | Admin |
| POST    | `/api/admin/backups/restore`             | Restaurer sauvegarde    | Admin |

Les payloads `POST /api/admin/events` et `PUT /api/admin/events/[id]` acceptent
`registrationBlocks`. Les blocs avec `id` sont mis à jour, les blocs sans `id` sont créés, et les
blocs retirés du formulaire admin sont supprimés.

### 5.8 Endpoints Cron

| Méthode | Endpoint                         | Description           | Auth        |
| ------- | -------------------------------- | --------------------- | ----------- |
| GET     | `/api/cron/events/scraping`      | Lancer le scraping    | CRON_SECRET |
| GET     | `/api/cron/events/reminders`     | Envoyer rappels       | CRON_SECRET |
| GET     | `/api/cron/events/status-update` | Mettre à jour statuts | CRON_SECRET |
| GET     | `/api/cron/backup`               | Créer une sauvegarde  | CRON_SECRET |

### 5.10 Autres Endpoints

| Méthode        | Endpoint                  | Description               | Auth |
| -------------- | ------------------------- | ------------------------- | ---- |
| GET            | `/api/notifications`      | Notifications utilisateur | ✅   |
| PUT            | `/api/notifications/[id]` | Marquer comme lu          | ✅   |
| POST           | `/api/csp-report`         | Rapport violation CSP     | ❌   |
| GET/PUT/DELETE | `/api/groups/[groupId]`   | Gestion groupes           | ✅   |

---

## 6. Système d'Authentification

### 6.1 Architecture JWT

```schema
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────>│  /api/auth  │────>│  PostgreSQL │
│  (Browser)  │<────│   /login    │<────│   (Users)   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   ▼
       │            ┌─────────────┐
       │            │    Redis    │
       │            │  (Tokens,   │
       │            │   CSRF)     │
       │            └─────────────┘
       │
       ▼
┌─────────────────────────────────┐
│       Cookies HTTP-only         │
│  ┌───────────┐  ┌────────────┐  │
│  │  Access   │  │  Refresh   │  │
│  │  Token    │  │   Token    │  │
│  │  (15min)  │  │  (7 jours) │  │
│  └───────────┘  └────────────┘  │
└─────────────────────────────────┘
```

### 6.2 Tokens

| Token                  | Durée   | Stockage         | Usage                        |
| ---------------------- | ------- | ---------------- | ---------------------------- |
| **Access Token**       | 15 min  | Cookie HTTP-only | Authentification API         |
| **Refresh Token**      | 7 jours | Cookie HTTP-only | Obtenir nouveau access token |
| **CSRF Token**         | 15 min  | Redis + Client   | Protection CSRF              |
| **Email Verification** | 24h     | DB               | Vérification email           |
| **Password Reset**     | 1h      | DB               | Réinitialisation MDP         |

### 6.3 Flux d'Authentification

```text
1. LOGIN
   Client → POST /api/auth/login { email, password }
   Server → Valide credentials, génère tokens
   Server → Set-Cookie: accessToken, refreshToken
   Server → { user, csrfToken }

2. API REQUEST
   Client → GET /api/users/me
   Headers: Cookie (auto), X-CSRF-Token
   Server → Valide accessToken + CSRF
   Server → { user data }

3. TOKEN REFRESH (automatique via fetchWithAuth)
   Quand accessToken expire (401):
   Client → POST /api/auth/refresh
   Server → Valide refreshToken, génère nouveaux tokens
   Server → Set-Cookie: nouveaux tokens
   Client → Retry requête originale

4. LOGOUT
   Client → POST /api/auth/logout
   Server → Ajoute refreshToken à blacklist
   Server → Clear-Cookie: accessToken, refreshToken
```

### 6.4 Hiérarchie des Rôles

```text
SUPERADMIN
    │
    ├── Toutes les permissions ADMIN
    ├── Gestion des administrateurs
    └── Configuration système

ADMIN
    │
    ├── Toutes les permissions USER
    ├── Gestion des événements (CRUD)
    ├── Validation des inscriptions
    ├── Statistiques et exports
    └── Gestion des institutions

USER
    │
    ├── Consultation des événements
    ├── Inscription aux événements
    ├── Gestion de son compte
    └── Suivi de ses inscriptions
```

### 6.5 Middleware d'Authentification

```typescript
// Disponibles dans app/api/middleware.ts

// Authentification requise
requireAuth(req, handler);

// Admin ou SuperAdmin requis
requireAdmin(req, handler);

// SuperAdmin uniquement
requireSuperAdmin(req, handler);

// Admin OU propriétaire de la ressource
requireAdminOrSameUser(req, handler, targetUserId);

// Route publique (avec rate limiting)
publicRoute(req, handler);

// Middleware personnalisé
createAuthMiddleware({
  requireAuth: boolean,
  requireAdmin: boolean,
  skipCsrf: boolean,
  rateLimitConfig: 'auth' | 'api' | 'search' | 'sensitive',
});
```

---

## 7. Sécurité

### 7.1 Protection CSRF

**Fichier** : `lib/auth/csrfProtection.ts`

- Tokens générés avec `crypto.randomBytes(32)`
- Expiration : 15 minutes
- Stockage : Redis (fallback mémoire)
- Lié à l'identifiant utilisateur ou IP+UserAgent

```typescript
// Génération (côté serveur)
const csrfToken = await generateCSRFToken(identifier);

// Validation (middleware)
const isValid = await validateCSRFToken(token, identifier);

// Client - Envoi automatique via fetchWithAuth
const response = await fetchWithAuth('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify(data),
});
```

### 7.2 Rate Limiting

**Fichier** : `lib/middleware/serverRateLimit.ts`

| Config      | Limite              | Fenêtre | Usage                  |
| ----------- | ------------------- | ------- | ---------------------- |
| `auth`      | 5 (prod) / 20 (dev) | 15 min  | Login, Register        |
| `api`       | 100                 | 1 min   | Endpoints généraux     |
| `search`    | 300                 | 1 min   | Recherche institutions |
| `sensitive` | 10                  | 1 min   | Suppression, Admin     |

```typescript
// Utilisation dans middleware
import { checkRateLimit, RateLimitConfigs } from '@/lib/serverRateLimit';

const result = await checkRateLimit(identifier, 'auth');
if (!result.allowed) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}
```

### 7.3 Verrouillage de Compte

**Fichier** : `lib/auth/accountLockout.ts`

| Paramètre             | Valeur                 |
| --------------------- | ---------------------- |
| Seuil de verrouillage | 10 tentatives échouées |
| Durée de verrouillage | 1 heure                |
| Reset automatique     | 15 min sans tentative  |

```typescript
// Vérification avant login
const lockoutStatus = await checkAccountLockout(userId);
if (lockoutStatus.locked) {
  return { error: 'Account locked', lockedUntil: lockoutStatus.until };
}

// Après échec de login
await recordFailedAttempt(userId);

// Après succès de login
await resetFailedAttempts(userId);
```

### 7.4 Content Security Policy (CSP)

**Fichier** : `proxy.ts`

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}' https://www.google.com https://www.gstatic.com;
  style-src 'self' 'nonce-{random}' https://fonts.googleapis.com;
  img-src 'self' data: https://www.opera-orchestre-montpellier.fr https://www.gstatic.com;
  font-src 'self' https://fonts.gstatic.com;
  frame-src https://www.google.com;
  connect-src 'self' https://www.google.com;
  upgrade-insecure-requests;
```

### 7.5 Historique des Mots de Passe

**Fichier** : `lib/auth/passwordHistory.ts`

- Stockage des 5 derniers hashs
- Empêche la réutilisation de mots de passe récents

```typescript
// Vérification avant changement
const isReused = await isPasswordInHistory(userId, newPassword);
if (isReused) {
  return { error: 'Password recently used' };
}

// Après changement réussi
await addPasswordToHistory(userId, hashedPassword);
```

### 7.6 Logs de Sécurité

**Fichier** : `lib/security/securityLogger.ts`

```typescript
await SecurityLogger.log({
  type: SecurityLogType.LOGIN_SUCCESS,
  userId: user.id,
  ipAddress: req.headers.get('x-forwarded-for'),
  userAgent: req.headers.get('user-agent'),
  endpoint: '/api/auth/login',
  method: 'POST',
  severity: SecuritySeverity.INFO,
  details: { browser: 'Chrome' },
});
```

### 7.7 Sanitization des Logs

**Fichier** : `lib/security/logSanitization.ts`

```typescript
import { sanitizeLogMessage, redactEmail } from '@/lib/logSanitization';

// Avant logging
logger.info('User logged in:', sanitizeLogMessage(userData));
// Output: "User logged in: { email: 'j***@example.com', ... }"

const safeEmail = redactEmail('john.doe@example.com');
// Output: "j***@example.com"
```

### 7.8 Validation des Secrets au Démarrage

**Fichier** : `lib/config/validateSecrets.ts`

Vérifie au démarrage que tous les secrets requis sont présents :

- `ACCESS_TOKEN_SECRET` (min 32 caractères)
- `REFRESH_TOKEN_SECRET` (min 32 caractères)
- `DATABASE_URL`
- `SMTP2GO_API_KEY` (production)

---

## 8. Système de Notifications

### 8.1 Architecture

```schema
┌─────────────────────────────────────────┐
│       UnifiedNotificationService        │
├─────────────────────────────────────────┤
│  createRegistrationNotification()       │
│  createEventReminder()                  │
│  createNewEventNotification()           │
└───────────────┬─────────────────────────┘
                │
      ┌─────────┴─────────┐
      ▼                   ▼
┌───────────────┐   ┌───────────────┐
│   In-App      │   │    Email      │
│ Notification  │   │   (SMTP2GO)   │
│   Service     │   │   Service     │
└───────────────┘   └───────────────┘
      │                   │
      ▼                   ▼
┌───────────────┐   ┌───────────────┐
│  PostgreSQL   │   │   SMTP2GO     │
│ (Notification)│   │     API       │
└───────────────┘   └───────────────┘
```

### 8.2 Types de Notifications

| Type                     | Description                 | Email | In-App |
| ------------------------ | --------------------------- | ----- | ------ |
| `REGISTRATION_CONFIRMED` | Inscription validée         | ✅    | ✅     |
| `REGISTRATION_CANCELLED` | Inscription annulée         | ✅    | ✅     |
| `REGISTRATION_REJECTED`  | Inscription refusée         | ✅    | ✅     |
| `EVENT_REMINDER`         | Rappel avant événement      | ✅    | ✅     |
| `NEW_EVENT`              | Nouvel événement disponible | ✅    | ✅     |
| `SYSTEM_UPDATE`          | Mise à jour système         | ❌    | ✅     |

### 8.3 Configuration Email (SMTP2GO)

**Fichier** : `lib/notifications/emailService.ts`

```typescript
// Variables d'environnement requises
SMTP2GO_API_KEY = 'api-YOUR_API_KEY';
SMTP_FROM_EMAIL = 'noreply@example.com';
SMTP_FROM_NAME = "Plateforme de l'Opéra";
```

**Fonctionnalités** :

- Templates côté serveur (gérés dans SMTP2GO)
- Retry automatique (3 tentatives, backoff exponentiel)
- Support de headers personnalisés
- Substitution de données dans les templates

```typescript
await sendTemplateEmail({
  to: user.email,
  templateId: 'registration_confirmed',
  templateData: {
    firstName: user.first_name,
    eventTitle: event.title,
    eventDate: formatDate(event.event_dates[0]),
  },
});
```

### 8.4 Préférences Utilisateur

Les utilisateurs peuvent configurer leurs préférences :

- `email_notifications_enabled` : Recevoir les emails
- `events_reminders_enabled` : Recevoir les rappels d'événements

### 8.5 Notifications de Préparation Musicale (Nouveau v1.4.1)

Le système envoie automatiquement des notifications au staff de l'Opéra lorsqu'un utilisateur demande une préparation musicale.

**Fichier** : `lib/notifications/unifiedNotificationService.ts`

**Variable d'environnement** :

```bash
OPERA_ADMIN_EMAIL="inscriptions@opera-orchestre-montpellier.fr"  # Par défaut
```

**Déclenchement** :

Lorsqu'une inscription est confirmée avec `want_preparation: true`, un email est automatiquement envoyé au staff de l'Opéra contenant :

- Détails de l'utilisateur (nom, email, téléphone)
- Informations sur l'établissement
- Détails de l'événement (titre, date, lieu)
- Nombre d'élèves inscrits
- Demande de préparation musicale

```typescript
// Dans RegistrationService.confirmRegistration
if (registration.want_preparation) {
  await sendMusicalPreparationNotification({
    user: registration.user,
    institution: registration.institution,
    event: registration.event,
    registration: registration,
  });
}
```

---

## 9. Scraping des Événements

### 9.1 Architecture

**Fichier** : `lib/cron/eventsScraper.ts`

```schema
┌─────────────────────────────────────────────────────────────┐
│                    WordPress API (Opera)                     │
│  https://www.opera-orchestre-montpellier.fr/wp-json/wp/v2/  │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Events Scraper      │
                    │   ┌───────────────┐   │
                    │   │ Fetch events  │   │
                    │   │ Parse ACF     │   │
                    │   │ Map types     │   │
                    │   │ Extract dates │   │
                    │   │ Get images    │   │
                    │   └───────────────┘   │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │     PostgreSQL        │
                    │   (Upsert Events)     │
                    └───────────────────────┘
```

### 9.2 Processus de Scraping

1. **Récupération** : Fetch API WordPress avec ACF
2. **Parsing** : Extraction des champs ACF (dates, types, publics, images)
3. **Mapping** : Conversion slugs WordPress → enums internes
4. **Upsert** : Création ou mise à jour des événements en base
5. **Notification** : Envoi notifications pour nouveaux événements

### 9.3 Mappings

**Fichier** : `lib/cron/scraperMappings.ts`

```typescript
// Mapping des types d'événements
export const eventTypeMapping: Record<string, EventType> = {
  opera: EventType.OPERA,
  'concert-lyrique': EventType.CONCERT_LYRIQUE,
  symphonique: EventType.SYMPHONIQUE,
  'chambre-baroque': EventType.CHAMBRE_BAROQUE,
  baroque: EventType.BAROQUE,
  'musiques-dailleurs': EventType.MUSIQUES_DAILLEURS,
  // ... 30+ mappings
};

// Mapping des catégories de public (types d'établissement)
export const publicCategoryMapping: Record<string, PublicCategory> = {
  creche: PublicCategory.CRECHE,
  maternelle: PublicCategory.MATERNELLE,
  elementaire: PublicCategory.ELEMENTAIRE,
  college: PublicCategory.COLLEGE,
  lycee: PublicCategory.LYCEE,
  superieur: PublicCategory.SUPERIEUR,
};

// Fonction pour extraire catégories ET sous-catégories des données WordPress
export function mapPublicNamesToCategories(names: string[]): {
  categories: PublicCategory[];
  grades: SchoolGrade[];
  age_ranges: AgeRange[];
};
```

### 9.4 Déclenchement

```bash
# Endpoint cron (protégé par CRON_SECRET)
GET /api/cron/events/scraping
Authorization: Bearer <CRON_SECRET>

# Recommandation : Exécuter quotidiennement à 2h du matin
0 2 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://example.com/api/cron/events/scraping
```

### 9.5 Ouverture Progressive (Nouveau v1.3.2)

Les événements ne sont plus ouverts en bloc, mais progressivement selon le calendrier scolaire :

1. **10 juin** : Ouverture des événements jusqu'à la fin des vacances de la Toussaint.
2. **Toussaint (Novembre)** : Ouverture des événements jusqu'à la fin des vacances de Noël.
3. **Noël (Janvier)** : Ouverture de tous les événements restants de la saison.

Cette logique est gérée par `HolidaysService` qui :

- Interroge l'API `data.education.gouv.fr` (Académie de Montpellier, Vacances scolaires)
- Détermine la `openingLimitDate` actuelle
- Appliquée lors du scraping (création) et via le cron `events/status-update` (mise à jour quotidienne)
- Archive automatiquement les événements un an après leur dernière date, sauf si le champ `status` est protégé

### 9.6 Protection des Champs Événements (Nouveau v1.4.1)

Le système de protection des champs permet aux administrateurs de protéger certains champs d'un événement contre les modifications automatiques lors du scraping.

**Fichiers** : `prisma/schema.prisma`, `app/api/admin/events/[id]/route.ts`, `components/admin/events/AdminEventForm.tsx`

**Champs Protégeables** (15 champs) :

| Champ                     | Description                     |
| ------------------------- | ------------------------------- |
| `title`                   | Titre de l'événement            |
| `description`             | Description de l'événement      |
| `type`                    | Types d'événements (tableau)    |
| `category`                | Catégories de public (tableau)  |
| `grades`                  | Niveaux scolaires (tableau)     |
| `age_ranges`              | Tranches d'âge (tableau)        |
| `location`                | Lieu de l'événement             |
| `duration`                | Durée en minutes                |
| `total_seats`             | Nombre total de places          |
| `caretaker`               | Accompagnateurs requis          |
| `image_url`               | URL de l'image                  |
| `event_dates`             | Dates de l'événement (tableau)  |
| `accessibility`           | Types d'accessibilité (tableau) |
| `slug`                    | URL-friendly slug pour SEO      |
| `has_initial_formation`   | Session de formation initiale   |
| `has_musical_preparation` | Session de préparation musicale |

**Implémentation** :

- `manually_edited` : Booléen indiquant si l'événement a été modifié manuellement
- `protected_fields` : Tableau des noms de champs protégés contre le scraping
- Le scraping route (`/api/cron/events/scraping`) vérifie les champs protégés avant de mettre à jour
- Interface admin dans le formulaire d'événement pour sélectionner les champs à protéger
- Lors d'un `PUT /api/admin/events/[id]`, les champs sont comparés après normalisation avant d'être ajoutés à `protected_fields`
- Les descriptions enrichies sont comparées après sanitation, `image_url` traite `''` et `null` comme équivalents, et `event_dates` est comparé à la précision minute pour correspondre au champ `datetime-local`

```typescript
// Exemple d'utilisation
const event = {
  title: 'Concert Symphonique',
  manually_edited: true,
  protected_fields: ['title', 'description', 'location'],
  // ... autres champs
};

// Lors du scraping, ces champs ne seront PAS mis à jour
```

### 9.7 Descriptions Enrichies des Événements

Les administrateurs disposent d'un éditeur de texte enrichi limité pour la description des événements.

**Fichiers** : `components/ui/RichTextEditor.tsx`, `components/events/EventDescription.tsx`, `lib/richText.ts`, `app/api/admin/events/route.ts`, `app/api/admin/events/[id]/route.ts`

**Stockage** :

- Le champ `Event.description` existant stocke le contenu en HTML sanitizé
- Aucune migration de schéma n'est nécessaire
- Les anciennes descriptions en texte brut restent compatibles ; les retours à la ligne sont normalisés en `<br>` à l'édition

**Balises autorisées** :

| Balise                        | Usage                             |
| ----------------------------- | --------------------------------- |
| `p`, `br`                     | Paragraphes et sauts de ligne     |
| `strong`, `b`, `em`, `i`, `u` | Mise en forme de base             |
| `ul`, `ol`, `li`              | Listes                            |
| `a[href]`                     | Liens HTTP(S), mailto ou relatifs |

**Sécurité** :

- `sanitizeRichText()` utilise `xss` avec une allowlist stricte
- Les balises `script`/`style`, attributs non autorisés et liens `javascript:` sont supprimés
- L'API sanitise à la création et à la mise à jour
- Le composant `EventDescription` sanitise à nouveau avant `dangerouslySetInnerHTML`
- Les cartes événements affichent un aperçu texte via `richTextToPlainText()` pour éviter d'injecter du HTML dans les listes
- La liste publique calcule cet aperçu texte côté serveur dans `lib/events/events.ts`, ce qui évite d'embarquer la sanitation HTML dans le chemin critique du client

---

## 10. Système de Scoring

### 10.1 Architecture

**Fichier** : `lib/scoring/scoringEngine.ts`

Le système de scoring permet de trier automatiquement les inscriptions selon des critères pondérés.

### 10.2 Critères Disponibles

| Critère                 | Description                                                | Type           |
| ----------------------- | ---------------------------------------------------------- | -------------- |
| `ATTENDANCE_RATE`       | Taux de présence historique                                | Bonus          |
| `MONTHS_SINCE_LAST`     | Mois depuis dernière participation                         | Bonus          |
| `TOTAL_PARTICIPATIONS`  | Nombre total de participations                             | Bonus/Pénalité |
| `RECENT_NO_SHOW`        | Absence récente non justifiée                              | Pénalité       |
| `IS_REP_INSTITUTION`    | Établissement REP/REP+                                     | Bonus          |
| `FIRST_TIME_APPLICANT`  | Première inscription                                       | Bonus          |
| `ACCESSIBILITY_NEEDS`   | Besoins d'accessibilité                                    | Bonus          |
| `EARLY_REGISTRATION`    | Inscription anticipée                                      | Bonus          |
| `INSTITUTION_TYPE`      | Type d'établissement                                       | Variable       |
| `REQUESTED_SEATS_COUNT` | Nombre de places demandées                                 | Variable       |
| `CARETAKER_RATIO`       | Ratio accompagnateurs                                      | Bonus          |
| `GEOGRAPHIC_ZONE`       | Zone géographique                                          | Variable       |
| `EVENT_CATEGORY_MATCH`  | Correspondance profils/événement (`grades` + `age_ranges`) | Variable       |
| `AESH_COUNT`            | Nombre d'accompagnants AESH déclarés                       | Variable       |

### 10.3 Configuration

```typescript
// Configuration par événement
const scoringConfig = {
  name: 'Configuration Concert Lyrique',
  event_id: 'event-uuid',
  criteria: [
    { type: 'IS_REP_INSTITUTION', enabled: true, weight: 20 },
    { type: 'RECENT_NO_SHOW', enabled: true, weight: 15 }, // Pénalité via isPenalty
    { type: 'FIRST_TIME_APPLICANT', enabled: true, weight: 10 },
    { type: 'ATTENDANCE_RATE', enabled: true, weight: 15 },
    { type: 'AESH_COUNT', enabled: true, weight: 5, parameters: { minCount: 1, highCount: 3 } },
  ],
};
```

### 10.4 Calcul du Score

```typescript
// Le score final est la somme pondérée de tous les critères
score = Σ (critère.rawScore × critère.weight / 100)

// Exemple :
// - IS_REP = 100 × 20% = +20 points
// - RECENT_NO_SHOW = -100 × 15% = -15 points (inversion automatique via isPenalty)
// - FIRST_TIME = 100 × 10% = +10 points
// Score total = 15 points
```

**Note importante** : `EVENT_CATEGORY_MATCH` s'appuie sur les niveaux/tranches de l'inscription (`grades`, `age_ranges`) comparés aux cibles de l'événement. Le scoring API inclut désormais systématiquement les données événement + adresse institution pour éviter les scores neutres involontaires.

---

## 11. Export de Données

### 11.1 Service d'Export

**Fichier** : `lib/utils/excelExportService.ts`

### 11.2 Types d'Export

| Export           | Colonnes (approx.)                                            | Format |
| ---------------- | ------------------------------------------------------------- | ------ |
| **Utilisateurs** | 17 colonnes (email/nom/activité, anonymisation optionnelle)   | Excel  |
| **Événements**   | 28 colonnes (slug, capacités, statuts d'inscription, etc.)    | Excel  |
| **Inscriptions** | 25 colonnes (profil établissement, manager, publics, etc.)    | Excel  |
| **Institutions** | 22 colonnes (utilisateurs liés + détail statuts inscriptions) | Excel  |
| **Groupes**      | 10 colonnes (catégories, niveaux, accessibilité)              | Excel  |
| **Résumé**       | Feuille de synthèse (filtres, options, métadonnées export)    | Excel  |

### 11.3 Options et Filtres Avancés

- **Options** : sélection de feuilles (`complete`), anonymisation, feuille de couverture, métadonnées exportateur
- **Filtres avancés** : `eventType`, `schoolGrade`, `ageRange`, `institutionId`, `eventId`

### 11.4 Traductions Françaises

Tous les enums sont traduits en français dans les exports :

- `CONCERT_LYRIQUE` → "Concert lyrique"
- `VISUAL` → "Malvoyant"
- `PENDING` → "En attente"
- etc.

### 11.5 Utilisation

```typescript
// Endpoint d'export
POST /api/admin/export
{
  exportType: 'complete',
  filters: { dateFrom: '2026-01-01', dateTo: '2026-12-31', eventType: 'OPERA' },
  options: { sheets: ['events', 'registrations'], anonymize: true, includeCoverSheet: true }
}

// Response: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

---

## 12. Tests

### 12.1 Configuration Jest

**Fichier** : `jest.config.ts`

```typescript
const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: ['lib/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}', '!**/node_modules/**'],
  coverageThreshold: {
    './lib/cron/eventsScraper.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
```

### 12.2 Structure des Tests

```text
__tests__/                        # Tests d'intégration
├── api/                          # Tests API
│   ├── auth.test.ts
│   └── events.test.ts
└── components/                   # Tests composants

lib/__tests__/                    # Tests unitaires lib
├── accountLockout.test.ts
├── csrfProtection.test.ts
├── emailService.test.ts
├── eventsScraper.test.ts         # 100% coverage
├── fuzzySearch.test.ts
├── passwordHistory.test.ts
├── securityLogger.test.ts
├── serverRateLimit.test.ts
└── validationSchemas.test.ts

hooks/__tests__/                  # Tests hooks
├── useAuth.test.ts
├── useNotifications.test.ts
└── useSecureForm.test.ts
```

### 12.3 Commandes de Test

```bash
# Exécuter tous les tests
npm test

# Mode watch (développement)
npm run test:watch

# Avec rapport de couverture
npm run coverage

# Test d'un fichier spécifique
npx jest lib/__tests__/emailService.test.ts

# Test du service de configuration (100% coverage)
npx jest lib/__tests__/configService.test.ts
```

### 12.4 Couverture de Tests

| Module               | Statements | Branches | Functions | Lines |
| -------------------- | ---------- | -------- | --------- | ----- |
| **configService.ts** | 100%       | 100%     | 100%      | 100%  |
| **eventsScraper.ts** | 100%       | 100%     | 100%      | 100%  |
| **labelMappings.ts** | ~95%       | ~90%     | ~95%      | ~95%  |
| **redisConfig.ts**   | ~85%       | ~80%     | ~85%      | ~85%  |

**Note** : La couverture de 100% pour `configService.ts` inclut tous les scénarios Redis :

- Cache hits et misses
- Erreurs de connexion Redis
- Invalidation de cache (spécifique et globale)
- Fallback vers le cache mémoire
- Clear du cache même lors d'erreurs Redis

### 12.5 Mocks

**Fichier** : `__mocks__/`

```typescript
// __mocks__/@/lib/prismaConfig.ts
export const prisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  // ... autres modèles
};
```

---

## 13. CI/CD

### 13.1 Pipeline GitHub Actions

**Fichier** : `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, dev, hotfix]
  pull_request:
    branches: ['*']

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma client
        run: npx prisma generate

      - name: Run linting
        run: npm run lint

      - name: Run type checking
        run: npm run typecheck

      - name: Run tests
        run: npm test

      - name: Security audit
        run: npm audit --audit-level=high

      - name: Build
        run: npm run build
```

### 13.2 Étapes du Pipeline

| Étape         | Description              | Bloquant        |
| ------------- | ------------------------ | --------------- |
| **Lint**      | Vérification ESLint      | ✅              |
| **Typecheck** | Vérification TypeScript  | ✅              |
| **Test**      | Exécution Jest           | ✅              |
| **Audit**     | Scan vulnérabilités npm  | ⚠️ (level=high) |
| **Build**     | Build Next.js production | ✅              |

### 13.3 Caching

- **node_modules** : Cache des dépendances npm
- **Prisma engines** : Cache du client généré
- **Next.js build** : Cache des builds incrémentaux

---

## 14. Déploiement

### 14.1 Prérequis Infrastructure

| Composant      | Requis    | Description                           |
| -------------- | --------- | ------------------------------------- |
| **PostgreSQL** | ✅        | Base de données principale            |
| **Redis**      | ✅ (prod) | Cache distribué (CSRF, rate limiting) |
| **Node.js**    | ≥ 20.x    | Runtime                               |
| **SSL/TLS**    | ✅        | HTTPS obligatoire                     |

### 14.2 Variables d'Environnement

```bash
# Base de données
DATABASE_URL="postgresql://user:pass@host:5432/opera_db"

# Redis (obligatoire en production multi-instances)
REDIS_URL="redis://host:6379"

# JWT Secrets (min 32 caractères)
ACCESS_TOKEN_SECRET="<openssl rand -hex 32>"
REFRESH_TOKEN_SECRET="<openssl rand -hex 32>"
JWT_REFRESH_SECRET="${REFRESH_TOKEN_SECRET}"

# Email (SMTP2GO)
SMTP2GO_API_KEY="api-XXXXXXXX"
SMTP_FROM_EMAIL="noreply@example.com"
SMTP_FROM_NAME="Plateforme de l'Opéra"

# Application
APP_URL="https://example.com"
ALLOWED_ORIGINS="https://example.com"
NODE_ENV="production"

# Cron
CRON_SECRET="<openssl rand -hex 32>"
```

### 14.3 Procédure de Déploiement

```bash
# 1. Cloner et installer
git clone <repo>
cd service-culturel-plateforme-web
npm ci

# 2. Configurer l'environnement
cp .env.example .env
# Éditer .env avec les valeurs de production

# 3. Générer le client Prisma
npx prisma generate

# 4. Appliquer les migrations
npx prisma migrate deploy

# Si l'environnement utilise db push au lieu de migrations :
# appliquer le schéma avant de déployer le code applicatif
npx prisma db push

# 5. (Optionnel) Seeder la base
npx prisma db seed

# 6. Build de production
npm run build

# 7. Démarrer
npm start
```

### 14.4 Configuration Cron

```bash
# Sauvegarde de la base de données (1x par jour, 1h)
0 1 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://example.com/api/cron/backup

# Scraping des événements (quotidien, 2h)
0 2 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://example.com/api/cron/events/scraping

# Rappels d'événements (toutes les heures)
0 * * * * curl -H "Authorization: Bearer $CRON_SECRET" https://example.com/api/cron/events/reminders

# Mise à jour des statuts (quotidien, 3h)
0 3 * * * curl -H "Authorization: Bearer $CRON_SECRET" https://example.com/api/cron/events/status-update
```

### 14.5 Configuration cron-job.org

Pour configurer les tâches cron via [cron-job.org](https://cron-job.org) :

1. Créer un compte et aller dans "Cronjobs" > "Create Cronjob"
2. **URL** : `https://[votre-domaine]/api/cron/[endpoint]`
3. **HTTP Method** : `GET`
4. Activer "Add HTTP header" :
   - Header : `Authorization`
   - Value : `Bearer [votre_CRON_SECRET]`
5. **Schedule** : Configurer la fréquence (ex: "Every day at 01:00" pour le backup)
6. Décocher "Save response" pour éviter de stocker des données sensibles
7. Sauvegarder la tâche

### 14.6 Post-Déploiement

1. **Créer un compte SuperAdmin** (via seed ou SQL direct)
2. **Vérifier la connectivité Redis**
3. **Tester l'envoi d'emails**
4. **Configurer le monitoring**
5. **Planifier les sauvegardes DB** (cf 14.5)

---

## 15. Maintenance

### 15.1 Surveillance

| Aspect               | Méthode                                            |
| -------------------- | -------------------------------------------------- |
| **Logs applicatifs** | Console / stdout                                   |
| **Logs de sécurité** | Table `SecurityLog`                                |
| **Violations CSP**   | Endpoint `/api/csp-report`                         |
| **Santé Redis**      | `lib/middleware/redisConfig.ts` (isRedisConnected) |

### 15.2 Tâches Régulières

| Tâche                         | Fréquence        |
| ----------------------------- | ---------------- |
| Revue des logs de sécurité    | Hebdomadaire     |
| Mise à jour des dépendances   | Mensuelle        |
| Rotation des secrets JWT      | Trimestrielle    |
| Audit de sécurité (npm audit) | À chaque release |
| Nettoyage tokens expirés      | Automatique (DB) |

### 15.3 Dépannage Courant

| Problème                        | Solution                                  |
| ------------------------------- | ----------------------------------------- |
| **401 sur toutes les requêtes** | Vérifier ACCESS_TOKEN_SECRET              |
| **CSRF invalid**                | Vider le cache navigateur, vérifier Redis |
| **Rate limit excessif**         | Ajuster config dans serverRateLimit.ts    |
| **Emails non envoyés**          | Vérifier SMTP2GO_API_KEY et quotas        |
| **Scraping échoue**             | Vérifier l'API WordPress et les mappings  |

### 15.4 Commandes Utiles

```bash
# Vérifier la santé de la base
npx prisma db pull

# Réinitialiser un utilisateur verrouillé
# (via Prisma Studio)
npx prisma studio

# Forcer le refresh du client Prisma
npx prisma generate --force

# Logs en temps réel (si configuré)
tail -f /var/log/opera-platform/app.log
```

---

## Annexes

### A. Glossaire

| Terme      | Définition                                |
| ---------- | ----------------------------------------- |
| **ACF**    | Advanced Custom Fields (plugin WordPress) |
| **CSP**    | Content Security Policy                   |
| **CSRF**   | Cross-Site Request Forgery                |
| **JWT**    | JSON Web Token                            |
| **REP**    | Réseau d'Éducation Prioritaire            |
| **Upsert** | Update or Insert                          |

### B. Contacts

- **Développeur** : Vincent Bichat (<vincent260705@gmail.com>)
- **Client** : Opéra Orchestre National Montpellier Occitanie

### C. Références

- [Documentation Next.js](https://nextjs.org/docs)
- [Documentation Prisma](https://www.prisma.io/docs)
- [API SMTP2GO](https://www.smtp2go.com/docs/)

---

Document mis à jour le 30 juin 2026 - Version 1.7.0
