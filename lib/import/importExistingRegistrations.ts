import ExcelJS from 'exceljs';
import * as crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sendEmail } from '@/lib/notifications/emailService';
import { RegistrationStatus, PublicCategory, Role, PrismaClient } from '@/app/generated/prisma';

// Type for transaction client (same as Prisma client but without transaction methods)
type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// Types for Excel data
interface ExcelRow {
  'Ecole / Association': string;
  Ville: string;
  'Adresse Etablissement'?: string;
  'Mail établissement'?: string;
  'Type de public'?: string;
  Effectifs: string;
  'Date de venue': string;
  'Nom spectacle': string;
  'Nom référent': string;
  'Prénom référent': string;
  Mail: string;
}

interface ImportResult {
  totalRows: number;
  processed: number;
  errors: string[];
  createdUsers: number;
  createdInstitutions: number;
  createdRegistrations: number;
  emailsSent: number;
}

export interface ImportOptions {
  sendEmails: boolean;
  defaultStatus: 'PRESENT' | 'ABSENT';
  selectedRows?: number[];
}

// Preview types
export interface PreviewRow {
  rowIndex: number;
  raw: {
    institution: string;
    city: string;
    address?: string;
    institutionEmail?: string;
    publicType?: string;
    referentLastName: string;
    referentFirstName: string;
    email: string;
    eventTitle: string;
    eventDate: string;
    seats: number;
  };
  institutionStatus: 'existing' | 'new' | 'error';
  institutionName: string;
  institutionId?: string;
  userStatus: 'existing' | 'new';
  userId?: string;
  userFullName?: string;
  eventStatus: 'found' | 'not_found';
  eventId?: string;
  eventName?: string;
  eventDates?: string[];
  error?: string;
  canImport: boolean;
  isDuplicate?: boolean;
}

export interface PreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  newUsers: number;
  existingUsers: number;
  newInstitutions: number;
  existingInstitutions: number;
  eventsFound: number;
  eventsNotFound: number;
  totalSeats: number;
  rows: PreviewRow[];
}

// Helper: Get normalized date key for comparison (timezone-safe)
// Returns a unique key based on UTC date components (YYYY-MM-DD)
export function getDateKey(date: Date): string {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Parse French date format (DD/MM/YYYY) or native Date object
export function parseFrenchDate(dateValue: Date | string | unknown): Date {
  let date: Date;

  // If already a Date object (from ExcelJS), extract local date and recreate at noon UTC
  // This prevents timezone shift issues: May 12 00:00 GMT+0200 becomes May 11 22:00 UTC
  // By setting to noon UTC (12:00), the date remains consistent across timezones
  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) {
      throw new Error(`Invalid Date object: ${dateValue}`);
    }
    // Extract local year, month, day and recreate at noon UTC
    const year = dateValue.getFullYear();
    const month = dateValue.getMonth();
    const day = dateValue.getDate();
    date = new Date(Date.UTC(year, month, day, 12, 0, 0));
    logger.info(`[Date] Normalized native Date -> ${date.toISOString()}`);
    return date;
  }

  // Otherwise parse as French date string (DD/MM/YYYY)
  const str = typeof dateValue === 'string' ? dateValue : String(dateValue || '');
  const parts = str.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateValue}`);
  }
  const [day, month, year] = parts.map(Number);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error(`Invalid date values: ${dateValue}`);
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Date out of range: ${dateValue}`);
  }

  // Create date at noon UTC to avoid timezone issues
  date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateValue}`);
  }

  logger.info(`[Date] Parsed "${dateValue}" -> ${date.toISOString()}`);
  return date;
}

// Extract address components from full address string
export function parseAddress(addressStr: string | unknown): {
  street?: string;
  zipCode?: string;
  city: string;
} {
  const str = typeof addressStr === 'string' ? addressStr : String(addressStr || '');
  const trimmed = str.trim();
  if (!trimmed) {
    throw new Error('Empty address string');
  }

  // Pattern: "NUMBER STREET_NAME ZIP_CODE CITY" or "STREET ZIP_CODE CITY"
  // Example: "22 RUE JULES GUESDE 34080 Montpellier"
  const parts = trimmed.split(/\s+/);
  const zipCodeIndex = parts.findIndex((p) => /^\d{5}$/.test(p));

  if (zipCodeIndex === -1) {
    throw new Error(`No ZIP code found in address: ${addressStr}`);
  }

  const zipCode = parts[zipCodeIndex];
  const city = parts.slice(zipCodeIndex + 1).join(' ');
  const street = parts.slice(0, zipCodeIndex).join(' ');

  const result = { street, zipCode, city };
  logger.info(`[Address] Parsed "${addressStr}" ->`, result);
  return result;
}

// Normalize string for comparison: remove accents, uppercase, trim spaces
// This handles case variations, accents, and extra spaces
function normalizeForComparison(str: string): string {
  return str
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toUpperCase()
    .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
}

// Map Type de public to PublicCategory enum
// Handles single types (e.g., "Collège") or multiple types separated by "+" (e.g., "Collège + Lycée")
export function mapPublicCategory(typeStr: string): PublicCategory[] {
  const mapping: Record<string, PublicCategory> = {
    CRECHE: PublicCategory.CRECHE,
    MATERNELLE: PublicCategory.MATERNELLE,
    ELEMENTAIRE: PublicCategory.ELEMENTAIRE,
    COLLEGE: PublicCategory.COLLEGE,
    LYCEE: PublicCategory.LYCEE,
    SUPERIEUR: PublicCategory.SUPERIEUR,
    CONSERVATOIRE: PublicCategory.CONSERVATOIRE,
    ASSOCIATION: PublicCategory.ASSOCIATION,
    'CENTRE DE LOISIRS': PublicCategory.PERISCOLAIRE,
    PERISCOLAIRE: PublicCategory.PERISCOLAIRE,
    'PUBLICS EMPECHES': PublicCategory.PUBLICS_EMPECHES,
    AUTRE: PublicCategory.AUTRE,
  };

  // Check if multiple types are separated by "+" (e.g., "Collège + Lycée")
  if (typeStr.includes('+')) {
    const parts = typeStr.split('+').map((p) => p.trim());
    const categories: PublicCategory[] = [];

    for (const part of parts) {
      if (!part) continue; // Skip empty parts
      const normalized = normalizeForComparison(part);
      const category = mapping[normalized];
      if (category && !categories.includes(category)) {
        categories.push(category);
      }
    }

    const result = categories.length > 0 ? categories : [PublicCategory.AUTRE];
    logger.info(
      `[Category] Mapped multiple types "${typeStr}" (parts: ${parts.join(', ')}) ->`,
      result,
    );
    return result;
  }

  // Single type mapping
  const normalizedType = normalizeForComparison(typeStr);
  const result = mapping[normalizedType] ? [mapping[normalizedType]] : [PublicCategory.AUTRE];
  logger.info(`[Category] Mapped "${typeStr}" (normalized: "${normalizedType}") ->`, result);
  return result;
}

// Infer institution type from name
export function inferInstitutionType(name: string): PublicCategory[] {
  // Use the same normalization function for consistency
  const normalizedName = normalizeForComparison(name);

  // Check for type indicators (normalized without accents)
  if (normalizedName.includes('CRECHE')) {
    return [PublicCategory.CRECHE];
  }
  if (normalizedName.includes('MATERNELLE')) {
    return [PublicCategory.MATERNELLE];
  }
  if (normalizedName.includes('ELEMENTAIRE') || normalizedName.includes('ECOLE PRIMAIRE')) {
    return [PublicCategory.ELEMENTAIRE];
  }
  if (normalizedName.includes('COLLEGE')) {
    return [PublicCategory.COLLEGE];
  }
  if (normalizedName.includes('LYCEE')) {
    return [PublicCategory.LYCEE];
  }
  if (normalizedName.includes('CONSERVATOIRE')) {
    return [PublicCategory.CONSERVATOIRE];
  }
  if (normalizedName.includes('ASSOCIATION')) {
    return [PublicCategory.ASSOCIATION];
  }
  if (normalizedName.includes('CENTRE DE LOISIRS') || normalizedName.includes('PERISCOLAIRE')) {
    return [PublicCategory.PERISCOLAIRE];
  }

  logger.info(`[Category] Inferred type for "${name}" -> AUTRE`);
  return [PublicCategory.AUTRE];
}

// Generate secure random password
function generateSecurePassword(length = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const allChars = uppercase + lowercase + numbers + special;
  let password = '';

  // Ensure at least one of each required character type
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Fisher-Yates shuffle with cryptographic randomness
  const chars = password.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// Find or create institution
export async function findOrCreateInstitution(
  row: ExcelRow,
  tx?: TransactionClient,
): Promise<{ id: string; isNew: boolean }> {
  // Use transaction client if provided, otherwise use global prisma client
  const db = tx || prisma;

  const institutionName = row['Ecole / Association'].trim();
  // Safe city extraction - handle non-string values
  const cityRaw = row.Ville;
  const city = cityRaw ? String(cityRaw).trim() : '';
  const addrRaw = row['Adresse Etablissement'];
  const hasFullAddress = addrRaw ? String(addrRaw).trim() : '';

  logger.info(`[Institution] Looking for: "${institutionName}" in "${city}"`);
  logger.info(`[Institution] Has full address: ${hasFullAddress}`);

  if (hasFullAddress) {
    logger.info(`[Institution] Creating new institution with address`);

    // Check if institution already exists before creating
    const existingInstitution = await db.institution.findFirst({
      where: {
        name: {
          equals: institutionName,
          mode: 'insensitive',
        },
      },
    });

    if (existingInstitution) {
      logger.info(
        `[Institution] Found existing: "${existingInstitution.name}" (id: ${existingInstitution.id}), updating...`,
      );

      // Update address if provided
      logger.info(`[Institution] Parsing address: ${row['Adresse Etablissement']}`);
      const addressData = parseAddress(row['Adresse Etablissement']!.trim());

      // Update or create address
      let addressId = existingInstitution.address_id;
      if (addressId) {
        await db.address.update({
          where: { id: addressId },
          data: {
            street: addressData.street,
            zip_code: addressData.zipCode,
            city: addressData.city,
          },
        });
        logger.info(`[Institution] Updated address (id: ${addressId})`);
      } else {
        const newAddress = await db.address.create({
          data: {
            street: addressData.street,
            zip_code: addressData.zipCode,
            city: addressData.city,
          },
        });
        addressId = newAddress.id;
        logger.info(`[Institution] Created address (id: ${addressId})`);
      }

      // Update institution
      const types = row['Type de public']
        ? mapPublicCategory(row['Type de public'])
        : inferInstitutionType(institutionName);

      const updatedInstitution = await db.institution.update({
        where: { id: existingInstitution.id },
        data: {
          email: row['Mail établissement']?.trim() || null,
          address_id: addressId,
          type: types,
        },
      });

      logger.info(
        `[Institution] Updated: "${updatedInstitution.name}" (id: ${updatedInstitution.id})`,
      );
      return { id: updatedInstitution.id, isNew: false };
    }

    // Create new institution with address
    logger.info(`[Institution] Parsing address: ${row['Adresse Etablissement']}`);
    const addressData = parseAddress(row['Adresse Etablissement']!.trim());

    const address = await db.address.create({
      data: {
        street: addressData.street,
        zip_code: addressData.zipCode,
        city: addressData.city,
      },
    });
    logger.info(`[Institution] Created address (id: ${address.id})`);

    const types = row['Type de public']
      ? mapPublicCategory(row['Type de public'])
      : inferInstitutionType(institutionName);

    const institution = await db.institution.create({
      data: {
        name: institutionName,
        email: row['Mail établissement']?.trim() || null,
        address_id: address.id,
        type: types,
      },
    });

    logger.info(`[Institution] Created: "${institution.name}" (id: ${institution.id})`);
    return { id: institution.id, isNew: true };
  } else {
    // Find existing institution by name
    logger.info(`[Institution] Searching by name (no address provided)`);

    const institution = await db.institution.findFirst({
      where: {
        name: {
          equals: institutionName,
          mode: 'insensitive',
        },
      },
    });

    if (institution) {
      logger.info(
        `[Institution] Found by exact name: "${institution.name}" (id: ${institution.id})`,
      );

      // Only update if new data is provided (#10)
      const newEmail = row['Mail établissement']?.trim() || null;
      const types = row['Type de public']
        ? mapPublicCategory(row['Type de public'])
        : inferInstitutionType(institutionName);

      const emailChanged = newEmail && newEmail !== institution.email;
      const typeChanged = JSON.stringify(types) !== JSON.stringify(institution.type);

      if (emailChanged || typeChanged) {
        const updateData: Record<string, unknown> = {};
        if (emailChanged) updateData.email = newEmail;
        if (typeChanged) updateData.type = types;

        const updatedInstitution = await db.institution.update({
          where: { id: institution.id },
          data: updateData,
        });
        logger.info(
          `[Institution] Updated: "${updatedInstitution.name}" (id: ${updatedInstitution.id})`,
        );
      } else {
        logger.info(`[Institution] No changes needed, skipping update`);
      }

      return { id: institution.id, isNew: false };
    }

    // No exact match found - throw error (fuzzy matching removed)
    logger.error(
      `[Institution] NOT FOUND: "${institutionName}" in "${city}". Exact match required.`,
    );
    throw new Error(
      `Institution not found: ${institutionName} (city: ${city}). An exact name match is required. Please check the spelling and try again.`,
    );
  }
}

// Find or create user
export async function findOrCreateUser(
  row: ExcelRow,
  sendEmails: boolean,
  tx?: TransactionClient,
): Promise<{ id: string; email: string; plainPassword: string; isNew: boolean }> {
  // Use transaction client if provided, otherwise use global prisma client
  const db = tx || prisma;

  // Safe email extraction
  const emailRaw = row.Mail;
  const email = emailRaw ? String(emailRaw).trim() : '';

  // Safe name extraction
  const firstNameRaw = row['Prénom référent'];
  const firstName = firstNameRaw ? String(firstNameRaw).trim() : null;
  const lastNameRaw = row['Nom référent'];
  const lastName = lastNameRaw ? String(lastNameRaw).trim() : undefined;

  logger.info(`[User] Looking for: "${email}" (${firstName || ''} ${lastName})`);

  let user = await db.user.findUnique({
    where: { email },
  });

  if (user) {
    // Update existing user with new data (only if new values are provided)
    logger.info(`[User] Updating existing: "${email}" (id: ${user.id})`);

    if (firstName !== null || lastName !== undefined) {
      const updateData: {
        first_name?: string | null;
        last_name?: string;
      } = {};
      if (firstName !== null) updateData.first_name = firstName;
      if (lastName !== undefined) updateData.last_name = lastName;

      user = await db.user.update({
        where: { id: user.id },
        data: updateData,
      });
    }

    logger.info(`[User] Updated: "${email}" (id: ${user.id})`);
    return { id: user.id, email: user.email, plainPassword: '', isNew: false };
  }

  logger.info(`[User] Creating new user: "${email}"`);

  // Create new user
  const plainPassword = generateSecurePassword();
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  user = await db.user.create({
    data: {
      email,
      password: hashedPassword,
      first_name: firstName || null,
      last_name: lastName || 'Utilisateur', // Fallback for required field
      email_verification_token: null, // Pre-verified account (no token = verified)
      email_verification_expires: null,
      role: Role.USER,
      need_welcome_email: !sendEmails, // Mark as needing email if not sending now
    },
  });

  logger.info(`[User] Created: "${email}" (id: ${user.id})`);
  return { id: user.id, email: user.email, plainPassword, isNew: true };
}

// Find event by title and date
export async function findEvent(
  title: string,
  date: Date,
  tx?: TransactionClient,
): Promise<string> {
  // Use transaction client if provided, otherwise use global prisma client
  const db = tx || prisma;

  logger.info(`[Event] Looking for: "${title}" on ${date.toISOString().split('T')[0]}`);

  const events = await db.event.findMany({
    where: {
      title: {
        equals: title,
        mode: 'insensitive',
      },
    },
  });

  logger.info(`[Event] Found ${events.length} events with exact title "${title}"`);

  if (events.length === 0) {
    logger.error(`[Event] NOT FOUND: "${title}"`);
    throw new Error(`Event not found: ${title}`);
  }

  // Find event with matching date (compare UTC date components to avoid timezone issues)
  const searchDateUTC = new Date(date);
  const searchYear = searchDateUTC.getUTCFullYear();
  const searchMonth = searchDateUTC.getUTCMonth();
  const searchDay = searchDateUTC.getUTCDate();

  const matchingEvent = events.find((event: import('@/app/generated/prisma').Event) => {
    return event.event_dates.some((eventDate: Date) => {
      const ed = new Date(eventDate);
      return (
        ed.getUTCFullYear() === searchYear &&
        ed.getUTCMonth() === searchMonth &&
        ed.getUTCDate() === searchDay
      );
    });
  });

  if (matchingEvent) {
    logger.info(
      `[Event] Matched by date: "${matchingEvent.title}" (id: ${matchingEvent.id}) on ${matchingEvent.event_dates.join(', ')}`,
    );
    return matchingEvent.id;
  }

  // No exact date match found - throw error (fallback removed)
  logger.error(
    `[Event] NO DATE MATCH: "${title}" for ${date.toISOString().split('T')[0]}. Events found: ${events.map((e) => `"${e.title}" on ${e.event_dates.map((d) => d.toISOString().split('T')[0]).join(', ')}`).join('; ')}`,
  );
  throw new Error(
    `Event date not found: "${title}" has no date matching ${date.toISOString().split('T')[0]}. Available dates: ${events.flatMap((e) => e.event_dates.map((d) => d.toISOString().split('T')[0])).join(', ')}`,
  );
}

// Link user to institution
export async function linkUserToInstitution(
  userId: string,
  institutionId: string,
  tx?: TransactionClient,
): Promise<void> {
  // Use transaction client if provided, otherwise use global prisma client
  const db = tx || prisma;

  const existingLink = await db.userInstitution.findUnique({
    where: {
      user_id_institution_id: {
        user_id: userId,
        institution_id: institutionId,
      },
    },
  });

  if (existingLink) {
    logger.info(
      `[Link] User-Institution link already exists (user_id: ${userId}, institution_id: ${institutionId})`,
    );
  } else {
    await db.userInstitution.create({
      data: {
        user_id: userId,
        institution_id: institutionId,
      },
    });
    logger.info(
      `[Link] Created User-Institution link (user_id: ${userId}, institution_id: ${institutionId})`,
    );
  }
}

// Send welcome email with password reset link (used for both new and existing users)
export async function sendWelcomeEmailWithResetLink(
  email: string,
  firstName: string | null,
  lastName: string,
  registrationCount: number,
): Promise<void> {
  const salutation = firstName ? `Cher ${firstName} ${lastName},` : `Cher ${lastName},`;

  // Generate password reset token
  const { generateEmailVerificationToken } = await import('@/lib/notifications/emailService');
  const resetToken = generateEmailVerificationToken();
  const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Get user and store reset token in database
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  await prisma.passwordResetToken.create({
    data: {
      token: resetToken,
      userId: user.id,
      expiresAt: resetExpiry,
    },
  });

  const resetUrl = `${process.env.APP_URL}/auth/reset-password?token=${resetToken}`;

  await sendEmail({
    to: email,
    template_id: '8539404',
    template_data: {
      salutation,
      email,
      reset_url: resetUrl,
      registration_count: registrationCount,
    },
  });
}

// Map import status to RegistrationStatus
export function mapImportStatus(status: 'PRESENT' | 'ABSENT'): RegistrationStatus {
  const result = status === 'PRESENT' ? RegistrationStatus.ATTENDED : RegistrationStatus.NO_SHOW;
  logger.info(`[Status] Mapped "${status}" -> ${result}`);
  return result;
}

// Parse Excel file into cleaned ExcelRow array (shared between preview and import)
export async function parseExcelFile(fileBuffer: Buffer): Promise<ExcelRow[]> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(fileBuffer as any);
  logger.info(
    'Workbook sheets:',
    workbook.worksheets.map((ws) => ws.name),
  );

  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }

  // Extract headers from first row
  const headers: string[] = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const text = cell.text;
    headers[colNumber - 1] = text ? text.trim() : '';
  });

  // Read data rows
  const rawData: ExcelRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row

    const excelRow: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        const value = cell.value;
        excelRow[header] = value instanceof Date ? value : cell.text;
      }
    });

    if (Object.keys(excelRow).length > 0) {
      rawData.push(excelRow as unknown as ExcelRow);
    }
  });

  logger.info('Raw data rows:', rawData.length);

  // Trim column names to handle trailing/leading spaces in Excel headers
  // Also apply column aliases for known variants
  const COLUMN_ALIASES: Record<string, string> = {
    Spectacle: 'Nom spectacle',
    'Nom du spectacle': 'Nom spectacle',
    'Titre spectacle': 'Nom spectacle',
    'École / Association': 'Ecole / Association',
    'Ecole/Association': 'Ecole / Association',
    Etablissement: 'Ecole / Association',
    Établissement: 'Ecole / Association',
    Adresse: 'Adresse Etablissement',
    'Adresse établissement': 'Adresse Etablissement',
    'Mail Etablissement': 'Mail établissement',
    'Mail etablissement': 'Mail établissement',
    Email: 'Mail',
    'Email référent': 'Mail',
    Nom: 'Nom référent',
    Prénom: 'Prénom référent',
    'Type de Public': 'Type de public',
    'Type Public': 'Type de public',
    Public: 'Type de public',
  };

  const cleanedData = rawData.map((row) => {
    const cleanedRow = {} as Record<string, unknown>;
    for (const [key, value] of Object.entries(row as unknown as Record<string, unknown>)) {
      const trimmedKey = key.trim();
      const normalizedKey = COLUMN_ALIASES[trimmedKey] || trimmedKey;
      cleanedRow[normalizedKey] = value;
    }
    return cleanedRow as unknown as ExcelRow;
  });

  return cleanedData;
}

// Preview import: parse and resolve all entities without writing to DB
export async function previewImport(fileBuffer: Buffer): Promise<PreviewResult> {
  logger.info('=== Starting preview ===');

  const cleanedData = await parseExcelFile(fileBuffer);

  // Preload all entities upfront to avoid N+1 queries (#9)
  const [allInstitutions, allUsers, allEvents, allRegistrations] = await Promise.all([
    prisma.institution.findMany({ include: { address: true } }),
    prisma.user.findMany({ select: { id: true, email: true, first_name: true, last_name: true } }),
    prisma.event.findMany({ select: { id: true, title: true, event_dates: true } }),
    prisma.registration.findMany({ select: { user_id: true, event_id: true, date: true } }),
  ]);

  // Build registration lookup set for duplicate detection (key = "userId|eventId|dateISO")
  // Use getDateKey for timezone-safe date comparison
  const existingRegistrationKeys = new Set(
    allRegistrations.map((r) => {
      const dateKey = getDateKey(r.date);
      return `${r.user_id}|${r.event_id}|${dateKey}`;
    }),
  );

  // Build a Set of user IDs that have registrations (for deduplication priority)
  const userIdsWithRegistrations = new Set(allRegistrations.map((r) => r.user_id));

  // Build lookup maps - handle duplicate emails (case-insensitive)
  // If multiple users share the same email (case-insensitive), prefer the one with existing registrations
  const usersByEmail = new Map<string, (typeof allUsers)[0]>();
  const duplicateEmailGroups = new Map<string, string[]>(); // Track all user IDs for each email

  for (const user of allUsers) {
    const lowerEmail = user.email.toLowerCase();
    const existing = usersByEmail.get(lowerEmail);

    // Track all user IDs for this email (for duplicate checking)
    if (!duplicateEmailGroups.has(lowerEmail)) {
      duplicateEmailGroups.set(lowerEmail, []);
    }
    duplicateEmailGroups.get(lowerEmail)!.push(user.id);

    if (!existing) {
      usersByEmail.set(lowerEmail, user);
    } else if (
      userIdsWithRegistrations.has(user.id) &&
      !userIdsWithRegistrations.has(existing.id)
    ) {
      // Replace with user that has registrations
      usersByEmail.set(lowerEmail, user);
    }
    // If both have registrations or neither has, keep the first one found
  }

  // Use Sets for unique entity counting (#3)
  const uniqueNewEmails = new Set<string>();
  const uniqueExistingEmails = new Set<string>();
  const uniqueNewInstitutions = new Set<string>();
  const uniqueExistingInstitutions = new Set<string>();
  const uniqueEventsFound = new Set<string>();
  const uniqueEventsNotFound = new Set<string>();

  const previewResult: PreviewResult = {
    totalRows: cleanedData.length,
    validRows: 0,
    invalidRows: 0,
    duplicateRows: 0,
    newUsers: 0,
    existingUsers: 0,
    newInstitutions: 0,
    existingInstitutions: 0,
    eventsFound: 0,
    eventsNotFound: 0,
    totalSeats: 0,
    rows: [],
  };

  for (const [index, row] of cleanedData.entries()) {
    const previewRow: PreviewRow = {
      rowIndex: index,
      raw: {
        institution: row['Ecole / Association'] ? String(row['Ecole / Association']).trim() : '',
        city: row.Ville ? String(row.Ville).trim() : '',
        address: row['Adresse Etablissement']
          ? String(row['Adresse Etablissement']).trim()
          : undefined,
        institutionEmail: row['Mail établissement']
          ? String(row['Mail établissement']).trim()
          : undefined,
        publicType: row['Type de public'] ? String(row['Type de public']).trim() : undefined,
        referentLastName: row['Nom référent'] ? String(row['Nom référent']).trim() : '',
        referentFirstName: row['Prénom référent'] ? String(row['Prénom référent']).trim() : '',
        email: row.Mail ? String(row.Mail).trim() : '',
        eventTitle: row['Nom spectacle'] ? String(row['Nom spectacle']).trim() : '',
        eventDate: '',
        seats: parseInt(String(row.Effectifs || '0'), 10) || 0,
      },
      institutionStatus: 'error',
      institutionName: String(row['Ecole / Association'] || '').trim(),
      userStatus: 'new',
      eventStatus: 'not_found',
      canImport: true,
    };

    // Parse date for raw display
    let displayDate = '';
    const eventDateValue = row['Date de venue'];
    if (Object.prototype.toString.call(eventDateValue) === '[object Date]') {
      displayDate = (eventDateValue as unknown as Date).toLocaleDateString('fr-FR');
    } else {
      displayDate = String(eventDateValue || '');
    }
    previewRow.raw.eventDate = displayDate;

    try {
      // Validate required fields (#4: also check for empty strings)
      const emailValue = row.Mail ? String(row.Mail).trim() : '';
      if (!row['Ecole / Association'] || !row['Nom spectacle']) {
        throw new Error('Champs requis manquants (Ecole/Association ou Nom spectacle)');
      }
      if (!emailValue) {
        throw new Error('Email du référent manquant ou vide');
      }
      if (!emailValue.includes('@') || !emailValue.includes('.')) {
        throw new Error(`Format d'email invalide : "${emailValue}"`);
      }

      // Warn if seats is 0 (#5)
      if (previewRow.raw.seats <= 0) {
        previewRow.error = 'Effectifs à 0 — aucune place ne sera réservée';
      }

      // --- Check institution ---
      const institutionName = String(row['Ecole / Association']).trim();
      const cityRaw = row.Ville;
      const city = cityRaw ? String(cityRaw).trim() : '';
      const addrRaw = row['Adresse Etablissement'];
      const hasFullAddress = addrRaw ? String(addrRaw).trim() : '';

      // Try exact match first (in-memory) (#9)
      const institution = allInstitutions.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (inst: any) => inst.name.toLowerCase() === institutionName.toLowerCase(),
      );

      if (institution) {
        previewRow.institutionStatus = 'existing';
        previewRow.institutionName = institution.name;
        previewRow.institutionId = institution.id;
        uniqueExistingInstitutions.add(institution.id);
      } else if (hasFullAddress) {
        // Will be created during import
        previewRow.institutionStatus = 'new';
        previewRow.institutionName = institutionName;
        uniqueNewInstitutions.add(institutionName.toLowerCase());
      } else {
        // No exact match found - error (fuzzy matching removed)
        previewRow.institutionStatus = 'error';
        previewRow.error =
          (previewRow.error ? previewRow.error + ' | ' : '') +
          `Établissement introuvable : "${institutionName}" (ville: ${city}). Le nom exact est requis. L'adresse complète est requise pour créer un nouvel établissement.`;
        previewRow.canImport = false;
      }

      // --- Check user (using preloaded data) (#9) ---
      const existingUser = usersByEmail.get(emailValue.toLowerCase());

      if (existingUser) {
        previewRow.userStatus = 'existing';
        previewRow.userId = existingUser.id;
        previewRow.userFullName = [existingUser.first_name, existingUser.last_name]
          .filter(Boolean)
          .join(' ');
        uniqueExistingEmails.add(emailValue.toLowerCase());
      } else {
        previewRow.userStatus = 'new';
        uniqueNewEmails.add(emailValue.toLowerCase());
      }

      // --- Check event (using preloaded data) (#9) ---
      let parsedEventDate: Date | null = null;
      let matchingEvents: typeof allEvents = []; // Store for duplicate check later
      try {
        parsedEventDate = parseFrenchDate(row['Date de venue']);
        const eventTitle = String(row['Nom spectacle']).trim();

        // Filter events by exact title match (in-memory)
        matchingEvents = allEvents.filter(
          (e) => e.title.toLowerCase() === eventTitle.toLowerCase(),
        );

        if (matchingEvents.length === 0) {
          previewRow.eventStatus = 'not_found';
          previewRow.error =
            (previewRow.error ? previewRow.error + ' | ' : '') +
            `Événement introuvable : "${eventTitle}". Le nom exact est requis.`;
          previewRow.canImport = false;
          uniqueEventsNotFound.add(eventTitle.toLowerCase());
        } else {
          // Find event with matching date (compare UTC date components)
          const searchYear = parsedEventDate!.getUTCFullYear();
          const searchMonth = parsedEventDate!.getUTCMonth();
          const searchDay = parsedEventDate!.getUTCDate();

          const matchingEvent = matchingEvents.find((event) => {
            return event.event_dates.some((ed: Date) => {
              const d = new Date(ed);
              return (
                d.getUTCFullYear() === searchYear &&
                d.getUTCMonth() === searchMonth &&
                d.getUTCDate() === searchDay
              );
            });
          });

          if (!matchingEvent) {
            // No exact date match found - error (fallback removed)
            const availableDates = matchingEvents.flatMap((e) =>
              e.event_dates.map((d: Date) => new Date(d).toLocaleDateString('fr-FR')),
            );
            previewRow.eventStatus = 'not_found';
            previewRow.error =
              (previewRow.error ? previewRow.error + ' | ' : '') +
              `Date non trouvée pour "${eventTitle}". La date exacte est requise. Dates disponibles : ${availableDates.join(', ')}`;
            previewRow.canImport = false;
            uniqueEventsNotFound.add(eventTitle.toLowerCase());
          } else {
            previewRow.eventStatus = 'found';
            previewRow.eventId = matchingEvent.id;
            previewRow.eventName = matchingEvent.title;
            previewRow.eventDates = matchingEvent.event_dates.map((d: Date) =>
              new Date(d).toLocaleDateString('fr-FR'),
            );
            uniqueEventsFound.add(matchingEvent.id);
          }
        }
      } catch (dateError) {
        const msg = (dateError as Error).message;
        previewRow.error =
          (previewRow.error ? previewRow.error + ' | ' : '') + `Erreur de date : ${msg}`;
        previewRow.canImport = false;
        uniqueEventsNotFound.add(
          /* c8 ignore next - Defensive fallback: validation ensures 'Nom spectacle' is truthy */
          String(row['Nom spectacle'] || '').toLowerCase(),
        );
      }
      // --- Check for duplicate registration ---
      if (previewRow.canImport && previewRow.userId && previewRow.eventId && parsedEventDate) {
        const dateKey = getDateKey(parsedEventDate);
        const regKey = `${previewRow.userId}|${previewRow.eventId}|${dateKey}`;

        // Check for duplicate with the resolved event
        if (existingRegistrationKeys.has(regKey)) {
          previewRow.isDuplicate = true;
          previewRow.canImport = false;
          previewRow.error =
            /* c8 ignore next - Defensive fallback: unreachable case with no prior errors when duplicate found */
            (previewRow.error ? previewRow.error + ' | ' : '') +
            'Inscription déjà existante (même utilisateur, événement et date)';
          previewResult.duplicateRows++;
        } else {
          // Also check ALL other events with the same title and date
          // (handles case of duplicate events in database with same title/date)
          for (const otherEvent of matchingEvents) {
            if (otherEvent.id === previewRow.eventId) continue; // Skip already checked

            const hasMatchingDate = otherEvent.event_dates.some((ed: Date) => {
              const d = new Date(ed);
              const searchDate = new Date(parsedEventDate);
              return (
                d.getUTCFullYear() === searchDate.getUTCFullYear() &&
                d.getUTCMonth() === searchDate.getUTCMonth() &&
                d.getUTCDate() === searchDate.getUTCDate()
              );
            });

            if (hasMatchingDate) {
              const otherKey = `${previewRow.userId}|${otherEvent.id}|${dateKey}`;
              if (existingRegistrationKeys.has(otherKey)) {
                previewRow.isDuplicate = true;
                previewRow.canImport = false;
                previewRow.error =
                  (previewRow.error ? previewRow.error + ' | ' : '') +
                  'Inscription déjà existante (même utilisateur, événement et date)';
                previewResult.duplicateRows++;
                break;
              }
            }
          }

          // Also check ALL other user IDs with the same email
          // (handles case of duplicate users in database with same email)
          if (!previewRow.isDuplicate && previewRow.raw.email) {
            const emailLower = previewRow.raw.email.toLowerCase();
            const duplicateUserIds = duplicateEmailGroups.get(emailLower);
            if (duplicateUserIds && duplicateUserIds.length > 1) {
              for (const otherUserId of duplicateUserIds) {
                if (otherUserId === previewRow.userId) continue; // Skip already checked

                // Check with resolved event
                const otherUserKey = `${otherUserId}|${previewRow.eventId}|${dateKey}`;
                if (existingRegistrationKeys.has(otherUserKey)) {
                  previewRow.isDuplicate = true;
                  previewRow.canImport = false;
                  previewRow.error =
                    (previewRow.error ? previewRow.error + ' | ' : '') +
                    'Inscription déjà existante (même utilisateur, événement et date)';
                  previewResult.duplicateRows++;
                  break;
                }

                // Check with other matching events
                for (const otherEvent of matchingEvents) {
                  if (otherEvent.id === previewRow.eventId) continue;

                  const hasMatchingDate = otherEvent.event_dates.some((ed: Date) => {
                    const d = new Date(ed);
                    const searchDate = new Date(parsedEventDate);
                    return (
                      d.getUTCFullYear() === searchDate.getUTCFullYear() &&
                      d.getUTCMonth() === searchDate.getUTCMonth() &&
                      d.getUTCDate() === searchDate.getUTCDate()
                    );
                  });

                  if (hasMatchingDate) {
                    const otherEventKey = `${otherUserId}|${otherEvent.id}|${dateKey}`;
                    if (existingRegistrationKeys.has(otherEventKey)) {
                      previewRow.isDuplicate = true;
                      previewRow.canImport = false;
                      previewRow.error =
                        (previewRow.error ? previewRow.error + ' | ' : '') +
                        'Inscription déjà existante (même utilisateur, événement et date)';
                      previewResult.duplicateRows++;
                      break;
                    }
                  }
                }
                if (previewRow.isDuplicate) break;
              }
            }
          }
        }
      }

      // Accumulate seats for valid rows
      if (previewRow.canImport) {
        previewResult.totalSeats += previewRow.raw.seats;
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      previewRow.error = errorMessage;
      previewRow.canImport = false;
    }

    if (previewRow.canImport) {
      previewResult.validRows++;
    } else {
      previewResult.invalidRows++;
    }

    previewResult.rows.push(previewRow);
  }

  // Set unique counts (#3)
  previewResult.newUsers = uniqueNewEmails.size;
  previewResult.existingUsers = uniqueExistingEmails.size;
  previewResult.newInstitutions = uniqueNewInstitutions.size;
  previewResult.existingInstitutions = uniqueExistingInstitutions.size;
  previewResult.eventsFound = uniqueEventsFound.size;
  previewResult.eventsNotFound = uniqueEventsNotFound.size;

  logger.info(`=== Preview completed ===`);
  logger.info(
    `Total: ${previewResult.totalRows}, Valid: ${previewResult.validRows}, Invalid: ${previewResult.invalidRows}`,
  );
  logger.info(
    `New users: ${previewResult.newUsers} unique, Existing users: ${previewResult.existingUsers} unique`,
  );
  logger.info(
    `New institutions: ${previewResult.newInstitutions} unique, Existing institutions: ${previewResult.existingInstitutions} unique`,
  );
  logger.info(
    `Events found: ${previewResult.eventsFound} unique, Not found: ${previewResult.eventsNotFound} unique`,
  );

  return previewResult;
}

// Main import function
export async function importExistingRegistrations(
  fileBuffer: Buffer,
  options: ImportOptions = { sendEmails: true, defaultStatus: 'PRESENT' },
): Promise<ImportResult> {
  const result: ImportResult = {
    totalRows: 0,
    processed: 0,
    errors: [],
    createdUsers: 0,
    createdInstitutions: 0,
    createdRegistrations: 0,
    emailsSent: 0,
  };

  try {
    logger.info('=== Starting import ===');
    logger.info('Options:', options);
    logger.info('Buffer size:', fileBuffer.length, 'bytes');

    const cleanedData = await parseExcelFile(fileBuffer);

    // Filter by selectedRows if provided
    const dataToProcess = options.selectedRows
      ? cleanedData.filter((_, index) => options.selectedRows!.includes(index))
      : cleanedData;

    result.totalRows = dataToProcess.length;
    const processedUsers = new Map<string, { password: string; count: number }>();

    // Log first row columns for debugging
    if (dataToProcess.length > 0) {
      const firstRowColumns = Object.keys(dataToProcess[0] as unknown as Record<string, unknown>);
      logger.info('Columns found in file:', firstRowColumns);

      // Log first row data for debugging
      const firstRow = dataToProcess[0] as unknown as Record<string, unknown>;
      logger.info('First row data:', firstRow);
    }

    logger.info(`=== Processing ${dataToProcess.length} rows ===`);

    for (const [index, row] of dataToProcess.entries()) {
      try {
        logger.info(`--- Row ${index + 1}/${dataToProcess.length} ---`);
        logger.info(`Institution: "${row['Ecole / Association']}"`);
        logger.info(`City: "${row.Ville}"`);
        logger.info(`Email: "${row.Mail}"`);
        logger.info(`Event: "${row['Nom spectacle']}"`);
        logger.info(`Date: "${row['Date de venue']}"`);
        logger.info(`Seats: "${row.Effectifs}"`);

        // Validate required fields (#4: also check empty email)
        const emailValue = row.Mail ? String(row.Mail).trim() : '';
        if (!row['Ecole / Association'] || !row['Nom spectacle']) {
          throw new Error('Champs requis manquants (Ecole/Association ou Nom spectacle)');
        }
        if (!emailValue || !emailValue.includes('@')) {
          throw new Error(`Email invalide ou manquant : "${emailValue}"`);
        }

        // Wrap each row in a transaction with increased timeout (#8)
        await prisma.$transaction(
          async (tx) => {
            // Find or create institution
            const { id: institutionId, isNew: isNewInstitution } = await findOrCreateInstitution(
              row,
              tx,
            );
            if (isNewInstitution) {
              result.createdInstitutions++;
            }

            // Find or create user
            const {
              id: userId,
              email,
              plainPassword,
              isNew: isNewUser,
            } = await findOrCreateUser(row, options.sendEmails, tx);
            if (isNewUser) {
              result.createdUsers++;
              processedUsers.set(email, { password: plainPassword, count: 0 });
            }

            // Link user to institution
            await linkUserToInstitution(userId, institutionId, tx);

            // Find event
            const eventDate = parseFrenchDate(row['Date de venue']);
            const eventId = await findEvent(row['Nom spectacle'], eventDate, tx);

            const registrationData = {
              user_id: userId,
              institution_id: institutionId,
              event_id: eventId,
              date: eventDate,
              manager_first_name: row['Prénom référent']
                ? String(row['Prénom référent']).trim()
                : /* c8 ignore next - Defensive fallback: null for missing first name */ null,
              manager_last_name: row['Nom référent']
                ? String(row['Nom référent']).trim()
                : /* c8 ignore next - Defensive fallback: empty string for missing last name */ '',
              manager_email: String(row.Mail || '').trim(),
              /* c8 ignore next - Defensive fallback: null for missing booked seats */
              booked_seats: parseInt(String(row.Effectifs || '0'), 10) || 0,
              status: mapImportStatus(options.defaultStatus),
            };

            logger.info(
              `[Registration] Creating: user_id=${userId}, event_id=${eventId}, date=${eventDate.toISOString().split('T')[0]}`,
            );

            // Check for existing registration to prevent duplicates (#1)
            // Use date range to handle timezone differences (existing dates may be stored at various UTC times)
            const dateKey = getDateKey(eventDate);
            const dayStart = new Date(`${dateKey}T00:00:00.000Z`);
            const dayEnd = new Date(`${dateKey}T23:59:59.999Z`);

            const existingRegistration = await tx.registration.findFirst({
              where: {
                user_id: userId,
                event_id: eventId,
                date: {
                  gte: dayStart,
                  lte: dayEnd,
                },
              },
            });

            if (existingRegistration) {
              logger.info(
                `[Registration] Duplicate found (id: ${existingRegistration.id}), skipping`,
              );
              return; // Skip this row — already imported
            }

            // Create new registration
            await tx.registration.create({
              data: registrationData,
            });

            result.createdRegistrations++;
            logger.info(`[Registration] Created successfully`);

            // Track registration count for email
            const userTracking = processedUsers.get(email);
            if (userTracking) {
              userTracking.count++;
            }
          },
          { timeout: 30000 },
        ); // 30 second timeout (#8)

        result.processed++;
        logger.info(`--- Row ${index + 1} completed successfully ---`);
      } catch (error) {
        const errorMessage = (error as Error).message;
        result.errors.push(`Row ${index + 1}: ${errorMessage}`);
        logger.error(`--- Row ${index + 1} FAILED: ${errorMessage} ---`);
      }
    }

    logger.info(`=== Processing completed ===`);
    logger.info(`Processed: ${result.processed}/${result.totalRows}`);
    logger.info(`Created institutions: ${result.createdInstitutions}`);
    logger.info(`Created users: ${result.createdUsers}`);
    logger.info(`Created registrations: ${result.createdRegistrations}`);
    logger.info(`Errors: ${result.errors.length}`);

    // Send emails to new users AND existing users with need_welcome_email flag
    if (options.sendEmails) {
      logger.info(`=== Sending emails ===`);

      // 1. Get existing users with need_welcome_email: true who have registrations
      const usersNeedingEmail = await prisma.user.findMany({
        where: {
          need_welcome_email: true,
          registrations: {
            some: {}, // Has at least one registration
          },
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          _count: {
            select: { registrations: true },
          },
        },
      });

      logger.info(`Existing users needing email: ${usersNeedingEmail.length}`);

      // 2. Combine with newly created users (only those with registrations)
      const usersToEmail = new Map<
        string,
        { password: string; count: number; isNew: boolean; userId: string }
      >();

      // Add existing users
      for (const user of usersNeedingEmail) {
        usersToEmail.set(user.email, {
          password: '',
          count: user._count.registrations,
          isNew: false,
          userId: user.id,
        });
      }

      // Add newly created users (only those with registrations created in this import)
      for (const [email, data] of processedUsers.entries()) {
        if (data.count > 0) {
          const existing = usersToEmail.get(email);
          if (existing) {
            // User was already in the list (existing user), update with new password if newly created
            if (!existing.isNew) {
              logger.info(
                `[Email] Existing user ${email} also has new registrations in this import`,
              );
            }
          } else {
            usersToEmail.set(email, { ...data, isNew: true, userId: '' });
          }
        }
      }

      logger.info(`Total unique users to email: ${usersToEmail.size}`);
      logger.info(
        `New users: ${[...usersToEmail.values()].filter((u) => u.isNew).length}, Existing users: ${
          [...usersToEmail.values()].filter((u) => !u.isNew).length
        }`,
      );

      // 3. Send emails
      for (const [email, { count }] of usersToEmail.entries()) {
        try {
          logger.info(`[Email] Sending to ${email} (${count} registrations)...`);
          const user = await prisma.user.findUnique({
            where: { email },
            select: { first_name: true, last_name: true },
          });

          if (user) {
            // Send welcome email with password reset link (same for all users)
            await sendWelcomeEmailWithResetLink(email, user.first_name, user.last_name, count);

            // Mark as sent
            await prisma.user.update({
              where: { email },
              data: { need_welcome_email: false },
            });

            result.emailsSent++;
            logger.info(`[Email] Sent successfully to ${email}`);
          }
        } catch (error) {
          const errorMessage = (error as Error).message;
          result.errors.push(`Email failed for ${email}: ${errorMessage}`);
          logger.error(`[Email] Failed for ${email}: ${errorMessage}`);
        }
      }
    } else {
      logger.info('=== Email sending disabled ===');
    }

    logger.info('=== Import completed ===');
    logger.info('Final result:', result);
    return result;
  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.error('=== Import FAILED ===');
    logger.error('Error:', errorMessage);
    result.errors.push(`Import failed: ${errorMessage}`);
    throw error;
  }
}
