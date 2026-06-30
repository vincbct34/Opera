import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import ExcelJS from 'exceljs';
import { createScoringEngine } from '@/lib/scoring/scoringEngine';
import { calculateMultipleInstitutionHistories } from '@/lib/events/registrationAnalytics';
import type { CriterionConfig } from '@/lib/scoring/scoringEngine';
import { CRITERIA_DEFINITIONS } from '@/lib/scoring/criteriaDefinitions';
import type { ScoringCriterionType, ParameterValue } from '@/lib/scoring/criteriaDefinitions';
import type { RegistrationStatus, PublicCategory } from '@/app/generated/prisma';

interface ScoreBreakdownItem {
  criterion: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
}

interface RegistrationWithScore {
  id: string;
  user: {
    first_name: string | null;
    last_name: string;
    email: string;
    phone_number: string | null;
  };
  institution: {
    name: string;
    type: PublicCategory[];
    is_rep: boolean;
  };
  booked_seats: number;
  caretaker_count: number | null;
  status: RegistrationStatus;
  created_at: Date;
  score: number;
  scoreBreakdown: ScoreBreakdownItem[];
  history?: {
    totalRegistrations: number;
    attendanceRate: number;
    monthsSinceLastAttendance: number | null;
  };
}

/**
 * GET /api/admin/events/[id]/export-scored
 * Exporte les inscriptions d'un événement avec leurs scores au format Excel
 * Query params:
 *   - configId (optional): ID de la configuration de scoring à utiliser
 */
/**
 * GET /api/admin/events/[id]/export-scored
 * Exports event registrations with their scores in Excel format.
 * Query params:
 *   - configId (optional): ID of the scoring configuration to use.
 * @param request - The incoming request.
 * @param context - The route context containing the event ID.
 * @returns Excel file download or error response.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  return requireAdmin(request as AuthenticatedRequest, async () => {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('configId');

    try {
      // Find event by ID
      const event = await prisma.event.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          event_dates: true,
        },
      });

      if (!event) {
        logger.warn('Event not found for export', sanitizeLogArgs({ id }));
        return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 });
      }

      const eventId = event.id;

      // Récupérer la configuration de scoring
      let scoringConfig;
      if (configId) {
        scoringConfig = await prisma.scoringConfiguration.findUnique({
          where: { id: configId },
          include: { criteria: { orderBy: { order: 'asc' } } },
        });
      } else {
        scoringConfig = await prisma.scoringConfiguration.findFirst({
          where: { is_default: true },
          include: { criteria: { orderBy: { order: 'asc' } } },
        });
      }

      if (!scoringConfig) {
        return NextResponse.json(
          { error: 'Configuration de scoring introuvable' },
          { status: 404 },
        );
      }

      // Récupérer les inscriptions
      const registrations = await prisma.registration.findMany({
        where: { event_id: eventId },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone_number: true,
            },
          },
          institution: {
            select: {
              id: true,
              name: true,
              type: true,
              is_rep: true,
            },
          },
        },
        orderBy: { created_at: 'asc' },
      });

      // Vérifier qu'il y a au moins une inscription
      if (registrations.length === 0) {
        return NextResponse.json(
          { error: 'Aucune inscription à exporter pour cet événement' },
          { status: 400 },
        );
      }

      // Calculer les historiques
      const institutionIds = [
        ...new Set(registrations.map((r: { institution_id: string }) => r.institution_id)),
      ];
      const historiesMap = await calculateMultipleInstitutionHistories(
        institutionIds as string[],
        prisma,
      );

      // Préparer la configuration pour le moteur
      const criteriaConfig: CriterionConfig[] = scoringConfig.criteria
        .filter((c) => c.type in CRITERIA_DEFINITIONS)
        .map((c) => ({
          type: c.type as ScoringCriterionType,
          enabled: c.enabled,
          weight: c.weight,
          parameters: c.parameters as Record<string, ParameterValue>,
        }));

      const engine = createScoringEngine(criteriaConfig);

      // Calculer les scores
      const registrationsWithScores: RegistrationWithScore[] = registrations.map(
        (reg: (typeof registrations)[number]) => {
          const history = historiesMap.get(reg.institution_id);
          const result = engine.calculateScore({
            registration: reg,
            institutionHistory:
              history ||
              ({
                institutionId: reg.institution_id,
                totalRegistrations: 0,
                confirmedCount: 0,
                attendedCount: 0,
                noShowCount: 0,
                cancelledCount: 0,
                attendanceRate: 0,
                confirmationRate: 0,
                lastAttendedDate: null,
                monthsSinceLastAttendance: null,
                recentNoShow: false,
                recentRegistrations: [],
              } as const),
          });

          return {
            id: reg.id,
            user: reg.user,
            institution: reg.institution,
            booked_seats: reg.booked_seats,
            caretaker_count: reg.caretaker_count,
            status: reg.status,
            created_at: reg.created_at,
            score: result.normalizedScore,
            scoreBreakdown: result.breakdown.map((item) => ({
              criterion: item.type,
              weight: item.weight,
              rawScore: item.rawScore,
              weightedScore: item.weightedScore,
            })),
            history,
          };
        },
      );

      // Trier par score décroissant
      registrationsWithScores.sort((a, b) => b.score - a.score);

      // Générer le fichier Excel
      const buffer = await generateScoredExcelReport(
        {
          id: event.id,
          title: event.title,
          date: event.event_dates[0] || new Date(),
        },
        scoringConfig,
        registrationsWithScores,
      );

      logger.info('Scored export generated successfully', sanitizeLogArgs({ eventId }));

      // Créer un nom de fichier sûr
      const safeTitle = event.title
        .replace(/[^a-z0-9]+/gi, '-') // Remplacer les caractères spéciaux par des tirets
        .replace(/^-+|-+$/g, '') // Supprimer les tirets au début et à la fin
        .substring(0, 50); // Limiter la longueur
      const filename = `export-scores-${safeTitle}-${new Date().toISOString().split('T')[0]}.xlsx`;

      return new NextResponse(buffer as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      logger.error('Error generating scored export', sanitizeLogArgs({ id, error }));
      return NextResponse.json(
        { error: "Erreur lors de la génération de l'export" },
        { status: 500 },
      );
    }
  });
}

async function generateScoredExcelReport(
  event: { id: string; title: string; date: Date },
  config: {
    id: string;
    name: string;
    is_default: boolean;
    criteria: Array<{
      type: string;
      enabled: boolean;
      weight: number;
      parameters: unknown;
    }>;
  },
  registrations: RegistrationWithScore[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Service culturel - Plateforme web';
  workbook.created = new Date();

  // Styles
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

  const titleStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 14 },
    alignment: { vertical: 'middle', horizontal: 'left' },
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

  // Sheet 1: Configuration
  const configSheet = workbook.addWorksheet('Configuration de tri');

  configSheet.getCell('A1').value = 'Configuration de tri des inscriptions';
  configSheet.getCell('A1').style = titleStyle as ExcelJS.Style;
  configSheet.mergeCells('A1:D1');

  configSheet.addRow([]);
  configSheet.addRow(['Nom de la configuration:', config.name]);
  configSheet.addRow(['Par défaut:', config.is_default ? 'Oui' : 'Non']);
  configSheet.addRow(['Événement:', event.title]);
  configSheet.addRow(['Date:', event.date.toLocaleDateString('fr-FR')]);
  configSheet.addRow([]);

  // Critères
  configSheet.addRow(['Critères de scoring:']);
  const criteriaHeaderRow = configSheet.addRow(['Critère', 'Activé', 'Poids (%)', 'Paramètres']);
  criteriaHeaderRow.eachCell((cell) => {
    cell.style = headerStyle as ExcelJS.Style;
  });

  config.criteria.forEach((c) => {
    const row = configSheet.addRow([
      c.type,
      c.enabled ? 'Oui' : 'Non',
      c.weight,
      JSON.stringify(c.parameters),
    ]);
    row.eachCell((cell) => {
      cell.style = cellStyle as ExcelJS.Style;
    });
  });

  configSheet.getColumn(1).width = 30;
  configSheet.getColumn(2).width = 12;
  configSheet.getColumn(3).width = 12;
  configSheet.getColumn(4).width = 40;

  // Sheet 2: Inscriptions avec scores
  const registrationsSheet = workbook.addWorksheet('Inscriptions triées');

  registrationsSheet.getCell('A1').value = 'Inscriptions triées par score';
  registrationsSheet.getCell('A1').style = titleStyle as ExcelJS.Style;
  registrationsSheet.mergeCells('A1:M1');

  registrationsSheet.addRow([]);

  const regHeaderRow = registrationsSheet.addRow([
    'Rang',
    'Score',
    'Institution',
    'REP+',
    'Nom',
    'Prénom',
    'Email',
    'Téléphone',
    'Places',
    'Accomp.',
    'Statut',
    'Participations',
    'Taux présence (%)',
  ]);
  regHeaderRow.eachCell((cell) => {
    cell.style = headerStyle as ExcelJS.Style;
  });

  registrations.forEach((reg, index) => {
    const row = registrationsSheet.addRow([
      index + 1,
      Math.round(reg.score),
      reg.institution.name,
      reg.institution.is_rep ? 'Oui' : 'Non',
      reg.user.last_name,
      reg.user.first_name,
      reg.user.email,
      reg.user.phone_number || '',
      reg.booked_seats,
      reg.caretaker_count || 0,
      reg.status,
      reg.history?.totalRegistrations || 0,
      reg.history ? Math.round(reg.history.attendanceRate) : 0,
    ]);

    row.eachCell((cell, colNumber) => {
      cell.style = cellStyle as ExcelJS.Style;

      // Colorer le score selon la valeur
      if (colNumber === 2) {
        const score = reg.score;
        if (score >= 75) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF10B981' },
          };
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        } else if (score >= 50) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF3B82F6' },
          };
          cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        } else if (score >= 25) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF59E0B' },
          };
        } else {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEF4444' },
          };
          cell.font = { color: { argb: 'FFFFFFFF' } };
        }
      }
    });
  });

  // Largeurs des colonnes
  registrationsSheet.getColumn(1).width = 8;
  registrationsSheet.getColumn(2).width = 10;
  registrationsSheet.getColumn(3).width = 30;
  registrationsSheet.getColumn(4).width = 8;
  registrationsSheet.getColumn(5).width = 20;
  registrationsSheet.getColumn(6).width = 20;
  registrationsSheet.getColumn(7).width = 30;
  registrationsSheet.getColumn(8).width = 15;
  registrationsSheet.getColumn(9).width = 10;
  registrationsSheet.getColumn(10).width = 10;
  registrationsSheet.getColumn(11).width = 15;
  registrationsSheet.getColumn(12).width = 15;
  registrationsSheet.getColumn(13).width = 18;

  // Sheet 3: Détails des scores
  const detailsSheet = workbook.addWorksheet('Détails des scores');

  detailsSheet.getCell('A1').value = 'Détails du calcul des scores';
  detailsSheet.getCell('A1').style = titleStyle as ExcelJS.Style;
  detailsSheet.mergeCells('A1:F1');

  detailsSheet.addRow([]);

  registrations.forEach((reg, index) => {
    detailsSheet.addRow([
      `${index + 1}. ${reg.user.first_name} ${reg.user.last_name} - ${reg.institution.name}`,
    ]);
    detailsSheet.mergeCells(`A${detailsSheet.lastRow!.number}:F${detailsSheet.lastRow!.number}`);
    detailsSheet.getRow(detailsSheet.lastRow!.number).font = { bold: true, size: 12 };

    const detailHeaderRow = detailsSheet.addRow([
      'Critère',
      'Poids (%)',
      'Score brut',
      'Score pondéré',
    ]);
    detailHeaderRow.eachCell((cell) => {
      cell.style = headerStyle as ExcelJS.Style;
    });

    reg.scoreBreakdown.forEach((item) => {
      const row = detailsSheet.addRow([
        item.criterion,
        item.weight,
        Math.round(item.rawScore),
        Math.round(item.weightedScore * 10) / 10,
      ]);
      row.eachCell((cell) => {
        cell.style = cellStyle as ExcelJS.Style;
      });
    });

    const totalRow = detailsSheet.addRow(['SCORE TOTAL', '', '', Math.round(reg.score)]);
    totalRow.eachCell((cell) => {
      cell.style = {
        ...cellStyle,
        font: { bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } },
      } as ExcelJS.Style;
    });

    detailsSheet.addRow([]);
  });

  detailsSheet.getColumn(1).width = 40;
  detailsSheet.getColumn(2).width = 15;
  detailsSheet.getColumn(3).width = 15;
  detailsSheet.getColumn(4).width = 18;

  // Sheet 4: Statistiques
  const statsSheet = workbook.addWorksheet('Statistiques');

  statsSheet.getCell('A1').value = 'Statistiques générales';
  statsSheet.getCell('A1').style = titleStyle as ExcelJS.Style;
  statsSheet.mergeCells('A1:B1');

  statsSheet.addRow([]);

  const stats = {
    total: registrations.length,
    avgScore: Math.round(registrations.reduce((sum, r) => sum + r.score, 0) / registrations.length),
    minScore: Math.round(Math.min(...registrations.map((r) => r.score))),
    maxScore: Math.round(Math.max(...registrations.map((r) => r.score))),
    scoreHigh: registrations.filter((r) => r.score >= 75).length,
    scoreMedium: registrations.filter((r) => r.score >= 50 && r.score < 75).length,
    scoreLow: registrations.filter((r) => r.score < 50).length,
    pending: registrations.filter((r) => r.status === 'PENDING').length,
    confirmed: registrations.filter((r) => r.status === 'CONFIRMED').length,
    rejected: registrations.filter((r) => r.status === 'REJECTED').length,
    totalSeats: registrations.reduce((sum, r) => sum + r.booked_seats, 0),
  };

  statsSheet.addRow(["Nombre total d'inscriptions:", stats.total]);
  statsSheet.addRow([]);
  statsSheet.addRow(['Score moyen:', stats.avgScore]);
  statsSheet.addRow(['Score minimum:', stats.minScore]);
  statsSheet.addRow(['Score maximum:', stats.maxScore]);
  statsSheet.addRow([]);
  statsSheet.addRow(['Scores élevés (75-100):', stats.scoreHigh]);
  statsSheet.addRow(['Scores moyens (50-74):', stats.scoreMedium]);
  statsSheet.addRow(['Scores faibles (<50):', stats.scoreLow]);
  statsSheet.addRow([]);
  statsSheet.addRow(['Inscriptions en attente:', stats.pending]);
  statsSheet.addRow(['Inscriptions confirmées:', stats.confirmed]);
  statsSheet.addRow(['Inscriptions rejetées:', stats.rejected]);
  statsSheet.addRow([]);
  statsSheet.addRow(['Total de places réservées:', stats.totalSeats]);

  statsSheet.getColumn(1).width = 35;
  statsSheet.getColumn(2).width = 15;

  // Générer le buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
