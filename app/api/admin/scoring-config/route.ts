import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { logAdminAccess, logDataModification } from '@/lib/security/securityLogger';
import { z } from 'zod';
import { CRITERIA_DEFINITIONS } from '@/lib/scoring/criteriaDefinitions';
import { CreateScoringConfigSchema } from '@/lib/validation/validationSchemas';
import { ScoringCriterionType } from '@/app/generated/prisma/enums';

/**
 * GET /api/admin/scoring-config
 * Lists all scoring configurations.
 * @param request - The incoming request.
 * @returns JSON response with a list of scoring configurations.
 */
export async function GET(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async (req) => {
    try {
      // Log admin access
      if (req.user) {
        await logAdminAccess(req.user.id, request, 'List scoring configs');
      }
      const configurations = await prisma.scoringConfiguration.findMany({
        include: {
          criteria: {
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
      });

      // Enrichir chaque critère avec son isPenalty flag depuis les définitions
      const enrichedConfigurations = configurations.map((config) => ({
        ...config,
        criteria: config.criteria.map((criterion) => {
          const definition =
            CRITERIA_DEFINITIONS[criterion.type as keyof typeof CRITERIA_DEFINITIONS];
          return {
            ...criterion,
            isPenalty: definition?.isPenalty ?? false,
          };
        }),
      }));

      return NextResponse.json({
        success: true,
        configurations: enrichedConfigurations,
      });
    } catch (error) {
      logger.error('Error fetching scoring configurations:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch scoring configurations',
        },
        { status: 500 },
      );
    }
  });
}

/**
 * POST /api/admin/scoring-config
 * Creates a new scoring configuration.
 * @param request - The incoming request containing configuration data.
 * @returns JSON response with the created configuration.
 */
export async function POST(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async (req) => {
    try {
      const body = await request.json();

      // Valider les données
      const validatedData = CreateScoringConfigSchema.parse(body);

      // Vérifier que les poids totaux font 100%
      const enabledCriteria = validatedData.criteria.filter((c) => c.enabled);
      const totalWeight = enabledCriteria.reduce((sum, c) => sum + Math.abs(c.weight), 0);

      if (totalWeight !== 100) {
        return NextResponse.json(
          {
            success: false,
            error: `Le poids total des critères activés doit être égal à 100% (actuellement: ${totalWeight}%)`,
          },
          { status: 400 },
        );
      }

      // Vérifier que tous les types de critères existent
      for (const criterion of validatedData.criteria) {
        if (!CRITERIA_DEFINITIONS[criterion.type as ScoringCriterionType]) {
          return NextResponse.json(
            {
              success: false,
              error: `Type de critère invalide: ${criterion.type}`,
            },
            { status: 400 },
          );
        }
      }

      // Si event_id est fourni, vérifier que l'événement existe
      if (validatedData.event_id) {
        const event = await prisma.event.findUnique({
          where: { id: validatedData.event_id },
        });

        if (!event) {
          return NextResponse.json(
            {
              success: false,
              error: 'Événement introuvable',
            },
            { status: 404 },
          );
        }

        // Vérifier qu'aucune config n'existe déjà pour cet événement
        const existingConfig = await prisma.scoringConfiguration.findFirst({
          where: { event_id: validatedData.event_id },
        });

        if (existingConfig) {
          return NextResponse.json(
            {
              success: false,
              error: 'Une configuration existe déjà pour cet événement',
            },
            { status: 400 },
          );
        }
      }

      // Si is_default est true, désactiver les autres configs par défaut
      if (validatedData.is_default) {
        await prisma.scoringConfiguration.updateMany({
          where: { is_default: true },
          data: { is_default: false },
        });
      }

      // Créer la configuration avec ses critères
      const configuration = await prisma.scoringConfiguration.create({
        data: {
          name: validatedData.name,
          event_id: validatedData.event_id ?? null,
          is_default: validatedData.is_default ?? false,
          criteria: {
            create: validatedData.criteria.map((c, index) => ({
              type: c.type as ScoringCriterionType,
              enabled: c.enabled,
              weight: c.weight,
              parameters: c.parameters ?? {},
              order: c.order ?? index,
            })),
          },
        },
        include: {
          criteria: true,
        },
      });

      // Enrichir les critères avec leur isPenalty flag
      const enrichedConfiguration = {
        ...configuration,
        criteria: configuration.criteria.map((criterion) => {
          const definition =
            CRITERIA_DEFINITIONS[criterion.type as keyof typeof CRITERIA_DEFINITIONS];
          return {
            ...criterion,
            isPenalty: definition?.isPenalty ?? false,
          };
        }),
      };

      logger.info('Scoring configuration created:', { configId: configuration.id });

      // Log data modification
      if (req.user) {
        await logDataModification(
          req.user.id,
          request,
          'ScoringConfiguration',
          configuration.id,
          'create',
        );
      }

      return NextResponse.json(
        {
          success: true,
          configuration: enrichedConfiguration,
        },
        { status: 201 },
      );
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

      logger.error('Error creating scoring configuration:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create scoring configuration',
        },
        { status: 500 },
      );
    }
  });
}
