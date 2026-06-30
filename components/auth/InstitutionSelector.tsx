'use client';

import { useState, useEffect, startTransition } from 'react';
import { Search, MapPin, Plus, X, AlertCircle } from '@deemlol/next-icons';

import { PublicCategory, SchoolGrade, AgeRange, InstitutionSelectOption } from '@/types/api';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import Loader from '@/components/ui/Loader';
import toast from '@/lib/utils/toast';
import {
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  AGE_RANGE_LABELS,
} from '@/lib/config/labelMappings';
import { getGradesForSchoolTypes } from '@/lib/config/badgeConstants';

/**
 * ✅ COMPLETE: Institution creation feature implemented
 *
 * Features:
 * - Encourages users to search thoroughly before creating
 * - "Mon établissement n'est pas dans la liste" button (shown after search length >= 2)
 * - ASSOCIATION type creation without restrictions
 * - Duplicate detection with confirmation workflow
 * - Complete creation form with validation:
 *   - Name (pre-filled with searchTerm)
 *   - Type(s) multi-select
 *   - Complete address (street, zip, city)
 *   - Optional email and phone
 *   - Client-side validation (French postal code, email, phone)
 */

interface InstitutionSelectorProps {
  onInstitutionSelect: (institutionIds: string[]) => void;
  error?: string;
  allowMultiple?: boolean;
  initialSelections?: string[];
  userInstitutionIds?: string[];
  publicCategoryLabels?: Record<string, string>;
}

const getInstitutionTypes = (labels: Record<string, string>) => [
  { value: PublicCategory.CRECHE, label: labels[PublicCategory.CRECHE] },
  { value: PublicCategory.MATERNELLE, label: labels[PublicCategory.MATERNELLE] },
  { value: PublicCategory.ELEMENTAIRE, label: labels[PublicCategory.ELEMENTAIRE] },
  { value: PublicCategory.COLLEGE, label: labels[PublicCategory.COLLEGE] },
  { value: PublicCategory.LYCEE, label: labels[PublicCategory.LYCEE] },
  { value: PublicCategory.SUPERIEUR, label: labels[PublicCategory.SUPERIEUR] },
  { value: PublicCategory.ASSOCIATION, label: labels[PublicCategory.ASSOCIATION] },
  { value: PublicCategory.CONSERVATOIRE, label: labels[PublicCategory.CONSERVATOIRE] },
  { value: PublicCategory.PERISCOLAIRE, label: labels[PublicCategory.PERISCOLAIRE] },
  { value: PublicCategory.PUBLICS_EMPECHES, label: labels[PublicCategory.PUBLICS_EMPECHES] },
  { value: PublicCategory.AUTRE, label: labels[PublicCategory.AUTRE] },
];

// School grade options (for MATERNELLE, ELEMENTAIRE, COLLEGE, LYCEE types)
const getSchoolGradeOptions = (labels: Record<string, string>) => [
  { value: SchoolGrade.PS, label: labels[SchoolGrade.PS] || 'PS' },
  { value: SchoolGrade.MS, label: labels[SchoolGrade.MS] || 'MS' },
  { value: SchoolGrade.GS, label: labels[SchoolGrade.GS] || 'GS' },
  { value: SchoolGrade.CP, label: labels[SchoolGrade.CP] || 'CP' },
  { value: SchoolGrade.CE1, label: labels[SchoolGrade.CE1] || 'CE1' },
  { value: SchoolGrade.CE2, label: labels[SchoolGrade.CE2] || 'CE2' },
  { value: SchoolGrade.CM1, label: labels[SchoolGrade.CM1] || 'CM1' },
  { value: SchoolGrade.CM2, label: labels[SchoolGrade.CM2] || 'CM2' },
  { value: SchoolGrade.SIXIEME, label: labels[SchoolGrade.SIXIEME] || '6ème' },
  { value: SchoolGrade.CINQUIEME, label: labels[SchoolGrade.CINQUIEME] || '5ème' },
  { value: SchoolGrade.QUATRIEME, label: labels[SchoolGrade.QUATRIEME] || '4ème' },
  { value: SchoolGrade.TROISIEME, label: labels[SchoolGrade.TROISIEME] || '3ème' },
  { value: SchoolGrade.SECONDE, label: labels[SchoolGrade.SECONDE] || '2nde' },
  { value: SchoolGrade.PREMIERE, label: labels[SchoolGrade.PREMIERE] || '1ère' },
  { value: SchoolGrade.TERMINALE, label: labels[SchoolGrade.TERMINALE] || 'Term' },
];

/**
 * ✅ COMPLETE: Age range support for non-school establishments
 *
 * The age_ranges field allows non-school institutions (associations, centres de loisirs,
 * conservatoires, etc.) to specify the age range of their participants. This helps
 * auto-filter events based on the institution's target audience.
 */
interface CreationFormData {
  name: string;
  email: string;
  phone_number: string;
  street: string;
  zip_code: string;
  city: string;
  type: PublicCategory[];
  grades: SchoolGrade[];
  age_ranges: AgeRange[];
}

interface SimilarInstitution {
  id: string;
  name: string;
  city: string;
  zipCode: string;
  type: PublicCategory[];
  matchReason: string;
}

/**
 * InstitutionSelector component
 * Advanced selector for institutions with search and creation capabilities.
 * Features:
 * - Live search with debounce
 * - Multi-select or single-select mode
 * - "Create new institution" workflow
 * - Duplicate detection and warning
 * - Address and contact info collection
 * - Age range selection for non-school institutions
 *
 * @param onInstitutionSelect - Callback with selected institution IDs
 * @param error - Error message to display
 * @param allowMultiple - Whether to allow selecting multiple institutions
 * @param initialSelections - Array of initially selected institution IDs
 */
export default function InstitutionSelector({
  onInstitutionSelect,
  error,
  allowMultiple = false,
  initialSelections = [],
  userInstitutionIds = [],
  publicCategoryLabels,
}: InstitutionSelectorProps) {
  // Use dynamic labels if provided, otherwise fall back to static defaults
  const PUBLIC_CATEGORY_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;
  const INSTITUTION_TYPES = getInstitutionTypes(PUBLIC_CATEGORY_LABELS);

  const [nameSearch, setNameSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [institutions, setInstitutions] = useState<InstitutionSelectOption[]>([]);
  const [selectedInstitutions, setSelectedInstitutions] = useState<InstitutionSelectOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [userInstitutions, setUserInstitutions] = useState<InstitutionSelectOption[]>([]);
  const [isLoadingUserInstitutions, setIsLoadingUserInstitutions] = useState(false);

  // Creation mode states
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [similarInstitutions, setSimilarInstitutions] = useState<SimilarInstitution[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formData, setFormData] = useState<CreationFormData>({
    name: '',
    email: '',
    phone_number: '',
    street: '',
    zip_code: '',
    city: '',
    type: [],
    grades: [],
    age_ranges: [],
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CreationFormData, string>>>({});

  // Load initial selections
  useEffect(() => {
    if (initialSelections.length === 0) return;

    const loadInitialInstitutions = async () => {
      setIsLoadingInitial(true);
      try {
        const institutionsData: InstitutionSelectOption[] = [];

        for (const id of initialSelections) {
          const response = await fetchWithAuth(`/api/institutions/${id}`);
          const data = await response.json();

          if (response.ok && data.institution) {
            institutionsData.push(data.institution);
          }
        }

        if (institutionsData.length > 0) {
          setSelectedInstitutions(institutionsData);
          onInstitutionSelect(institutionsData.map((i) => i.id));
        }
      } catch (error) {
        logger.error('Error loading initial institutions:', error);
      } finally {
        setIsLoadingInitial(false);
      }
    };

    loadInitialInstitutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelections.join(',')]);

  // Load user's attached institutions
  useEffect(() => {
    if (userInstitutionIds.length === 0) return;

    const loadUserInstitutions = async () => {
      setIsLoadingUserInstitutions(true);
      try {
        const institutionsData: InstitutionSelectOption[] = [];

        for (const id of userInstitutionIds) {
          const response = await fetchWithAuth(`/api/institutions/${id}`);
          const data = await response.json();

          if (response.ok && data.institution) {
            institutionsData.push(data.institution);
          }
        }

        setUserInstitutions(institutionsData);
      } catch (error) {
        logger.error('Error loading user institutions:', error);
      } finally {
        setIsLoadingUserInstitutions(false);
      }
    };

    loadUserInstitutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInstitutionIds.join(',')]);

  // Search institutions with debounce (separate name and city fields)
  useEffect(() => {
    // Name is required (min 2 chars)
    if (nameSearch.length < 2) {
      startTransition(() => setInstitutions([]));
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Build query params
        const params = new URLSearchParams({
          name: nameSearch,
          limit: '20',
        });

        // Add city if provided (optional)
        if (citySearch.trim().length >= 2) {
          params.append('city', citySearch);
        }

        const response = await fetchWithAuth(`/api/institutions/search?${params.toString()}`);
        const data = await response.json();

        if (response.ok) {
          setInstitutions(data.institutions || []);
        } else {
          const msg = data.error || "Erreur lors de la recherche d'établissements";
          logger.error('Error searching institutions:', msg);
          toast(msg, 'error');
          setInstitutions([]);
        }
      } catch (error) {
        logger.error('Error searching institutions:', error);
        try {
          toast("Erreur réseau lors de la recherche d'établissements", 'error');
        } catch {}
        setInstitutions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [nameSearch, citySearch]);

  const handleInstitutionSelect = (institution: InstitutionSelectOption) => {
    if (allowMultiple) {
      const isAlreadySelected = selectedInstitutions.some((i) => i.id === institution.id);
      let newSelections: InstitutionSelectOption[];

      if (isAlreadySelected) {
        newSelections = selectedInstitutions.filter((i) => i.id !== institution.id);
      } else {
        newSelections = [...selectedInstitutions, institution];
      }

      setSelectedInstitutions(newSelections);
      onInstitutionSelect(newSelections.map((i) => i.id));
    } else {
      setSelectedInstitutions([institution]);
      onInstitutionSelect([institution.id]);
    }
  };

  const handleCreateClick = () => {
    setIsCreating(true);
    setFormData((prev) => ({
      ...prev,
      name: nameSearch,
      city: citySearch.trim() || '',
    }));
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CreationFormData, string>> = {};

    if (!formData.name.trim()) {
      errors.name = 'Le nom est requis';
    }

    if (formData.type.length === 0) {
      errors.type = 'Veuillez sélectionner au moins un type';
    }

    if (!formData.street.trim()) {
      errors.street = 'La rue est requise';
    }

    if (!formData.zip_code.trim() || !/^[0-9]{5}$/.test(formData.zip_code)) {
      errors.zip_code = 'Code postal invalide (5 chiffres requis)';
    }

    if (!formData.city.trim()) {
      errors.city = 'La ville est requise';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Format d'email invalide";
    }

    if (
      formData.phone_number &&
      !/^(?:(?:\+|00)33|0)[1-9](?:[0-9]{8})$/.test(formData.phone_number.replace(/[\s.-]/g, ''))
    ) {
      errors.phone_number = 'Format de téléphone invalide';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitCreation = async (forceCreate: boolean = false) => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetchWithAuth('/api/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email || null,
          phone_number: formData.phone_number || null,
          address: {
            street: formData.street,
            zip_code: formData.zip_code,
            city: formData.city,
          },
          type: formData.type,
          grades: formData.grades,
          age_ranges: formData.age_ranges,
          force_create: forceCreate,
        }),
      });

      const data = await response.json();

      if (response.status === 409) {
        // Similar institutions found
        setSimilarInstitutions(data.similarInstitutions || []);
        setShowConfirmation(true);
        toast('Des établissements similaires ont été trouvés', 'info');
      } else if (response.ok) {
        toast('Établissement créé avec succès', 'success');

        // Select the newly created institution
        const newInstitution: InstitutionSelectOption = {
          id: data.institution.id,
          name: data.institution.name,
          email: data.institution.email,
          phone_number: data.institution.phone_number,
          type: data.institution.type,
          grades: data.institution.grades || [],
          age_ranges: data.institution.age_ranges || [],
          address: data.institution.address,
        };
        handleInstitutionSelect(newInstitution);

        // Reset form
        setIsCreating(false);
        setShowConfirmation(false);
        setSimilarInstitutions([]);
        setFormData({
          name: '',
          email: '',
          phone_number: '',
          street: '',
          zip_code: '',
          city: '',
          type: [],
          grades: [],
          age_ranges: [],
        });
      } else {
        toast(data.error || 'Erreur lors de la création', 'error');
      }
    } catch (error) {
      logger.error('Error creating institution:', error);
      toast('Erreur réseau lors de la création', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTypeToggle = (type: PublicCategory) => {
    setFormData((prev) => ({
      ...prev,
      type: prev.type.includes(type) ? prev.type.filter((t) => t !== type) : [...prev.type, type],
    }));
  };

  const handleGradeToggle = (grade: SchoolGrade) => {
    setFormData((prev) => ({
      ...prev,
      grades: prev.grades.includes(grade)
        ? prev.grades.filter((g) => g !== grade)
        : [...prev.grades, grade],
    }));
  };

  const handleAgeRangeToggle = (ageRange: AgeRange) => {
    setFormData((prev) => ({
      ...prev,
      age_ranges: prev.age_ranges.includes(ageRange)
        ? prev.age_ranges.filter((a) => a !== ageRange)
        : [...prev.age_ranges, ageRange],
    }));
  };

  // Determine if grade selector should be shown (for school types)
  const shouldShowGrades = formData.type.some((t) =>
    ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'].includes(t),
  );

  // Determine if age range selector should be shown (for non-school types)
  const shouldShowAgeRange = formData.type.some((t) =>
    [
      'ASSOCIATION',
      'PERISCOLAIRE',
      'PUBLICS_EMPECHES',
      'CONSERVATOIRE',
      'AUTRE',
      'SUPERIEUR',
    ].includes(t),
  );

  // Age range options (only the age-related types)
  const AGE_RANGE_OPTIONS = [
    {
      value: AgeRange.AGE_0_3,
      label: AGE_RANGE_LABELS[AgeRange.AGE_0_3] || '0-3 ans',
    },
    {
      value: AgeRange.AGE_3_6,
      label: AGE_RANGE_LABELS[AgeRange.AGE_3_6] || '3-6 ans',
    },
    {
      value: AgeRange.AGE_6_11,
      label: AGE_RANGE_LABELS[AgeRange.AGE_6_11] || '6-11 ans',
    },
    {
      value: AgeRange.AGE_11_15,
      label: AGE_RANGE_LABELS[AgeRange.AGE_11_15] || '11-15 ans',
    },
    {
      value: AgeRange.AGE_15_18,
      label: AGE_RANGE_LABELS[AgeRange.AGE_15_18] || '15-18 ans',
    },
    {
      value: AgeRange.AGE_18_PLUS,
      label: AGE_RANGE_LABELS[AgeRange.AGE_18_PLUS] || '18 ans et plus',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        {/* Loading initial selections */}
        {isLoadingInitial && (
          <div className="flex justify-center items-center text-center gap-4 py-4">
            <Loader />
            <p className="text-sm font-ibm text-gray-600">Chargement de votre établissement...</p>
          </div>
        )}

        {!isCreating ? (
          <>
            {/* Search Mode */}
            <div className="space-y-4">
              {/* Name search field */}
              <div className="relative">
                <label className="block text-sm font-poppins font-medium mb-1">
                  Nom de l&apos;établissement <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={nameSearch}
                    onChange={(e) => setNameSearch(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 font-ibm focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                    placeholder="Ex: Jean Jaurès, Victor Hugo..."
                  />
                </div>
              </div>

              {/* City search field */}
              <div className="relative">
                <label className="block text-sm font-poppins font-medium mb-1">
                  Ville ou code postal <span className="text-gray-400">(optionnel)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 font-ibm focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                    placeholder="Ex: Montpellier, 34000..."
                  />
                </div>
              </div>

              {/* User's attached institutions */}
              {userInstitutions.length > 0 && nameSearch.length === 0 && (
                <div>
                  <p className="text-xs text-gray-600 mb-2 font-ibm">
                    Vos établissements rattachés :
                  </p>
                  {isLoadingUserInstitutions ? (
                    <div className="flex justify-center items-center text-center gap-2 py-3">
                      <Loader />
                      <p className="text-sm font-ibm text-gray-600">Chargement...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {userInstitutions.map((institution) => {
                        const isSelected = selectedInstitutions.some(
                          (i) => i.id === institution.id,
                        );
                        return (
                          <button
                            key={institution.id}
                            type="button"
                            onClick={() => handleInstitutionSelect(institution)}
                            className={`text-left p-3 border rounded-none transition-colors ${
                              isSelected
                                ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500'
                                : 'bg-white border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-poppins font-semibold">{institution.name}</div>
                                <div className="text-sm font-ibm text-gray-600 mt-1">
                                  <div className="flex items-center">
                                    <MapPin className="w-4 h-4 mr-1" />
                                    {institution.address.city}
                                  </div>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="ml-2 text-blue-600 text-xs font-semibold">✓</div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Help text */}
              {nameSearch.length >= 2 && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                  <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-blue-900 font-ibm">
                    <strong>Astuce :</strong> Utilisez le champ ville pour affiner votre recherche
                    parmi les résultats.
                  </div>
                </div>
              )}

              {isSearching && (
                <div className="flex justify-center items-center text-center gap-4">
                  <Loader />
                  <p className="text-sm font-ibm text-gray-600">Recherche en cours...</p>
                </div>
              )}

              {institutions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {institutions.map((institution) => {
                    const isSelected = selectedInstitutions.some((i) => i.id === institution.id);
                    return (
                      <button
                        key={institution.id}
                        type="button"
                        onClick={() => handleInstitutionSelect(institution)}
                        className={`text-left p-3 border rounded-none transition-colors ${
                          isSelected
                            ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500'
                            : 'bg-white border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-poppins font-semibold">{institution.name}</div>
                            <div className="text-sm font-ibm text-gray-600 mt-1">
                              <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-1" />
                                {institution.address.city}
                              </div>
                              <div className="mt-1">
                                {institution.type
                                  .map(
                                    (t: PublicCategory) =>
                                      INSTITUTION_TYPES.find((it) => it.value === t)?.label,
                                  )
                                  .filter(Boolean)
                                  .join(', ')}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="ml-2 text-blue-600 text-xs font-semibold">✓</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {nameSearch.length >= 2 && !isSearching && institutions.length === 0 && (
                <div className="text-center py-4 text-gray-500 font-ibm">
                  Aucun établissement trouvé.
                </div>
              )}

              {/* Bouton création - toujours visible après une recherche */}
              {nameSearch.length >= 2 && !isSearching && (
                <button
                  type="button"
                  onClick={handleCreateClick}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white font-poppins font-semibold hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Mon établissement n&apos;est pas dans la liste
                </button>
              )}
            </div>

            {/* Selected Institution Display */}
            {selectedInstitutions.length > 0 && (
              <div className="mt-4 p-4 bg-blue-100 border border-blue-300">
                <div className="flex items-center text-blue-900">
                  <Search className="w-5 h-5 mr-2" />
                  <span className="font-poppins font-semibold">
                    {allowMultiple
                      ? `Établissement${selectedInstitutions.length > 1 ? 's' : ''} sélectionné${selectedInstitutions.length > 1 ? 's' : ''} :`
                      : 'Établissement sélectionné :'}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {selectedInstitutions.map((institution) => (
                    <div
                      key={institution.id}
                      className="bg-white p-2 rounded border border-blue-300"
                    >
                      <div className="font-semibold">{institution.name}</div>
                      <div className="text-sm text-gray-600">
                        {institution.address.street}, {institution.address.zip_code}{' '}
                        {institution.address.city}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Creation Form */}
            <div className="border border-gray-300 p-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-poppins font-semibold text-lg">Créer un établissement</h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setShowConfirmation(false);
                    setSimilarInstitutions([]);
                  }}
                  className="text-gray-500 hover:text-black"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Nom de l&apos;établissement *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border ${formErrors.name ? 'border-red-500' : 'border-gray-300'} font-ibm focus:outline-none focus:ring-2 focus:ring-black`}
                  placeholder="Ex: École primaire Jean Jaurès"
                />
                {formErrors.name && <p className="text-red-600 text-sm mt-1">{formErrors.name}</p>}
              </div>

              {/* Type selection */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Type(s) d&apos;établissement *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {INSTITUTION_TYPES.map((instType) => (
                    <button
                      key={instType.value}
                      type="button"
                      onClick={() => handleTypeToggle(instType.value)}
                      className={`px-3 py-2 text-sm border ${
                        formData.type.includes(instType.value)
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-gray-300 hover:border-black'
                      } transition-colors`}
                    >
                      {instType.label}
                    </button>
                  ))}
                </div>
                {formErrors.type && <p className="text-red-600 text-sm mt-1">{formErrors.type}</p>}
              </div>

              {/* Grade selection (for school types) */}
              {shouldShowGrades && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <label className="block text-sm font-semibold mb-1">Niveaux scolaires</label>
                  <p className="text-xs text-blue-700 mb-2">
                    Sélectionnez tous les niveaux concernés par cet établissement.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {getSchoolGradeOptions(PUBLIC_CATEGORY_LABELS)
                      .filter((gradeType) =>
                        getGradesForSchoolTypes(formData.type).includes(gradeType.value),
                      )
                      .map((gradeType) => (
                        <button
                          key={gradeType.value}
                          type="button"
                          onClick={() => handleGradeToggle(gradeType.value)}
                          className={`px-2 py-1 text-xs border ${
                            formData.grades.includes(gradeType.value)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-black border-gray-300 hover:border-blue-600'
                          } transition-colors`}
                        >
                          {gradeType.label}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Age range selection (only for non-school types) */}
              {shouldShowAgeRange && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                  <label className="block text-sm font-semibold mb-2">
                    Tranche(s) d&apos;âge du public
                  </label>
                  <p className="text-sm text-gray-600 mb-3">
                    Sélectionnez les tranches d&apos;âge des personnes que vous accueillez. Cela
                    permettra de pré-filtrer les événements adaptés à votre public.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {AGE_RANGE_OPTIONS.map((ageType) => (
                      <button
                        key={ageType.value}
                        type="button"
                        onClick={() => handleAgeRangeToggle(ageType.value)}
                        className={`px-3 py-2 text-sm border ${
                          formData.age_ranges.includes(ageType.value)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-black border-gray-300 hover:border-blue-600'
                        } transition-colors`}
                      >
                        {ageType.label}
                      </button>
                    ))}
                  </div>
                  {formData.age_ranges.length === 0 && (
                    <p className="text-sm text-gray-500 mt-2 italic">
                      Optionnel - laissez vide si vous accueillez tous les âges
                    </p>
                  )}
                </div>
              )}

              {/* Street */}
              <div>
                <label className="block text-sm font-semibold mb-1">Rue *</label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className={`w-full px-3 py-2 border ${formErrors.street ? 'border-red-500' : 'border-gray-300'} font-ibm focus:outline-none focus:ring-2 focus:ring-black`}
                  placeholder="Ex: 123 rue de la République"
                />
                {formErrors.street && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.street}</p>
                )}
              </div>

              {/* Zip code and City */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Code postal *</label>
                  <input
                    type="text"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    className={`w-full px-3 py-2 border ${formErrors.zip_code ? 'border-red-500' : 'border-gray-300'} font-ibm focus:outline-none focus:ring-2 focus:ring-black`}
                    placeholder="34000"
                    maxLength={5}
                  />
                  {formErrors.zip_code && (
                    <p className="text-red-600 text-sm mt-1">{formErrors.zip_code}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Ville *</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className={`w-full px-3 py-2 border ${formErrors.city ? 'border-red-500' : 'border-gray-300'} font-ibm focus:outline-none focus:ring-2 focus:ring-black`}
                    placeholder="Montpellier"
                  />
                  {formErrors.city && (
                    <p className="text-red-600 text-sm mt-1">{formErrors.city}</p>
                  )}
                </div>
              </div>

              {/* Email (optional) */}
              <div>
                <label className="block text-sm font-semibold mb-1">Email (optionnel)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-3 py-2 border ${formErrors.email ? 'border-red-500' : 'border-gray-300'} font-ibm focus:outline-none focus:ring-2 focus:ring-black`}
                  placeholder="contact@etablissement.fr"
                />
                {formErrors.email && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.email}</p>
                )}
              </div>

              {/* Phone (optional) */}
              <div>
                <label className="block text-sm font-semibold mb-1">Téléphone (optionnel)</label>
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className={`w-full px-3 py-2 border ${formErrors.phone_number ? 'border-red-500' : 'border-gray-300'} font-ibm focus:outline-none focus:ring-2 focus:ring-black`}
                  placeholder="06 12 34 56 78"
                />
                {formErrors.phone_number && (
                  <p className="text-red-600 text-sm mt-1">{formErrors.phone_number}</p>
                )}
              </div>

              {/* Similar institutions warning */}
              {showConfirmation && similarInstitutions.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-300 rounded">
                  <p className="font-semibold text-yellow-900 mb-2">
                    ⚠️ Attention : {similarInstitutions.length} établissement(s) similaire(s)
                    trouvé(s)
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {similarInstitutions.map((inst) => (
                      <div
                        key={inst.id}
                        className="bg-white p-2 border border-yellow-200 rounded text-sm"
                      >
                        <div className="font-semibold">{inst.name}</div>
                        <div className="text-gray-600">
                          {inst.city} - {inst.matchReason}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-yellow-900 mt-2">
                    Êtes-vous sûr(e) que votre établissement est différent ?
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-4">
                {!showConfirmation ? (
                  <button
                    type="button"
                    onClick={() => handleSubmitCreation(false)}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 bg-black text-white font-poppins font-semibold hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? 'Création en cours...' : "Créer l'établissement"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowConfirmation(false);
                        setSimilarInstitutions([]);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-black font-poppins hover:bg-gray-50 transition-colors"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSubmitCreation(true)}
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2 bg-black text-white font-poppins font-semibold hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? 'Création en cours...' : 'Créer quand même'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* Error Display */}
        {error && <div className="mt-2 text-red-600 text-sm font-ibm">{error}</div>}
      </div>
    </div>
  );
}
