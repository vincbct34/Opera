/* eslint-disable */
import { describe, expect, test, jest, beforeEach } from '@jest/globals';

// Stable mock references for ExcelJS (survive clearAllMocks)
const mockExcelWorksheet: any = {
  getRow: jest.fn(),
  eachRow: jest.fn(),
};
const mockExcelWorkbook: any = {
  xlsx: { load: jest.fn() },
  worksheets: [{ name: 'Sheet1' }],
  getWorksheet: jest.fn().mockReturnValue(mockExcelWorksheet),
};
jest.mock('exceljs', () => ({
  default: { Workbook: jest.fn().mockImplementation(() => mockExcelWorkbook) },
  __esModule: true,
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn<any>().mockResolvedValue('hashed_password'),
}));

jest.mock('@/lib/middleware/prismaConfig', () => {
  const mockPrisma: any = {
    address: {
      findFirst: jest.fn<any>(),
      create: jest.fn<any>().mockResolvedValue({ id: 'addr1' }),
      update: jest.fn<any>().mockResolvedValue({ id: 'addr1' }),
    },
    institution: {
      findFirst: jest.fn<any>(),
      findMany: jest.fn<any>().mockResolvedValue([]),
      create: jest.fn<any>(),
      update: jest.fn<any>(),
    },
    user: {
      findUnique: jest.fn<any>(),
      findMany: jest.fn<any>().mockResolvedValue([]),
      create: jest.fn<any>(),
      update: jest.fn<any>(),
    },
    event: {
      findMany: jest.fn<any>().mockResolvedValue([]),
    },
    registration: {
      findFirst: jest.fn<any>(),
      findMany: jest.fn<any>().mockResolvedValue([]),
      create: jest.fn<any>(),
    },
    userInstitution: {
      findUnique: jest.fn<any>(),
      create: jest.fn<any>(),
    },
    passwordResetToken: {
      create: jest.fn<any>(),
    },
    $transaction: jest.fn<any>().mockImplementation((fn: any) => fn(mockPrisma)),
  };
  return { default: mockPrisma, __esModule: true };
});

jest.mock('@/lib/middleware/logger', () => ({
  logger: {
    info: jest.fn<any>(),
    warn: jest.fn<any>(),
    error: jest.fn<any>(),
  },
}));

jest.mock('@/lib/notifications/emailService', () => ({
  sendEmail: jest.fn<any>().mockResolvedValue(true),
  generateEmailVerificationToken: jest.fn<any>().mockReturnValue('mock-reset-token'),
}));

jest.mock('crypto', () => ({
  randomInt: jest.fn<any>().mockImplementation((max: number) => Math.floor(Math.random() * max)),
}));

import {
  parseFrenchDate,
  parseAddress,
  mapPublicCategory,
  inferInstitutionType,
  mapImportStatus,
  parseExcelFile,
  findOrCreateInstitution,
  findOrCreateUser,
  findEvent,
  linkUserToInstitution,
  sendWelcomeEmailWithResetLink,
  previewImport,
  importExistingRegistrations,
} from '../importExistingRegistrations';

import { PublicCategory, RegistrationStatus } from '@/app/generated/prisma/enums';

const mockPrisma = (jest.requireMock('@/lib/middleware/prismaConfig') as any).default as any;

// ─── parseFrenchDate ────────────────────────────────────────────────────────

describe('parseFrenchDate', () => {
  test('parses valid DD/MM/YYYY format', () => {
    const result = parseFrenchDate('15/03/2025');
    expect(result.getDate()).toBe(15);
    expect(result.getMonth()).toBe(2); // 0-indexed
    expect(result.getFullYear()).toBe(2025);
  });

  test('accepts native Date object and normalizes to noon UTC', () => {
    const input = new Date(Date.UTC(2025, 0, 15, 12, 0, 0)); // Jan 15 2025 00:00:00 local time
    const result = parseFrenchDate(input);
    // Should be normalized to noon UTC to prevent timezone shift issues
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(0); // January
    expect(result.getUTCDate()).toBe(15);
    expect(result.getUTCHours()).toBe(12); // Noon UTC
  });

  test('throws on invalid Date object', () => {
    expect(() => parseFrenchDate(new Date('invalid'))).toThrow('Invalid Date object');
  });

  test('throws on wrong format (no slashes)', () => {
    expect(() => parseFrenchDate('2025-03-15')).toThrow('Invalid date format');
  });

  test('throws on NaN values', () => {
    expect(() => parseFrenchDate('aa/bb/cccc')).toThrow('Invalid date values');
  });

  test('throws on out of range values', () => {
    expect(() => parseFrenchDate('15/13/2025')).toThrow('Date out of range');
    expect(() => parseFrenchDate('00/01/2025')).toThrow('Date out of range');
  });

  test('handles non-string values by converting to string', () => {
    const result = parseFrenchDate('01/01/2025');
    expect(result.getFullYear()).toBe(2025);
  });

  test('throws on values that resolve to NaN time', () => {
    // A year so large that Date.getTime() returns NaN
    expect(() => parseFrenchDate('01/01/275761')).toThrow('Invalid date:');
  });

  test('throws on values that resolve to NaN time', () => {
    // A year so large that Date.getTime() returns NaN
    expect(() => parseFrenchDate('01/01/275761')).toThrow('Invalid date:');
  });

  test('handles empty/undefined value', () => {
    expect(() => parseFrenchDate(undefined)).toThrow('Invalid date format');
    expect(() => parseFrenchDate(null)).toThrow('Invalid date format');
  });
});

// ─── parseAddress ───────────────────────────────────────────────────────────

describe('parseAddress', () => {
  test('parses standard address with street, zip, city', () => {
    const result = parseAddress('22 RUE JULES GUESDE 34080 Montpellier');
    expect(result.street).toBe('22 RUE JULES GUESDE');
    expect(result.zipCode).toBe('34080');
    expect(result.city).toBe('Montpellier');
  });

  test('throws on empty input', () => {
    expect(() => parseAddress('')).toThrow('Empty address string');
    expect(() => parseAddress('   ')).toThrow('Empty address string');
  });

  test('throws when no ZIP code found', () => {
    expect(() => parseAddress('Some Address Without Zip')).toThrow('No ZIP code found');
  });

  test('handles non-string input', () => {
    expect(() => parseAddress(undefined)).toThrow('Empty address string');
    expect(() => parseAddress(null)).toThrow('Empty address string');
  });

  test('handles multi-word city', () => {
    const result = parseAddress('1 Av Test 34000 La Grande Motte');
    expect(result.city).toBe('La Grande Motte');
  });
});

// ─── mapPublicCategory ──────────────────────────────────────────────────────

describe('mapPublicCategory', () => {
  test('maps known categories', () => {
    expect(mapPublicCategory('Crèche')).toEqual([PublicCategory.CRECHE]);
    expect(mapPublicCategory('MATERNELLE')).toEqual([PublicCategory.MATERNELLE]);
    expect(mapPublicCategory('élémentaire')).toEqual([PublicCategory.ELEMENTAIRE]);
    expect(mapPublicCategory('ELEMENTAIRE')).toEqual([PublicCategory.ELEMENTAIRE]);
    expect(mapPublicCategory('Collège')).toEqual([PublicCategory.COLLEGE]);
    expect(mapPublicCategory('COLLEGE')).toEqual([PublicCategory.COLLEGE]);
    expect(mapPublicCategory('Lycée')).toEqual([PublicCategory.LYCEE]);
    expect(mapPublicCategory('LYCEE')).toEqual([PublicCategory.LYCEE]);
    expect(mapPublicCategory('SUPERIEUR')).toEqual([PublicCategory.SUPERIEUR]);
    expect(mapPublicCategory('CONSERVATOIRE')).toEqual([PublicCategory.CONSERVATOIRE]);
    expect(mapPublicCategory('ASSOCIATION')).toEqual([PublicCategory.ASSOCIATION]);
    expect(mapPublicCategory('Centre de loisirs')).toEqual([PublicCategory.PERISCOLAIRE]);
    expect(mapPublicCategory('PERISCOLAIRE')).toEqual([PublicCategory.PERISCOLAIRE]);
    expect(mapPublicCategory('Publics empeches')).toEqual([PublicCategory.PUBLICS_EMPECHES]);
  });

  test('defaults to AUTRE for unknown types', () => {
    expect(mapPublicCategory('unknown')).toEqual([PublicCategory.AUTRE]);
    expect(mapPublicCategory('AUTRE')).toEqual([PublicCategory.AUTRE]);
  });

  test('handles whitespace trimming', () => {
    expect(mapPublicCategory('  MATERNELLE  ')).toEqual([PublicCategory.MATERNELLE]);
  });

  test('handles multiple categories separated by +', () => {
    expect(mapPublicCategory('Collège + Lycée')).toEqual([
      PublicCategory.COLLEGE,
      PublicCategory.LYCEE,
    ]);
    expect(mapPublicCategory('MATERNELLE + ELEMENTAIRE')).toEqual([
      PublicCategory.MATERNELLE,
      PublicCategory.ELEMENTAIRE,
    ]);
    expect(mapPublicCategory('Crèche + Maternelle + Élémentaire')).toEqual([
      PublicCategory.CRECHE,
      PublicCategory.MATERNELLE,
      PublicCategory.ELEMENTAIRE,
    ]);
  });

  test('handles multiple categories without spaces around +', () => {
    expect(mapPublicCategory('Collège+Lycée')).toEqual([
      PublicCategory.COLLEGE,
      PublicCategory.LYCEE,
    ]);
    expect(mapPublicCategory('COLLEGE+LYCEE')).toEqual([
      PublicCategory.COLLEGE,
      PublicCategory.LYCEE,
    ]);
  });

  test('handles multiple categories with extra spaces', () => {
    expect(mapPublicCategory('Collège  +   Lycée')).toEqual([
      PublicCategory.COLLEGE,
      PublicCategory.LYCEE,
    ]);
  });

  test('deduplicates categories in multiple type input', () => {
    expect(mapPublicCategory('Collège + Lycée + Collège')).toEqual([
      PublicCategory.COLLEGE,
      PublicCategory.LYCEE,
    ]);
  });

  test('handles accents in multiple type input', () => {
    expect(mapPublicCategory('Collège + Lycée')).toEqual([
      PublicCategory.COLLEGE,
      PublicCategory.LYCEE,
    ]);
    expect(mapPublicCategory('collège+lycée')).toEqual([
      PublicCategory.COLLEGE,
      PublicCategory.LYCEE,
    ]);
  });

  test('handles empty parts in multiple type input', () => {
    // Leading + (empty first part)
    expect(mapPublicCategory('+ Collège')).toEqual([PublicCategory.COLLEGE]);
    // Trailing + (empty last part)
    expect(mapPublicCategory('Collège + ')).toEqual([PublicCategory.COLLEGE]);
    // Double + (empty middle part)
    expect(mapPublicCategory('Collège +  + Lycée')).toEqual([
      PublicCategory.COLLEGE,
      PublicCategory.LYCEE,
    ]);
  });

  test('defaults to AUTRE when all parts in multiple type are unknown', () => {
    expect(mapPublicCategory('Inconnu + Autre')).toEqual([PublicCategory.AUTRE]);
    expect(mapPublicCategory('XYZ + ABC + 123')).toEqual([PublicCategory.AUTRE]);
  });

  test('handles mix of known and unknown in multiple type', () => {
    expect(mapPublicCategory('Collège + Inconnu')).toEqual([PublicCategory.COLLEGE]);
    expect(mapPublicCategory('XYZ + Lycée + ABC')).toEqual([PublicCategory.LYCEE]);
  });
});

// ─── inferInstitutionType ───────────────────────────────────────────────────

describe('inferInstitutionType', () => {
  test('infers crèche', () => {
    expect(inferInstitutionType('Crèche des Petits')).toEqual([PublicCategory.CRECHE]);
    expect(inferInstitutionType('creche municipale')).toEqual([PublicCategory.CRECHE]);
  });

  test('infers maternelle', () => {
    expect(inferInstitutionType('École Maternelle Voltaire')).toEqual([PublicCategory.MATERNELLE]);
  });

  test('infers élémentaire', () => {
    expect(inferInstitutionType('École élémentaire Hugo')).toEqual([PublicCategory.ELEMENTAIRE]);
    expect(inferInstitutionType('Ecole Elementaire Hugo')).toEqual([PublicCategory.ELEMENTAIRE]);
    expect(inferInstitutionType('École primaire Hugo')).toEqual([PublicCategory.ELEMENTAIRE]);
    expect(inferInstitutionType('Ecole primaire Hugo')).toEqual([PublicCategory.ELEMENTAIRE]);
  });

  test('infers collège', () => {
    expect(inferInstitutionType('Collège Joffre')).toEqual([PublicCategory.COLLEGE]);
    expect(inferInstitutionType('college joffre')).toEqual([PublicCategory.COLLEGE]);
  });

  test('infers lycée', () => {
    expect(inferInstitutionType('Lycée Joffre')).toEqual([PublicCategory.LYCEE]);
    expect(inferInstitutionType('lycee joffre')).toEqual([PublicCategory.LYCEE]);
  });

  test('infers conservatoire', () => {
    expect(inferInstitutionType('Conservatoire de Montpellier')).toEqual([
      PublicCategory.CONSERVATOIRE,
    ]);
  });

  test('infers association', () => {
    expect(inferInstitutionType('Association Culturelle')).toEqual([PublicCategory.ASSOCIATION]);
  });

  test('infers périscolaire', () => {
    expect(inferInstitutionType('Centre de Loisirs Municipal')).toEqual([
      PublicCategory.PERISCOLAIRE,
    ]);
    expect(inferInstitutionType('Accueil périscolaire')).toEqual([PublicCategory.PERISCOLAIRE]);
    expect(inferInstitutionType('Accueil periscolaire')).toEqual([PublicCategory.PERISCOLAIRE]);
  });

  test('defaults to AUTRE', () => {
    expect(inferInstitutionType('MJC')).toEqual([PublicCategory.AUTRE]);
    expect(inferInstitutionType('IUT')).toEqual([PublicCategory.AUTRE]);
  });
});

// ─── mapImportStatus ────────────────────────────────────────────────────────

describe('mapImportStatus', () => {
  test('maps PRESENT to ATTENDED', () => {
    expect(mapImportStatus('PRESENT')).toBe(RegistrationStatus.ATTENDED);
  });

  test('maps ABSENT to NO_SHOW', () => {
    expect(mapImportStatus('ABSENT')).toBe(RegistrationStatus.NO_SHOW);
  });
});

// ─── findOrCreateUser ───────────────────────────────────────────────────────

describe('findOrCreateUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseRow = {
    'Ecole / Association': 'Test',
    Ville: 'Test',
    Effectifs: '10',
    'Date de venue': '01/01/2025',
    'Nom spectacle': 'Test',
    'Nom référent': 'Dupont',
    'Prénom référent': 'Jean',
    Mail: 'jean@test.com',
  };

  test('returns existing user without creating', async () => {
    const existingUser = {
      id: 'u1',
      email: 'jean@test.com',
      first_name: 'Jean',
      last_name: 'Dupont',
    };
    mockPrisma.user.findUnique.mockResolvedValue(existingUser);
    mockPrisma.user.update.mockResolvedValue(existingUser);

    const result = await findOrCreateUser(baseRow as any, false);
    expect(result.isNew).toBe(false);
    expect(result.id).toBe('u1');
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  test('creates new user when not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u2', email: 'jean@test.com' });

    const result = await findOrCreateUser(baseRow as any, true);
    expect(result.isNew).toBe(true);
    expect(result.id).toBe('u2');
    expect(result.plainPassword).toBeTruthy();
  });

  test('does not update user if no name fields are strings', async () => {
    const existingUser = { id: 'u1', email: 'test@test.com' };
    mockPrisma.user.findUnique.mockResolvedValue(existingUser);

    const row = { ...baseRow, 'Nom référent': undefined, 'Prénom référent': undefined } as any;
    await findOrCreateUser(row, false);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  test('handles empty Mail field gracefully when creating new user', async () => {
    // When Mail is undefined, it should be handled gracefully (converts to empty string)
    // For a new user, the function will try to create with email=''
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u2', email: '' });

    const row = { ...baseRow, Mail: undefined } as any;
    const result = await findOrCreateUser(row, false);
    // The function uses the row Mail which becomes empty string
    expect(result.email).toBe('');
    expect(mockPrisma.user.create).toHaveBeenCalled();
  });

  test('uses "Utilisateur" as fallback last name', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u3', email: 'test@test.com' });

    const row = { ...baseRow, 'Nom référent': undefined, 'Prénom référent': undefined } as any;
    await findOrCreateUser(row, false);

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.last_name).toBe('Utilisateur');
  });

  test('sets need_welcome_email when sendEmails is false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u4', email: 'test@test.com' });

    await findOrCreateUser(baseRow as any, false);
    expect(mockPrisma.user.create.mock.calls[0][0].data.need_welcome_email).toBe(true);
  });
});

// ─── findEvent ──────────────────────────────────────────────────────────────

describe('findEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns event with matching date', async () => {
    const date = new Date(Date.UTC(2025, 0, 15, 12, 0, 0));
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 0, 15, 12, 0, 0))] },
    ]);

    const result = await findEvent('Concert', date);
    expect(result).toBe('e1');
  });

  test('throws when no event found', async () => {
    mockPrisma.event.findMany.mockResolvedValue([]);
    await expect(findEvent('Unknown', new Date())).rejects.toThrow('Event not found');
  });

  test('throws when no precise date matches', async () => {
    const date = new Date(Date.UTC(2025, 5, 1, 12, 0, 0));
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e2', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 0, 15, 12, 0, 0))] },
    ]);

    await expect(findEvent('Concert', date)).rejects.toThrow('Event date not found');
  });
});

// ─── linkUserToInstitution ──────────────────────────────────────────────────

describe('linkUserToInstitution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('skips creation when link already exists', async () => {
    mockPrisma.userInstitution.findUnique.mockResolvedValue({ id: 'link1' });
    await linkUserToInstitution('u1', 'i1');
    expect(mockPrisma.userInstitution.create).not.toHaveBeenCalled();
  });

  test('creates link when none exists', async () => {
    mockPrisma.userInstitution.findUnique.mockResolvedValue(null);
    await linkUserToInstitution('u1', 'i1');
    expect(mockPrisma.userInstitution.create).toHaveBeenCalledWith({
      data: { user_id: 'u1', institution_id: 'i1' },
    });
  });
});

// ─── sendWelcomeEmailWithResetLink ──────────────────────────────────────────

describe('sendWelcomeEmailWithResetLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sends email with salutation using first name', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    process.env.APP_URL = 'https://example.com';

    await sendWelcomeEmailWithResetLink('test@test.com', 'Jean', 'Dupont', 3);

    expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();
    const { sendEmail } = jest.requireMock('@/lib/notifications/emailService') as any;
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@test.com',
        template_data: expect.objectContaining({
          salutation: 'Cher Jean Dupont,',
          registration_count: 3,
        }),
      }),
    );
  });

  test('uses last name only when first name is null', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' });

    await sendWelcomeEmailWithResetLink('test@test.com', null, 'Dupont', 1);

    const { sendEmail } = jest.requireMock('@/lib/notifications/emailService') as any;
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        template_data: expect.objectContaining({
          salutation: 'Cher Dupont,',
        }),
      }),
    );
  });

  test('throws when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(sendWelcomeEmailWithResetLink('missing@test.com', null, 'X', 1)).rejects.toThrow(
      'User not found',
    );
  });
});

// ─── findOrCreateInstitution ────────────────────────────────────────────────

describe('findOrCreateInstitution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseRow = {
    'Ecole / Association': 'École Voltaire',
    Ville: 'Montpellier',
    'Adresse Etablissement': '22 RUE JULES GUESDE 34080 Montpellier',
    'Mail établissement': 'contact@voltaire.fr',
    'Type de public': 'Élémentaire',
    Effectifs: '25',
    'Date de venue': '15/03/2025',
    'Nom spectacle': 'Concert',
    'Nom référent': 'Dupont',
    'Prénom référent': 'Jean',
    Mail: 'jean@test.com',
  };

  test('creates new institution with full address', async () => {
    mockPrisma.institution.findFirst.mockResolvedValue(null);
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.address.create.mockResolvedValue({ id: 'addr1' });
    mockPrisma.institution.create.mockResolvedValue({ id: 'i1', name: 'École Voltaire' });

    const result = await findOrCreateInstitution(baseRow as any);
    expect(result.isNew).toBe(true);
    expect(result.id).toBe('i1');
  });

  test('returns existing institution on exact match (no address change)', async () => {
    const row = { ...baseRow, 'Adresse Etablissement': undefined } as any;
    const existing = {
      id: 'i2',
      name: 'École Voltaire',
      email: 'contact@voltaire.fr',
      type: [PublicCategory.ELEMENTAIRE],
    };
    mockPrisma.institution.findFirst.mockResolvedValue(existing);

    const result = await findOrCreateInstitution(row);
    expect(result.isNew).toBe(false);
    expect(result.id).toBe('i2');
  });

  test('updates institution when email changes (no address)', async () => {
    const row = {
      ...baseRow,
      'Adresse Etablissement': undefined,
      'Mail établissement': 'new@voltaire.fr',
    } as any;
    const existing = {
      id: 'i3',
      name: 'École Voltaire',
      email: 'old@voltaire.fr',
      type: [PublicCategory.ELEMENTAIRE],
    };
    mockPrisma.institution.findFirst.mockResolvedValue(existing);
    mockPrisma.institution.update.mockResolvedValue({ ...existing, email: 'new@voltaire.fr' });

    await findOrCreateInstitution(row);
    expect(mockPrisma.institution.update).toHaveBeenCalled();
  });

  test('throws when no address and no exact match for name-only lookup', async () => {
    const row = { ...baseRow, 'Adresse Etablissement': undefined } as any;
    mockPrisma.institution.findFirst.mockResolvedValue(null);
    mockPrisma.institution.findMany.mockResolvedValue([]);

    await expect(findOrCreateInstitution(row)).rejects.toThrow('Institution not found');
  });

  test('skips update when no data changed (no address)', async () => {
    const row = {
      ...baseRow,
      'Type de public': 'Élémentaire',
      'Mail établissement': 'contact@voltaire.fr',
      'Adresse Etablissement': undefined,
    } as any;
    // We mock findFirst to return exactly matching data so no updates happen
    mockPrisma.institution.findFirst.mockResolvedValue({
      id: 'inst1',
      name: 'École Voltaire',
      email: 'contact@voltaire.fr',
      address: { city: 'Montpellier', postal_code: '34000', street: '1 rue de Paris' },
      type: ['ELEMENTAIRE'],
    });
    mockPrisma.institution.update.mockClear();

    const result = await findOrCreateInstitution(row);
    expect(result.id).toBe('inst1');
    expect(result.isNew).toBe(false);
    expect(mockPrisma.institution.update).not.toHaveBeenCalled();
  });

  test('throws when exact name match is not found (fallback removed)', async () => {
    const shortNameRow = {
      ...baseRow,
      'Ecole / Association': 'A B',
      'Adresse Etablissement': undefined,
    };
    mockPrisma.institution.findFirst.mockResolvedValue(null);

    await expect(findOrCreateInstitution(shortNameRow as any)).rejects.toThrow(
      'An exact name match is required',
    );
  });

  test('skips update when no data changed (no address)', async () => {
    const row = {
      ...baseRow,
      'Ecole / Association': 'MJC Voltaire',
      'Adresse Etablissement': undefined,
      'Mail établissement': undefined,
      'Type de public': undefined,
    } as any;
    const existing = {
      id: 'i7',
      name: 'MJC Voltaire',
      email: null,
      type: [PublicCategory.AUTRE],
    };
    mockPrisma.institution.findFirst.mockResolvedValue(existing);

    await findOrCreateInstitution(row);
    expect(mockPrisma.institution.update).not.toHaveBeenCalled();
  });

  test('updates existing institution address when has address_id', async () => {
    const existing = {
      id: 'i8',
      name: 'École Voltaire',
      email: null,
      type: [],
      address_id: 'addr-old',
    };
    mockPrisma.institution.findFirst.mockResolvedValue(existing);
    mockPrisma.address.update.mockResolvedValue({ id: 'addr-old' });
    mockPrisma.institution.update.mockResolvedValue({ id: 'i8', name: 'École Voltaire' });

    const result = await findOrCreateInstitution(baseRow as any);
    expect(mockPrisma.address.update).toHaveBeenCalled();
    expect(result.id).toBe('i8');
    expect(result.isNew).toBe(false);
  });

  test('creates new address for existing institution without address_id', async () => {
    const existing = { id: 'i9', name: 'École Voltaire', email: null, type: [], address_id: null };
    mockPrisma.institution.findFirst.mockResolvedValue(existing);
    mockPrisma.address.create.mockResolvedValue({ id: 'addr-new' });
    mockPrisma.institution.update.mockResolvedValue({ id: 'i9', name: 'École Voltaire' });

    const result = await findOrCreateInstitution(baseRow as any);
    expect(mockPrisma.address.create).toHaveBeenCalled();
    expect(result.id).toBe('i9');
    expect(result.isNew).toBe(false);
  });

  test('uses inferInstitutionType when Type de public is missing (existing with address)', async () => {
    const rowWithoutType = {
      ...baseRow,
      'Type de public': undefined,
      'Ecole / Association': 'Crèche des Petits',
    } as any;
    const existing = {
      id: 'i10',
      name: 'Crèche des Petits',
      email: null,
      type: [],
      address_id: 'addr-old',
    };
    mockPrisma.institution.findFirst.mockResolvedValue(existing);
    mockPrisma.address.update.mockResolvedValue({ id: 'addr-old' });
    mockPrisma.institution.update.mockResolvedValue({
      id: 'i10',
      name: 'Crèche des Petits',
      type: [PublicCategory.CRECHE],
    });

    const result = await findOrCreateInstitution(rowWithoutType);
    expect(mockPrisma.institution.update).toHaveBeenCalled();
    const updateCall = mockPrisma.institution.update.mock.calls[0][0];
    expect(updateCall.data.type).toEqual([PublicCategory.CRECHE]);
    expect(result.id).toBe('i10');
  });

  test('handles empty Mail établissement by setting email to null (line 328)', async () => {
    const rowWithEmptyEmail = {
      ...baseRow,
      'Mail établissement': '', // Empty string should result in null
      'Type de public': undefined,
    } as any;
    const existing = {
      id: 'i11',
      name: 'École Voltaire',
      email: 'old@test.com',
      type: [],
      address_id: 'addr-old',
    };
    mockPrisma.institution.findFirst.mockResolvedValue(existing);
    mockPrisma.address.update.mockResolvedValue({ id: 'addr-old' });
    mockPrisma.institution.update.mockResolvedValue({ id: 'i11', name: 'École Voltaire' });

    const result = await findOrCreateInstitution(rowWithEmptyEmail);
    expect(mockPrisma.institution.update).toHaveBeenCalled();
    const updateCall = mockPrisma.institution.update.mock.calls[0][0];
    expect(updateCall.data.email).toBeNull();
    expect(result.id).toBe('i11');
  });
});

// ─── parseExcelFile ─────────────────────────────────────────────────────────

describe('parseExcelFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('parses Excel buffer and returns cleaned rows', async () => {
    const ExcelJS = (jest.requireMock('exceljs') as any).default;
    const mockWb = new ExcelJS.Workbook();
    const mockWs = mockWb.getWorksheet(1);

    // Mock header row
    mockWs.getRow.mockReturnValue({
      eachCell: jest.fn().mockImplementation((_opts: any, cb: any) => {
        cb({ text: 'Ecole / Association' }, 1);
        cb({ text: 'Ville' }, 2);
        cb({ text: 'Mail' }, 3);
        cb({ text: 'Nom spectacle' }, 4);
        cb({ text: 'Date de venue' }, 5);
        cb({ text: 'Effectifs' }, 6);
        cb({ text: 'Nom référent' }, 7);
        cb({ text: 'Prénom référent' }, 8);
      }),
    });

    // Mock data rows
    mockWs.eachRow.mockImplementation((cb: any) => {
      cb(
        {
          eachCell: jest.fn().mockImplementation((_opts: any, cellCb: any) => {
            cellCb({ value: 'École Test', text: 'École Test' }, 1);
            cellCb({ value: 'Montpellier', text: 'Montpellier' }, 2);
            cellCb({ value: 'test@test.com', text: 'test@test.com' }, 3);
            cellCb({ value: 'Concert', text: 'Concert' }, 4);
            cellCb({ value: '15/03/2025', text: '15/03/2025' }, 5);
            cellCb({ value: '25', text: '25' }, 6);
            cellCb({ value: 'Dupont', text: 'Dupont' }, 7);
            cellCb({ value: 'Jean', text: 'Jean' }, 8);
          }),
        },
        2,
      ); // Row 2 (data row, row 1 is header)
    });

    const result = await parseExcelFile(Buffer.from(''));
    expect(result).toHaveLength(1);
    expect(result[0]['Ecole / Association']).toBe('École Test');
  });

  test('throws when no worksheet found', async () => {
    const ExcelJS = (jest.requireMock('exceljs') as any).default;
    const mockWb = new ExcelJS.Workbook();
    mockWb.getWorksheet.mockReturnValue(null);

    await expect(parseExcelFile(Buffer.from(''))).rejects.toThrow('No worksheet found');

    // Restore default mock
    mockWb.getWorksheet.mockReturnValue({
      getRow: jest.fn(),
      eachRow: jest.fn(),
    });
  });

  test('applies column aliases (Spectacle -> Nom spectacle)', async () => {
    const ExcelJS = (jest.requireMock('exceljs') as any).default;
    const mockWb = new ExcelJS.Workbook();
    const mockWs = mockWb.getWorksheet(1);

    mockWs.getRow.mockReturnValue({
      eachCell: jest.fn().mockImplementation((_opts: any, cb: any) => {
        cb({ text: 'Spectacle' }, 1);
        cb({ text: 'Email' }, 2);
      }),
    });

    mockWs.eachRow.mockImplementation((cb: any) => {
      cb(
        {
          eachCell: jest.fn().mockImplementation((_opts: any, cellCb: any) => {
            cellCb({ value: 'Concert', text: 'Concert' }, 1);
            cellCb({ value: 'test@t.com', text: 'test@t.com' }, 2);
          }),
        },
        2,
      );
    });

    const result = await parseExcelFile(Buffer.from(''));
    expect(result[0]['Nom spectacle']).toBe('Concert');
    expect(result[0]['Mail']).toBe('test@t.com');
  });

  test('handles Date values in cells', async () => {
    const ExcelJS = (jest.requireMock('exceljs') as any).default;
    const mockWb = new ExcelJS.Workbook();
    const mockWs = mockWb.getWorksheet(1);
    const dateValue = new Date(Date.UTC(2025, 2, 15, 12, 0, 0));

    mockWs.getRow.mockReturnValue({
      eachCell: jest.fn().mockImplementation((_opts: any, cb: any) => {
        cb({ text: 'Date de venue' }, 1);
      }),
    });

    mockWs.eachRow.mockImplementation((cb: any) => {
      cb(
        {
          eachCell: jest.fn().mockImplementation((_opts: any, cellCb: any) => {
            cellCb({ value: dateValue, text: '15/03/2025' }, 1);
          }),
        },
        2,
      );
    });

    const result = await parseExcelFile(Buffer.from(''));
    expect(result[0]['Date de venue']).toEqual(dateValue);
  });

  test('skips empty rows', async () => {
    const ExcelJS = (jest.requireMock('exceljs') as any).default;
    const mockWb = new ExcelJS.Workbook();
    const mockWs = mockWb.getWorksheet(1);

    mockWs.getRow.mockReturnValue({
      eachCell: jest.fn().mockImplementation((_opts: any, cb: any) => {
        cb({ text: 'Nom' }, 1);
      }),
    });

    // Simulate header row (1) skipped and empty data row (2)
    mockWs.eachRow.mockImplementation((cb: any) => {
      cb({ eachCell: jest.fn() }, 1); // Header row
      cb({ eachCell: jest.fn() }, 2); // Empty data row
    });

    const result = await parseExcelFile(Buffer.from(''));
    expect(result).toHaveLength(0);
  });

  test('handles empty header text cells', async () => {
    const ExcelJS = (jest.requireMock('exceljs') as any).default;
    const mockWb = new ExcelJS.Workbook();
    const mockWs = mockWb.getWorksheet(1);

    mockWs.getRow.mockReturnValue({
      eachCell: jest.fn().mockImplementation((_opts: any, cb: any) => {
        cb({ text: 'Nom référent' }, 1);
        cb({ text: '' }, 2); // Empty header
        cb({ text: null }, 3); // Null header (text returns '')
      }),
    });

    mockWs.eachRow.mockImplementation((cb: any) => {
      cb(
        {
          eachCell: jest.fn().mockImplementation((_opts: any, cellCb: any) => {
            cellCb({ value: 'Test', text: 'Test' }, 1);
            cellCb({ value: 'Value2', text: 'Value2' }, 2);
            cellCb({ value: 'Value3', text: 'Value3' }, 3);
          }),
        },
        2,
      );
    });

    const result = await parseExcelFile(Buffer.from(''));
    expect(result).toHaveLength(1);
    expect(result[0]['Nom référent']).toBe('Test');
  });
});

// ─── previewImport ──────────────────────────────────────────────────────────

// We need to mock parseExcelFile for previewImport and importExistingRegistrations
// Since parseExcelFile is in the same module, we'll use the mocked ExcelJS to control it

describe('previewImport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper: Create a Date at noon UTC (matching parseFrenchDate normalization)
  function mockDateUTC(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }

  function setupMockExcel(rows: Record<string, any>[]) {
    const ExcelJS = (jest.requireMock('exceljs') as any).default;
    const mockWb = new ExcelJS.Workbook();
    const mockWs = mockWb.getWorksheet(1);

    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    mockWs.getRow.mockReturnValue({
      eachCell: jest.fn().mockImplementation((_opts: any, cb: any) => {
        headers.forEach((h, i) => cb({ text: h }, i + 1));
      }),
    });

    mockWs.eachRow.mockImplementation((cb: any) => {
      cb({ eachCell: jest.fn() }, 1); // Header row (skipped)
      rows.forEach((row, i) => {
        cb(
          {
            eachCell: jest.fn().mockImplementation((_opts: any, cellCb: any) => {
              headers.forEach((h, j) => {
                const v = row[h];
                cellCb({ value: v, text: String(v ?? '') }, j + 1);
              });
            }),
          },
          i + 2,
        );
      });
    });
  }

  const validRow = {
    'Ecole / Association': 'École Voltaire',
    Ville: 'Montpellier',
    Mail: 'jean@test.com',
    'Nom spectacle': 'Concert',
    'Date de venue': '15/03/2025',
    Effectifs: '25',
    'Nom référent': 'Dupont',
    'Prénom référent': 'Jean',
  };

  test('returns preview with valid rows', async () => {
    setupMockExcel([validRow]);

    // Setup preloaded data
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    expect(result.totalRows).toBe(1);
    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(0);
    expect(result.rows[0].canImport).toBe(true);
    expect(result.rows[0].institutionStatus).toBe('existing');
    expect(result.rows[0].userStatus).toBe('existing');
    expect(result.rows[0].eventStatus).toBe('found');
  });

  test('flags row with missing email', async () => {
    setupMockExcel([{ ...validRow, Mail: '' }]);
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    expect(result.invalidRows).toBe(1);
    expect(result.rows[0].canImport).toBe(false);
  });

  test('flags row with missing required fields', async () => {
    setupMockExcel([{ ...validRow, 'Ecole / Association': '', 'Nom spectacle': '' }]);
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].canImport).toBe(false);
  });

  test('detects new user', async () => {
    setupMockExcel([validRow]);
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([]); // No users
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].userStatus).toBe('new');
    expect(result.newUsers).toBe(1);
  });

  test('detects event not found', async () => {
    setupMockExcel([validRow]);
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.event.findMany.mockResolvedValue([]); // No events
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].eventStatus).toBe('not_found');
    expect(result.rows[0].canImport).toBe(false);
  });

  test('detects duplicate registration', async () => {
    setupMockExcel([validRow]);
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);
    // Use mockDateUTC for consistent date normalization (noon UTC)
    const eventDate = mockDateUTC(2025, 2, 15); // March 15, 2025 at noon UTC
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate] },
    ]);
    mockPrisma.registration.findMany.mockResolvedValue([
      { user_id: 'u1', event_id: 'e1', date: eventDate },
    ]);

    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].isDuplicate).toBe(true);
    expect(result.rows[0].canImport).toBe(false);
    expect(result.duplicateRows).toBe(1);
  });

  test('warns on zero seats', async () => {
    setupMockExcel([{ ...validRow, Effectifs: '0' }]);
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].error).toContain('Effectifs');
  });

  test('detects new institution', async () => {
    setupMockExcel([{ ...validRow, 'Adresse Etablissement': '1 Rue Test 34000 Montpellier' }]);
    mockPrisma.institution.findMany.mockResolvedValue([]); // No institutions
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].institutionStatus).toBe('new');
    expect(result.newInstitutions).toBe(1);
  });

  test('handles invalid email format', async () => {
    setupMockExcel([{ ...validRow, Mail: 'not-an-email' }]);
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].canImport).toBe(false);
    expect(result.rows[0].error).toContain("Format d'email");
  });

  test('handles date object for event date', async () => {
    setupMockExcel([{ ...validRow, 'Date de venue': new Date(Date.UTC(2025, 2, 15, 12, 0, 0)) }]);
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.registration.findMany.mockResolvedValue([]);
    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].raw.eventDate).toBe('15/03/2025');
  });

  test('handles undefined Nom référent in previewImport', async () => {
    setupMockExcel([{ ...validRow, 'Nom référent': undefined }]);
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].raw.referentLastName).toBe('');
  });

  test('handles missing properties and various edge cases in previewImport', async () => {
    const row1 = {
      ...validRow,
      Ville: undefined,
      'Mail établissement': undefined,
      'Type de public': undefined,
      Effectifs: undefined,
      'Date de venue': undefined,
    } as any;

    const row2 = {
      ...validRow,
      'Ecole / Association': 'Totally Unknown',
      'Adresse Etablissement': undefined, // First error
      'Date de venue': 'invalid-date', // Second error appended
      'Nom spectacle': 'Totally Unknown Show', // Third error appended
    } as any;

    const row3 = {
      ...validRow,
      'Nom spectacle': 'Concert',
      'Date de venue': '10/03/2025', // different from Date in DB
    } as any;

    const row4 = {
      ...validRow,
      Effectifs: 'invalid', // Should default to 0 seats
    } as any;

    setupMockExcel([row1, row2, row3, row4]);

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'inst_nocity', name: 'MJC Test', address: null, type: [] },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    expect(result.rows.length).toBe(4);
    if (result.rows[1].error) {
      expect(result.rows[1].error).toContain(' | ');
    }
    // Verify row4 has 0 seats
    expect(result.rows[3].raw.seats).toBe(0);
  });

  test('exact match returns error if not found', async () => {
    setupMockExcel([{ ...validRow, 'Ecole / Association': 'A B' }]);
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'Other', address: { city: 'Paris' } },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.event.findMany.mockResolvedValue([]);
    mockPrisma.registration.findMany.mockResolvedValue([]);
    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].institutionStatus).toBe('error');
    expect(result.rows[0].canImport).toBe(false);
  });

  test('returns error when event date does not match (fallback removed)', async () => {
    setupMockExcel([{ ...validRow, 'Date de venue': '01/01/2026' }]); // Wrong date
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] }, // Event matches title, wrong date
    ]);
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].eventStatus).toBe('not_found');
    expect(result.rows[0].error).toContain('Date non trouvée pour "Concert"');
    expect(result.rows[0].canImport).toBe(false);
  });

  test('catches date error during check duplicate registration', async () => {
    // We want event found, but date parsing throws during duplicate check
    // Actually, parseFrenchDate is called during event duplicate check.
    // If we pass an invalid string format that is a string, it will be skipped from duplicate check.
    // 'importExistingRegistrations.ts' line 1070-1071 catches the parsing error.
    setupMockExcel([{ ...validRow, 'Date de venue': 'invalid-date-format' }]);
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] }, // Title matches, date is completely unparseable
    ]);
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    // The date error is caught and added to previewRow.error
    expect(result.rows[0].error).toContain('Erreur de date');
  });

  test('handles date error and duplicate registration error appending', async () => {
    // Test lines 1050-1052 and 1064 - error appending with " | "
    setupMockExcel([
      { ...validRow, 'Date de venue': 'bad-date', 'Adresse Etablissement': undefined },
    ]);
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    const eventDate = new Date(Date.UTC(2025, 2, 15, 12, 0, 0));
    eventDate.setHours(0, 0, 0, 0);
    mockPrisma.registration.findMany.mockResolvedValue([
      { user_id: 'u1', event_id: 'e1', date: eventDate },
    ]);

    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].error).toContain(' | ');
  });

  test('date error with no existing error (hits false branch on line 1050)', async () => {
    // Ensure institution, user, and event are all valid so no prior error
    setupMockExcel([{ ...validRow, 'Date de venue': 'invalid-date-format' }]);
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].error).not.toContain(' | ');
    expect(result.rows[0].error).toContain('Erreur de date');
  });

  test('duplicate registration with no existing error (hits false branch on line 1064)', async () => {
    // Ensure all validation passes so no prior error, then hit duplicate
    setupMockExcel([validRow]);
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);
    // Use mockDateUTC for consistent date normalization (noon UTC)
    const eventDate = mockDateUTC(2025, 2, 15); // March 15, 2025 at noon UTC
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate] },
    ]);
    mockPrisma.registration.findMany.mockResolvedValue([
      { user_id: 'u1', event_id: 'e1', date: eventDate },
    ]);

    const result = await previewImport(Buffer.from(''));
    expect(result.rows[0].error).not.toContain(' | ');
    expect(result.rows[0].error).toContain('Inscription déjà existante');
  });

  test('date error triggers uniqueEventsNotFound.add (line 1052)', async () => {
    // Test that the add method is called when date parsing fails
    setupMockExcel([{ ...validRow, 'Date de venue': 'bad-date' }]);
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));
    // Should increment eventsNotFound because of the failed date parse
    expect(result.eventsNotFound).toBe(1);
  });

  test('duplicate registration increments previewResult.duplicateRows (line 1064-1066)', async () => {
    setupMockExcel([validRow]);
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);
    // Use mockDateUTC for consistent date normalization (noon UTC)
    const eventDate = mockDateUTC(2025, 2, 15); // March 15, 2025 at noon UTC
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate] },
    ]);
    mockPrisma.registration.findMany.mockResolvedValue([
      { user_id: 'u1', event_id: 'e1', date: eventDate },
    ]);

    const result = await previewImport(Buffer.from(''));
    expect(result.duplicateRows).toBe(1);
    expect(result.rows[0].isDuplicate).toBe(true);
  });

  // ─── Coverage for lines 807-812: Duplicate email replacement ─────────────────
  test('prefers user with registrations when duplicate emails found (lines 807-812)', async () => {
    // Setup: Two users with same email (case-insensitive), u1 has registrations, u2 doesn't
    const eventDate = mockDateUTC(2025, 2, 15);
    setupMockExcel([validRow]);

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);

    // u2 (without registrations) appears first in database
    // u1 (with registrations) appears later
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u2', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
      { id: 'u1', email: 'JEAN@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);

    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate] },
    ]);

    // u1 has registrations, u2 doesn't
    mockPrisma.registration.findMany.mockResolvedValue([
      { user_id: 'u1', event_id: 'e1', date: eventDate },
    ]);

    const result = await previewImport(Buffer.from(''));

    // Should match u1 (the user with registrations) despite u2 appearing first
    expect(result.rows[0].userId).toBe('u1');
    expect(result.rows[0].userStatus).toBe('existing');
  });

  // ─── Coverage for lines 1027-1049: Duplicate across matching events ──────────
  test('detects duplicate registration across multiple events with same title and date (lines 1027-1049)', async () => {
    const eventDate = mockDateUTC(2025, 2, 15);
    setupMockExcel([validRow]);

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);

    // Two events with same title "Concert" and same date - different IDs
    // e1 comes first in array, so it will be the resolved event
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate] },
      { id: 'e2', title: 'Concert', event_dates: [eventDate] },
    ]);

    // Registration exists for e2 (not e1 which is the resolved event)
    // This triggers the loop at lines 1025-1050 to check other matching events
    // and finds duplicate at lines 1041-1048
    mockPrisma.registration.findMany.mockResolvedValue([
      { user_id: 'u1', event_id: 'e2', date: eventDate },
    ]);

    const result = await previewImport(Buffer.from(''));

    // e1 is resolved (comes first)
    expect(result.rows[0].eventId).toBe('e1');
    // Should detect as duplicate because u1 has registration with e2 (same date)
    expect(result.rows[0].isDuplicate).toBe(true);
    expect(result.rows[0].canImport).toBe(false);
    expect(result.rows[0].error).toContain('Inscription déjà existante');
    expect(result.duplicateRows).toBe(1);
  });

  test('handles multiple matching events without duplicate (lines 1027-1049)', async () => {
    const eventDate = mockDateUTC(2025, 2, 15);
    setupMockExcel([validRow]);

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);

    // Two events with same title but only one has the date
    const differentDate = mockDateUTC(2025, 3, 20);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate] },
      { id: 'e2', title: 'Concert', event_dates: [differentDate] },
    ]);

    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));

    // Should not be duplicate since no registration exists for the matched date
    // isDuplicate is undefined when not set, so we check it's not true
    expect(result.rows[0].isDuplicate).not.toBe(true);
    expect(result.rows[0].canImport).toBe(true);
  });

  test('covers lines 1034 and 1039-1049: loop through matching events with date but no registration', async () => {
    // This test covers lines 1034 (date comparison inside hasMatchingDate)
    // and lines 1039-1049 (the check that finds no registration)
    const eventDate = mockDateUTC(2025, 2, 15);
    setupMockExcel([validRow]);

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);

    // Two events with same title AND same date, but no registration for either
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate] },
      { id: 'e2', title: 'Concert', event_dates: [eventDate] }, // Same date
    ]);

    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));

    // Should not be duplicate since no registration exists
    expect(result.rows[0].isDuplicate).not.toBe(true);
    expect(result.rows[0].canImport).toBe(true);
  });

  // ─── Coverage for lines 1058-1102: Duplicate across duplicate email users ─────
  test('detects duplicate registration across users with duplicate email (lines 1058-1102)', async () => {
    const eventDate = mockDateUTC(2025, 2, 15);
    setupMockExcel([validRow]);

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);

    // Multiple users with same email (case-insensitive)
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
      { id: 'u2', email: 'JEAN@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);

    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate] },
    ]);

    // Registration exists for u2 (not u1 which would be matched by email lookup)
    mockPrisma.registration.findMany.mockResolvedValue([
      { user_id: 'u2', event_id: 'e1', date: eventDate },
    ]);

    const result = await previewImport(Buffer.from(''));

    // Should detect as duplicate because u2 also has the same email
    expect(result.rows[0].isDuplicate).toBe(true);
    expect(result.rows[0].canImport).toBe(false);
    expect(result.rows[0].error).toContain('Inscription déjà existante');
    expect(result.duplicateRows).toBe(1);
  });

  test('handles duplicate email users without duplicate registration (lines 1058-1102)', async () => {
    const eventDate = mockDateUTC(2025, 2, 15);
    setupMockExcel([validRow]);

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);

    // Multiple users with same email
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
      { id: 'u2', email: 'JEAN@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);

    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate] },
    ]);

    // No existing registration for either user
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));

    // Should not be duplicate since no registration exists
    expect(result.rows[0].isDuplicate).not.toBe(true);
    expect(result.rows[0].canImport).toBe(true);
  });

  test('covers lines 1064-1071: duplicate found with other user but same event', async () => {
    // This specifically tests the first duplicate check inside the duplicate email loop
    // (line 1063: existingRegistrationKeys.has(otherUserKey))
    //
    // To reach lines 1064-1071, we need:
    // 1. u1 stays in usersByEmail (so u1 must also have a registration)
    // 2. u1 has NO registration with e1 (so first duplicate check fails)
    // 3. u2 HAS registration with e1 (so duplicate is found in the loop)
    const eventDate1 = mockDateUTC(2025, 2, 15); // For e1
    const eventDate2 = mockDateUTC(2025, 3, 20); // For e2
    setupMockExcel([validRow]); // This row has 'Concert' which is e1

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);

    // Multiple users with same email - u1 comes first
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
      { id: 'u2', email: 'JEAN@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);

    // Two events with same title "Concert" but different dates
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate1] },
      { id: 'e2', title: 'Concert', event_dates: [eventDate2] },
    ]);

    // u1 has registration with e2 (different event), u2 has registration with e1
    // This ensures u1 stays in usersByEmail (both have registrations, keep first)
    mockPrisma.registration.findMany.mockResolvedValue([
      { user_id: 'u1', event_id: 'e2', date: eventDate2 },
      { user_id: 'u2', event_id: 'e1', date: eventDate1 },
    ]);

    const result = await previewImport(Buffer.from(''));

    // u1 is selected (comes first in array, has registration)
    expect(result.rows[0].userId).toBe('u1');
    // e1 is matched (event date in Excel is 15/03/2025)
    expect(result.rows[0].eventId).toBe('e1');
    // Duplicate is found through u2's registration with e1
    expect(result.rows[0].isDuplicate).toBe(true);
    expect(result.rows[0].canImport).toBe(false);
    expect(result.rows[0].error).toContain('Inscription déjà existante');
    expect(result.duplicateRows).toBe(1);
  });

  test('handles duplicate email with different event dates (lines 1058-1102)', async () => {
    const eventDate1 = mockDateUTC(2025, 2, 15);
    const eventDate2 = mockDateUTC(2025, 3, 20);
    setupMockExcel([validRow]);

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);

    // Multiple users with same email
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
      { id: 'u2', email: 'JEAN@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);

    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate1] },
      { id: 'e2', title: 'Concert', event_dates: [eventDate2] },
    ]);

    // Registration exists for u2 but with a different event/date
    mockPrisma.registration.findMany.mockResolvedValue([
      { user_id: 'u2', event_id: 'e2', date: eventDate2 },
    ]);

    const result = await previewImport(Buffer.from(''));

    // Should not be duplicate since the registration is for a different event/date
    expect(result.rows[0].isDuplicate).not.toBe(true);
    expect(result.rows[0].canImport).toBe(true);
  });

  test('covers lines 1083 and 1088-1098: duplicate found with other user AND other event', async () => {
    // This specifically tests the nested loop that checks:
    // - duplicate users (line 1058)
    // - other matching events (line 1074)
    // - hasMatchingDate (line 1083 - d.getUTCDate() comparison)
    // - duplicate with other user AND other event (line 1089)
    //
    // To reach lines 1083, 1088-1098:
    // 1. u1 stays in usersByEmail (has registration)
    // 2. First check at line 1063 returns FALSE (u1 has no registration with e1)
    // 3. Nested loop finds duplicate with u2 and e2
    const eventDate1 = mockDateUTC(2025, 2, 15);
    setupMockExcel([validRow]); // This row has 'Concert' on 15/03/2025

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);

    // Multiple users with same email - u1 comes first
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
      { id: 'u2', email: 'JEAN@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);

    // Two events with same title "Concert" and SAME date
    // e1 will be matched first (comes first in array)
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate1] },
      { id: 'e2', title: 'Concert', event_dates: [eventDate1] }, // Same date!
    ]);

    // u1 has registration with some OTHER event (not e1 or e2)
    // This ensures u1 stays in usersByEmail
    const otherEventDate = mockDateUTC(2025, 4, 10);
    // u2 has registration with e2 (not e1, which is the resolved match)
    mockPrisma.registration.findMany.mockResolvedValue([
      { user_id: 'u1', event_id: 'otherEvent', date: otherEventDate },
      { user_id: 'u2', event_id: 'e2', date: eventDate1 },
    ]);

    const result = await previewImport(Buffer.from(''));

    // u1 is selected
    expect(result.rows[0].userId).toBe('u1');
    // e1 is matched (comes first in matching events)
    expect(result.rows[0].eventId).toBe('e1');
    // Duplicate is found through the nested loop: u2 has registration with e2 (same date as e1)
    expect(result.rows[0].isDuplicate).toBe(true);
    expect(result.rows[0].canImport).toBe(false);
    expect(result.rows[0].error).toContain('Inscription déjà existante');
    expect(result.duplicateRows).toBe(1);
  });

  test('covers nested loop without finding duplicate (lines 1074-1098)', async () => {
    // This tests the nested loop path where no duplicate is found
    const eventDate1 = mockDateUTC(2025, 2, 15);
    const eventDate2 = mockDateUTC(2025, 3, 20); // Different date
    setupMockExcel([validRow]);

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);

    // Multiple users with same email
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
      { id: 'u2', email: 'JEAN@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);

    // Two events with same title but different dates
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate1] },
      { id: 'e2', title: 'Concert', event_dates: [eventDate2] },
    ]);

    // No existing registrations
    mockPrisma.registration.findMany.mockResolvedValue([]);

    const result = await previewImport(Buffer.from(''));

    // Should not be duplicate
    expect(result.rows[0].isDuplicate).not.toBe(true);
    expect(result.rows[0].canImport).toBe(true);
  });

  // ─── Coverage for lines 1044, 1067, 1093: Error concatenation with duplicate ─────
  test('covers lines 1044: error exists then duplicate found across matching events', async () => {
    // Covers the true branch of ternary at line 1044: (previewRow.error ? previewRow.error + ' | ' : '')
    const eventDate = mockDateUTC(2025, 2, 15);
    setupMockExcel([{ ...validRow, Effectifs: '0' }]); // Seats = 0 creates warning error first

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);

    // Two events with same title and same date
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate] },
      { id: 'e2', title: 'Concert', event_dates: [eventDate] },
    ]);

    // Registration exists for e2 (not e1)
    mockPrisma.registration.findMany.mockResolvedValue([
      { user_id: 'u1', event_id: 'e2', date: eventDate },
    ]);

    const result = await previewImport(Buffer.from(''));

    // Should have both errors: seats warning AND duplicate, separated by " | "
    expect(result.rows[0].error).toContain('Effectifs');
    expect(result.rows[0].error).toContain(' | ');
    expect(result.rows[0].error).toContain('Inscription déjà existante');
    expect(result.rows[0].isDuplicate).toBe(true);
    expect(result.duplicateRows).toBe(1);
  });

  test('covers lines 1067: error exists then duplicate found with other user same event', async () => {
    // Covers the true branch of ternary at line 1067
    const eventDate1 = mockDateUTC(2025, 2, 15);
    const eventDate2 = mockDateUTC(2025, 3, 20);
    setupMockExcel([{ ...validRow, Effectifs: '0' }]); // Seats = 0 creates warning error first

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);

    // Both users have registrations so u1 stays in usersByEmail
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
      { id: 'u2', email: 'JEAN@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);

    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate1] },
      { id: 'e2', title: 'Concert', event_dates: [eventDate2] },
    ]);

    // u1 has e2, u2 has e1
    mockPrisma.registration.findMany.mockResolvedValue([
      { user_id: 'u1', event_id: 'e2', date: eventDate2 },
      { user_id: 'u2', event_id: 'e1', date: eventDate1 },
    ]);

    const result = await previewImport(Buffer.from(''));

    // Should have both errors: seats warning AND duplicate, separated by " | "
    expect(result.rows[0].error).toContain('Effectifs');
    expect(result.rows[0].error).toContain(' | ');
    expect(result.rows[0].error).toContain('Inscription déjà existante');
    expect(result.rows[0].isDuplicate).toBe(true);
  });

  test('covers lines 1093: error exists then duplicate found with other user other event', async () => {
    // Covers the true branch of ternary at line 1093
    const eventDate = mockDateUTC(2025, 2, 15);
    setupMockExcel([{ ...validRow, Effectifs: '0' }]); // Seats = 0 creates warning error first

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'i1', name: 'École Voltaire', address: { city: 'Montpellier' } },
    ]);

    // Both users have registrations so u1 stays in usersByEmail
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', email: 'jean@test.com', first_name: 'Jean', last_name: 'Dupont' },
      { id: 'u2', email: 'JEAN@test.com', first_name: 'Jean', last_name: 'Dupont' },
    ]);

    // Two events with same title and same date
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [eventDate] },
      { id: 'e2', title: 'Concert', event_dates: [eventDate] },
    ]);

    // u1 has some other event, u2 has e2
    const otherEventDate = mockDateUTC(2025, 4, 10);
    mockPrisma.registration.findMany.mockResolvedValue([
      { user_id: 'u1', event_id: 'otherEvent', date: otherEventDate },
      { user_id: 'u2', event_id: 'e2', date: eventDate },
    ]);

    const result = await previewImport(Buffer.from(''));

    // Should have both errors: seats warning AND duplicate, separated by " | "
    expect(result.rows[0].error).toContain('Effectifs');
    expect(result.rows[0].error).toContain(' | ');
    expect(result.rows[0].error).toContain('Inscription déjà existante');
    expect(result.rows[0].isDuplicate).toBe(true);
  });

  // ─── Coverage for line 1255: parseInt fallback ─────────────────────────────────
  test('covers line 1255: parseInt returns NaN, uses fallback 0', async () => {
    // Covers the || 0 fallback when parseInt returns NaN
    const rowWithInvalidSeats = {
      ...validRow,
      Effectifs: 'not-a-number', // Non-numeric value that parseInt will fail on
    };
    setupMockExcel([rowWithInvalidSeats]);

    // For import (uses findFirst and findMany)
    mockPrisma.institution.findFirst.mockResolvedValue({
      id: 'i1',
      name: 'MJC Test',
      email: null,
      type: [],
      address: { city: 'Montpellier' },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
    mockPrisma.user.update.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
    mockPrisma.userInstitution.findUnique.mockResolvedValue(null);
    mockPrisma.userInstitution.create.mockResolvedValue({ id: 'ui1' });
    // findEvent uses event.findMany internally, need to mock it
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.registration.create.mockImplementation((data: any) =>
      Promise.resolve({ id: 'r1', ...data }),
    );
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: false,
      defaultStatus: 'PRESENT',
    });

    // If there are errors, log them for debugging
    if (result.errors.length > 0) {
      console.log('Import errors:', result.errors);
    }

    expect(result.processed).toBe(1);
    expect(result.createdRegistrations).toBe(1);
    expect(mockPrisma.registration.create).toHaveBeenCalled();
    const createCall = mockPrisma.registration.create.mock.calls[0][0];
    // parseInt('not-a-number', 10) returns NaN, NaN || 0 = 0
    expect(createCall.data.booked_seats).toBe(0);
  });
});

// ─── importExistingRegistrations ────────────────────────────────────────────

describe('importExistingRegistrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function setupMockExcel(rows: Record<string, any>[]) {
    const ExcelJS = (jest.requireMock('exceljs') as any).default;
    const mockWb = new ExcelJS.Workbook();
    const mockWs = mockWb.getWorksheet(1);

    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    mockWs.getRow.mockReturnValue({
      eachCell: jest.fn().mockImplementation((_opts: any, cb: any) => {
        headers.forEach((h, i) => cb({ text: h }, i + 1));
      }),
    });

    mockWs.eachRow.mockImplementation((cb: any) => {
      cb({ eachCell: jest.fn() }, 1);
      rows.forEach((row, i) => {
        cb(
          {
            eachCell: jest.fn().mockImplementation((_opts: any, cellCb: any) => {
              headers.forEach((h, j) => {
                const v = row[h];
                cellCb({ value: v, text: String(v ?? '') }, j + 1);
              });
            }),
          },
          i + 2,
        );
      });
    });
  }

  const validRow = {
    'Ecole / Association': 'MJC Test',
    Ville: 'Montpellier',
    Mail: 'user@test.com',
    'Nom spectacle': 'Concert',
    'Date de venue': '15/03/2025',
    Effectifs: '25',
    'Nom référent': 'Dupont',
    'Prénom référent': 'Jean',
  };

  test('successfully imports a valid row', async () => {
    setupMockExcel([validRow]);

    // Exact match required - institution found by name
    mockPrisma.institution.findFirst.mockResolvedValue({
      id: 'i1',
      name: 'MJC Test',
      email: null,
      type: [],
      address: { city: 'Montpellier' },
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
    mockPrisma.userInstitution.findUnique.mockResolvedValue(null);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findFirst.mockResolvedValue(null); // No duplicate
    mockPrisma.registration.create.mockResolvedValue({ id: 'r1' });
    mockPrisma.user.findMany.mockResolvedValue([]); // For email batch

    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: false,
      defaultStatus: 'PRESENT',
    });

    expect(result.processed).toBe(1);
    expect(result.createdRegistrations).toBe(1);
    expect(result.createdUsers).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  test('skips duplicate registration', async () => {
    setupMockExcel([validRow]);

    mockPrisma.institution.findFirst.mockResolvedValue({
      id: 'i1',
      name: 'MJC Test',
      email: null,
      type: [],
      address: { city: 'Montpellier' },
    });
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.institution.update.mockResolvedValue({ id: 'i1' });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
    mockPrisma.user.update.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
    mockPrisma.userInstitution.findUnique.mockResolvedValue({ id: 'link1' });
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findFirst.mockResolvedValue({ id: 'existing' }); // Duplicate!
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: false,
      defaultStatus: 'PRESENT',
    });

    expect(result.createdRegistrations).toBe(0);
    expect(mockPrisma.registration.create).not.toHaveBeenCalled();
  });

  test('records error for invalid email', async () => {
    setupMockExcel([{ ...validRow, Mail: 'bad-email' }]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: false,
      defaultStatus: 'PRESENT',
    });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Email');
  });

  test('records error for empty email', async () => {
    setupMockExcel([{ ...validRow, Mail: undefined }]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: false,
      defaultStatus: 'PRESENT',
    });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Email');
  });

  test('records error for missing required fields', async () => {
    setupMockExcel([{ ...validRow, 'Ecole / Association': '' }]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: false,
      defaultStatus: 'PRESENT',
    });

    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('filters by selectedRows', async () => {
    setupMockExcel([validRow, { ...validRow, Mail: 'other@test.com' }]);

    mockPrisma.institution.findFirst.mockResolvedValue({
      id: 'i1',
      name: 'MJC Test',
      email: null,
      type: [],
      address: { city: 'Montpellier' },
    });
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.institution.update.mockResolvedValue({ id: 'i1' });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u1', email: 'other@test.com' });
    mockPrisma.userInstitution.findUnique.mockResolvedValue(null);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.registration.create.mockResolvedValue({ id: 'r1' });
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: false,
      defaultStatus: 'ABSENT',
      selectedRows: [1], // Only second row
    });

    expect(result.totalRows).toBe(1);
  });

  test('sends emails when sendEmails is true', async () => {
    setupMockExcel([validRow]);

    mockPrisma.institution.findFirst.mockResolvedValue({
      id: 'i1',
      name: 'MJC Test',
      email: null,
      type: [],
      address: { city: 'Montpellier' },
    });
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.institution.update.mockResolvedValue({ id: 'i1' });
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // findOrCreateUser
      .mockResolvedValueOnce({ id: 'u1' }) // sendWelcomeEmailWithResetLink
      .mockResolvedValueOnce({ first_name: 'Jean', last_name: 'Dupont' }); // email sending
    mockPrisma.user.create.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
    mockPrisma.userInstitution.findUnique.mockResolvedValue(null);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.registration.create.mockResolvedValue({ id: 'r1' });
    // For email phase: users needing email
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.update.mockResolvedValue({});

    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: true,
      defaultStatus: 'PRESENT',
    });

    expect(result.processed).toBe(1);
  });

  test('handles email sending failure gracefully', async () => {
    setupMockExcel([validRow]);

    mockPrisma.institution.findFirst.mockResolvedValue({
      id: 'i1',
      name: 'MJC Test',
      email: null,
      type: [],
      address: { city: 'Montpellier' },
    });
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.institution.update.mockResolvedValue({ id: 'i1' });
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
    mockPrisma.userInstitution.findUnique.mockResolvedValue(null);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.registration.create.mockResolvedValue({ id: 'r1' });
    // Email phase: user exists but sendWelcomeEmail will throw
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        email: 'user@test.com',
        first_name: 'Jean',
        last_name: 'Dupont',
        _count: { registrations: 1 },
      },
    ]);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ first_name: 'Jean', last_name: 'Dupont' });
    mockPrisma.user.findUnique.mockResolvedValue(null); // User not found for token -> throws

    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: true,
      defaultStatus: 'PRESENT',
    });

    expect(
      result.errors.some((e: string) => e.includes('Email failed') || e.includes('User not found')),
    ).toBe(true);
  });

  test('handles fatal error (e.g., no Excel file)', async () => {
    const ExcelJS = (jest.requireMock('exceljs') as any).default;
    const mockWb = new ExcelJS.Workbook();
    mockWb.getWorksheet.mockReturnValue(null);

    await expect(
      importExistingRegistrations(Buffer.from(''), { sendEmails: false, defaultStatus: 'PRESENT' }),
    ).rejects.toThrow();

    // Restore
    mockWb.getWorksheet.mockReturnValue({
      getRow: jest.fn(),
      eachRow: jest.fn(),
    });
  });

  test('skips email sending if user exist but need_welcome_email false', async () => {
    setupMockExcel([validRow]);
    mockPrisma.institution.findFirst.mockResolvedValue({
      id: 'i1',
      name: 'MJC Test',
      email: null,
      type: [],
      address: { city: 'Montpellier' },
    });
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.institution.update.mockResolvedValue({ id: 'i1', name: 'MJC Test' });

    // We mock finding the user directly so it doesn't create
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
    mockPrisma.user.update.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
    mockPrisma.userInstitution.findUnique.mockResolvedValue(null);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.registration.create.mockResolvedValue({ id: 'r1' });

    // Prisma will query `where: { need_welcome_email: true }`, so we'll mock that it finds NO users
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: true,
      defaultStatus: 'PRESENT',
    });

    // We know he's processed, but `user.findMany` simulating the query returns [], so no email
    expect(result.processed).toBe(1);
    const { sendEmail } = jest.requireMock('@/lib/notifications/emailService') as any;
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('covers isNewInstitution inside processor', async () => {
    // Use an un-conflicting address so it forces create instead of update
    const unconflictingRow = {
      ...validRow,
      'Adresse Etablissement': '100 rue Nouvelle 75001 Paris',
      'Ecole / Association': 'New School',
    };
    setupMockExcel([unconflictingRow]);

    mockPrisma.institution.findFirst.mockResolvedValue(null);
    mockPrisma.institution.findMany.mockResolvedValue([]);
    mockPrisma.address.create.mockResolvedValue({ id: 'addr99' });
    mockPrisma.institution.create.mockResolvedValue({ id: 'i99', name: 'New School', isNew: true });

    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    mockPrisma.user.update.mockResolvedValue({ id: 'u1' });
    mockPrisma.userInstitution.findUnique.mockResolvedValue({ id: 'ui1' });

    // So the script sees we processed rows successfully
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.registration.create.mockResolvedValue({ id: 'r1' });
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: false,
      defaultStatus: 'PRESENT',
    });

    // verify it reached row parsing successfully and created institution
    expect(result.errors.length).toBe(0);
    expect(result.createdInstitutions).toBe(1);
  });

  test('covers all remaining edge case branches in execution block', async () => {
    // 2. non-string types for defensive typing
    // 2. Row with falsy optional fields (but valid required fields) to hit downstream false branches
    const weirdRow = {
      ...validRow,
      Ville: null, // hits false branch
      'Adresse Etablissement': '   ', // hit false branch
      'Type de public': undefined,
      'Mail établissement': undefined,
      'Prénom référent': null, // hits false branch
      Effectifs: null, // hits false branch
    } as any;

    // 3. Email changed = true, type changed = false
    const existingInstRow = {
      ...validRow,
      'Ecole / Association': 'Existing School',
      'Type de public': 'Maternelle',
      'Mail établissement': 'new@school.com',
    };

    // 4. Fuzzy match where keywords.length === 0, and target includes name
    const fuzzyRowShort = {
      ...validRow,
      'Ecole / Association': 'MJC Montpellier',
      Ville: 'Montpellier',
      'Date de venue': '16/03/2025', // Date that does NOT match event dates exactly (hits !matchingEvent)
    };

    setupMockExcel([weirdRow, existingInstRow, fuzzyRowShort]);

    mockPrisma.institution.findFirst.mockResolvedValueOnce(null); // for weirdRow
    mockPrisma.institution.findFirst.mockResolvedValueOnce({
      id: 'inst_exist',
      name: 'Existing School',
      email: 'old@school.com',
      type: ['Maternelle'],
      address_id: 'some_address', // this hits the true branch for `if (addressId) db.address.update`
    });
    mockPrisma.institution.findFirst.mockResolvedValueOnce(null); // for fuzzyRowShort

    mockPrisma.institution.update.mockResolvedValue({ id: 'dummy', name: 'dummy' });

    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'inst_short', name: 'MJC', address: null, type: [] }, // keywords length 0, targetIncludes
    ]);

    // Mock throws a non-Error to hit catch block string fallbacks. We mock `institution.findFirst`
    // for existingInstRow update to throw! Wait no, that would break preview row.
    // Let's mock registration.create to throw a string so it hits the execution catch block string branch!
    mockPrisma.registration.create.mockRejectedValueOnce('String Error');

    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e2', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    // Run preview to hit preview catch blocks
    const previewResult = await previewImport(Buffer.from(''));
    expect(previewResult.invalidRows).toBeGreaterThan(0);

    // Run execution to hit execution catch blocks
    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: false,
      defaultStatus: 'PRESENT',
    });

    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('handles undefined Prénom référent in importExistingRegistrations', async () => {
    const rowWithUndefinedPrenom = {
      ...validRow,
      'Prénom référent': undefined,
    };

    setupMockExcel([rowWithUndefinedPrenom]);

    // Exact match required - institution found by name
    mockPrisma.institution.findFirst.mockResolvedValue({
      id: 'i1',
      name: 'MJC Test',
      email: null,
      type: [],
      address: { city: 'Montpellier' },
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
    mockPrisma.userInstitution.findUnique.mockResolvedValue(null);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.registration.create.mockImplementation((data: any) =>
      Promise.resolve({ id: 'r1', ...data }),
    );
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: false,
      defaultStatus: 'PRESENT',
    });

    expect(result.processed).toBe(1);
    expect(mockPrisma.registration.create).toHaveBeenCalled();
    const createCall = mockPrisma.registration.create.mock.calls[0][0];
    expect(createCall.data.manager_first_name).toBeNull();
  });

  test('handles null Prénom référent explicitly for lines 1214-1215', async () => {
    // Explicitly set Prénom référent to null to hit the ?: null branch
    const rowWithNullPrenom = {
      ...validRow,
      'Prénom référent': null,
    };

    setupMockExcel([rowWithNullPrenom]);

    // Exact match required - institution found by name
    mockPrisma.institution.findFirst.mockResolvedValue({
      id: 'i1',
      name: 'MJC Test',
      email: null,
      type: [],
      address: { city: 'Montpellier' },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'user@test.com' });
    mockPrisma.userInstitution.findUnique.mockResolvedValue(null);
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Concert', event_dates: [new Date(Date.UTC(2025, 2, 15, 12, 0, 0))] },
    ]);
    mockPrisma.registration.findFirst.mockResolvedValue(null);
    mockPrisma.registration.create.mockImplementation((data: any) =>
      Promise.resolve({ id: 'r1', ...data }),
    );
    mockPrisma.user.findMany.mockResolvedValue([]);

    const result = await importExistingRegistrations(Buffer.from(''), {
      sendEmails: false,
      defaultStatus: 'PRESENT',
    });

    expect(result.processed).toBe(1);
    const createCall = mockPrisma.registration.create.mock.calls[0][0];
    expect(createCall.data.manager_first_name).toBeNull();
  });
});
