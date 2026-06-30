'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertTriangle } from '@deemlol/next-icons';
import MultiSelect from '@/components/ui/MultiSelect';
import UserSelector from '@/components/admin/users/UserSelector';
import InstitutionSelector from '@/components/auth/InstitutionSelector';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { Accessibility, PublicCategory, SchoolGrade, AgeRange } from '@/types/api';
import {
  ACCESSIBILITY_LABELS as DEFAULT_ACCESSIBILITY_LABELS,
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  SCHOOL_GRADE_LABELS,
  AGE_RANGE_LABELS,
} from '@/lib/config/labelMappings';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface Institution {
  id: string;
  name: string;
  address?: {
    city: string;
  };
}

interface RegistrationData {
  id: string;
  user?: User;
  institution?: Institution;
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
}

interface RegistrationUpdateData {
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
}

interface EditRegistrationModalProps {
  open: boolean;
  registration: RegistrationData | null;
  eventHasFormation: boolean;
  eventHasPreparation: boolean;
  onCancel: () => void;
  onConfirm: (data: RegistrationUpdateData) => Promise<void>;
  saving: boolean;
  accessibilityLabels?: Record<string, string>;
  publicCategoryLabels?: Record<string, string>;
}

const ACCESSIBILITY_OPTIONS = Object.values(Accessibility).map((a) => ({
  value: a,
  label: DEFAULT_ACCESSIBILITY_LABELS[a] || a,
}));

const CATEGORY_OPTIONS = Object.values(PublicCategory).map((c) => ({
  value: c,
  label: DEFAULT_PUBLIC_CATEGORY_LABELS[c] || c,
}));

const GRADE_OPTIONS = Object.values(SchoolGrade).map((g) => ({
  value: g,
  label: SCHOOL_GRADE_LABELS[g] || g,
}));

const AGE_RANGE_OPTIONS = Object.values(AgeRange).map((a) => ({
  value: a,
  label: AGE_RANGE_LABELS[a] || a,
}));

interface DisabilityEntry {
  id: string;
  type: Accessibility;
  count: number;
  details?: string;
}

/**
 * EditRegistrationModal component
 * Comprehensive modal for editing all registration details.
 * Allows admins to modify seats, caretakers, AESH, manager info,
 * disabilities, public categories, comments, and more.
 *
 * @param open - Whether the modal is open
 * @param registration - The registration data to edit
 * @param eventHasFormation - Whether the event has initial formation
 * @param eventHasPreparation - Whether the event has musical preparation
 * @param onCancel - Callback to cancel
 * @param onConfirm - Callback to confirm changes
 * @param saving - Loading state
 */
export default function EditRegistrationModal({
  open,
  registration,
  eventHasFormation,
  eventHasPreparation,
  onCancel,
  onConfirm,
  saving,
  accessibilityLabels,
  publicCategoryLabels,
}: EditRegistrationModalProps) {
  const ACCESSIBILITY_LABELS = accessibilityLabels || DEFAULT_ACCESSIBILITY_LABELS;
  const PUBLIC_CATEGORY_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;

  // Form state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [booked_seats, setBooked_seats] = useState(1);
  const [caretaker_count, setCaretaker_count] = useState<number | null>(null);
  const [aesh_count, setAesh_count] = useState<number | null>(null);
  const [manager_first_name, setManager_first_name] = useState('');
  const [manager_last_name, setManager_last_name] = useState('');
  const [manager_email, setManager_email] = useState('');
  const [manager_phone_number, setManager_phone_number] = useState('');
  const [comments, setComments] = useState('');
  const [was_present_comment, setWas_present_comment] = useState('');
  const [want_formation, setWant_formation] = useState(false);
  const [want_preparation, setWant_preparation] = useState(false);
  const [disabilities, setDisabilities] = useState<DisabilityEntry[]>([]);
  const [category, setCategory] = useState<PublicCategory[]>([]);
  const [grades, setGrades] = useState<SchoolGrade[]>([]);
  const [age_ranges, setAge_ranges] = useState<AgeRange[]>([]);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form when registration changes
  useEffect(() => {
    if (registration) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setSelectedUser(registration.user || null);
      setSelectedInstitution(registration.institution || null);
      setBooked_seats(registration.booked_seats || 1);
      setCaretaker_count(registration.caretaker_count ?? null);
      setAesh_count(registration.aesh_count ?? null);
      setManager_first_name(registration.manager_first_name || '');
      setManager_last_name(registration.manager_last_name || '');
      setManager_email(registration.manager_email || '');
      setManager_phone_number(registration.manager_phone_number || '');
      setComments(registration.comments || '');
      setWas_present_comment(registration.was_present_comment || '');
      setWant_formation(registration.want_formation || false);
      setWant_preparation(registration.want_preparation || false);
      setCategory(registration.category || []);
      setGrades(registration.grades || []);
      setAge_ranges(registration.age_ranges || []);
      /* eslint-enable react-hooks/set-state-in-effect */

      // Convert disabilities to DisabilityEntry format
      setSelectedUser(registration.user || null);
      setSelectedInstitution(registration.institution || null);
      setBooked_seats(registration.booked_seats || 1);
      setCaretaker_count(registration.caretaker_count ?? null);
      setAesh_count(registration.aesh_count ?? null);
      setManager_first_name(registration.manager_first_name || '');
      setManager_last_name(registration.manager_last_name || '');
      setManager_email(registration.manager_email || '');
      setManager_phone_number(registration.manager_phone_number || '');
      setComments(registration.comments || '');
      setWas_present_comment(registration.was_present_comment || '');
      setWant_formation(registration.want_formation || false);
      setWant_preparation(registration.want_preparation || false);
      setCategory(registration.category || []);
      setGrades(registration.grades || []);
      setAge_ranges(registration.age_ranges || []);

      // Convert disabilities to DisabilityEntry format
      if (registration.disabilities && registration.disabilities.length > 0) {
        setDisabilities(
          registration.disabilities.map((d, idx) => ({
            id: `${idx}-${Date.now()}`,
            type: d.type,
            count: d.count,
            details: d.details || '',
          })),
        );
      } else {
        setDisabilities([]);
      }

      setErrors({});
    }
  }, [registration]);

  if (!open || !registration) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (booked_seats < 1 || booked_seats > 500) {
      newErrors.booked_seats = 'Le nombre de places doit être entre 1 et 500';
    }
    if (caretaker_count !== null && (caretaker_count < 0 || caretaker_count > 50)) {
      newErrors.caretaker_count = "Le nombre d'accompagnateurs doit être entre 0 et 50";
    }
    if (aesh_count !== null && (aesh_count < 0 || aesh_count > 100)) {
      newErrors.aesh_count = "Le nombre d'AESH doit être entre 0 et 100";
    }
    if (manager_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manager_email)) {
      newErrors.manager_email = 'Format email invalide';
    }
    if (manager_phone_number && !/^[0-9+\s()-]+$/.test(manager_phone_number)) {
      newErrors.manager_phone_number = 'Format de téléphone invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = async () => {
    if (!validate()) return;

    const data: RegistrationUpdateData = {
      user_id: selectedUser?.id,
      institution_id: selectedInstitution?.id,
      booked_seats,
      caretaker_count: caretaker_count === null ? null : caretaker_count,
      aesh_count: aesh_count === null ? null : aesh_count,
      manager_first_name: manager_first_name || null,
      manager_last_name: manager_last_name || null,
      manager_email: manager_email || null,
      manager_phone_number: manager_phone_number || null,
      comments: comments || null,
      want_formation,
      want_preparation,
      disabilities: disabilities.map((d) => ({
        type: d.type,
        count: d.count,
        details: d.type === Accessibility.OTHER ? d.details || null : null,
      })),
      category,
      grades,
      age_ranges,
      was_present_comment: was_present_comment || null,
    };

    await onConfirm(data);
  };

  const addDisability = () => {
    setDisabilities([
      ...disabilities,
      { id: `${Date.now()}`, type: Accessibility.OTHER, count: 0, details: '' },
    ]);
  };

  const removeDisability = (id: string) => {
    setDisabilities(disabilities.filter((d) => d.id !== id));
  };

  const updateDisability = (id: string, field: keyof DisabilityEntry, value: string | number) => {
    setDisabilities(disabilities.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const isValid = () => {
    return (
      booked_seats >= 1 &&
      booked_seats <= 500 &&
      (caretaker_count === null || (caretaker_count >= 0 && caretaker_count <= 50)) &&
      (aesh_count === null || (aesh_count >= 0 && aesh_count <= 100)) &&
      (!manager_email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manager_email)) &&
      (!manager_phone_number || /^[0-9+\s()-]+$/.test(manager_phone_number))
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl my-8">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-poppins font-semibold">Modifier l&apos;inscription</h2>
            <p className="text-sm text-gray-600 font-ibm mt-1">
              {registration?.booked_seats} places • {registration?.booked_seats} élèves
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={saving}
            className="p-2 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Section: Rattachement */}
          <div>
            <h3 className="text-sm font-poppins font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Rattachement
            </h3>
            <div className="p-3 bg-amber-50 border border-amber-200 mb-4 rounded">
              <p className="text-xs text-amber-800 font-ibm flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  <strong>Attention :</strong> Changer l&apos;utilisateur ou l&apos;établissement
                  modifiera le propriétaire de cette demande et peut affecter les notifications.
                </span>
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">Utilisateur</label>
                <UserSelector
                  onUserSelect={(user) => setSelectedUser(user)}
                  initialUser={registration?.user || null}
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">Établissement</label>
                <InstitutionSelector
                  onInstitutionSelect={(ids) => {
                    // InstitutionSelector returns array, but we want single select
                    const institutionId = ids.length > 0 ? ids[0] : null;
                    // Fetch institution details
                    if (institutionId) {
                      fetchWithAuth(`/api/institutions/${institutionId}`)
                        .then((res) => res.json())
                        .then((data) => {
                          if (data.institution) {
                            setSelectedInstitution(data.institution);
                          }
                        })
                        .catch(() => {
                          setSelectedInstitution(null);
                        });
                    } else {
                      setSelectedInstitution(null);
                    }
                  }}
                  allowMultiple={false}
                  initialSelections={registration?.institution ? [registration.institution.id] : []}
                  publicCategoryLabels={PUBLIC_CATEGORY_LABELS}
                />
              </div>
            </div>
          </div>

          {/* Section: Informations de base */}
          <div>
            <h3 className="text-sm font-poppins font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Informations de base
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">
                  Places <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={booked_seats}
                  onChange={(e) => setBooked_seats(parseInt(e.target.value) || 1)}
                  disabled={saving}
                  className={`w-full px-3 py-2 border font-ibm text-sm focus:outline-none focus:border-blue-500 ${
                    errors.booked_seats ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.booked_seats && (
                  <p className="text-xs text-red-500 mt-1 font-ibm">{errors.booked_seats}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">
                  Accompagnateurs
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={caretaker_count ?? ''}
                  onChange={(e) =>
                    setCaretaker_count(e.target.value === '' ? null : parseInt(e.target.value) || 0)
                  }
                  disabled={saving}
                  className={`w-full px-3 py-2 border font-ibm text-sm focus:outline-none focus:border-blue-500 ${
                    errors.caretaker_count ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.caretaker_count && (
                  <p className="text-xs text-red-500 mt-1 font-ibm">{errors.caretaker_count}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">AESH</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={aesh_count ?? ''}
                  onChange={(e) =>
                    setAesh_count(e.target.value === '' ? null : parseInt(e.target.value) || 0)
                  }
                  disabled={saving}
                  className={`w-full px-3 py-2 border font-ibm text-sm focus:outline-none focus:border-blue-500 ${
                    errors.aesh_count ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.aesh_count && (
                  <p className="text-xs text-red-500 mt-1 font-ibm">{errors.aesh_count}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section: Responsable */}
          <div>
            <h3 className="text-sm font-poppins font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Responsable sur place
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">Prénom</label>
                <input
                  type="text"
                  value={manager_first_name}
                  onChange={(e) => setManager_first_name(e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-gray-300 font-ibm text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Prénom du responsable"
                />
              </div>
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">Nom</label>
                <input
                  type="text"
                  value={manager_last_name}
                  onChange={(e) => setManager_last_name(e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2 border border-gray-300 font-ibm text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Nom du responsable"
                />
              </div>
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={manager_email}
                  onChange={(e) => setManager_email(e.target.value)}
                  disabled={saving}
                  className={`w-full px-3 py-2 border font-ibm text-sm focus:outline-none focus:border-blue-500 ${
                    errors.manager_email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="email@exemple.fr"
                />
                {errors.manager_email && (
                  <p className="text-xs text-red-500 mt-1 font-ibm">{errors.manager_email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">Téléphone</label>
                <input
                  type="tel"
                  value={manager_phone_number}
                  onChange={(e) => setManager_phone_number(e.target.value)}
                  disabled={saving}
                  className={`w-full px-3 py-2 border font-ibm text-sm focus:outline-none focus:border-blue-500 ${
                    errors.manager_phone_number ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="06 12 34 56 78"
                />
                {errors.manager_phone_number && (
                  <p className="text-xs text-red-500 mt-1 font-ibm">
                    {errors.manager_phone_number}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section: Autour du spectacle */}
          {(eventHasFormation || eventHasPreparation) && (
            <div>
              <h3 className="text-sm font-poppins font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
                Autour du spectacle
              </h3>
              <div className="space-y-2">
                {eventHasFormation && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={want_formation}
                      onChange={(e) => setWant_formation(e.target.checked)}
                      disabled={saving}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 font-ibm">
                      Souhaite la formation initiale
                    </span>
                  </label>
                )}
                {eventHasPreparation && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={want_preparation}
                      onChange={(e) => setWant_preparation(e.target.checked)}
                      disabled={saving}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 font-ibm">
                      Souhaite la préparation musicale
                    </span>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Section: Handicaps / Accessibilité */}
          <div>
            <h3 className="text-sm font-poppins font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Accessibilité / Besoins spécifiques
            </h3>
            <div className="space-y-3">
              {disabilities.map((disability) => (
                <div key={disability.id} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <select
                        value={disability.type}
                        onChange={(e) =>
                          updateDisability(disability.id, 'type', e.target.value as Accessibility)
                        }
                        disabled={saving}
                        className="w-full px-3 py-2 border border-gray-300 font-ibm text-sm focus:outline-none focus:border-blue-500"
                      >
                        {ACCESSIBILITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {ACCESSIBILITY_LABELS[opt.value] || opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="number"
                        min={0}
                        value={disability.count}
                        onChange={(e) =>
                          updateDisability(disability.id, 'count', parseInt(e.target.value) || 0)
                        }
                        disabled={saving}
                        className="w-full px-3 py-2 border border-gray-300 font-ibm text-sm focus:outline-none focus:border-blue-500"
                        placeholder="Nombre"
                      />
                    </div>
                    {disability.type === Accessibility.OTHER && (
                      <div>
                        <input
                          type="text"
                          value={disability.details || ''}
                          onChange={(e) =>
                            updateDisability(disability.id, 'details', e.target.value)
                          }
                          disabled={saving}
                          className="w-full px-3 py-2 border border-gray-300 font-ibm text-sm focus:outline-none focus:border-blue-500"
                          placeholder="Détails..."
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDisability(disability.id)}
                    disabled={saving}
                    className="p-2 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 mt-0 sm:mt-0"
                    title="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addDisability}
                disabled={saving}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-poppins"
              >
                <Plus size={16} /> Ajouter un besoin
              </button>
            </div>
          </div>

          {/* Section: Public cible */}
          <div>
            <h3 className="text-sm font-poppins font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Public cible
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">Catégories</label>
                <MultiSelect
                  options={CATEGORY_OPTIONS}
                  selectedValues={category}
                  onChange={(vals) => setCategory(vals as PublicCategory[])}
                  placeholder="Sélectionner des catégories..."
                />
              </div>
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">
                  Niveaux scolaires
                </label>
                <MultiSelect
                  options={GRADE_OPTIONS}
                  selectedValues={grades}
                  onChange={(vals) => setGrades(vals as SchoolGrade[])}
                  placeholder="Sélectionner des niveaux..."
                />
              </div>
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">
                  Tranches d&apos;âge
                </label>
                <MultiSelect
                  options={AGE_RANGE_OPTIONS}
                  selectedValues={age_ranges}
                  onChange={(vals) => setAge_ranges(vals as AgeRange[])}
                  placeholder="Sélectionner des tranches..."
                />
              </div>
            </div>
          </div>

          {/* Section: Commentaires */}
          <div>
            <h3 className="text-sm font-poppins font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-200">
              Commentaires
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">
                  Commentaires de l&apos;inscription
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  disabled={saving}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 font-ibm text-sm focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Commentaires laissés par l'utilisateur..."
                />
              </div>
              <div>
                <label className="block text-sm font-poppins font-medium mb-2">
                  Commentaire présence/absence
                </label>
                <textarea
                  value={was_present_comment}
                  onChange={(e) => setWas_present_comment(e.target.value)}
                  disabled={saving}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 font-ibm text-sm focus:outline-none focus:border-blue-500 resize-none bg-amber-50"
                  placeholder="Notes internes sur la présence..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end sticky bottom-0">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors font-poppins font-medium disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || !isValid()}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors font-poppins font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Enregistrement...
              </>
            ) : (
              'Enregistrer les modifications'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
