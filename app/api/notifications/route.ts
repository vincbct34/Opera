import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';

/**
 * GET /api/notifications
 * Récupérer les notifications d'un utilisateur.
 * Query parameters:
 * - unreadOnly: boolean (optionnel) - Ne récupérer que les notifications non lues
 * - limit: number (optionnel, défaut: 20) - Nombre de notifications à récupérer
 * - offset: number (optionnel, défaut: 0) - Décalage pour la pagination
 * @param request - The incoming request.
 * @returns JSON response with notifications and pagination info.
 */
export async function GET(request: NextRequest) {
  return requireAuth(request as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.id;
      const { searchParams } = new URL(req.url);

      // Query parameters
      const unreadOnly = searchParams.get('unreadOnly') === 'true';
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = parseInt(searchParams.get('offset') || '0');

      // Construire la clause WHERE
      const where: Prisma.NotificationWhereInput = {
        user_id: userId,
      };

      if (unreadOnly) {
        where.read = false;
      }

      // Fetch notifications
      const [notifications, totalCount, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: {
            created_at: 'desc',
          },
          take: limit,
          skip: offset,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: {
            user_id: userId,
            read: false,
          },
        }),
      ]);

      // Calculer s'il y a plus de notifications
      const hasMore = offset + notifications.length < totalCount;

      return NextResponse.json({
        notifications,
        unreadCount,
        hasMore,
        total: totalCount,
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des notifications:', ...sanitizeLogArgs(error));
      return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
  });
}

/**
 * PUT /api/notifications
 * Marquer des notifications comme lues.
 * Body:
 * - notificationIds: string[] (optionnel) - IDs des notifications à marquer comme lues
 * - markAllAsRead: boolean (optionnel) - Marquer toutes les notifications comme lues
 * @param request - The incoming request.
 * @returns JSON response with update status.
 */
export async function PUT(request: NextRequest) {
  return requireAuth(request as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.id;
      const body = await req.json();
      const { notificationIds, markAllAsRead } = body;

      if (markAllAsRead) {
        // Marquer toutes les notifications de l'utilisateur comme lues
        const result = await prisma.notification.updateMany({
          where: {
            user_id: userId,
            read: false,
          },
          data: {
            read: true,
            updated_at: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          updatedCount: result.count,
          message: `${result.count} notifications marquées comme lues`,
        });
      } else if (notificationIds && Array.isArray(notificationIds)) {
        // Mark specific notifications as read
        const result = await prisma.notification.updateMany({
          where: {
            id: {
              in: notificationIds,
            },
            user_id: userId, // Sécurité : s'assurer que les notifications appartiennent à l'utilisateur
          },
          data: {
            read: true,
            updated_at: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          updatedCount: result.count,
          message: `${result.count} notification(s) marquée(s) comme lue(s)`,
        });
      } else {
        return NextResponse.json(
          { error: 'Paramètres invalides. Utilisez "notificationIds" ou "markAllAsRead"' },
          { status: 400 },
        );
      }
    } catch (error) {
      logger.error('Erreur lors de la mise à jour des notifications:', ...sanitizeLogArgs(error));
      return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
  });
}

/**
 * DELETE /api/notifications
 * Supprimer des notifications.
 * Body:
 * - notificationIds: string[] - IDs des notifications à supprimer
 * @param request - The incoming request.
 * @returns JSON response with deletion status.
 */
export async function DELETE(request: NextRequest) {
  return requireAuth(request as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.id;
      const body = await req.json();
      const { notificationIds } = body;

      if (!notificationIds || !Array.isArray(notificationIds)) {
        return NextResponse.json(
          { error: 'Le paramètre "notificationIds" est requis et doit être un tableau' },
          { status: 400 },
        );
      }

      // Delete specified notifications
      const result = await prisma.notification.deleteMany({
        where: {
          id: {
            in: notificationIds,
          },
          user_id: userId, // Sécurité : s'assurer que les notifications appartiennent à l'utilisateur
        },
      });

      return NextResponse.json({
        success: true,
        deletedCount: result.count,
        message: `${result.count} notification(s) supprimée(s)`,
      });
    } catch (error) {
      logger.error('Erreur lors de la suppression des notifications:', ...sanitizeLogArgs(error));
      return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
  });
}
