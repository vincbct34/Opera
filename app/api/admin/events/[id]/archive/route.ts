import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { logDataModification } from '@/lib/security/securityLogger';
import { z } from 'zod';
import { EventStatus } from '@/app/generated/prisma';

// Validation schema for archive status change
const ArchiveSchema = z.object({
  status: z.enum(['ARCHIVED', 'OPEN', 'CLOSED']),
});

/**
 * PATCH /api/admin/events/[id]/archive
 * Archive or unarchive an event.
 * @param req - The incoming request containing the new status.
 * @param context - The route context containing the event ID.
 * @returns JSON response with the updated event.
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAdmin(req as AuthenticatedRequest, async (authReq) => {
    try {
      const { id } = await context.params;
      const body = await req.json();

      const { status } = ArchiveSchema.parse(body);

      const existingEvent = await prisma.event.findUnique({ where: { id } });
      if (!existingEvent) {
        return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });
      }

      const event = await prisma.event.update({
        where: { id },
        data: { status: status as EventStatus },
      });

      if (authReq.user) {
        await logDataModification(authReq.user.id, req, 'Event', event.id, 'update');
      }

      return NextResponse.json({
        event,
        message:
          status === 'ARCHIVED'
            ? 'Événement archivé avec succès'
            : 'Événement désarchivé avec succès',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
      }
      logger.error('Error archiving event:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de l'archivage de l'événement" },
        { status: 500 },
      );
    }
  });
}
