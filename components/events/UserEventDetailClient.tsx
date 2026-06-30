'use client';

import React, { useState, useEffect, startTransition } from 'react';
import { useUser } from '@/context/UserContext';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import toast from '@/lib/utils/toast';
import Loader from '@/components/ui/Loader';
import InstitutionSelector from '@/components/auth/InstitutionSelector';
import {
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  ACCESSIBILITY_LABELS as DEFAULT_ACCESSIBILITY_LABELS,
  REGISTRATION_STATUS_LABELS as DEFAULT_REGISTRATION_STATUS_LABELS,
  SCHOOL_GRADE_LABELS as DEFAULT_SCHOOL_GRADE_LABELS,
  AGE_RANGE_LABELS as DEFAULT_AGE_RANGE_LABELS,
} from '@/lib/config/labelMappings';
import {
  Accessibility,
  PublicCategory,
  RegistrationStatus,
  SchoolGrade,
  AgeRange,
} from '@/types/api';
import { getGradesForSchoolTypes, GRADES_BY_SCHOOL_TYPE } from '@/lib/config/badgeConstants';

interface UserGroup {
  id: string;
  name?: string | null;
  category: PublicCategory[];
  grades?: SchoolGrade[];
  age_ranges?: AgeRange[];
  students_count: number;
  disabilities?: Array<{ type: Accessibility; count: number; details?: string | null }>;
}

interface ExistingRegistration {
  id: string;
  date: string;
  booked_seats: number;
  caretaker_count?: number;
  aesh_count?: number;
  status: RegistrationStatus;
  institution?: {
    name: string;
  };
  category?: PublicCategory[];
  grades?: SchoolGrade[];
  age_ranges?: AgeRange[];
  want_formation?: boolean;
  want_preparation?: boolean;
  blockSelections?: RegistrationBlockSelection[];
}

interface EventRegistrationBlock {
  id: string;
  title: string;
  description?: string | null;
  dates: string[];
  enabled: boolean;
  registration_enabled: boolean;
  mandatory: boolean;
  order: number;
}

interface RegistrationBlockSelection {
  id: string;
  wants_to_attend: boolean;
  selected_date?: string | null;
  block: {
    id: string;
    title: string;
    mandatory?: boolean;
  };
}

/**
 * UserEventDetailClient component
 * Registration form for authenticated users.
 * Features:
 * - Check for existing registrations
 * - Institution selection
 * - Group data pre-filling (if user has groups defined)
 * - Detailed form for seats, caretakers, AESH, and accessibility needs
 * - Manager contact information
 * - Real-time validation of seat limits
 *
 * @param eventId - The ID of the event
 * @param eventSlug - The slug of the event (optional)
 */
export default function UserEventDetailClient({
  eventId,
  eventSlug,
  publicCategoryLabels,
  accessibilityLabels,
  registrationStatusLabels,
  schoolGradeLabels,
  ageRangeLabels,
}: {
  eventId: string;
  eventSlug: string | null;
  publicCategoryLabels?: Record<string, string>;
  accessibilityLabels?: Record<string, string>;
  registrationStatusLabels?: Record<string, string>;
  schoolGradeLabels?: Record<string, string>;
  ageRangeLabels?: Record<string, string>;
}) {
  // Use dynamic labels if provided, otherwise fall back to static defaults
  const PUBLIC_CATEGORY_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;
  const ACCESSIBILITY_LABELS = accessibilityLabels || DEFAULT_ACCESSIBILITY_LABELS;
  const REGISTRATION_STATUS_LABELS = registrationStatusLabels || DEFAULT_REGISTRATION_STATUS_LABELS;
  const SCHOOL_GRADE_LABELS = schoolGradeLabels || DEFAULT_SCHOOL_GRADE_LABELS;
  const AGE_RANGE_LABELS = ageRangeLabels || DEFAULT_AGE_RANGE_LABELS;

  const eventIdentifier = eventSlug || eventId; // Use slug if available, otherwise ID
  const { user } = useUser();
  const [selectedInstitutionIds, setSelectedInstitutionIds] = useState<string[]>([]);
  const [institutionError, setInstitutionError] = useState('');
  const [eventDates, setEventDates] = useState<string[]>([]);
  const [eventInfo, setEventInfo] = useState<{
    has_initial_formation: boolean;
    is_formation_mandatory: boolean;
    has_musical_preparation: boolean;
    registrationBlocks: EventRegistrationBlock[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [existingRegistration, setExistingRegistration] = useState<ExistingRegistration | null>(
    null,
  );
  const [checkingRegistration, setCheckingRegistration] = useState(false);

  // Modal state for musical preparation
  const [showPreparationModal, setShowPreparationModal] = useState(false);
  // Modal state for registration confirmation
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [formData, setFormData] = useState({
    selectedDate: '',
    bookedSeats: '',
    caretakerCount: '',
    aeshCount: '',
    wantFormation: false,
    wantPreparation: false,
    managerFirstName: '',
    managerLastName: '',
    managerEmail: '',
    managerPhoneNumber: '',
    ageRange: [] as PublicCategory[],
    grades: [] as SchoolGrade[],
    ageRanges: [] as AgeRange[],
    comments: '',
    registrationBlockSelections: {} as Record<
      string,
      { wantsToAttend: boolean; selectedDate: string }
    >,
    disabilities: Object.keys(ACCESSIBILITY_LABELS).map((type) => ({
      type: type as Accessibility,
      count: 0,
      details: '',
    })),
  });

  const fetchEventDates = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/events/${eventIdentifier}`);
      const data = await response.json();
      logger.debug('Fetched event data:', data);
      if (response.ok && data.event) {
        const registrationBlocks = (data.event.registrationBlocks || []).filter(
          (block: EventRegistrationBlock) => !block.id.startsWith('legacy-'),
        );
        setEventDates(data.event.event_dates || []);
        setEventInfo({
          has_initial_formation: data.event.has_initial_formation || false,
          is_formation_mandatory: data.event.is_formation_mandatory || false,
          has_musical_preparation: data.event.has_musical_preparation || false,
          registrationBlocks,
        });
        const registrationBlockSelections = Object.fromEntries(
          registrationBlocks
            .filter((block: EventRegistrationBlock) => block.enabled && block.registration_enabled)
            .map((block: EventRegistrationBlock) => [
              block.id,
              {
                wantsToAttend: block.mandatory,
                selectedDate: '',
              },
            ]),
        );
        setFormData((prev) => ({ ...prev, registrationBlockSelections }));
      }
    } catch (error) {
      logger.error('Error fetching event dates:', error);
      toast('Erreur lors du chargement des dates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async () => {
    if (!user) return;
    try {
      const response = await fetchWithAuth(`/api/users/me`);
      const data = await response.json();
      if (response.ok && data.user) {
        // Pre-fill supervisor info with user info
        setFormData((prev) => ({
          ...prev,
          managerFirstName: data.user.first_name || '',
          managerLastName: data.user.last_name || '',
          managerEmail: data.user.email || '',
          managerPhoneNumber: data.user.phone_number || '',
        }));
      }
    } catch (error) {
      logger.error('Error fetching user details:', error);
      toast('Erreur lors du chargement des informations utilisateur', 'error');
    }
  };

  const checkExistingRegistration = async () => {
    if (!user) return;
    setCheckingRegistration(true);
    try {
      const response = await fetchWithAuth(`/api/events/${eventIdentifier}/registrations/me`);
      const data = await response.json();
      if (response.ok && data.registrations && data.registrations.length > 0) {
        // User has at least one active registration for this event
        setExistingRegistration(data.registrations[0]);
      } else {
        setExistingRegistration(null);
      }
    } catch (error) {
      logger.error('Error checking existing registration:', error);
      toast('Erreur lors de la vérification des inscriptions', 'error');
    } finally {
      setCheckingRegistration(false);
    }
  };

  const fetchUserGroups = async () => {
    if (!user) return;
    try {
      const response = await fetchWithAuth(`/api/users/${user.id}/groups`);
      const data = await response.json();
      if (response.ok && data.groups) {
        setUserGroups(data.groups);
      }
    } catch (error) {
      logger.error('Error fetching user groups:', error);
      toast('Erreur lors du chargement des groupes', 'error');
    }
  };

  useEffect(() => {
    startTransition(() => {
      fetchEventDates();
      if (user) {
        fetchUserGroups();
        fetchUserDetails();
        checkExistingRegistration();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdentifier, user]);

  const handleUseGroupData = (groupData: UserGroup) => {
    // Marquer le groupe comme sélectionné
    setSelectedGroupId(groupData.id);

    // Calculer le total de places (students_count)
    const totalSeats = groupData.students_count || 0;

    // Extract disabilities with details
    const disabilities = groupData.disabilities || [];
    const disabilitiesMap = disabilities.reduce(
      (
        acc: Record<string, { count: number; details?: string | null }>,
        d: { type: Accessibility; count: number; details?: string | null },
      ) => {
        acc[d.type] = { count: d.count, details: d.details };
        return acc;
      },
      {},
    );

    setFormData((prev) => ({
      ...prev,
      bookedSeats: String(totalSeats),
      ageRange: groupData.category || prev.ageRange,
      grades: groupData.grades || prev.grades,
      ageRanges: groupData.age_ranges || prev.ageRanges,
      disabilities: Object.keys(ACCESSIBILITY_LABELS).map((type) => ({
        type: type as Accessibility,
        count: disabilitiesMap[type]?.count || 0,
        details: disabilitiesMap[type]?.details || '',
      })),
    }));
  };

  const handleInstitutionSelect = (ids: string[]) => {
    setSelectedInstitutionIds(ids);
    setInstitutionError('');
  };

  // Calculate max caretakers based on age range
  const getMaxCaretakers = (ageRange: PublicCategory[]): number => {
    if (ageRange.length === 0) return 2; // Default to 2 if no age range specified

    // If CRECHE or MATERNELLE is included, allow 4 caretakers
    const hasYoungChildren = ageRange.some((type) => type === 'CRECHE' || type === 'MATERNELLE');

    return hasYoungChildren ? 4 : 2;
  };

  // Determine which categories are school types (have grade mappings)
  const SCHOOL_CATEGORY_KEYS = Object.keys(GRADES_BY_SCHOOL_TYPE);

  // Compute filtered grades and whether to show age ranges based on selected categories
  const selectedSchoolCategories = formData.ageRange.filter((cat) =>
    SCHOOL_CATEGORY_KEYS.includes(cat),
  );
  const selectedNonSchoolCategories = formData.ageRange.filter(
    (cat) => !SCHOOL_CATEGORY_KEYS.includes(cat),
  );
  const filteredGrades = getGradesForSchoolTypes(selectedSchoolCategories);
  const showGrades = selectedSchoolCategories.length > 0;
  const showAgeRanges = selectedNonSchoolCategories.length > 0;

  const handleAgeRangeChange = (type: PublicCategory) => {
    setFormData((prev) => {
      const newAgeRange = prev.ageRange.includes(type)
        ? prev.ageRange.filter((t) => t !== type)
        : [...prev.ageRange, type];

      // Adjust caretaker count if it exceeds new limit
      const maxCaretakers = getMaxCaretakers(newAgeRange);
      const currentCaretakers = parseInt(prev.caretakerCount) || 0;

      // Clean up grades that are no longer valid for the new selection
      const newSchoolCategories = newAgeRange.filter((cat) => SCHOOL_CATEGORY_KEYS.includes(cat));
      const validGrades = getGradesForSchoolTypes(newSchoolCategories);
      const cleanedGrades = prev.grades.filter((g) => validGrades.includes(g));

      // Clear age ranges if no non-school category is selected
      const hasNonSchool = newAgeRange.some((cat) => !SCHOOL_CATEGORY_KEYS.includes(cat));
      const cleanedAgeRanges = hasNonSchool ? prev.ageRanges : [];

      return {
        ...prev,
        ageRange: newAgeRange,
        grades: cleanedGrades,
        ageRanges: cleanedAgeRanges,
        caretakerCount:
          currentCaretakers > maxCaretakers ? String(maxCaretakers) : prev.caretakerCount,
      };
    });
  };

  const handleSchoolGradeChange = (grade: SchoolGrade) => {
    setFormData((prev) => ({
      ...prev,
      grades: prev.grades.includes(grade)
        ? prev.grades.filter((g) => g !== grade)
        : [...prev.grades, grade],
    }));
  };

  const handleAgeRangesChange = (range: AgeRange) => {
    setFormData((prev) => ({
      ...prev,
      ageRanges: prev.ageRanges.includes(range)
        ? prev.ageRanges.filter((r) => r !== range)
        : [...prev.ageRanges, range],
    }));
  };

  const handleDisabilityChange = (type: Accessibility, count: number) => {
    const bookedSeats = parseInt(formData.bookedSeats) || 0;
    const caretakerCount = parseInt(formData.caretakerCount) || 0;
    const aeshCount = parseInt(formData.aeshCount) || 0;
    const otherDisabilities = formData.disabilities
      .filter((d) => d.type !== type)
      .reduce((sum, d) => sum + d.count, 0);

    // Ensure total disabilities + caretakers + AESH doesn't exceed booked seats
    const maxAllowed = Math.max(0, bookedSeats - caretakerCount - aeshCount - otherDisabilities);
    const validCount = Math.min(Math.max(0, count), maxAllowed);

    setFormData((prev) => ({
      ...prev,
      disabilities: prev.disabilities.map((d) =>
        d.type === type ? { ...d, count: validCount } : d,
      ),
    }));
  };

  // Handle disability details change (for OTHER type)
  const handleDisabilityDetailsChange = (type: Accessibility, details: string) => {
    setFormData((prev) => ({
      ...prev,
      disabilities: prev.disabilities.map((d) => (d.type === type ? { ...d, details } : d)),
    }));
  };

  // Handle musical preparation checkbox change
  const handlePreparationChange = (checked: boolean) => {
    if (checked) {
      // Show modal when user wants to enable preparation
      setShowPreparationModal(true);
    } else {
      // Allow unchecking without modal
      setFormData((prev) => ({ ...prev, wantPreparation: false }));
    }
  };

  // Confirm preparation request (just sets the flag, email sent on admin approval)
  const confirmPreparationRequest = () => {
    setFormData((prev) => ({ ...prev, wantPreparation: true }));
    setShowPreparationModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (selectedInstitutionIds.length === 0) {
      setInstitutionError('Veuillez sélectionner un établissement');
      return;
    }

    if (!formData.selectedDate) {
      toast('Veuillez sélectionner une date', 'error');
      return;
    }

    const seats = parseInt(formData.bookedSeats);
    if (!seats || seats <= 0) {
      toast('Veuillez indiquer un nombre de places valide', 'error');
      return;
    }

    const registrationBlocks =
      eventInfo?.registrationBlocks.filter(
        (block) => block.enabled && block.registration_enabled,
      ) || [];
    for (const block of registrationBlocks) {
      const selection = formData.registrationBlockSelections[block.id];
      if (block.mandatory && !selection?.wantsToAttend) {
        toast(`Le bloc "${block.title}" est obligatoire`, 'error');
        return;
      }
      if (selection?.wantsToAttend && block.dates.length > 0 && !selection.selectedDate) {
        toast(`Veuillez choisir une date pour "${block.title}"`, 'error');
        return;
      }
    }

    setSubmitting(true);

    try {
      const disabilitiesFiltered = formData.disabilities.filter((d) => d.count > 0);

      const caretakers = parseInt(formData.caretakerCount) || null;
      const aesh = parseInt(formData.aeshCount) || null;

      const response = await fetchWithAuth(`/api/events/${eventIdentifier}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution_id: selectedInstitutionIds[0], // Use first selected institution
          date: formData.selectedDate,
          booked_seats: seats,
          caretaker_count: caretakers,
          aesh_count: aesh,
          want_formation: formData.wantFormation || null,
          want_preparation: formData.wantPreparation || null,
          registration_block_selections: registrationBlocks.map((block) => {
            const selection = formData.registrationBlockSelections[block.id];
            return {
              block_id: block.id,
              wants_to_attend: Boolean(selection?.wantsToAttend),
              selected_date: selection?.wantsToAttend ? selection.selectedDate || null : null,
            };
          }),
          manager_first_name: formData.managerFirstName || null,
          manager_last_name: formData.managerLastName || null,
          manager_email: formData.managerEmail || null,
          manager_phone_number: formData.managerPhoneNumber || null,
          category: formData.ageRange,
          grades: formData.grades,
          age_ranges: formData.ageRanges,
          comments: formData.comments || null,
          disabilities: disabilitiesFiltered.length > 0 ? disabilitiesFiltered : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'inscription");
      }

      // Show success modal instead of reloading immediately
      setShowSuccessModal(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erreur lors de l'inscription";
      toast(msg, 'error');
      logger.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || checkingRegistration) {
    return (
      <section className="bg-white border border-gray-200 shadow-sm p-6">
        <div className="flex justify-center">
          <Loader />
        </div>
      </section>
    );
  }

  // If user already has an active registration for this event
  if (existingRegistration) {
    const statusLabels = REGISTRATION_STATUS_LABELS;

    const statusColors: Record<RegistrationStatus, string> = {
      PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
      CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      CANCELLED: 'bg-gray-100 text-gray-600 border-gray-300',
      REJECTED: 'bg-red-50 text-red-700 border-red-200',
      ATTENDED: 'bg-blue-50 text-blue-700 border-blue-200',
      NO_SHOW: 'bg-gray-50 text-gray-500 border-gray-300',
    };

    return (
      <section className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-poppins font-semibold mb-4">
          Inscription existante
        </h2>

        <div className="space-y-4">
          <div
            className={`p-4 border rounded-none ${statusColors[existingRegistration.status] || 'bg-gray-50 text-gray-700 border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-poppins font-semibold">
                Statut de votre inscription
              </span>
              <span className="text-xs px-2 py-1 border rounded-none bg-white">
                {statusLabels[existingRegistration.status as keyof typeof statusLabels] ||
                  existingRegistration.status}
              </span>
            </div>

            <div className="space-y-2 text-sm font-ibm">
              <p>
                <span className="font-medium">Établissement :</span>{' '}
                {existingRegistration.institution?.name}
              </p>
              <p>
                <span className="font-medium">Date :</span>{' '}
                {new Date(existingRegistration.date).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p>
                <span className="font-medium">Places réservées :</span>{' '}
                {existingRegistration.booked_seats}
                {existingRegistration.caretaker_count &&
                  existingRegistration.caretaker_count > 0 && (
                    <> avec {existingRegistration.caretaker_count} accompagnant(s)</>
                  )}
                {existingRegistration.aesh_count && existingRegistration.aesh_count > 0 && (
                  <> et {existingRegistration.aesh_count} AESH</>
                )}
              </p>
              {(existingRegistration.category && existingRegistration.category.length > 0) ||
              (existingRegistration.grades && existingRegistration.grades.length > 0) ||
              (existingRegistration.age_ranges && existingRegistration.age_ranges.length > 0) ? (
                <div>
                  <span className="font-medium">Public :</span>{' '}
                  <div className="flex flex-wrap gap-2 mt-1">
                    {existingRegistration.category?.map((cat) => (
                      <span
                        key={cat}
                        className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 font-ibm inline-block"
                      >
                        {PUBLIC_CATEGORY_LABELS[cat] || cat}
                      </span>
                    ))}
                    {existingRegistration.grades?.map((grade) => (
                      <span
                        key={grade}
                        className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 font-ibm inline-block"
                      >
                        {SCHOOL_GRADE_LABELS[grade] || grade}
                      </span>
                    ))}
                    {existingRegistration.age_ranges?.map((ageRange) => (
                      <span
                        key={ageRange}
                        className="text-xs px-2 py-1 bg-teal-50 text-teal-700 border border-teal-200 font-ibm inline-block"
                      >
                        {AGE_RANGE_LABELS[ageRange] || ageRange}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {existingRegistration.blockSelections &&
              existingRegistration.blockSelections.length > 0 ? (
                <p>
                  <span className="font-medium">Autour du spectacle :</span>{' '}
                  <div className="flex flex-wrap gap-2 mt-1">
                    {existingRegistration.blockSelections.map((selection) => (
                      <span
                        key={selection.id}
                        className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-ibm inline-block"
                      >
                        {selection.wants_to_attend ? '✓' : 'Non'} {selection.block.title}
                        {selection.selected_date
                          ? ` - ${new Date(selection.selected_date).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : ''}
                      </span>
                    ))}
                  </div>
                </p>
              ) : (existingRegistration.want_formation !== null &&
                  existingRegistration.want_formation !== undefined) ||
                (existingRegistration.want_preparation !== null &&
                  existingRegistration.want_preparation !== undefined) ? (
                <p>
                  <span className="font-medium">Autour du spectacle :</span>{' '}
                  <div className="flex flex-wrap gap-2 mt-1">
                    {existingRegistration.want_formation && (
                      <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-ibm inline-block">
                        🎓 Formation souhaitée
                      </span>
                    )}
                    {existingRegistration.want_preparation && (
                      <span className="text-xs px-2 py-1 bg-teal-50 text-teal-700 border border-teal-200 font-ibm inline-block">
                        🎵 Préparation musicale souhaitée
                      </span>
                    )}
                  </div>
                </p>
              ) : null}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-none">
            <p className="text-sm text-blue-800 font-ibm">
              Vous avez déjà une inscription pour cet événement. Si vous souhaitez la modifier ou
              l&apos;annuler, rendez-vous sur la page des{' '}
              <a
                href="/account/registrations"
                className="font-poppins underline hover:text-blue-900"
              >
                Demandes d&apos;inscription
              </a>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-poppins font-semibold mb-2">
        Formulaire d&apos;inscription
      </h2>
      <p className="text-sm text-gray-600 font-ibm mb-6">
        Remplissez ce formulaire pour inscrire votre groupe à cet événement. Les champs marqués
        d&apos;un astérisque (<span className="text-red-500">*</span>) sont obligatoires.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ============================================ */}
        {/* SECTION 1: ÉTABLISSEMENT ET GROUPES */}
        {/* ============================================ */}
        <div>
          <h2 className="text-base font-poppins font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-none flex items-center justify-center text-sm">
              1
            </span>
            Établissement et groupes
          </h2>
          <div className="space-y-4 pl-8">
            {/* Institution Selection */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-none">
              <h3 className="text-sm font-poppins font-semibold mb-3 text-blue-900">
                Établissement <span className="text-red-500">*</span>
              </h3>
              <p className="text-xs text-blue-700 mb-3 font-ibm">
                Sélectionnez l&apos;établissement pour lequel vous vous inscrivez. Si vous gérez
                plusieurs établissements, choisissez celui concerné par cette inscription.
              </p>
              <InstitutionSelector
                onInstitutionSelect={handleInstitutionSelect}
                error={institutionError}
                allowMultiple={false}
                initialSelections={user?.institution_ids?.[0] ? [user.institution_ids[0]] : []}
                userInstitutionIds={user?.institution_ids || []}
                publicCategoryLabels={PUBLIC_CATEGORY_LABELS}
              />
            </div>

            {/* Use class data */}
            {userGroups.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-none">
                <h3 className="text-sm font-poppins font-semibold mb-3 text-blue-900">
                  Utiliser les données d&apos;un groupe
                </h3>
                <p className="text-xs text-blue-700 mb-3 font-ibm">
                  Cliquez sur un groupe pour pré-remplir automatiquement le nombre de places et les
                  besoins en accessibilité. Ces groupes ont été créés sur{' '}
                  <a
                    href="/account"
                    className="text-blue-600 underline hover:text-blue-800 font-medium"
                  >
                    votre page de profil
                  </a>
                  .
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {userGroups.map((groupData) => {
                    const isSelected = selectedGroupId === groupData.id;
                    return (
                      <button
                        key={groupData.id}
                        type="button"
                        onClick={() => handleUseGroupData(groupData)}
                        className={`text-left p-3 border rounded-none transition-colors ${
                          isSelected
                            ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500'
                            : 'bg-white border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-poppins font-medium text-gray-900">
                            {groupData.name || 'Groupe'} - {groupData.students_count} élèves
                          </p>
                          {isSelected && (
                            <span className="text-blue-600 text-xs font-semibold">
                              ✓ Sélectionnée
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 font-ibm mt-1">
                          {Array.isArray(groupData.category)
                            ? groupData.category
                                .map((type: PublicCategory) => PUBLIC_CATEGORY_LABELS[type] || type)
                                .join(', ')
                            : 'Non spécifié'}
                        </p>
                        {groupData.disabilities && groupData.disabilities.length > 0 && (
                          <p className="text-xs text-gray-500 font-ibm mt-1">
                            {groupData.disabilities
                              .map(
                                (d) =>
                                  `${ACCESSIBILITY_LABELS[d.type as Accessibility]}: ${d.count}`,
                              )
                              .join(', ')}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 2: DÉTAILS DE L'INSCRIPTION */}
        {/* ============================================ */}
        <div>
          <h2 className="text-base font-poppins font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-none flex items-center justify-center text-sm">
              2
            </span>
            Détails de l&apos;inscription
          </h2>
          <div className="space-y-4 pl-8">
            {/* Date Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 font-ibm">
                Date de l&apos;événement <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-3 font-ibm">
                Choisissez la date à laquelle vous souhaitez assister à l&apos;événement.
              </p>
              <select
                value={formData.selectedDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, selectedDate: e.target.value }))}
                required
                className="w-full p-2 sm:p-3 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm"
              >
                <option value="">Sélectionner une date</option>
                {eventDates.map((date) => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </option>
                ))}
              </select>
            </div>

            {/* Age Range Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 font-ibm">
                Tranche d&apos;âge du groupe{' '}
                <span className="text-xs text-gray-500">(obligatoire)</span>
              </label>
              <p className="text-xs text-gray-500 mb-3 font-ibm">
                Sélectionnez toutes les tranches qui correspondent à votre groupe. Pour les classes
                à plusieurs niveaux, cochez toutes les cases concernées.
                <span className="text-gray-600"> Astuce : créez des groupes en amont sur </span>
                <a
                  href="/account"
                  className="text-gray-700 underline hover:text-gray-900 font-medium"
                >
                  votre profil
                </a>
                <span className="text-gray-600"> pour pré-remplir automatiquement ces champs.</span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(PUBLIC_CATEGORY_LABELS) as PublicCategory[]).map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 p-2 border border-gray-300 rounded-none cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={formData.ageRange.includes(type)}
                      onChange={() => handleAgeRangeChange(type)}
                      className="rounded-none"
                    />
                    <span className="text-sm font-ibm">{PUBLIC_CATEGORY_LABELS[type]}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* School Grade Selection (only when a school category is selected) */}
            {showGrades && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 font-ibm">
                  Niveaux scolaires <span className="text-xs text-gray-500">(optionnel)</span>
                </label>
                <p className="text-xs text-gray-500 mb-3 font-ibm">
                  Précisez les niveaux scolaires du groupe.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filteredGrades.map((grade) => (
                    <label
                      key={grade}
                      className="flex items-center gap-2 p-2 border border-gray-300 rounded-none cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={formData.grades.includes(grade)}
                        onChange={() => handleSchoolGradeChange(grade)}
                        className="rounded-none"
                      />
                      <span className="text-sm font-ibm">{SCHOOL_GRADE_LABELS[grade]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Age Range Selection (only when a non-school category is selected) */}
            {showAgeRanges && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 font-ibm">
                  Tranches d&apos;âge <span className="text-xs text-gray-500">(optionnel)</span>
                </label>
                <p className="text-xs text-gray-500 mb-3 font-ibm">
                  Précisez la tranche d&apos;âge du groupe.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(AGE_RANGE_LABELS) as AgeRange[]).map((range) => (
                    <label
                      key={range}
                      className="flex items-center gap-2 p-2 border border-gray-300 rounded-none cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={formData.ageRanges.includes(range)}
                        onChange={() => handleAgeRangesChange(range)}
                        className="rounded-none"
                      />
                      <span className="text-sm font-ibm">{AGE_RANGE_LABELS[range]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 3: COMPOSITION DU GROUPE */}
        {/* ============================================ */}
        <div>
          <h2 className="text-base font-poppins font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-none flex items-center justify-center text-sm">
              3
            </span>
            Composition du groupe
          </h2>
          <div className="space-y-4 pl-8">
            {/* Students/Spectators Count */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 font-ibm">
                Nombre d&apos;élèves/spectateurs <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-3 font-ibm">
                Indiquez le nombre d&apos;élèves ou de spectateurs du groupe.
                <span className="text-gray-600"> Astuce : créez des groupes en amont sur </span>
                <a
                  href="/account"
                  className="text-gray-700 underline hover:text-gray-900 font-medium"
                >
                  votre profil
                </a>
                <span className="text-gray-600"> pour pré-remplir automatiquement ces champs.</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(formData.bookedSeats) || 0;
                    setFormData((prev) => ({
                      ...prev,
                      bookedSeats: String(Math.max(1, current - 1)),
                    }));
                  }}
                  className="w-10 h-10 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={formData.bookedSeats}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, bookedSeats: e.target.value }))
                  }
                  required
                  className="flex-1 text-center p-2 sm:p-3 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm font-medium"
                  placeholder="Ex: 25"
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(formData.bookedSeats) || 0;
                    setFormData((prev) => ({ ...prev, bookedSeats: String(current + 1) }));
                  }}
                  className="w-10 h-10 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                >
                  +
                </button>
              </div>
            </div>

            {/* Caretaker Count */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 font-ibm">
                Nombre d&apos;accompagnants{' '}
                <span className="text-xs text-gray-500">(responsable inclus)</span>
              </label>
              <p className="text-xs text-gray-500 mb-3 font-ibm">
                Comptez toutes les adultes accompagnants participant à la sortie, y compris le
                responsable du groupe.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(formData.caretakerCount) || 0;
                    setFormData((prev) => ({
                      ...prev,
                      caretakerCount: String(Math.max(0, current - 1)),
                    }));
                  }}
                  className="w-10 h-10 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                >
                  −
                </button>
                <input
                  type="number"
                  min="0"
                  value={formData.caretakerCount}
                  onChange={(e) => {
                    const bookedSeats = parseInt(formData.bookedSeats) || 0;
                    const aeshCount = parseInt(formData.aeshCount) || 0;
                    const totalDisabilities = formData.disabilities.reduce(
                      (sum, d) => sum + d.count,
                      0,
                    );
                    const maxCaretakers = getMaxCaretakers(formData.ageRange);
                    const maxBySeats = Math.max(0, bookedSeats - aeshCount - totalDisabilities);
                    const maxAllowed = Math.min(maxCaretakers, maxBySeats);
                    const value = Math.min(parseInt(e.target.value) || 0, maxAllowed);
                    setFormData((prev) => ({ ...prev, caretakerCount: String(value) }));
                  }}
                  className="flex-1 text-center p-2 sm:p-3 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm font-medium"
                  placeholder="Ex: 2"
                />
                <button
                  type="button"
                  onClick={() => {
                    const bookedSeats = parseInt(formData.bookedSeats) || 0;
                    const aeshCount = parseInt(formData.aeshCount) || 0;
                    const totalDisabilities = formData.disabilities.reduce(
                      (sum, d) => sum + d.count,
                      0,
                    );
                    const maxCaretakers = getMaxCaretakers(formData.ageRange);
                    const maxBySeats = Math.max(0, bookedSeats - aeshCount - totalDisabilities);
                    const maxAllowed = Math.min(maxCaretakers, maxBySeats);
                    const current = parseInt(formData.caretakerCount) || 0;
                    setFormData((prev) => ({
                      ...prev,
                      caretakerCount: String(Math.min(current + 1, maxAllowed)),
                    }));
                  }}
                  className="w-10 h-10 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 font-ibm">
                Maximum : {getMaxCaretakers(formData.ageRange)} accompagnant(s)
              </p>
            </div>

            {/* AESH Count */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 font-ibm">
                Nombre d&apos;AESH{' '}
                <span className="text-xs text-gray-500">
                  (Accompagnants d&apos;Élèves en Situation de Handicap)
                </span>
              </label>
              <p className="text-xs text-gray-500 mb-3 font-ibm">
                Ces personnes sont comptées dans le nombre total de places et nécessitent un
                accompagnement spécifique.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const current = parseInt(formData.aeshCount) || 0;
                    setFormData((prev) => ({
                      ...prev,
                      aeshCount: String(Math.max(0, current - 1)),
                    }));
                  }}
                  className="w-10 h-10 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                >
                  −
                </button>
                <input
                  type="number"
                  min="0"
                  value={formData.aeshCount}
                  onChange={(e) => {
                    const bookedSeats = parseInt(formData.bookedSeats) || 0;
                    const caretakerCount = parseInt(formData.caretakerCount) || 0;
                    const totalDisabilities = formData.disabilities.reduce(
                      (sum, d) => sum + d.count,
                      0,
                    );
                    const maxBySeats = Math.max(
                      0,
                      bookedSeats - caretakerCount - totalDisabilities,
                    );
                    const value = Math.min(parseInt(e.target.value) || 0, maxBySeats);
                    setFormData((prev) => ({ ...prev, aeshCount: String(value) }));
                  }}
                  className="flex-1 text-center p-2 sm:p-3 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm font-medium"
                  placeholder="Ex: 1"
                />
                <button
                  type="button"
                  onClick={() => {
                    const bookedSeats = parseInt(formData.bookedSeats) || 0;
                    const caretakerCount = parseInt(formData.caretakerCount) || 0;
                    const totalDisabilities = formData.disabilities.reduce(
                      (sum, d) => sum + d.count,
                      0,
                    );
                    const maxBySeats = Math.max(
                      0,
                      bookedSeats - caretakerCount - totalDisabilities,
                    );
                    const current = parseInt(formData.aeshCount) || 0;
                    setFormData((prev) => ({
                      ...prev,
                      aeshCount: String(Math.min(current + 1, maxBySeats)),
                    }));
                  }}
                  className="w-10 h-10 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1 font-ibm">
                Accompagnant d&apos;élève avec des besoins spécifiques (inclus dans le nombre total
                de places)
              </p>
            </div>

            {/* Total Booked Seats */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 font-ibm">
                Nombre total de places réservées
              </label>
              <p className="text-xs text-gray-500 mb-3 font-ibm">
                Total automatiquement calculé : élèves/spectateurs + accompagnants + AESH
              </p>
              <div className="bg-gray-100 border border-gray-300 p-2 sm:p-3 rounded-none text-center">
                <span className="text-lg sm:text-xl font-poppins font-bold text-gray-900">
                  {(parseInt(formData.bookedSeats) || 0) +
                    (parseInt(formData.caretakerCount) || 0) +
                    (parseInt(formData.aeshCount) || 0)}
                </span>
                <p className="text-xs text-gray-600 mt-1 font-ibm">(acc + aesh)</p>
              </div>
            </div>

            {/* Accessibility Needs */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 font-ibm">
                Besoins en accessibilité
              </label>
              <p className="text-xs text-gray-500 mb-3 font-ibm">
                Précisez le nombre de personnes nécessitant chaque type d&apos;aménagement pour nous
                permettre d&apos;adapter au mieux votre accueil.
                <span className="text-gray-600"> Astuce : créez des groupes en amont sur </span>
                <a
                  href="/account"
                  className="text-gray-700 underline hover:text-gray-900 font-medium"
                >
                  votre profil
                </a>
                <span className="text-gray-600">
                  {' '}
                  pour pré-remplir automatiquement ces besoins.
                </span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formData.disabilities.map((disability) => (
                  <div
                    key={disability.type}
                    className="bg-gray-50 border border-gray-300 p-3 rounded-none"
                  >
                    <label className="block text-xs text-gray-600 mb-2 font-ibm font-medium">
                      {ACCESSIBILITY_LABELS[disability.type]}
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleDisabilityChange(disability.type, Math.max(0, disability.count - 1))
                        }
                        className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={disability.count}
                        onChange={(e) =>
                          handleDisabilityChange(disability.type, parseInt(e.target.value) || 0)
                        }
                        className="flex-1 text-center p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm font-medium"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleDisabilityChange(disability.type, disability.count + 1)
                        }
                        className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                      >
                        +
                      </button>
                    </div>
                    {/* Show details field for OTHER type when count > 0 */}
                    {disability.type === 'OTHER' && disability.count > 0 && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={disability.details || ''}
                          onChange={(e) =>
                            handleDisabilityDetailsChange(disability.type, e.target.value)
                          }
                          placeholder="Précisez le type de besoin..."
                          className="w-full p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 4: CONTACT */}
        {/* ============================================ */}
        <div>
          <h2 className="text-base font-poppins font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-none flex items-center justify-center text-sm">
              4
            </span>
            Contact
          </h2>
          <div className="space-y-4 pl-8">
            {/* Manager Information */}
            <div>
              <h3 className="block text-sm font-semibold text-gray-700 mb-3 font-ibm">
                Responsable du groupe
              </h3>
              <p className="text-xs text-gray-500 mb-4 font-ibm">
                Coordonnées de la personne que nous pourrons contacter au sujet de cette
                inscription. Ces informations sont optionnelles mais recommandées.
                <span className="text-gray-600">
                  {' '}
                  Les champs ci-dessous sont pré-remplis avec les informations de{' '}
                </span>
                <a
                  href="/account"
                  className="text-gray-700 underline hover:text-gray-900 font-medium"
                >
                  votre profil
                </a>
                <span className="text-gray-600">.</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 font-ibm">
                    Prénom
                  </label>
                  <input
                    type="text"
                    value={formData.managerFirstName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, managerFirstName: e.target.value }))
                    }
                    className="w-full p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 font-ibm">
                    Nom
                  </label>
                  <input
                    type="text"
                    value={formData.managerLastName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, managerLastName: e.target.value }))
                    }
                    className="w-full p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 font-ibm">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.managerEmail}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, managerEmail: e.target.value }))
                    }
                    className="w-full p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 font-ibm">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={formData.managerPhoneNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, managerPhoneNumber: e.target.value }))
                    }
                    className="w-full p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* SECTION 5: AUTOUR DU SPECTACLE */}
        {/* ============================================ */}
        {((eventInfo?.registrationBlocks || []).some((block) => block.enabled) ||
          eventInfo?.has_initial_formation ||
          eventInfo?.has_musical_preparation) && (
          <div>
            <h2 className="text-base font-poppins font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-none flex items-center justify-center text-sm">
                5
              </span>
              Autour du spectacle
            </h2>
            <div className="space-y-4 pl-8">
              <p className="text-xs text-gray-500 font-ibm">
                Cet événement propose des activités pédagogiques
                {(eventInfo?.registrationBlocks || []).some(
                  (block) => block.enabled && block.registration_enabled && block.mandatory,
                ) ||
                (eventInfo?.has_initial_formation && eventInfo?.is_formation_mandatory)
                  ? ' complémentaires/obligatoires.'
                  : ' complémentaires.'}
              </p>
              <div className="space-y-3">
                {(eventInfo?.registrationBlocks || [])
                  .filter((block) => block.enabled)
                  .map((block) => {
                    const selection = formData.registrationBlockSelections[block.id];
                    return (
                      <div
                        key={block.id}
                        className="p-3 bg-gray-50 border border-gray-200 rounded-none"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-gray-800 font-semibold font-ibm">
                              {block.title}
                            </span>
                            {block.registration_enabled && block.mandatory && (
                              <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 rounded-none">
                                Requis
                              </span>
                            )}
                          </div>
                          {block.description && (
                            <p className="text-xs text-gray-600 font-ibm whitespace-pre-wrap">
                              {block.description}
                            </p>
                          )}
                          {block.registration_enabled && (
                            <>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      registrationBlockSelections: {
                                        ...prev.registrationBlockSelections,
                                        [block.id]: {
                                          ...prev.registrationBlockSelections[block.id],
                                          wantsToAttend: true,
                                        },
                                      },
                                    }))
                                  }
                                  className={`flex-1 py-2 px-4 text-sm font-medium transition-colors font-ibm ${
                                    selection?.wantsToAttend
                                      ? 'bg-blue-600 text-white border border-blue-600'
                                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  OUI
                                </button>
                                <button
                                  type="button"
                                  disabled={block.mandatory}
                                  onClick={() =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      registrationBlockSelections: {
                                        ...prev.registrationBlockSelections,
                                        [block.id]: {
                                          ...prev.registrationBlockSelections[block.id],
                                          wantsToAttend: false,
                                          selectedDate: '',
                                        },
                                      },
                                    }))
                                  }
                                  className={`flex-1 py-2 px-4 text-sm font-medium transition-colors font-ibm disabled:opacity-50 disabled:cursor-not-allowed ${
                                    !selection?.wantsToAttend
                                      ? 'bg-blue-600 text-white border border-blue-600'
                                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  NON
                                </button>
                              </div>
                              {selection?.wantsToAttend && block.dates.length > 0 && (
                                <select
                                  value={selection.selectedDate}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      registrationBlockSelections: {
                                        ...prev.registrationBlockSelections,
                                        [block.id]: {
                                          ...prev.registrationBlockSelections[block.id],
                                          selectedDate: e.target.value,
                                        },
                                      },
                                    }))
                                  }
                                  className="w-full p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm bg-white"
                                >
                                  <option value="">Sélectionner une date</option>
                                  {block.dates.map((date) => (
                                    <option key={date} value={date}>
                                      {new Date(date).toLocaleString('fr-FR', {
                                        day: '2-digit',
                                        month: 'long',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {eventInfo?.registrationBlocks.length === 0 && eventInfo?.has_initial_formation && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-none">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 font-ibm">
                          Pourrez-vous assister à la formation ?
                        </span>
                        {eventInfo?.is_formation_mandatory && (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 rounded-none">
                            Requis
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, wantFormation: true }))}
                          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors font-ibm ${
                            formData.wantFormation
                              ? 'bg-blue-600 text-white border border-blue-600'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          OUI
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, wantFormation: false }))}
                          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors font-ibm ${
                            !formData.wantFormation
                              ? 'bg-blue-600 text-white border border-blue-600'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          NON
                        </button>
                      </div>
                    </div>
                    {eventInfo?.is_formation_mandatory && (
                      <p className="text-xs text-amber-700 mt-2 font-ibm">
                        La participation à cette formation est obligatoire pour assister à
                        l&apos;événement. Elle se déroule avant la représentation.
                      </p>
                    )}
                  </div>
                )}
                {eventInfo?.has_musical_preparation && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-none">
                    <div className="space-y-2">
                      <span className="text-sm text-gray-700 font-ibm">
                        Souhaitez-vous vous inscrire à un atelier de préparation au concert, en
                        classe, pour vos élèves ?
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handlePreparationChange(true)}
                          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors font-ibm ${
                            formData.wantPreparation
                              ? 'bg-blue-600 text-white border border-blue-600'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          OUI
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePreparationChange(false)}
                          className={`flex-1 py-2 px-4 text-sm font-medium transition-colors font-ibm ${
                            !formData.wantPreparation
                              ? 'bg-blue-600 text-white border border-blue-600'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          NON
                        </button>
                      </div>
                    </div>
                    {formData.wantPreparation && (
                      <p className="text-xs text-emerald-700 mt-2 font-ibm flex items-center gap-1">
                        <span>•</span> Une demande sera envoyée à l&apos;équipe de l&apos;Opéra lors
                        de la validation de votre inscription
                      </p>
                    )}
                    {!formData.wantPreparation && (
                      <p className="text-xs text-gray-500 mt-2 font-ibm">
                        En cochant cette case, vous serez contacté par l&apos;équipe de l&apos;Opéra
                        pour organiser cette préparation avec votre groupe (en fonction des
                        disponibilités).
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* SECTION 6: INFORMATIONS COMPLÉMENTAIRES */}
        {/* ============================================ */}
        <div>
          <h2 className="text-base font-poppins font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-none flex items-center justify-center text-sm">
              {(eventInfo?.registrationBlocks || []).some((block) => block.enabled) ||
              eventInfo?.has_initial_formation ||
              eventInfo?.has_musical_preparation
                ? '6'
                : '5'}
            </span>
            Informations complémentaires
          </h2>
          <div className="space-y-4 pl-8">
            {/* Comments */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 font-ibm">
                Commentaires
              </label>
              <p className="text-xs text-gray-500 mb-3 font-ibm">
                Veuillez indiquer toute information complémentaire susceptible de nous orienter pour
                traiter au mieux votre demande.
              </p>
              <textarea
                value={formData.comments}
                onChange={(e) => setFormData((prev) => ({ ...prev, comments: e.target.value }))}
                rows={3}
                className="w-full p-2 sm:p-3 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm"
                placeholder="Informations complémentaires..."
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-none hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed font-poppins"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader />
                Envoi en cours...
              </span>
            ) : (
              "S'inscrire"
            )}
          </button>
        </div>
      </form>

      {/* Musical Preparation Request Modal - Outside form for proper fixed positioning */}
      {showPreparationModal && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-none shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-poppins font-semibold mb-4">
              Demande de préparation musicale
            </h3>
            <p className="text-sm text-gray-600 font-ibm mb-4">
              En cochant cette option, une demande de préparation musicale sera envoyée à
              l&apos;équipe de l&apos;Opéra lors de la confirmation de votre inscription par le
              personnel de l&apos;Opéra. Ils vous contacteront ensuite pour organiser cette
              préparation avec votre groupe.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPreparationModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-none text-sm font-medium hover:bg-gray-50 transition-colors font-poppins"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmPreparationRequest}
                className="px-4 py-2 bg-emerald-600 text-white rounded-none text-sm font-medium hover:bg-emerald-700 transition-colors font-poppins"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 rounded-none shadow-xl max-w-lg w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-emerald-600 text-2xl">✓</span>
              </div>
              <h3 className="text-lg font-poppins font-semibold text-gray-900">
                Demande d&apos;inscription envoyée
              </h3>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-700 font-ibm">
                Votre demande d&apos;inscription a bien été prise en compte.
              </p>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-none">
                <p className="text-xl font-bold text-blue-900 font-ibm mb-2">Important à savoir</p>
                <p className="text-sm text-blue-800 font-ibm leading-relaxed">
                  Ce formulaire est une demande d&apos;inscription de votre groupe : sur certaines
                  séances, nous ne pouvons malheureusement parfois pas satisfaire toutes les
                  demandes.
                  {existingRegistration === null && (
                    <>
                      <br />
                      <br />
                      Si votre demande peut être honorée, vous recevrez une confirmation par email.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  // Reload the page to show the existing registration
                  window.location.reload();
                }}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-none text-sm font-medium hover:bg-emerald-700 transition-colors font-poppins"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
