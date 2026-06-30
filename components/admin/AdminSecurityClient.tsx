'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { SecurityLog, SecurityLogType, SecuritySeverity } from '@/app/generated/prisma';
import Loader from '@/components/ui/Loader';
import { fetchJsonWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import toast from '@/lib/utils/toast';
import { Shield, AlertTriangle, AlertCircle } from '@deemlol/next-icons';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

interface SecurityStats {
  period: { start: string; end: string };
  totalEvents: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  topIps: Array<{ ipAddress: string; count: number }>;
  failedLogins: number;
  suspiciousPatterns: SuspiciousPattern[];
}

interface SuspiciousPattern {
  type: string;
  severity: SecuritySeverity;
  description: string;
  count: number;
  details: Record<string, unknown>;
}

interface SecurityLogsResult {
  logs: SecurityLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const SEVERITY_LABELS: Record<SecuritySeverity, string> = {
  INFO: 'Info',
  WARNING: 'Attention',
  CRITICAL: 'Critique',
};

const SEVERITY_COLORS: Record<SecuritySeverity, string> = {
  INFO: 'bg-blue-100 text-blue-800 border-blue-200',
  WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
};

const TYPE_LABELS: Record<SecurityLogType, string> = {
  LOGIN_SUCCESS: 'Connexion réussie',
  LOGIN_FAILED: 'Échec de connexion',
  LOGOUT: 'Déconnexion',
  REGISTER: 'Inscription',
  PASSWORD_CHANGE: 'Changement mot de passe',
  PASSWORD_RESET_REQUEST: 'Demande réinitialisation',
  PASSWORD_RESET_SUCCESS: 'Réinitialisation réussie',
  EMAIL_VERIFICATION: 'Vérification email',
  ADMIN_ACCESS: 'Accès admin',
  DATA_MODIFIED: 'Données modifiées',
  SUSPICIOUS_ACTIVITY: 'Activité suspecte',
  RATE_LIMIT_EXCEEDED: 'Limite de taux dépassée',
  UNAUTHORIZED_ACCESS: 'Accès non autorisé',
  CSRF_TOKEN_INVALID: 'Token CSRF invalide',
  CORS_VIOLATION: 'Violation CORS',
  TOKEN_REFRESH: 'Rafraîchissement token',
  TOKEN_EXPIRED: 'Token expiré',
  ACCOUNT_LOCKED: 'Compte verrouillé',
};

export default function AdminSecurityClient() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Date range filter
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Debounce ref
  const debounceRef = useRef<number | undefined>(undefined);

  // Debounce search query - only update debounced value after user stops typing
  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 300) as unknown as number;

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  // Redirect non-admin users
  useEffect(() => {
    if (!loading && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN'))) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const { data, response } = await fetchJsonWithAuth<{ data: SecurityStats }>(
        `/api/admin/security-stats?${params}`,
      );
      if (response.ok && data?.data) {
        setStats(data.data);
      }
    } catch (err) {
      logger.error('Error fetching stats:', err);
    }
  }, [startDate, endDate]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', '50');

      if (selectedType) params.append('type', selectedType);
      if (selectedSeverity) params.append('severity', selectedSeverity);
      if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const { data, response } = await fetchJsonWithAuth<{ data: SecurityLogsResult }>(
        `/api/admin/security-logs?${params}`,
      );

      if (response.ok && data?.data) {
        setLogs(data.data.logs);
        setTotalPages(data.data.totalPages);
        setTotalLogs(data.data.total);
        setError(null);
      } else {
        toast('Erreur lors du chargement des logs', 'error');
      }
    } catch (err) {
      logger.error('Error fetching logs:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      toast('Erreur lors du chargement des logs', 'error');
    } finally {
      setDataLoading(false);
    }
  }, [currentPage, selectedType, selectedSeverity, debouncedSearchQuery, startDate, endDate]);

  // Initial fetch and filter changes (excluding search - handled by debounce)
  useEffect(() => {
    if (!loading && user) {
      fetchStats();
      fetchLogs();
    }
  }, [loading, user, fetchStats, fetchLogs]);

  const handleFilterReset = () => {
    setSelectedType('');
    setSelectedSeverity('');
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedType) params.append('type', selectedType);
      if (selectedSeverity) params.append('severity', selectedSeverity);
      if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('limit', '1000');

      const { data, response } = await fetchJsonWithAuth<{ data: SecurityLogsResult }>(
        `/api/admin/security-logs?${params}`,
      );

      if (response.ok && data?.data) {
        const csvData = data.data;

        // Convert to CSV
        const headers = ['Date', 'Type', 'Sévérité', 'IP', 'Endpoint', 'User Agent'];
        const rows = csvData.logs.map((log) => [
          new Date(log.timestamp).toLocaleString('fr-FR'),
          TYPE_LABELS[log.type],
          SEVERITY_LABELS[log.severity],
          log.ip_address || 'N/A',
          log.endpoint || 'N/A',
          log.user_agent?.substring(0, 50) || 'N/A',
        ]);

        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `security-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        toast('Export réussi', 'success');
      }
    } catch (err) {
      logger.error('Error exporting logs:', err);
      toast("Erreur lors de l'export", 'error');
    }
  };

  if (loading || dataLoading) {
    return (
      <main className="flex justify-center items-center h-[90vh]">
        <Loader />
      </main>
    );
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    return null;
  }

  return (
    <main className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">
                  Journal de Sécurité
                </h1>
                <p className="mt-2 text-sm sm:text-base text-gray-700 font-ibm">
                  Surveillance des événements de sécurité et détection de menaces
                </p>
              </div>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white hover:bg-gray-800 transition-colors font-medium text-sm sm:text-base whitespace-nowrap w-auto self-start sm:self-auto"
              >
                <span>Exporter les logs</span>
              </button>
            </div>
          </div>
        </header>

        {/* Stats Cards */}
        {stats && (
          <section className="mb-8 sm:mb-10">
            <h2 className="text-lg sm:text-xl font-poppins font-semibold mb-3 sm:mb-4">
              Indicateurs de sécurité
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 font-ibm mb-1">
                      Total événements
                    </p>
                    <p className="text-2xl sm:text-3xl font-poppins font-bold">
                      {stats.totalEvents}
                    </p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full flex items-center justify-center shrink-0">
                    <Shield size={16} className="sm:w-4.5 sm:h-4.5" color="#ffffff" />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 font-ibm mb-1">
                      Connexions échouées
                    </p>
                    <p className="text-2xl sm:text-3xl font-poppins font-bold text-yellow-600">
                      {stats.failedLogins}
                    </p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-500 rounded-full flex items-center justify-center shrink-0">
                    <AlertTriangle size={16} className="sm:w-4.5 sm:h-4.5" color="#ffffff" />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 font-ibm mb-1">
                      Alertes critiques
                    </p>
                    <p className="text-2xl sm:text-3xl font-poppins font-bold text-red-600">
                      {stats.bySeverity.CRITICAL || 0}
                    </p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-600 rounded-full flex items-center justify-center shrink-0">
                    <AlertCircle size={16} className="sm:w-4.5 sm:h-4.5" color="#ffffff" />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 font-ibm mb-1">
                      Patterns suspects
                    </p>
                    <p className="text-2xl sm:text-3xl font-poppins font-bold text-orange-600">
                      {stats.suspiciousPatterns.length}
                    </p>
                  </div>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-full flex items-center justify-center shrink-0">
                    <AlertTriangle size={16} className="sm:w-4.5 sm:h-4.5" color="#ffffff" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Suspicious Patterns Alert */}
        {stats && stats.suspiciousPatterns.length > 0 && (
          <section className="mb-8 sm:mb-10">
            <div className="bg-red-50 border-l-4 border-red-600 p-4 sm:p-6 rounded-none">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-poppins font-semibold text-red-900 mb-2">
                    Alertes de sécurité détectées
                  </h3>
                  <div className="space-y-2">
                    {stats.suspiciousPatterns.map((pattern, index) => (
                      <div key={index} className="bg-white border border-red-200 p-3 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm sm:text-base text-gray-900 font-poppins">
                            {pattern.type}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              pattern.severity === 'CRITICAL'
                                ? 'bg-red-100 text-red-800'
                                : pattern.severity === 'WARNING'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {SEVERITY_LABELS[pattern.severity]}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 font-ibm">{pattern.description}</p>
                        <p className="text-xs text-gray-500 font-ibm mt-1">
                          Occurrences: {pattern.count}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Filters */}
        <section className="mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-poppins font-semibold mb-3 sm:mb-4">Filtres</h2>
          <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-ibm">
                  Type d&apos;événement
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full border border-gray-300 rounded-none px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:border-black font-ibm"
                >
                  <option value="">Tous les types</option>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-ibm">
                  Sévérité
                </label>
                <select
                  value={selectedSeverity}
                  onChange={(e) => {
                    setSelectedSeverity(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full border border-gray-300 rounded-none px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:border-black font-ibm"
                >
                  <option value="">Toutes les sévérités</option>
                  <option value="INFO">Info</option>
                  <option value="WARNING">Attention</option>
                  <option value="CRITICAL">Critique</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-ibm">
                  Date de début
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full border border-gray-300 rounded-none px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:border-black font-ibm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-ibm">
                  Date de fin
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full border border-gray-300 rounded-none px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:border-black font-ibm"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1 font-ibm">
                  Recherche (IP, endpoint, user agent)
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full border border-gray-300 rounded-none px-3 py-2 text-sm focus:ring-2 focus:ring-black focus:border-black font-ibm"
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={handleFilterReset}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-none transition text-sm font-ibm"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Logs Table */}
        <section>
          <div className="bg-white border border-gray-200 shadow-sm rounded-none overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-poppins font-semibold">
                Logs de Sécurité
                <span className="ml-2 text-sm font-normal text-gray-600 font-ibm">
                  ({totalLogs} événements)
                </span>
              </h2>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-600 p-4 mx-4 sm:mx-6 mt-4 rounded">
                <p className="text-sm text-red-700 font-ibm">{error}</p>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-ibm">
                      Date
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-ibm">
                      Type
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-ibm">
                      Sévérité
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-ibm">
                      IP
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-ibm">
                      Endpoint
                    </th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-ibm hidden sm:table-cell">
                      User Agent
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 sm:px-6 py-12 text-center text-sm text-gray-500 font-ibm"
                      >
                        Aucun log trouvé
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-ibm">
                          {new Date(log.timestamp).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-ibm">
                          {TYPE_LABELS[log.type]}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded border ${SEVERITY_COLORS[log.severity]}`}
                          >
                            {SEVERITY_LABELS[log.severity]}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {log.ip_address || 'N/A'}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-ibm">
                          {log.endpoint || 'N/A'}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-sm text-gray-500 max-w-xs truncate font-ibm hidden sm:table-cell">
                          {log.user_agent || 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-4 sm:px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <p className="text-sm text-gray-700 font-ibm">
                  Page {currentPage} sur {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 sm:px-4 py-2 border border-gray-300 rounded-none text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-ibm"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 sm:px-4 py-2 border border-gray-300 rounded-none text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-ibm"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Top IPs Section */}
        {stats && stats.topIps.length > 0 && (
          <section className="mt-8 sm:mt-10">
            <h2 className="text-lg sm:text-xl font-poppins font-semibold mb-3 sm:mb-4">
              Top Adresses IP
            </h2>
            <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6 rounded-none">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.topIps.map((ip, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded"
                  >
                    <span className="font-mono text-sm text-gray-900">{ip.ipAddress}</span>
                    <span className="text-sm font-semibold text-gray-700 font-poppins">
                      {ip.count} événements
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      <HelpWidget content={HELP_CONTENTS['admin-security']} isAdminPage={true} />
    </main>
  );
}
