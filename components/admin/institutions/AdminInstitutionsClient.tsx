'use client';

import { useState, useEffect, useRef, startTransition } from 'react';
import { useUser } from '@/context/UserContext';
import Loader from '@/components/ui/Loader';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchJsonWithAuth, fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import toast from '@/lib/utils/toast';
import { PublicCategory, InstitutionWithCounts } from '@/types/api';
import { SchoolGrade, AgeRange } from '@/app/generated/prisma/enums';
import { SCHOOL_GRADE_LABELS, AGE_RANGE_LABELS } from '@/lib/config/labelMappings';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import AdminInstitutionCreateModal from './AdminInstitutionCreateModal';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

/**
 * AdminInstitutionsClient component
 * Main dashboard for managing institutions.
 * Features:
 * - List institutions with pagination
 * - Live search by name
 * - Filter by city, type, and registrations presence
 * - Create new institution
 * - Delete institution
 *
 * @param initialData - Initial list of institutions
 */
export default function AdminInstitutionsClient({
  initialData,
  publicCategoryLabels,
}: {
  initialData: InstitutionWithCounts[];
  publicCategoryLabels?: Record<string, string>;
}) {
  const [institutions, setInstitutions] = useState<InstitutionWithCounts[]>(initialData || []);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [filterType, setFilterType] = useState<PublicCategory | ''>('');
  const [hasRegistrationsOnly, setHasRegistrationsOnly] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState<string | null>(null);
  const PAGE_LIMIT = 20;
  const router = useRouter();
  const searchParams = useSearchParams();

  // Debounce helper
  const debounceRef = useRef<number | undefined>(undefined);

  const debounce = (fn: () => void, wait = 300) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    debounceRef.current = window.setTimeout(fn, wait);
  };

  // Track first mount to avoid double fetch (init effect already fetched)
  const firstMountRef = useRef(true);

  useEffect(() => {
    // initialData already provided; we can optionally refresh
  }, []);

  const fetchPage = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', String(PAGE_LIMIT));
      if (search) params.set('search', search);
      if (city) params.set('city', city);
      if (filterType) params.set('type', filterType);
      if (hasRegistrationsOnly) params.set('hasRegistrations', 'true');

      const { data, response } = await fetchJsonWithAuth(`/api/institutions?${params.toString()}`);
      if (response.ok && data) {
        // @ts-expect-error - incoming API shape is dynamic, cast to expected list
        let list: Institution[] = data.institutions || [];
        // If client requested only institutions with registrations, filter locally using _count
        if (hasRegistrationsOnly) {
          list = list.filter((i) => (i._count?.registrations || 0) > 0);
        }
        setInstitutions(list);
        setPage(p);
        // @ts-expect-error - incoming API shape is dynamic
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      logger.error(err);
      toast('Erreur lors du chargement des établissements', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Initialize state from URL params (on mount)
  useEffect(() => {
    const sp = Object.fromEntries(searchParams ? Array.from(searchParams.entries()) : []);
    startTransition(() => {
      if (sp.search) setSearch(sp.search);
      if (sp.city) setCity(sp.city);
      if (sp.type) setFilterType(sp.type as PublicCategory);
      if (sp.hasRegistrations && (sp.hasRegistrations === 'true' || sp.hasRegistrations === '1')) {
        setHasRegistrationsOnly(true);
      }
      // fetch initial
      fetchPage(1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist filters to URL whenever they change (debounced)
  useEffect(() => {
    debounce(() => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (city) params.set('city', city);
      if (filterType) params.set('type', filterType);
      if (hasRegistrationsOnly) params.set('hasRegistrations', 'true');
      const url = `/admin/institutions?${params.toString()}`;
      router.replace(url);
    }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, city, filterType, hasRegistrationsOnly]);

  // Live search: when `search` (name) changes, perform a debounced fetchPage(1).
  useEffect(() => {
    // skip the initial mount because initial effect already fetched
    if (firstMountRef.current) {
      firstMountRef.current = false;
      return;
    }
    debounce(() => fetchPage(1), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { user } = useUser();

  // Refetch when filters change (debounced to avoid too many API calls)
  useEffect(() => {
    // skip the initial mount because initial effect already fetched
    if (firstMountRef.current) {
      return;
    }
    // reset to first page when filters change (debounced)
    debounce(() => fetchPage(1), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, city, hasRegistrationsOnly]);

  const handleDelete = async (id?: string) => {
    const targetId = id || toDeleteId;
    if (!targetId) return setConfirmOpen(false);
    try {
      const res = await fetchWithAuth(`/api/institutions/${targetId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data && data.error) || 'Erreur');
      // remove locally
      setInstitutions((prev) => prev.filter((i) => i.id !== targetId));
      toast('Établissement supprimé', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur';
      toast(msg, 'error');
      logger.error(error);
    } finally {
      setConfirmOpen(false);
      setToDeleteId(null);
    }
  };

  return (
    <main className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">
              Gestion des établissements
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-700 font-ibm">
              Liste et administration des établissements partenaires.
            </p>
          </div>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors self-start sm:self-auto"
          >
            Créer un établissement
          </button>
        </header>

        <div className="bg-white rounded-none shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPage(1)}
              placeholder="Rechercher par nom..."
              className="w-full py-2 sm:py-2.5 px-3 sm:px-4 border border-gray-300 rounded-none text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchPage(1)}
                placeholder="Ville"
                className="w-full sm:w-40 py-2 sm:py-2.5 px-3 border border-gray-300 rounded-none text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              />

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as PublicCategory | '')}
                className="w-full sm:w-48 py-2 sm:py-2.5 px-3 border border-gray-300 rounded-none bg-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="">Tous types</option>
                {Object.values(PublicCategory).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasRegistrationsOnly}
                  onChange={(e) => setHasRegistrationsOnly(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                  Avec inscriptions
                </span>
              </label>
            </div>

            {/* Search is live while typing, button removed */}
            {(search || city || filterType || hasRegistrationsOnly) && (
              <button
                className="w-full sm:w-auto px-4 py-2 sm:py-2.5 border border-gray-300 rounded-none hover:bg-gray-50 transition-colors cursor-pointer font-medium text-sm sm:text-base"
                onClick={() => {
                  // reset filters
                  setSearch('');
                  setCity('');
                  setFilterType('');
                  setHasRegistrationsOnly(false);
                  // clear URL params
                  router.replace('/admin/institutions');
                  fetchPage(1);
                }}
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : institutions.length === 0 ? (
          <div className="bg-white rounded-none shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500 font-ibm">Aucun établissement trouvé.</p>
          </div>
        ) : (
          <div className="bg-white rounded-none shadow-sm border border-gray-200 overflow-hidden mb-4 sm:mb-6">
            <div className="divide-y divide-gray-200">
              {institutions.map((inst) => (
                <div key={inst.id} className="p-3 sm:p-4 md:p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                        <h3 className="font-poppins font-semibold text-base sm:text-lg text-gray-900">
                          {inst.name}
                        </h3>
                        <div className="flex gap-2 flex-wrap">
                          {inst.type.map((t: PublicCategory) => (
                            <span
                              key={t}
                              className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-none text-xs font-medium ${
                                t === 'ELEMENTAIRE' || t === 'MATERNELLE' || t === 'CRECHE'
                                  ? 'bg-blue-100 text-blue-800'
                                  : t === 'COLLEGE' || t === 'LYCEE'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : t === 'SUPERIEUR'
                                      ? 'bg-purple-100 text-purple-800'
                                      : t === 'ASSOCIATION'
                                        ? 'bg-green-100 text-green-800'
                                        : t === 'CONSERVATOIRE'
                                          ? 'bg-pink-100 text-pink-800'
                                          : t === 'PERISCOLAIRE'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : t === 'PUBLICS_EMPECHES'
                                              ? 'bg-orange-100 text-orange-800'
                                              : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 text-xs sm:text-sm text-gray-600 font-ibm">
                        <p className="truncate">
                          {inst.address.city}, {inst.address.zip_code}
                        </p>
                        {/* Display grades for school types */}
                        {inst.grades && inst.grades.length > 0 && (
                          <p className="text-xs text-gray-500">
                            Niveaux:{' '}
                            {inst.grades
                              .map((g: SchoolGrade) => SCHOOL_GRADE_LABELS[g] || g)
                              .join(', ')}
                          </p>
                        )}
                        {/* Display age_ranges for non-school types */}
                        {inst.age_ranges && inst.age_ranges.length > 0 && (
                          <p className="text-xs text-gray-500">
                            Tranches d&apos;âge:{' '}
                            {inst.age_ranges
                              .map((ar: AgeRange) => AGE_RANGE_LABELS[ar] || ar)
                              .join(', ')}
                          </p>
                        )}
                        <p>
                          <span className="font-medium">{inst._count?.userInstitutions || 0}</span>{' '}
                          utilisateur{(inst._count?.userInstitutions || 0) !== 1 ? 's' : ''} ·
                          <span className="font-medium ml-1">
                            {inst._count?.registrations || 0}
                          </span>{' '}
                          inscription{(inst._count?.registrations || 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {inst.email && (
                        <p className="text-xs text-gray-500 font-ibm mt-1 truncate">{inst.email}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {user && user.institution_ids && user.institution_ids.includes(inst.id) ? (
                        <Link
                          className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-none hover:bg-gray-50 transition-colors cursor-pointer font-medium text-xs sm:text-sm text-center"
                          href="/account"
                        >
                          Voir / Modifier
                        </Link>
                      ) : (
                        <>
                          <Link
                            className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-none hover:bg-gray-50 transition-colors cursor-pointer font-medium text-xs sm:text-sm text-center"
                            href={`/admin/institutions/${inst.id}`}
                          >
                            Voir
                          </Link>
                          <button
                            onClick={() => {
                              setToDeleteId(inst.id);
                              setConfirmOpen(true);
                            }}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 border border-red-300 text-red-600 rounded-none hover:bg-red-50 transition-colors cursor-pointer font-medium text-xs sm:text-sm"
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pagination controls */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6 sm:mt-8 pb-6">
            <button
              disabled={page <= 1}
              onClick={() => fetchPage(page - 1)}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-poppins font-semibold text-black border border-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Page précédente
            </button>
            <span className="font-ibm text-xs sm:text-sm text-gray-600 px-2">
              Page {page} sur {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => fetchPage(page + 1)}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-poppins font-semibold text-black border border-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Page suivante
            </button>
          </div>
        )}
      </div>

      <ConfirmationModal
        open={confirmOpen}
        title="Supprimer établissement"
        description="Confirmer la suppression de cet établissement ? Cette action est irréversible."
        onCancel={() => {
          setConfirmOpen(false);
          setToDeleteId(null);
        }}
        onConfirm={() => handleDelete()}
      />

      <AdminInstitutionCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => fetchPage(1)}
        publicCategoryLabels={publicCategoryLabels}
      />

      <HelpWidget content={HELP_CONTENTS['admin-institutions']} isAdminPage={true} />
    </main>
  );
}
