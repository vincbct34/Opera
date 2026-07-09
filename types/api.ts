/**
 * Types partagés entre le front et le back pour les réponses API
 * Ces types utilisent Prisma comme base mais peuvent être étendus selon les besoins de l'API
 */

import {
  Role,
  PublicCategory,
  EventType,
  EventStatus,
  Accessibility,
  RegistrationStatus,
  SchoolGrade,
  AgeRange,
  type User,
  type Institution,
  type Address,
  type Event,
  type Registration,
  type Notification,
} from '@prisma/client';

// ============================================
// Types User
// ============================================

/**
 * User sans le mot de passe (pour les réponses API)
 */
export type SafeUser = Omit<User, 'password'>;

/**
 * User avec les informations des institutions
 */
export type UserWithInstitutions = SafeUser & {
  userInstitutions: Array<{
    institution: Institution & { address: Address };
  }>;
};

/**
 * User pour la liste admin (version simplifiée)
 */
export type UserListItem = Pick<
  User,
  'id' | 'email' | 'first_name' | 'last_name' | 'role' | 'created_at' | 'updated_at'
> & {
  userInstitutions?: Array<{
    institution: Pick<Institution, 'id' | 'name'>;
  }>;
};

/**
 * User pour la liste admin (version sérialisée pour le transfert client-serveur)
 */
export type UserListItemSerialized = Omit<UserListItem, 'created_at' | 'updated_at'> & {
  created_at: string;
  updated_at: string;
};

/**
 * User avec détails complets (groups et registrations)
 */
export type GroupWithoutUserId = Pick<
  import('@prisma/client').Group,
  'id' | 'name' | 'category' | 'updated_at' | 'students_count' | 'grades' | 'age_ranges'
> & {
  disabilities?: Array<{
    id: string;
    type: import('@prisma/client').Accessibility;
    count: number;
    details?: string | null;
  }>;
};

export type UserWithDetails = Omit<
  User,
  'password' | 'email_verification_token' | 'email_verification_expires' | 'pending_email'
> & {
  groups: GroupWithoutUserId[];
  registrations: Array<
    Pick<
      Registration,
      'id' | 'event_id' | 'date' | 'booked_seats' | 'status' | 'created_at' | 'updated_at'
    > & {
      event?: Pick<Event, 'id' | 'title' | 'slug' | 'status'>;
    }
  >;
  userInstitutions?: Array<{
    institution: {
      id: string;
      name: string;
    };
  }>;
};

// ============================================
// Types Institution
// ============================================

/**
 * Institution avec l'adresse
 */
export type InstitutionWithAddress = Institution & {
  address: Address;
};

/**
 * Institution avec compteurs
 */
export type InstitutionWithCounts = InstitutionWithAddress & {
  _count?: {
    userInstitutions?: number;
    registrations?: number;
  };
};

/**
 * Institution pour la recherche (version simplifiée)
 */
export type InstitutionSearchResult = Pick<Institution, 'id' | 'name' | 'type'> & {
  address: Pick<Address, 'street' | 'zip_code' | 'city'>;
};

/**
 * Institution pour la sélection (avec email et téléphone optionnels)
 */
export type InstitutionSelectOption = Pick<
  Institution,
  'id' | 'name' | 'email' | 'phone_number' | 'type' | 'grades' | 'age_ranges'
> & {
  address: Pick<Address, 'street' | 'zip_code' | 'city'>;
};

// ============================================
// Types Event
// ============================================

/**
 * Event avec toutes les relations
 */
export type EventWithRelations = Event & {
  registrations?: Registration[];
  accessibility?: { type: Accessibility }[];
};

/**
 * Event pour l'affichage public (renommé pour éviter le conflit avec Event du DOM)
 * Les dates sont converties en string pour la sérialisation JSON
 */
export type EventData = Omit<PublicEvent, 'event_dates'> & {
  event_dates: string[];
};

export type PublicEvent = Pick<
  Event,
  | 'id'
  | 'title'
  | 'slug'
  | 'description'
  | 'image_url'
  | 'location'
  | 'event_dates'
  | 'type'
  | 'category'
  | 'grades'
  | 'age_ranges'
  | 'status'
>;

// ============================================
// Types de réponse API (avec pagination)
// ============================================

/**
 * Generic paginated response structure.
 * @template T - The type of item in the data array
 */
export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

/**
 * Response structure for the user list API.
 */
export type UserListResponse = {
  users: UserListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

/**
 * Response structure for the institution list API.
 */
export type InstitutionListResponse = {
  institutions: InstitutionWithCounts[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

/**
 * Response structure for the notification list API.
 */
export type NotificationListResponse = {
  notifications: Notification[];
  unreadCount: number;
  hasMore: boolean;
  total: number;
};

// ============================================
// Types de données de formulaire
// ============================================

/**
 * Data required to create a new user.
 */
export type CreateUserData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  institution_ids: string[]; // Changed to support multiple institutions
};

/**
 * Data for updating an existing user.
 */
export type UpdateUserData = Partial<
  Pick<User, 'email' | 'first_name' | 'last_name' | 'phone_number' | 'role'>
>;

/**
 * Data required to create a new institution.
 */
export type CreateInstitutionData = {
  name: string;
  email?: string;
  phone_number?: string;
  address: {
    street: string;
    zip_code: string;
    city: string;
  };
  type: PublicCategory[];
  grades?: SchoolGrade[];
  age_ranges?: AgeRange[];
  not_listed?: string;
};

/**
 * Data for updating an existing institution.
 */
export type UpdateInstitutionData = Partial<CreateInstitutionData>;

// ============================================
// Réexporter les enums et types utiles
// ============================================

/**
 * Extended Event type for admin usage, including counts and relations.
 */
export type AdminEvent = {
  id: string;
  title: string;
  status: EventStatus;
  created_at: string;
  _count?: {
    registrations: number;
  };
  description?: string;
  type?: EventType[];
  location?: string;
  duration?: number;
  total_seats?: number;
  image_url?: string;
  event_dates?: string[];
  category?: PublicCategory[];
  grades?: SchoolGrade[];
  age_ranges?: AgeRange[];
  has_initial_formation?: boolean;
  is_formation_mandatory?: boolean;
  has_musical_preparation?: boolean;
  accessibility?: { type: Accessibility }[];
  registrationBlocks?: AdminEventRegistrationBlock[];
};

export type AdminEventRegistrationBlock = {
  id?: string;
  title: string;
  description?: string | null;
  dates: string[];
  end_dates?: string[];
  enabled?: boolean;
  registration_enabled?: boolean;
  mandatory?: boolean;
  order?: number;
  _count?: { selections: number };
};

export type AdminEventFormData = Omit<
  AdminEvent,
  'id' | 'created_at' | '_count' | 'accessibility'
> & {
  accessibility: string[];
  protected_fields?: string[];
  manually_edited?: boolean;
  caretaker?: number;
  slug?: string;
};

export {
  Role,
  PublicCategory,
  EventType,
  EventStatus,
  Accessibility,
  RegistrationStatus,
  SchoolGrade,
  AgeRange,
};
export type { User, Institution, Address, Event, Registration, Notification };
