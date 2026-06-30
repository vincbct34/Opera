'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import Loader from '@/components/ui/Loader';
import { fetchJsonWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import toast from '@/lib/utils/toast';
import ExportDialog from '@/components/admin/misc/ExportDialog';
import { getEventUrl } from '@/lib/events/eventUrl';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';
import {
  TrendingUp,
  CheckSquare,
  Users,
  Calendar,
  Briefcase,
  BarChart,
  PieChart,
  Download,
} from '@deemlol/next-icons';

type DetailedStats = {
  dashboardStats: {
    upcomingEvents: number;
    totalUsers: number;
    totalInstitutions: number;
    pendingRegistrations: number;
  };
  registrationsByStatus: {
    PENDING: number;
    CONFIRMED: number;
    CANCELLED: number;
    REJECTED: number;
    ATTENDED: number;
    NO_SHOW: number;
  };
  usersByRole: {
    USER: number;
    ADMIN: number;
    SUPERADMIN: number;
  };
  eventCapacity: {
    totalEvents: number;
    totalCapacity: number;
    totalBooked: number;
    occupancyRate: number;
    averageCapacityPerEvent: number;
  };
  registrationTrend: Array<{
    date: string;
    count: number;
  }>;
  topInstitutions: Array<{
    id: string;
    name: string;
    city: string;
    count: number;
  }>;
  topEvents: Array<{
    id: string;
    title: string;
    slug: string | null;
    registrationsCount: number;
    occupancyRate: number;
  }>;
};

const ITEMS_PER_PAGE = 5;

/**
 * AdminStatisticsClient component
 * Displays comprehensive statistics for the admin dashboard.
 * Features:
 * - Key metrics (Events, Users, Institutions, Pending Registrations)
 * - Charts/Visualizations for Registration Status and User Roles
 * - Event Capacity analysis
 * - Top Institutions and Top Events lists with pagination
 * - Data export functionality
 * - Time period filtering (Week, Month, Year, All)
 */
export default function AdminStatisticsClient({
  registrationStatusLabels,
  eventStatusLabels,
  publicCategoryLabels,
}: {
  registrationStatusLabels?: Record<string, string>;
  eventStatusLabels?: Record<string, string>;
  publicCategoryLabels?: Record<string, string>;
} = {}) {
  const { user, loading } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [period, setPeriod] = useState<'all' | 'week' | 'month' | 'year'>('month');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Pagination state for institutions
  const [institutionPage, setInstitutionPage] = useState(1);
  const [institutionSearch, setInstitutionSearch] = useState('');
  const [institutionCitySearch, setInstitutionCitySearch] = useState('');
  const [searchedInstitutions, setSearchedInstitutions] = useState<
    Array<{ id: string; name: string; city: string; count: number }>
  >([]);
  const [institutionSearchLoading, setInstitutionSearchLoading] = useState(false);
  const [isSearchingInstitutions, setIsSearchingInstitutions] = useState(false);
  const institutionSearchDebounceRef = useRef<number | undefined>(undefined);

  // Pagination state for events
  const [eventPage, setEventPage] = useState(1);
  const [eventSearch, setEventSearch] = useState('');
  const [filteredEvents, setFilteredEvents] = useState<
    Array<{
      id: string;
      title: string;
      slug: string | null;
      registrationsCount: number;
      occupancyRate: number;
    }>
  >([]);

  // Navigation handlers
  const handleInstitutionClick = (institutionId: string) => {
    router.push(`/admin/institutions/${institutionId}`);
  };

  const handleEventClick = (event: { id: string; slug: string | null }) => {
    router.push(getEventUrl(event));
  };

  // Redirect non-admin users
  useEffect(() => {
    if (!loading && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN'))) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Fetch statistics
  useEffect(() => {
    const fetchStats = async () => {
      setDataLoading(true);
      try {
        const { data, response } = await fetchJsonWithAuth<{ data: DetailedStats }>(
          `/api/admin/stats/detailed?period=${period}`,
        );
        if (response.ok && data?.data) {
          setStats(data.data);
          setInstitutionPage(1);
          setEventPage(1);
        } else {
          toast('Erreur lors du chargement des statistiques', 'error');
        }
      } catch (err) {
        logger.error('Error fetching stats:', err);
        toast('Erreur lors du chargement des statistiques', 'error');
      } finally {
        setDataLoading(false);
      }
    };

    fetchStats();
  }, [period]);

  // Search institutions via API with debounce
  const searchInstitutionsApi = useCallback(
    async (name: string, city: string) => {
      // Minimum 2 chars for name search (API requirement)
      if (name.length < 2) {
        setSearchedInstitutions([]);
        setIsSearchingInstitutions(false);
        return;
      }

      setInstitutionSearchLoading(true);
      try {
        const params = new URLSearchParams({ name, limit: '20' });
        if (city.length >= 2) {
          params.append('city', city);
        }

        const response = await fetch(`/api/institutions/search?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          // Map search results to include count from stats if available
          const resultsWithCounts = (data.institutions || []).map(
            (inst: { id: string; name: string; address?: { city?: string } }) => {
              const statsInst = stats?.topInstitutions.find((s) => s.id === inst.id);
              return {
                id: inst.id,
                name: inst.name,
                city: inst.address?.city || '',
                count: statsInst?.count || 0,
              };
            },
          );
          setSearchedInstitutions(resultsWithCounts);
        }
      } catch (err) {
        logger.error('Error searching institutions:', err);
      } finally {
        setInstitutionSearchLoading(false);
      }
    },
    [stats],
  );

  // Debounced institution search effect
  useEffect(() => {
    const hasSearch = institutionSearch.length >= 2 || institutionCitySearch.length >= 2;
    setIsSearchingInstitutions(hasSearch);

    if (!hasSearch) {
      setSearchedInstitutions([]);
      return;
    }

    // Debounce the API call
    if (institutionSearchDebounceRef.current) {
      window.clearTimeout(institutionSearchDebounceRef.current);
    }

    institutionSearchDebounceRef.current = window.setTimeout(() => {
      searchInstitutionsApi(institutionSearch, institutionCitySearch);
    }, 300) as unknown as number;

    return () => {
      if (institutionSearchDebounceRef.current) {
        window.clearTimeout(institutionSearchDebounceRef.current);
      }
    };
  }, [institutionSearch, institutionCitySearch, searchInstitutionsApi]);

  // Reset institution page when search changes
  useEffect(() => {
    setInstitutionPage(1);
  }, [institutionSearch, institutionCitySearch]);

  // Filter events based on search
  useEffect(() => {
    if (!stats) return;
    const filtered = stats.topEvents.filter((event) =>
      event.title.toLowerCase().includes(eventSearch.toLowerCase()),
    );
    setFilteredEvents(filtered);
    setEventPage(1);
  }, [eventSearch, stats]);

  if (loading) {
    return (
      <main className="flex justify-center items-center h-[90vh]">
        <Loader />
      </main>
    );
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    return null;
  }

  if (dataLoading) {
    return (
      <main className="flex justify-center items-center h-[90vh]">
        <Loader />
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="p-4 sm:p-6">
        <div className="bg-white border border-gray-200 shadow-sm p-8 text-center rounded-none">
          <p className="text-gray-500 font-ibm">Erreur lors du chargement des statistiques</p>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4 mb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">
                  Statistiques
                </h1>
                <p className="mt-2 text-sm sm:text-base text-gray-700 font-ibm">
                  Analyse complète de la plateforme et de l&#39;activité utilisateur
                </p>
              </div>
              <button
                onClick={() => setExportDialogOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white hover:bg-gray-800 transition-colors font-medium text-sm sm:text-base whitespace-nowrap w-auto self-start sm:self-auto"
              >
                <Download size={18} />
                <span>Exporter les données</span>
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'week', 'month', 'year'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium border rounded-none transition-colors ${
                    period === p
                      ? 'bg-black text-white border-black'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p === 'all' ? 'Tout' : p === 'week' ? '7j' : p === 'month' ? '30j' : '1a'}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Key Metrics Cards */}
        <section className="mb-8 sm:mb-10">
          <h2 className="text-lg sm:text-xl font-poppins font-semibold mb-3 sm:mb-4">
            Indicateurs clés
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Upcoming Events */}
            <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 font-ibm mb-1">
                    Événements à venir
                  </p>
                  <p className="text-2xl sm:text-3xl font-poppins font-bold">
                    {stats.dashboardStats.upcomingEvents}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full flex items-center justify-center shrink-0">
                  <Calendar size={16} className="sm:w-4.5 sm:h-4.5" color="#ffffff" />
                </div>
              </div>
            </div>

            {/* Total Users */}
            <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 font-ibm mb-1">Utilisateurs</p>
                  <p className="text-2xl sm:text-3xl font-poppins font-bold">
                    {stats.dashboardStats.totalUsers}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full flex items-center justify-center shrink-0">
                  <Users size={16} className="sm:w-4.5 sm:h-4.5" color="#ffffff" />
                </div>
              </div>
            </div>

            {/* Total Institutions */}
            <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 font-ibm mb-1">Établissements</p>
                  <p className="text-2xl sm:text-3xl font-poppins font-bold">
                    {stats.dashboardStats.totalInstitutions}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full flex items-center justify-center shrink-0">
                  <Briefcase size={16} className="sm:w-4.5 sm:h-4.5" color="#ffffff" />
                </div>
              </div>
            </div>

            {/* Pending Registrations */}
            <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 font-ibm mb-1">
                    {registrationStatusLabels?.PENDING || 'En attente'}
                  </p>
                  <p className="text-2xl sm:text-3xl font-poppins font-bold">
                    {stats.dashboardStats.pendingRegistrations}
                  </p>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full flex items-center justify-center shrink-0">
                  <CheckSquare size={16} className="sm:w-4.5 sm:h-4.5" color="#ffffff" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Registration Status & Users by Role */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-10">
          {/* Registration Status */}
          <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none">
            <div className="flex items-center gap-2 mb-4">
              <PieChart size={18} className="sm:w-5 sm:h-5 shrink-0" />
              <h3 className="text-base sm:text-lg font-poppins font-semibold">
                Statut des inscriptions
              </h3>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {Object.entries(stats.registrationsByStatus).map(([status, count]) => {
                const total = Object.values(stats.registrationsByStatus).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                const badgeStyles: { [key: string]: { bg: string; text: string } } = {
                  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
                  CONFIRMED: { bg: 'bg-green-100', text: 'text-green-800' },
                  CANCELLED: { bg: 'bg-red-100', text: 'text-red-800' },
                  REJECTED: { bg: 'bg-orange-100', text: 'text-orange-800' },
                  ATTENDED: { bg: 'bg-blue-100', text: 'text-blue-800' },
                  NO_SHOW: { bg: 'bg-gray-100', text: 'text-gray-800' },
                };
                const labels: { [key: string]: string } = {
                  PENDING: registrationStatusLabels?.PENDING || 'En cours',
                  CONFIRMED: registrationStatusLabels?.CONFIRMED || 'Confirmée',
                  CANCELLED: registrationStatusLabels?.CANCELLED || 'Annulée',
                  REJECTED: registrationStatusLabels?.REJECTED || 'Rejetée',
                  ATTENDED: registrationStatusLabels?.ATTENDED || 'Présent',
                  NO_SHOW: registrationStatusLabels?.NO_SHOW || 'Absent',
                };

                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-none text-xs font-medium ${badgeStyles[status]?.bg || 'bg-gray-100'} ${badgeStyles[status]?.text || 'text-gray-800'}`}
                      >
                        {labels[status] || status}
                      </span>
                      <span className="text-xs sm:text-sm font-poppins font-semibold">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-black" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Users by Role */}
          <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none">
            <div className="flex items-center gap-2 mb-4">
              <Users size={18} className="sm:w-5 sm:h-5 shrink-0" />
              <h3 className="text-base sm:text-lg font-poppins font-semibold">
                Utilisateurs par rôle
              </h3>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {Object.entries(stats.usersByRole).map(([role, count]) => {
                const total = Object.values(stats.usersByRole).reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                const badgeStyles: { [key: string]: { bg: string; text: string } } = {
                  SUPERADMIN: { bg: 'bg-purple-100', text: 'text-purple-800' },
                  ADMIN: { bg: 'bg-blue-100', text: 'text-blue-800' },
                  USER: { bg: 'bg-gray-100', text: 'text-gray-800' },
                };
                const labels: { [key: string]: string } = {
                  USER: 'Utilisateur',
                  ADMIN: 'Admin',
                  SUPERADMIN: 'Super Admin',
                };

                return (
                  <div key={role}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-none text-xs font-medium ${badgeStyles[role]?.bg || 'bg-gray-100'} ${badgeStyles[role]?.text || 'text-gray-800'}`}
                      >
                        {labels[role] || role}
                      </span>
                      <span className="text-xs sm:text-sm font-poppins font-semibold">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-black" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Event Capacity */}
        <section className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none mb-8 sm:mb-10">
          <div className="flex items-center gap-2 mb-4">
            <BarChart size={18} className="sm:w-5 sm:h-5 shrink-0" />
            <h3 className="text-base sm:text-lg font-poppins font-semibold">
              Capacité des événements
            </h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="border border-gray-200 p-3 sm:p-4 rounded-none">
              <p className="text-xs text-gray-600 font-ibm mb-1">Nombre d&#39;événements</p>
              <p className="text-xl sm:text-2xl font-poppins font-bold">
                {stats.eventCapacity.totalEvents}
              </p>
            </div>
            <div className="border border-gray-200 p-3 sm:p-4 rounded-none">
              <p className="text-xs text-gray-600 font-ibm mb-1">Capacité totale</p>
              <p className="text-xl sm:text-2xl font-poppins font-bold">
                {stats.eventCapacity.totalCapacity}
              </p>
            </div>
            <div className="border border-gray-200 p-3 sm:p-4 rounded-none">
              <p className="text-xs text-gray-600 font-ibm mb-1">Places réservées</p>
              <p className="text-xl sm:text-2xl font-poppins font-bold">
                {stats.eventCapacity.totalBooked}
              </p>
            </div>
            <div className="border border-gray-200 p-3 sm:p-4 rounded-none bg-gray-50">
              <p className="text-xs text-gray-600 font-ibm mb-1">Taux d&#39;occupation</p>
              <p
                className={`text-xl sm:text-2xl font-poppins font-bold ${
                  stats.eventCapacity.occupancyRate >= 80 ? 'text-red-600' : 'text-black'
                }`}
              >
                {stats.eventCapacity.occupancyRate}%
              </p>
            </div>
          </div>
        </section>

        {/* Top Institutions */}
        <section className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none mb-8 sm:mb-10">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="shrink-0" />
            <h3 className="text-base sm:text-lg font-poppins font-semibold">
              Établissements les plus actifs
            </h3>
          </div>

          {/* Search fields */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={institutionSearch}
              onChange={(e) => setInstitutionSearch(e.target.value)}
              placeholder="Rechercher par nom..."
              className="flex-1 py-2 sm:py-2.5 px-3 sm:px-4 border border-gray-300 rounded-none text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
            <input
              type="text"
              value={institutionCitySearch}
              onChange={(e) => setInstitutionCitySearch(e.target.value)}
              placeholder="Ville..."
              className="sm:w-40 py-2 sm:py-2.5 px-3 sm:px-4 border border-gray-300 rounded-none text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          {institutionSearchLoading ? (
            <div className="flex justify-center py-8">
              <Loader />
            </div>
          ) : isSearchingInstitutions ? (
            // Show search results when actively searching
            searchedInstitutions.length > 0 ? (
              <>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 sm:px-3 font-poppins font-semibold text-xs sm:text-sm whitespace-nowrap">
                              Établissement
                            </th>
                            <th className="text-left py-3 px-4 sm:px-3 font-poppins font-semibold text-xs sm:text-sm whitespace-nowrap">
                              Ville
                            </th>
                            <th className="text-right py-3 px-4 sm:px-3 font-poppins font-semibold text-xs sm:text-sm whitespace-nowrap">
                              Inscriptions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {searchedInstitutions
                            .slice(
                              (institutionPage - 1) * ITEMS_PER_PAGE,
                              institutionPage * ITEMS_PER_PAGE,
                            )
                            .map((inst) => (
                              <tr
                                key={inst.id}
                                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => handleInstitutionClick(inst.id)}
                              >
                                <td className="py-3 px-4 sm:px-3 font-ibm text-gray-700 max-w-50 sm:max-w-none">
                                  <span className="block truncate">{inst.name}</span>
                                </td>
                                <td className="py-3 px-4 sm:px-3 font-ibm text-gray-500">
                                  {inst.city}
                                </td>
                                <td className="text-right py-3 px-4 sm:px-3 font-poppins font-semibold whitespace-nowrap">
                                  {inst.count > 0 ? inst.count : '-'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Pagination controls for search results */}
                {searchedInstitutions.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-center gap-2 sm:gap-3 mt-4">
                    <button
                      disabled={institutionPage <= 1}
                      onClick={() => setInstitutionPage(institutionPage - 1)}
                      className="px-3 sm:px-5 py-2 sm:py-2.5 border border-gray-300 rounded-none disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors cursor-pointer font-medium text-sm sm:text-base"
                    >
                      Précédent
                    </button>
                    <span className="px-2 sm:px-4 py-2 text-gray-700 font-medium text-sm sm:text-base">
                      Page {institutionPage} /{' '}
                      {Math.ceil(searchedInstitutions.length / ITEMS_PER_PAGE)}
                    </span>
                    <button
                      disabled={
                        institutionPage >= Math.ceil(searchedInstitutions.length / ITEMS_PER_PAGE)
                      }
                      onClick={() => setInstitutionPage(institutionPage + 1)}
                      className="px-3 sm:px-5 py-2 sm:py-2.5 border border-gray-300 rounded-none disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors cursor-pointer font-medium text-sm sm:text-base"
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-500 font-ibm">
                {institutionSearch.length < 2
                  ? 'Saisissez au moins 2 caractères pour rechercher'
                  : 'Aucun établissement trouvé'}
              </p>
            )
          ) : // Show top institutions when not searching
          stats?.topInstitutions && stats.topInstitutions.length > 0 ? (
            <>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 sm:px-3 font-poppins font-semibold text-xs sm:text-sm whitespace-nowrap">
                            Établissement
                          </th>
                          <th className="text-left py-3 px-4 sm:px-3 font-poppins font-semibold text-xs sm:text-sm whitespace-nowrap">
                            Ville
                          </th>
                          <th className="text-right py-3 px-4 sm:px-3 font-poppins font-semibold text-xs sm:text-sm whitespace-nowrap">
                            Inscriptions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.topInstitutions
                          .slice(
                            (institutionPage - 1) * ITEMS_PER_PAGE,
                            institutionPage * ITEMS_PER_PAGE,
                          )
                          .map((inst) => (
                            <tr
                              key={inst.id}
                              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => handleInstitutionClick(inst.id)}
                            >
                              <td className="py-3 px-4 sm:px-3 font-ibm text-gray-700 max-w-50 sm:max-w-none">
                                <span className="block truncate">{inst.name}</span>
                              </td>
                              <td className="py-3 px-4 sm:px-3 font-ibm text-gray-500">
                                {inst.city}
                              </td>
                              <td className="text-right py-3 px-4 sm:px-3 font-poppins font-semibold whitespace-nowrap">
                                {inst.count}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Pagination controls for top institutions */}
              {stats.topInstitutions.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-center gap-2 sm:gap-3 mt-4">
                  <button
                    disabled={institutionPage <= 1}
                    onClick={() => setInstitutionPage(institutionPage - 1)}
                    className="px-3 sm:px-5 py-2 sm:py-2.5 border border-gray-300 rounded-none disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors cursor-pointer font-medium text-sm sm:text-base"
                  >
                    Précédent
                  </button>
                  <span className="px-2 sm:px-4 py-2 text-gray-700 font-medium text-sm sm:text-base">
                    Page {institutionPage} /{' '}
                    {Math.ceil(stats.topInstitutions.length / ITEMS_PER_PAGE)}
                  </span>
                  <button
                    disabled={
                      institutionPage >= Math.ceil(stats.topInstitutions.length / ITEMS_PER_PAGE)
                    }
                    onClick={() => setInstitutionPage(institutionPage + 1)}
                    className="px-3 sm:px-5 py-2 sm:py-2.5 border border-gray-300 rounded-none disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors cursor-pointer font-medium text-sm sm:text-base"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 font-ibm">Aucune donnée disponible</p>
          )}
        </section>

        {/* Top Events */}
        <section className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none">
          <div className="flex items-center gap-2 mb-4">
            <PieChart size={20} className="shrink-0" />
            <h3 className="text-base sm:text-lg font-poppins font-semibold">
              Événements les plus populaires
            </h3>
          </div>

          {/* Search field */}
          <div className="mb-4">
            <input
              type="text"
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              placeholder="Rechercher un événement..."
              className="w-full py-2 sm:py-2.5 px-3 sm:px-4 border border-gray-300 rounded-none text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          {filteredEvents.length > 0 ? (
            <>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 sm:px-3 font-poppins font-semibold text-xs sm:text-sm whitespace-nowrap">
                            Événement
                          </th>
                          <th className="text-center py-3 px-4 sm:px-3 font-poppins font-semibold text-xs sm:text-sm whitespace-nowrap">
                            Inscriptions
                          </th>
                          <th className="text-right py-3 px-4 sm:px-3 font-poppins font-semibold text-xs sm:text-sm whitespace-nowrap">
                            Occupation
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEvents
                          .slice((eventPage - 1) * ITEMS_PER_PAGE, eventPage * ITEMS_PER_PAGE)
                          .map((event, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => handleEventClick(event)}
                            >
                              <td className="py-3 px-4 sm:px-3 font-ibm text-gray-700 max-w-37.5 sm:max-w-62.5 md:max-w-none">
                                <span className="block truncate" title={event.title}>
                                  {event.title}
                                </span>
                              </td>
                              <td className="text-center py-3 px-4 sm:px-3 font-poppins font-semibold whitespace-nowrap">
                                {event.registrationsCount}
                              </td>
                              <td className="text-right py-3 px-4 sm:px-3 whitespace-nowrap">
                                <span
                                  className={`font-poppins font-semibold ${
                                    event.occupancyRate >= 80 ? 'text-red-600' : 'text-black'
                                  }`}
                                >
                                  {event.occupancyRate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Pagination controls */}
              {filteredEvents.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-center gap-2 sm:gap-3 mt-4">
                  <button
                    disabled={eventPage <= 1}
                    onClick={() => setEventPage(eventPage - 1)}
                    className="px-3 sm:px-5 py-2 sm:py-2.5 border border-gray-300 rounded-none disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors cursor-pointer font-medium text-sm sm:text-base"
                  >
                    Précédent
                  </button>
                  <span className="px-2 sm:px-4 py-2 text-gray-700 font-medium text-sm sm:text-base">
                    Page {eventPage} / {Math.ceil(filteredEvents.length / ITEMS_PER_PAGE)}
                  </span>
                  <button
                    disabled={eventPage >= Math.ceil(filteredEvents.length / ITEMS_PER_PAGE)}
                    onClick={() => setEventPage(eventPage + 1)}
                    className="px-3 sm:px-5 py-2 sm:py-2.5 border border-gray-300 rounded-none disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors cursor-pointer font-medium text-sm sm:text-base"
                  >
                    Suivant
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500 font-ibm">Aucune donnée disponible</p>
          )}
        </section>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        registrationStatusLabels={registrationStatusLabels}
        eventStatusLabels={eventStatusLabels}
        publicCategoryLabels={publicCategoryLabels}
      />

      {/* Help Widget */}
      <HelpWidget content={HELP_CONTENTS['admin-statistics']} isAdminPage={true} />
    </main>
  );
}
