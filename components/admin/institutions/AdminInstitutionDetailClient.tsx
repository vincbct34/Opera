'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import Loader from '@/components/ui/Loader';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import toast from '@/lib/utils/toast';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { Calendar, Users, MapPin, Mail } from '@deemlol/next-icons';
import type { InstitutionWithAddress, SafeUser } from '@/types/api';
import { SchoolGrade, AgeRange } from '@prisma/client';
import MultiSelect from '@/components/ui/MultiSelect';
import { PublicCategory, RegistrationStatus } from '@/types/api';
import {
  REGISTRATION_STATUS_LABELS as DEFAULT_REGISTRATION_STATUS_LABELS,
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  SCHOOL_GRADE_LABELS,
  AGE_RANGE_LABELS,
} from '@/lib/config/labelMappings';
import { getGradesForSchoolTypes } from '@/lib/config/badgeConstants';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

type UserInstitutionWithUser = {
  id: string;
  user: Pick<SafeUser, 'id' | 'first_name' | 'last_name' | 'email' | 'role' | 'created_at'>;
};

/**
 * AdminInstitutionDetailClient component
 * Detailed view of a specific institution.
 * Features:
 * - Edit institution details (name, type, address, contact)
 * - View associated users
 * - View associated registrations (upcoming and past)
 * - Delete institution
 *
 * @param initialData - The institution data including address and optional user/registration counts
 */
export default function AdminInstitutionDetailClient({
  initialData,
  registrationStatusLabels,
  publicCategoryLabels,
}: {
  initialData: InstitutionWithAddress & { userInstitutions?: UserInstitutionWithUser[] };
  registrationStatusLabels?: Record<string, string>;
  publicCategoryLabels?: Record<string, string>;
}) {
  // Use dynamic labels if provided, otherwise fall back to static defaults
  const REGISTRATION_STATUS_LABELS = registrationStatusLabels || DEFAULT_REGISTRATION_STATUS_LABELS;
  const PUBLIC_CATEGORY_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;

  const [data, setData] = useState<typeof initialData>(initialData);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { user } = useUser();

  const isOwned = user && user.institution_ids && user.institution_ids.includes(data.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regsLoading, setRegsLoading] = useState(false);
  const [regsError, setRegsError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- external API data, shape varies
  const [upcomingRegs, setUpcomingRegs] = useState<any[] | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- external API data, shape varies
  const [pastRegs, setPastRegs] = useState<any[] | null>(null);

  const typeOptions = Object.values(PublicCategory).map((t) => ({
    value: t,
    label: t,
  }));

  // School Grade options filtered by selected school types
  const relevantGrades = getGradesForSchoolTypes(data.type || []);
  const gradeOptions = relevantGrades.map((g) => ({
    value: g,
    label: SCHOOL_GRADE_LABELS[g] || g,
  }));

  // Age Range options (for ASSOCIATION, CONSERVATOIRE, PERISCOLAIRE, PUBLICS_EMPECHES, AUTRE)
  const ageRangeOptions = Object.values(AgeRange).map((ar) => ({
    value: ar,
    label: AGE_RANGE_LABELS[ar] || ar,
  }));

  const handleDelete = async () => {
    try {
      const res = await fetchWithAuth(`/api/institutions/${data.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erreur');
      toast('Établissement supprimé', 'success');
      router.push('/admin/institutions');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
      logger.error(err);
    } finally {
      setConfirmOpen(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/institutions/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erreur');
      setData(json.institution || data);
      toast('Mise à jour effectuée', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
      logger.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Pagination state
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    const loadRegs = async () => {
      if (!data?.id) return;
      setRegsLoading(true);
      setRegsError(null);
      try {
        // Fetch all registrations for client-side splitting and pagination
        const res = await fetchWithAuth(`/api/institutions/${data.id}/registrations?limit=0`);
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || 'Erreur récupération inscriptions');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- registration items from API
        const regs: any[] = j.registrations || [];
        // split into upcoming and past without storing the full array
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

  // Helpers for status display
  const statusMap = REGISTRATION_STATUS_LABELS;

  const formatDate = (d: string) => {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getDisabilityCount = (disabilities: any[] | undefined) => {
    if (!Array.isArray(disabilities) || disabilities.length === 0) return 0;
    return disabilities.reduce((sum, it) => {
      if (!it) return sum;
      const raw = it.count ?? it.cnt ?? it.quantity ?? it.qty ?? it.number ?? 0;
      const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
      return sum + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0);
  };

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
        <h1 className="text-2xl sm:text-3xl font-poppins font-semibold">Détails établissement</h1>
      </header>

      {/* Reuse account Card look */}
      <section
        className={`group relative bg-white border border-black/10 shadow-sm hover:shadow-md transition-shadow`}
      >
        <header className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="font-poppins font-semibold text-sm sm:text-base tracking-wide">
            Informations
          </h2>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {!isOwned && (
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
            {isOwned && (
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
            <input
              className="w-full border border-gray-300 px-2 py-1 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-black/40"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
            />
          </div>

          {/* Type & Grades/Age Ranges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-poppins font-semibold mb-1">
                Type
              </label>
              <MultiSelect
                options={typeOptions}
                selectedValues={data.type || []}
                onChange={(vals) => {
                  const newTypes = vals as PublicCategory[];
                  const newRelevantGrades = getGradesForSchoolTypes(newTypes);
                  const filteredGrades = (data.grades || []).filter((g) =>
                    newRelevantGrades.includes(g),
                  );
                  setData({ ...data, type: newTypes, grades: filteredGrades });
                }}
                placeholder="Sélectionner..."
              />
            </div>
            {data.type &&
              data.type.some((t) =>
                ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'].includes(t),
              ) && (
                <div>
                  <label className="block text-xs sm:text-sm font-poppins font-semibold mb-1">
                    Niveaux scolaires
                  </label>
                  <MultiSelect
                    options={gradeOptions}
                    selectedValues={data.grades || []}
                    onChange={(vals) => setData({ ...data, grades: vals as SchoolGrade[] })}
                    placeholder="Sélectionner..."
                  />
                </div>
              )}
            {data.type &&
              data.type.some((t) =>
                [
                  'ASSOCIATION',
                  'PERISCOLAIRE',
                  'PUBLICS_EMPECHES',
                  'CONSERVATOIRE',
                  'AUTRE',
                ].includes(t),
              ) && (
                <div>
                  <label className="block text-xs sm:text-sm font-poppins font-semibold mb-1">
                    Tranches d&apos;âge (Nouveau)
                  </label>
                  <MultiSelect
                    options={ageRangeOptions}
                    selectedValues={data.age_ranges || []}
                    onChange={(vals) => setData({ ...data, age_ranges: vals as AgeRange[] })}
                    placeholder="Sélectionner..."
                  />
                </div>
              )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-poppins font-semibold mb-1">
                Email
              </label>
              <input
                className="w-full border border-gray-300 px-2 py-1 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-black/40"
                value={data.email || ''}
                onChange={(e) => setData({ ...data, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-poppins font-semibold mb-1">
                Téléphone
              </label>
              <input
                className="w-full border border-gray-300 px-2 py-1 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-black/40"
                value={data.phone_number || ''}
                onChange={(e) => setData({ ...data, phone_number: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-poppins font-semibold mb-1">
              Adresse
            </label>
            <input
              className="w-full border border-gray-300 px-2 py-1 mb-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-black/40"
              value={data.address.street || ''}
              onChange={(e) =>
                setData({ ...data, address: { ...data.address, street: e.target.value } })
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <input
                className="w-full border border-gray-300 px-2 py-1 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-black/40"
                value={data.address.zip_code || ''}
                onChange={(e) =>
                  setData({ ...data, address: { ...data.address, zip_code: e.target.value } })
                }
              />
              <input
                className="w-full border border-gray-300 px-2 py-1 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-black/40"
                value={data.address.city || ''}
                onChange={(e) =>
                  setData({ ...data, address: { ...data.address, city: e.target.value } })
                }
              />
            </div>
          </div>
        </div>
      </section>
      {/* Associated Users */}
      <section
        className={`group relative bg-white border border-black/10 shadow-sm hover:shadow-md transition-shadow mt-4 sm:mt-6`}
      >
        <header className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-poppins font-semibold text-sm sm:text-base tracking-wide">
            Utilisateur(s) associé(s)
          </h2>
        </header>
        <div className="p-4 sm:p-6">
          {data.userInstitutions && data.userInstitutions.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {data.userInstitutions.map((ui) => (
                <div
                  key={ui.id}
                  className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4 cursor-pointer"
                  onClick={() => router.push(`/admin/users/${ui.user.id}`)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full shrink-0">
                        <Users size={16} className="sm:w-4.5 sm:h-4.5" color="#ffffff" />
                      </div>
                      <div>
                        <h4 className="font-poppins font-semibold text-sm sm:text-base text-black">
                          {ui.user.first_name} {ui.user.last_name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs sm:text-sm text-gray-600 font-ibm flex items-center gap-1">
                            <Mail size={12} className="sm:w-3.5 sm:h-3.5" color="#6b7280" />
                            <span className="truncate">{ui.user.email}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 ml-11 sm:ml-0">
                      {(() => {
                        const role = ui.user.role;
                        const roleConfig =
                          role === 'SUPERADMIN'
                            ? {
                                label: 'SuperAdmin',
                                className: 'bg-purple-50 text-purple-700 border-purple-200',
                              }
                            : role === 'ADMIN'
                              ? {
                                  label: 'Admin',
                                  className: 'bg-blue-50 text-blue-700 border-blue-200',
                                }
                              : {
                                  label: 'Utilisateur',
                                  className: 'bg-gray-100 text-gray-600 border-gray-300',
                                };
                        return (
                          <span
                            className={`inline-flex items-center px-2 sm:px-3 py-1 text-xs font-medium tracking-wide border ${roleConfig.className}`}
                          >
                            {roleConfig.label}
                          </span>
                        );
                      })()}
                      <span className="text-xs text-gray-500 font-ibm">
                        Inscrit le{' '}
                        {new Date(ui.user.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 p-4 sm:p-6 md:p-8 text-center">
              <p className="text-sm sm:text-base text-gray-600 font-ibm">
                Aucun utilisateur associé.
              </p>
            </div>
          )}
        </div>
      </section>
      {/* Associated Registrations */}
      <section
        className={`group relative bg-white border border-black/10 shadow-sm hover:shadow-md transition-shadow mt-4 sm:mt-6`}
      >
        <header className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                <div className="flex justify-center py-6 sm:py-8">
                  <Loader />
                </div>
              ) : regsError ? (
                <div className="text-sm sm:text-base text-red-600 bg-white border border-red-300 p-3 sm:p-4">
                  {regsError}
                </div>
              ) : paginatedUpcoming && paginatedUpcoming.length > 0 ? (
                <>
                  <div className="space-y-2 sm:space-y-3">
                    {paginatedUpcoming.map((r) => (
                      <div
                        key={r.id}
                        className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4 md:p-5"
                      >
                        {/* Header with Title and Status */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                          <div className="flex-1 min-w-0">
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

                        {/* Date and Seats Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                          {/* Date */}
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full shrink-0">
                              <Calendar size={16} className="sm:w-4.5 sm:h-4.5" color="#ffffff" />
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 font-ibm">Date</div>
                              <div className="text-xs sm:text-sm font-poppins font-semibold">
                                {formatDate(r.date)}
                              </div>
                            </div>
                          </div>

                          {/* Seats Stats */}
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
                                  <Users size={16} className="sm:w-4.5 sm:h-4.5" color="#ffffff" />
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
                                  <div className="sm:border-l border-gray-200 sm:pl-3">
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
                                  <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 border border-gray-300 shrink-0">
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
                                      )}`
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

                        {/* Contact Info */}
                        {r.manager_email && (
                          <div className="pt-2 sm:pt-3 border-t border-gray-200">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 bg-gray-100 rounded shrink-0">
                                <Mail size={14} className="sm:w-4 sm:h-4" color="#6b7280" />
                              </div>
                              <span className="text-xs sm:text-sm font-ibm text-gray-600">
                                <span className="font-semibold">Contact:</span>{' '}
                                {r.manager_first_name ? `${r.manager_first_name} ` : ''}
                                {r.manager_last_name ? `${r.manager_last_name} — ` : ''}
                                <span className="break-all">{r.manager_email}</span>
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
                <div className="bg-white border border-gray-200 p-4 sm:p-6 md:p-8 text-center">
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
                        {/* Header with Title and Status */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                          <div className="flex-1 min-w-0">
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

                        {/* Date and Seats Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                          {/* Date */}
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-gray-700 rounded-full shrink-0">
                              <Calendar size={16} className="sm:w-4.5 sm:h-4.5" color="#ffffff" />
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 font-ibm">Date</div>
                              <div className="text-xs sm:text-sm font-poppins font-semibold text-gray-700">
                                {formatDate(r.date)}
                              </div>
                            </div>
                          </div>

                          {/* Seats Stats */}
                          {(() => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- disabilities shape varies
                            const disabilities: any[] = r.disabilities || [];
                            const disabilityCount = getDisabilityCount(disabilities);
                            const total = r.booked_seats || 0;
                            const normal = Math.max(0, total - disabilityCount);
                            return (
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-gray-700 rounded-full shrink-0">
                                  <Users size={16} className="sm:w-4.5 sm:h-4.5" color="#ffffff" />
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
                                  <div className="sm:border-l border-gray-200 sm:pl-3">
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
                                  <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 border border-gray-300 shrink-0">
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
                                      )}`
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

                        {/* Contact Info */}
                        {r.manager_email && (
                          <div className="pt-2 sm:pt-3 border-t border-gray-200">
                            <span className="text-xs sm:text-sm font-ibm text-gray-600">
                              <span className="font-semibold">Contact:</span>{' '}
                              {r.manager_first_name ? `${r.manager_first_name} ` : ''}
                              {r.manager_last_name ? `${r.manager_last_name} — ` : ''}
                              <span className="break-all">{r.manager_email}</span>
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
                <div className="bg-white border border-gray-200 p-4 sm:p-6 md:p-8 text-center">
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
        title="Supprimer établissement"
        description="Confirmer la suppression de cet établissement ? Cette action est irréversible."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
      />

      <HelpWidget content={HELP_CONTENTS['admin-institutions']} isAdminPage={true} />
    </main>
  );
}
