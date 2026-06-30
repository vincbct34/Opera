import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { z } from 'zod';
import { createScoringEngine } from '@/lib/scoring/scoringEngine';
import { calculateMultipleInstitutionHistories } from '@/lib/events/registrationAnalytics';
import type { CriterionConfig } from '@/lib/scoring/scoringEngine';
import { CRITERIA_DEFINITIONS } from '@/lib/scoring/criteriaDefinitions';
import type { ScoringCriterionType, ParameterValue } from '@/lib/scoring/criteriaDefinitions';

const PreviewSchema = z.object({
  eventId: z.string(),
});

/**
 * POST /api/admin/scoring-config/[id]/preview
 * Prévisualise les scores d'un événement avec cette configuration
 */
/**
 * POST /api/admin/scoring-config/[id]/preview
 * Previews scores for an event using a specific scoring configuration.
 * @param request - The incoming request containing the event ID.
 * @param params - The route params containing the configuration ID.
 * @returns JSON response with score preview and statistics.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      const body = await request.json();
      const { eventId } = PreviewSchema.parse(body);

      // Récupérer la configuration
      const configuration = await prisma.scoringConfiguration.findUnique({
        where: { id },
        include: {
          criteria: {
            where: { enabled: true },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!configuration) {
        return NextResponse.json(
          {
            success: false,
            error: 'Configuration introuvable',
          },
          { status: 404 },
        );
      }

      // Récupérer l'événement pour les données de catégorie
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          category: true,
          grades: true,
          age_ranges: true,
        },
      });

      // Récupérer les inscriptions de l'événement
      const registrations = await prisma.registration.findMany({
        where: { event_id: eventId },
        include: {
          institution: {
            select: {
              id: true,
              name: true,
              type: true,
              is_rep: true,
              address: {
                select: {
                  city: true,
                  zip_code: true,
                },
              },
            },
          },
          disabilities: true,
        },
        orderBy: { created_at: 'desc' },
      });

      if (registrations.length === 0) {
        return NextResponse.json({
          success: true,
          preview: [],
          message: 'Aucune inscription trouvée pour cet événement',
        });
      }

      // Récupérer l'historique de toutes les institutions
      const institutionIds = [
        ...new Set(registrations.map((r: { institution_id: string }) => r.institution_id)),
      ];
      const historiesMap = await calculateMultipleInstitutionHistories(
        institutionIds as string[],
        prisma,
      );

      // Préparer la configuration pour le moteur
      const criteriaConfig: CriterionConfig[] = configuration.criteria
        .filter((c) => c.type in CRITERIA_DEFINITIONS)
        .map((c) => ({
          type: c.type as ScoringCriterionType,
          enabled: c.enabled,
          weight: c.weight,
          parameters: c.parameters as Record<string, ParameterValue>,
        }));

      const engine = createScoringEngine(criteriaConfig);

      // Calculer les scores
      const preview = registrations.map((reg: (typeof registrations)[number]) => {
        const history = historiesMap.get(reg.institution_id);

        if (!history) {
          return {
            registrationId: reg.id,
            institutionId: reg.institution_id,
            institutionName: reg.institution.name,
            score: 0,
            breakdown: [],
            error: 'Historique introuvable',
          };
        }

        const result = engine.calculateScore({
          registration: {
            id: reg.id,
            user_id: reg.user_id,
            institution_id: reg.institution_id,
            event_id: reg.event_id,
            date: reg.date,
            booked_seats: reg.booked_seats,
            caretaker_count: reg.caretaker_count,
            comments: reg.comments,
            status: reg.status,
            created_at: reg.created_at,
            institution: {
              id: reg.institution.id,
              name: reg.institution.name,
              type: reg.institution.type,
              is_rep: reg.institution.is_rep,
              address: reg.institution.address
                ? {
                    city: reg.institution.address.city,
                    zip_code: reg.institution.address.zip_code,
                  }
                : undefined,
            },
            event: event
              ? {
                  id: event.id,
                  category: event.category,
                  grades: event.grades,
                  age_ranges: event.age_ranges,
                }
              : undefined,
            disabilities: reg.disabilities,
            aesh_count: reg.aesh_count ?? null,
            category: reg.category || [],
            grades: reg.grades || [],
            age_ranges: reg.age_ranges || [],
          },
          institutionHistory: history,
        });

        return {
          registrationId: reg.id,
          institutionId: reg.institution_id,
          institutionName: reg.institution.name,
          institutionType: reg.institution.type,
          isRep: reg.institution.is_rep,
          status: reg.status,
          bookedSeats: reg.booked_seats,
          score: result.normalizedScore,
          breakdown: result.breakdown,
          history: {
            totalRegistrations: history.totalRegistrations,
            attendanceRate: history.attendanceRate,
            monthsSinceLastAttendance: history.monthsSinceLastAttendance,
          },
        };
      });

      // Trier par score décroissant
      preview.sort((a: { score: number }, b: { score: number }) => b.score - a.score);

      // Statistiques du preview
      const stats = {
        totalRegistrations: preview.length,
        scoreDistribution: {
          excellent: preview.filter((p: { score: number }) => p.score >= 75).length,
          good: preview.filter((p: { score: number }) => p.score >= 50 && p.score < 75).length,
          fair: preview.filter((p: { score: number }) => p.score >= 25 && p.score < 50).length,
          poor: preview.filter((p: { score: number }) => p.score < 25).length,
        },
        averageScore:
          preview.reduce((sum: number, p: { score: number }) => sum + p.score, 0) /
            preview.length || 0,
      };

      return NextResponse.json({
        success: true,
        configuration: {
          id: configuration.id,
          name: configuration.name,
          totalWeight: engine.getTotalWeight(),
          isValid: engine.isConfigValid(),
        },
        preview,
        stats,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Données invalides',
            details: error.issues,
          },
          { status: 400 },
        );
      }

      logger.error('Error previewing scoring configuration:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to preview scoring configuration',
        },
        { status: 500 },
      );
    }
  });
}
