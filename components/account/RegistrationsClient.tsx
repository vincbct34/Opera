'use client';

import { useState, useEffect, useCallback, startTransition } from 'react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { normalizeApiError } from '@/lib/validation/errorMessages';
import Loader from '@/components/ui/Loader';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import toast from '@/lib/utils/toast';
import Image from 'next/image';
import Link from 'next/link';
import { getEventUrl } from '@/lib/events/eventUrl';
import {
  Calendar,
  MapPin,
  Users,
  Briefcase,
  Edit,
  Save,
  X,
  Award,
  Music,
} from '@deemlol/next-icons';
import type { Registration, Event, Institution, Address, EventStatus } from '@/types/api';
import {
  REGISTRATION_STATUS_LABELS as DEFAULT_REGISTRATION_STATUS_LABELS,
  ACCESSIBILITY_LABELS as DEFAULT_ACCESSIBILITY_LABELS,
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  SCHOOL_GRADE_LABELS as DEFAULT_SCHOOL_GRADE_LABELS,
  AGE_RANGE_LABELS as DEFAULT_AGE_RANGE_LABELS,
} from '@/lib/config/labelMappings';
import { RegistrationStatus, Accessibility } from '@/app/generated/prisma/enums';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

// ============================================================================
// Types
// ============================================================================

interface DynamicLabelsProps {
  registrationStatusLabels?: Record<string, string>;
  accessibilityLabels?: Record<string, string>;
  publicCategoryLabels?: Record<string, string>;
  schoolGradeLabels?: Record<string, string>;
  ageRangeLabels?: Record<string, string>;
}

// Extended types to match API response
type RegistrationWithDetails = Registration & {
  event: Event & {
    accessibility?: { type: Accessibility }[];
    status?: EventStatus;
  };
  institution: Institution & {
    address: Address;
  };
  disabilities?: Array<{
    id: string;
    type: Accessibility;
    count: number;
  }>;
};

const badgeColor = (status: RegistrationStatus) => {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PENDING':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-600 border-gray-300';
    case 'REJECTED':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'ATTENDED':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'NO_SHOW':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200';
  }
};

const rowBackgroundColor = (status: RegistrationStatus) => {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-emerald-50/60';
    case 'PENDING':
      return 'bg-white';
    case 'CANCELLED':
      return 'bg-gray-100/70';
    case 'REJECTED':
      return 'bg-red-50/60';
    case 'ATTENDED':
      return 'bg-blue-50/60';
    case 'NO_SHOW':
      return 'bg-orange-50/60';
    default:
      return 'bg-white';
  }
};

const formatDate = (date: Date | string) => {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

const formatDateTime = (date: Date | string) => {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

/**
 * RegistrationsClient component
 * User dashboard for managing their registrations.
 * Features:
 * - List of user's registrations with status badges
 * - Edit existing pending registrations (seats, needs, etc.)
 * - Cancel pending registrations
 * - Filter by status and search by event/institution
 * - Pagination
 * - Quick statistics overview
 */
export default function RegistrationsClient({
  registrationStatusLabels,
  accessibilityLabels,
  publicCategoryLabels,
  schoolGradeLabels,
  ageRangeLabels,
}: DynamicLabelsProps = {}) {
  // Use dynamic labels if provided, otherwise fall back to static defaults
  const REGISTRATION_STATUS_LABELS = registrationStatusLabels || DEFAULT_REGISTRATION_STATUS_LABELS;
  const ACCESSIBILITY_LABELS = accessibilityLabels || DEFAULT_ACCESSIBILITY_LABELS;
  const PUBLIC_CATEGORY_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;
  const SCHOOL_GRADE_LABELS = schoolGradeLabels || DEFAULT_SCHOOL_GRADE_LABELS;
  const AGE_RANGE_LABELS = ageRangeLabels || DEFAULT_AGE_RANGE_LABELS;
  const statusMap = REGISTRATION_STATUS_LABELS;
  const accessibilityLabelMap = ACCESSIBILITY_LABELS;
  const [registrations, setRegistrations] = useState<RegistrationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedRegId, setSelectedRegId] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<RegistrationWithDetails>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  // Pagination state
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all registrations for client-side filtering and pagination
      const res = await fetchWithAuth('/api/registrations?limit=0');
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg = normalizeApiError(j, 'Impossible de charger vos demandes.');
        setError(msg);
        toast(msg, 'error');
        return;
      }
      const data = await res.json();
      setRegistrations(data.registrations || []);
    } catch {
      const msg = 'Erreur réseau lors du chargement.';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      loadRegistrations();
    });
  }, [loadRegistrations]);

  // Reset page when filters change
  useEffect(() => {
    startTransition(() => setPage(1));
  }, [statusFilter, searchQuery, showArchived]);

  const startEdit = (reg: RegistrationWithDetails) => {
    setEditingId(reg.id);
    setEditDraft({
      booked_seats: reg.booked_seats,
      caretaker_count: reg.caretaker_count,
      aesh_count: reg.aesh_count,
      want_formation: reg.want_formation,
      want_preparation: reg.want_preparation,
      comments: reg.comments,
      manager_first_name: reg.manager_first_name,
      manager_last_name: reg.manager_last_name,
      manager_email: reg.manager_email,
      manager_phone_number: reg.manager_phone_number,
      disabilities: reg.disabilities || [],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const saveEdit = async (regId: string) => {
    setSavingId(regId);
    try {
      const res = await fetchWithAuth(`/api/registrations/${regId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(normalizeApiError(j, 'Erreur lors de la mise à jour'));
      }

      const data = await res.json();
      setRegistrations((prev) =>
        prev.map((r) => (r.id === regId ? { ...r, ...data.registration } : r)),
      );

      toast('Modifications enregistrées', 'success');
      setEditingId(null);
      setEditDraft({});
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erreur réseau', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const cancelRegistration = async (regId: string) => {
    setCancelingId(regId);
    try {
      const res = await fetchWithAuth(`/api/registrations/${regId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(normalizeApiError(j, "Erreur lors de l'annulation"));
      }

      setRegistrations((prev) =>
        prev.map((r) => (r.id === regId ? { ...r, status: 'CANCELLED' } : r)),
      );

      toast('Demande annulée avec succès', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Erreur réseau', 'error');
    } finally {
      setCancelingId(null);
      setConfirmOpen(false);
      setSelectedRegId(null);
      // Reload to ensure the state of the registration is up to date
      window.location.reload();
    }
  };

  const requestCancel = (regId: string) => {
    setSelectedRegId(regId);
    setConfirmOpen(true);
  };

  // Filter registrations
  const filteredRegistrations = registrations.filter((reg) => {
    // Filter by archived status
    const isArchived = reg.event?.status === 'ARCHIVED';
    if (showArchived && !isArchived) return false;
    if (!showArchived && isArchived) return false;

    const matchesStatus = statusFilter === 'ALL' || reg.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      reg.event?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.institution?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredRegistrations.length / ITEMS_PER_PAGE);
  const paginatedRegistrations = filteredRegistrations.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  // Group by status for stats (based on current view - active or archived)
  const currentViewRegistrations = registrations.filter((r) =>
    showArchived ? r.event?.status === 'ARCHIVED' : r.event?.status !== 'ARCHIVED',
  );
  const stats = {
    total: currentViewRegistrations.length,
    pending: currentViewRegistrations.filter((r) => r.status === 'PENDING').length,
    confirmed: currentViewRegistrations.filter((r) => r.status === 'CONFIRMED').length,
    cancelled: currentViewRegistrations.filter((r) => r.status === 'CANCELLED').length,
    rejected: currentViewRegistrations.filter((r) => r.status === 'REJECTED').length,
  };

  // Count archived registrations for the toggle button
  const archivedCount = registrations.filter((r) => r.event?.status === 'ARCHIVED').length;

  if (loading) {
    return (
      <main className="p-4 sm:p-6">
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-6">
      {/* Header */}
      <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">
            {showArchived ? 'Historique des inscriptions' : "Mes demandes d'inscription"}
          </h1>
          <p className="mt-2 text-gray-600 font-ibm text-sm md:text-base">
            {showArchived
              ? 'Consultez vos inscriptions aux événements des saisons précédentes.'
              : "Consultez et gérez vos demandes d'inscription aux événements de l'Opéra de Montpellier."}
          </p>
        </div>
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-4 py-2.5 rounded-none transition-colors font-medium text-sm whitespace-nowrap ${
              showArchived
                ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {showArchived ? '← Inscriptions actives' : `Voir l'historique (${archivedCount})`}
          </button>
        )}
      </header>

      {/* Quick stats */}
      <div className="grid gap-3 sm:gap-4 mb-6 sm:mb-8 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="bg-white border border-black/10 shadow-sm p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500 font-ibm mb-1">Total</div>
          <div className="text-xl sm:text-2xl font-poppins font-semibold">{stats.total}</div>
        </div>
        <div className="bg-white border border-black/10 shadow-sm p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500 font-ibm mb-1">
            {REGISTRATION_STATUS_LABELS.PENDING || 'En attente'}
          </div>
          <div className="text-xl sm:text-2xl font-poppins font-semibold text-amber-600">
            {stats.pending}
          </div>
        </div>
        <div className="bg-white border border-black/10 shadow-sm p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500 font-ibm mb-1">
            {REGISTRATION_STATUS_LABELS.CONFIRMED || 'Confirmées'}
          </div>
          <div className="text-xl sm:text-2xl font-poppins font-semibold text-emerald-600">
            {stats.confirmed}
          </div>
        </div>
        <div className="bg-white border border-black/10 shadow-sm p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500 font-ibm mb-1">
            {REGISTRATION_STATUS_LABELS.CANCELLED || 'Annulées'}
          </div>
          <div className="text-xl sm:text-2xl font-poppins font-semibold text-gray-500">
            {stats.cancelled}
          </div>
        </div>
        <div className="bg-white border border-black/10 shadow-sm p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-gray-500 font-ibm mb-1">
            {REGISTRATION_STATUS_LABELS.REJECTED || 'Rejetées'}
          </div>
          <div className="text-xl sm:text-2xl font-poppins font-semibold text-red-600">
            {stats.rejected}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-black/10 shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">
              Rechercher
            </label>
            <input
              id="search"
              type="text"
              placeholder="Rechercher par événement ou établissement..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black/40 font-ibm text-sm"
            />
          </div>

          {/* Status filter */}
          <div className="sm:w-48">
            <label htmlFor="status-filter" className="sr-only">
              Filtrer par statut
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black/40 font-ibm text-sm cursor-pointer"
            >
              <option value="ALL">Tous les statuts</option>
              {Object.values(RegistrationStatus).map((status) => (
                <option key={status} value={status}>
                  {REGISTRATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 mb-6 font-ibm text-sm">
          {error}
        </div>
      )}

      {/* Registrations list */}
      {paginatedRegistrations.length === 0 ? (
        <div className="bg-white border border-black/10 shadow-sm p-6 sm:p-8 text-center">
          <p className="text-gray-500 font-ibm">
            {registrations.length === 0
              ? "Vous n'avez aucune demande d'inscription pour le moment."
              : 'Aucune demande ne correspond à vos critères de recherche.'}
          </p>
          {registrations.length === 0 && (
            <Link
              href="/events"
              className="inline-block mt-4 px-4 py-2 bg-black text-white font-poppins font-semibold hover:bg-gray-800 transition-colors"
            >
              Découvrir les événements
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4 sm:space-y-6">
            {paginatedRegistrations.map((reg) => {
              const isEditing = editingId === reg.id;
              const isSaving = savingId === reg.id;
              const canEdit = reg.status === 'PENDING' || reg.status === 'CONFIRMED';

              return (
                <article
                  key={reg.id}
                  className={`border border-black/10 shadow-sm hover:shadow-md transition-shadow ${rowBackgroundColor(reg.status)} ${reg.status !== 'PENDING' ? 'opacity-65' : ''}`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-4">
                    {/* Event image */}
                    <div className="lg:col-span-1">
                      {reg.event?.image_url ? (
                        <div className="w-full h-48 lg:h-full relative bg-gray-100">
                          <Image
                            src={reg.event.image_url}
                            alt={reg.event.title || 'Événement'}
                            fill
                            sizes="auto"
                            className="object-cover"
                            loading="eager"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-48 lg:h-full bg-gray-100 flex items-center justify-center text-gray-400">
                          <span className="text-sm font-ibm">Pas d&apos;image</span>
                        </div>
                      )}
                    </div>

                    {/* Registration details */}
                    <div className="lg:col-span-3 p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                        <div className="flex-1">
                          <h2 className="text-lg sm:text-xl font-poppins font-semibold mb-2">
                            <Link
                              href={reg.event ? getEventUrl(reg.event) : `/events/${reg.event_id}`}
                              className="hover:underline focus:underline"
                            >
                              {reg.event?.title || 'Événement sans titre'}
                            </Link>
                          </h2>

                          <div className="flex flex-wrap gap-2 mb-3">
                            <span
                              className={`inline-block text-xs font-semibold rounded-full border px-3 py-1 ${badgeColor(reg.status)}`}
                            >
                              {statusMap[reg.status] || reg.status}
                            </span>

                            {Array.isArray(reg.event?.type) && reg.event.type.length > 0 && (
                              <>
                                {reg.event.type.map((t) => (
                                  <span
                                    key={t}
                                    className="text-xs font-poppins px-2 py-1 bg-black text-white"
                                  >
                                    {t.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 shrink-0 flex-wrap">
                          <Link
                            href={reg.event ? getEventUrl(reg.event) : `/events/${reg.event_id}`}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-none hover:bg-gray-50 transition-colors font-medium text-xs sm:text-sm font-poppins"
                          >
                            Voir l&apos;événement
                          </Link>

                          {!isEditing && canEdit && (
                            <button
                              onClick={() => startEdit(reg)}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 border border-blue-300 text-blue-600 rounded-none hover:bg-blue-50 transition-colors font-medium text-xs sm:text-sm font-poppins flex items-center gap-1"
                            >
                              <Edit className="w-3 h-3" />
                              Modifier
                            </button>
                          )}

                          {isEditing && (
                            <>
                              <button
                                onClick={() => saveEdit(reg.id)}
                                disabled={isSaving}
                                className="px-3 sm:px-4 py-1.5 sm:py-2 border border-emerald-300 text-emerald-600 rounded-none hover:bg-emerald-50 transition-colors font-medium text-xs sm:text-sm font-poppins disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                              >
                                <Save className="w-3 h-3" />
                                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={isSaving}
                                className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 text-gray-600 rounded-none hover:bg-gray-50 transition-colors font-medium text-xs sm:text-sm font-poppins disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                Annuler
                              </button>
                            </>
                          )}

                          {!isEditing && reg.status === 'PENDING' && (
                            <button
                              onClick={() => requestCancel(reg.id)}
                              disabled={cancelingId === reg.id}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 border border-red-300 text-red-600 rounded-none hover:bg-red-50 transition-colors font-medium text-xs sm:text-sm font-poppins disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {cancelingId === reg.id ? 'Annulation...' : 'Annuler'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Registration info grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm font-ibm">
                        <div className="flex items-start gap-2">
                          <Calendar className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                              Date de la séance
                            </div>
                            <div className="text-gray-900">{formatDateTime(reg.date)}</div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Users className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                          <div className="w-full">
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                              Places réservées
                            </div>
                            {isEditing ? (
                              <div className="flex items-center gap-2 max-w-55">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditDraft((prev) => ({
                                      ...prev,
                                      booked_seats: Math.max(
                                        1,
                                        (prev.booked_seats ?? reg.booked_seats) - 1,
                                      ),
                                    }))
                                  }
                                  className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700 shrink-0"
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={editDraft.booked_seats ?? reg.booked_seats}
                                  onChange={(e) =>
                                    setEditDraft((prev) => ({
                                      ...prev,
                                      booked_seats: parseInt(e.target.value, 10) || 1,
                                    }))
                                  }
                                  className="flex-1 text-center px-2 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black/40 text-sm font-ibm font-medium"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditDraft((prev) => ({
                                      ...prev,
                                      booked_seats: (prev.booked_seats ?? reg.booked_seats) + 1,
                                    }))
                                  }
                                  className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700 shrink-0"
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <div className="text-gray-900">
                                {reg.booked_seats} place{reg.booked_seats !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>

                        {(isEditing || (reg.caretaker_count && reg.caretaker_count > 0)) && (
                          <div className="flex items-start gap-2">
                            <Users className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                            <div className="w-full">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                                Accompagnants
                              </div>
                              {isEditing ? (
                                <div className="flex items-center gap-2 max-w-55">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const bookedSeats =
                                        editDraft.booked_seats ?? reg.booked_seats;
                                      const currentCaretakers =
                                        editDraft.caretaker_count ?? reg.caretaker_count ?? 0;
                                      const aeshCount = editDraft.aesh_count ?? reg.aesh_count ?? 0;
                                      const disabilities = (
                                        editDraft.disabilities ||
                                        reg.disabilities ||
                                        []
                                      ).reduce((sum, d) => sum + d.count, 0);
                                      const newValue = Math.max(0, currentCaretakers - 1);
                                      const total = newValue + aeshCount + disabilities;
                                      if (total <= bookedSeats) {
                                        setEditDraft((prev) => ({
                                          ...prev,
                                          caretaker_count: newValue,
                                        }));
                                      }
                                    }}
                                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700 shrink-0"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editDraft.caretaker_count ?? reg.caretaker_count ?? 0}
                                    onChange={(e) => {
                                      const bookedSeats =
                                        editDraft.booked_seats ?? reg.booked_seats;
                                      const newValue = parseInt(e.target.value, 10) || 0;
                                      const aeshCount = editDraft.aesh_count ?? reg.aesh_count ?? 0;
                                      const disabilities = (
                                        editDraft.disabilities ||
                                        reg.disabilities ||
                                        []
                                      ).reduce((sum, d) => sum + d.count, 0);
                                      const total = newValue + aeshCount + disabilities;
                                      if (total <= bookedSeats) {
                                        setEditDraft((prev) => ({
                                          ...prev,
                                          caretaker_count: newValue,
                                        }));
                                      }
                                    }}
                                    className="flex-1 text-center px-2 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black/40 text-sm font-ibm font-medium"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const bookedSeats =
                                        editDraft.booked_seats ?? reg.booked_seats;
                                      const currentCaretakers =
                                        editDraft.caretaker_count ?? reg.caretaker_count ?? 0;
                                      const aeshCount = editDraft.aesh_count ?? reg.aesh_count ?? 0;
                                      const disabilities = (
                                        editDraft.disabilities ||
                                        reg.disabilities ||
                                        []
                                      ).reduce((sum, d) => sum + d.count, 0);
                                      const newValue = currentCaretakers + 1;
                                      const total = newValue + aeshCount + disabilities;
                                      if (total <= bookedSeats) {
                                        setEditDraft((prev) => ({
                                          ...prev,
                                          caretaker_count: newValue,
                                        }));
                                      }
                                    }}
                                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700 shrink-0"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <div className="text-gray-900">
                                  {reg.caretaker_count} accompagnant
                                  {(reg.caretaker_count ?? 0) !== 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {(isEditing || (reg.aesh_count && reg.aesh_count > 0)) && (
                          <div className="flex items-start gap-2">
                            <Users className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                            <div className="w-full">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                                AESH
                              </div>
                              {isEditing ? (
                                <div className="flex items-center gap-2 max-w-55">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const bookedSeats =
                                        editDraft.booked_seats ?? reg.booked_seats;
                                      const caretakers =
                                        editDraft.caretaker_count ?? reg.caretaker_count ?? 0;
                                      const currentAesh =
                                        editDraft.aesh_count ?? reg.aesh_count ?? 0;
                                      const disabilities = (
                                        editDraft.disabilities ||
                                        reg.disabilities ||
                                        []
                                      ).reduce((sum, d) => sum + d.count, 0);
                                      const newValue = Math.max(0, currentAesh - 1);
                                      const total = caretakers + newValue + disabilities;
                                      if (total <= bookedSeats) {
                                        setEditDraft((prev) => ({ ...prev, aesh_count: newValue }));
                                      }
                                    }}
                                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700 shrink-0"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editDraft.aesh_count ?? reg.aesh_count ?? 0}
                                    onChange={(e) => {
                                      const bookedSeats =
                                        editDraft.booked_seats ?? reg.booked_seats;
                                      const newValue = parseInt(e.target.value, 10) || 0;
                                      const caretakers =
                                        editDraft.caretaker_count ?? reg.caretaker_count ?? 0;
                                      const disabilities = (
                                        editDraft.disabilities ||
                                        reg.disabilities ||
                                        []
                                      ).reduce((sum, d) => sum + d.count, 0);
                                      const total = caretakers + newValue + disabilities;
                                      if (total <= bookedSeats) {
                                        setEditDraft((prev) => ({ ...prev, aesh_count: newValue }));
                                      }
                                    }}
                                    className="flex-1 text-center px-2 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black/40 text-sm font-ibm font-medium"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const bookedSeats =
                                        editDraft.booked_seats ?? reg.booked_seats;
                                      const caretakers =
                                        editDraft.caretaker_count ?? reg.caretaker_count ?? 0;
                                      const currentAesh =
                                        editDraft.aesh_count ?? reg.aesh_count ?? 0;
                                      const disabilities = (
                                        editDraft.disabilities ||
                                        reg.disabilities ||
                                        []
                                      ).reduce((sum, d) => sum + d.count, 0);
                                      const newValue = currentAesh + 1;
                                      const total = caretakers + newValue + disabilities;
                                      if (total <= bookedSeats) {
                                        setEditDraft((prev) => ({ ...prev, aesh_count: newValue }));
                                      }
                                    }}
                                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700 shrink-0"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <div className="text-gray-900">{reg.aesh_count} AESH</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Want Formation */}
                        {(isEditing || reg.want_formation) && reg.event?.has_initial_formation && (
                          <div className="flex items-start gap-2">
                            <Award className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                            <div className="w-full">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                                Formation initiale
                              </div>
                              {isEditing ? (
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={
                                      editDraft.want_formation ?? reg.want_formation ?? false
                                    }
                                    onChange={(e) =>
                                      setEditDraft((prev) => ({
                                        ...prev,
                                        want_formation: e.target.checked,
                                      }))
                                    }
                                    className="w-4 h-4 border-gray-300 rounded text-emerald-600 focus:ring-emerald-500"
                                  />
                                  <span className="text-sm text-gray-700">
                                    Je souhaite bénéficier de la formation
                                  </span>
                                </label>
                              ) : (
                                <div className="text-gray-900">
                                  {reg.want_formation ? 'Oui' : 'Non'}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Want Preparation */}
                        {(isEditing || reg.want_preparation) &&
                          reg.event?.has_musical_preparation && (
                            <div className="flex items-start gap-2">
                              <Music className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                              <div className="w-full">
                                <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                                  Préparation musicale
                                </div>
                                {isEditing ? (
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={
                                        editDraft.want_preparation ?? reg.want_preparation ?? false
                                      }
                                      onChange={(e) =>
                                        setEditDraft((prev) => ({
                                          ...prev,
                                          want_preparation: e.target.checked,
                                        }))
                                      }
                                      className="w-4 h-4 border-gray-300 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      Je souhaite bénéficier de la préparation musicale
                                    </span>
                                  </label>
                                ) : (
                                  <div className="text-gray-900">
                                    {reg.want_preparation ? 'Oui' : 'Non'}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                        <div className="flex items-start gap-2">
                          <Briefcase className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                              Établissement
                            </div>
                            <div className="text-gray-900">{reg.institution?.name || '—'}</div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                              Lieu
                            </div>
                            <div className="text-gray-900">{reg.event?.location || '—'}</div>
                          </div>
                        </div>

                        {/* Category, grades and age ranges */}
                        {((reg.category && reg.category.length > 0) ||
                          (reg.grades && reg.grades.length > 0) ||
                          (reg.age_ranges && reg.age_ranges.length > 0)) && (
                          <div className="flex items-start gap-2 sm:col-span-2">
                            <Briefcase className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                                Public
                              </div>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {reg.category &&
                                  reg.category.length > 0 &&
                                  reg.category.map((cat) => (
                                    <span
                                      key={cat}
                                      className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 font-ibm"
                                    >
                                      {PUBLIC_CATEGORY_LABELS[cat] || cat}
                                    </span>
                                  ))}
                                {reg.grades &&
                                  reg.grades.length > 0 &&
                                  reg.grades.map((grade) => (
                                    <span
                                      key={grade}
                                      className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 font-ibm"
                                    >
                                      {SCHOOL_GRADE_LABELS[grade] || grade}
                                    </span>
                                  ))}
                                {reg.age_ranges &&
                                  reg.age_ranges.length > 0 &&
                                  reg.age_ranges.map((ageRange) => (
                                    <span
                                      key={ageRange}
                                      className="text-xs px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 font-ibm"
                                    >
                                      {AGE_RANGE_LABELS[ageRange] || ageRange}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {(isEditing ||
                          (reg.manager_first_name && reg.manager_last_name) ||
                          reg.manager_email) && (
                          <div className="flex items-start gap-2 sm:col-span-2">
                            <Users className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                                  Prénom du responsable
                                </div>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={
                                      editDraft.manager_first_name ?? reg.manager_first_name ?? ''
                                    }
                                    onChange={(e) =>
                                      setEditDraft((prev) => ({
                                        ...prev,
                                        manager_first_name: e.target.value,
                                      }))
                                    }
                                    className="w-full px-2 py-1 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black/40 text-sm"
                                    placeholder="Prénom"
                                  />
                                ) : (
                                  <div className="text-gray-900">
                                    {reg.manager_first_name || '—'}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                                  Nom du responsable
                                </div>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={
                                      editDraft.manager_last_name ?? reg.manager_last_name ?? ''
                                    }
                                    onChange={(e) =>
                                      setEditDraft((prev) => ({
                                        ...prev,
                                        manager_last_name: e.target.value,
                                      }))
                                    }
                                    className="w-full px-2 py-1 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black/40 text-sm"
                                    placeholder="Nom"
                                  />
                                ) : (
                                  <div className="text-gray-900">
                                    {reg.manager_last_name || '—'}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                                  Email du responsable
                                </div>
                                {isEditing ? (
                                  <input
                                    type="email"
                                    value={editDraft.manager_email ?? reg.manager_email ?? ''}
                                    onChange={(e) =>
                                      setEditDraft((prev) => ({
                                        ...prev,
                                        manager_email: e.target.value,
                                      }))
                                    }
                                    className="w-full px-2 py-1 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black/40 text-sm"
                                    placeholder="email@exemple.fr"
                                  />
                                ) : (
                                  <div className="text-xs text-gray-600">
                                    {reg.manager_email || '—'}
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                                  Téléphone du responsable
                                </div>
                                {isEditing ? (
                                  <input
                                    type="tel"
                                    value={
                                      editDraft.manager_phone_number ??
                                      reg.manager_phone_number ??
                                      ''
                                    }
                                    onChange={(e) =>
                                      setEditDraft((prev) => ({
                                        ...prev,
                                        manager_phone_number: e.target.value,
                                      }))
                                    }
                                    className="w-full px-2 py-1 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black/40 text-sm"
                                    placeholder="06 12 34 56 78"
                                  />
                                ) : (
                                  <div className="text-xs text-gray-600">
                                    {reg.manager_phone_number || '—'}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-2">
                          <Calendar className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-0.5">
                              Demande créée le
                            </div>
                            <div className="text-gray-900">{formatDate(reg.created_at)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Comments */}
                      {(isEditing || reg.comments) && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                              Commentaires
                            </div>
                            {isEditing ? (
                              <textarea
                                value={editDraft.comments ?? reg.comments ?? ''}
                                onChange={(e) =>
                                  setEditDraft((prev) => ({ ...prev, comments: e.target.value }))
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black/40 text-sm font-ibm"
                                rows={2}
                                placeholder="Commentaires additionnels..."
                              />
                            ) : (
                              <div className="text-sm text-gray-700 font-ibm">
                                {reg.comments || '—'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Disabilities info */}
                      {(reg.disabilities && reg.disabilities.length > 0) || isEditing ? (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                            Besoins d&apos;accessibilité
                          </div>
                          {isEditing ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {(
                                [
                                  Accessibility.VISUAL,
                                  Accessibility.AUDITORY,
                                  Accessibility.MOTOR,
                                  Accessibility.PSYCHIC,
                                ] as const
                              ).map((accessType) => {
                                const currentDisability = (editDraft.disabilities || []).find(
                                  (d) => d.type === accessType,
                                );
                                const currentCount = currentDisability?.count || 0;

                                return (
                                  <div
                                    key={accessType}
                                    className="bg-gray-50 border border-gray-300 p-3 rounded-none"
                                  >
                                    <label className="block text-xs text-gray-600 mb-2 font-ibm font-medium">
                                      {accessibilityLabelMap[accessType]}
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const count = Math.max(0, currentCount - 1);
                                          setEditDraft((prev) => {
                                            const disabilities = prev.disabilities || [];
                                            if (count === 0) {
                                              // Remove if count is 0
                                              return {
                                                ...prev,
                                                disabilities: disabilities.filter(
                                                  (d) => d.type !== accessType,
                                                ),
                                              };
                                            } else {
                                              // Update existing or add new
                                              const existingIndex = disabilities.findIndex(
                                                (d) => d.type === accessType,
                                              );
                                              if (existingIndex >= 0) {
                                                const newDisabilities = [...disabilities];
                                                newDisabilities[existingIndex] = {
                                                  ...newDisabilities[existingIndex],
                                                  count,
                                                };
                                                return { ...prev, disabilities: newDisabilities };
                                              } else {
                                                return {
                                                  ...prev,
                                                  disabilities: [
                                                    ...disabilities,
                                                    {
                                                      id: '',
                                                      type: accessType as Accessibility,
                                                      count,
                                                    },
                                                  ],
                                                };
                                              }
                                            }
                                          });
                                        }}
                                        className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700 shrink-0"
                                      >
                                        −
                                      </button>
                                      <input
                                        type="number"
                                        min="0"
                                        value={currentCount || ''}
                                        onChange={(e) => {
                                          const bookedSeats =
                                            editDraft.booked_seats ?? reg.booked_seats;
                                          const caretakers =
                                            editDraft.caretaker_count ?? reg.caretaker_count ?? 0;
                                          const aeshCount =
                                            editDraft.aesh_count ?? reg.aesh_count ?? 0;
                                          const otherDisabilities = (
                                            editDraft.disabilities ||
                                            reg.disabilities ||
                                            []
                                          )
                                            .filter((d) => d.type !== accessType)
                                            .reduce((sum, d) => sum + d.count, 0);
                                          const inputCount =
                                            e.target.value === '' ? 0 : Number(e.target.value);
                                          const maxAllowed = Math.max(
                                            0,
                                            bookedSeats -
                                              caretakers -
                                              aeshCount -
                                              otherDisabilities,
                                          );
                                          const count = Math.min(inputCount, maxAllowed);

                                          setEditDraft((prev) => {
                                            const disabilities = prev.disabilities || [];
                                            if (count === 0) {
                                              return {
                                                ...prev,
                                                disabilities: disabilities.filter(
                                                  (d) => d.type !== accessType,
                                                ),
                                              };
                                            } else {
                                              const existingIndex = disabilities.findIndex(
                                                (d) => d.type === accessType,
                                              );
                                              if (existingIndex >= 0) {
                                                const newDisabilities = [...disabilities];
                                                newDisabilities[existingIndex] = {
                                                  ...newDisabilities[existingIndex],
                                                  count,
                                                };
                                                return { ...prev, disabilities: newDisabilities };
                                              } else {
                                                return {
                                                  ...prev,
                                                  disabilities: [
                                                    ...disabilities,
                                                    {
                                                      id: '',
                                                      type: accessType as Accessibility,
                                                      count,
                                                    },
                                                  ],
                                                };
                                              }
                                            }
                                          });
                                        }}
                                        className="flex-1 text-center p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm font-medium"
                                        placeholder="0"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const bookedSeats =
                                            editDraft.booked_seats ?? reg.booked_seats;
                                          const caretakers =
                                            editDraft.caretaker_count ?? reg.caretaker_count ?? 0;
                                          const aeshCount =
                                            editDraft.aesh_count ?? reg.aesh_count ?? 0;
                                          const otherDisabilities = (
                                            editDraft.disabilities ||
                                            reg.disabilities ||
                                            []
                                          )
                                            .filter((d) => d.type !== accessType)
                                            .reduce((sum, d) => sum + d.count, 0);
                                          const maxAllowed = Math.max(
                                            0,
                                            bookedSeats -
                                              caretakers -
                                              aeshCount -
                                              otherDisabilities,
                                          );
                                          const count = Math.min(currentCount + 1, maxAllowed);

                                          if (count <= currentCount) return; // Already at max

                                          setEditDraft((prev) => {
                                            const disabilities = prev.disabilities || [];
                                            const existingIndex = disabilities.findIndex(
                                              (d) => d.type === accessType,
                                            );
                                            if (existingIndex >= 0) {
                                              const newDisabilities = [...disabilities];
                                              newDisabilities[existingIndex] = {
                                                ...newDisabilities[existingIndex],
                                                count,
                                              };
                                              return { ...prev, disabilities: newDisabilities };
                                            } else {
                                              return {
                                                ...prev,
                                                disabilities: [
                                                  ...disabilities,
                                                  {
                                                    id: '',
                                                    type: accessType as Accessibility,
                                                    count,
                                                  },
                                                ],
                                              };
                                            }
                                          });
                                        }}
                                        className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700 shrink-0"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {reg.disabilities?.map((disability) => (
                                <span
                                  key={disability.id}
                                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 bg-black text-white"
                                >
                                  {accessibilityLabelMap[disability.type] || disability.type}:{' '}
                                  {disability.count}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 sm:mt-8 pb-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-poppins font-semibold text-black border border-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Page précédente
              </button>
              <span className="font-ibm text-xs sm:text-sm text-gray-600 px-2">
                Page {page} sur {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-poppins font-semibold text-black border border-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Page suivante
              </button>
            </div>
          )}
        </>
      )}

      {/* Confirmation modal */}
      <ConfirmationModal
        open={confirmOpen}
        title="Annuler la demande"
        description="Êtes-vous sûr de vouloir annuler cette demande d'inscription ? Cette action est irréversible."
        onCancel={() => {
          setConfirmOpen(false);
          setSelectedRegId(null);
        }}
        onConfirm={() => {
          if (selectedRegId) {
            cancelRegistration(selectedRegId);
          }
        }}
      />

      <HelpWidget content={HELP_CONTENTS['account-registrations']} />
    </main>
  );
}
