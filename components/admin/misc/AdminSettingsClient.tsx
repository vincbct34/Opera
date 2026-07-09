'use client';

import { useState } from 'react';
import { Save, RotateCcw, ChevronDown, ChevronUp, Edit2 } from '@deemlol/next-icons';
import toast from '@/lib/utils/toast';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import type { ConfigCategory } from '@/lib/config/configService';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';
import HeroImageSettings from '@/components/admin/misc/HeroImageSettings';

interface AdminSettingsClientProps {
  initialConfigs: Record<ConfigCategory, Record<string, string>>;
  initialHeroImage: string | null;
}

const CATEGORY_LABELS: Partial<Record<ConfigCategory, { title: string; description: string }>> = {
  accessibility_labels: {
    title: 'Types de besoins spécifiques',
    description: 'Labels affichés pour les différents types de besoins spécifiques',
  },
  public_category_labels: {
    title: 'Catégories de public',
    description: "Labels affichés pour les types d'établissements (crèche, école, etc.)",
  },
  event_type_labels: {
    title: "Types d'événements",
    description: "Labels affichés pour les catégories d'événements",
  },
  registration_status_labels: {
    title: "Statuts d'inscription",
    description: 'Labels affichés pour les différents statuts des inscriptions',
  },
  event_status_labels: {
    title: "Statuts d'événement",
    description: 'Labels affichés pour les statuts des événements (ouvert/fermé)',
  },
  school_grade_labels: {
    title: 'Niveaux scolaires',
    description: 'Labels affichés pour les niveaux scolaires (PS, MS, GS, CP, etc.)',
  },
  age_range_labels: {
    title: "Tranches d'âge",
    description: 'Labels affichés pour les tranches dâge (0-3 ans, 3-6 ans, etc.)',
  },
};

export default function AdminSettingsClient({
  initialConfigs,
  initialHeroImage,
}: AdminSettingsClientProps) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [editingCategory, setEditingCategory] = useState<ConfigCategory | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<ConfigCategory>>(new Set());
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<ConfigCategory | null>(null);
  const [resetConfirmModal, setResetConfirmModal] = useState<ConfigCategory | null>(null);

  const toggleExpand = (category: ConfigCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const startEditing = (category: ConfigCategory) => {
    setEditingCategory(category);
    setEditValues({ ...configs[category] });
    setExpandedCategories((prev) => new Set(prev).add(category));
  };

  const cancelEditing = () => {
    setEditingCategory(null);
    setEditValues({});
  };

  const handleValueChange = (key: string, value: string) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
  };

  const saveChanges = async () => {
    if (!editingCategory) return;

    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: editingCategory,
          values: editValues,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde');
      }

      // Update local state
      setConfigs((prev) => ({
        ...prev,
        [editingCategory]: data.config,
      }));

      setEditingCategory(null);
      setEditValues({});
      toast('Configuration sauvegardée', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = (category: ConfigCategory) => {
    // Open confirmation modal instead of native confirm
    setResetConfirmModal(category);
  };

  const confirmReset = async () => {
    const category = resetConfirmModal;
    if (!category) return;

    setResetConfirmModal(null);
    setResetting(category);
    try {
      const res = await fetchWithAuth(`/api/admin/config?category=${category}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la réinitialisation');
      }

      // Update local state
      setConfigs((prev) => ({
        ...prev,
        [category]: data.config,
      }));

      if (editingCategory === category) {
        setEditingCategory(null);
        setEditValues({});
      }

      toast('Configuration réinitialisée', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast(message, 'error');
    } finally {
      setResetting(null);
    }
  };

  return (
    <main className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        {/* Header */}
        <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">
              Paramètres
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-700 font-ibm">
              Personnalisez les labels et textes affichés dans l&apos;application
            </p>
          </div>
        </header>

        {/* Content */}
        <div className="space-y-4">
          <HeroImageSettings initialHeroImage={initialHeroImage} />

          {(Object.keys(CATEGORY_LABELS) as ConfigCategory[]).map((category) => {
            const labelConfig = CATEGORY_LABELS[category];
            if (!labelConfig) return null;
            const { title, description } = labelConfig;
            const isExpanded = expandedCategories.has(category);
            const isEditing = editingCategory === category;
            const config = isEditing ? editValues : configs[category];

            return (
              <div key={category} className="bg-white border border-gray-200 overflow-hidden">
                {/* Category Header */}
                <div
                  className="px-4 sm:px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpand(category)}
                >
                  <div className="flex-1">
                    <h2 className="font-poppins font-semibold text-gray-900">{title}</h2>
                    <p className="text-sm text-gray-500">{description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(category);
                        }}
                        className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Category Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200">
                    <div className="px-4 sm:px-6 py-4">
                      <div className="space-y-3">
                        {Object.entries(config).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-4">
                            <div className="w-1/3 sm:w-1/4">
                              <code className="text-xs sm:text-sm bg-gray-100 px-2 py-1 text-gray-600">
                                {key}
                              </code>
                            </div>
                            <div className="flex-1">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={value}
                                  onChange={(e) => handleValueChange(key, e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 text-sm focus:ring-2 focus:ring-black focus:border-black"
                                />
                              ) : (
                                <span className="text-sm text-gray-900">{value}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveChanges}
                              disabled={saving}
                              className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-poppins font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <Save className="w-4 h-4" />
                              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={saving}
                              className="px-4 py-2 border border-gray-300 text-sm font-poppins font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => resetToDefaults(category)}
                            disabled={resetting === category}
                            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-sm font-poppins font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="w-4 h-4" />
                            {resetting === category ? 'Réinitialisation...' : 'Réinitialiser'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Reset Confirmation Modal */}
        <ConfirmationModal
          open={resetConfirmModal !== null}
          title="Réinitialiser la configuration"
          description="Êtes-vous sûr de vouloir réinitialiser cette catégorie aux valeurs par défaut ? Cette action est irréversible."
          onCancel={() => setResetConfirmModal(null)}
          onConfirm={confirmReset}
        />

        {/* Info Box */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200">
          <h3 className="font-poppins font-semibold text-blue-900 mb-2">Information</h3>
          <p className="text-sm text-blue-800">
            Les modifications sont appliquées peu de temps après la sauvegarde. Les labels
            personnalisés s&apos;afficheront dans toute l&apos;application (formulaires, listes,
            exports, etc.).
          </p>
          <p className="text-sm text-blue-800 mt-2">
            La réinitialisation restaure les valeurs par défaut du système.
          </p>
        </div>
      </div>

      <HelpWidget content={HELP_CONTENTS['admin-settings']} isAdminPage={true} />
    </main>
  );
}
