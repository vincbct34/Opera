'use client';

import Image from 'next/image';
import { Calendar, MapPin, Clock, Users, Accessibility } from '@deemlol/next-icons';
import { useUser } from '@/context/UserContext';
import Loader from '@/components/ui/Loader';
import UserEventDetailClient from '@/components/events/UserEventDetailClient';
import AdminEventDetailClient from '@/components/admin/events/AdminEventDetailClient';
import EventDescription from '@/components/events/EventDescription';
import Link from 'next/link';
import type { Event as PrismaEvent, PublicCategory, SchoolGrade, AgeRange } from '@/types/api';
import { Accessibility as AccessibilityType } from '@/app/generated/prisma/enums';
import {
  SCHOOL_GRADE_ACRONYMS,
  AGE_RANGE_ACRONYMS,
  SCHOOL_GRADE_ORDER,
  AGE_RANGE_ORDER,
} from '@/lib/config/badgeConstants';
import {
  PUBLIC_CATEGORY_LABELS,
  SCHOOL_GRADE_LABELS,
  AGE_RANGE_LABELS,
  ACCESSIBILITY_LABELS as DEFAULT_ACCESSIBILITY_LABELS,
} from '@/lib/config/labelMappings';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

type DisplayEvent = Partial<PrismaEvent> & {
  event_dates: Array<string | Date>;
  accessibility?: { type: AccessibilityType }[];
  grades?: SchoolGrade[];
  age_ranges?: AgeRange[];
  has_initial_formation?: boolean | null;
  has_musical_preparation?: boolean | null;
};

const formatDate = (d?: string | Date) => {
  if (!d) return '';
  try {
    const dt = typeof d === 'string' ? new Date(d) : d;
    return dt.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return typeof d === 'string' ? d : d.toString();
  }
};

/**
 * Mapping des catégories de public vers leurs acronymes (copié depuis ClientEvents)
 */
const PUBLIC_CATEGORY_ACRONYMS: Record<PublicCategory, string> = {
  CRECHE: 'CR',
  MATERNELLE: 'M',
  ELEMENTAIRE: 'E',
  COLLEGE: 'C',
  LYCEE: 'L',
  SUPERIEUR: 'ES',
  ASSOCIATION: 'ASSOS',
  CONSERVATOIRE: 'CONS',
  PERISCOLAIRE: 'CL',
  PUBLICS_EMPECHES: 'PE',
  AUTRE: 'AUTRE',
};

/**
 * Ordre d'affichage des catégories de public
 */
const PUBLIC_CATEGORY_ORDER: PublicCategory[] = [
  'CRECHE',
  'MATERNELLE',
  'ELEMENTAIRE',
  'COLLEGE',
  'LYCEE',
  'SUPERIEUR',
  'ASSOCIATION',
  'CONSERVATOIRE',
  'PERISCOLAIRE',
  'PUBLICS_EMPECHES',
  'AUTRE',
];

/**
 * EventDetailClient component
 * Public detail view of an event.
 * Features:
 * - Event information (image, description, location, dates)
 * - Accessibility and audience info
 * - Conditional rendering of registration interface:
 *   - Admin view for admins
 *   - User view for authenticated users
 *   - Login prompt for guests
 *
 * @param initialData - The event data
 */
export default function EventDetailClient({
  initialData,
  publicCategoryLabels,
  accessibilityLabels,
  registrationStatusLabels,
  eventStatusLabels,
}: {
  initialData: DisplayEvent;
  publicCategoryLabels?: Record<string, string>;
  accessibilityLabels?: Record<string, string>;
  registrationStatusLabels?: Record<string, string>;
  eventStatusLabels?: Record<string, string>;
}) {
  const event = initialData;

  return (
    <main className="p-4 sm:p-6">
      <header className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">
          {event.title}
        </h1>
      </header>

      <section className="bg-white border border-gray-200 shadow-sm">
        {/* Image */}
        <div className="w-full">
          {event.image_url ? (
            <div className="w-full h-48 sm:h-64 md:h-80 relative bg-gray-100">
              <Image
                src={event.image_url as string}
                alt={String(event.title ?? '')}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-full h-48 sm:h-64 bg-gray-100 flex items-center justify-center text-gray-500">
              Pas d&apos;image
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Badges and Status */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Types badges */}
              {Array.isArray(event.type) && event.type.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {event.type.map((t) => (
                    <span
                      key={t}
                      className="text-xs font-poppins px-2.5 py-1 bg-black text-white rounded"
                    >
                      {t.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              {/* Category as circular acronym badges (public) */}
              {Array.isArray(event.category) && event.category.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[...event.category]
                    .sort(
                      (a, b) =>
                        PUBLIC_CATEGORY_ORDER.indexOf(a as PublicCategory) -
                        PUBLIC_CATEGORY_ORDER.indexOf(b as PublicCategory),
                    )
                    .map((a) => (
                      <span
                        key={a}
                        title={PUBLIC_CATEGORY_LABELS[a as PublicCategory] || String(a)}
                        className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 text-[10px] sm:text-xs font-medium text-black bg-white border border-black rounded-full"
                      >
                        {PUBLIC_CATEGORY_ACRONYMS[a as PublicCategory] ??
                          String(a).replace(/_/g, ' ').slice(0, 3).toUpperCase()}
                      </span>
                    ))}
                </div>
              )}

              {/* School grade badges */}
              {Array.isArray(event.grades) && event.grades.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[...event.grades]
                    .sort((a, b) => SCHOOL_GRADE_ORDER.indexOf(a) - SCHOOL_GRADE_ORDER.indexOf(b))
                    .map((grade) => (
                      <span
                        key={grade}
                        title={SCHOOL_GRADE_LABELS[grade] || grade}
                        className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 text-[10px] sm:text-xs font-medium text-white bg-black border border-black rounded-full"
                      >
                        {SCHOOL_GRADE_ACRONYMS[grade] || grade}
                      </span>
                    ))}
                </div>
              )}

              {/* Age range badges */}
              {Array.isArray(event.age_ranges) && event.age_ranges.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[...event.age_ranges]
                    .sort((a, b) => AGE_RANGE_ORDER.indexOf(a) - AGE_RANGE_ORDER.indexOf(b))
                    .map((ageRange) => (
                      <span
                        key={ageRange}
                        title={AGE_RANGE_LABELS[ageRange] || ageRange}
                        className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 text-[10px] sm:text-xs font-medium text-white bg-black border border-black rounded-full"
                      >
                        {AGE_RANGE_ACRONYMS[ageRange] || ageRange}
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Status Badge */}
            <span
              className={`text-xs px-3 py-1.5 rounded-none whitespace-nowrap ${
                event.status === 'ARCHIVED'
                  ? 'bg-gray-100 text-gray-600 border border-gray-300'
                  : event.status === 'CLOSED'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {event.status === 'ARCHIVED'
                ? eventStatusLabels?.ARCHIVED || 'Archivé'
                : event.status === 'CLOSED'
                  ? eventStatusLabels?.CLOSED || 'Fermé'
                  : eventStatusLabels?.OPEN || 'Ouvert'}
            </span>
          </div>

          {/* Description */}
          <div>
            <EventDescription
              description={event.description}
              className="text-sm sm:text-base text-gray-700 font-ibm"
            />
            {event.slug && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-none">
                <p className="text-sm text-justify font-poppins font-semibold text-blue-900 mb-1">
                  Pour plus d&apos;informations sur l&apos;événement, vous pouvez consulter la page
                  dédiée sur le site de l&apos;Opéra Orchestre national de Montpellier :
                </p>
                <a
                  href={`https://www.opera-orchestre-montpellier.fr/evenements/${event.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-700 underline hover:text-blue-900 font-ibm break-all"
                >
                  {`https://www.opera-orchestre-montpellier.fr/evenements/${event.slug}`}
                </a>
              </div>
            )}
          </div>

          {/* Quick facts grid - responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div className="flex items-start gap-3">
              <MapPin size={20} className="text-gray-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-0.5 font-ibm">Lieu</p>
                {event.location ? (
                  <a
                    href={`https://www.google.com/maps/search/${encodeURIComponent(event.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-900 hover:text-black hover:underline focus:outline-none focus:ring-2 focus:ring-black/40 rounded-none wrap-break-word font-ibm"
                  >
                    {event.location}
                  </a>
                ) : (
                  <span className="text-sm font-medium text-gray-400 font-ibm">Non spécifié</span>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock size={20} className="text-gray-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5 font-ibm">Durée</p>
                <p className="text-sm font-medium text-gray-900 font-ibm">{event.duration} min</p>
              </div>
            </div>

            {event.caretaker && event.caretaker > 0 && (
              <div className="flex items-start gap-3">
                <Users size={20} className="text-gray-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5 font-ibm">Accompagnants max</p>
                  <p className="text-sm font-medium text-gray-900 font-ibm">{event.caretaker}</p>
                </div>
              </div>
            )}

            {(event.accessibility?.length ?? 0) > 0 && (
              <div className="flex items-start gap-3">
                <Accessibility size={20} className="text-gray-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5 font-ibm">
                    Accessibilité (Référez-vous aux informations sur le site officiel, vous
                    trouverez le lien ci-dessus)
                  </p>
                  <p className="text-sm font-medium text-gray-900 wrap-break-word font-ibm">
                    {(event.accessibility ?? [])
                      .map(
                        (a) =>
                          (accessibilityLabels ?? DEFAULT_ACCESSIBILITY_LABELS)[a.type as string] ||
                          a.type,
                      )
                      .join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-poppins font-semibold mb-3 text-gray-900">
              Dates disponibles
            </h3>
            <ul className="space-y-2">
              {Array.isArray(event.event_dates) && event.event_dates.length > 0 ? (
                event.event_dates.map((d) => (
                  <li
                    key={String(d)}
                    className="flex items-center gap-3 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-none"
                  >
                    <Calendar size={16} className="text-gray-600 shrink-0" />
                    <span className="font-ibm">{formatDate(d)}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-500 italic">Aucune date renseignée</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Registration / admin area */}
      <div className="mt-6">
        {(function RegistrationArea() {
          const { user, loading } = useUser();
          if (loading)
            return (
              <div className="p-4 bg-white border border-black/5">
                <Loader />
              </div>
            );
          if (!user) {
            return (
              <section className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
                <h3 className="text-lg font-poppins font-semibold mb-2">Inscription</h3>
                <p className="text-sm text-gray-700 mb-4 font-ibm">
                  Vous devez être connecté pour vous inscrire à cet événement.
                </p>
                <Link
                  href="/auth/login"
                  className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-none hover:bg-emerald-700 transition-colors text-sm font-medium font-poppins"
                >
                  Se connecter
                </Link>
              </section>
            );
          }

          // Événement archivé - utilisateurs ne peuvent plus s'inscrire
          if (event.status === 'ARCHIVED' && !user.role.includes('ADMIN')) {
            return (
              <section className="bg-gray-100 border border-gray-300 shadow-sm p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">📦</span>
                  <h3 className="text-lg font-poppins font-semibold text-gray-700">
                    Événement archivé
                  </h3>
                </div>
                <p className="text-sm text-gray-600 font-ibm">
                  Cet événement fait partie des archives et n&apos;est plus ouvert aux inscriptions.
                </p>
              </section>
            );
          }

          if (event.status === 'CLOSED' && !user.role.includes('ADMIN')) {
            return (
              <section className="bg-red-50 border border-red-200 shadow-sm p-4 sm:p-6 rounded-md">
                <h3 className="text-lg font-poppins font-semibold mb-2 text-red-800">
                  Inscriptions closes
                </h3>
                <p className="text-sm text-red-700 font-ibm">
                  Les inscriptions pour cet événement sont closes.
                </p>
              </section>
            );
          }

          // Admins see admin panel, others see user form
          if (user.role.includes('ADMIN')) {
            // Récupérer la première date de l'événement ou utiliser la date actuelle
            const eventDate =
              Array.isArray(event.event_dates) && event.event_dates.length > 0
                ? typeof event.event_dates[0] === 'string'
                  ? new Date(event.event_dates[0])
                  : event.event_dates[0]
                : new Date();

            return (
              <AdminEventDetailClient
                eventId={String(event.id ?? '')}
                eventSlug={event.slug ?? null}
                eventDate={eventDate}
                isArchived={event.status === 'ARCHIVED'}
                eventHasFormation={event.has_initial_formation ?? false}
                eventHasPreparation={event.has_musical_preparation ?? false}
                registrationStatusLabels={registrationStatusLabels}
                accessibilityLabels={accessibilityLabels}
                publicCategoryLabels={publicCategoryLabels}
              />
            );
          }

          return (
            <UserEventDetailClient
              eventId={String(event.id ?? '')}
              eventSlug={event.slug ?? null}
              publicCategoryLabels={publicCategoryLabels}
              accessibilityLabels={accessibilityLabels}
              registrationStatusLabels={registrationStatusLabels}
            />
          );
        })()}
      </div>

      <HelpWidget content={HELP_CONTENTS['event-detail']} />
    </main>
  );
}
