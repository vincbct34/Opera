import { z } from 'zod';
// Types imported for reference to ensure Zod enums match Prisma schema
import { SchoolGrade, AgeRange, ScoringCriterionType } from '@prisma/client';

/**
 * Validation schemas for authentication routes
 * These schemas provide runtime type validation to prevent injection attacks
 */

/**
 * Shared password validation schema.
 * Requires at least 10 characters, including uppercase, lowercase, digit, and special character.
 */
export const PasswordSchema = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères')
  .max(128, 'Mot de passe trop long')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-[\]{}|;:'",.<>?/~`])/,
    'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial (@$!%*?&#^()_+=-[]{}|;:\'",.<>?/~`)',
  );

/**
 * Schema for user login validation.
 */
export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email est requis')
    .email('Format email invalide')
    .toLowerCase()
    .max(254, 'Email trop long'), // RFC 5321
  password: z.string().min(1, 'Mot de passe requis').max(128, 'Mot de passe trop long'), // Reasonable max length
});

/**
 * Schema for user registration validation.
 */
export const RegisterSchema = z.object({
  email: z
    .string()
    .min(1, 'Email est requis')
    .email('Format email invalide')
    .toLowerCase()
    .max(254, 'Email trop long'),
  password: PasswordSchema,
  first_name: z
    .string()
    .min(1, 'Prénom requis')
    .max(100, 'Prénom trop long')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Le prénom contient des caractères invalides'),
  last_name: z
    .string()
    .min(1, 'Nom requis')
    .max(100, 'Nom trop long')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Le nom contient des caractères invalides'),
  phone_number: z
    .string()
    .min(1, 'Numéro de téléphone requis')
    .regex(/^[0-9+\s()-]+$/, 'Format de téléphone invalide')
    .max(20, 'Numéro de téléphone trop long'),
  institution_ids: z
    .array(z.string().cuid('ID institution invalide'))
    .min(1, 'Au moins une institution est requise')
    .max(10, "Trop d'institutions sélectionnées"),
  email_notifications_enabled: z.boolean().optional().default(true),
  events_reminders_enabled: z.boolean().optional().default(true),
});

/**
 * Schema for password reset request validation.
 */
export const ResetPasswordRequestSchema = z.object({
  email: z
    .string()
    .min(1, 'Email est requis')
    .email('Format email invalide')
    .toLowerCase()
    .max(254, 'Email trop long'),
});

/**
 * Schema for password reset validation.
 */
export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requis').max(500, 'Token invalide'),
  password: PasswordSchema,
});

/**
 * Schema for changing password validation.
 */
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis').max(128),
  newPassword: PasswordSchema,
});

/**
 * Schema for email verification token validation.
 */
export const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Token requis').max(500, 'Token invalide'),
});

/**
 * Schema for resending verification email validation.
 */
export const ResendVerificationSchema = z.object({
  email: z
    .string()
    .min(1, 'Email est requis')
    .email('Format email invalide')
    .toLowerCase()
    .max(254, 'Email trop long'),
});

// Export types for TypeScript
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ResetPasswordRequestInput = z.infer<typeof ResetPasswordRequestSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;

// ============================================================================
// SchoolGrade and AgeRange Validation Schemas
// ============================================================================

/**
 * Valid SchoolGrade enum values for Zod validation
 */
export const SchoolGradeEnum = z.enum([
  SchoolGrade.PS,
  SchoolGrade.MS,
  SchoolGrade.GS,
  SchoolGrade.CP,
  SchoolGrade.CE1,
  SchoolGrade.CE2,
  SchoolGrade.CM1,
  SchoolGrade.CM2,
  SchoolGrade.SIXIEME,
  SchoolGrade.CINQUIEME,
  SchoolGrade.QUATRIEME,
  SchoolGrade.TROISIEME,
  SchoolGrade.SECONDE,
  SchoolGrade.PREMIERE,
  SchoolGrade.TERMINALE,
]);

/**
 * Valid AgeRange enum values for Zod validation
 */
export const AgeRangeEnum = z.enum([
  AgeRange.AGE_0_3,
  AgeRange.AGE_3_6,
  AgeRange.AGE_6_11,
  AgeRange.AGE_11_15,
  AgeRange.AGE_15_18,
  AgeRange.AGE_18_PLUS,
]);

/**
 * Schema for validating an array of SchoolGrade values
 */
export const SchoolGradesSchema = z.array(SchoolGradeEnum).min(0).max(15, {
  message: 'Trop de niveaux scolaires sélectionnés',
});

/**
 * Schema for validating an array of AgeRange values
 */
export const AgeRangesSchema = z.array(AgeRangeEnum).min(0).max(6, {
  message: "Trop de tranches d'âge sélectionnées",
});

// ============================================================================
// Form Validation Schemas using grades/age_ranges
// ============================================================================

/**
 * Schema for registration form with grades and age_ranges
 */
export const RegistrationWithGradesSchema = z.object({
  event_id: z.string().cuid("ID d'événement invalide"),
  institution_id: z.string().cuid("ID d'institution invalide"),
  date: z.coerce.date().refine((date) => !isNaN(date.getTime()), {
    message: 'Date invalide',
  }),
  booked_seats: z
    .number()
    .int()
    .min(1, 'Au moins 1 place requise')
    .max(500, 'Trop de places demandées'),
  manager_first_name: z.string().max(100, 'Prénom trop long').optional(),
  manager_last_name: z.string().max(100, 'Nom trop long').optional(),
  manager_email: z
    .string()
    .email('Email invalide')
    .max(254, 'Email trop long')
    .optional()
    .or(z.literal('')),
  manager_phone_number: z
    .string()
    .regex(/^[0-9+\s()-]+$/, 'Format de téléphone invalide')
    .max(20, 'Numéro trop long')
    .optional()
    .or(z.literal('')),
  comments: z.string().max(2000, 'Commentaires trop longs').optional().or(z.literal('')),
  caretaker_count: z.number().int().min(0).max(50).optional(),
  aesh_count: z.number().int().min(0).max(100).optional(),
  want_formation: z.boolean().optional(),
  want_preparation: z.boolean().optional(),
  grades: SchoolGradesSchema.optional(),
  age_ranges: AgeRangesSchema.optional(),
});

/**
 * Schema for group/class creation with grades and age_ranges
 */
export const GroupCreateSchema = z.object({
  name: z.string().max(100, 'Nom trop long').optional(),
  students_count: z
    .number()
    .int()
    .min(0, "Le nombre d'élèves doit être positif")
    .max(500, "Nombre d'élèves trop élevé")
    .default(0),
  grades: SchoolGradesSchema.optional(),
  age_ranges: AgeRangesSchema.optional(),
});

/**
 * Schema for group/class update with grades and age_ranges
 */
export const GroupUpdateSchema = z.object({
  name: z.string().max(100, 'Nom trop long').optional(),
  students_count: z
    .number()
    .int()
    .min(0, "Le nombre d'élèves doit être positif")
    .max(500, "Nombre d'élèves trop élevé")
    .optional(),
  grades: SchoolGradesSchema.optional(),
  age_ranges: AgeRangesSchema.optional(),
});

/**
 * Schema for institution creation with grades and age_ranges
 */
export const InstitutionCreateSchema = z.object({
  name: z
    .string()
    .min(1, 'Nom requis')
    .max(200, 'Nom trop long')
    .regex(/^[a-zA-Z0-9À-ÿ\s'-]+$/, 'Le nom contient des caractères invalides'),
  email: z
    .string()
    .email('Email invalide')
    .max(254, 'Email trop long')
    .optional()
    .or(z.literal('')),
  phone_number: z
    .string()
    .regex(/^[0-9+\s()-]+$/, 'Format de téléphone invalide')
    .max(20, 'Numéro trop long')
    .optional()
    .or(z.literal('')),
  address: z.object({
    street: z.string().min(1, 'Rue requise').max(255, 'Rue trop longue'),
    zip_code: z.string().regex(/^\d{5}$/, 'Code postal invalide (5 chiffres requis)'),
    city: z.string().min(1, 'Ville requise').max(100, 'Ville trop longue'),
  }),
  type: z
    .array(SchoolGradeEnum)
    .min(1, 'Au moins un type est requis')
    .max(15, 'Trop de types sélectionnés'),
  age_range: AgeRangesSchema.optional(),
  not_listed: z.string().max(500, 'Texte trop long').optional().or(z.literal('')),
});

/**
 * Schema for institution update with grades and age_ranges
 */
export const InstitutionUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'Nom requis')
    .max(200, 'Nom trop long')
    .regex(/^[a-zA-Z0-9À-ÿ\s'-]+$/, 'Le nom contient des caractères invalides')
    .optional(),
  email: z
    .string()
    .email('Email invalide')
    .max(254, 'Email trop long')
    .optional()
    .or(z.literal('')),
  phone_number: z
    .string()
    .regex(/^[0-9+\s()-]+$/, 'Format de téléphone invalide')
    .max(20, 'Numéro trop long')
    .optional()
    .or(z.literal('')),
  address: z
    .object({
      street: z.string().min(1, 'Rue requise').max(255, 'Rue trop longue'),
      zip_code: z.string().regex(/^\d{5}$/, 'Code postal invalide (5 chiffres requis)'),
      city: z.string().min(1, 'Ville requise').max(100, 'Ville trop longue'),
    })
    .optional(),
  type: z
    .array(SchoolGradeEnum)
    .min(1, 'Au moins un type est requis')
    .max(15, 'Trop de types sélectionnés')
    .optional(),
  age_range: AgeRangesSchema.optional(),
  not_listed: z.string().max(500, 'Texte trop long').optional().or(z.literal('')),
});

/**
 * Schema for event creation with grades and age_ranges
 */
export const EventCreateSchema = z.object({
  title: z.string().min(1, 'Titre requis').max(255, 'Titre trop long'),
  description: z.string().max(5000, 'Description trop longue').optional().or(z.literal('')),
  type: z.array(z.string()).min(1, 'Au moins un type requis'),
  location: z.string().min(1, 'Lieu requis').max(255, 'Lieu trop long'),
  duration: z
    .number()
    .int()
    .min(1, 'Durée doit être positive')
    .max(1440, 'Durée trop longue (max 24h)'),
  total_seats: z.number().int().min(1, 'Au moins 1 place requise').max(100000, 'Trop de places'),
  event_dates: z
    .array(z.coerce.date())
    .min(1, 'Au moins une date requise')
    .max(50, 'Trop de dates'),
  caretaker: z.number().int().min(0, "Le nombre d'accompagnateurs doit être positif").optional(),
  has_initial_formation: z.boolean().optional(),
  is_formation_mandatory: z.boolean().optional(),
  has_musical_preparation: z.boolean().optional(),
  image_url: z.string().url("URL d'image invalide").optional().or(z.literal('')),
  slug: z.string().max(255, 'Slug trop long').optional(),
  grades: SchoolGradesSchema.optional(),
  age_ranges: AgeRangesSchema.optional(),
  accessibility: z.array(z.string()).optional(),
});

/**
 * Schema for event update with grades and age_ranges
 */
export const EventUpdateSchema = z.object({
  title: z.string().min(1, 'Titre requis').max(255, 'Titre trop long').optional(),
  description: z.string().max(5000, 'Description trop longue').optional().or(z.literal('')),
  type: z.array(z.string()).min(1, 'Au moins un type requis').optional(),
  location: z.string().min(1, 'Lieu requis').max(255, 'Lieu trop long').optional(),
  duration: z
    .number()
    .int()
    .min(1, 'Durée doit être positive')
    .max(1440, 'Durée trop longue (max 24h)')
    .optional(),
  total_seats: z
    .number()
    .int()
    .min(1, 'Au moins 1 place requise')
    .max(100000, 'Trop de places')
    .optional(),
  event_dates: z
    .array(z.coerce.date())
    .min(1, 'Au moins une date requise')
    .max(50, 'Trop de dates')
    .optional(),
  caretaker: z.number().int().min(0, "Le nombre d'accompagnateurs doit être positif").optional(),
  has_initial_formation: z.boolean().optional(),
  is_formation_mandatory: z.boolean().optional(),
  has_musical_preparation: z.boolean().optional(),
  image_url: z.string().url("URL d'image invalide").optional().or(z.literal('')),
  slug: z.string().max(255, 'Slug trop long').optional(),
  grades: SchoolGradesSchema.optional(),
  age_ranges: AgeRangesSchema.optional(),
  accessibility: z.array(z.string()).optional(),
  status: z.enum(['OPEN', 'CLOSED', 'ARCHIVED']).optional(),
});

// === Scoring Schemas ===

/**
 * Zod enum matching the Prisma ScoringCriterionType enum.
 * Single source of truth for API validation of scoring criterion types.
 */
const ScoringCriterionTypeValues = Object.values(ScoringCriterionType) as [string, ...string[]];

export const ScoringCriterionTypeSchema = z.enum(ScoringCriterionTypeValues);

/**
 * Schema for a single scoring criterion within a configuration.
 */
export const ScoringCriterionSchema = z.object({
  type: ScoringCriterionTypeSchema,
  enabled: z.boolean(),
  weight: z.number().min(0).max(100),
  parameters: z.record(z.string(), z.any()).optional(),
  order: z.number().int().min(0).optional(),
});

/**
 * Schema for creating a new scoring configuration.
 */
export const CreateScoringConfigSchema = z.object({
  name: z.string().min(1).max(100),
  event_id: z.string().optional().nullable(),
  is_default: z.boolean().optional(),
  criteria: z.array(ScoringCriterionSchema).min(1),
});

/**
 * Schema for updating an existing scoring configuration.
 */
export const UpdateScoringConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  is_default: z.boolean().optional(),
  criteria: z.array(ScoringCriterionSchema).optional(),
});

// Export types for TypeScript
export type RegistrationWithGradesInput = z.infer<typeof RegistrationWithGradesSchema>;
export type GroupCreateInput = z.infer<typeof GroupCreateSchema>;
export type GroupUpdateInput = z.infer<typeof GroupUpdateSchema>;
export type InstitutionCreateInput = z.infer<typeof InstitutionCreateSchema>;
export type InstitutionUpdateInput = z.infer<typeof InstitutionUpdateSchema>;
export type EventCreateInput = z.infer<typeof EventCreateSchema>;
export type EventUpdateInput = z.infer<typeof EventUpdateSchema>;
export type ScoringCriterionInput = z.infer<typeof ScoringCriterionSchema>;
export type CreateScoringConfigInput = z.infer<typeof CreateScoringConfigSchema>;
export type UpdateScoringConfigInput = z.infer<typeof UpdateScoringConfigSchema>;
