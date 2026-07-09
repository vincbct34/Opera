'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import Loader from '@/components/ui/Loader';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { formatSlotEndSuffix } from '@/lib/events/registrationBlocks';
import { logger } from '@/lib/middleware/logger';
import { Role, UserListItem } from '@/types/api';
import { RegistrationStatus } from '@prisma/client';
import toast from '@/lib/utils/toast';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import Link from 'next/link';
import { Calendar, Users, MapPin, Mail, Edit3, Check, X } from '@deemlol/next-icons';
import {
  REGISTRATION_STATUS_LABELS as DEFAULT_REGISTRATION_STATUS_LABELS,
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  SCHOOL_GRADE_LABELS as DEFAULT_SCHOOL_GRADE_LABELS,
  AGE_RANGE_LABELS as DEFAULT_AGE_RANGE_LABELS,
} from '@/lib/config/labelMappings';
import InstitutionSelector from '@/components/auth/InstitutionSelector';

type SerializedUserListItem = Omit<UserListItem, 'created_at' | 'updated_at'> & {
  created_at: string;
  updated_at: string;
};

/**
 * AdminUserDetailClient component
 * Detailed view of a specific user for admins.
 * Features:
 * - Edit user details (name, email, role)
 * - View associated institutions
 * - View associated registrations (upcoming and past)
 * - Delete user
 *
 * @param initialData - The user data
 */
export default function AdminUserDetailClient({
  initialData,
  registrationStatusLabels,
  publicCategoryLabels,
}: {
  initialData: SerializedUserListItem;
  registrationStatusLabels?: Record<string, string>;
  publicCategoryLabels?: Record<string, string>;
}) {
  // Use dynamic labels if provided, otherwise fall back to static defaults
  const REGISTRATION_STATUS_LABELS = registrationStatusLabels || DEFAULT_REGISTRATION_STATUS_LABELS;
  const PUBLIC_CATEGORY_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;
  const SCHOOL_GRADE_LABELS = DEFAULT_SCHOOL_GRADE_LABELS;
  const AGE_RANGE_LABELS = DEFAULT_AGE_RANGE_LABELS;

  const [data, setData] = useState<SerializedUserListItem>(initialData);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { user } = useUser();

  const isSelf = user && user.id === data.id;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [instNames, setInstNames] = useState<Record<string, string>>({});
  const [instLoading, setInstLoading] = useState(false);
  const [instError, setInstError] = useState<string | null>(null);
  const [regsLoading, setRegsLoading] = useState(false);
  const [regsError, setRegsError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- registration items from API
  const [upcomingRegs, setUpcomingRegs] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- registration items from API
  const [pastRegs, setPastRegs] = useState<any[]>([]);

  // Institution edit mode states
  const [editingInstitutions, setEditingInstitutions] = useState(false);
  const [selectedInstitutionIds, setSelectedInstitutionIds] = useState<string[]>([]);
  const [savingInstitutions, setSavingInstitutions] = useState(false);

  // Load institution names when available
  useEffect(() => {
    const loadInstitutions = async () => {
      if (!data?.userInstitutions || data.userInstitutions.length === 0) return;
      setInstLoading(true);
      setInstError(null);
      try {
        const names: Record<string, string> = {};
        for (const ui of data.userInstitutions) {
          names[ui.institution.id] = ui.institution.name;
        }
        setInstNames(names);
        // Initialize selected institution IDs
        setSelectedInstitutionIds(data.userInstitutions.map((ui) => ui.institution.id));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur';
        setInstError(msg);
      } finally {
        setInstLoading(false);
      }
    };
    loadInstitutions();
  }, [data?.userInstitutions]);

  const handleDelete = async () => {
    try {
      const res = await fetchWithAuth(`/api/users/${data.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erreur');
      toast('Utilisateur supprimé', 'success');
      router.push('/admin/users');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
      logger.error(err);
    } finally {
      setConfirmOpen(false);
    }
  };

  const handleSave = async () => {
    if (isSelf) {
      // redirect to account page for self-edits
      router.push('/account');
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/users/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: data.role }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erreur');
      toast('Utilisateur mis à jour', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
      logger.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInstitutions = async () => {
    setSavingInstitutions(true);
    try {
      const res = await fetchWithAuth(`/api/users/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institution_ids: selectedInstitutionIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erreur');

      // Update local data with new institutions
      setData((prev) => ({
        ...prev,
        userInstitutions: selectedInstitutionIds.map((id) => ({
          institution: { id, name: instNames[id] || 'Établissement inconnu' },
        })),
      }));

      toast('Établissements mis à jour', 'success');
      setEditingInstitutions(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
      logger.error(err);
    } finally {
      setSavingInstitutions(false);
    }
  };

  const handleCancelEditInstitutions = () => {
    // Reset to original institutions
    setSelectedInstitutionIds(data.userInstitutions?.map((ui) => ui.institution.id) || []);
    setEditingInstitutions(false);
  };

  const formatDate = (d?: string) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return d;
    }
  };

  // Helpers for status display (same mapping as institution view)
  const statusMap = REGISTRATION_STATUS_LABELS;

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
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- disabilities can have varying shapes
  const getDisabilityCount = (disabilities: any[] | undefined) => {
    if (!Array.isArray(disabilities) || disabilities.length === 0) return 0;
    return disabilities.reduce((sum, it) => {
      if (!it) return sum;
      const raw = it.count ?? it.cnt ?? it.quantity ?? it.qty ?? it.number ?? 0;
      const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
      return sum + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0);
  };

  // Pagination state
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Load user's registrations (split into upcoming / past)
  useEffect(() => {
    const loadRegs = async () => {
      if (!data?.id) return;
      setRegsLoading(true);
      setRegsError(null);
      try {
        // Use the dedicated registrations endpoint with limit=0 to fetch all for client-side processing
        const res = await fetchWithAuth(`/api/users/${data.id}/registrations?limit=0`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || 'Erreur récupération réservations');
        }
        const j = await res.json().catch(() => ({}));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- registration items from API
        const regs: any[] = j.registrations || [];
        const now = new Date();
        const upcoming = regs
          .filter((r) => new Date(r.date) >= now)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const past = regs
          .filter((r) => new Date(r.date) < now)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setUpcomingRegs(upcoming);
        setPastRegs(past);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur';
        setRegsError(msg);
      } finally {
        setRegsLoading(false);
      }
    };
    loadRegs();
  }, [data?.id]);

  // Pagination Logic
  const paginatedUpcoming = upcomingRegs
    ? upcomingRegs.slice((upcomingPage - 1) * ITEMS_PER_PAGE, upcomingPage * ITEMS_PER_PAGE)
    : [];
  const totalUpcomingPages = upcomingRegs ? Math.ceil(upcomingRegs.length / ITEMS_PER_PAGE) : 0;

  const paginatedPast = pastRegs
    ? pastRegs.slice((pastPage - 1) * ITEMS_PER_PAGE, pastPage * ITEMS_PER_PAGE)
    : [];
  const totalPastPages = pastRegs ? Math.ceil(pastRegs.length / ITEMS_PER_PAGE) : 0;

  return (
    <main className="p-4 sm:p-6">
      <header className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-poppins font-semibold">Détails utilisateur</h1>
      </header>

      <section
        className={`group relative bg-white border border-black/10 shadow-sm hover:shadow-md transition-shadow`}
      >
        <header className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="font-poppins font-semibold text-sm sm:text-base tracking-wide">
            Informations
          </h2>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {!isSelf && (
              <button
                onClick={() => setConfirmOpen(true)}
                className="text-xs font-poppins font-semibold border border-red-300 px-2 py-1 hover:bg-red-50 text-red-600 cursor-pointer transition-colors flex-1 sm:flex-none"
              >
                Supprimer
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-poppins font-semibold border border-emerald-300 px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer transition-colors flex-1 sm:flex-none"
            >
              {saving ? <Loader /> : 'Enregistrer'}
            </button>
            {isSelf && (
              <button
                onClick={() => router.push('/account')}
                className="text-xs font-poppins font-semibold border border-gray-300 px-2 py-1 hover:bg-gray-100 cursor-pointer flex-1 sm:flex-none"
              >
                Aller à mon compte
              </button>
            )}
          </div>
        </header>

        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-poppins font-semibold mb-1">Nom</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <input
                className="w-full border border-gray-300 px-2 py-1 text-xs sm:text-sm"
                value={data.first_name || ''}
                onChange={(e) => setData({ ...data, first_name: e.target.value })}
              />
              <input
                className="w-full border border-gray-300 px-2 py-1 text-xs sm:text-sm"
                value={data.last_name || ''}
                onChange={(e) => setData({ ...data, last_name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-poppins font-semibold mb-1">
                Email
              </label>
              <input
                className="w-full border border-gray-300 px-2 py-1 text-xs sm:text-sm"
                value={data.email || ''}
                onChange={(e) => setData({ ...data, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-poppins font-semibold mb-1">
                Rôle
              </label>
              <select
                value={data.role}
                onChange={(e) => setData({ ...data, role: e.target.value as Role })}
                className="w-full p-2 border border-gray-300 text-xs sm:text-sm"
              >
                <option value={Role.USER}>USER</option>
                <option value={Role.ADMIN}>ADMIN</option>
                <option value={Role.SUPERADMIN}>SUPERADMIN</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs sm:text-sm font-poppins font-semibold">
                  Établissement(s)
                </label>
                {!editingInstitutions && (
                  <button
                    type="button"
                    onClick={() => setEditingInstitutions(true)}
                    className="text-xs font-poppins font-semibold border border-gray-300 px-2 py-1 hover:bg-gray-100 cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Edit3 size={12} />
                    Modifier
                  </button>
                )}
              </div>
              {editingInstitutions ? (
                <div className="space-y-3">
                  {selectedInstitutionIds.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-poppins font-semibold text-blue-900">
                          Établissement(s) sélectionné(s)
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedInstitutionIds([])}
                          className="text-xs text-red-600 hover:text-red-800 underline"
                        >
                          Tout retirer
                        </button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {selectedInstitutionIds.map((id) => (
                          <div
                            key={id}
                            className="flex items-center justify-between bg-white px-2 py-1 border border-blue-300"
                          >
                            <span className="text-xs font-ibm truncate flex-1">
                              {instNames[id] || 'Chargement...'}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedInstitutionIds((prev) => prev.filter((i) => i !== id))
                              }
                              className="ml-2 text-red-600 hover:text-red-800"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <InstitutionSelector
                    onInstitutionSelect={setSelectedInstitutionIds}
                    initialSelections={selectedInstitutionIds}
                    allowMultiple={true}
                    publicCategoryLabels={publicCategoryLabels}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveInstitutions}
                      disabled={savingInstitutions}
                      className="flex items-center gap-1 px-3 py-1.5 bg-black text-white text-xs font-poppins font-semibold hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      <Check size={14} />
                      {savingInstitutions ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditInstitutions}
                      disabled={savingInstitutions}
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-black text-xs font-poppins hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      <X size={14} />
                      Annuler
                    </button>
                  </div>
                </div>
              ) : data.userInstitutions && data.userInstitutions.length > 0 ? (
                instLoading ? (
                  <div className="text-xs sm:text-sm text-gray-500">Chargement...</div>
                ) : instError ? (
                  <div className="text-xs sm:text-sm text-red-600">Erreur</div>
                ) : (
                  <div className="space-y-1">
                    {data.userInstitutions.map((ui) => (
                      <Link
                        key={ui.institution.id}
                        href={`/admin/institutions/${ui.institution.id}`}
                        className="text-xs sm:text-sm text-black/80 underline block"
                      >
                        {instNames[ui.institution.id] || ui.institution.name}
                      </Link>
                    ))}
                  </div>
                )
              ) : (
                <div className="text-xs sm:text-sm text-gray-500">Aucun établissement</div>
              )}
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-poppins font-semibold mb-1">
                Dates
              </label>
              <div className="text-xs sm:text-sm text-gray-600">
                <div>Créé : {formatDate(data.created_at)}</div>
                <div>Mis à jour : {formatDate(data.updated_at)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Associated Registrations */}
      <section
        className={`group relative bg-white border border-black/10 shadow-sm hover:shadow-md transition-shadow mt-4 sm:mt-6`}
      >
        <header className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-poppins font-semibold text-sm sm:text-base tracking-wide">
            Demande(s) associée(s)
          </h2>
        </header>
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Upcoming */}
          <div>
            <h3 className="font-poppins font-semibold text-base sm:text-lg mb-3 sm:mb-4">
              Demande(s) à venir ({upcomingRegs?.length || 0})
            </h3>
            <div className="mt-3">
              {regsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader />
                </div>
              ) : regsError ? (
                <div className="text-red-600 bg-white border border-red-300 p-4">{regsError}</div>
              ) : paginatedUpcoming && paginatedUpcoming.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {paginatedUpcoming.map((r) => (
                      <div
                        key={r.id}
                        className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4 md:p-5"
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
                          <div className="flex-1 min-w-0 w-full">
                            <h4 className="font-poppins font-semibold text-sm sm:text-base text-black mb-1 truncate">
                              {r.event?.title || 'Événement supprimé'}
                            </h4>
                            {r.event?.location && (
                              <div className="text-xs sm:text-sm text-gray-600 font-ibm truncate">
                                {r.event.location}
                              </div>
                            )}
                          </div>
                          <span
                            className={`shrink-0 inline-flex items-center gap-1 px-2 sm:px-3 py-1 text-xs font-medium tracking-wide border ${badgeColor(r.status)}`}
                          >
                            {statusMap[r.status as keyof typeof statusMap] || r.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full shrink-0">
                              <Calendar
                                size={16}
                                className="sm:w-[18px] sm:h-[18px]"
                                color="#ffffff"
                              />
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 font-ibm">Date</div>
                              <div className="text-xs sm:text-sm font-poppins font-semibold">
                                {formatDate(r.date)}
                              </div>
                            </div>
                          </div>

                          {(() => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- disabilities shape varies
                            const disabilities: any[] = r.disabilities || [];
                            const disabilityCount = getDisabilityCount(disabilities);
                            const total = r.booked_seats || 0;
                            const normal = Math.max(0, total - disabilityCount);
                            const aesh = r.aesh_count || 0;
                            return (
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full shrink-0">
                                  <Users
                                    size={16}
                                    className="sm:w-[18px] sm:h-[18px]"
                                    color="#ffffff"
                                  />
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                  <div>
                                    <div className="text-xs text-gray-500 font-ibm">
                                      Total places
                                    </div>
                                    <div className="text-xl sm:text-2xl font-poppins font-bold">
                                      {total}
                                    </div>
                                  </div>
                                  <div className="sm:border-l sm:border-gray-200 sm:pl-3">
                                    <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
                                      <span className="font-ibm">
                                        <span className="font-semibold">{normal}</span> sans besoin
                                        particulier
                                      </span>
                                      <span className="text-gray-400">•</span>
                                      <span className="font-ibm">
                                        <span className="font-semibold">{disabilityCount}</span>{' '}
                                        handicap
                                      </span>
                                      {aesh > 0 && (
                                        <>
                                          <span className="text-gray-400">•</span>
                                          <span className="font-ibm">
                                            <span className="font-semibold">{aesh}</span> AESH
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {disabilityCount === 0 && total > 0 && disabilities.length > 0 && (
                                  <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 border border-gray-300">
                                    Vérifier
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Category, grades and age ranges badges */}
                        {((r.category && r.category.length > 0) ||
                          (r.grades && r.grades.length > 0) ||
                          (r.age_ranges && r.age_ranges.length > 0)) && (
                          <div className="flex flex-wrap gap-2">
                            {r.category &&
                              r.category.length > 0 &&
                              r.category.map((cat: string) => (
                                <span
                                  key={cat}
                                  className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 font-ibm"
                                >
                                  {PUBLIC_CATEGORY_LABELS[cat] || cat}
                                </span>
                              ))}
                            {r.grades &&
                              r.grades.length > 0 &&
                              r.grades.map((grade: string) => (
                                <span
                                  key={grade}
                                  className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 font-ibm"
                                >
                                  {SCHOOL_GRADE_LABELS[grade] || grade}
                                </span>
                              ))}
                            {r.age_ranges &&
                              r.age_ranges.length > 0 &&
                              r.age_ranges.map((ageRange: string) => (
                                <span
                                  key={ageRange}
                                  className="text-xs px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 font-ibm"
                                >
                                  {AGE_RANGE_LABELS[ageRange] || ageRange}
                                </span>
                              ))}
                          </div>
                        )}

                        {/* Formation and Preparation flags */}
                        {r.blockSelections && r.blockSelections.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {r.blockSelections.map(
                              (selection: {
                                id: string;
                                wants_to_attend: boolean;
                                selected_date?: string | null;
                                selected_end_date?: string | null;
                                block: { title: string };
                              }) => (
                                <span
                                  key={selection.id}
                                  className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-ibm"
                                >
                                  {selection.wants_to_attend ? '✓' : 'Non'} {selection.block.title}
                                  {selection.selected_date
                                    ? ` - ${new Date(selection.selected_date).toLocaleString(
                                        'fr-FR',
                                        {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        },
                                      )}${formatSlotEndSuffix(selection.selected_end_date)}`
                                    : ''}
                                </span>
                              ),
                            )}
                          </div>
                        ) : (
                          ((r.want_formation !== null && r.want_formation !== undefined) ||
                            (r.want_preparation !== null && r.want_preparation !== undefined)) && (
                            <div className="flex flex-wrap gap-2">
                              {r.want_formation && (
                                <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-ibm">
                                  🎓 Formation souhaitée
                                </span>
                              )}
                              {r.want_preparation && (
                                <span className="text-xs px-2 py-1 bg-teal-50 text-teal-700 border border-teal-200 font-ibm">
                                  🎵 Préparation musicale souhaitée
                                </span>
                              )}
                            </div>
                          )
                        )}

                        {r.manager_email && (
                          <div className="pt-3 border-t border-gray-200">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 bg-gray-100 rounded shrink-0">
                                <Mail size={14} className="sm:w-4 sm:h-4" color="#6b7280" />
                              </div>
                              <span className="text-xs sm:text-sm font-ibm text-gray-600">
                                <span className="font-semibold">Contact:</span>{' '}
                                {r.manager_first_name ? `${r.manager_first_name} ` : ''}
                                {r.manager_last_name ? `${r.manager_last_name} — ` : ''}
                                {r.manager_email}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Upcoming Pagination Controls */}
                  {totalUpcomingPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button
                        onClick={() => setUpcomingPage((p) => Math.max(1, p - 1))}
                        disabled={upcomingPage === 1}
                        className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        Précédent
                      </button>
                      <span className="text-xs text-gray-600">
                        Page {upcomingPage} sur {totalUpcomingPages}
                      </span>
                      <button
                        onClick={() => setUpcomingPage((p) => Math.min(totalUpcomingPages, p + 1))}
                        disabled={upcomingPage === totalUpcomingPages}
                        className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        Suivant
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white border border-gray-200 p-6 sm:p-8 text-center">
                  <p className="text-sm sm:text-base text-gray-600 font-ibm">
                    Aucune demande à venir.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Past */}
          <div>
            <h3 className="font-poppins font-semibold text-base sm:text-lg mb-3 sm:mb-4">
              Demande(s) passée(s) ({pastRegs?.length || 0})
            </h3>
            <div className="mt-3">
              {regsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader />
                </div>
              ) : regsError ? (
                <div className="text-red-600 bg-white border border-red-300 p-4">{regsError}</div>
              ) : paginatedPast && paginatedPast.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {paginatedPast.map((r) => (
                      <div
                        key={r.id}
                        className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4 md:p-5 opacity-75 hover:opacity-100"
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
                          <div className="flex-1 min-w-0 w-full">
                            <h4 className="font-poppins font-semibold text-sm sm:text-base text-gray-700 mb-1 truncate">
                              {r.event?.title || 'Événement supprimé'}
                            </h4>
                            {r.event?.location && (
                              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 font-ibm truncate">
                                <MapPin size={14} className="sm:w-4 sm:h-4" color="#6b7280" />
                                <span className="truncate">{r.event.location}</span>
                              </div>
                            )}
                          </div>
                          <span
                            className={`shrink-0 inline-flex items-center gap-1 px-2 sm:px-3 py-1 text-xs font-medium tracking-wide border ${badgeColor(r.status)}`}
                          >
                            {statusMap[r.status as keyof typeof statusMap] || r.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-gray-700 rounded-full shrink-0">
                              <Calendar
                                size={16}
                                className="sm:w-[18px] sm:h-[18px]"
                                color="#ffffff"
                              />
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 font-ibm">Date</div>
                              <div className="text-xs sm:text-sm font-poppins font-semibold text-gray-700">
                                {formatDate(r.date)}
                              </div>
                            </div>
                          </div>

                          {(() => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- disabilities shape varies
                            const disabilities: any[] = r.disabilities || [];
                            const disabilityCount = getDisabilityCount(disabilities);
                            const total = r.booked_seats || 0;
                            const normal = Math.max(0, total - disabilityCount);
                            return (
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-gray-700 rounded-full shrink-0">
                                  <Users
                                    size={16}
                                    className="sm:w-[18px] sm:h-[18px]"
                                    color="#ffffff"
                                  />
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                  <div>
                                    <div className="text-xs text-gray-500 font-ibm">
                                      Total places
                                    </div>
                                    <div className="text-xl sm:text-2xl font-poppins font-bold text-gray-700">
                                      {total}
                                    </div>
                                  </div>
                                  <div className="sm:border-l sm:border-gray-200 sm:pl-3">
                                    <div className="flex gap-2 text-xs sm:text-sm text-gray-600">
                                      <span className="font-ibm">
                                        <span className="font-semibold">{normal}</span> sans besoin
                                        particulier
                                      </span>
                                      <span className="text-gray-400">•</span>
                                      <span className="font-ibm">
                                        <span className="font-semibold">{disabilityCount}</span>{' '}
                                        handicap
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                {disabilityCount === 0 && total > 0 && disabilities.length > 0 && (
                                  <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 border border-gray-300">
                                    ⚠️ Vérifier
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Category, grades and age ranges badges */}
                        {((r.category && r.category.length > 0) ||
                          (r.grades && r.grades.length > 0) ||
                          (r.age_ranges && r.age_ranges.length > 0)) && (
                          <div className="flex flex-wrap gap-2">
                            {r.category &&
                              r.category.length > 0 &&
                              r.category.map((cat: string) => (
                                <span
                                  key={cat}
                                  className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 font-ibm"
                                >
                                  {PUBLIC_CATEGORY_LABELS[cat] || cat}
                                </span>
                              ))}
                            {r.grades &&
                              r.grades.length > 0 &&
                              r.grades.map((grade: string) => (
                                <span
                                  key={grade}
                                  className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 font-ibm"
                                >
                                  {SCHOOL_GRADE_LABELS[grade] || grade}
                                </span>
                              ))}
                            {r.age_ranges &&
                              r.age_ranges.length > 0 &&
                              r.age_ranges.map((ageRange: string) => (
                                <span
                                  key={ageRange}
                                  className="text-xs px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 font-ibm"
                                >
                                  {AGE_RANGE_LABELS[ageRange] || ageRange}
                                </span>
                              ))}
                          </div>
                        )}

                        {/* Formation and Preparation flags */}
                        {r.blockSelections && r.blockSelections.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {r.blockSelections.map(
                              (selection: {
                                id: string;
                                wants_to_attend: boolean;
                                selected_date?: string | null;
                                selected_end_date?: string | null;
                                block: { title: string };
                              }) => (
                                <span
                                  key={selection.id}
                                  className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-ibm"
                                >
                                  {selection.wants_to_attend ? '✓' : 'Non'} {selection.block.title}
                                  {selection.selected_date
                                    ? ` - ${new Date(selection.selected_date).toLocaleString(
                                        'fr-FR',
                                        {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        },
                                      )}${formatSlotEndSuffix(selection.selected_end_date)}`
                                    : ''}
                                </span>
                              ),
                            )}
                          </div>
                        ) : (
                          ((r.want_formation !== null && r.want_formation !== undefined) ||
                            (r.want_preparation !== null && r.want_preparation !== undefined)) && (
                            <div className="flex flex-wrap gap-2">
                              {r.want_formation && (
                                <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-ibm">
                                  🎓 Formation souhaitée
                                </span>
                              )}
                              {r.want_preparation && (
                                <span className="text-xs px-2 py-1 bg-teal-50 text-teal-700 border border-teal-200 font-ibm">
                                  🎵 Préparation musicale souhaitée
                                </span>
                              )}
                            </div>
                          )
                        )}

                        {r.manager_email && (
                          <div className="pt-3 border-t border-gray-200">
                            <span className="text-xs sm:text-sm font-ibm text-gray-600">
                              <span className="font-semibold">Contact:</span>{' '}
                              {r.manager_first_name ? `${r.manager_first_name} ` : ''}
                              {r.manager_last_name ? `${r.manager_last_name} — ` : ''}
                              {r.manager_email}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Past Pagination Controls */}
                  {totalPastPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button
                        onClick={() => setPastPage((p) => Math.max(1, p - 1))}
                        disabled={pastPage === 1}
                        className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        Précédent
                      </button>
                      <span className="text-xs text-gray-600">
                        Page {pastPage} sur {totalPastPages}
                      </span>
                      <button
                        onClick={() => setPastPage((p) => Math.min(totalPastPages, p + 1))}
                        disabled={pastPage === totalPastPages}
                        className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        Suivant
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white border border-gray-200 p-6 sm:p-8 text-center">
                  <p className="text-sm sm:text-base text-gray-600 font-ibm">
                    Aucune demande passée.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <ConfirmationModal
        open={confirmOpen}
        title="Supprimer utilisateur"
        description="Confirmer la suppression de cet utilisateur ? Cette action est irréversible."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </main>
  );
}
