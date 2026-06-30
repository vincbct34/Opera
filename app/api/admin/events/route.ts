import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { logAdminAccess, logDataModification } from '@/lib/security/securityLogger';
import { z } from 'zod';
import { EventStatus, EventType, PublicCategory, Accessibility, SchoolGrade, AgeRange } from '@/app/generated/prisma/enums';

// Validation schema for creating/updating events
const EventSchema = z.object({
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional(),
  type: z.array(z.nativeEnum(EventType)).min(1, 'Au moins un type est requis'),
  location: z.string().min(1, 'Le lieu est requis'),
  duration: z.number().min(1, 'La durée doit être positive'),
  total_seats: z.number().min(1, 'Le nombre de places doit être positif'),
  status: z.nativeEnum(EventStatus).optional(),
  image_url: z.string().url().optional().or(z.literal('')),
  event_dates: z.array(z.string().datetime()).min(1, 'Au moins une date est requise'),
  category: z.array(z.nativeEnum(PublicCategory)).optional(),
  grades: z.array(z.nativeEnum(SchoolGrade)).optional(),
  age_ranges: z.array(z.nativeEnum(AgeRange)).optional(),
  has_initial_formation: z.boolean().optional(),
  is_formation_mandatory: z.boolean().optional(),
  has_musical_preparation: z.boolean().optional(),
  accessibility: z.array(z.string()).optional(), // We'll handle mapping to Accessibility enum manually if needed
});

/**
 * GET /api/admin/events
 * Lists all events with registration counts.
 * @param req - The incoming request.
 * @returns JSON response with a list of events.
 */
export async function GET(req: NextRequest) {
  return requireAdmin(req as AuthenticatedRequest, async (authReq) => {
    try {
      if (authReq.user) {
        await logAdminAccess(authReq.user.id, req, 'List events (admin)');
      }

      const events = await prisma.event.findMany({
        orderBy: { event_dates: 'asc' },
        include: {
          accessibility: true,
          _count: {
            select: { registrations: true },
          },
        },
      });

      return NextResponse.json({ events });
    } catch (error) {
      logger.error('Error listing events:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des événements' },
        { status: 500 },
      );
    }
  });
}

/**
 * POST /api/admin/events
 * Creates a new event.
 * @param req - The incoming request containing event data.
 * @returns JSON response with the created event.
 */
export async function POST(req: NextRequest) {
  return requireAdmin(req as AuthenticatedRequest, async (authReq) => {
    try {
      const body = await req.json();

      // Basic validation
      const validatedData = EventSchema.parse(body);

      // Create event
      const event = await prisma.event.create({
        data: {
          title: validatedData.title,
          description: validatedData.description,
          type: validatedData.type,
          location: validatedData.location,
          duration: validatedData.duration,
          total_seats: validatedData.total_seats,
          status: validatedData.status || EventStatus.OPEN,
          image_url: validatedData.image_url || null,
          event_dates: validatedData.event_dates.map((d) => new Date(d)),
          category: validatedData.category || [],
          grades: validatedData.grades || [],
          age_ranges: validatedData.age_ranges || [],
          has_initial_formation: validatedData.has_initial_formation || false,
          is_formation_mandatory: validatedData.is_formation_mandatory || false,
          has_musical_preparation: validatedData.has_musical_preparation || false,
          // Handle accessibility if provided
          accessibility: {
            create: (body.accessibility || []).map((type: string) => ({
              type: type as Accessibility, // Cast to Accessibility enum
            })),
          },
        },
      });

      if (authReq.user) {
        await logDataModification(authReq.user.id, req, 'Event', event.id, 'create');
      }

      return NextResponse.json({ event, message: 'Événement créé avec succès' }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
      }
      logger.error('Error creating event:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la création de l'événement" },
        { status: 500 },
      );
    }
  });
}
