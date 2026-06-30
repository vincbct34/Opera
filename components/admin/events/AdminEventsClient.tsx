'use client';

import { useState, useEffect, startTransition } from 'react';
import Link from 'next/link';
import { fetchJsonWithAuth, fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import toast from '@/lib/utils/toast';
import Loader from '@/components/ui/Loader';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import AdminEventForm from '@/components/admin/events/AdminEventForm';
import MultiSelect from '@/components/ui/MultiSelect';
import { AdminEvent, AdminEventFormData, EventType, EventStatus } from '@/types/api';
import {
  EVENT_TYPE_LABELS as DEFAULT_EVENT_TYPE_LABELS,
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  ACCESSIBILITY_LABELS as DEFAULT_ACCESSIBILITY_LABELS,
} from '@/lib/config/labelMappings';
import { getEventUrl } from '@/lib/events/eventUrl';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

// ============================================================================
// Types
// ============================================================================

interface DynamicLabelsProps {
  eventTypeLabels?: Record<string, string>;
  publicCategoryLabels?: Record<string, string>;
  eventStatusLabels?: Record<string, string>;
  accessibilityLabels?: Record<string, string>;
}

/**
 * AdminEventsClient component
 * Main dashboard for managing events.
 * Features:
 * - List all events with pagination
 * - Advanced filtering (Search, Type, Month, Location, Audience, Status)
 * - Create new events
 * - Edit existing events
 * - Delete events
 * - Archive/Unarchive events
 */
export default function AdminEventsClient({
  eventTypeLabels,
  publicCategoryLabels,
  eventStatusLabels,
  accessibilityLabels,
}: DynamicLabelsProps = {}) {
  // Use dynamic labels if provided, otherwise fall back to static defaults
  const EVENT_TYPE_LABELS = eventTypeLabels || DEFAULT_EVENT_TYPE_LABELS;
  const PUBLIC_CATEGORY_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;
  const EVENT_STATUS_LABELS = eventStatusLabels || {
    OPEN: 'Ouvert',
    CLOSED: 'Fermé',
    ARCHIVED: 'Archivé',
  };
  const ACCESSIBILITY_LABELS = accessibilityLabels || DEFAULT_ACCESSIBILITY_LABELS;

  const getEventStatusLabel = (status: string) => EVENT_STATUS_LABELS[status] || status;
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string[]>([]);
  const [selectedPublicType, setSelectedPublicType] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, response } = await fetchJsonWithAuth('/api/admin/events');
      if (response.ok && data) {
        // @ts-expect-error - API response typing
        const eventsData = data.events || [];

        // Sort events: future events first (chronologically), then past events (chronologically), then events without dates
        const now = Date.now();
        const sortedEvents = eventsData.sort((a: AdminEvent, b: AdminEvent) => {
          const firstDateA = a.event_dates?.[0] ? new Date(a.event_dates[0]).getTime() : null;
          const firstDateB = b.event_dates?.[0] ? new Date(b.event_dates[0]).getTime() : null;

          // Priority 1: Events without dates go to the end
          if (!firstDateA && !firstDateB) return 0;
          if (!firstDateA) return 1;
          if (!firstDateB) return -1;

          // Priority 2: Future events before past events
          const isFutureA = firstDateA >= now;
          const isFutureB = firstDateB >= now;

          if (isFutureA && !isFutureB) return -1;
          if (!isFutureA && isFutureB) return 1;

          // Priority 3: Chronological order within each group
          return firstDateA - firstDateB;
        });

        setEvents(sortedEvents);
      }
    } catch (err) {
      logger.error(err);
      toast('Erreur lors du chargement des événements', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startTransition(() => {
      fetchEvents();
    });
  }, []);

  const handleCreate = async (formData: AdminEventFormData) => {
    setFormLoading(true);
    try {
      const res = await fetchWithAuth('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la création');
      }

      toast('Événement créé avec succès', 'success');
      setIsCreating(false);
      fetchEvents();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (formData: AdminEventFormData) => {
    if (!editingEvent) return;
    setFormLoading(true);
    try {
      const res = await fetchWithAuth(`/api/admin/events/${editingEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la modification');
      }

      toast('Événement modifié avec succès', 'success');
      setEditingEvent(null);
      fetchEvents();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      const res = await fetchWithAuth(`/api/admin/events/${confirmDeleteId}`, {
        method: 'DELETE',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression');
      }

      toast('Événement supprimé', 'success');
      setEvents((prev) => prev.filter((e) => e.id !== confirmDeleteId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  /**
   * Archive or unarchive an event
   */
  const handleToggleArchive = async (eventId: string, currentStatus: EventStatus) => {
    setArchivingId(eventId);
    try {
      const newStatus = currentStatus === 'ARCHIVED' ? 'CLOSED' : 'ARCHIVED';
      const res = await fetchWithAuth(`/api/admin/events/${eventId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'archivage");
      }

      toast(newStatus === 'ARCHIVED' ? 'Événement archivé' : 'Événement désarchivé', 'success');

      // Update the event in the list
      setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, status: newStatus } : e)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
    } finally {
      setArchivingId(null);
    }
  };

  // Filter constants - use labels from centralized mapping
  const eventTypeOptions = Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({
    label,
    value,
  }));

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

  const locations = ['Opéra Comédie', 'Le Corum', 'Autres'];

  const monthOptions = months.map((month) => ({ label: month, value: month }));
  const locationOptions = locations.map((location) => ({ label: location, value: location }));

  // Audience types with their labels from centralized mapping
  const publicCategoryOptions = Object.entries(PUBLIC_CATEGORY_LABELS)
    .filter(([value]) => value !== 'AUTRE') // Exclude 'AUTRE' from filter options
    .map(([value, label]) => ({ label, value }));

  // Event filtering
  const filteredEvents = events.filter((event) => {
    // Filter by archive status
    if (!showArchived && event.status === 'ARCHIVED') {
      return false;
    }
    if (showArchived && event.status !== 'ARCHIVED') {
      return false;
    }

    // Filter by search term (title)
    const matchesSearch =
      searchTerm === '' || event.title.toLowerCase().includes(searchTerm.toLowerCase());

    // Filter by type - selectedType now contains DB values directly
    const matchesType =
      selectedType.length === 0 ||
      (event.type && selectedType.some((type) => event.type!.includes(type as EventType)));

    // Filter by location - search by inclusion
    const matchesLocation =
      selectedLocation.length === 0 ||
      selectedLocation.some((loc) => {
        if (loc === 'Autres') {
          // For "Autres", check that location doesn't contain "Opéra Comédie" or "Le Corum"
          return !(
            (event.location || '').includes('Opéra Comédie') ||
            (event.location || '').includes('Le Corum')
          );
        }
        // For others, check that location contains the selected value
        return (event.location || '').includes(loc);
      });

    // Filter by month
    const matchesMonth =
      selectedMonth.length === 0 ||
      (event.event_dates &&
        event.event_dates.some((date) => {
          const eventDate = new Date(date);
          const monthName = eventDate.toLocaleDateString('fr-FR', { month: 'long' });
          const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
          return selectedMonth.includes(capitalizedMonth);
        }));

    // Filter by audience type
    const matchesPublicType =
      selectedPublicType.length === 0 ||
      (event.category && event.category.some((type: string) => selectedPublicType.includes(type)));

    return matchesSearch && matchesType && matchesLocation && matchesMonth && matchesPublicType;
  });

  // Reset pagination when filters change
  useEffect(() => {
    startTransition(() => setCurrentPage(1));
  }, [searchTerm, selectedType, selectedMonth, selectedLocation, selectedPublicType, showArchived]);

  // Pagination logic
  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  return (
    <main className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">
              {showArchived ? 'Archives des événements' : 'Gestion des événements'}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-700 font-ibm">
              {showArchived
                ? 'Consultez les événements des saisons précédentes.'
                : 'Création et modification manuelle des événements.'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`px-4 py-2.5 rounded-none transition-colors font-medium text-sm sm:text-base whitespace-nowrap ${
                showArchived
                  ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {showArchived ? '← Événements actifs' : 'Voir les archives'}
            </button>
            {!showArchived && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2.5 bg-black text-white rounded-none hover:bg-gray-800 transition-colors font-medium text-sm sm:text-base whitespace-nowrap"
              >
                + Créer un événement
              </button>
            )}
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

            {/* Filtres */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 sm:gap-4">
              {/* Filtre par type */}
              <MultiSelect
                options={eventTypeOptions}
                selectedValues={selectedType}
                onChange={setSelectedType}
                placeholder="Tous les types"
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

              {/* Filtre par lieu */}
              <MultiSelect
                options={locationOptions}
                selectedValues={selectedLocation}
                onChange={setSelectedLocation}
                placeholder="Tous les lieux"
                className="w-full lg:w-40"
              />

              {/* Filtre par type de public */}
              <MultiSelect
                options={publicCategoryOptions}
                selectedValues={selectedPublicType}
                onChange={setSelectedPublicType}
                placeholder="Tous les publics"
                className="w-full lg:w-48"
              />

              {/* Reset Filters Button */}
              {(searchTerm ||
                selectedType.length > 0 ||
                selectedMonth.length > 0 ||
                selectedLocation.length > 0 ||
                selectedPublicType.length > 0) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedType([]);
                    setSelectedMonth([]);
                    setSelectedLocation([]);
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

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="bg-white rounded-none shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500 font-ibm">Aucun événement trouvé.</p>
          </div>
        ) : (
          <div className="bg-white rounded-none shadow-sm border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {paginatedEvents.map((event) => (
                <div key={event.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-poppins font-semibold text-lg text-gray-900 truncate">
                          {event.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-none ${
                            event.status === 'OPEN'
                              ? 'bg-green-100 text-green-800'
                              : event.status === 'ARCHIVED'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {getEventStatusLabel(event.status)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 font-ibm flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          {event.event_dates && event.event_dates.length > 0
                            ? event.event_dates
                                .slice()
                                .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                                .map((d) =>
                                  new Date(d).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  }),
                                )
                                .join(' · ')
                            : 'Aucune date'}
                        </span>
                        <span>•</span>
                        <span>{event._count?.registrations || 0} inscriptions</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link
                        href={getEventUrl(event)}
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-none hover:bg-gray-50 transition-colors font-medium text-sm"
                      >
                        Voir
                      </Link>
                      {event.status !== 'ARCHIVED' && (
                        <button
                          onClick={() => setEditingEvent(event)}
                          className="px-3 py-1.5 border border-blue-300 text-blue-600 rounded-none hover:bg-blue-50 transition-colors font-medium text-sm"
                        >
                          Modifier
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleArchive(event.id, event.status)}
                        disabled={archivingId === event.id}
                        className={`px-3 py-1.5 border rounded-none transition-colors font-medium text-sm ${
                          event.status === 'ARCHIVED'
                            ? 'border-green-300 text-green-600 hover:bg-green-50'
                            : 'border-amber-300 text-amber-600 hover:bg-amber-50'
                        } disabled:opacity-50`}
                      >
                        {archivingId === event.id
                          ? '...'
                          : event.status === 'ARCHIVED'
                            ? 'Désarchiver'
                            : 'Archiver'}
                      </button>
                      {event.status !== 'ARCHIVED' && (
                        <button
                          onClick={() => setConfirmDeleteId(event.id)}
                          className="px-3 py-1.5 border border-red-300 text-red-600 rounded-none hover:bg-red-50 transition-colors font-medium text-sm"
                          disabled={
                            event._count?.registrations ? event._count.registrations > 0 : false
                          }
                          title={
                            event._count?.registrations && event._count.registrations > 0
                              ? 'Impossible de supprimer un événement avec des inscriptions'
                              : ''
                          }
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 sm:mt-8 pb-6">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-poppins font-semibold text-black border border-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Page précédente
                </button>
                <span className="font-ibm text-xs sm:text-sm text-gray-600 px-2">
                  Page {currentPage} sur {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-poppins font-semibold text-black border border-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Page suivante
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-none shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-poppins font-semibold mb-6">Créer un événement</h3>
            <AdminEventForm
              onSubmit={handleCreate}
              onCancel={() => setIsCreating(false)}
              loading={formLoading}
              eventTypeLabels={EVENT_TYPE_LABELS}
              eventStatusLabels={EVENT_STATUS_LABELS}
              publicCategoryLabels={PUBLIC_CATEGORY_LABELS}
              accessibilityLabels={ACCESSIBILITY_LABELS}
            />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-none shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-poppins font-semibold mb-6">Modifier l&apos;événement</h3>
            <AdminEventForm
              key={editingEvent.id}
              initialData={{
                ...editingEvent,
                accessibility: editingEvent.accessibility?.map((a) => a.type) || [],
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditingEvent(null)}
              loading={formLoading}
              eventTypeLabels={EVENT_TYPE_LABELS}
              eventStatusLabels={EVENT_STATUS_LABELS}
              publicCategoryLabels={PUBLIC_CATEGORY_LABELS}
              accessibilityLabels={ACCESSIBILITY_LABELS}
            />
          </div>
        </div>
      )}

      <ConfirmationModal
        open={!!confirmDeleteId}
        title="Supprimer l'événement"
        description="Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible."
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={handleDelete}
      />

      {/* Help Widget */}
      <HelpWidget content={HELP_CONTENTS['admin-events']} isAdminPage={true} />
    </main>
  );
}
