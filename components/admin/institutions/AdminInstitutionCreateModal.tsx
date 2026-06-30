'use client';

import { useState } from 'react';
import { X } from '@deemlol/next-icons';
import { PublicCategory } from '@/types/api';
import { SchoolGrade, AgeRange } from '@/app/generated/prisma/enums';
import { fetchJsonWithAuth } from '@/lib/api/fetchWithAuth';
import toast from '@/lib/utils/toast';
import Loader from '@/components/ui/Loader';
import MultiSelect from '@/components/ui/MultiSelect';
import {
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  SCHOOL_GRADE_LABELS,
  AGE_RANGE_LABELS,
} from '@/lib/config/labelMappings';
import { getGradesForSchoolTypes } from '@/lib/config/badgeConstants';

interface AdminInstitutionCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  publicCategoryLabels?: Record<string, string>;
}

/**
 * AdminInstitutionCreateModal component
 * Modal for creating a new institution.
 * Features:
 * - Basic info (name, email, phone)
 * - Address fields
 * - Type selection (school, association, etc.)
 * - New: Grades selection (SchoolGrade) for schools
 * - New: Age Ranges selection (AgeRange) for non-school institutions
 *
 * @param isOpen - Whether the modal is open
 * @param onClose - Callback to close the modal
 * @param onSuccess - Callback when creation is successful
 */
export default function AdminInstitutionCreateModal({
  isOpen,
  onClose,
  onSuccess,
  publicCategoryLabels,
}: AdminInstitutionCreateModalProps) {
  // Use dynamic labels if provided, otherwise fall back to static defaults
  const PUBLIC_CATEGORY_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_number: '',
    street: '',
    zip_code: '',
    city: '',
    type: [] as PublicCategory[],
    grades: [] as SchoolGrade[],
    age_ranges: [] as AgeRange[],
  });

  const typeOptions = Object.values(PublicCategory).map((t) => ({
    value: t,
    label: PUBLIC_CATEGORY_LABELS[t] || t,
  }));

  // School Grade options filtered by selected school types
  const relevantGrades = getGradesForSchoolTypes(formData.type);
  const gradeOptions = relevantGrades.map((g) => ({
    value: g,
    label: SCHOOL_GRADE_LABELS[g] || g,
  }));

  // Age Range options (for ASSOCIATION, CONSERVATOIRE, PERISCOLAIRE, PUBLICS_EMPECHES, AUTRE)
  const ageRangeOptions = Object.values(AgeRange).map((ar) => ({
    value: ar,
    label: AGE_RANGE_LABELS[ar] || ar,
  }));

  // Determine if grade selector should be shown (for school types)
  const shouldShowGrades = formData.type.some((t) =>
    ['MATERNELLE', 'ELEMENTAIRE', 'COLLEGE', 'LYCEE'].includes(t),
  );

  // Determine if age range selector should be shown (for non-school types)
  const shouldShowAgeRanges = formData.type.some((t) =>
    ['ASSOCIATION', 'PERISCOLAIRE', 'PUBLICS_EMPECHES', 'CONSERVATOIRE', 'AUTRE'].includes(t),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        email: formData.email || undefined,
        phone_number: formData.phone_number || undefined,
        address: {
          street: formData.street,
          zip_code: formData.zip_code,
          city: formData.city,
        },
        type: formData.type,
        grades: formData.grades,
        age_ranges: formData.age_ranges,
      };

      const { response, data } = await fetchJsonWithAuth('/api/institutions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 409) {
          // Handle duplicate warning - for now just show error,
          // could implement force_create UI later if needed but simple error is safer
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          throw new Error((data as any).error || 'Cette institution semble déjà exister.');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw new Error((data as any).error || "Erreur lors de la création de l'institution");
      }

      toast('Institution créée avec succès', 'success');
      onSuccess();
      onClose();
      // Reset form
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
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl border border-gray-200">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
          <h3 className="text-xl font-poppins font-semibold">Créer un établissement</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de l&apos;établissement <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: École Jules Ferry"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <MultiSelect
              options={typeOptions}
              selectedValues={formData.type}
              onChange={(vals) => {
                const newTypes = vals as PublicCategory[];
                const newRelevantGrades = getGradesForSchoolTypes(newTypes);
                // Remove grades that are no longer relevant for the selected types
                const filteredGrades = formData.grades.filter((g) => newRelevantGrades.includes(g));
                setFormData({ ...formData, type: newTypes, grades: filteredGrades });
              }}
              placeholder="Sélectionner le(s) type(s)..."
            />
          </div>

          {/* Grades (Conditional for school types) */}
          {shouldShowGrades && (
            <div className="p-4 bg-purple-50 border border-purple-100 rounded-md">
              <label className="block text-sm font-medium text-purple-900 mb-1">
                Niveaux scolaires
              </label>
              <p className="text-xs text-purple-700 mb-2">
                Sélectionnez tous les niveaux concernés par cet établissement.
              </p>
              <MultiSelect
                options={gradeOptions}
                selectedValues={formData.grades}
                onChange={(vals) => setFormData({ ...formData, grades: vals as SchoolGrade[] })}
                placeholder="Sélectionner les niveaux..."
              />
            </div>
          )}

          {/* Age Ranges (Conditional for non-school types) */}
          {shouldShowAgeRanges && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-md">
              <label className="block text-sm font-medium text-blue-900 mb-1">
                Tranches d&apos;âge du public
              </label>
              <p className="text-xs text-blue-700 mb-2">
                Utile pour les associations et conservatoires afin de cibler le bon public.
              </p>
              <MultiSelect
                options={ageRangeOptions}
                selectedValues={formData.age_ranges}
                onChange={(vals) => setFormData({ ...formData, age_ranges: vals as AgeRange[] })}
                placeholder="Sélectionner les tranches d'âge..."
              />
            </div>
          )}

          {/* Address */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-1">
              Adresse
            </h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rue <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                placeholder="Ex: 12 rue de la Paix"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code postal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  placeholder="Ex: 34000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ville <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Ex: Montpellier"
                />
              </div>
            </div>
          </div>

          {/* Contact (Optional) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-1">
              Contact (Optionnel)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@ecole.fr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="04 67 ..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader />}
              Créer l&apos;établissement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
