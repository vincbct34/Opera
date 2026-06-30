'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { normalizeApiError } from '@/lib/validation/errorMessages';
import Loader from '@/components/ui/Loader';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import ChangePasswordModal from '@/components/auth/ChangePasswordModal';
import toast from '@/lib/utils/toast';
import {
  RegistrationStatus,
  PublicCategory,
  Accessibility,
  SchoolGrade,
  AgeRange,
} from '@/types/api';
import Link from 'next/link';
import { UserWithDetails, InstitutionWithCounts, GroupWithoutUserId } from '@/types/api';
import { getEventUrl } from '@/lib/events/eventUrl';
import {
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  ACCESSIBILITY_LABELS as DEFAULT_ACCESSIBILITY_LABELS,
  REGISTRATION_STATUS_LABELS as DEFAULT_REGISTRATION_STATUS_LABELS,
  SCHOOL_GRADE_LABELS as DEFAULT_SCHOOL_GRADE_LABELS,
  AGE_RANGE_LABELS as DEFAULT_AGE_RANGE_LABELS,
} from '@/lib/config/labelMappings';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

// ============================================================================
// Types
// ============================================================================

interface DynamicLabelsProps {
  publicCategoryLabels?: Record<string, string>;
  accessibilityLabels?: Record<string, string>;
  registrationStatusLabels?: Record<string, string>;
  schoolGradeLabels?: Record<string, string>;
  ageRangeLabels?: Record<string, string>;
}

const INSTITUTIONS_PER_PAGE = 2;

const StatBadge = ({ active, label }: { active: boolean; label: string }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium tracking-wide border ${active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
  >
    {label}
    {active ? '' : ''}
  </span>
);

const Card = ({
  title,
  children,
  className = '',
  actions,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) => (
  <section
    className={`group relative bg-white border border-black/10 shadow-sm hover:shadow-md transition-shadow ${className}`}
  >
    {title && (
      <header className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-gray-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-poppins font-semibold text-sm sm:text-base tracking-wide">{title}</h2>
        {actions}
      </header>
    )}
    <div className="p-3 sm:p-4">{children}</div>
  </section>
);

export default function AccountClient({
  publicCategoryLabels,
  accessibilityLabels,
  registrationStatusLabels,
  schoolGradeLabels,
  ageRangeLabels,
}: DynamicLabelsProps = {}) {
  // Use dynamic labels if provided, otherwise fall back to static defaults
  const PUBLIC_CATEGORY_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;
  const ACCESSIBILITY_LABELS = accessibilityLabels || DEFAULT_ACCESSIBILITY_LABELS;
  const REGISTRATION_STATUS_LABELS = registrationStatusLabels || DEFAULT_REGISTRATION_STATUS_LABELS;
  const SCHOOL_GRADE_LABELS = schoolGradeLabels || DEFAULT_SCHOOL_GRADE_LABELS;
  const AGE_RANGE_LABELS = ageRangeLabels || DEFAULT_AGE_RANGE_LABELS;

  // Aliases for backward compatibility
  const PUBLIC_TYPE_MAP = PUBLIC_CATEGORY_LABELS;
  const ACCESSIBILITY_MAP = ACCESSIBILITY_LABELS;
  const router = useRouter();
  const { user } = useUser();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [details, setDetails] = useState<UserWithDetails | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  // Institution editing state
  const [editInstitutions, setEditInstitutions] = useState(false);
  const [savingInstitutions, setSavingInstitutions] = useState(false);
  const [institutionsDraft, setInstitutionsDraft] = useState<string[]>([]);
  const [availableInstitutions, setAvailableInstitutions] = useState<InstitutionWithCounts[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [institutionsLoaded, setInstitutionsLoaded] = useState(false);
  const [institutionNameQuery, setInstitutionNameQuery] = useState('');
  const [institutionCityQuery, setInstitutionCityQuery] = useState('');
  const [institutionPage, setInstitutionPage] = useState(0);
  const [selectedInstNames, setSelectedInstNames] = useState<Record<string, string>>({});
  // Preferences edition state
  const [editPrefs, setEditPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  // Group creation
  const [addingGroup, setAddingGroup] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState<{
    name?: string;
    category: string[];
    grades: SchoolGrade[];
    age_ranges: AgeRange[];
    students_count?: number;
    disabilities: Array<{ type: Accessibility; count: number; details?: string | null }>;
  }>({
    name: '',
    category: [],
    grades: [],
    age_ranges: [],
    students_count: undefined,
    disabilities: [],
  });
  const toggleArrayValue = (current: string[], value: string) =>
    current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupDraft, setEditGroupDraft] = useState<{
    name?: string;
    category: string[];
    grades: SchoolGrade[];
    age_ranges: AgeRange[];
    students_count?: number;
    disabilities: Array<{ type: Accessibility; count: number; details?: string | null }>;
  }>({
    name: '',
    category: [],
    grades: [],
    age_ranges: [],
    students_count: undefined,
    disabilities: [],
  });
  const [savingGroupEdit, setSavingGroupEdit] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  // Confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState<string | undefined>(undefined);
  const [confirmDescription, setConfirmDescription] = useState<string | undefined>(undefined);
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);
  // Change password modal state
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const startEditGroup = (c: GroupWithoutUserId) => {
    setEditingGroupId(c.id);
    setEditGroupDraft({
      name: c.name || '',
      category: [...c.category],
      grades: c.grades ? [...c.grades] : [],
      age_ranges: c.age_ranges ? [...c.age_ranges] : [],
      students_count: c.students_count,
      disabilities: c.disabilities ? [...c.disabilities] : [],
    });
  };
  const cancelEditGroup = () => {
    setEditingGroupId(null);
  };
  const saveEditGroup = async () => {
    if (!editingGroupId) return;
    setSavingGroupEdit(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/groups/${editingGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editGroupDraft.name,
          category: editGroupDraft.category,
          grades: editGroupDraft.grades,
          age_ranges: editGroupDraft.age_ranges,
          students_count: editGroupDraft.students_count,
          disabilities: editGroupDraft.disabilities,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = normalizeApiError(j, 'Échec mise à jour groupe.');
        setError(msg);
        toast(msg, 'error');
      } else if (details) {
        // refresh user groups
        const userRes = await fetchWithAuth(`/api/users/${details.id}`);
        const userJson = await userRes.json().catch(() => ({}));
        if (userRes.ok && userJson.user) setDetails(userJson.user);
        setEditingGroupId(null);
      }
    } catch {
      const msg = 'Erreur réseau lors de la mise à jour groupe.';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setSavingGroupEdit(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!details) return;
    setDeletingGroupId(groupId);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/groups/${groupId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(normalizeApiError(j, 'Échec suppression groupe.'));
      } else {
        // refresh user groups
        const userRes = await fetchWithAuth(`/api/users/${details.id}`);
        const userJson = await userRes.json().catch(() => ({}));
        if (userRes.ok && userJson.user) setDetails(userJson.user);
      }
    } catch {
      setError('Erreur réseau lors de la suppression groupe.');
    } finally {
      setDeletingGroupId(null);
    }
  };

  const requestDeleteGroup = (groupId: string) => {
    setConfirmTitle('Supprimer le groupe');
    setConfirmDescription('Êtes-vous sûr de vouloir supprimer ce groupe ?');
    setConfirmCallback(() => () => deleteGroup(groupId));
    setConfirmOpen(true);
  };

  // Local editable draft for user
  const [draft, setDraft] = useState<Partial<UserWithDetails>>({});
  // Local draft only for preferences (independent of identity)
  const [prefDraft, setPrefDraft] = useState<{
    email_notifications_enabled?: boolean;
    events_reminders_enabled?: boolean;
  }>({});

  const hasLoadedProfile = useRef(false); // Prevent multiple loads

  useEffect(() => {
    const load = async () => {
      // Prevent multiple calls
      if (!user || hasLoadedProfile.current) return;

      hasLoadedProfile.current = true;

      setLoading(true);
      setError(null);
      try {
        const userRes = await fetchWithAuth(`/api/users/${user.id || ''}`);
        if (!userRes.ok) {
          const j = await userRes.json().catch(() => ({}));
          const msg = normalizeApiError(j, 'Impossible de charger votre profil.');
          setError(msg);
          try {
            toast(msg, 'error');
          } catch {}
          setLoading(false);
          return;
        }
        const userJson = await userRes.json();
        setDetails(userJson.user);
        setDraft(userJson.user);
        setPrefDraft({
          email_notifications_enabled: userJson.user.email_notifications_enabled,
          events_reminders_enabled: userJson.user.events_reminders_enabled,
        });

        // Load institutions if user has userInstitutions
        if (userJson.user?.userInstitutions && userJson.user.userInstitutions.length > 0) {
          const institutionPromises = userJson.user.userInstitutions.map(
            async (ui: { institution: { id: string } }) => {
              const instRes = await fetchWithAuth(`/api/institutions/${ui.institution.id}`);
              if (instRes.ok) {
                const instJson = await instRes.json().catch(() => ({}));
                return instJson.institution;
              }
              return null;
            },
          );
          const loadedInstitutions = (await Promise.all(institutionPromises)).filter(Boolean);
          setInstitutions(loadedInstitutions);
        }
      } catch {
        setError(normalizeApiError(null, 'Erreur réseau. Vérifiez votre connexion.'));
      } finally {
        setLoading(false);
      }
    };
    load();

    // Reset flag when user changes (logout/login)
    return () => {
      if (!user) {
        hasLoadedProfile.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Depend only on user ID, not the entire object

  const initials = details
    ? `${details.first_name?.[0] || ''}${details.last_name?.[0] || ''}`.toUpperCase()
    : '';

  // Memoized filtered and paginated institutions
  const { filteredInstitutions, paginatedInstitutions, totalPages } = useMemo(() => {
    // Institutions are already filtered by the API, no need for client-side filtering
    const total = Math.ceil(availableInstitutions.length / INSTITUTIONS_PER_PAGE);
    const paginated = availableInstitutions.slice(
      institutionPage * INSTITUTIONS_PER_PAGE,
      (institutionPage + 1) * INSTITUTIONS_PER_PAGE,
    );
    return {
      filteredInstitutions: availableInstitutions,
      paginatedInstitutions: paginated,
      totalPages: total,
    };
  }, [availableInstitutions, institutionPage]);

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

  const handleField =
    (field: keyof UserWithDetails) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setDraft((d: Partial<UserWithDetails>) => ({
        ...d,
        [field]:
          e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value,
      }));
    };

  // Toggle specific to preferences when editing only those
  const togglePrefField = (field: keyof typeof prefDraft) => () => {
    setPrefDraft((d) => ({ ...d, [field]: !d[field] }));
  };

  const saveChanges = async () => {
    if (!details) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/users/${details.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: draft.first_name,
          last_name: draft.last_name,
          phone_number: draft.phone_number,
          email_notifications_enabled: draft.email_notifications_enabled,
          events_reminders_enabled: draft.events_reminders_enabled,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg = normalizeApiError(j, 'Échec de la sauvegarde.');
        setError(msg);
        toast(msg, 'error');
        return;
      }
      const j = await res.json();
      setDetails(j.user);
      setDraft(j.user);
      setEditMode(false);
      try {
        toast('Modifications enregistrées', 'success');
      } catch {}
    } catch {
      const msg = 'Erreur réseau lors de la sauvegarde.';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save institutions
  const saveInstitutionsChanges = async () => {
    if (!details) return;
    setSavingInstitutions(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/users/${details.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_ids: institutionsDraft,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg = normalizeApiError(j, 'Échec de la sauvegarde des établissements.');
        setError(msg);
        toast(msg, 'error');
        return;
      }
      const j = await res.json();
      setDetails(j.user);

      // Reload institutions
      if (j.user?.userInstitutions && j.user.userInstitutions.length > 0) {
        const institutionPromises = j.user.userInstitutions.map(
          async (ui: { institution: { id: string } }) => {
            const instRes = await fetchWithAuth(`/api/institutions/${ui.institution.id}`);
            if (instRes.ok) {
              const instJson = await instRes.json().catch(() => ({}));
              return instJson.institution;
            }
            return null;
          },
        );
        const loadedInstitutions = (await Promise.all(institutionPromises)).filter(Boolean);
        setInstitutions(loadedInstitutions);
      } else {
        setInstitutions([]);
      }

      setEditInstitutions(false);
      try {
        toast('Établissements mis à jour', 'success');
      } catch {}
    } catch {
      const msg = 'Erreur réseau lors de la sauvegarde des établissements.';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setSavingInstitutions(false);
    }
  };

  // Load available institutions for editing via search API
  const loadAvailableInstitutions = async (nameQuery: string = '', cityQuery: string = '') => {
    // Minimum 2 characters required for name search
    if (nameQuery.length < 2) {
      setAvailableInstitutions([]);
      setInstitutionsLoaded(false);
      return;
    }

    setLoadingInstitutions(true);
    try {
      const params = new URLSearchParams({
        name: nameQuery,
        limit: '20',
      });

      // Add city if provided (optional)
      if (cityQuery.trim().length >= 2) {
        params.append('city', cityQuery);
      }

      const res = await fetch(`/api/institutions/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableInstitutions(data.institutions || []);
        setInstitutionsLoaded(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Erreur lors du chargement des établissements disponibles.');
      }
    } catch {
      setError('Erreur lors du chargement des établissements disponibles.');
    } finally {
      setLoadingInstitutions(false);
    }
  };

  // Independent preferences save
  const savePrefChanges = async () => {
    if (!details) return;
    setSavingPrefs(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/users/${details.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_notifications_enabled: prefDraft.email_notifications_enabled,
          events_reminders_enabled: prefDraft.events_reminders_enabled,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg = normalizeApiError(j, 'Échec de la sauvegarde des préférences.');
        setError(msg);
        toast(msg, 'error');
        return;
      }
      const j = await res.json();
      setDetails(j.user);
      setDraft(j.user); // keep consistent
      setPrefDraft({
        email_notifications_enabled: j.user.email_notifications_enabled,
        events_reminders_enabled: j.user.events_reminders_enabled,
      });
      setEditPrefs(false);
      try {
        toast('Préférences enregistrées', 'success');
      } catch {}
    } catch {
      const msg = 'Erreur réseau lors de la sauvegarde des préférences.';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  const deleteAccount = async () => {
    setDeletingAccount(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/users/me', { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = normalizeApiError(j, 'Échec suppression compte.');
        setError(msg);
        toast(msg, 'error');
        return;
      }
      try {
        toast('Compte supprimé. À bientôt.', 'success');
      } catch {}

      // After deleting, attempt to logout client-side and redirect to home
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {}
      // Navigate to home to clear client state
      router.push('/');
    } catch {
      const msg = 'Erreur réseau lors de la suppression du compte.';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setDeletingAccount(false);
      window.location.reload();
    }
  };

  const requestDeleteAccount = () => {
    setConfirmTitle('Supprimer le compte');
    setConfirmDescription(
      'Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible.',
    );
    setConfirmCallback(() => () => deleteAccount());
    setConfirmOpen(true);
  };

  return (
    <main className="p-4 sm:p-6">
      <header className="mb-6 sm:mb-8 flex flex-col gap-4 sm:gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">
            Mon compte
          </h1>
          <p className="mt-2 text-gray-600 font-ibm text-sm md:text-base">
            Vue d’ensemble de votre identité, établissement, préférences et activités.
          </p>
        </div>
        {details && (
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-black text-white flex items-center justify-center font-poppins text-lg sm:text-xl shadow-sm">
                {initials || <span className="opacity-60">—</span>}
              </div>
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider bg-white px-2 py-0.5 rounded-full border border-black/10 text-gray-700 shadow-sm whitespace-nowrap">
                {details.role}
              </span>
            </div>
            <div className="font-ibm text-xs sm:text-sm text-gray-600 leading-tight hidden sm:block">
              <p className="font-medium text-gray-900">
                {details.first_name} {details.last_name}
              </p>
              <p className="text-gray-500 break-all">{details.email}</p>
            </div>
          </div>
        )}
      </header>

      {/* Quick stats bar */}
      {details && (
        <div className="grid gap-3 sm:gap-4 mb-8 sm:mb-10 sm:grid-cols-2 xl:grid-cols-3">
          <div className="bg-white border border-black/10 shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4 flex flex-col gap-1">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-gray-500 font-medium">
              Rôle
            </p>
            <p className="font-poppins font-semibold text-base sm:text-lg">{details.role}</p>
            <p className="text-[11px] sm:text-xs text-gray-500">Permissions associées</p>
          </div>
          {institutions && institutions.length > 0 && (
            <div className="bg-white border border-black/10 shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4 flex flex-col gap-1">
              <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-gray-500 font-medium">
                Établissement{institutions.length > 1 ? 's' : ''}
              </p>
              {institutions.map((inst) => (
                <div key={inst.id} className="mb-2 last:mb-0">
                  <p
                    className="font-poppins font-semibold text-base sm:text-lg truncate max-w-45 sm:max-w-[320px] md:max-w-105"
                    title={inst.name}
                    aria-label={inst.name}
                  >
                    {inst.name}
                  </p>
                  {inst._count && (
                    <p className="text-[11px] sm:text-xs text-gray-500">
                      {inst._count.userInstitutions} utilisateurs • {inst._count.registrations}{' '}
                      demande(s) d&apos;inscription
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="bg-white border border-black/10 shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4 flex flex-col gap-1">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-gray-500 font-medium">
              Dernière activité
            </p>
            <p className="font-poppins font-semibold text-base sm:text-lg">
              {new Date(details.updated_at).toLocaleDateString('fr-FR')}
            </p>
            <p className="text-[11px] sm:text-xs text-gray-500">Profil mis à jour</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 font-ibm">
          {error}
        </div>
      ) : details ? (
        <div className="space-y-6 sm:space-y-8 lg:space-y-10">
          <div className="grid xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {/* Identity */}
            <Card
              title="Identité"
              className="xl:col-span-1"
              actions={
                details && (
                  <div className="flex items-center gap-2">
                    {!editMode && (
                      <button
                        onClick={() => {
                          setEditMode(true);
                          setDraft(details);
                        }}
                        className="text-xs font-poppins font-semibold border border-blue-300 text-blue-600 px-2 py-1 hover:bg-blue-50 cursor-pointer transition-colors"
                        type="button"
                      >
                        Modifier
                      </button>
                    )}
                    {editMode && (
                      <>
                        <button
                          onClick={() => {
                            setEditMode(false);
                            setDraft(details);
                          }}
                          type="button"
                          className="text-xs font-poppins font-semibold border border-gray-300 px-2 py-1 hover:bg-gray-100 cursor-pointer transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          disabled={saving}
                          onClick={saveChanges}
                          type="button"
                          className="text-xs font-poppins font-semibold border border-emerald-300 px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer transition-colors"
                        >
                          {saving ? '...' : 'Enregistrer'}
                        </button>
                      </>
                    )}
                  </div>
                )
              }
            >
              <dl className="space-y-4 sm:space-y-5 font-ibm text-xs sm:text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                  <dt className="text-gray-500">Nom complet</dt>
                  <dd className="col-span-2 font-medium text-gray-900 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    {editMode ? (
                      <>
                        <input
                          value={draft.first_name || ''}
                          onChange={handleField('first_name')}
                          className="border border-gray-300 px-2 py-1 text-sm w-full sm:w-1/2 focus:outline-none focus:ring-2 focus:ring-black/40"
                          placeholder="Prénom"
                        />
                        <input
                          value={draft.last_name || ''}
                          onChange={handleField('last_name')}
                          className="border border-gray-300 px-2 py-1 text-sm w-full sm:w-1/2 focus:outline-none focus:ring-2 focus:ring-black/40"
                          placeholder="Nom"
                        />
                      </>
                    ) : (
                      <span>
                        {details.first_name} {details.last_name}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-gray-500">Adresse email</dt>
                  <dd className="col-span-2 font-medium text-gray-900 wrap-break-word">
                    {details.email}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-gray-500">Téléphone</dt>
                  <dd className="col-span-2 font-medium text-gray-900">
                    {editMode ? (
                      <input
                        value={draft.phone_number || ''}
                        onChange={handleField('phone_number')}
                        className="border border-gray-300 px-2 py-1 text-sm w-full sm:max-w-xs focus:outline-none focus:ring-2 focus:ring-black/40"
                        placeholder="Téléphone"
                      />
                    ) : (
                      details.phone_number || '—'
                    )}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <dt className="text-gray-500">Rôle</dt>
                  <dd className="col-span-2 font-medium text-gray-900">
                    <span className="inline-block border border-black/20 px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
                      {details.role}
                    </span>
                  </dd>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setChangePasswordOpen(true)}
                    className="font-poppins font-semibold text-black hover:underline text-base cursor-pointer"
                  >
                    Changer mon mot de passe
                  </button>
                </div>
              </dl>
            </Card>

            {/* Institutions */}
            <Card
              title={`Établissement(s)`}
              className="xl:col-span-2"
              actions={
                <div className="flex items-center gap-3 flex-wrap">
                  {!editInstitutions && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditInstitutions(true);
                        const initialIds =
                          details.userInstitutions?.map((ui) => ui.institution.id) || [];
                        setInstitutionsDraft(initialIds);
                        setInstitutionNameQuery('');
                        setInstitutionCityQuery('');
                        setInstitutionPage(0);
                        // Initialize names from current institutions
                        const names: Record<string, string> = {};
                        institutions.forEach((inst) => {
                          names[inst.id] = inst.name;
                        });
                        setSelectedInstNames(names);
                      }}
                      className="text-xs font-poppins font-semibold border border-blue-300 text-blue-600 px-2 py-1 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      Modifier
                    </button>
                  )}
                  {editInstitutions && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditInstitutions(false);
                          setInstitutionsDraft([]);
                          setInstitutionNameQuery('');
                          setInstitutionCityQuery('');
                          setInstitutionPage(0);
                        }}
                        className="text-xs font-poppins font-semibold border border-gray-300 px-2 py-1 hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={saveInstitutionsChanges}
                        className="text-xs font-poppins font-semibold border border-emerald-300 px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer transition-colors"
                      >
                        {savingInstitutions ? '...' : 'Enregistrer'}
                      </button>
                    </>
                  )}
                </div>
              }
            >
              <div className="space-y-4">
                {!editInstitutions ? (
                  <>
                    {institutions.length === 0 ? (
                      <p className="text-gray-500 font-ibm text-sm">
                        Aucun établissement associé à votre compte.
                      </p>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {institutions.map((inst) => (
                          <div
                            key={inst.id}
                            className="border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="font-poppins font-semibold text-base sm:text-lg truncate max-w-45 sm:max-w-[320px] md:max-w-105">
                                {inst.name}
                              </h3>
                              {inst.type && inst.type.length > 0 && (
                                <div className="relative group/tooltip shrink-0">
                                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium tracking-wide whitespace-nowrap cursor-help">
                                    {PUBLIC_TYPE_MAP[inst.type[0]] || inst.type[0]}
                                    {inst.type.length > 1 && ` +${inst.type.length - 1}`}
                                  </span>
                                  {inst.type.length > 1 && (
                                    <div className="absolute right-0 top-full mt-1 z-50 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-150 pointer-events-none">
                                      <div className="bg-gray-900 text-white text-[10px] px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                                        <p className="font-medium mb-1 text-gray-300">
                                          Types d&apos;établissement :
                                        </p>
                                        <ul className="space-y-0.5">
                                          {inst.type.map((t, idx) => (
                                            <li key={idx}>• {PUBLIC_TYPE_MAP[t] || t}</li>
                                          ))}
                                        </ul>
                                        <div className="absolute -top-1 right-3 w-2 h-2 bg-gray-900 rotate-45" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 font-ibm space-y-1">
                              {inst.address && (
                                <p>
                                  {inst.address.street}, {inst.address.zip_code} {inst.address.city}
                                </p>
                              )}
                              {inst.email && <p>📧 {inst.email}</p>}
                              {inst.phone_number && <p>📞 {inst.phone_number}</p>}
                              {inst._count && (
                                <p className="text-gray-500 mt-2">
                                  {inst._count.userInstitutions} utilisateur
                                  {(inst._count.userInstitutions || 0) !== 1 ? 's' : ''} ·{' '}
                                  {inst._count.registrations} inscription
                                  {(inst._count.registrations || 0) !== 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-3">
                    {/* Selected institutions display with remove buttons */}
                    {institutionsDraft.length > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-poppins font-semibold text-blue-900">
                            Établissement(s) sélectionné(s)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setInstitutionsDraft([]);
                              setSelectedInstNames({});
                            }}
                            className="text-xs text-red-600 hover:text-red-800 underline"
                          >
                            Tout retirer
                          </button>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {institutionsDraft.map((id) => (
                            <div
                              key={id}
                              className="flex items-center justify-between bg-white px-2 py-1 border border-blue-300"
                            >
                              <span className="text-xs font-ibm truncate flex-1">
                                {selectedInstNames[id] || 'Chargement...'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setInstitutionsDraft((prev) => prev.filter((i) => i !== id));
                                  setSelectedInstNames((prev) => {
                                    const newNames = { ...prev };
                                    delete newNames[id];
                                    return newNames;
                                  });
                                }}
                                className="ml-2 text-red-600 hover:text-red-800"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-sm text-gray-600 font-ibm">
                      Sélectionnez un ou plusieurs établissements :
                    </p>

                    {/* Search bars */}
                    <div className="space-y-3">
                      {/* Name search */}
                      <div className="relative">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Nom de l&apos;établissement <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Jean Jaurès, Victor Hugo..."
                          value={institutionNameQuery}
                          onChange={(e) => {
                            const value = e.target.value;
                            setInstitutionNameQuery(value);
                            setInstitutionPage(0);
                            // Load institutions dynamically
                            if (value.length >= 2) {
                              loadAvailableInstitutions(value, institutionCityQuery);
                            } else {
                              setAvailableInstitutions([]);
                              setInstitutionsLoaded(false);
                            }
                          }}
                          className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/40 font-ibm"
                        />
                        {institutionNameQuery && (
                          <button
                            onClick={() => {
                              setInstitutionNameQuery('');
                              setInstitutionPage(0);
                              setAvailableInstitutions([]);
                              setInstitutionsLoaded(false);
                            }}
                            className="absolute right-2 top-8.5 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* City search */}
                      <div className="relative">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Ville ou code postal <span className="text-gray-400">(optionnel)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Montpellier, 34000..."
                          value={institutionCityQuery}
                          onChange={(e) => {
                            const value = e.target.value;
                            setInstitutionCityQuery(value);
                            setInstitutionPage(0);
                            // Reload if name is already filled
                            if (institutionNameQuery.length >= 2) {
                              loadAvailableInstitutions(institutionNameQuery, value);
                            }
                          }}
                          className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/40 font-ibm"
                        />
                        {institutionCityQuery && (
                          <button
                            onClick={() => {
                              setInstitutionCityQuery('');
                              setInstitutionPage(0);
                              // Reload without city filter
                              if (institutionNameQuery.length >= 2) {
                                loadAvailableInstitutions(institutionNameQuery, '');
                              }
                            }}
                            className="absolute right-2 top-8.5 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {loadingInstitutions ? (
                      <div className="flex justify-center py-4">
                        <Loader />
                      </div>
                    ) : !institutionsLoaded ? (
                      <div className="border border-gray-200 rounded p-8 text-center">
                        <p className="text-gray-500 font-ibm text-sm">
                          Commencez à taper pour rechercher un établissement
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="border border-gray-200 rounded">
                          {paginatedInstitutions.length > 0 ? (
                            paginatedInstitutions.map((inst) => (
                              <label
                                key={inst.id}
                                className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <input
                                  type="checkbox"
                                  checked={institutionsDraft.includes(inst.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setInstitutionsDraft([...institutionsDraft, inst.id]);
                                      setSelectedInstNames((prev) => ({
                                        ...prev,
                                        [inst.id]: inst.name,
                                      }));
                                    } else {
                                      setInstitutionsDraft(
                                        institutionsDraft.filter((id) => id !== inst.id),
                                      );
                                      setSelectedInstNames((prev) => {
                                        const newNames = { ...prev };
                                        delete newNames[inst.id];
                                        return newNames;
                                      });
                                    }
                                  }}
                                  className="w-4 h-4"
                                />
                                <div className="flex-1">
                                  <div className="font-poppins font-medium text-sm">
                                    {inst.name}
                                  </div>
                                  {inst.address && (
                                    <div className="text-xs text-gray-500">
                                      {inst.address.city} ({inst.address.zip_code})
                                    </div>
                                  )}
                                </div>
                                {inst.type && inst.type.length > 0 && (
                                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">
                                    {PUBLIC_TYPE_MAP[inst.type[0]] || inst.type[0]}
                                  </span>
                                )}
                              </label>
                            ))
                          ) : (
                            <div className="p-4 text-center text-gray-500 font-ibm text-sm">
                              Aucun établissement trouvé
                            </div>
                          )}
                        </div>

                        {/* Pagination controls */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => setInstitutionPage((p) => Math.max(0, p - 1))}
                              disabled={institutionPage === 0}
                              className="text-xs font-poppins font-semibold border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              ← Précédent
                            </button>
                            <span className="text-xs text-gray-600 font-ibm">
                              Page {institutionPage + 1} sur {totalPages} (
                              {filteredInstitutions.length} établissement
                              {filteredInstitutions.length !== 1 ? 's' : ''})
                            </span>
                            <button
                              onClick={() =>
                                setInstitutionPage((p) => Math.min(totalPages - 1, p + 1))
                              }
                              disabled={institutionPage >= totalPages - 1}
                              className="text-xs font-poppins font-semibold border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Suivant →
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    <p className="text-xs text-gray-500 font-ibm">
                      {institutionsDraft.length} établissement
                      {institutionsDraft.length !== 1 ? 's' : ''} sélectionné
                      {institutionsDraft.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
                {details.role === 'ADMIN' && !editInstitutions && (
                  <p className="text-xs text-gray-500 font-ibm mt-4 pt-4 border-t border-gray-200">
                    💡 Vous pouvez également gérer les établissements depuis la{' '}
                    <Link href="/admin/users" className="underline hover:text-black">
                      page d&apos;administration des utilisateurs
                    </Link>
                    .
                  </p>
                )}
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            {/* Preferences */}
            <Card
              title="Préférences"
              actions={
                <div className="flex items-center gap-3 flex-wrap">
                  {!editPrefs && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditPrefs(true);
                        setPrefDraft({
                          email_notifications_enabled: details.email_notifications_enabled,
                          events_reminders_enabled: details.events_reminders_enabled,
                        });
                      }}
                      className="text-xs font-poppins font-semibold border border-blue-300 text-blue-600 px-2 py-1 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      Modifier
                    </button>
                  )}
                  {editPrefs && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditPrefs(false);
                          setPrefDraft({
                            email_notifications_enabled: details.email_notifications_enabled,
                            events_reminders_enabled: details.events_reminders_enabled,
                          });
                        }}
                        className="text-xs font-poppins font-semibold border border-gray-300 px-2 py-1 hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        disabled={savingPrefs}
                        onClick={savePrefChanges}
                        className="text-xs font-poppins font-semibold border border-emerald-300 px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer transition-colors"
                      >
                        {savingPrefs ? '...' : 'Enregistrer'}
                      </button>
                    </>
                  )}
                </div>
              }
            >
              <dl className="space-y-5 font-ibm">
                <div className="flex flex-col gap-1 text-sm">
                  <dt className="text-gray-500">Notifications email</dt>
                  <dd className="font-medium text-gray-900">
                    {editPrefs ? (
                      <button
                        type="button"
                        aria-pressed={!!prefDraft.email_notifications_enabled}
                        onClick={togglePrefField('email_notifications_enabled')}
                        className="group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-black/50 rounded-full"
                      >
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium tracking-wide border cursor-pointer ${prefDraft.email_notifications_enabled ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-200 text-gray-700 border-gray-300 group-hover:bg-gray-300'}`}
                        >
                          {' '}
                          {prefDraft.email_notifications_enabled ? 'Activées' : 'Désactivées'}{' '}
                        </span>
                      </button>
                    ) : (
                      <StatBadge
                        active={details.email_notifications_enabled}
                        label={details.email_notifications_enabled ? 'Activées' : 'Désactivées'}
                      />
                    )}
                  </dd>
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <dt className="text-gray-500">Rappels d&apos;événements</dt>
                  <dd className="font-medium text-gray-900">
                    {editPrefs ? (
                      <button
                        type="button"
                        aria-pressed={!!prefDraft.events_reminders_enabled}
                        onClick={togglePrefField('events_reminders_enabled')}
                        className="group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-black/50 rounded-full"
                      >
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium tracking-wide border cursor-pointer ${prefDraft.events_reminders_enabled ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-200 text-gray-700 border-gray-300 group-hover:bg-gray-300'}`}
                        >
                          {' '}
                          {prefDraft.events_reminders_enabled ? 'Activés' : 'Désactivés'}{' '}
                        </span>
                      </button>
                    ) : (
                      <StatBadge
                        active={details.events_reminders_enabled}
                        label={details.events_reminders_enabled ? 'Activés' : 'Désactivés'}
                      />
                    )}
                  </dd>
                </div>
              </dl>
            </Card>

            {/* Dates */}
            <Card title="Historique de création">
              <dl className="grid sm:grid-cols-2 gap-6 font-ibm text-sm">
                <div className="space-y-1">
                  <dt className="text-gray-500">Créé le</dt>
                  <dd className="font-medium text-gray-900">
                    {new Date(details.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-gray-500">Dernière mise à jour</dt>
                  <dd className="font-medium text-gray-900">
                    {new Date(details.updated_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          {/* Groups */}
          <Card
            title={`Groupes (${details.groups?.length || 0})`}
            className=""
            actions={
              <div className="flex items-center gap-2">
                {!addingGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingGroup(true);
                      setNewGroup({
                        name: '',
                        category: [],
                        grades: [],
                        age_ranges: [],
                        students_count: undefined,
                        disabilities: [],
                      });
                    }}
                    className="text-xs font-poppins font-semibold border border-black px-2 py-1 hover:bg-black hover:text-white cursor-pointer"
                  >
                    Ajouter
                  </button>
                )}
                {addingGroup && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingGroup(false);
                      }}
                      className="text-xs font-poppins font-semibold border border-gray-300 px-2 py-1 hover:bg-gray-100 cursor-pointer"
                    >
                      Annuler
                    </button>
                  </>
                )}
              </div>
            }
          >
            {addingGroup && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!details) return;
                  setCreatingGroup(true);
                  setError(null);
                  try {
                    const res = await fetchWithAuth(`/api/users/${details.id}/groups`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: newGroup.name,
                        category: newGroup.category,
                        grades: newGroup.grades,
                        age_ranges: newGroup.age_ranges,
                        students_count: newGroup.students_count,
                        disabilities: newGroup.disabilities,
                      }),
                    });
                    const j = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      const msg = normalizeApiError(j, 'Création de groupe impossible.');
                      setError(msg);
                      toast(msg, 'error');
                    } else {
                      // Refresh user
                      const userRes = await fetchWithAuth(`/api/users/${details.id}`);
                      const userJson = await userRes.json().catch(() => ({}));
                      if (userRes.ok && userJson.user) {
                        setDetails(userJson.user);
                      }
                      setAddingGroup(false);
                      try {
                        toast('Groupe créé', 'success');
                      } catch {}
                    }
                  } catch {
                    const msg = 'Erreur réseau lors de la création du groupe.';
                    setError(msg);
                    toast(msg, 'error');
                  } finally {
                    setCreatingGroup(false);
                  }
                }}
                className="mb-8 border border-dashed border-gray-300 p-4 bg-gray-50 space-y-4"
              >
                {/* Nom du groupe */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-600">
                    Nom du groupe <span className="text-gray-400">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={newGroup.name || ''}
                    onChange={(e) => setNewGroup((c) => ({ ...c, name: e.target.value }))}
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/40 font-ibm"
                    placeholder="Ex: CM2 A, 6ème B, Groupe adultes..."
                  />
                  <p className="text-[10px] text-gray-400">
                    Un nom pour identifier facilement ce groupe.
                  </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-600">
                      Types de public (sélection multiple)
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-56 overflow-auto pr-1 border border-gray-200 p-2 bg-white">
                      {Object.values(PublicCategory).map((opt) => (
                        <button
                          type="button"
                          key={opt}
                          onClick={() =>
                            setNewGroup((c) => ({
                              ...c,
                              category: toggleArrayValue(c.category, opt) as PublicCategory[],
                            }))
                          }
                          className={`text-[11px] px-2 py-1 border rounded font-semibold tracking-wide uppercase ${newGroup.category.includes(opt) ? 'bg-black text-white border-black' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'}`}
                        >
                          {PUBLIC_TYPE_MAP[opt] || opt.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400">Cliquer pour (dé)sélectionner.</p>
                  </div>
                </div>

                {/* Grades - School grades selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-600">
                    Niveaux scolaires <span className="text-gray-400">(optionnel)</span>
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-auto pr-1 border border-gray-200 p-2 bg-white">
                    {Object.values(SchoolGrade).map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() =>
                          setNewGroup((c) => ({
                            ...c,
                            grades: c.grades.includes(opt)
                              ? c.grades.filter((g) => g !== opt)
                              : [...c.grades, opt],
                          }))
                        }
                        className={`text-[10px] px-2 py-1 border rounded font-medium tracking-wide ${newGroup.grades.includes(opt) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'}`}
                      >
                        {SCHOOL_GRADE_LABELS[opt] || opt}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Pour les établissements scolaires uniquement
                  </p>
                </div>

                {/* Age ranges - Age ranges selection */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-600">
                    Tranches d&apos;âge <span className="text-gray-400">(optionnel)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-auto pr-1 border border-gray-200 p-2 bg-white">
                    {Object.values(AgeRange).map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() =>
                          setNewGroup((c) => ({
                            ...c,
                            age_ranges: c.age_ranges.includes(opt)
                              ? c.age_ranges.filter((a) => a !== opt)
                              : [...c.age_ranges, opt],
                          }))
                        }
                        className={`text-[10px] px-2 py-1 border rounded font-medium tracking-wide ${newGroup.age_ranges.includes(opt) ? 'bg-teal-600 text-white border-teal-600' : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'}`}
                      >
                        {AGE_RANGE_LABELS[opt] || opt.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Pour les accueils collectifs, associations, etc.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-600">Effectif</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNewGroup((c) => ({
                          ...c,
                          students_count: Math.max(0, (c.students_count || 0) - 1),
                        }))
                      }
                      className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      required
                      value={newGroup.students_count === undefined ? '' : newGroup.students_count}
                      onChange={(e) =>
                        setNewGroup((c) => ({
                          ...c,
                          students_count:
                            e.target.value === '' ? undefined : Number(e.target.value),
                        }))
                      }
                      className="flex-1 text-center p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm font-medium"
                      placeholder="Ex: 25"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setNewGroup((c) => ({
                          ...c,
                          students_count: (c.students_count || 0) + 1,
                        }))
                      }
                      className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400">Nombre total d&apos;élèves.</p>
                </div>

                {/* Section besoins spécifiques */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-600">
                    Besoins spécifiques (optionnel, inclus dans l&apos;effectif)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(Object.values(Accessibility) as Accessibility[]).map((accessType) => {
                      const currentCount =
                        newGroup.disabilities.find((d) => d.type === accessType)?.count || 0;
                      return (
                        <div
                          key={accessType}
                          className="bg-gray-50 border border-gray-300 p-3 rounded-none"
                        >
                          <label className="block text-xs text-gray-600 mb-2 font-ibm font-medium">
                            {ACCESSIBILITY_MAP[accessType]}
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const count = Math.max(0, currentCount - 1);
                                setNewGroup((c) => {
                                  const existingIndex = c.disabilities.findIndex(
                                    (d) => d.type === accessType,
                                  );
                                  if (count === 0) {
                                    return {
                                      ...c,
                                      disabilities: c.disabilities.filter(
                                        (d) => d.type !== accessType,
                                      ),
                                    };
                                  } else if (existingIndex >= 0) {
                                    const newDisabilities = [...c.disabilities];
                                    newDisabilities[existingIndex] = {
                                      ...newDisabilities[existingIndex],
                                      count,
                                    };
                                    return { ...c, disabilities: newDisabilities };
                                  } else {
                                    return {
                                      ...c,
                                      disabilities: [
                                        ...c.disabilities,
                                        { type: accessType as Accessibility, count },
                                      ],
                                    };
                                  }
                                });
                              }}
                              className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={currentCount || ''}
                              onChange={(e) => {
                                const count = e.target.value === '' ? 0 : Number(e.target.value);
                                setNewGroup((c) => {
                                  const existingIndex = c.disabilities.findIndex(
                                    (d) => d.type === accessType,
                                  );
                                  if (count === 0) {
                                    return {
                                      ...c,
                                      disabilities: c.disabilities.filter(
                                        (d) => d.type !== accessType,
                                      ),
                                    };
                                  } else if (existingIndex >= 0) {
                                    const newDisabilities = [...c.disabilities];
                                    newDisabilities[existingIndex] = {
                                      ...newDisabilities[existingIndex],
                                      count,
                                    };
                                    return { ...c, disabilities: newDisabilities };
                                  } else {
                                    return {
                                      ...c,
                                      disabilities: [
                                        ...c.disabilities,
                                        { type: accessType as Accessibility, count },
                                      ],
                                    };
                                  }
                                });
                              }}
                              className="flex-1 text-center p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm font-medium"
                              placeholder="0"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const count = currentCount + 1;
                                setNewGroup((c) => {
                                  const existingIndex = c.disabilities.findIndex(
                                    (d) => d.type === accessType,
                                  );
                                  if (existingIndex >= 0) {
                                    const newDisabilities = [...c.disabilities];
                                    newDisabilities[existingIndex] = {
                                      ...newDisabilities[existingIndex],
                                      count,
                                    };
                                    return { ...c, disabilities: newDisabilities };
                                  } else {
                                    return {
                                      ...c,
                                      disabilities: [
                                        ...c.disabilities,
                                        { type: accessType as Accessibility, count },
                                      ],
                                    };
                                  }
                                });
                              }}
                              className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                            >
                              +
                            </button>
                          </div>
                          {/* Show details field for OTHER type when count > 0 */}
                          {accessType === 'OTHER' && currentCount > 0 && (
                            <input
                              type="text"
                              value={
                                newGroup.disabilities.find((d) => d.type === 'OTHER')?.details || ''
                              }
                              onChange={(e) => {
                                setNewGroup((c) => {
                                  const existingIndex = c.disabilities.findIndex(
                                    (d) => d.type === 'OTHER',
                                  );
                                  if (existingIndex >= 0) {
                                    const newDisabilities = [...c.disabilities];
                                    newDisabilities[existingIndex] = {
                                      ...newDisabilities[existingIndex],
                                      details: e.target.value,
                                    };
                                    return { ...c, disabilities: newDisabilities };
                                  }
                                  return c;
                                });
                              }}
                              placeholder="Précisez le type de besoin..."
                              className="w-full mt-2 p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Nombre d&apos;élèves par type de besoins spécifiques
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={
                      creatingGroup ||
                      newGroup.category.length === 0 ||
                      newGroup.students_count === undefined
                    }
                    className="text-xs font-poppins font-semibold border border-black px-3 py-1 bg-black text-white disabled:opacity-60"
                  >
                    {creatingGroup ? '...' : 'Créer le groupe'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingGroup(false)}
                    className="text-xs font-poppins font-semibold border border-gray-300 px-3 py-1 hover:bg-gray-100 cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}
            {details.groups && details.groups.length > 0 ? (
              <ul className="divide-y divide-gray-100 font-ibm text-sm">
                {details.groups.map((c) => {
                  const isEditing = editingGroupId === c.id;
                  return (
                    <li key={c.id} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          {!isEditing && (
                            <>
                              {c.name && (
                                <p className="font-poppins font-semibold text-base text-gray-900">
                                  {c.name}
                                </p>
                              )}
                              <p>
                                <span className="text-gray-500">Types de public:</span>{' '}
                                <span className="font-medium text-gray-900">
                                  {c.category
                                    .map((a) => PUBLIC_TYPE_MAP[a as PublicCategory] || a)
                                    .join(', ') || '—'}
                                </span>
                              </p>
                              {c.grades && c.grades.length > 0 && (
                                <p>
                                  <span className="text-gray-500">Niveaux scolaires:</span>{' '}
                                  <span className="font-medium text-gray-900">
                                    {c.grades.map((g) => SCHOOL_GRADE_LABELS[g] || g).join(', ')}
                                  </span>
                                </p>
                              )}
                              {c.age_ranges && c.age_ranges.length > 0 && (
                                <p>
                                  <span className="text-gray-500">Tranches d&apos;âge :</span>{' '}
                                  <span className="font-medium text-gray-900">
                                    {c.age_ranges.map((a) => AGE_RANGE_LABELS[a] || a).join(', ')}
                                  </span>
                                </p>
                              )}
                              {typeof c.students_count === 'number' && (
                                <p>
                                  <span className="text-gray-500">Effectif:</span>{' '}
                                  <span className="font-medium text-gray-900">
                                    {c.students_count}
                                  </span>
                                </p>
                              )}
                              {c.disabilities && c.disabilities.length > 0 && (
                                <p>
                                  <span className="text-gray-500">Besoins spécifiques:</span>{' '}
                                  <span className="font-medium text-gray-900">
                                    {c.disabilities
                                      .map((d) => {
                                        const label = `${d.count} ${ACCESSIBILITY_MAP[d.type] || d.type}`;
                                        return d.type === 'OTHER' && d.details
                                          ? `${label} (${d.details})`
                                          : label;
                                      })
                                      .join(', ')}
                                  </span>
                                </p>
                              )}
                            </>
                          )}
                          {isEditing && (
                            <div className="space-y-4">
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">
                                  Nom du groupe <span className="text-gray-400">(optionnel)</span>
                                </label>
                                <input
                                  type="text"
                                  value={editGroupDraft.name || ''}
                                  onChange={(e) =>
                                    setEditGroupDraft((d) => ({ ...d, name: e.target.value }))
                                  }
                                  className="w-full max-w-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/40 font-ibm"
                                  placeholder="Ex: CM2 A, 6ème B, Groupe adultes..."
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-2">
                                  Types de public
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-auto pr-1 border border-gray-200 p-2 bg-white">
                                  {Object.values(PublicCategory).map((opt) => (
                                    <button
                                      type="button"
                                      key={opt}
                                      onClick={() =>
                                        setEditGroupDraft((d) => ({
                                          ...d,
                                          category: toggleArrayValue(
                                            d.category,
                                            opt,
                                          ) as PublicCategory[],
                                        }))
                                      }
                                      className={`text-[10px] px-2 py-1 border rounded font-semibold tracking-wide uppercase ${editGroupDraft.category.includes(opt) ? 'bg-black text-white border-black' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'}`}
                                    >
                                      {PUBLIC_TYPE_MAP[opt] || opt.replace(/_/g, ' ')}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {/* Grades - School grades selection in edit mode */}
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-2">
                                  Niveaux scolaires{' '}
                                  <span className="text-gray-400">(optionnel)</span>
                                </label>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-40 overflow-auto pr-1 border border-gray-200 p-2 bg-white">
                                  {Object.values(SchoolGrade).map((opt) => (
                                    <button
                                      type="button"
                                      key={opt}
                                      onClick={() =>
                                        setEditGroupDraft((d) => ({
                                          ...d,
                                          grades: d.grades.includes(opt)
                                            ? d.grades.filter((g) => g !== opt)
                                            : [...d.grades, opt],
                                        }))
                                      }
                                      className={`text-[9px] px-2 py-1 border rounded font-medium tracking-wide ${editGroupDraft.grades.includes(opt) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'}`}
                                    >
                                      {SCHOOL_GRADE_LABELS[opt] || opt}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Age ranges - Age ranges selection in edit mode */}
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-2">
                                  Tranches d&apos;âge{' '}
                                  <span className="text-gray-400">(optionnel)</span>
                                </label>
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-40 overflow-auto pr-1 border border-gray-200 p-2 bg-white">
                                  {Object.values(AgeRange).map((opt) => (
                                    <button
                                      type="button"
                                      key={opt}
                                      onClick={() =>
                                        setEditGroupDraft((d) => ({
                                          ...d,
                                          age_ranges: d.age_ranges.includes(opt)
                                            ? d.age_ranges.filter((a) => a !== opt)
                                            : [...d.age_ranges, opt],
                                        }))
                                      }
                                      className={`text-[9px] px-2 py-1 border rounded font-medium tracking-wide ${editGroupDraft.age_ranges.includes(opt) ? 'bg-teal-600 text-white border-teal-600' : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'}`}
                                    >
                                      {AGE_RANGE_LABELS[opt] || opt.replace(/_/g, ' ')}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">
                                  Effectif
                                </label>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditGroupDraft((d) => ({
                                        ...d,
                                        students_count: Math.max(0, (d.students_count || 0) - 1),
                                      }))
                                    }
                                    className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    required
                                    value={
                                      editGroupDraft.students_count === undefined
                                        ? ''
                                        : editGroupDraft.students_count
                                    }
                                    onChange={(e) =>
                                      setEditGroupDraft((d) => ({
                                        ...d,
                                        students_count:
                                          e.target.value === ''
                                            ? undefined
                                            : Number(e.target.value),
                                      }))
                                    }
                                    className="flex-1 text-center border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-black/40 font-ibm font-medium"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditGroupDraft((d) => ({
                                        ...d,
                                        students_count: (d.students_count || 0) + 1,
                                      }))
                                    }
                                    className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Disabilities Section in edit mode */}
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-2">
                                  Besoins spécifiques (optionnel)
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {Object.values(Accessibility).map((accessType) => {
                                    const currentCount =
                                      editGroupDraft.disabilities.find((d) => d.type === accessType)
                                        ?.count || 0;
                                    return (
                                      <div
                                        key={accessType}
                                        className="bg-gray-50 border border-gray-300 p-3 rounded-none"
                                      >
                                        <label className="block text-xs text-gray-600 mb-2 font-ibm font-medium">
                                          {ACCESSIBILITY_MAP[accessType]}
                                        </label>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const count = Math.max(0, currentCount - 1);
                                              setEditGroupDraft((d) => {
                                                const existingIndex = d.disabilities.findIndex(
                                                  (dis) => dis.type === accessType,
                                                );
                                                if (count === 0) {
                                                  return {
                                                    ...d,
                                                    disabilities: d.disabilities.filter(
                                                      (dis) => dis.type !== accessType,
                                                    ),
                                                  };
                                                } else if (existingIndex >= 0) {
                                                  const newDisabilities = [...d.disabilities];
                                                  newDisabilities[existingIndex] = {
                                                    ...newDisabilities[existingIndex],
                                                    count,
                                                  };
                                                  return { ...d, disabilities: newDisabilities };
                                                } else {
                                                  return {
                                                    ...d,
                                                    disabilities: [
                                                      ...d.disabilities,
                                                      {
                                                        type: accessType as Accessibility,
                                                        count,
                                                      },
                                                    ],
                                                  };
                                                }
                                              });
                                            }}
                                            className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                                          >
                                            −
                                          </button>
                                          <input
                                            type="number"
                                            min={0}
                                            value={currentCount || ''}
                                            onChange={(e) => {
                                              const count =
                                                e.target.value === '' ? 0 : Number(e.target.value);
                                              setEditGroupDraft((d) => {
                                                const existingIndex = d.disabilities.findIndex(
                                                  (dis) => dis.type === accessType,
                                                );
                                                if (count === 0) {
                                                  return {
                                                    ...d,
                                                    disabilities: d.disabilities.filter(
                                                      (dis) => dis.type !== accessType,
                                                    ),
                                                  };
                                                } else if (existingIndex >= 0) {
                                                  const newDisabilities = [...d.disabilities];
                                                  newDisabilities[existingIndex] = {
                                                    ...newDisabilities[existingIndex],
                                                    count,
                                                  };
                                                  return { ...d, disabilities: newDisabilities };
                                                } else {
                                                  return {
                                                    ...d,
                                                    disabilities: [
                                                      ...d.disabilities,
                                                      {
                                                        type: accessType as Accessibility,
                                                        count,
                                                      },
                                                    ],
                                                  };
                                                }
                                              });
                                            }}
                                            className="flex-1 text-center p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm font-medium"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const count = currentCount + 1;
                                              setEditGroupDraft((d) => {
                                                const existingIndex = d.disabilities.findIndex(
                                                  (dis) => dis.type === accessType,
                                                );
                                                if (existingIndex >= 0) {
                                                  const newDisabilities = [...d.disabilities];
                                                  newDisabilities[existingIndex] = {
                                                    ...newDisabilities[existingIndex],
                                                    count,
                                                  };
                                                  return { ...d, disabilities: newDisabilities };
                                                } else {
                                                  return {
                                                    ...d,
                                                    disabilities: [
                                                      ...d.disabilities,
                                                      {
                                                        type: accessType as Accessibility,
                                                        count,
                                                      },
                                                    ],
                                                  };
                                                }
                                              });
                                            }}
                                            className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                                          >
                                            +
                                          </button>
                                        </div>
                                        {/* Show details field for OTHER type when count > 0 */}
                                        {accessType === 'OTHER' && currentCount > 0 && (
                                          <input
                                            type="text"
                                            value={
                                              editGroupDraft.disabilities.find(
                                                (d) => d.type === 'OTHER',
                                              )?.details || ''
                                            }
                                            onChange={(e) => {
                                              setEditGroupDraft((d) => {
                                                const existingIndex = d.disabilities.findIndex(
                                                  (dis) => dis.type === 'OTHER',
                                                );
                                                if (existingIndex >= 0) {
                                                  const newDisabilities = [...d.disabilities];
                                                  newDisabilities[existingIndex] = {
                                                    ...newDisabilities[existingIndex],
                                                    details: e.target.value,
                                                  };
                                                  return { ...d, disabilities: newDisabilities };
                                                }
                                                return d;
                                              });
                                            }}
                                            placeholder="Précisez le type de besoin..."
                                            className="w-full mt-2 p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm"
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-start gap-3 min-w-35">
                          <p className="text-xs text-gray-500">
                            Maj {new Date(c.updated_at).toLocaleDateString('fr-FR')}
                          </p>
                          {!isEditing && (
                            <div className="flex gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => startEditGroup(c)}
                                className="text-[11px] font-poppins font-semibold border border-blue-300 text-blue-600 px-2 py-1 hover:bg-blue-50 cursor-pointer transition-colors"
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                disabled={deletingGroupId === c.id}
                                onClick={() => requestDeleteGroup(c.id)}
                                className="text-[11px] font-poppins font-semibold border border-red-300 text-red-600 px-2 py-1 hover:bg-red-50 disabled:opacity-60 cursor-pointer transition-colors"
                              >
                                {deletingGroupId === c.id ? '...' : 'Supprimer'}
                              </button>
                            </div>
                          )}
                          {isEditing && (
                            <div className="flex gap-2 flex-wrap">
                              <button
                                type="button"
                                disabled={
                                  savingGroupEdit ||
                                  editGroupDraft.category.length === 0 ||
                                  editGroupDraft.students_count === undefined
                                }
                                onClick={saveEditGroup}
                                className="text-[11px] font-poppins font-semibold border border-emerald-300 px-2 py-1 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer transition-colors"
                              >
                                {savingGroupEdit ? '...' : 'Enregistrer'}
                              </button>
                              <button
                                type="button"
                                disabled={savingGroupEdit}
                                onClick={cancelEditGroup}
                                className="text-[11px] font-poppins font-semibold border border-gray-300 px-2 py-1 hover:bg-gray-100 cursor-pointer transition-colors"
                              >
                                Annuler
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {isEditing && (
                        <p className="text-[10px] text-gray-400">
                          Les âges seront recalculés automatiquement selon les niveaux sélectionnés.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 font-ibm">Aucun groupe défini.</p>
            )}
          </Card>

          {/* Demandes d'inscription actives */}
          <Card
            title={`Demandes d'inscription (${details.registrations?.filter((r) => r.event?.status !== 'ARCHIVED').length || 0})`}
            className=""
            actions={
              details.registrations &&
              details.registrations.filter((r) => r.event?.status !== 'ARCHIVED').length > 0 ? (
                <Link
                  href="/account/registrations"
                  className="text-xs font-poppins font-semibold border border-black px-2 py-1 hover:bg-black hover:text-white cursor-pointer inline-block whitespace-nowrap self-start"
                >
                  Voir toutes mes demandes
                </Link>
              ) : undefined
            }
          >
            {details.registrations &&
            details.registrations.filter((r) => r.event?.status !== 'ARCHIVED').length > 0 ? (
              <>
                {/* Vue tableau pour desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm font-ibm border-separate border-spacing-0">
                    <thead>
                      <tr className="text-left">
                        <th className="py-2 px-4 text-[11px] uppercase tracking-wide font-medium text-gray-500 bg-gray-50 border-b border-gray-200">
                          Événement
                        </th>
                        <th className="py-2 px-4 text-[11px] uppercase tracking-wide font-medium text-gray-500 bg-gray-50 border-b border-gray-200">
                          Date
                        </th>
                        <th className="py-2 px-4 text-[11px] uppercase tracking-wide font-medium text-gray-500 bg-gray-50 border-b border-gray-200">
                          Places
                        </th>
                        <th className="py-2 px-4 text-[11px] uppercase tracking-wide font-medium text-gray-500 bg-gray-50 border-b border-gray-200">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.registrations
                        .filter((r) => r.event?.status !== 'ARCHIVED')
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <td className="py-2 px-4">
                              <Link
                                href={r.event ? getEventUrl(r.event) : `/events/${r.event_id}`}
                                className="font-medium text-gray-900 hover:text-black hover:underline"
                              >
                                {r.event?.title || 'Événement inconnu'}
                              </Link>
                            </td>
                            <td className="py-2 px-4 whitespace-nowrap">
                              {new Date(r.date).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="py-2 px-4">{r.booked_seats}</td>
                            <td className="py-2 px-4">
                              <span
                                className={`inline-block text-[11px] font-semibold tracking-wide rounded-full border px-2 py-0.5 ${badgeColor(r.status)}`}
                              >
                                {statusMap[r.status] || r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Vue cards pour mobile */}
                <div className="md:hidden space-y-3">
                  {details.registrations
                    .filter((r) => r.event?.status !== 'ARCHIVED')
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((r) => (
                      <div
                        key={r.id}
                        className="border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <Link
                            href={r.event ? getEventUrl(r.event) : `/events/${r.event_id}`}
                            className="font-poppins font-semibold text-base text-gray-900 hover:text-black hover:underline flex-1"
                          >
                            {r.event?.title || 'Événement inconnu'}
                          </Link>
                          <span
                            className={`inline-block text-[10px] font-semibold tracking-wide rounded-full border px-2 py-0.5 whitespace-nowrap ${badgeColor(r.status)}`}
                          >
                            {statusMap[r.status] || r.status}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm font-ibm text-gray-600">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs">📅</span>
                            <span>{new Date(r.date).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-xs">👥</span>
                            <span>
                              {r.booked_seats} place{r.booked_seats > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 font-ibm">Aucune demande d&apos;inscription.</p>
            )}
          </Card>

          {/* Historique des inscriptions (événements archivés) */}
          {details.registrations &&
            details.registrations.filter((r) => r.event?.status === 'ARCHIVED').length > 0 && (
              <Card
                title={`Historique (${details.registrations.filter((r) => r.event?.status === 'ARCHIVED').length})`}
                className="bg-gray-50/50"
              >
                <p className="text-xs text-gray-500 font-ibm mb-3">
                  Inscriptions aux événements des saisons précédentes
                </p>
                {/* Vue tableau pour desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm font-ibm border-separate border-spacing-0">
                    <thead>
                      <tr className="text-left">
                        <th className="py-2 px-4 text-[11px] uppercase tracking-wide font-medium text-gray-500 bg-gray-100 border-b border-gray-200">
                          Événement
                        </th>
                        <th className="py-2 px-4 text-[11px] uppercase tracking-wide font-medium text-gray-500 bg-gray-100 border-b border-gray-200">
                          Date
                        </th>
                        <th className="py-2 px-4 text-[11px] uppercase tracking-wide font-medium text-gray-500 bg-gray-100 border-b border-gray-200">
                          Places
                        </th>
                        <th className="py-2 px-4 text-[11px] uppercase tracking-wide font-medium text-gray-500 bg-gray-100 border-b border-gray-200">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.registrations
                        .filter((r) => r.event?.status === 'ARCHIVED')
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-gray-100 hover:bg-gray-100 transition-colors"
                          >
                            <td className="py-2 px-4">
                              <Link
                                href={r.event ? getEventUrl(r.event) : `/events/${r.event_id}`}
                                className="font-medium text-gray-600 hover:text-gray-900 hover:underline"
                              >
                                {r.event?.title || 'Événement inconnu'}
                              </Link>
                            </td>
                            <td className="py-2 px-4 whitespace-nowrap text-gray-600">
                              {new Date(r.date).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="py-2 px-4 text-gray-600">{r.booked_seats}</td>
                            <td className="py-2 px-4">
                              <span
                                className={`inline-block text-[11px] font-semibold tracking-wide rounded-full border px-2 py-0.5 ${badgeColor(r.status)}`}
                              >
                                {statusMap[r.status] || r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Vue cards pour mobile */}
                <div className="md:hidden space-y-3">
                  {details.registrations
                    .filter((r) => r.event?.status === 'ARCHIVED')
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((r) => (
                      <div
                        key={r.id}
                        className="border border-gray-200 bg-white p-4 hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <Link
                            href={r.event ? getEventUrl(r.event) : `/events/${r.event_id}`}
                            className="font-poppins font-semibold text-base text-gray-600 hover:text-gray-900 hover:underline flex-1"
                          >
                            {r.event?.title || 'Événement inconnu'}
                          </Link>
                          <span
                            className={`inline-block text-[10px] font-semibold tracking-wide rounded-full border px-2 py-0.5 whitespace-nowrap ${badgeColor(r.status)}`}
                          >
                            {statusMap[r.status] || r.status}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm font-ibm text-gray-500">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">📅</span>
                            <span>{new Date(r.date).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs">👥</span>
                            <span>
                              {r.booked_seats} place{r.booked_seats > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            )}

          {/* Danger zone: delete account */}
          <div className="mt-6">
            <Card className="border-red-50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-poppins font-semibold">Supprimer le compte</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    La suppression est irréversible. Toutes vos données seront supprimées.
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={requestDeleteAccount}
                    disabled={deletingAccount}
                    className="text-xs font-poppins font-semibold border border-red-600 px-3 py-1 bg-red-600 text-white disabled:opacity-60 cursor-pointer"
                  >
                    {deletingAccount ? '...' : 'Supprimer le compte'}
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      <ConfirmationModal
        open={confirmOpen}
        title={confirmTitle}
        description={confirmDescription}
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmCallback(null);
        }}
        onConfirm={() => {
          setConfirmOpen(false);
          try {
            confirmCallback?.();
          } finally {
            setConfirmCallback(null);
          }
        }}
      />

      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />

      {!loading && !error && !details && (
        <p className="text-center text-sm text-gray-500 font-ibm py-12">
          Aucune information disponible.
        </p>
      )}

      {/* Help Widget */}
      <HelpWidget content={HELP_CONTENTS.account} />
    </main>
  );
}
