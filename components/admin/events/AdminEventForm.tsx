'use client';

import { useState } from 'react';
import {
  EventType,
  EventStatus,
  PublicCategory,
  Accessibility,
  SchoolGrade,
  AgeRange,
  AdminEventFormData,
} from '@/types/api';
import MultiSelect from '@/components/ui/MultiSelect';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { X, Plus } from '@deemlol/next-icons';
import {
  EVENT_TYPE_LABELS as DEFAULT_EVENT_TYPE_LABELS,
  EVENT_STATUS_LABELS as DEFAULT_EVENT_STATUS_LABELS,
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  ACCESSIBILITY_LABELS as DEFAULT_ACCESSIBILITY_LABELS,
  SCHOOL_GRADE_LABELS,
  AGE_RANGE_LABELS,
} from '@/lib/config/labelMappings';

// Fields that can be protected from scraping
const PROTECTABLE_FIELDS = [
  { key: 'title', label: 'Titre' },
  { key: 'description', label: 'Description' },
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Statut' },
  { key: 'category', label: 'Public cible' },
  { key: 'location', label: 'Lieu' },
  { key: 'duration', label: 'Durée' },
  { key: 'total_seats', label: 'Places totales' },
  { key: 'image_url', label: "URL de l'image" },
  { key: 'event_dates', label: "Dates de l'événement" },
  { key: 'has_initial_formation', label: 'Formation initiale' },
  { key: 'registrationBlocks', label: 'Blocs pédagogiques' },
  { key: 'has_musical_preparation', label: 'Préparation musicale' },
] as const;

type LocalRegistrationBlock = {
  id?: string;
  title: string;
  description: string;
  dates: string[];
  enabled: boolean;
  registration_enabled: boolean;
  mandatory: boolean;
  order: number;
};

type RegistrationBlockMode = 'hidden' | 'optional' | 'required';

interface AdminEventFormProps {
  initialData?: Partial<AdminEventFormData>;
  onSubmit: (data: AdminEventFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  eventTypeLabels?: Record<string, string>;
  eventStatusLabels?: Record<string, string>;
  publicCategoryLabels?: Record<string, string>;
  accessibilityLabels?: Record<string, string>;
}

/**
 * AdminEventForm component
 * Form for creating and editing events.
 * Handles:
 * - Basic info (title, description, location)
 * - Multiple dates management
 * - Categorization (Type, Age range, Accessibility)
 * - Status management
 * - Image URL
 *
 * @param initialData - Optional initial data for editing
 * @param onSubmit - Callback when form is submitted
 * @param onCancel - Callback when cancel button is clicked
 * @param loading - Loading state for submit button
 */
export default function AdminEventForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
  eventTypeLabels,
  eventStatusLabels,
  publicCategoryLabels,
  accessibilityLabels,
}: AdminEventFormProps) {
  // Use dynamic labels if provided, otherwise fall back to static defaults
  const EVENT_TYPE_LABELS = eventTypeLabels || DEFAULT_EVENT_TYPE_LABELS;
  const EVENT_STATUS_LABELS = eventStatusLabels || DEFAULT_EVENT_STATUS_LABELS;
  const PUBLIC_CATEGORY_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;
  const ACCESSIBILITY_LABELS = accessibilityLabels || DEFAULT_ACCESSIBILITY_LABELS;

  // Helper: Convert UTC ISO string to local datetime-local format (YYYY-MM-DDTHH:mm)
  const utcToDatetimeLocal = (isoString: string): string => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper: Convert local datetime-local format to UTC ISO string
  const datetimeLocalToUtc = (datetimeLocal: string): string => {
    // Parse the datetime-local as local time (not UTC)
    const [datePart, timePart] = datetimeLocal.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    // Create date using local time components
    const date = new Date(year, month - 1, day, hours, minutes);
    return date.toISOString();
  };

  const initialRegistrationBlocks: LocalRegistrationBlock[] =
    initialData?.registrationBlocks && initialData.registrationBlocks.length > 0
      ? initialData.registrationBlocks.map((block, index) => ({
          id: block.id,
          title: block.title,
          description: block.description ?? '',
          dates: (block.dates || []).map((date) => utcToDatetimeLocal(date)),
          enabled: block.enabled ?? true,
          registration_enabled: block.enabled !== false,
          mandatory: block.enabled !== false && (block.mandatory ?? false),
          order: block.order ?? index,
        }))
      : initialData?.has_initial_formation
        ? [
            {
              title: 'Formation initiale',
              description: '',
              dates: [],
              enabled: true,
              registration_enabled: true,
              mandatory: initialData.is_formation_mandatory ?? false,
              order: 0,
            },
          ]
        : [];

  const [formData, setFormData] = useState({
    title: initialData?.title ?? '',
    description: initialData?.description ?? '',
    type: initialData?.type ?? [],
    location: initialData?.location ?? '',
    duration: initialData?.duration ?? 60,
    total_seats: initialData?.total_seats ?? 100,
    status: initialData?.status ?? (EventStatus.OPEN as EventStatus),
    image_url: initialData?.image_url ?? '',
    event_dates: initialData?.event_dates
      ? initialData.event_dates.map((d: string) => utcToDatetimeLocal(d))
      : [],
    category: initialData?.category ?? [],
    grades: initialData?.grades ?? [],
    age_ranges: initialData?.age_ranges ?? [],
    has_initial_formation: initialData?.has_initial_formation ?? false,
    is_formation_mandatory: initialData?.is_formation_mandatory ?? false,
    has_musical_preparation: initialData?.has_musical_preparation ?? false,
    registrationBlocks: initialRegistrationBlocks,
    accessibility: initialData?.accessibility
      ? (initialData.accessibility as Array<{ type: Accessibility } | Accessibility>).map((a) =>
          typeof a === 'string' ? a : a.type,
        )
      : [],
    protected_fields: initialData?.protected_fields ?? [],
  });

  const [showProtectionSettings, setShowProtectionSettings] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const registrationBlocks = formData.registrationBlocks.map((block, index) => ({
      ...block,
      registration_enabled: block.enabled,
      mandatory: block.enabled && block.mandatory,
      order: index,
      dates: block.dates.map((date) => datetimeLocalToUtc(date)),
    }));
    const hasRegistrationBlocks = registrationBlocks.some((block) => block.enabled);
    const hasMandatoryRegistrationBlock = registrationBlocks.some(
      (block) => block.enabled && block.registration_enabled && block.mandatory,
    );
    // Convert dates back to ISO strings if needed, but the API expects ISO strings
    // The datetime-local input gives 'YYYY-MM-DDTHH:mm'
    const payload: AdminEventFormData = {
      ...formData,
      type: formData.type as EventType[],
      category: formData.category as PublicCategory[],
      grades: formData.grades as SchoolGrade[],
      age_ranges: formData.age_ranges as AgeRange[],
      accessibility: formData.accessibility,
      event_dates: formData.event_dates.map((d) => datetimeLocalToUtc(d)),
      has_initial_formation: hasRegistrationBlocks,
      is_formation_mandatory: hasMandatoryRegistrationBlock,
      registrationBlocks,
      protected_fields: formData.protected_fields,
    };
    onSubmit(payload);
  };

  const addDate = () => {
    const now = new Date();
    const datetimeLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setFormData((prev) => ({
      ...prev,
      event_dates: [...prev.event_dates, datetimeLocal],
    }));
  };

  const removeDate = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      event_dates: prev.event_dates.filter((_, i) => i !== index),
    }));
  };

  const updateDate = (index: number, value: string) => {
    const newDates = [...formData.event_dates];
    newDates[index] = value;
    setFormData((prev) => ({ ...prev, event_dates: newDates }));
  };

  const addRegistrationBlock = () => {
    setFormData((prev) => ({
      ...prev,
      registrationBlocks: [
        ...prev.registrationBlocks,
        {
          title: 'Formation initiale',
          description: '',
          dates: [],
          enabled: true,
          registration_enabled: true,
          mandatory: false,
          order: prev.registrationBlocks.length,
        },
      ],
    }));
  };

  const updateRegistrationBlock = (index: number, updates: Partial<LocalRegistrationBlock>) => {
    setFormData((prev) => ({
      ...prev,
      registrationBlocks: prev.registrationBlocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...updates } : block,
      ),
    }));
  };

  const getRegistrationBlockMode = (block: LocalRegistrationBlock): RegistrationBlockMode => {
    if (!block.enabled) return 'hidden';
    return block.mandatory ? 'required' : 'optional';
  };

  const updateRegistrationBlockMode = (index: number, mode: RegistrationBlockMode) => {
    updateRegistrationBlock(index, {
      enabled: mode !== 'hidden',
      registration_enabled: mode !== 'hidden',
      mandatory: mode === 'required',
    });
  };

  const removeRegistrationBlock = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      registrationBlocks: prev.registrationBlocks.filter((_, blockIndex) => blockIndex !== index),
    }));
  };

  const addRegistrationBlockDate = (index: number) => {
    const now = new Date();
    const datetimeLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setFormData((prev) => ({
      ...prev,
      registrationBlocks: prev.registrationBlocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, dates: [...block.dates, datetimeLocal] } : block,
      ),
    }));
  };

  const updateRegistrationBlockDate = (blockIndex: number, dateIndex: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      registrationBlocks: prev.registrationBlocks.map((block, currentBlockIndex) =>
        currentBlockIndex === blockIndex
          ? {
              ...block,
              dates: block.dates.map((date, currentDateIndex) =>
                currentDateIndex === dateIndex ? value : date,
              ),
            }
          : block,
      ),
    }));
  };

  const removeRegistrationBlockDate = (blockIndex: number, dateIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      registrationBlocks: prev.registrationBlocks.map((block, currentBlockIndex) =>
        currentBlockIndex === blockIndex
          ? {
              ...block,
              dates: block.dates.filter((_, currentDateIndex) => currentDateIndex !== dateIndex),
            }
          : block,
      ),
    }));
  };

  const typeOptions = Object.values(EventType).map((t) => ({
    value: t,
    label: EVENT_TYPE_LABELS[t] || t,
  }));
  const statusOptions = Object.values(EventStatus).map((s) => ({
    value: s,
    label: EVENT_STATUS_LABELS[s] || s,
  }));
  const categoryOptions = Object.values(PublicCategory).map((t) => ({
    value: t,
    label: PUBLIC_CATEGORY_LABELS[t] || t,
  }));
  const gradeOptions = Object.values(SchoolGrade).map((g) => ({
    value: g,
    label: SCHOOL_GRADE_LABELS[g] || g,
  }));
  const ageRangeOptions = Object.values(AgeRange).map((a) => ({
    value: a,
    label: AGE_RANGE_LABELS[a] || a,
  }));
  const accessibilityOptions = Object.values(Accessibility).map((a) => ({
    value: a,
    label: ACCESSIBILITY_LABELS[a] || a,
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <RichTextEditor
              value={formData.description}
              onChange={(description) => setFormData({ ...formData, description })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
            <input
              required
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durée (min)</label>
              <input
                required
                type="number"
                min={1}
                value={formData.duration}
                onChange={(e) =>
                  setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })
                }
                className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Places totales</label>
              <input
                required
                type="number"
                min={1}
                value={formData.total_seats}
                onChange={(e) =>
                  setFormData({ ...formData, total_seats: parseInt(e.target.value) || 0 })
                }
                className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type(s)</label>
            <MultiSelect
              options={typeOptions}
              selectedValues={formData.type}
              onChange={(vals) => setFormData({ ...formData, type: vals as EventType[] })}
              placeholder="Sélectionner..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
              className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Public cible</label>
            <MultiSelect
              options={categoryOptions}
              selectedValues={formData.category}
              onChange={(vals) => setFormData({ ...formData, category: vals as PublicCategory[] })}
              placeholder="Sélectionner..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Niveaux scolaires
            </label>
            <MultiSelect
              options={gradeOptions}
              selectedValues={formData.grades}
              onChange={(vals) => setFormData({ ...formData, grades: vals as SchoolGrade[] })}
              placeholder="Sélectionner..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tranches d&apos;âge
            </label>
            <MultiSelect
              options={ageRangeOptions}
              selectedValues={formData.age_ranges}
              onChange={(vals) => setFormData({ ...formData, age_ranges: vals as AgeRange[] })}
              placeholder="Sélectionner..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Accessibilité</label>
            <MultiSelect
              options={accessibilityOptions}
              selectedValues={formData.accessibility}
              onChange={(vals) =>
                setFormData({ ...formData, accessibility: vals as Accessibility[] })
              }
              placeholder="Sélectionner..."
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_musical_preparation}
                onChange={(e) =>
                  setFormData({ ...formData, has_musical_preparation: e.target.checked })
                }
                className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
              />
              <span className="text-sm text-gray-700">Préparation musicale disponible</span>
            </label>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Dates de l&apos;événement
          </label>
          <button
            type="button"
            onClick={addDate}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <Plus size={16} /> Ajouter une date
          </button>
        </div>
        <div className="space-y-2">
          {formData.event_dates.map((date, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => updateDate(index, e.target.value)}
                className="flex-1 p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                required
              />
              <button
                type="button"
                onClick={() => removeDate(index)}
                className="p-2 text-red-600 hover:bg-red-50 transition-colors"
                title="Supprimer"
              >
                <X size={20} />
              </button>
            </div>
          ))}
          {formData.event_dates.length === 0 && (
            <p className="text-sm text-gray-500 italic">Aucune date définie.</p>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Blocs pédagogiques</h3>
            <p className="text-xs text-gray-500 mt-1">
              Ajoutez des formations, ateliers ou autres activités associées à cet événement.
            </p>
          </div>
          <button
            type="button"
            onClick={addRegistrationBlock}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <Plus size={16} /> Ajouter un bloc
          </button>
        </div>

        <div className="space-y-4">
          {formData.registrationBlocks.map((block, blockIndex) => (
            <div key={block.id || blockIndex} className="border border-gray-200 p-4 bg-gray-50">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">Mode côté utilisateur</span>
                    <select
                      value={getRegistrationBlockMode(block)}
                      onChange={(e) =>
                        updateRegistrationBlockMode(
                          blockIndex,
                          e.target.value as RegistrationBlockMode,
                        )
                      }
                      className="p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black bg-white text-sm"
                    >
                      <option value="hidden">Masqué</option>
                      <option value="optional">Inscription optionnelle</option>
                      <option value="required">Inscription obligatoire</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeRegistrationBlock(blockIndex)}
                  className="p-2 text-red-600 hover:bg-red-50 transition-colors"
                  title="Supprimer le bloc"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                  <input
                    required
                    type="text"
                    value={block.title}
                    onChange={(e) => updateRegistrationBlock(blockIndex, { title: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black bg-white"
                    placeholder="Formation initiale, Atelier..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Texte explicatif
                  </label>
                  <textarea
                    value={block.description}
                    onChange={(e) =>
                      updateRegistrationBlock(blockIndex, { description: e.target.value })
                    }
                    className="w-full min-h-24 p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black bg-white"
                    placeholder="Informations utiles pour les inscrits..."
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Dates du bloc</label>
                  <button
                    type="button"
                    onClick={() => addRegistrationBlockDate(blockIndex)}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Plus size={16} /> Ajouter une date
                  </button>
                </div>
                <div className="space-y-2">
                  {block.dates.map((date, dateIndex) => (
                    <div key={`${blockIndex}-${dateIndex}`} className="flex gap-2">
                      <input
                        type="datetime-local"
                        value={date}
                        onChange={(e) =>
                          updateRegistrationBlockDate(blockIndex, dateIndex, e.target.value)
                        }
                        className="flex-1 p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeRegistrationBlockDate(blockIndex, dateIndex)}
                        className="p-2 text-red-600 hover:bg-red-50 transition-colors"
                        title="Supprimer"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ))}
                  {block.dates.length === 0 && (
                    <p className="text-sm text-gray-500 italic">
                      Aucune date définie pour ce bloc.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {formData.registrationBlocks.length === 0 && (
            <p className="text-sm text-gray-500 italic">Aucun bloc pédagogique défini.</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL de l&apos;image</label>
        <input
          type="url"
          value={formData.image_url}
          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
          className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
          placeholder="https://..."
        />
      </div>

      {/* Protection contre le scraping */}
      <div className="border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={() => setShowProtectionSettings(!showProtectionSettings)}
          className="flex items-center justify-between w-full text-left"
        >
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              Protection contre le scraping
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Empêcher le scraping d&apos;écraser certains champs
              {formData.protected_fields.length > 0 &&
                ` (${formData.protected_fields.length} protégé${formData.protected_fields.length > 1 ? 's' : ''})`}
            </p>
          </div>
          <Plus
            size={20}
            className={`text-gray-400 transition-transform ${showProtectionSettings ? 'rotate-45' : ''}`}
          />
        </button>

        {showProtectionSettings && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-none">
            <p className="text-xs text-amber-800 mb-3">
              Les champs protégés ne seront pas mis à jour par le scraping automatique depuis le
              site de l&apos;Opéra. Le statut protégé est aussi exclu des ouvertures et fermetures
              automatiques.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PROTECTABLE_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.protected_fields.includes(field.key)}
                    onChange={(e) => {
                      const newProtected = e.target.checked
                        ? [...formData.protected_fields, field.key]
                        : formData.protected_fields.filter((f) => f !== field.key);
                      setFormData({ ...formData, protected_fields: newProtected });
                    }}
                    className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                  />
                  <span className="text-sm text-gray-700">{field.label}</span>
                </label>
              ))}
            </div>
            {formData.protected_fields.length > 0 && (
              <button
                type="button"
                onClick={() => setFormData({ ...formData, protected_fields: [] })}
                className="mt-3 text-xs text-amber-700 hover:text-amber-900 underline"
              >
                Tout déprotéger
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 border border-gray-300 rounded-none hover:bg-gray-50 transition-colors font-medium text-sm"
          disabled={loading}
        >
          Annuler
        </button>
        <button
          type="submit"
          className="px-5 py-2.5 bg-black text-white rounded-none hover:bg-gray-800 transition-colors font-medium text-sm disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
