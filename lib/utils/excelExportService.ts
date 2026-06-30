import ExcelJS from 'exceljs';
import {
  Role,
  RegistrationStatus,
  EventStatus,
  PublicCategory,
  SchoolGrade,
  AgeRange,
  Accessibility,
  EventType,
} from '@/app/generated/prisma/enums';
import { Prisma } from '@/app/generated/prisma/client';
import {
  getAgeRangeLabelsMapAsync,
  getPublicCategoryLabelsMapAsync,
  getSchoolGradeLabelsMapAsync,
  getRegistrationStatusLabelsMapAsync,
  getEventStatusLabelsMapAsync,
  getEventTypeLabelsMapAsync,
  getAccessibilityLabelsMapAsync,
} from '@/lib/config/labelMappingsServer';
import prisma from '@/lib/middleware/prismaConfig';

// ============================================================================
// Types
// ============================================================================

interface DynamicLabels {
  publicCategoryLabels: Record<string, string>;
  schoolGradeLabels: Record<string, string>;
  ageRangeLabels: Record<string, string>;
  registrationStatusLabels: Record<string, string>;
  eventStatusLabels: Record<string, string>;
  eventTypeLabels: Record<string, string>;
  accessibilityLabels: Record<string, string>;
}

// Types for export parameters
/**
 * Supported types for Excel export.
 */
export type ExportType = 'users' | 'events' | 'registrations' | 'institutions' | 'complete';

/**
 * Sheet identifiers available for the 'complete' export type.
 */
export type SheetType =
  'users' | 'events' | 'registrations' | 'institutions' | 'groups' | 'statistics';

const ALL_SHEETS: SheetType[] = [
  'users',
  'events',
  'registrations',
  'institutions',
  'groups',
  'statistics',
];

/**
 * Options for customising the export behaviour.
 */
export type ExportOptions = {
  sheets?: SheetType[];
  anonymize?: boolean;
  includeCoverSheet?: boolean;
  exporterName?: string;
  exporterEmail?: string;
};

/**
 * Filters available for data export.
 */
export type ExportFilters = {
  dateFrom?: string;
  dateTo?: string;
  role?: Role;
  registrationStatus?: RegistrationStatus;
  eventStatus?: EventStatus;
  institutionId?: string;
  eventId?: string;
  publicCategory?: PublicCategory;
  eventType?: EventType;
  schoolGrade?: SchoolGrade;
  ageRange?: AgeRange;
};

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Generates an Excel report based on the specified type, filters and options.
 * @param exportType - The type of report to generate.
 * @param filters - Optional filters to apply to the data.
 * @param options - Optional export options (sheet selection, anonymisation …).
 * @returns A Buffer containing the generated Excel file.
 */
export async function generateExcelReport(
  exportType: ExportType,
  filters: ExportFilters = {},
  options: ExportOptions = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Service culturel - Plateforme web';
  workbook.created = new Date();

  // Fetch dynamic labels for export
  const [
    publicCategoryLabels,
    schoolGradeLabels,
    ageRangeLabels,
    registrationStatusLabels,
    eventStatusLabels,
    eventTypeLabels,
    accessibilityLabels,
  ] = await Promise.all([
    getPublicCategoryLabelsMapAsync(),
    getSchoolGradeLabelsMapAsync(),
    getAgeRangeLabelsMapAsync(),
    getRegistrationStatusLabelsMapAsync(),
    getEventStatusLabelsMapAsync(),
    getEventTypeLabelsMapAsync(),
    getAccessibilityLabelsMapAsync(),
  ]);

  const labels: DynamicLabels = {
    publicCategoryLabels,
    schoolGradeLabels,
    ageRangeLabels,
    registrationStatusLabels,
    eventStatusLabels,
    eventTypeLabels,
    accessibilityLabels,
  };

  // Create cover sheet placeholder (first tab, populated last so it can list all sheets)
  const includeCover = options.includeCoverSheet !== false;
  const coverSheet = includeCover
    ? workbook.addWorksheet('Résumé', {
        properties: { tabColor: { argb: 'FF000000' } },
      })
    : null;

  const sheetsToInclude = options.sheets || ALL_SHEETS;

  switch (exportType) {
    case 'users':
      await addUsersSheet(workbook, filters, labels, options);
      break;
    case 'events':
      await addEventsSheet(workbook, filters, labels);
      break;
    case 'registrations':
      await addRegistrationsSheet(workbook, filters, labels, options);
      break;
    case 'institutions':
      await addInstitutionsSheet(workbook, filters, labels, options);
      break;
    case 'complete': {
      if (sheetsToInclude.includes('users'))
        await addUsersSheet(workbook, filters, labels, options);
      if (sheetsToInclude.includes('events')) await addEventsSheet(workbook, filters, labels);
      if (sheetsToInclude.includes('registrations'))
        await addRegistrationsSheet(workbook, filters, labels, options);
      if (sheetsToInclude.includes('institutions'))
        await addInstitutionsSheet(workbook, filters, labels, options);
      if (sheetsToInclude.includes('groups'))
        await addGroupsSheet(workbook, filters, labels, options);
      if (sheetsToInclude.includes('statistics'))
        await addStatisticsSheet(workbook, filters, labels);
      break;
    }
  }

  // Populate cover sheet now that all data sheets exist
  if (coverSheet) {
    populateCoverSheet(coverSheet, exportType, filters, options, labels, workbook);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ============================================================================
// Common styles
// ============================================================================

const headerStyle: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } },
  alignment: { vertical: 'middle', horizontal: 'center' },
  border: {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  },
};

const cellStyle: Partial<ExcelJS.Style> = {
  alignment: { vertical: 'middle', wrapText: true },
  border: {
    top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  },
};

const sectionHeaderStyle: Partial<ExcelJS.Style> = {
  font: { bold: true, size: 14, color: { argb: 'FF000000' } },
  alignment: { vertical: 'middle' },
};

// ============================================================================
// Utility helpers
// ============================================================================

function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.style = headerStyle as ExcelJS.Style;
  });
  row.height = 25;
}

function applyAlternateRowColors(worksheet: ExcelJS.Worksheet, startRow: number) {
  for (let i = startRow; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    row.eachCell((cell) => {
      cell.style = {
        ...cellStyle,
        fill:
          i % 2 === 0
            ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } }
            : undefined,
      } as ExcelJS.Style;
    });
  }
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPublicCategories(categories: PublicCategory[], labels: DynamicLabels): string {
  if (!categories || categories.length === 0) return 'N/A';
  return categories.map((c) => labels.publicCategoryLabels[c] || c).join(', ');
}

function formatSchoolGrades(grades: SchoolGrade[], labels: DynamicLabels): string {
  if (!grades || grades.length === 0) return 'N/A';
  return grades.map((grade) => labels.schoolGradeLabels[grade] || grade).join(', ');
}

function formatAgeRanges(ageRanges: AgeRange[], labels: DynamicLabels): string {
  if (!ageRanges || ageRanges.length === 0) return 'N/A';
  return ageRanges.map((ageRange) => labels.ageRangeLabels[ageRange] || ageRange).join(', ');
}

function formatRole(role: Role): string {
  const roleLabels: Record<Role, string> = {
    USER: 'Utilisateur',
    ADMIN: 'Administrateur',
    SUPERADMIN: 'Super Administrateur',
  };
  return roleLabels[role] || role;
}

function formatRegistrationStatus(status: RegistrationStatus, labels: DynamicLabels): string {
  return labels.registrationStatusLabels[status] || status;
}

function formatEventTypes(types: EventType[], labels: DynamicLabels): string {
  if (!types || types.length === 0) return 'N/A';
  return types.map((t) => labels.eventTypeLabels[t] || t).join(', ');
}

function formatAccessibilityType(type: Accessibility, labels: DynamicLabels): string {
  return labels.accessibilityLabels[type] || type;
}

function formatAccessibilityTypes(types: Accessibility[], labels: DynamicLabels): string {
  if (!types || types.length === 0) return 'N/A';
  return types.map((t) => formatAccessibilityType(t, labels)).join(', ');
}

function formatEventStatus(status: EventStatus, labels: DynamicLabels): string {
  return labels.eventStatusLabels[status] || status;
}

function formatEventDates(dates: Date[]): string {
  if (!dates || dates.length === 0) return 'Aucune date';
  return dates
    .map((date) =>
      new Date(date).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    )
    .join(' | ');
}

// ============================================================================
// Anonymisation helpers
// ============================================================================

function anonymizeEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***.***';
  const [local, domain] = parts;
  return `${local.charAt(0)}${'*'.repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

function anonymizePhone(phone: string | null | undefined): string {
  if (!phone) return 'N/A';
  // Keep only the last 2 digits visible
  return phone.replace(/\d(?=.{2,}$)/g, '*');
}

function anonymizeName(firstName: string, lastName: string): string {
  const fInit = firstName ? firstName.charAt(0) + '.' : '';
  const lInit = lastName ? lastName.charAt(0) + '.' : '';
  return `${fInit} ${lInit}`.trim() || '***';
}

// ============================================================================
// Cover Sheet (Résumé)
// ============================================================================

const EXPORT_TYPE_LABELS_FR: Record<ExportType, string> = {
  users: 'Utilisateurs',
  events: 'Événements',
  registrations: 'Inscriptions',
  institutions: 'Établissements',
  complete: 'Rapport complet',
};

function populateCoverSheet(
  worksheet: ExcelJS.Worksheet,
  exportType: ExportType,
  filters: ExportFilters,
  options: ExportOptions,
  labels: DynamicLabels,
  workbook: ExcelJS.Workbook,
) {
  worksheet.columns = [{ width: 35 }, { width: 50 }, { width: 25 }, { width: 25 }];

  // Title
  worksheet.mergeCells('A1:D1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = "Rapport d'export — Plateforme Opéra de Montpellier";
  titleCell.font = { bold: true, size: 18, color: { argb: 'FF000000' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 45;

  let currentRow = 3;

  const addMeta = (label: string, value: string) => {
    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, size: 11 };
    row.getCell(2).value = value;
    row.getCell(2).font = { size: 11 };
    currentRow++;
  };

  const addSection = (title: string) => {
    currentRow++;
    const row = worksheet.getRow(currentRow);
    worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
    row.getCell(1).value = title;
    row.getCell(1).style = sectionHeaderStyle as ExcelJS.Style;
    row.height = 30;
    currentRow++;
  };

  // ── General information ──
  addSection('INFORMATIONS GÉNÉRALES');
  addMeta("Date d'export", formatDate(new Date()));
  addMeta("Type d'export", EXPORT_TYPE_LABELS_FR[exportType]);
  addMeta('Version application', '1.5.2');
  if (options.exporterName) addMeta('Exporté par', options.exporterName);
  if (options.exporterEmail) addMeta('Email exportateur', options.exporterEmail);
  if (options.anonymize) addMeta('Anonymisation', 'Activée');

  // ── Applied filters ──
  addSection('FILTRES APPLIQUÉS');
  const hasFilters = Object.entries(filters).some(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (!hasFilters) {
    addMeta('', 'Aucun filtre appliqué');
  } else {
    if (filters.dateFrom) addMeta('Date de début', filters.dateFrom);
    if (filters.dateTo) addMeta('Date de fin', filters.dateTo);
    if (filters.role) addMeta('Rôle', formatRole(filters.role));
    if (filters.registrationStatus)
      addMeta(
        "Statut d'inscription",
        labels.registrationStatusLabels[filters.registrationStatus] || filters.registrationStatus,
      );
    if (filters.eventStatus)
      addMeta(
        "Statut d'événement",
        labels.eventStatusLabels[filters.eventStatus] || filters.eventStatus,
      );
    if (filters.publicCategory)
      addMeta(
        'Catégorie de public',
        labels.publicCategoryLabels[filters.publicCategory] || filters.publicCategory,
      );
    if (filters.eventType)
      addMeta("Type d'événement", labels.eventTypeLabels[filters.eventType] || filters.eventType);
    if (filters.schoolGrade)
      addMeta(
        'Niveau scolaire',
        labels.schoolGradeLabels[filters.schoolGrade] || filters.schoolGrade,
      );
    if (filters.ageRange)
      addMeta("Tranche d'âge", labels.ageRangeLabels[filters.ageRange] || filters.ageRange);
    if (filters.institutionId) addMeta('Établissement (ID)', filters.institutionId);
    if (filters.eventId) addMeta('Événement (ID)', filters.eventId);
  }

  // ── Sheets included ──
  addSection('FEUILLES INCLUSES');
  const dataSheets = workbook.worksheets.filter((ws) => ws.name !== 'Résumé');
  dataSheets.forEach((ws) => {
    addMeta(ws.name, `${ws.rowCount - 1} ligne(s)`);
  });

  // Light border styling for all rows
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (!cell.font?.size || cell.font.size < 14) {
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        };
      }
    });
  });
}

// ============================================================================
// Users Sheet
// ============================================================================

async function addUsersSheet(
  workbook: ExcelJS.Workbook,
  filters: ExportFilters,
  labels: DynamicLabels,
  options: ExportOptions = {},
) {
  const worksheet = workbook.addWorksheet('Utilisateurs', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Build query with filters
  const whereClause: Prisma.UserWhereInput = {};
  if (filters.role) whereClause.role = filters.role;
  if (filters.dateFrom || filters.dateTo) {
    whereClause.created_at = {};
    if (filters.dateFrom) whereClause.created_at.gte = new Date(filters.dateFrom);
    if (filters.dateTo) whereClause.created_at.lte = new Date(filters.dateTo);
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    include: {
      userInstitutions: {
        include: {
          institution: true,
        },
      },
      registrations: true,
      _count: {
        select: {
          registrations: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  worksheet.columns = [
    { key: 'id', width: 15 },
    { key: 'email', width: 30 },
    { key: 'email_verified', width: 15 },
    { key: 'first_name', width: 20 },
    { key: 'last_name', width: 20 },
    { key: 'phone_number', width: 18 },
    { key: 'role', width: 20 },
    { key: 'institutions', width: 35 },
    { key: 'registrations_count', width: 20 },
    { key: 'email_notifications', width: 20 },
    { key: 'events_reminders', width: 20 },
    { key: 'last_activity', width: 20 },
    { key: 'failed_login_attempts', width: 22 },
    { key: 'account_locked', width: 18 },
    { key: 'account_locked_until', width: 20 },
    { key: 'created_at', width: 20 },
    { key: 'updated_at', width: 20 },
  ];

  const headerRow = worksheet.addRow([
    'ID',
    'Email',
    'Email vérifié',
    'Prénom',
    'Nom',
    'Téléphone',
    'Rôle',
    'Établissements',
    'Nb Inscriptions',
    'Notifications Email',
    'Rappels Événements',
    'Dernière activité',
    'Tentatives échouées',
    'Compte verrouillé',
    "Verrouillé jusqu'au",
    'Date de création',
    'Date de modification',
  ]);
  applyHeaderStyle(headerRow);

  const anon = options.anonymize === true;

  users.forEach((user) => {
    const institutions = user.userInstitutions.map((ui) => ui.institution.name).join(', ');

    worksheet.addRow({
      id: user.id.substring(0, 12) + '...',
      email: anon ? anonymizeEmail(user.email) : user.email,
      email_verified: user.email_verification_token ? 'Non' : 'Oui',
      first_name: anon
        ? anonymizeName(user.first_name || '', '').replace(' ', '')
        : user.first_name || '',
      last_name: anon ? anonymizeName('', user.last_name).replace(' ', '') : user.last_name,
      phone_number: anon ? anonymizePhone(user.phone_number) : user.phone_number,
      role: formatRole(user.role),
      institutions: institutions || 'Aucun',
      registrations_count: user._count.registrations,
      email_notifications: user.email_notifications_enabled ? 'Oui' : 'Non',
      events_reminders: user.events_reminders_enabled ? 'Oui' : 'Non',
      last_activity: formatDate(user.lastActivity),
      failed_login_attempts: user.failed_login_attempts || 0,
      account_locked: user.locked_until && new Date(user.locked_until) > new Date() ? 'Oui' : 'Non',
      account_locked_until: formatDate(user.locked_until),
      created_at: formatDate(user.created_at),
      updated_at: formatDate(user.updated_at),
    });
  });

  applyAlternateRowColors(worksheet, 2);

  worksheet.autoFilter = {
    from: 'A1',
    to: 'Q1',
  };
}

// ============================================================================
// Events Sheet
// ============================================================================

async function addEventsSheet(
  workbook: ExcelJS.Workbook,
  filters: ExportFilters,
  labels: DynamicLabels,
) {
  const worksheet = workbook.addWorksheet('Événements', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const whereClause: Prisma.EventWhereInput = {};
  if (filters.eventStatus) whereClause.status = filters.eventStatus;
  if (filters.publicCategory) whereClause.category = { has: filters.publicCategory };
  if (filters.eventType) whereClause.type = { has: filters.eventType };
  if (filters.schoolGrade) whereClause.grades = { has: filters.schoolGrade };
  if (filters.ageRange) whereClause.age_ranges = { has: filters.ageRange };
  if (filters.eventId) whereClause.id = filters.eventId;
  if (filters.dateFrom || filters.dateTo) {
    whereClause.created_at = {};
    if (filters.dateFrom) whereClause.created_at.gte = new Date(filters.dateFrom);
    if (filters.dateTo) whereClause.created_at.lte = new Date(filters.dateTo);
  }

  const events = await prisma.event.findMany({
    where: whereClause,
    include: {
      registrations: {
        select: { status: true },
      },
      accessibility: true,
      registrationBlocks: {
        orderBy: { order: 'asc' },
      },
      _count: {
        select: {
          registrations: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  // 28 columns: A-AB
  worksheet.columns = [
    { key: 'id', width: 15 },
    { key: 'title', width: 35 },
    { key: 'slug', width: 30 },
    { key: 'description', width: 50 },
    { key: 'event_type', width: 25 },
    { key: 'location', width: 25 },
    { key: 'duration', width: 12 },
    { key: 'category', width: 30 },
    { key: 'grades', width: 30 },
    { key: 'age_ranges', width: 30 },
    { key: 'total_seats', width: 15 },
    { key: 'booked_seats', width: 15 },
    { key: 'available_seats', width: 15 },
    { key: 'occupancy_rate', width: 18 },
    { key: 'registrations_total', width: 18 },
    { key: 'registrations_pending', width: 18 },
    { key: 'registrations_confirmed', width: 20 },
    { key: 'registrations_rejected', width: 18 },
    { key: 'accessibility', width: 40 },
    { key: 'registration_blocks', width: 50 },
    { key: 'has_initial_formation', width: 22 },
    { key: 'has_musical_preparation', width: 25 },
    { key: 'is_formation_mandatory', width: 22 },
    { key: 'caretaker', width: 18 },
    { key: 'status', width: 15 },
    { key: 'dates_count', width: 15 },
    { key: 'event_dates', width: 60 },
    { key: 'created_at', width: 20 },
    { key: 'updated_at', width: 20 },
  ];

  const headerRow = worksheet.addRow([
    'ID',
    'Titre',
    'Slug',
    'Description',
    'Type(s) événement',
    'Lieu',
    'Durée (min)',
    'Catégorie(s)',
    'Niveau(x) scolaire(s)',
    "Tranche(s) d'âge",
    'Places totales',
    'Places réservées',
    'Places disponibles',
    'Taux occupation',
    'Nb Inscriptions',
    'En attente',
    'Confirmées',
    'Refusées',
    'Accessibilité',
    'Blocs pédagogiques',
    'Formation initiale',
    'Préparation musicale',
    'Formation obligatoire',
    'Accompagnateurs requis',
    'Statut',
    'Nb Dates',
    'Dates programmées',
    'Date de création',
    'Date de modification',
  ]);
  applyHeaderStyle(headerRow);

  events.forEach((event) => {
    const occupancyRate =
      event.total_seats > 0 ? Math.round((event.booked_seats / event.total_seats) * 100) : 0;

    const accessibilityTypes = formatAccessibilityTypes(
      event.accessibility.map((a) => a.type),
      labels,
    );

    // Registration breakdown by status
    const pending = event.registrations.filter((r) => r.status === 'PENDING').length;
    const confirmed = event.registrations.filter((r) => r.status === 'CONFIRMED').length;
    const rejected = event.registrations.filter((r) => r.status === 'REJECTED').length;
    const registrationBlocks = event.registrationBlocks
      .map((block) => {
        const flags = [
          block.enabled ? 'visible' : 'masqué',
          block.registration_enabled ? 'inscription' : 'sans inscription',
          block.mandatory ? 'obligatoire' : null,
        ]
          .filter(Boolean)
          .join(', ');
        return `${block.title} (${flags}) - ${block.dates.length} date(s)`;
      })
      .join(' | ');

    worksheet.addRow({
      id: event.id.substring(0, 12) + '...',
      title: event.title,
      slug: event.slug || 'N/A',
      description: event.description || 'N/A',
      event_type: formatEventTypes(event.type, labels),
      location: event.location,
      duration: event.duration,
      category: formatPublicCategories(event.category, labels),
      grades: formatSchoolGrades(event.grades, labels),
      age_ranges: formatAgeRanges(event.age_ranges, labels),
      total_seats: event.total_seats,
      booked_seats: event.booked_seats,
      available_seats: event.total_seats - event.booked_seats,
      occupancy_rate: `${occupancyRate}%`,
      registrations_total: event._count.registrations,
      registrations_pending: pending,
      registrations_confirmed: confirmed,
      registrations_rejected: rejected,
      accessibility: accessibilityTypes,
      registration_blocks: registrationBlocks || 'Aucun',
      has_initial_formation: event.has_initial_formation ? 'Oui' : 'Non',
      has_musical_preparation: event.has_musical_preparation ? 'Oui' : 'Non',
      is_formation_mandatory: event.is_formation_mandatory ? 'Oui' : 'Non',
      caretaker: event.caretaker || 'N/A',
      status: formatEventStatus(event.status, labels),
      dates_count: event.event_dates.length,
      event_dates: formatEventDates(event.event_dates),
      created_at: formatDate(event.created_at),
      updated_at: formatDate(event.updated_at),
    });
  });

  applyAlternateRowColors(worksheet, 2);

  worksheet.autoFilter = {
    from: 'A1',
    to: 'AC1',
  };
}

// ============================================================================
// Registrations Sheet
// ============================================================================

async function addRegistrationsSheet(
  workbook: ExcelJS.Workbook,
  filters: ExportFilters,
  labels: DynamicLabels,
  options: ExportOptions = {},
) {
  const worksheet = workbook.addWorksheet('Inscriptions', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const whereClause: Prisma.RegistrationWhereInput = {};
  if (filters.registrationStatus) whereClause.status = filters.registrationStatus;
  if (filters.eventId) whereClause.event_id = filters.eventId;
  if (filters.institutionId) whereClause.institution_id = filters.institutionId;
  if (filters.publicCategory) whereClause.category = { has: filters.publicCategory };
  if (filters.schoolGrade) whereClause.grades = { has: filters.schoolGrade };
  if (filters.ageRange) whereClause.age_ranges = { has: filters.ageRange };
  if (filters.eventType) whereClause.event = { type: { has: filters.eventType } };
  if (filters.dateFrom || filters.dateTo) {
    whereClause.created_at = {};
    if (filters.dateFrom) whereClause.created_at.gte = new Date(filters.dateFrom);
    if (filters.dateTo) whereClause.created_at.lte = new Date(filters.dateTo);
  }

  const registrations = await prisma.registration.findMany({
    where: whereClause,
    include: {
      user: true,
      event: true,
      institution: {
        include: { address: true },
      },
      disabilities: true,
      blockSelections: {
        include: {
          block: true,
        },
        orderBy: {
          block: {
            order: 'asc',
          },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const anon = options.anonymize === true;

  // 25 columns: A-Y
  worksheet.columns = [
    { key: 'id', width: 15 },
    { key: 'event_title', width: 30 },
    { key: 'institution', width: 30 },
    { key: 'institution_type', width: 25 },
    { key: 'institution_city', width: 20 },
    { key: 'user_name', width: 25 },
    { key: 'user_email', width: 30 },
    { key: 'date', width: 20 },
    { key: 'booked_seats', width: 15 },
    { key: 'category', width: 25 },
    { key: 'grades', width: 25 },
    { key: 'age_ranges', width: 25 },
    { key: 'status', width: 15 },
    { key: 'manager_name', width: 25 },
    { key: 'manager_email', width: 30 },
    { key: 'manager_phone', width: 18 },
    { key: 'caretaker_count', width: 18 },
    { key: 'aesh_count', width: 15 },
    { key: 'disabilities', width: 30 },
    { key: 'registration_blocks', width: 50 },
    { key: 'want_formation', width: 18 },
    { key: 'want_preparation', width: 20 },
    { key: 'comments', width: 50 },
    { key: 'was_present_comment', width: 50 },
    { key: 'created_at', width: 20 },
    { key: 'updated_at', width: 20 },
  ];

  const headerRow = worksheet.addRow([
    'ID',
    'Événement',
    'Établissement',
    'Type établissement',
    'Ville établissement',
    'Utilisateur',
    'Email utilisateur',
    'Date événement',
    'Places réservées',
    'Catégorie(s)',
    'Niveau(x) scolaire(s)',
    "Tranche(s) d'âge",
    'Statut',
    'Responsable',
    'Email responsable',
    'Tél. responsable',
    'Nb Accompagnateurs',
    'Nb AESH',
    'Accessibilité',
    'Blocs pédagogiques',
    'Formation souhaitée',
    'Préparation souhaitée',
    'Commentaires',
    'Commentaire présence',
    "Date d'inscription",
    'Date de modification',
  ]);
  applyHeaderStyle(headerRow);

  registrations.forEach((reg) => {
    const disabilities = reg.disabilities
      .map((d) => `${formatAccessibilityType(d.type, labels)} (${d.count})`)
      .join(', ');
    const registrationBlocks = reg.blockSelections
      .map((selection) => {
        const selectedDate = selection.selected_date
          ? ` - ${formatDate(selection.selected_date)}`
          : '';
        return `${selection.block.title}: ${selection.wants_to_attend ? 'Oui' : 'Non'}${selectedDate}`;
      })
      .join(' | ');

    const managerName =
      reg.manager_first_name && reg.manager_last_name
        ? anon
          ? anonymizeName(reg.manager_first_name, reg.manager_last_name)
          : `${reg.manager_first_name} ${reg.manager_last_name}`
        : 'N/A';

    worksheet.addRow({
      id: reg.id.substring(0, 12) + '...',
      event_title: reg.event.title,
      institution: reg.institution.name,
      institution_type: formatPublicCategories(reg.institution.type, labels),
      institution_city: reg.institution.address?.city || 'N/A',
      user_name: anon
        ? anonymizeName(reg.user.first_name || '', reg.user.last_name)
        : `${reg.user.first_name || ''} ${reg.user.last_name}`,
      user_email: anon ? anonymizeEmail(reg.user.email) : reg.user.email,
      date: formatDate(reg.date),
      booked_seats: reg.booked_seats,
      category: formatPublicCategories(reg.category, labels),
      grades: formatSchoolGrades(reg.grades, labels),
      age_ranges: formatAgeRanges(reg.age_ranges, labels),
      status: formatRegistrationStatus(reg.status, labels),
      manager_name: managerName,
      manager_email: anon ? anonymizeEmail(reg.manager_email || '') : reg.manager_email || 'N/A',
      manager_phone: anon
        ? anonymizePhone(reg.manager_phone_number)
        : reg.manager_phone_number || 'N/A',
      caretaker_count: reg.caretaker_count || 0,
      aesh_count: reg.aesh_count || 0,
      disabilities: disabilities || 'Aucune',
      registration_blocks: registrationBlocks || 'N/A',
      want_formation: reg.want_formation === null ? 'N/A' : reg.want_formation ? 'Oui' : 'Non',
      want_preparation:
        reg.want_preparation === null ? 'N/A' : reg.want_preparation ? 'Oui' : 'Non',
      comments: reg.comments || 'N/A',
      was_present_comment: reg.was_present_comment || 'N/A',
      created_at: formatDate(reg.created_at),
      updated_at: formatDate(reg.updated_at),
    });
  });

  applyAlternateRowColors(worksheet, 2);

  worksheet.autoFilter = {
    from: 'A1',
    to: 'Y1',
  };
}

// ============================================================================
// Institutions Sheet
// ============================================================================

async function addInstitutionsSheet(
  workbook: ExcelJS.Workbook,
  filters: ExportFilters,
  labels: DynamicLabels,
  options: ExportOptions = {},
) {
  const worksheet = workbook.addWorksheet('Établissements', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const whereClause: Prisma.InstitutionWhereInput = {};
  if (filters.publicCategory) whereClause.type = { has: filters.publicCategory };
  if (filters.institutionId) whereClause.id = filters.institutionId;
  if (filters.schoolGrade) whereClause.grades = { has: filters.schoolGrade };
  if (filters.ageRange) whereClause.age_ranges = { has: filters.ageRange };

  const institutions = await prisma.institution.findMany({
    where: whereClause,
    include: {
      address: true,
      userInstitutions: {
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      },
      registrations: {
        select: { status: true },
      },
      _count: {
        select: {
          registrations: true,
          userInstitutions: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const anon = options.anonymize === true;

  // 22 columns: A-V
  worksheet.columns = [
    { key: 'id', width: 15 },
    { key: 'name', width: 35 },
    { key: 'type', width: 30 },
    { key: 'grades', width: 30 },
    { key: 'age_ranges', width: 30 },
    { key: 'email', width: 30 },
    { key: 'phone', width: 18 },
    { key: 'street', width: 35 },
    { key: 'zip_code', width: 12 },
    { key: 'city', width: 25 },
    { key: 'full_address', width: 50 },
    { key: 'not_listed', width: 30 },
    { key: 'users_count', width: 18 },
    { key: 'users_list', width: 40 },
    { key: 'registrations_total', width: 18 },
    { key: 'reg_pending', width: 18 },
    { key: 'reg_confirmed', width: 20 },
    { key: 'reg_rejected', width: 18 },
    { key: 'reg_cancelled', width: 18 },
    { key: 'is_rep', width: 15 },
    { key: 'created_at', width: 20 },
    { key: 'updated_at', width: 20 },
  ];

  const headerRow = worksheet.addRow([
    'ID',
    'Nom',
    'Type',
    'Niveau(x) scolaire(s)',
    "Tranche(s) d'âge",
    'Email',
    'Téléphone',
    'Rue',
    'Code postal',
    'Ville',
    'Adresse complète',
    'Non répertorié',
    'Nb Utilisateurs',
    'Utilisateurs',
    'Total inscriptions',
    'En attente',
    'Confirmées',
    'Refusées',
    'Annulées',
    'REP',
    'Date de création',
    'Date de modification',
  ]);
  applyHeaderStyle(headerRow);

  institutions.forEach((inst) => {
    const fullAddress = `${inst.address.street || ''}, ${inst.address.zip_code || ''} ${inst.address.city}`;

    // User list
    const usersList = inst.userInstitutions
      .map((ui) =>
        anon
          ? anonymizeName(ui.user.first_name || '', ui.user.last_name)
          : `${ui.user.first_name || ''} ${ui.user.last_name} (${ui.user.email})`,
      )
      .join(', ');

    // Registration breakdown by status
    const regPending = inst.registrations.filter((r) => r.status === 'PENDING').length;
    const regConfirmed = inst.registrations.filter((r) => r.status === 'CONFIRMED').length;
    const regRejected = inst.registrations.filter((r) => r.status === 'REJECTED').length;
    const regCancelled = inst.registrations.filter((r) => r.status === 'CANCELLED').length;

    worksheet.addRow({
      id: inst.id.substring(0, 12) + '...',
      name: inst.name,
      type: formatPublicCategories(inst.type, labels),
      grades: formatSchoolGrades(inst.grades, labels),
      age_ranges: formatAgeRanges(inst.age_ranges, labels),
      email: anon ? anonymizeEmail(inst.email || '') : inst.email || 'N/A',
      phone: anon ? anonymizePhone(inst.phone_number) : inst.phone_number || 'N/A',
      street: inst.address.street,
      zip_code: inst.address.zip_code,
      city: inst.address.city,
      full_address: fullAddress,
      not_listed: inst.not_listed || 'N/A',
      users_count: inst._count.userInstitutions,
      users_list: usersList || 'Aucun',
      registrations_total: inst._count.registrations,
      reg_pending: regPending,
      reg_confirmed: regConfirmed,
      reg_rejected: regRejected,
      reg_cancelled: regCancelled,
      is_rep: inst.is_rep ? 'Oui' : 'Non',
      created_at: formatDate(inst.created_at),
      updated_at: formatDate(inst.updated_at),
    });
  });

  applyAlternateRowColors(worksheet, 2);

  worksheet.autoFilter = {
    from: 'A1',
    to: 'V1',
  };
}

// ============================================================================
// Groups Sheet
// ============================================================================

async function addGroupsSheet(
  workbook: ExcelJS.Workbook,
  filters: ExportFilters,
  labels: DynamicLabels,
  options: ExportOptions = {},
) {
  const worksheet = workbook.addWorksheet('Groupes', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const whereClause: Prisma.GroupWhereInput = {};
  if (filters.publicCategory) whereClause.category = { has: filters.publicCategory };
  if (filters.schoolGrade) whereClause.grades = { has: filters.schoolGrade };
  if (filters.ageRange) whereClause.age_ranges = { has: filters.ageRange };

  const groups = await prisma.group.findMany({
    where: whereClause,
    include: {
      user: {
        select: { first_name: true, last_name: true, email: true },
      },
      disabilities: true,
    },
    orderBy: { name: 'asc' },
  });

  const anon = options.anonymize === true;

  // 10 columns: A-J
  worksheet.columns = [
    { key: 'id', width: 15 },
    { key: 'name', width: 30 },
    { key: 'user_name', width: 25 },
    { key: 'user_email', width: 30 },
    { key: 'students_count', width: 18 },
    { key: 'category', width: 30 },
    { key: 'grades', width: 30 },
    { key: 'age_ranges', width: 30 },
    { key: 'disabilities', width: 40 },
    { key: 'total_disabled', width: 20 },
  ];

  const headerRow = worksheet.addRow([
    'ID',
    'Nom du groupe',
    'Utilisateur',
    'Email utilisateur',
    'Nb élèves',
    'Catégorie(s)',
    'Niveau(x) scolaire(s)',
    "Tranche(s) d'âge",
    'Besoins accessibilité',
    'Total élèves avec handicap',
  ]);
  applyHeaderStyle(headerRow);

  groups.forEach((group) => {
    const disabilities = group.disabilities
      .map((d) => `${formatAccessibilityType(d.type, labels)} (${d.count})`)
      .join(', ');
    const totalDisabled = group.disabilities.reduce((sum, d) => sum + d.count, 0);

    worksheet.addRow({
      id: group.id.substring(0, 12) + '...',
      name: group.name || 'N/A',
      user_name: anon
        ? anonymizeName(group.user.first_name || '', group.user.last_name)
        : `${group.user.first_name || ''} ${group.user.last_name}`,
      user_email: anon ? anonymizeEmail(group.user.email) : group.user.email,
      students_count: group.students_count,
      category: formatPublicCategories(group.category, labels),
      grades: formatSchoolGrades(group.grades, labels),
      age_ranges: formatAgeRanges(group.age_ranges, labels),
      disabilities: disabilities || 'Aucune',
      total_disabled: totalDisabled,
    });
  });

  applyAlternateRowColors(worksheet, 2);

  worksheet.autoFilter = {
    from: 'A1',
    to: 'J1',
  };
}

// ============================================================================
// Statistics Sheet (enriched)
// ============================================================================

async function addStatisticsSheet(
  workbook: ExcelJS.Workbook,
  filters: ExportFilters,
  labels: DynamicLabels,
) {
  const worksheet = workbook.addWorksheet('Statistiques', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // ── Build WHERE clauses ──
  const userWhereClause: Prisma.UserWhereInput = {};
  if (filters.role) userWhereClause.role = filters.role;
  if (filters.dateFrom || filters.dateTo) {
    userWhereClause.created_at = {};
    if (filters.dateFrom) userWhereClause.created_at.gte = new Date(filters.dateFrom);
    if (filters.dateTo) userWhereClause.created_at.lte = new Date(filters.dateTo);
  }

  const eventWhereClause: Prisma.EventWhereInput = {};
  if (filters.eventStatus) eventWhereClause.status = filters.eventStatus;
  if (filters.publicCategory) eventWhereClause.category = { has: filters.publicCategory };
  if (filters.eventType) eventWhereClause.type = { has: filters.eventType };
  if (filters.schoolGrade) eventWhereClause.grades = { has: filters.schoolGrade };
  if (filters.ageRange) eventWhereClause.age_ranges = { has: filters.ageRange };
  if (filters.dateFrom || filters.dateTo) {
    eventWhereClause.created_at = {};
    if (filters.dateFrom) eventWhereClause.created_at.gte = new Date(filters.dateFrom);
    if (filters.dateTo) eventWhereClause.created_at.lte = new Date(filters.dateTo);
  }

  const institutionWhereClause: Prisma.InstitutionWhereInput = {};
  if (filters.publicCategory) institutionWhereClause.type = { has: filters.publicCategory };
  if (filters.schoolGrade) institutionWhereClause.grades = { has: filters.schoolGrade };
  if (filters.ageRange) institutionWhereClause.age_ranges = { has: filters.ageRange };

  const registrationWhereClause: Prisma.RegistrationWhereInput = {};
  if (filters.registrationStatus) registrationWhereClause.status = filters.registrationStatus;
  if (filters.eventId) registrationWhereClause.event_id = filters.eventId;
  if (filters.institutionId) registrationWhereClause.institution_id = filters.institutionId;
  if (filters.publicCategory) registrationWhereClause.category = { has: filters.publicCategory };
  if (filters.schoolGrade) registrationWhereClause.grades = { has: filters.schoolGrade };
  if (filters.ageRange) registrationWhereClause.age_ranges = { has: filters.ageRange };
  if (filters.dateFrom || filters.dateTo) {
    registrationWhereClause.created_at = {};
    if (filters.dateFrom) registrationWhereClause.created_at.gte = new Date(filters.dateFrom);
    if (filters.dateTo) registrationWhereClause.created_at.lte = new Date(filters.dateTo);
  }

  // ── Fetch data in parallel ──
  const [
    totalUsers,
    totalEvents,
    totalInstitutions,
    totalRegistrations,
    registrationsByStatus,
    usersByRole,
    eventsCapacity,
    allEvents,
    allRegistrations,
    accessibilityData,
    topInstitutionsRaw,
    totalGroups,
  ] = await Promise.all([
    prisma.user.count({ where: userWhereClause }),
    prisma.event.count({ where: eventWhereClause }),
    prisma.institution.count({ where: institutionWhereClause }),
    prisma.registration.count({ where: registrationWhereClause }),
    prisma.registration.groupBy({
      by: ['status'],
      where: registrationWhereClause,
      _count: true,
    }),
    prisma.user.groupBy({
      by: ['role'],
      where: userWhereClause,
      _count: true,
    }),
    prisma.event.aggregate({
      where: eventWhereClause,
      _sum: { total_seats: true, booked_seats: true },
      _count: true,
    }),
    prisma.event.findMany({
      where: eventWhereClause,
      select: {
        type: true,
        category: true,
        total_seats: true,
        booked_seats: true,
        status: true,
      },
    }),
    prisma.registration.findMany({
      where: registrationWhereClause,
      select: {
        category: true,
        booked_seats: true,
        institution_id: true,
      },
    }),
    prisma.registrationDisability.findMany({
      where: { registration: registrationWhereClause },
      select: { type: true, count: true },
    }),
    prisma.registration.groupBy({
      by: ['institution_id'],
      where: registrationWhereClause,
      _count: { _all: true },
      _sum: { booked_seats: true },
      orderBy: { _count: { institution_id: 'desc' } },
      take: 10,
    }),
    prisma.group.count(),
  ]);

  // ── Derived statistics ──

  // Events by EventType
  const eventTypeCount: Record<string, number> = {};
  allEvents.forEach((e) =>
    e.type.forEach((t) => {
      eventTypeCount[t] = (eventTypeCount[t] || 0) + 1;
    }),
  );

  // Events by PublicCategory
  const eventCategoryCount: Record<string, number> = {};
  allEvents.forEach((e) =>
    e.category.forEach((c) => {
      eventCategoryCount[c] = (eventCategoryCount[c] || 0) + 1;
    }),
  );

  // Registrations by PublicCategory
  const regCategoryCount: Record<string, number> = {};
  const regCategorySeats: Record<string, number> = {};
  allRegistrations.forEach((r) =>
    r.category.forEach((c) => {
      regCategoryCount[c] = (regCategoryCount[c] || 0) + 1;
      regCategorySeats[c] = (regCategorySeats[c] || 0) + r.booked_seats;
    }),
  );

  // Accessibility needs summary
  const accessibilitySummary: Record<string, number> = {};
  accessibilityData.forEach((d) => {
    accessibilitySummary[d.type] = (accessibilitySummary[d.type] || 0) + d.count;
  });

  // Fill rate per event
  const fillRates = allEvents
    .filter((e) => e.total_seats > 0)
    .map((e) => Math.round((e.booked_seats / e.total_seats) * 100));
  const avgFillRate =
    fillRates.length > 0 ? Math.round(fillRates.reduce((a, b) => a + b, 0) / fillRates.length) : 0;
  const maxFillRate = fillRates.length > 0 ? Math.max(...fillRates) : 0;
  const minFillRate = fillRates.length > 0 ? Math.min(...fillRates) : 0;

  // Events by status
  const eventStatusCount: Record<string, number> = {};
  allEvents.forEach((e) => {
    eventStatusCount[e.status] = (eventStatusCount[e.status] || 0) + 1;
  });

  // Top 10 institutions (need names)
  const topInstitutionIds = topInstitutionsRaw.map((t) => t.institution_id);
  const topInstitutionNames =
    topInstitutionIds.length > 0
      ? await prisma.institution.findMany({
          where: { id: { in: topInstitutionIds } },
          select: { id: true, name: true },
        })
      : [];
  const instNameMap = new Map(topInstitutionNames.map((i) => [i.id, i.name]));

  // ── Build the sheet ──
  worksheet.columns = [
    { key: 'metric', width: 45 },
    { key: 'value', width: 25 },
  ];

  const addSectionHeader = (title: string) => {
    const row = worksheet.addRow([title, '']);
    row.font = { bold: true, size: 14 };
    row.height = 30;
    worksheet.mergeCells(`A${row.number}:B${row.number}`);
  };

  const addStat = (label: string, value: string | number) => {
    worksheet.addRow([label, value]);
  };

  const addSpacer = () => worksheet.addRow(['', '']);

  // ── Section: Overview ──
  addSectionHeader("VUE D'ENSEMBLE");
  addStat('Total Utilisateurs', totalUsers);
  addStat('Total Événements', totalEvents);
  addStat('Total Établissements', totalInstitutions);
  addStat('Total Inscriptions', totalRegistrations);
  addStat('Total Groupes', totalGroups);
  addSpacer();

  // ── Section: Registrations by status ──
  addSectionHeader('INSCRIPTIONS PAR STATUT');
  registrationsByStatus.forEach((stat) => {
    addStat(formatRegistrationStatus(stat.status, labels), stat._count);
  });
  addSpacer();

  // ── Section: Users by role ──
  addSectionHeader('UTILISATEURS PAR RÔLE');
  usersByRole.forEach((stat) => {
    addStat(formatRole(stat.role), stat._count);
  });
  addSpacer();

  // ── Section: Event capacity ──
  addSectionHeader('CAPACITÉ DES ÉVÉNEMENTS');
  addStat("Nombre d'événements", eventsCapacity._count);
  addStat('Capacité totale', eventsCapacity._sum.total_seats || 0);
  addStat('Places réservées', eventsCapacity._sum.booked_seats || 0);
  const occupancyRate = eventsCapacity._sum.total_seats
    ? Math.round(((eventsCapacity._sum.booked_seats || 0) / eventsCapacity._sum.total_seats) * 100)
    : 0;
  addStat("Taux d'occupation global", `${occupancyRate}%`);
  addStat("Taux d'occupation moyen par événement", `${avgFillRate}%`);
  addStat("Taux d'occupation max", `${maxFillRate}%`);
  addStat("Taux d'occupation min", `${minFillRate}%`);
  addSpacer();

  // ── Section: Events by status ──
  addSectionHeader('ÉVÉNEMENTS PAR STATUT');
  Object.entries(eventStatusCount).forEach(([status, count]) => {
    addStat(formatEventStatus(status as EventStatus, labels), count);
  });
  addSpacer();

  // ── Section: Events by type ──
  addSectionHeader("ÉVÉNEMENTS PAR TYPE D'ÉVÉNEMENT");
  Object.entries(eventTypeCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      addStat(labels.eventTypeLabels[type] || type, count);
    });
  addSpacer();

  // ── Section: Events by public category ──
  addSectionHeader('ÉVÉNEMENTS PAR CATÉGORIE DE PUBLIC');
  Object.entries(eventCategoryCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      addStat(labels.publicCategoryLabels[cat] || cat, count);
    });
  addSpacer();

  // ── Section: Registrations by public category ──
  addSectionHeader('INSCRIPTIONS PAR CATÉGORIE DE PUBLIC');
  Object.entries(regCategoryCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      const seats = regCategorySeats[cat] || 0;
      addStat(
        labels.publicCategoryLabels[cat] || cat,
        `${count} inscription(s), ${seats} place(s)`,
      );
    });
  addSpacer();

  // ── Section: Accessibility needs ──
  addSectionHeader('BESOINS EN ACCESSIBILITÉ');
  const totalAccessibilityNeeds = Object.values(accessibilitySummary).reduce((a, b) => a + b, 0);
  addStat('Total élèves avec besoin', totalAccessibilityNeeds);
  Object.entries(accessibilitySummary)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      addStat(formatAccessibilityType(type as Accessibility, labels), count);
    });
  addSpacer();

  // ── Section: Top 10 institutions ──
  addSectionHeader("TOP 10 ÉTABLISSEMENTS (par nombre d'inscriptions)");
  topInstitutionsRaw.forEach((entry, idx) => {
    const name = instNameMap.get(entry.institution_id) || entry.institution_id;
    addStat(
      `${idx + 1}. ${name}`,
      `${entry._count._all} inscription(s), ${entry._sum.booked_seats || 0} place(s)`,
    );
  });

  // ── Styling ──
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 0) {
      row.eachCell((cell, colNumber) => {
        if (colNumber === 1 && !(cell.font?.size && cell.font.size >= 14)) {
          cell.font = { ...(cell.font || {}), bold: true };
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
        };
      });
    }
  });
}
