import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { logDataModification } from '@/lib/security/securityLogger';
import { richTextToPlainText, sanitizeRichText } from '@/lib/richText';
import { z } from 'zod';
import {
  EventStatus,
  EventType,
  PublicCategory,
  Accessibility,
  SchoolGrade,
  AgeRange,
} from '@/app/generated/prisma/enums';
import {
  getRegistrationBlocksWithLegacyFallback,
  serializeRegistrationBlock,
} from '@/lib/events/registrationBlocks';

const RegistrationBlockSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Le titre du bloc est requis'),
  description: z.string().optional().nullable(),
  dates: z.array(z.string().datetime()).optional(),
  enabled: z.boolean().optional(),
  registration_enabled: z.boolean().optional(),
  mandatory: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

// List of fields that can be protected from scraping
export const PROTECTABLE_FIELDS = [
  'title',
  'description',
  'type',
  'status',
  'category',
  'grades',
  'age_ranges',
  'location',
  'duration',
  'total_seats',
  'caretaker',
  'image_url',
  'event_dates',
  'has_initial_formation',
  'has_musical_preparation',
  'registrationBlocks',
  'slug',
  'accessibility',
] as const;

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
  accessibility: z.array(z.string()).optional(),
  registrationBlocks: z.array(RegistrationBlockSchema).optional(),
  caretaker: z.number().min(0).optional(),
  slug: z.string().optional(),
  // NEW: Fields for managing manual edits
  protected_fields: z.array(z.enum(PROTECTABLE_FIELDS)).optional(),
});

/**
 * GET /api/admin/events/[id]
 * Retrieves detailed information about a specific event.
 * @param req - The incoming request.
 * @param context - The route context containing the event ID.
 * @returns JSON response with event details.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAdmin(req as AuthenticatedRequest, async () => {
    try {
      const { id } = await context.params;

      const event = await prisma.event.findUnique({
        where: { id },
        include: {
          accessibility: true,
          registrationBlocks: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { registrations: true },
          },
        },
      });

      if (!event) {
        return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });
      }

      return NextResponse.json({
        event: {
          ...event,
          registrationBlocks: getRegistrationBlocksWithLegacyFallback(event).map(
            serializeRegistrationBlock,
          ),
        },
      });
    } catch (error) {
      logger.error('Error fetching event:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la récupération de l'événement" },
        { status: 500 },
      );
    }
  });
}

/**
 * PUT /api/admin/events/[id]
 * Updates an existing event.
 * @param req - The incoming request containing updated event data.
 * @param context - The route context containing the event ID.
 * @returns JSON response with the updated event.
 */
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAdmin(req as AuthenticatedRequest, async (authReq) => {
    try {
      const { id } = await context.params;
      const body = await req.json();

      // Validation (allow partial updates? No, PUT usually implies full replacement or at least valid state)
      // Let's use partial for flexibility in UI but validate types
      const validatedData = EventSchema.partial().parse(body);

      const existingEvent = await prisma.event.findUnique({
        where: { id },
        include: { accessibility: true, registrationBlocks: true },
      });
      if (!existingEvent) {
        return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });
      }

      const sanitizedDescription =
        validatedData.description === undefined
          ? undefined
          : sanitizeRichText(validatedData.description);
      const normalizedImageUrl =
        validatedData.image_url === undefined ? undefined : validatedData.image_url || null;

      // Helper function to compare arrays (order-independent)
      const arraysEqual = (a: unknown[] | undefined, b: unknown[] | undefined): boolean => {
        if (!a && !b) return true;
        if (!a || !b) return false;
        if (a.length !== b.length) return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((val, index) => val === sortedB[index]);
      };

      // Helper function to compare dates arrays
      const datesEqual = (a: string[] | undefined, b: Date[] | undefined): boolean => {
        if (!a && !b) return true;
        if (!a || !b) return false;
        if (a.length !== b.length) return false;
        const toEditableMinute = (date: string | Date) =>
          Math.floor(new Date(date).getTime() / 60000);
        const sortedA = [...a].map(toEditableMinute).sort((left, right) => left - right);
        const sortedB = [...b].map(toEditableMinute).sort((left, right) => left - right);
        return sortedA.every((val, index) => val === sortedB[index]);
      };

      const richTextEqual = (a: string | null | undefined, b: string | null | undefined): boolean =>
        sanitizeRichText(a) === sanitizeRichText(b);

      const nullableStringEqual = (
        a: string | null | undefined,
        b: string | null | undefined,
      ): boolean => (a || null) === (b || null);

      // Determine which fields were modified in this request
      const modifiedFields: string[] = [];
      if (validatedData.title !== undefined && validatedData.title !== existingEvent.title) {
        modifiedFields.push('title');
      }
      if (
        sanitizedDescription !== undefined &&
        !richTextEqual(sanitizedDescription, existingEvent.description)
      ) {
        modifiedFields.push('description');
      }
      if (
        validatedData.type !== undefined &&
        !arraysEqual(validatedData.type, existingEvent.type)
      ) {
        modifiedFields.push('type');
      }
      if (validatedData.status !== undefined && validatedData.status !== existingEvent.status) {
        modifiedFields.push('status');
      }
      if (
        validatedData.category !== undefined &&
        !arraysEqual(validatedData.category, existingEvent.category)
      ) {
        modifiedFields.push('category');
      }
      if (
        validatedData.grades !== undefined &&
        !arraysEqual(validatedData.grades, existingEvent.grades)
      ) {
        modifiedFields.push('grades');
      }
      if (
        validatedData.age_ranges !== undefined &&
        !arraysEqual(validatedData.age_ranges, existingEvent.age_ranges)
      ) {
        modifiedFields.push('age_ranges');
      }
      if (
        validatedData.location !== undefined &&
        validatedData.location !== existingEvent.location
      ) {
        modifiedFields.push('location');
      }
      if (
        validatedData.duration !== undefined &&
        validatedData.duration !== existingEvent.duration
      ) {
        modifiedFields.push('duration');
      }
      if (
        validatedData.total_seats !== undefined &&
        validatedData.total_seats !== existingEvent.total_seats
      ) {
        modifiedFields.push('total_seats');
      }
      if (
        validatedData.caretaker !== undefined &&
        validatedData.caretaker !== existingEvent.caretaker
      ) {
        modifiedFields.push('caretaker');
      }
      if (
        normalizedImageUrl !== undefined &&
        !nullableStringEqual(normalizedImageUrl, existingEvent.image_url)
      ) {
        modifiedFields.push('image_url');
      }
      if (
        validatedData.event_dates !== undefined &&
        !datesEqual(validatedData.event_dates, existingEvent.event_dates as Date[] | undefined)
      ) {
        modifiedFields.push('event_dates');
      }
      if (
        validatedData.has_initial_formation !== undefined &&
        validatedData.has_initial_formation !== existingEvent.has_initial_formation
      ) {
        modifiedFields.push('has_initial_formation');
      }
      if (validatedData.registrationBlocks !== undefined) {
        modifiedFields.push('registrationBlocks');
        if (!modifiedFields.includes('has_initial_formation')) {
          modifiedFields.push('has_initial_formation');
        }
      }
      if (
        validatedData.has_musical_preparation !== undefined &&
        validatedData.has_musical_preparation !== existingEvent.has_musical_preparation
      ) {
        modifiedFields.push('has_musical_preparation');
      }
      if (validatedData.slug !== undefined && validatedData.slug !== existingEvent.slug) {
        modifiedFields.push('slug');
      }
      if (validatedData.accessibility !== undefined) {
        // Compare accessibility types (order-independent)
        const existingAccessibility = existingEvent.accessibility?.map((a) => a.type) || [];
        if (!arraysEqual(validatedData.accessibility, existingAccessibility)) {
          modifiedFields.push('accessibility');
        }
      }

      // Merge existing protected_fields with newly modified fields
      const currentProtectedFields = existingEvent.protected_fields || [];

      // Check if user explicitly provided a new protected_fields list
      const userProvidedProtectedList = validatedData.protected_fields !== undefined;
      const protectedFieldsChanged =
        userProvidedProtectedList &&
        !arraysEqual(validatedData.protected_fields, currentProtectedFields);

      let updatedProtectedFields: string[];
      if (userProvidedProtectedList) {
        // User explicitly set the protected fields - use their list as base
        // and add only the modified fields that aren't already protected
        updatedProtectedFields = Array.from(
          new Set([...validatedData.protected_fields!, ...modifiedFields]),
        );
      } else {
        // Default behavior: keep existing protected fields and add modified ones
        updatedProtectedFields = Array.from(
          new Set([...currentProtectedFields, ...modifiedFields]),
        );
      }

      // Mark event as manually edited if any field was modified or protected fields changed
      const manuallyEdited =
        existingEvent.manually_edited || modifiedFields.length > 0 || protectedFieldsChanged;

      const descriptionForUpdate =
        sanitizedDescription === undefined ||
        richTextEqual(sanitizedDescription, existingEvent.description)
          ? undefined
          : sanitizedDescription || null;
      const imageUrlForUpdate =
        normalizedImageUrl === undefined ||
        nullableStringEqual(normalizedImageUrl, existingEvent.image_url)
          ? undefined
          : normalizedImageUrl;
      const eventDatesForUpdate =
        validatedData.event_dates === undefined ||
        datesEqual(validatedData.event_dates, existingEvent.event_dates as Date[] | undefined)
          ? undefined
          : validatedData.event_dates;
      const sanitizedData = {
        ...validatedData,
        description: descriptionForUpdate,
        image_url: imageUrlForUpdate,
        event_dates: eventDatesForUpdate,
      };
      const { registrationBlocks, ...sanitizedEventData } = sanitizedData;
      const hasRegistrationBlocks = registrationBlocks
        ? registrationBlocks.some((block) => block.enabled !== false)
        : undefined;
      const hasMandatoryRegistrationBlock = registrationBlocks
        ? registrationBlocks.some((block) => block.enabled !== false && block.mandatory)
        : undefined;

      // Update the event and synchronize its registration blocks atomically so a
      // failure mid-sync can never leave the event with half-written blocks.
      const event = await prisma.$transaction(async (tx) => {
        const updatedEvent = await tx.event.update({
          where: { id },
          data: {
            ...sanitizedEventData,
            has_initial_formation:
              hasRegistrationBlocks === undefined
                ? sanitizedEventData.has_initial_formation
                : hasRegistrationBlocks,
            is_formation_mandatory:
              hasMandatoryRegistrationBlock === undefined
                ? sanitizedEventData.is_formation_mandatory
                : hasMandatoryRegistrationBlock,
            event_dates: sanitizedEventData.event_dates
              ? sanitizedEventData.event_dates.map((d) => new Date(d))
              : undefined,
            accessibility: sanitizedEventData.accessibility
              ? {
                  deleteMany: {},
                  create: sanitizedEventData.accessibility.map((type: string) => ({
                    type: type as Accessibility,
                  })),
                }
              : undefined,
            // Update protected fields and manually_edited flag
            manually_edited: manuallyEdited,
            protected_fields: updatedProtectedFields,
          },
          include: {
            accessibility: true,
            registrationBlocks: {
              orderBy: { order: 'asc' },
            },
          },
        });

        if (registrationBlocks !== undefined) {
          const incomingIds = registrationBlocks
            .map((block) => block.id)
            .filter(
              (blockId): blockId is string =>
                Boolean(blockId) &&
                existingEvent.registrationBlocks.some(
                  (existingBlock) => existingBlock.id === blockId,
                ),
            );

          await tx.eventRegistrationBlock.deleteMany({
            where: {
              event_id: id,
              id: {
                notIn: incomingIds,
              },
            },
          });

          for (const [index, block] of registrationBlocks.entries()) {
            const data = {
              title: block.title,
              // Blocks use a plain-text explanatory field (admin edits it via a textarea),
              // so strip any markup to plain text instead of storing rich HTML.
              description: richTextToPlainText(block.description) || null,
              dates: (block.dates || []).map((date) => new Date(date)),
              enabled: block.enabled ?? true,
              registration_enabled: block.enabled !== false,
              mandatory: block.enabled !== false && (block.mandatory ?? false),
              order: block.order ?? index,
            };

            if (
              block.id &&
              existingEvent.registrationBlocks.some(
                (existingBlock) => existingBlock.id === block.id,
              )
            ) {
              await tx.eventRegistrationBlock.update({
                where: { id: block.id },
                data,
              });
            } else {
              await tx.eventRegistrationBlock.create({
                data: {
                  ...data,
                  event_id: id,
                },
              });
            }
          }
        }

        return updatedEvent;
      });

      if (authReq.user) {
        await logDataModification(authReq.user.id, req, 'Event', event.id, 'update');
      }

      const updatedEvent = await prisma.event.findUnique({
        where: { id },
        include: {
          accessibility: true,
          registrationBlocks: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return NextResponse.json({
        event: updatedEvent || event,
        message: 'Événement mis à jour avec succès',
        modified_fields: modifiedFields,
        protected_fields: updatedProtectedFields,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
      }
      logger.error('Error updating event:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour de l'événement" },
        { status: 500 },
      );
    }
  });
}

/**
 * DELETE /api/admin/events/[id]
 * Deletes an event if it has no registrations.
 * @param req - The incoming request.
 * @param context - The route context containing the event ID.
 * @returns JSON response indicating success or failure.
 */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return requireAdmin(req as AuthenticatedRequest, async (authReq) => {
    try {
      const { id } = await context.params;

      const existingEvent = await prisma.event.findUnique({
        where: { id },
        include: { _count: { select: { registrations: true } } },
      });

      if (!existingEvent) {
        return NextResponse.json({ error: 'Événement non trouvé' }, { status: 404 });
      }

      if (existingEvent._count.registrations > 0) {
        return NextResponse.json(
          { error: 'Impossible de supprimer un événement avec des inscriptions' },
          { status: 400 },
        );
      }

      await prisma.event.delete({ where: { id } });

      if (authReq.user) {
        await logDataModification(authReq.user.id, req, 'Event', id, 'delete');
      }

      return NextResponse.json({ message: 'Événement supprimé avec succès' });
    } catch (error) {
      logger.error('Error deleting event:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la suppression de l'événement" },
        { status: 500 },
      );
    }
  });
}
