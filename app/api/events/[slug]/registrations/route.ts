import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { Accessibility } from '@prisma/client';
import { createScoringEngine } from '@/lib/scoring/scoringEngine';
import { calculateMultipleInstitutionHistories } from '@/lib/events/registrationAnalytics';
import type { CriterionConfig } from '@/lib/scoring/scoringEngine';
import { CRITERIA_DEFINITIONS } from '@/lib/scoring/criteriaDefinitions';
import type { ScoringCriterionType, ParameterValue } from '@/lib/scoring/criteriaDefinitions';
import { UnifiedNotificationService } from '@/lib/notifications/unifiedNotificationService';

/**
 * GET /api/events/[slug]/registrations
 * Get all registrations for a specific event with optional scoring (admin only).
 * Query params:
 *   - configId (optional): ID of the scoring configuration to use
 *   - includeScores (optional): true/false to include score calculations (default: true)
 *   - page (optional): Page number for pagination
 *   - limit (optional): Number of items per page
 * @param req - The incoming request.
 * @param context - The route context containing the event slug.
 * @returns JSON response with registrations and pagination info.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return requireAdmin(req as AuthenticatedRequest, async () => {
    try {
      const { slug } = await context.params;
      const { searchParams } = new URL(req.url);
      const configId = searchParams.get('configId');
      const includeScores = searchParams.get('includeScores') !== 'false';

      const page = parseInt(searchParams.get('page') || '1');
      const limitParam = searchParams.get('limit');
      const limit = limitParam ? parseInt(limitParam) : 10; // Default to 10 if not provided
      const shouldPaginate = limit > 0;
      const skip = shouldPaginate ? (page - 1) * limit : undefined;

      // Find event by slug or ID
      let event = await prisma.event.findFirst({
        where: { slug },
        select: { id: true },
      });

      if (!event) {
        event = await prisma.event.findUnique({
          where: { id: slug },
          select: { id: true },
        });
      }

      if (!event) {
        return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 });
      }

      const [registrations, total] = await Promise.all([
        prisma.registration.findMany({
          where: { event_id: event.id },
          select: {
            id: true,
            user_id: true,
            institution_id: true,
            event_id: true,
            date: true,
            booked_seats: true,
            caretaker_count: true,
            aesh_count: true,
            status: true,
            manager_first_name: true,
            manager_last_name: true,
            manager_email: true,
            manager_phone_number: true,
            comments: true,
            was_present_comment: true,
            created_at: true,
            updated_at: true,
            category: true,
            grades: true,
            age_ranges: true,
            want_formation: true,
            want_preparation: true,
            blockSelections: {
              select: {
                id: true,
                wants_to_attend: true,
                selected_date: true,
                block: {
                  select: {
                    id: true,
                    title: true,
                    mandatory: true,
                    registration_enabled: true,
                  },
                },
              },
              orderBy: {
                block: {
                  order: 'asc',
                },
              },
            },
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                phone_number: true,
              },
            },
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
            disabilities: {
              select: {
                id: true,
                type: true,
                count: true,
                details: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          ...(shouldPaginate && { skip, take: limit }),
        }),
        prisma.registration.count({
          where: { event_id: event.id },
        }),
      ]);

      // Si pas de scores demandés, retourner directement
      if (!includeScores) {
        return NextResponse.json({
          registrations,
          pagination: {
            page,
            limit: shouldPaginate ? limit : total,
            total,
            totalPages: shouldPaginate ? Math.ceil(total / limit) : 1,
          },
        });
      }

      // Charger la configuration de scoring
      let scoringConfig;
      if (configId) {
        scoringConfig = await prisma.scoringConfiguration.findUnique({
          where: { id: configId },
          include: {
            criteria: {
              where: { enabled: true },
              orderBy: { order: 'asc' },
            },
          },
        });

        if (!scoringConfig) {
          return NextResponse.json(
            { error: 'Configuration de scoring introuvable' },
            { status: 404 },
          );
        }
      } else {
        // Utiliser la configuration par défaut
        scoringConfig = await prisma.scoringConfiguration.findFirst({
          where: { is_default: true },
          include: {
            criteria: {
              where: { enabled: true },
              orderBy: { order: 'asc' },
            },
          },
        });

        if (!scoringConfig) {
          // Si aucune config par défaut, retourner sans scores
          return NextResponse.json({
            registrations,
            warning: 'Aucune configuration de scoring disponible',
          });
        }
      }

      // Calculer les historiques des institutions
      const institutionIds = [
        ...new Set(registrations.map((r: { institution_id: string }) => r.institution_id)),
      ];
      const historiesMap = await calculateMultipleInstitutionHistories(
        institutionIds as string[],
        prisma,
      );

      // Récupérer les données de l'événement pour EVENT_CATEGORY_MATCH
      const eventData = await prisma.event.findUnique({
        where: { id: event.id },
        select: {
          id: true,
          category: true,
          grades: true,
          age_ranges: true,
        },
      });

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

      // Calculer les scores pour chaque inscription
      const registrationsWithScores = registrations.map((reg: (typeof registrations)[number]) => {
        const history = historiesMap.get(reg.institution_id);

        if (!history) {
          return {
            ...reg,
            score: null,
            scoreBreakdown: null,
            history: null,
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
            event: eventData
              ? {
                  id: eventData.id,
                  category: eventData.category,
                  grades: eventData.grades,
                  age_ranges: eventData.age_ranges,
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
          ...reg,
          score: result.normalizedScore,
          scoreBreakdown: result.breakdown,
          history: {
            totalRegistrations: history.totalRegistrations,
            attendanceRate: history.attendanceRate,
            monthsSinceLastAttendance: history.monthsSinceLastAttendance,
            recentNoShow: history.recentNoShow,
          },
        };
      });

      return NextResponse.json({
        registrations: registrationsWithScores,
        scoringConfig: {
          id: scoringConfig.id,
          name: scoringConfig.name,
          isDefault: scoringConfig.is_default,
        },
        pagination: {
          page,
          limit: shouldPaginate ? limit : total,
          total,
          totalPages: shouldPaginate ? Math.ceil(total / limit) : 1,
        },
      });
    } catch (error) {
      logger.error('Error fetching event registrations:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des inscriptions' },
        { status: 500 },
      );
    }
  });
}

/**
 * POST /api/events/[slug]/registrations
 * Create a new registration for an event (authenticated users).
 * Body: Registration data (institution_id, date, booked_seats, etc.)
 * @param req - The incoming request containing registration data.
 * @param context - The route context containing the event slug.
 * @returns JSON response with the created registration.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return requireAuth(req as AuthenticatedRequest, async (authReq: AuthenticatedRequest) => {
    try {
      const { slug } = await context.params;

      // Find event by slug or ID
      let eventLookup = await prisma.event.findFirst({
        where: { slug },
        select: {
          id: true,
          status: true,
          total_seats: true,
          booked_seats: true,
          has_initial_formation: true,
          is_formation_mandatory: true,
          has_musical_preparation: true,
          registrationBlocks: {
            where: { enabled: true },
            select: {
              id: true,
              title: true,
              dates: true,
              enabled: true,
              registration_enabled: true,
              mandatory: true,
              order: true,
            },
            orderBy: { order: 'asc' },
          },
          title: true,
          image_url: true,
          location: true,
          slug: true,
          event_dates: true,
          duration: true,
        },
      });

      if (!eventLookup) {
        eventLookup = await prisma.event.findUnique({
          where: { id: slug },
          select: {
            id: true,
            status: true,
            total_seats: true,
            booked_seats: true,
            has_initial_formation: true,
            is_formation_mandatory: true,
            has_musical_preparation: true,
            registrationBlocks: {
              where: { enabled: true },
              select: {
                id: true,
                title: true,
                dates: true,
                enabled: true,
                registration_enabled: true,
                mandatory: true,
                order: true,
              },
              orderBy: { order: 'asc' },
            },
            title: true,
            image_url: true,
            location: true,
            slug: true,
            event_dates: true,
            duration: true,
          },
        });
      }

      if (!eventLookup) {
        return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 });
      }

      const eventId = eventLookup.id;
      const event = eventLookup;
      const userId = authReq.user!.id;
      const body = await req.json();

      const {
        institution_id,
        date,
        manager_first_name,
        manager_last_name,
        manager_email,
        manager_phone_number,
        booked_seats,
        caretaker_count,
        aesh_count,
        category,
        grades,
        age_ranges,
        comments,
        disabilities,
        want_formation,
        want_preparation,
        registration_block_selections,
      } = body;

      // Validate required fields
      if (!institution_id || !date || !booked_seats || booked_seats <= 0) {
        return NextResponse.json(
          { error: 'Institution, date et nombre de places requis' },
          { status: 400 },
        );
      }

      // Verify user belongs to the institution
      const userInstitution = await prisma.userInstitution.findFirst({
        where: {
          user_id: userId,
          institution_id: institution_id,
        },
      });

      if (!userInstitution) {
        return NextResponse.json(
          { error: "Vous n'appartenez pas à cet établissement" },
          { status: 403 },
        );
      }

      if (event.status === 'ARCHIVED') {
        return NextResponse.json(
          { error: "Cet événement est archivé et n'accepte plus d'inscriptions" },
          { status: 400 },
        );
      }

      if (event.status === 'CLOSED') {
        return NextResponse.json(
          { error: 'Les inscriptions pour cet événement sont fermées' },
          { status: 400 },
        );
      }

      // Validate educational content requests
      if (want_formation && !event.has_initial_formation) {
        return NextResponse.json(
          { error: 'Cet événement ne propose pas de formation initiale' },
          { status: 400 },
        );
      }

      if (want_preparation && !event.has_musical_preparation) {
        return NextResponse.json(
          { error: 'Cet événement ne propose pas de préparation musicale' },
          { status: 400 },
        );
      }

      const registrationBlockSelections = Array.isArray(registration_block_selections)
        ? (registration_block_selections as Array<{
            block_id?: string;
            wants_to_attend?: boolean;
            selected_date?: string | null;
          }>)
        : [];
      const eventRegistrationBlocks = event.registrationBlocks || [];
      const blocksById = new Map(eventRegistrationBlocks.map((block) => [block.id, block]));
      const selectionsByBlockId = new Map(
        registrationBlockSelections
          .filter((selection) => typeof selection.block_id === 'string')
          .map((selection) => [selection.block_id as string, selection]),
      );
      const datesMatch = (selectedDate: string | null | undefined, dates: Date[]) => {
        if (!selectedDate) return dates.length === 0;
        const selectedTime = new Date(selectedDate).getTime();
        return dates.some((date) => date.getTime() === selectedTime);
      };

      for (const selection of registrationBlockSelections) {
        if (!selection.block_id || typeof selection.wants_to_attend !== 'boolean') {
          return NextResponse.json(
            { error: 'Réponse de bloc pédagogique invalide' },
            { status: 400 },
          );
        }

        const block = blocksById.get(selection.block_id);
        if (!block || block.enabled === false || !block.registration_enabled) {
          return NextResponse.json(
            { error: "Ce bloc pédagogique n'accepte pas d'inscription" },
            { status: 400 },
          );
        }

        if (
          selection.wants_to_attend &&
          block.dates.length > 0 &&
          !datesMatch(selection.selected_date, block.dates)
        ) {
          return NextResponse.json(
            { error: `Veuillez choisir une date valide pour "${block.title}"` },
            { status: 400 },
          );
        }
      }

      for (const block of eventRegistrationBlocks) {
        if (block.enabled === false || !block.registration_enabled || !block.mandatory) continue;

        const selection = selectionsByBlockId.get(block.id);
        if (!selection?.wants_to_attend) {
          return NextResponse.json(
            { error: `Le bloc "${block.title}" est obligatoire` },
            { status: 400 },
          );
        }

        if (block.dates.length > 0 && !datesMatch(selection.selected_date, block.dates)) {
          return NextResponse.json(
            { error: `Veuillez choisir une date valide pour "${block.title}"` },
            { status: 400 },
          );
        }
      }

      // Check available seats
      const availableSeats = (event.total_seats || 0) - (event.booked_seats || 0);
      if (booked_seats > availableSeats) {
        return NextResponse.json(
          { error: `Seulement ${availableSeats} places disponibles` },
          { status: 400 },
        );
      }

      const selectionsToCreate = registrationBlockSelections.filter((selection) =>
        selection.block_id ? blocksById.has(selection.block_id) : false,
      );

      // Create the registration, its disabilities and its block selections atomically so a
      // partial failure never leaves an orphaned registration without its related records.
      const registration = await prisma.$transaction(async (tx) => {
        const created = await tx.registration.create({
          data: {
            user_id: userId,
            institution_id,
            event_id: eventId,
            date: new Date(date),
            manager_first_name,
            manager_last_name,
            manager_email,
            manager_phone_number,
            booked_seats,
            caretaker_count: caretaker_count || null,
            aesh_count: aesh_count || null,
            want_formation: want_formation || null,
            want_preparation: want_preparation || null,
            category: category || [],
            grades: grades || [],
            age_ranges: age_ranges || [],
            comments,
            status: 'PENDING',
          },
        });

        if (disabilities && Array.isArray(disabilities)) {
          await tx.registrationDisability.createMany({
            data: disabilities.map(
              (d: { type: Accessibility; count: number; details?: string }) => ({
                registration_id: created.id,
                type: d.type,
                count: d.count,
                details: d.type === 'OTHER' ? d.details || null : null,
              }),
            ),
          });
        }

        if (selectionsToCreate.length > 0) {
          await tx.registrationBlockSelection.createMany({
            data: selectionsToCreate.map((selection) => ({
              registration_id: created.id,
              block_id: selection.block_id!,
              wants_to_attend: Boolean(selection.wants_to_attend),
              selected_date:
                selection.wants_to_attend && selection.selected_date
                  ? new Date(selection.selected_date)
                  : null,
            })),
          });
        }

        return created;
      });

      // NOTE: Ne pas incrémenter booked_seats ici car l'inscription est PENDING
      // Les places seront décomptées uniquement lors de la confirmation (status CONFIRMED)

      // Send confirmation email to user
      try {
        const firstEventDate =
          event.event_dates && event.event_dates.length > 0 ? new Date(event.event_dates[0]) : null;

        if (firstEventDate) {
          const formattedDate = firstEventDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          // Format time based on duration (e.g., "18h00" for 6 hours duration)
          const hours = Math.floor(event.duration / 60);
          const minutes = event.duration % 60;
          const formattedTime = `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}`;

          const formationName =
            selectionsToCreate
              .filter((selection) => selection.wants_to_attend)
              .map((selection) => blocksById.get(selection.block_id as string)?.title)
              .filter((title): title is string => Boolean(title))
              .join(', ') || (want_formation ? 'Formation initiale' : null);

          await UnifiedNotificationService.notifyRegistrationSubmitted({
            userId,
            eventTitle: event.title,
            eventDate: formattedDate,
            eventTime: formattedTime,
            eventLocation: event.location,
            eventSlug: event.slug,
            eventImage: event.image_url,
            formationName,
          });
        }
      } catch (emailError) {
        // Log but don't fail the registration if email sending fails
        logger.error(
          'Error sending registration confirmation email:',
          ...sanitizeLogArgs(emailError),
        );
      }

      return NextResponse.json({ registration }, { status: 201 });
    } catch (error) {
      logger.error('Error creating registration:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la création de l'inscription" },
        { status: 500 },
      );
    }
  });
}
