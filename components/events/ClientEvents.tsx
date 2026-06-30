'use client';

import Image from 'next/image';
import type { StaticImageData } from 'next/image';
import dynamic from 'next/dynamic';
import LocalEventPlaceholderImage from '@/assets/hero.jpg';
import MultiSelect from '@/components/ui/MultiSelect';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Calendar, List } from '@deemlol/next-icons';
import { EventData, EventType, PublicCategory } from '@/types/api';
import { useUser } from '@/context/UserContext';
import { getEventUrl } from '@/lib/events/eventUrl';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import {
  EVENT_TYPE_LABELS as DEFAULT_EVENT_TYPE_LABELS,
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  SCHOOL_GRADE_LABELS,
  AGE_RANGE_LABELS,
} from '@/lib/config/labelMappings';
import {
  SCHOOL_GRADE_ACRONYMS,
  AGE_RANGE_ACRONYMS,
  SCHOOL_GRADE_ORDER,
  AGE_RANGE_ORDER,
} from '@/lib/config/badgeConstants';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

const CalendarView = dynamic(() => import('./CalendarView'), {
  loading: () => (
    <div className="border border-gray-200 p-6 text-sm text-gray-600">
      Chargement du calendrier...
    </div>
  ),
});

const REMOTE_EVENT_PLACEHOLDER_IMAGE =
  'https://www.opera-orchestre-montpellier.fr/wp-content/uploads/2023/03/MG1_7857-1920x1280.jpg';

// ============================================================================
// Types
// ============================================================================

interface DynamicLabelsProps {
  eventTypeLabels?: Record<string, string>;
  publicCategoryLabels?: Record<string, string>;
}

/**
 * Mapping des catégories de public vers leurs acronymes
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
 * ClientEvents component
 * Public event listing page.
 * Features:
 * - List and Calendar views
 * - Advanced filtering (Search, Type, Month, Location, Audience)
 * - Auto-filter by audience for logged-in users based on institution type
 * - Responsive event cards
 * - Event details modal
 *
 * @param events - List of events to display
 */
export default function ClientEvents({
  events,
  eventTypeLabels,
  publicCategoryLabels,
}: { events: EventData[] } & DynamicLabelsProps) {
  // Use dynamic labels if provided, otherwise fall back to static defaults
  const EVENT_TYPE_LABELS = eventTypeLabels || DEFAULT_EVENT_TYPE_LABELS;
  const PUBLIC_CATEGORY_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;
  // Get user context to check if admin
  const { user } = useUser();
  const isAdmin = user?.role.includes('ADMIN');

  // Track selected event for modal popup
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  // Track view mode: 'list' or 'calendar'
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string[]>([]);

  /**
   * This feature automatically populates the public category filter based on the user's
   * institution(s) type field. This provides a better UX for establishments
   * by pre-filtering events to their target audience (based on institution type).
   */
  const [selectedPublicType, setSelectedPublicType] = useState<string[]>([]);
  const [failedImageSources, setFailedImageSources] = useState<Set<string>>(() => new Set());

  // Auto-populate the public type filter based on user's institution type
  const hasAutoSelected = useRef(false);

  useEffect(() => {
    // Prevent running multiple times or if user not ready
    if (hasAutoSelected.current) return;
    if (!user || !user.institution_ids || user.institution_ids.length === 0) {
      return;
    }

    // Fetch institution details to get type (category)
    const fetchInstitutionType = async () => {
      try {
        // For simplicity, use the first institution's type
        // In a multi-institution scenario, you could merge all types
        const institutionIds = user.institution_ids;
        if (!institutionIds || institutionIds.length === 0) return;

        const institutionId = institutionIds[0];

        const response = await fetchWithAuth(`/api/institutions/${institutionId}`);
        if (!response.ok) return;

        const data = await response.json();
        const institution = data.institution;

        // If institution has type defined and non-empty, set the filter
        if (institution?.type && Array.isArray(institution.type) && institution.type.length > 0) {
          // Set the filter directly with the array
          setSelectedPublicType(institution.type);
          hasAutoSelected.current = true;
        }
      } catch (error) {
        // Silently fail - just don't set the filter
        console.error('Error fetching institution type:', error);
      }
    };

    fetchInstitutionType();
  }, [user]); // Run when user data becomes available

  // Filter constants
  const eventTypes = [
    'Opéra',
    'Concert lyrique',
    'Symphonique',
    'Chambre / Baroque',
    'En famille',
    'Opéra Junior',
    'Ciné-concert',
    'Insolite',
    'Théâtre musical',
    'Danse',
    'Conte musical',
    'Concert décentralisé',
    'Electro-acoustique',
    'Musique électronique',
  ];

  // Create a reverse mapping from label to DB value for event type filtering
  const eventTypeMapping: Record<string, string> = useMemo(() => {
    const reverseMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(EVENT_TYPE_LABELS)) {
      reverseMap[value] = key;
    }
    return reverseMap;
  }, [EVENT_TYPE_LABELS]);

  const months = [
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
  ];

  const eventTypeOptions = eventTypes.map((type) => ({ label: type, value: type }));
  const monthOptions = months.map((month) => ({ label: month, value: month }));

  // Audience types with their labels - use centralized PUBLIC_CATEGORY_LABELS
  const publicTypes = [
    { label: PUBLIC_CATEGORY_LABELS.CRECHE, value: 'CRECHE' },
    { label: PUBLIC_CATEGORY_LABELS.MATERNELLE, value: 'MATERNELLE' },
    { label: PUBLIC_CATEGORY_LABELS.ELEMENTAIRE, value: 'ELEMENTAIRE' },
    { label: PUBLIC_CATEGORY_LABELS.COLLEGE, value: 'COLLEGE' },
    { label: PUBLIC_CATEGORY_LABELS.LYCEE, value: 'LYCEE' },
    { label: PUBLIC_CATEGORY_LABELS.SUPERIEUR, value: 'SUPERIEUR' },
    { label: PUBLIC_CATEGORY_LABELS.ASSOCIATION, value: 'ASSOCIATION' },
    { label: PUBLIC_CATEGORY_LABELS.CONSERVATOIRE, value: 'CONSERVATOIRE' },
    { label: PUBLIC_CATEGORY_LABELS.PERISCOLAIRE, value: 'PERISCOLAIRE' },
    { label: PUBLIC_CATEGORY_LABELS.PUBLICS_EMPECHES, value: 'PUBLICS_EMPECHES' },
  ];

  // Event filtering
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Filter by search term (title)
      const matchesSearch =
        searchTerm === '' || event.title.toLowerCase().includes(searchTerm.toLowerCase());

      // Filter by type - use mapping to convert label to DB value
      const matchesType =
        selectedType.length === 0 ||
        selectedType.some((type) => event.type.includes(eventTypeMapping[type] as EventType));

      // Filter by month
      const matchesMonth =
        selectedMonth.length === 0 ||
        event.event_dates.some((date) => {
          const eventDate = new Date(date);
          const monthName = eventDate.toLocaleDateString('fr-FR', { month: 'long' });
          const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
          return selectedMonth.includes(capitalizedMonth);
        });

      // Filter by audience type
      const matchesPublicType =
        selectedPublicType.length === 0 ||
        (event.category && event.category.some((type) => selectedPublicType.includes(type)));

      return matchesSearch && matchesType && matchesMonth && matchesPublicType;
    });
  }, [events, searchTerm, selectedType, selectedMonth, selectedPublicType, eventTypeMapping]);

  // Separate past and future events
  const { upcomingEvents, pastEvents } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of current day

    const upcoming: EventData[] = [];
    const past: EventData[] = [];

    filteredEvents.forEach((event) => {
      // Check if event has future dates
      const hasFutureDates = event.event_dates.some((dateStr) => {
        const eventDate = new Date(dateStr);
        return eventDate >= now;
      });

      if (hasFutureDates) {
        upcoming.push(event);
      } else {
        past.push(event);
      }
    });

    // Sort by earliest event date (ascending for upcoming, descending for past)
    const sortByFirstDate = (a: EventData, b: EventData, desc = false) => {
      const dateA = a.event_dates.length > 0 ? new Date(a.event_dates[0]).getTime() : 0;
      const dateB = b.event_dates.length > 0 ? new Date(b.event_dates[0]).getTime() : 0;
      return desc ? dateB - dateA : dateA - dateB;
    };
    upcoming.sort((a, b) => sortByFirstDate(a, b));
    past.sort((a, b) => sortByFirstDate(a, b, true));

    return { upcomingEvents: upcoming, pastEvents: past };
  }, [filteredEvents]);

  // Close on ESC
  const escHandler = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setSelectedEvent(null);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', escHandler);
    return () => document.removeEventListener('keydown', escHandler);
  }, [escHandler]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Date invalide';
    return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const markImageSourceAsFailed = useCallback((src: string) => {
    setFailedImageSources((previous) => {
      if (previous.has(src)) return previous;

      const next = new Set(previous);
      next.add(src);
      return next;
    });
  }, []);

  const getEventImageSource = (imageUrl?: string | null): string | StaticImageData => {
    if (imageUrl && !failedImageSources.has(imageUrl)) {
      return imageUrl;
    }

    if (!failedImageSources.has(REMOTE_EVENT_PLACEHOLDER_IMAGE)) {
      return REMOTE_EVENT_PLACEHOLDER_IMAGE;
    }

    return LocalEventPlaceholderImage;
  };

  // Function to render an event card
  const renderEventCard = (ev: EventData, isPast = false, index = 0) => {
    const imageSource = getEventImageSource(ev.image_url);
    const imageAlt = imageSource === ev.image_url ? ev.title : '';

    return (
      <article
        key={ev.id}
        className={`overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white ${
          isPast ? 'opacity-60 grayscale-30' : ''
        }`}
      >
        <div className="relative h-40 sm:h-44 bg-gray-100">
          <Image
            src={imageSource}
            alt={imageAlt}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={!isPast && index < 3}
            onError={() => {
              if (typeof imageSource === 'string') {
                markImageSourceAsFailed(imageSource);
              }
            }}
          />
        </div>
        <div className="p-3 sm:p-4">
          <h3
            className={`font-poppins font-semibold text-base sm:text-lg mb-1 ${isPast ? 'text-gray-600' : ''}`}
          >
            {ev.title}
          </h3>

          {/* Pastilles de catégorie de public */}
          {ev.category && ev.category.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {[...ev.category]
                .sort((a, b) => PUBLIC_CATEGORY_ORDER.indexOf(a) - PUBLIC_CATEGORY_ORDER.indexOf(b))
                .map((publicCategory) => (
                  <span
                    key={publicCategory}
                    className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 text-[10px] sm:text-xs font-medium text-black bg-white border border-black rounded-full"
                    title={PUBLIC_CATEGORY_LABELS[publicCategory] || publicCategory}
                  >
                    {PUBLIC_CATEGORY_ACRONYMS[publicCategory]}
                  </span>
                ))}
            </div>
          )}

          {/* Pastilles de niveaux scolaires */}
          {ev.grades && ev.grades.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {[...ev.grades]
                .sort((a, b) => SCHOOL_GRADE_ORDER.indexOf(a) - SCHOOL_GRADE_ORDER.indexOf(b))
                .map((grade) => (
                  <span
                    key={grade}
                    className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 text-[10px] sm:text-xs font-medium text-white bg-black border border-black rounded-full"
                    title={SCHOOL_GRADE_LABELS[grade] || grade}
                  >
                    {SCHOOL_GRADE_ACRONYMS[grade] || grade}
                  </span>
                ))}
            </div>
          )}

          {/* Pastilles de tranches d'âge */}
          {ev.age_ranges && ev.age_ranges.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[...ev.age_ranges]
                .sort((a, b) => AGE_RANGE_ORDER.indexOf(a) - AGE_RANGE_ORDER.indexOf(b))
                .map((ageRange) => (
                  <span
                    key={ageRange}
                    className="inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 text-[10px] sm:text-xs font-medium text-white bg-black border border-black rounded-full"
                    title={AGE_RANGE_LABELS[ageRange] || ageRange}
                  >
                    {AGE_RANGE_ACRONYMS[ageRange] || ageRange}
                  </span>
                ))}
            </div>
          )}

          {ev.location &&
            (() => {
              const locationLink = `https://www.google.com/maps/search/${encodeURIComponent(ev.location)}`;
              return locationLink ? (
                <a
                  href={locationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm font-ibm text-gray-700 hover:text-black hover:underline focus:outline-none focus:ring-2 focus:ring-black/40 rounded px-1 ${isPast ? 'text-gray-500' : ''}`}
                >
                  {ev.location}
                </a>
              ) : (
                <p className={`text-xs sm:text-sm ${isPast ? 'text-gray-500' : 'text-gray-600'}`}>
                  {ev.location}
                </p>
              );
            })()}
          {ev.event_dates &&
            ev.event_dates.length > 0 &&
            (() => {
              const sorted = ev.event_dates
                .slice()
                .sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime());
              const first = sorted[0];
              return (
                <button
                  type="button"
                  onClick={() => setSelectedEvent(ev)}
                  className={`mt-2 group flex items-center gap-2 text-left text-xs sm:text-sm font-medium hover:text-black focus:outline-none focus:ring-2 focus:ring-black/40 rounded ${
                    isPast ? 'text-gray-500' : 'text-gray-700'
                  }`}
                  aria-label={`Voir toutes les dates pour ${ev.title}`}
                >
                  <span
                    className={`inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded border transition-colors ${
                      isPast
                        ? 'border-gray-200 bg-gray-100 group-hover:border-gray-400'
                        : 'border-gray-300 bg-gray-50 group-hover:border-black'
                    }`}
                  >
                    <Calendar size={14} className="cursor-pointer sm:hidden">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 2v3m8-3v3M3.5 9h17M5 6h14a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1m3 6h.01m3.99 0h.01m4 0h.01m-8 4h.01m3.99 0h.01m4 0h.01"
                      />
                    </Calendar>
                    <Calendar size={15} className="cursor-pointer hidden sm:block">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 2v3m8-3v3M3.5 9h17M5 6h14a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1m3 6h.01m3.99 0h.01m4 0h.01m-8 4h.01m3.99 0h.01m4 0h.01"
                      />
                    </Calendar>
                  </span>
                  <span className="text-xs sm:text-sm">
                    {formatDate(first)}
                    {sorted.length > 1 && (
                      <span
                        className={`ml-1 text-[10px] sm:text-xs ${isPast ? 'text-gray-400' : 'text-gray-500'}`}
                      >
                        (+{sorted.length - 1} autres)
                      </span>
                    )}
                  </span>
                </button>
              );
            })()}
          {ev.description && (
            <p
              className={`mt-3 text-xs sm:text-sm text-justify line-clamp-3 ${
                isPast ? 'text-gray-500' : 'text-gray-600'
              }`}
            >
              {ev.description}
            </p>
          )}
          <div className="mt-3 sm:mt-4 flex items-center justify-end">
            {!isAdmin && ev.status === 'CLOSED' ? (
              <span className="text-xs sm:text-sm font-poppins font-semibold transition-colors px-3 py-2 text-red-600 border border-red-200 bg-red-50 cursor-not-allowed">
                Inscriptions closes
              </span>
            ) : (
              <a
                href={getEventUrl(ev)}
                className={`text-xs sm:text-sm font-poppins font-semibold transition-colors px-3 py-2 ${
                  isPast
                    ? 'text-gray-500 border border-gray-300 hover:text-gray-700 hover:border-gray-400'
                    : 'text-black border border-black hover:bg-gray-50'
                }`}
              >
                {isAdmin ? "Gérer l'événement" : isPast ? 'Voir détails' : 'Faire une demande'}
              </a>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <main className="p-4 sm:p-6">
      {/* Title */}

      <header className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">
              Événements
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-700 font-ibm">
              Retrouvez toutes nos propositions scolaires et associatives.
            </p>
          </div>

          {/* Boutons de basculement de vue */}
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-poppins font-semibold transition-all flex-1 sm:flex-initial ${
                viewMode === 'list'
                  ? 'bg-black text-white border border-black'
                  : 'text-black border border-black bg-white hover:bg-gray-50'
              }`}
              aria-label="Vue liste"
            >
              <List size={16} />
              <span>Liste</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-poppins font-semibold transition-all flex-1 sm:flex-initial ${
                viewMode === 'calendar'
                  ? 'bg-black text-white border border-black'
                  : 'text-black border border-black bg-white hover:bg-gray-50'
              }`}
              aria-label="Vue calendrier"
            >
              <Calendar size={16} />
              <span>Calendrier</span>
            </button>
          </div>
        </div>
      </header>

      {/* Barre de filtres */}
      <div className="mb-6 sm:mb-8 border-t border-b border-gray-200 py-4 sm:py-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Champ de recherche */}
          <div className="w-full">
            <input
              type="text"
              placeholder="Rechercher un événement..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2 sm:py-2.5 px-3 sm:px-4 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder-gray-500 text-sm sm:text-base"
            />
          </div>

          {/* Filtres en ligne pour mobile, en flex pour desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 sm:gap-4">
            {/* Filtre par type de public */}
            <MultiSelect
              options={publicTypes}
              selectedValues={selectedPublicType}
              onChange={setSelectedPublicType}
              placeholder="Tous les publics"
              className="w-full lg:w-48"
            />

            {/* Filtre par mois */}
            <MultiSelect
              options={monthOptions}
              selectedValues={selectedMonth}
              onChange={setSelectedMonth}
              placeholder="Tous les mois"
              className="w-full lg:w-40"
            />

            {/* Filtre par type */}
            <MultiSelect
              options={eventTypeOptions}
              selectedValues={selectedType}
              onChange={setSelectedType}
              placeholder="Tous les types"
              className="w-full lg:w-48"
            />

            {/* Reset Filters Button */}
            {(searchTerm ||
              selectedType.length > 0 ||
              selectedMonth.length > 0 ||
              selectedPublicType.length > 0) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedType([]);
                  setSelectedMonth([]);
                  setSelectedPublicType([]);
                }}
                className="w-full sm:col-span-2 lg:w-auto px-4 py-2 sm:py-2.5 border border-gray-300 rounded-none hover:bg-gray-50 transition-colors cursor-pointer font-medium text-sm sm:text-base"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Event List or Calendar */}

      <section>
        {upcomingEvents.length === 0 && pastEvents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm sm:text-base text-gray-600 mb-2">
              {events.length === 0
                ? 'Aucun événement disponible pour le moment.'
                : 'Aucun événement ne correspond à vos critères de recherche.'}
            </p>
            {events.length === 0 && (
              <p className="text-xs sm:text-sm text-gray-500 mt-2">
                Les événements seront bientôt disponibles. Veuillez réessayer plus tard.
              </p>
            )}
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-8 sm:space-y-12">
            {/* Upcoming Events */}
            {upcomingEvents.length > 0 && (
              <div>
                <h2 className="text-xl sm:text-2xl font-poppins font-semibold mb-4 sm:mb-6 text-black">
                  Événements à venir
                  <span className="ml-2 text-xs sm:text-sm font-normal text-gray-600">
                    ({upcomingEvents.length} événement{upcomingEvents.length > 1 ? 's' : ''})
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {upcomingEvents.map((ev, index) => renderEventCard(ev, false, index))}
                </div>
              </div>
            )}

            {/* Past Events */}
            {pastEvents.length > 0 && (
              <div>
                <h2 className="text-xl sm:text-2xl font-poppins font-semibold mb-4 sm:mb-6 text-gray-600">
                  Événements passés
                  <span className="ml-2 text-xs sm:text-sm font-normal text-gray-500">
                    ({pastEvents.length} événement{pastEvents.length > 1 ? 's' : ''})
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {pastEvents.map((ev, index) => renderEventCard(ev, true, index))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <CalendarView events={filteredEvents} onEventSelect={setSelectedEvent} />
        )}
      </section>

      {/* Modal for dates */}

      {selectedEvent && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Dates pour ${selectedEvent.title}`}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedEvent(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-lg bg-white shadow-xl p-4 sm:p-6 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-base sm:text-lg font-semibold font-poppins pr-2">
                Dates – {selectedEvent.title}
              </h2>
              <button
                onClick={() => setSelectedEvent(null)}
                className="shrink-0 rounded p-2 text-gray-500 hover:text-black focus:outline-none focus:ring-2 focus:ring-black/40"
                aria-label="Fermer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>
            {selectedEvent.event_dates.length === 0 ? (
              <p className="text-sm text-gray-600">Aucune date disponible.</p>
            ) : (
              <ul className="space-y-2 max-h-60 sm:max-h-72 overflow-auto pr-1">
                {selectedEvent.event_dates
                  .slice()
                  .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                  .map((d) => (
                    <li
                      key={d}
                      className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-xs sm:text-sm bg-white"
                    >
                      <span>{formatDate(d)}</span>
                    </li>
                  ))}
              </ul>
            )}
            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2 sm:gap-0 sm:justify-between">
              <a
                href={getEventUrl(selectedEvent)}
                className={`text-xs sm:text-sm font-poppins font-semibold transition-colors px-4 py-2 cursor-pointer text-center ${
                  !isAdmin && selectedEvent.status === 'CLOSED'
                    ? 'text-red-600 border border-red-200 bg-red-50 pointer-events-none'
                    : 'text-white bg-black hover:bg-gray-800'
                }`}
              >
                {isAdmin
                  ? "Gérer l'événement"
                  : selectedEvent.status === 'CLOSED'
                    ? 'Inscriptions closes'
                    : selectedEvent.event_dates.every((dateStr) => new Date(dateStr) < new Date())
                      ? 'Voir détails'
                      : 'Faire une demande'}
              </a>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-xs sm:text-sm font-poppins font-semibold text-black border border-black hover:bg-gray-50 transition-colors px-4 py-2 cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Widget */}
      <HelpWidget content={HELP_CONTENTS.events} />
    </main>
  );
}
