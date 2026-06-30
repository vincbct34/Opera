'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Download, Search, ChevronDown, Check, RotateCw } from '@deemlol/next-icons';
import { getAccessToken } from '@/lib/auth/tokenStore';
import { logger } from '@/lib/middleware/logger';
import toast from '@/lib/utils/toast';
import Loader from '@/components/ui/Loader';
import type { ExportFilters, ExportOptions, SheetType } from '@/lib/utils/excelExportService';
import {
  REGISTRATION_STATUS_LABELS as DEFAULT_REGISTRATION_STATUS_LABELS,
  EVENT_STATUS_LABELS as DEFAULT_EVENT_STATUS_LABELS,
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  EVENT_TYPE_LABELS as DEFAULT_EVENT_TYPE_LABELS,
  SCHOOL_GRADE_LABELS as DEFAULT_SCHOOL_GRADE_LABELS,
  AGE_RANGE_LABELS as DEFAULT_AGE_RANGE_LABELS,
} from '@/lib/config/labelMappings';
import {
  PublicCategory,
  RegistrationStatus,
  EventStatus,
  EventType,
  SchoolGrade,
  AgeRange,
} from '@/types/api';

// ── CSRF helper ──

async function getCSRFToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/csrf', {
      headers: {
        Authorization: getAccessToken() ? `Bearer ${getAccessToken()}` : '',
      },
    });

    if (response.ok) {
      const { csrfToken } = await response.json();
      return csrfToken;
    }
  } catch (error) {
    logger.error('Failed to fetch CSRF token:', error);
  }
  return null;
}

// ── Types ──

type ExportType = 'users' | 'events' | 'registrations' | 'institutions' | 'complete';

type ExportDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  registrationStatusLabels?: Record<string, string>;
  eventStatusLabels?: Record<string, string>;
  publicCategoryLabels?: Record<string, string>;
  eventTypeLabels?: Record<string, string>;
  schoolGradeLabels?: Record<string, string>;
  ageRangeLabels?: Record<string, string>;
};

// ── Sheet labels ──

const SHEET_LABELS: Record<SheetType, string> = {
  users: 'Utilisateurs',
  events: 'Événements',
  registrations: 'Inscriptions',
  institutions: 'Établissements',
  groups: 'Groupes',
  statistics: 'Statistiques',
};

const ALL_SHEETS: SheetType[] = [
  'users',
  'events',
  'registrations',
  'institutions',
  'groups',
  'statistics',
];

// ── Searchable Select sub-component ──

type SearchItem = { id: string; label: string; subLabel?: string };

function SearchableSelect({
  label,
  placeholder,
  selected,
  onSelect,
  onClear,
  fetchItems,
}: {
  label: string;
  placeholder: string;
  selected: SearchItem | null;
  onSelect: (item: SearchItem) => void;
  onClear: () => void;
  fetchItems: (query: string) => Promise<SearchItem[]>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.length < 2) {
        setResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const items = await fetchItems(value);
          setResults(items);
          setIsOpen(true);
        } catch {
          setResults([]);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    },
    [fetchItems],
  );

  if (selected) {
    return (
      <div>
        <span className="block text-sm font-medium font-poppins mb-2">{label}</span>
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 bg-gray-50">
          <span className="flex-1 text-sm font-ibm truncate">{selected.label}</span>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 p-0.5 hover:bg-gray-200 rounded"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <span className="block text-sm font-medium font-poppins mb-2">{label}</span>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black text-sm"
        />
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader />
          </span>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-gray-300 shadow-lg">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                onClick={() => {
                  onSelect(item);
                  setIsOpen(false);
                  setQuery('');
                  setResults([]);
                }}
              >
                <div className="font-medium">{item.label}</div>
                {item.subLabel && <div className="text-xs text-gray-500">{item.subLabel}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 px-3 py-2 bg-white border border-gray-300 shadow-lg text-sm text-gray-500">
          Aucun résultat
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main ExportDialog Component
// ============================================================================

/**
 * ExportDialog component
 * Modal for exporting data to Excel with comprehensive filters and options.
 */
export default function ExportDialog({
  isOpen,
  onClose,
  registrationStatusLabels,
  eventStatusLabels,
  publicCategoryLabels,
  eventTypeLabels,
  schoolGradeLabels,
  ageRangeLabels,
}: ExportDialogProps) {
  // Label maps with fallback to static defaults
  const REG_STATUS_LABELS = registrationStatusLabels || DEFAULT_REGISTRATION_STATUS_LABELS;
  const EVT_STATUS_LABELS = eventStatusLabels || DEFAULT_EVENT_STATUS_LABELS;
  const PUB_CAT_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;
  const EVT_TYPE_LABELS = eventTypeLabels || DEFAULT_EVENT_TYPE_LABELS;
  const GRADE_LABELS = schoolGradeLabels || DEFAULT_SCHOOL_GRADE_LABELS;
  const AGE_LABELS = ageRangeLabels || DEFAULT_AGE_RANGE_LABELS;

  // ── Export type ──
  const [exportType, setExportType] = useState<ExportType>('complete');
  const [loading, setLoading] = useState(false);

  // ── Filters ──
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [role, setRole] = useState('');
  const [registrationStatus, setRegistrationStatus] = useState('');
  const [eventStatus, setEventStatus] = useState('');
  const [publicCategory, setPublicCategory] = useState('');
  const [eventType, setEventType] = useState('');
  const [schoolGrade, setSchoolGrade] = useState('');
  const [ageRange, setAgeRange] = useState('');

  // ── Entity filters ──
  const [selectedInstitution, setSelectedInstitution] = useState<SearchItem | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SearchItem | null>(null);

  // ── Options ──
  const [selectedSheets, setSelectedSheets] = useState<Set<SheetType>>(new Set(ALL_SHEETS));
  const [anonymize, setAnonymize] = useState(false);
  const [includeCoverSheet, setIncludeCoverSheet] = useState(true);

  // ── Advanced filters toggle ──
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen) return null;

  // ── Fetch functions for searchable selects ──

  const fetchInstitutions = async (query: string): Promise<SearchItem[]> => {
    const token = getAccessToken();
    const res = await fetch(`/api/institutions/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const institutions = data.institutions || data || [];
    return institutions.map((inst: { id: string; name: string; address?: { city?: string } }) => ({
      id: inst.id,
      label: inst.name,
      subLabel: inst.address?.city || undefined,
    }));
  };

  const fetchEvents = async (query: string): Promise<SearchItem[]> => {
    const token = getAccessToken();
    const res = await fetch('/api/events', {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const events = data.events || data || [];
    const lowerQuery = query.toLowerCase();
    return events
      .filter((e: { title: string }) => e.title.toLowerCase().includes(lowerQuery))
      .slice(0, 20)
      .map((e: { id: string; title: string; status?: string }) => ({
        id: e.id,
        label: e.title,
        subLabel: e.status || undefined,
      }));
  };

  // ── Reset filters ──

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setRole('');
    setRegistrationStatus('');
    setEventStatus('');
    setPublicCategory('');
    setEventType('');
    setSchoolGrade('');
    setAgeRange('');
    setSelectedInstitution(null);
    setSelectedEvent(null);
    setSelectedSheets(new Set(ALL_SHEETS));
    setAnonymize(false);
    setIncludeCoverSheet(true);
    setShowAdvanced(false);
  };

  // ── Toggle sheet selection ──

  const toggleSheet = (sheet: SheetType) => {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(sheet)) {
        next.delete(sheet);
      } else {
        next.add(sheet);
      }
      return next;
    });
  };

  const toggleAllSheets = () => {
    if (selectedSheets.size === ALL_SHEETS.length) {
      setSelectedSheets(new Set());
    } else {
      setSelectedSheets(new Set(ALL_SHEETS));
    }
  };

  // ── Export handler ──

  const handleExport = async () => {
    // Validate sheet selection for complete export
    if (exportType === 'complete' && selectedSheets.size === 0) {
      toast('Veuillez sélectionner au moins une feuille', 'error');
      return;
    }

    setLoading(true);
    try {
      const filters: Partial<ExportFilters> = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (role) filters.role = role as ExportFilters['role'];
      if (registrationStatus)
        filters.registrationStatus = registrationStatus as ExportFilters['registrationStatus'];
      if (eventStatus) filters.eventStatus = eventStatus as ExportFilters['eventStatus'];
      if (publicCategory)
        filters.publicCategory = publicCategory as ExportFilters['publicCategory'];
      if (eventType) filters.eventType = eventType as ExportFilters['eventType'];
      if (schoolGrade) filters.schoolGrade = schoolGrade as ExportFilters['schoolGrade'];
      if (ageRange) filters.ageRange = ageRange as ExportFilters['ageRange'];
      if (selectedInstitution) filters.institutionId = selectedInstitution.id;
      if (selectedEvent) filters.eventId = selectedEvent.id;

      const options: Partial<ExportOptions> = {
        anonymize,
        includeCoverSheet,
      };
      if (exportType === 'complete') {
        options.sheets = Array.from(selectedSheets);
      }

      // Authentication
      const token = getAccessToken();
      if (!token) throw new Error('Non authentifié');

      const csrfToken = await getCSRFToken();
      if (!csrfToken) throw new Error('Token CSRF non disponible');

      const response = await fetch('/api/admin/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({ exportType, filters, options }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Erreur lors de l'export");
      }

      // Download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `export_${exportType}_${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast('Export réussi !', 'success');
      onClose();
    } catch (error) {
      logger.error("Erreur lors de l'export:", error);
      toast("Erreur lors de l'export des données", 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Labels ──

  const exportTypeLabels: Record<ExportType, string> = {
    users: 'Utilisateurs',
    events: 'Événements',
    registrations: 'Inscriptions',
    institutions: 'Établissements',
    complete: 'Rapport complet',
  };

  const exportTypeDescriptions: Record<ExportType, string> = {
    users: 'Exporte tous les utilisateurs avec leurs informations et statistiques',
    events: "Exporte tous les événements avec les taux d'occupation et détail des inscriptions",
    registrations:
      'Exporte toutes les inscriptions avec les détails complets et info établissement',
    institutions:
      'Exporte tous les établissements avec leurs utilisateurs et détail des inscriptions',
    complete:
      'Exporte toutes les données dans un fichier multi-feuilles : utilisateurs, événements, inscriptions, établissements, groupes et statistiques',
  };

  // ── Visibility helpers ──

  const showRoleFilter = exportType === 'users' || exportType === 'complete';
  const showRegStatusFilter = exportType === 'registrations' || exportType === 'complete';
  const showEvtStatusFilter = exportType === 'events' || exportType === 'complete';
  const showCategoryFilters = exportType !== 'users';
  const showInstitutionFilter = exportType === 'registrations' || exportType === 'complete';
  const showEventFilter = exportType === 'registrations' || exportType === 'complete';
  const showSheetSelection = exportType === 'complete';

  // Count active filters
  const activeFilterCount = [
    dateFrom,
    dateTo,
    role,
    registrationStatus,
    eventStatus,
    publicCategory,
    eventType,
    schoolGrade,
    ageRange,
    selectedInstitution,
    selectedEvent,
  ].filter(Boolean).length;

  // ── Render ──

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-none shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl sm:text-2xl font-poppins font-semibold">Exporter des données</h2>
            <p className="text-sm text-gray-600 mt-1 font-ibm">
              Sélectionnez les données, les filtres et les options d&apos;export
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={loading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* ── Export Type ── */}
          <div>
            <label className="block text-sm font-medium font-poppins mb-3">
              Type d&apos;export <span className="text-red-600">*</span>
            </label>
            <div className="space-y-2">
              {(Object.keys(exportTypeLabels) as ExportType[]).map((type) => (
                <label
                  key={type}
                  className={`block border p-4 cursor-pointer transition-all ${
                    exportType === type
                      ? 'border-black bg-gray-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="exportType"
                      value={type}
                      checked={exportType === type}
                      onChange={(e) => setExportType(e.target.value as ExportType)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium font-poppins">{exportTypeLabels[type]}</div>
                      <div className="text-sm text-gray-600 font-ibm mt-1">
                        {exportTypeDescriptions[type]}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ── Sheet Selection (complete only) ── */}
          {showSheetSelection && (
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-poppins font-semibold">Feuilles à inclure</h3>
                <button
                  type="button"
                  onClick={toggleAllSheets}
                  className="text-sm text-gray-600 hover:text-black font-ibm underline"
                >
                  {selectedSheets.size === ALL_SHEETS.length
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_SHEETS.map((sheet) => (
                  <label
                    key={sheet}
                    className={`flex items-center gap-2 p-3 border cursor-pointer transition-all ${
                      selectedSheets.has(sheet)
                        ? 'border-black bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 flex items-center justify-center border ${
                        selectedSheets.has(sheet) ? 'bg-black border-black' : 'border-gray-400'
                      }`}
                    >
                      {selectedSheets.has(sheet) && <Check size={12} color="white" />}
                    </div>
                    <span className="text-sm font-poppins">{SHEET_LABELS[sheet]}</span>
                    <input
                      type="checkbox"
                      checked={selectedSheets.has(sheet)}
                      onChange={() => toggleSheet(sheet)}
                      className="sr-only"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Filters ── */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-poppins font-semibold">
                Filtres
                {activeFilterCount > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({activeFilterCount} actif{activeFilterCount > 1 ? 's' : ''})
                  </span>
                )}
              </h3>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-black font-ibm"
                >
                  <RotateCw size={14} />
                  <span>Réinitialiser</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date range */}
              <div>
                <label className="block text-sm font-medium font-poppins mb-2">Date de début</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium font-poppins mb-2">Date de fin</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              {/* Role */}
              {showRoleFilter && (
                <div>
                  <label className="block text-sm font-medium font-poppins mb-2">Rôle</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="">Tous</option>
                    <option value="USER">Utilisateur</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPERADMIN">Super Admin</option>
                  </select>
                </div>
              )}

              {/* Registration Status */}
              {showRegStatusFilter && (
                <div>
                  <label className="block text-sm font-medium font-poppins mb-2">
                    Statut d&apos;inscription
                  </label>
                  <select
                    value={registrationStatus}
                    onChange={(e) => setRegistrationStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="">Tous</option>
                    {Object.values(RegistrationStatus).map((status) => (
                      <option key={status} value={status}>
                        {REG_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Event Status */}
              {showEvtStatusFilter && (
                <div>
                  <label className="block text-sm font-medium font-poppins mb-2">
                    Statut d&apos;événement
                  </label>
                  <select
                    value={eventStatus}
                    onChange={(e) => setEventStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="">Tous</option>
                    {Object.values(EventStatus).map((status) => (
                      <option key={status} value={status}>
                        {EVT_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Public Category */}
              {showCategoryFilters && (
                <div>
                  <label className="block text-sm font-medium font-poppins mb-2">
                    Catégorie de public
                  </label>
                  <select
                    value={publicCategory}
                    onChange={(e) => setPublicCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="">Toutes</option>
                    {Object.values(PublicCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {PUB_CAT_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Event Type */}
              {showCategoryFilters && (
                <div>
                  <label className="block text-sm font-medium font-poppins mb-2">
                    Type d&apos;événement
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="">Tous</option>
                    {Object.values(EventType).map((type) => (
                      <option key={type} value={type}>
                        {EVT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* ── Advanced Filters Toggle ── */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="mt-4 flex items-center gap-2 text-sm text-gray-600 hover:text-black font-ibm transition-colors"
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              />
              <span>
                Filtres avancés (niveau scolaire, tranche d&apos;âge, établissement, événement)
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-l-2 border-gray-200 pl-4">
                {/* School Grade */}
                {showCategoryFilters && (
                  <div>
                    <label className="block text-sm font-medium font-poppins mb-2">
                      Niveau scolaire
                    </label>
                    <select
                      value={schoolGrade}
                      onChange={(e) => setSchoolGrade(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      <option value="">Tous</option>
                      {Object.values(SchoolGrade).map((grade) => (
                        <option key={grade} value={grade}>
                          {GRADE_LABELS[grade]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Age Range */}
                {showCategoryFilters && (
                  <div>
                    <label className="block text-sm font-medium font-poppins mb-2">
                      Tranche d&apos;âge
                    </label>
                    <select
                      value={ageRange}
                      onChange={(e) => setAgeRange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      <option value="">Toutes</option>
                      {Object.values(AgeRange).map((range) => (
                        <option key={range} value={range}>
                          {AGE_LABELS[range]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Institution search */}
                {showInstitutionFilter && (
                  <SearchableSelect
                    label="Établissement"
                    placeholder="Rechercher un établissement…"
                    selected={selectedInstitution}
                    onSelect={setSelectedInstitution}
                    onClear={() => setSelectedInstitution(null)}
                    fetchItems={fetchInstitutions}
                  />
                )}

                {/* Event search */}
                {showEventFilter && (
                  <SearchableSelect
                    label="Événement"
                    placeholder="Rechercher un événement…"
                    selected={selectedEvent}
                    onSelect={setSelectedEvent}
                    onClear={() => setSelectedEvent(null)}
                    fetchItems={fetchEvents}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Options ── */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-poppins font-semibold mb-4">Options</h3>
            <div className="space-y-3">
              {/* Cover Sheet */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`w-5 h-5 flex items-center justify-center border ${
                    includeCoverSheet ? 'bg-black border-black' : 'border-gray-400'
                  }`}
                >
                  {includeCoverSheet && <Check size={12} color="white" />}
                </div>
                <div>
                  <span className="text-sm font-medium font-poppins">Page de résumé</span>
                  <p className="text-xs text-gray-500 font-ibm">
                    Ajoute une première feuille avec la date, les filtres appliqués et les
                    informations d&apos;export
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={includeCoverSheet}
                  onChange={(e) => setIncludeCoverSheet(e.target.checked)}
                  className="sr-only"
                />
              </label>

              {/* Anonymize */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`w-5 h-5 flex items-center justify-center border ${
                    anonymize ? 'bg-black border-black' : 'border-gray-400'
                  }`}
                >
                  {anonymize && <Check size={12} color="white" />}
                </div>
                <div>
                  <span className="text-sm font-medium font-poppins">
                    Anonymiser les données personnelles
                  </span>
                  <p className="text-xs text-gray-500 font-ibm">
                    Masque les emails, numéros de téléphone et noms dans l&apos;export (utile pour
                    le partage)
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={anonymize}
                  onChange={(e) => setAnonymize(e.target.checked)}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 z-10">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={loading}
            className="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader />
                <span>Export en cours...</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>Exporter</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
