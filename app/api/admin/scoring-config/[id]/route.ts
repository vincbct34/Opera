import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { z } from 'zod';
import { CRITERIA_DEFINITIONS } from '@/lib/scoring/criteriaDefinitions';
import { UpdateScoringConfigSchema } from '@/lib/validation/validationSchemas';
import { ScoringCriterionType } from '@/app/generated/prisma';

/**
 * GET /api/admin/scoring-config/[id]
 * Retrieves a specific scoring configuration.
 * @param request - The incoming request.
 * @param params - The route params containing the configuration ID.
 * @returns JSON response with the scoring configuration.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      const configuration = await prisma.scoringConfiguration.findUnique({
        where: { id },
        include: {
          criteria: {
            orderBy: {
              order: 'asc',
            },
          },
          event: {
            select: {
              id: true,
              title: true,
            },
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

      return NextResponse.json({
        success: true,
        configuration: enrichedConfiguration,
      });
    } catch (error) {
      logger.error('Error fetching scoring configuration:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch scoring configuration',
        },
        { status: 500 },
      );
    }
  });
}

/**
 * PATCH /api/admin/scoring-config/[id]
 * Updates a scoring configuration.
 * @param request - The incoming request containing updated configuration data.
 * @param params - The route params containing the configuration ID.
 * @returns JSON response with the updated configuration.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      const body = await request.json();
      const validatedData = UpdateScoringConfigSchema.parse(body);

      // Vérifier que la configuration existe
      const existingConfig = await prisma.scoringConfiguration.findUnique({
        where: { id },
        include: { criteria: true },
      });

      if (!existingConfig) {
        return NextResponse.json(
          {
            success: false,
            error: 'Configuration introuvable',
          },
          { status: 404 },
        );
      }

      // Si on met à jour les critères, vérifier le poids total
      if (validatedData.criteria) {
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

        // Vérifier que tous les types existent
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
      }

      // Si is_default passe à true, désactiver les autres
      if (validatedData.is_default === true) {
        await prisma.scoringConfiguration.updateMany({
          where: {
            id: { not: id },
            is_default: true,
          },
          data: { is_default: false },
        });
      }

      // Préparer les données de mise à jour
      const updateData: { name?: string; is_default?: boolean; criteria?: unknown } = {};

      if (validatedData.name) {
        updateData.name = validatedData.name;
      }

      if (validatedData.is_default !== undefined) {
        updateData.is_default = validatedData.is_default;
      }

      // Si on met à jour les critères, supprimer les anciens et créer les nouveaux
      if (validatedData.criteria) {
        // Supprimer les critères existants
        await prisma.scoringCriterion.deleteMany({
          where: { config_id: id },
        });

        // Créer les nouveaux
        updateData.criteria = {
          create: validatedData.criteria.map((c, index) => ({
            type: c.type as ScoringCriterionType,
            enabled: c.enabled,
            weight: c.weight,
            parameters: c.parameters ?? {},
            order: c.order ?? index,
          })),
        };
      }

      const configuration = await prisma.scoringConfiguration.update({
        where: { id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: updateData as any,
        include: {
          criteria: {
            orderBy: {
              order: 'asc',
            },
          },
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

      logger.info('Scoring configuration updated:', { configId: id });

      return NextResponse.json({
        success: true,
        configuration: enrichedConfiguration,
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

      logger.error('Error updating scoring configuration:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update scoring configuration',
        },
        { status: 500 },
      );
    }
  });
}

/**
 * DELETE /api/admin/scoring-config/[id]
 * Deletes a scoring configuration.
 * @param request - The incoming request.
 * @param params - The route params containing the configuration ID.
 * @returns JSON response indicating success or failure.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      const configuration = await prisma.scoringConfiguration.findUnique({
        where: { id },
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

      // Empêcher la suppression de la config par défaut (optionnel)
      if (configuration.is_default) {
        return NextResponse.json(
          {
            success: false,
            error: 'Impossible de supprimer la configuration par défaut',
          },
          { status: 400 },
        );
      }

      // Les critères seront supprimés automatiquement (onDelete: Cascade)
      await prisma.scoringConfiguration.delete({
        where: { id },
      });

      logger.info('Scoring configuration deleted:', { configId: id });

      return NextResponse.json({
        success: true,
        message: 'Configuration supprimée avec succès',
      });
    } catch (error) {
      logger.error('Error deleting scoring configuration:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete scoring configuration',
        },
        { status: 500 },
      );
    }
  });
}
