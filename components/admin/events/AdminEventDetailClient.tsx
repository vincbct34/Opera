'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import Loader from '@/components/ui/Loader';
import toast from '@/lib/utils/toast';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import AbsenceReasonModal from '@/components/admin/events/AbsenceReasonModal';
import EditAttendanceModal from '@/components/admin/events/EditAttendanceModal';
import EditRegistrationModal from '@/components/admin/events/EditRegistrationModal';
import InstitutionHistoryModal from '@/components/admin/events/InstitutionHistoryModal';
import RegistrationCard from '@/components/admin/events/RegistrationCard';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Download,
  ChevronLeft,
  ChevronRight,
} from '@deemlol/next-icons';
import {
  RegistrationStatus,
  Accessibility,
  PublicCategory,
  SchoolGrade,
  AgeRange,
} from '@/types/api';

interface RegistrationData {
  id: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
  };
  institution: {
    id: string;
    name: string;
    type: PublicCategory[];
    is_rep: boolean;
    address?: {
      city: string;
    };
  };
  date: string;
  booked_seats: number;
  caretaker_count?: number;
  aesh_count?: number;
  status: RegistrationStatus;
  manager_first_name?: string;
  manager_last_name?: string;
  manager_email?: string;
  manager_phone_number?: string;
  comments?: string;
  disabilities?: Array<{ type: Accessibility; count: number; details?: string | null }>;
  was_present_comment?: string;
  created_at: string;
  updated_at?: string;
  score?: number;
  scoreBreakdown?: Array<{
    type: string;
    weight: number;
    rawScore: number;
    weightedScore: number;
    details?: string;
  }>;
  history?: {
    totalRegistrations: number;
    attendanceRate: number;
    monthsSinceLastAttendance: number | null;
    recentNoShow: boolean;
  };
  category?: PublicCategory[];
  grades?: SchoolGrade[];
  age_ranges?: AgeRange[];
  want_formation?: boolean;
  want_preparation?: boolean;
}

interface ScoringConfiguration {
  id: string;
  name: string;
  is_default: boolean;
}

/**
 * AdminEventDetailClient component
 * Comprehensive interface for managing a specific event's registrations.
 * Features:
 * - View registrations list with filtering and sorting
 * - Manage registration status (Confirm, Reject, Attend, No-show)
 * - Edit attendance details
 * - View institution history
 * - Export data to Excel
 * - Scoring configuration selection
 *
 * @param eventId - The ID of the event
 * @param eventSlug - The slug of the event (optional)
 * @param eventDate - The date of the event
 * @param isArchived - Whether the event is archived (read-only mode)
 */
export default function AdminEventDetailClient({
  eventId,
  eventSlug,
  eventDate,
  isArchived = false,
  eventHasFormation = false,
  eventHasPreparation = false,
  registrationStatusLabels,
  accessibilityLabels,
  publicCategoryLabels,
}: {
  eventId: string;
  eventSlug: string | null;
  eventDate: Date;
  isArchived?: boolean;
  eventHasFormation?: boolean;
  eventHasPreparation?: boolean;
  registrationStatusLabels?: Record<string, string>;
  accessibilityLabels?: Record<string, string>;
  publicCategoryLabels?: Record<string, string>;
}) {
  const [registrations, setRegistrations] = useState<RegistrationData[]>([]);
  const eventIdentifier = eventSlug || eventId; // Use slug if available, otherwise ID
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modals
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
  const [editAttendanceModalOpen, setEditAttendanceModalOpen] = useState(false);
  const [editRegistrationModalOpen, setEditRegistrationModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Modal data
  const [actionData, setActionData] = useState<{
    registrationId: string;
    action:
      | 'delete'
      | 'confirm'
      | 'reject'
      | 'attended'
      | 'noshow'
      | 'edit_attendance'
      | 'edit_registration';
  } | null>(null);
  const [historyInstitutionId, setHistoryInstitutionId] = useState<string | null>(null);
  const [historyInstitutionName, setHistoryInstitutionName] = useState('');

  // Scoring configuration
  const [configurations, setConfigurations] = useState<ScoringConfiguration[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [configurationsLoaded, setConfigurationsLoaded] = useState(false);

  // Filters and search
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RegistrationStatus | 'ALL'>('ALL');
  const [scoreFilter, setScoreFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [repFilter, setRepFilter] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'seats'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Default items per page

  // Export
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchConfigurations();
  }, []);

  useEffect(() => {
    // Charger les inscriptions une fois que les configurations sont chargées
    if (configurationsLoaded) {
      fetchRegistrations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, selectedConfigId, configurationsLoaded]);

  const fetchConfigurations = async () => {
    try {
      const response = await fetchWithAuth('/api/admin/scoring-config');
      const data = await response.json();
      if (response.ok && data.success) {
        setConfigurations(data.configurations);
        // Sélectionner la config par défaut
        const defaultConfig = data.configurations.find((c: ScoringConfiguration) => c.is_default);
        if (defaultConfig) {
          setSelectedConfigId(defaultConfig.id);
        } else if (data.configurations.length > 0) {
          setSelectedConfigId(data.configurations[0].id);
        }
        setConfigurationsLoaded(true);
      } else {
        logger.error('Failed to fetch configurations:', data);
        setConfigurationsLoaded(true); // Marquer comme chargé même en cas d'erreur
      }
    } catch (error) {
      logger.error('Error fetching configurations:', error);
      setConfigurationsLoaded(true); // Marquer comme chargé même en cas d'erreur
    }
  };

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedConfigId) {
        params.append('configId', selectedConfigId);
      }
      params.append('includeScores', 'true');
      // Request all registrations for client-side filtering and pagination
      params.append('limit', '0'); // Assuming API is updated to handle limit=0 for all

      const url = `/api/events/${eventIdentifier}/registrations?${params.toString()}`;

      const response = await fetchWithAuth(url);
      const data = await response.json();

      if (response.ok && data.registrations) {
        setRegistrations(data.registrations);
        setPage(1); // Reset page to 1 when new data is fetched
      } else {
        logger.error('Failed to fetch registrations:', data);
        toast('Erreur lors du chargement des inscriptions', 'error');
      }
    } catch (error) {
      logger.error('Error fetching registrations:', error);
      toast('Erreur lors du chargement des inscriptions', 'error');
    } finally {
      setLoading(false);
    }
  }, [eventIdentifier, selectedConfigId]);

  const handleStatusChange = async (
    registrationId: string,
    newStatus: RegistrationStatus,
    comment?: string,
  ) => {
    setUpdatingId(registrationId);
    try {
      const body: { status: RegistrationStatus; was_present_comment?: string } = {
        status: newStatus,
      };
      if (comment) {
        body.was_present_comment = comment;
      }

      const response = await fetchWithAuth(
        `/api/events/${eventIdentifier}/registrations/${registrationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur lors de la mise à jour');
      }

      await fetchRegistrations();
      toast('Statut mis à jour', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur';
      toast(msg, 'error');
      logger.error(error);
    } finally {
      setUpdatingId(null);
      setConfirmModalOpen(false);
      setAbsenceModalOpen(false);
      setActionData(null);
    }
  };

  const handleDelete = async (registrationId: string) => {
    setUpdatingId(registrationId);
    try {
      const response = await fetchWithAuth(
        `/api/events/${eventIdentifier}/registrations/${registrationId}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur lors de la suppression');
      }

      await fetchRegistrations();
      toast('Inscription supprimée', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur';
      toast(msg, 'error');
      logger.error(error);
    } finally {
      setUpdatingId(null);
      setConfirmModalOpen(false);
      setActionData(null);
    }
  };

  const openConfirmModal = (
    registrationId: string,
    action: 'delete' | 'confirm' | 'reject' | 'attended',
  ) => {
    setActionData({ registrationId, action });
    setConfirmModalOpen(true);
  };

  const openAbsenceModal = (registrationId: string) => {
    setActionData({ registrationId, action: 'noshow' });
    setAbsenceModalOpen(true);
  };

  const openEditAttendanceModal = (registrationId: string) => {
    setActionData({ registrationId, action: 'edit_attendance' });
    setEditAttendanceModalOpen(true);
  };

  const openEditRegistrationModal = (registrationId: string) => {
    setActionData({ registrationId, action: 'edit_registration' });
    setEditRegistrationModalOpen(true);
  };

  const openHistoryModal = (institutionId: string, institutionName: string) => {
    setHistoryInstitutionId(institutionId);
    setHistoryInstitutionName(institutionName);
    setHistoryModalOpen(true);
  };

  const handleConfirmAction = () => {
    if (!actionData) return;

    if (actionData.action === 'delete') {
      handleDelete(actionData.registrationId);
    } else if (actionData.action === 'confirm') {
      handleStatusChange(actionData.registrationId, 'CONFIRMED');
    } else if (actionData.action === 'reject') {
      handleStatusChange(actionData.registrationId, 'REJECTED');
    } else if (actionData.action === 'attended') {
      handleStatusChange(actionData.registrationId, 'ATTENDED');
    }
  };

  const handleAbsenceConfirm = (reason: string) => {
    if (!actionData) return;
    handleStatusChange(actionData.registrationId, 'NO_SHOW', reason);
  };

  const handleEditAttendanceConfirm = (
    status: Extract<RegistrationStatus, 'ATTENDED' | 'NO_SHOW'>,
    comment?: string,
  ) => {
    if (!actionData) return;
    handleStatusChange(actionData.registrationId, status, comment);
    setEditAttendanceModalOpen(false);
  };

  const handleRegistrationUpdate = async (
    registrationId: string,
    data: {
      user_id?: string;
      institution_id?: string;
      booked_seats: number;
      caretaker_count?: number | null;
      aesh_count?: number | null;
      manager_first_name?: string | null;
      manager_last_name?: string | null;
      manager_email?: string | null;
      manager_phone_number?: string | null;
      comments?: string | null;
      want_formation?: boolean | null;
      want_preparation?: boolean | null;
      disabilities?: Array<{ type: Accessibility; count: number; details?: string | null }>;
      category?: PublicCategory[];
      grades?: SchoolGrade[];
      age_ranges?: AgeRange[];
      was_present_comment?: string | null;
    },
  ) => {
    setUpdatingId(registrationId);
    try {
      const response = await fetchWithAuth(
        `/api/events/${eventIdentifier}/registrations/${registrationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la mise à jour');
      }

      await fetchRegistrations();
      toast('Inscription modifiée avec succès', 'success');
      setEditRegistrationModalOpen(false);
      setActionData(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur';
      toast(msg, 'error');
      logger.error(error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedConfigId) {
        params.append('configId', selectedConfigId);
      }

      const response = await fetchWithAuth(
        `/api/admin/events/${eventIdentifier}/export-scored?${params.toString()}`,
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de l'export");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Extraire le nom de fichier du header Content-Disposition si disponible
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          a.download = filenameMatch[1];
        } else {
          a.download = `export-scores-${eventIdentifier}-${new Date().toISOString().split('T')[0]}.xlsx`;
        }
      } else {
        a.download = `export-scores-${eventId}-${new Date().toISOString().split('T')[0]}.xlsx`;
      }

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast('Export généré avec succès', 'success');
    } catch (error) {
      logger.error('Error exporting:', error);
      const errorMessage = error instanceof Error ? error.message : "Erreur lors de l'export";
      toast(errorMessage, 'error');
    } finally {
      setExporting(false);
    }
  };

  const normalizeSearchValue = (value: string | null | undefined) => value?.toLowerCase() ?? '';

  // Filtrage et tri (client-side)
  const filteredAndSortedRegistrations = useMemo(() => {
    let currentRegistrations = [...registrations];

    // Filtre de recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      currentRegistrations = currentRegistrations.filter(
        (r) =>
          normalizeSearchValue(r.institution.name).includes(query) ||
          normalizeSearchValue(r.user.first_name).includes(query) ||
          normalizeSearchValue(r.user.last_name).includes(query) ||
          normalizeSearchValue(r.user.email).includes(query),
      );
    }

    // Filtre de statut
    if (statusFilter !== 'ALL') {
      currentRegistrations = currentRegistrations.filter((r) => r.status === statusFilter);
    }

    // Filtre de score
    if (scoreFilter !== 'ALL') {
      currentRegistrations = currentRegistrations.filter((r) => {
        if (r.score === undefined || r.score === null) return false;
        if (scoreFilter === 'HIGH') return r.score >= 75;
        if (scoreFilter === 'MEDIUM') return r.score >= 50 && r.score < 75;
        if (scoreFilter === 'LOW') return r.score < 50;
        return true;
      });
    }

    // Filtre REP+
    if (repFilter) {
      currentRegistrations = currentRegistrations.filter((r) => r.institution.is_rep);
    }

    // Tri
    currentRegistrations.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'score') {
        const scoreA = a.score ?? 0;
        const scoreB = b.score ?? 0;
        comparison = scoreA - scoreB;
      } else if (sortBy === 'date') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'seats') {
        comparison = a.booked_seats - b.booked_seats;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return currentRegistrations;
  }, [registrations, searchQuery, statusFilter, scoreFilter, repFilter, sortBy, sortOrder]);

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedRegistrations.length / itemsPerPage);
  const paginatedRegistrations = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedRegistrations.slice(startIndex, endIndex);
  }, [filteredAndSortedRegistrations, page, itemsPerPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      setExpandedId(null); // Collapse any expanded cards on page change
    }
  };

  // Statistiques
  const stats = {
    total: registrations.length,
    pending: registrations.filter((r) => r.status === 'PENDING').length,
    confirmed: registrations.filter((r) => r.status === 'CONFIRMED').length,
    rejected: registrations.filter((r) => r.status === 'REJECTED').length,
    totalSeats: registrations.reduce((sum, r) => sum + r.booked_seats, 0),
    avgScore: (() => {
      const scored = registrations.filter((r) => r.score !== null && r.score !== undefined);
      return scored.length > 0
        ? Math.round(scored.reduce((sum, r) => sum + (r.score ?? 0), 0) / scored.length)
        : 0;
    })(),
  };

  if (loading) {
    return (
      <section className="bg-white border border-gray-200 shadow-sm p-6">
        <div className="flex justify-center">
          <Loader />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="bg-white border border-gray-200 shadow-sm">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-poppins font-semibold mb-4">
            Gestion des inscriptions
          </h2>

          {/* Bandeau d'avertissement pour les événements archivés */}
          {isArchived && (
            <div className="mb-4 p-4 bg-gray-100 border border-gray-300 flex items-start gap-3">
              <span className="text-xl">📦</span>
              <div>
                <p className="text-sm font-poppins font-semibold text-gray-700">
                  Événement archivé - Mode consultation
                </p>
                <p className="text-xs text-gray-600 font-ibm mt-1">
                  Cet événement est archivé. Les inscriptions sont affichées en lecture seule.
                </p>
              </div>
            </div>
          )}

          {/* Configuration Selector & Export */}
          {configurations.length > 0 && (
            <div className="mb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex-1">
                <label className="block text-sm font-poppins font-medium mb-2">
                  Configuration de tri
                </label>
                <select
                  value={selectedConfigId ?? ''}
                  onChange={(e) => setSelectedConfigId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 bg-white text-sm font-ibm focus:outline-none focus:border-blue-500"
                >
                  {configurations.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name}
                      {config.is_default ? ' (Par défaut)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting || registrations.length === 0}
                className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-poppins font-medium flex items-center gap-2 whitespace-nowrap"
              >
                <Download size={18} />
                {exporting ? 'Export en cours...' : 'Exporter Excel'}
              </button>
            </div>
          )}

          {/* Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <div className="bg-gray-50 p-3 border border-gray-200">
              <p className="text-xs text-gray-500 mb-1 font-ibm">Total</p>
              <p className="text-xl font-bold text-gray-900 font-poppins">{stats.total}</p>
            </div>
            <div className="bg-amber-50 p-3 border border-amber-200">
              <p className="text-xs text-amber-700 mb-1 font-ibm">
                {registrationStatusLabels?.PENDING || 'En attente'}
              </p>
              <p className="text-xl font-bold text-amber-700 font-poppins">{stats.pending}</p>
            </div>
            <div className="bg-emerald-50 p-3 border border-emerald-200">
              <p className="text-xs text-emerald-700 mb-1 font-ibm">
                {registrationStatusLabels?.CONFIRMED || 'Confirmées'}
              </p>
              <p className="text-xl font-bold text-emerald-700 font-poppins">{stats.confirmed}</p>
            </div>
            <div className="bg-red-50 p-3 border border-red-200">
              <p className="text-xs text-red-700 mb-1 font-ibm">
                {registrationStatusLabels?.REJECTED || 'Rejetées'}
              </p>
              <p className="text-xl font-bold text-red-700 font-poppins">{stats.rejected}</p>
            </div>
            <div className="bg-blue-50 p-3 border border-blue-200">
              <p className="text-xs text-blue-700 mb-1 font-ibm">Places</p>
              <p className="text-xl font-bold text-blue-700 font-poppins">{stats.totalSeats}</p>
            </div>
            <div className="bg-purple-50 p-3 border border-purple-200">
              <p className="text-xs text-purple-700 mb-1 font-ibm">Score moyen</p>
              <p className="text-xl font-bold text-purple-700 font-poppins">{stats.avgScore}</p>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1); // Reset page on search
                }}
                placeholder="Rechercher par institution, nom, email..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 text-sm font-ibm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Toggle Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="mb-4 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-poppins font-medium flex items-center gap-2"
          >
            <Filter size={16} />
            Filtres avancés
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 space-y-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">Statut</label>
                <div className="flex gap-2 flex-wrap">
                  {['ALL', 'PENDING', 'CONFIRMED', 'REJECTED', 'ATTENDED', 'NO_SHOW'].map(
                    (status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(status as RegistrationStatus | 'ALL');
                          setPage(1); // Reset page on filter change
                        }}
                        className={`px-3 py-1.5 text-xs transition-colors font-poppins font-medium ${
                          statusFilter === status
                            ? 'bg-black text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {status === 'ALL' && 'Tous'}
                        {status === 'PENDING' &&
                          (registrationStatusLabels?.PENDING || 'En attente')}
                        {status === 'CONFIRMED' &&
                          (registrationStatusLabels?.CONFIRMED || 'Confirmées')}
                        {status === 'REJECTED' &&
                          (registrationStatusLabels?.REJECTED || 'Rejetées')}
                        {status === 'ATTENDED' &&
                          (registrationStatusLabels?.ATTENDED || 'Présents')}
                        {status === 'NO_SHOW' && (registrationStatusLabels?.NO_SHOW || 'Absents')}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Score Filter */}
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">Score</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: 'ALL', label: 'Tous' },
                    { value: 'HIGH', label: 'Élevé (75-100)' },
                    { value: 'MEDIUM', label: 'Moyen (50-74)' },
                    { value: 'LOW', label: 'Faible (<50)' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setScoreFilter(option.value as 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW');
                        setPage(1); // Reset page on filter change
                      }}
                      className={`px-3 py-1.5 text-xs transition-colors font-poppins font-medium ${
                        scoreFilter === option.value
                          ? 'bg-black text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* REP+ Filter */}
              <div>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repFilter}
                    onChange={(e) => {
                      setRepFilter(e.target.checked);
                      setPage(1); // Reset page on filter change
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm font-ibm">Afficher uniquement les REP+</span>
                </label>
              </div>

              {/* Sort Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-poppins font-medium mb-2">Trier par</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'score' | 'date' | 'seats')}
                    className="w-full px-3 py-2 border border-gray-300 bg-white text-sm font-ibm focus:outline-none focus:border-blue-500"
                  >
                    <option value="score">Score</option>
                    <option value="date">Date d&apos;inscription</option>
                    <option value="seats">Nombre de places</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-poppins font-medium mb-2">Ordre</label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    className="w-full px-3 py-2 border border-gray-300 bg-white text-sm font-ibm focus:outline-none focus:border-blue-500"
                  >
                    <option value="desc">Décroissant</option>
                    <option value="asc">Croissant</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Results Count */}
          <div className="text-sm text-gray-600 font-ibm">
            {filteredAndSortedRegistrations.length} résultat
            {filteredAndSortedRegistrations.length > 1 ? 's' : ''}
            {filteredAndSortedRegistrations.length !== registrations.length &&
              ` sur ${registrations.length}`}
          </div>
        </div>

        {/* Registrations List */}
        <div className="divide-y divide-gray-200">
          {paginatedRegistrations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="font-ibm">Aucune inscription trouvée</p>
            </div>
          ) : (
            paginatedRegistrations.map((reg) => (
              <RegistrationCard
                key={reg.id}
                registration={reg}
                eventDate={eventDate}
                expanded={expandedId === reg.id}
                updating={updatingId === reg.id}
                isArchived={isArchived}
                onToggleExpand={() => setExpandedId(expandedId === reg.id ? null : reg.id)}
                onConfirm={() => openConfirmModal(reg.id, 'confirm')}
                onReject={() => openConfirmModal(reg.id, 'reject')}
                onDelete={() => openConfirmModal(reg.id, 'delete')}
                onMarkAttended={() => openConfirmModal(reg.id, 'attended')}
                onMarkNoShow={() => openAbsenceModal(reg.id)}
                onEditAttendance={() => openEditAttendanceModal(reg.id)}
                onViewHistory={() => openHistoryModal(reg.institution.id, reg.institution.name)}
                onEditRegistration={() => openEditRegistrationModal(reg.id)}
                registrationStatusLabels={registrationStatusLabels}
                accessibilityLabels={accessibilityLabels}
                publicCategoryLabels={publicCategoryLabels}
              />
            ))
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 p-4 border-t border-gray-200">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-ibm text-sm">
              Page {page} sur {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setPage(1); // Reset to first page when items per page changes
              }}
              className="ml-4 px-3 py-2 border border-gray-300 bg-white text-sm font-ibm focus:outline-none focus:border-blue-500"
            >
              <option value={5}>5 par page</option>
              <option value={10}>10 par page</option>
              <option value={20}>20 par page</option>
              <option value={50}>50 par page</option>
            </select>
          </div>
        )}
      </section>

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={confirmModalOpen}
        title={
          actionData?.action === 'delete'
            ? 'Supprimer inscription'
            : actionData?.action === 'confirm'
              ? 'Confirmer inscription'
              : actionData?.action === 'reject'
                ? 'Rejeter inscription'
                : 'Marquer comme présent'
        }
        description={
          actionData?.action === 'delete'
            ? 'Confirmer la suppression de cette inscription ? Cette action est irréversible.'
            : actionData?.action === 'confirm'
              ? 'Confirmer cette inscription ?'
              : actionData?.action === 'reject'
                ? 'Rejeter cette inscription ?'
                : 'Marquer cette inscription comme présente ?'
        }
        onCancel={() => {
          setConfirmModalOpen(false);
          setActionData(null);
        }}
        onConfirm={handleConfirmAction}
      />

      {/* Absence Reason Modal */}
      <AbsenceReasonModal
        open={absenceModalOpen}
        institutionName={
          actionData
            ? registrations.find((r) => r.id === actionData.registrationId)?.institution.name || ''
            : ''
        }
        eventTitle={`Événement du ${new Date(eventDate).toLocaleDateString('fr-FR')}`}
        onCancel={() => {
          setAbsenceModalOpen(false);
          setActionData(null);
        }}
        onConfirm={handleAbsenceConfirm}
        saving={updatingId === actionData?.registrationId}
      />

      {/* Edit Attendance Modal */}
      {/* Key prop forces re-mount when registration changes, resetting state */}
      <EditAttendanceModal
        key={actionData?.registrationId || 'edit-attendance-modal'}
        open={editAttendanceModalOpen}
        institutionName={
          actionData
            ? registrations.find((r) => r.id === actionData.registrationId)?.institution.name || ''
            : ''
        }
        eventTitle={`Événement du ${new Date(eventDate).toLocaleDateString('fr-FR')}`}
        currentStatus={
          actionData
            ? (registrations.find((r) => r.id === actionData.registrationId)?.status as Extract<
                RegistrationStatus,
                'ATTENDED' | 'NO_SHOW'
              >) || 'ATTENDED'
            : 'ATTENDED'
        }
        currentComment={
          actionData
            ? registrations.find((r) => r.id === actionData.registrationId)?.was_present_comment
            : undefined
        }
        onCancel={() => {
          setEditAttendanceModalOpen(false);
          setActionData(null);
        }}
        onConfirm={handleEditAttendanceConfirm}
        saving={updatingId === actionData?.registrationId}
        registrationStatusLabels={registrationStatusLabels}
      />

      {/* Institution History Modal */}
      <InstitutionHistoryModal
        open={historyModalOpen}
        institutionId={historyInstitutionId}
        institutionName={historyInstitutionName}
        onClose={() => {
          setHistoryModalOpen(false);
          setHistoryInstitutionId(null);
          setHistoryInstitutionName('');
        }}
        registrationStatusLabels={registrationStatusLabels}
        publicCategoryLabels={publicCategoryLabels}
      />

      {/* Edit Registration Modal */}
      <EditRegistrationModal
        open={editRegistrationModalOpen}
        registration={
          actionData ? registrations.find((r) => r.id === actionData.registrationId) || null : null
        }
        eventHasFormation={eventHasFormation}
        eventHasPreparation={eventHasPreparation}
        onCancel={() => {
          setEditRegistrationModalOpen(false);
          setActionData(null);
        }}
        onConfirm={(data) => handleRegistrationUpdate(actionData!.registrationId, data)}
        saving={updatingId === actionData?.registrationId}
        accessibilityLabels={accessibilityLabels}
        publicCategoryLabels={publicCategoryLabels}
      />
    </>
  );
}
