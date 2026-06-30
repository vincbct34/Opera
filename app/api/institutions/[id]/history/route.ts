import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import {
  calculateInstitutionHistoryWithCache,
  formatHistorySummary,
  getHistoryHealth,
  generateHistoryReport,
} from '@/lib/events/registrationAnalytics';
import { getRegistrationStatusLabelsMapAsync } from '@/lib/config/labelMappingsServer';
import type { InstitutionHistory } from '@/lib/scoring/scoringEngine';

/**
 * GET /api/institutions/[id]/history
 * Récupère l'historique complet d'une institution (admin only).
 * Query params:
 *   - detailed (optional): true/false pour inclure l'historique détaillé (default: true)
 * @param request - The incoming request.
 * @param params - The route parameters containing the institution ID.
 * @returns JSON response with the institution history.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      // Vérifier que l'institution existe
      const institution = await prisma.institution.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          type: true,
          is_rep: true,
        },
      });

      if (!institution) {
        return NextResponse.json(
          {
            success: false,
            error: 'Institution introuvable',
          },
          { status: 404 },
        );
      }

      // Calculer l'historique (avec cache)
      const history = await calculateInstitutionHistoryWithCache(id, prisma);

      // Fetch dynamic labels for the report
      const registrationStatusLabels = await getRegistrationStatusLabelsMapAsync();

      const { searchParams } = new URL(request.url);
      const includeDetailed = searchParams.get('detailed') !== 'false';

      // Préparer la réponse
      const response: {
        success: boolean;
        institution: { id: string; name: string };
        history: Partial<InstitutionHistory> & {
          health?: unknown;
          summary?: string;
          report?: string;
        };
      } = {
        success: true,
        institution,
        history: {
          institutionId: history.institutionId,
          totalRegistrations: history.totalRegistrations,
          confirmedCount: history.confirmedCount,
          attendedCount: history.attendedCount,
          noShowCount: history.noShowCount,
          cancelledCount: history.cancelledCount,
          attendanceRate: history.attendanceRate,
          confirmationRate: history.confirmationRate,
          lastAttendedDate: history.lastAttendedDate,
          monthsSinceLastAttendance: history.monthsSinceLastAttendance,
          recentNoShow: history.recentNoShow,
          summary: formatHistorySummary(history),
          health: getHistoryHealth(history),
          report: generateHistoryReport(history, registrationStatusLabels),
        },
      };

      // Ajouter l'historique détaillé si demandé
      if (includeDetailed) {
        response.history.recentRegistrations = history.recentRegistrations;
      }

      return NextResponse.json(response);
    } catch (error) {
      logger.error('Error fetching institution history:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch institution history',
        },
        { status: 500 },
      );
    }
  });
}
