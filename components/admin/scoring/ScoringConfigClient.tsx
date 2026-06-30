'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import Loader from '@/components/ui/Loader';
import toast from '@/lib/utils/toast';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { Plus, Edit, Trash2, Copy, Eye, ChevronDown, ChevronUp } from '@deemlol/next-icons';
import { CRITERIA_DEFINITIONS } from '@/lib/scoring/criteriaDefinitions';
import type { ScoringCriterionType, ParameterValue } from '@/lib/scoring/criteriaDefinitions';
import type { PreviewData } from '@/types/scoring';
import ConfigEditor from '@/components/admin/scoring/ConfigEditor';
import PreviewModal from '@/components/admin/scoring/PreviewModal';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

interface CriterionData {
  id?: string;
  type: ScoringCriterionType;
  enabled: boolean;
  weight: number;
  parameters?: Record<string, ParameterValue>;
  order: number;
}

interface ConfigurationData {
  id?: string;
  name: string;
  is_default: boolean;
  event_id?: string | null;
  criteria: CriterionData[];
  event?: { id: string; title: string } | null;
}

interface ScoringConfigClientProps {
  initialConfigurations: ConfigurationData[];
  sampleEvent: { id: string; title: string } | null;
}

/**
 * ScoringConfigClient component
 * Management interface for scoring configurations.
 * Features:
 * - List existing configurations
 * - Create/Edit/Duplicate configurations
 * - Manage scoring criteria and weights
 * - Preview scoring results on a sample event
 *
 * @param initialConfigurations - List of existing configurations
 * @param sampleEvent - Optional event for previewing scoring logic
 */
export default function ScoringConfigClient({
  initialConfigurations,
  sampleEvent,
}: ScoringConfigClientProps) {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  const [configurations, setConfigurations] = useState<ConfigurationData[]>(initialConfigurations);
  const [editingConfig, setEditingConfig] = useState<ConfigurationData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<string | null>(null);
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Redirect non-admin users
  useEffect(() => {
    if (!userLoading && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN'))) {
      router.push('/');
    }
  }, [user, userLoading, router]);

  if (userLoading) {
    return (
      <main className="flex justify-center items-center h-[90vh]">
        <Loader />
      </main>
    );
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    return null;
  }

  const fetchConfigurations = async () => {
    try {
      const response = await fetchWithAuth('/api/admin/scoring-config');
      const data = await response.json();
      if (response.ok && data.success) {
        setConfigurations(data.configurations);
      }
    } catch {
      toast('Erreur lors du chargement des configurations', 'error');
    }
  };

  const handleCreateNew = () => {
    // Créer une configuration vide avec tous les critères par défaut
    const defaultCriteria: CriterionData[] = Object.values(CRITERIA_DEFINITIONS).map(
      (def, index) => ({
        type: def.type,
        enabled: def.defaultEnabled,
        weight: def.defaultWeight,
        parameters: def.defaultParameters,
        order: index,
      }),
    );

    setEditingConfig({
      name: 'Nouvelle configuration',
      is_default: false,
      criteria: defaultCriteria,
    });
    setIsCreating(true);
  };

  const handleEdit = (config: ConfigurationData) => {
    setEditingConfig(config);
    setIsCreating(false);
  };

  const handleDuplicate = (config: ConfigurationData) => {
    setEditingConfig({
      ...config,
      id: undefined,
      name: `${config.name} (copie)`,
      is_default: false,
    });
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!editingConfig) return;

    // Validation
    if (!editingConfig.name.trim()) {
      toast('Le nom est requis', 'error');
      return;
    }

    const enabledCriteria = editingConfig.criteria.filter((c) => c.enabled);
    if (enabledCriteria.length === 0) {
      toast('Au moins un critère doit être activé', 'error');
      return;
    }

    const totalWeight = enabledCriteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight !== 100) {
      toast(`Le poids total doit être 100% (actuellement: ${totalWeight}%)`, 'error');
      return;
    }

    setSaving(true);
    try {
      const url = isCreating
        ? '/api/admin/scoring-config'
        : `/api/admin/scoring-config/${editingConfig.id}`;
      const method = isCreating ? 'POST' : 'PATCH';

      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingConfig.name,
          is_default: editingConfig.is_default,
          criteria: editingConfig.criteria.map((c) => ({
            type: c.type,
            enabled: c.enabled,
            weight: c.weight,
            parameters: c.parameters || {},
            order: c.order,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde');
      }

      toast(isCreating ? 'Configuration créée' : 'Configuration mise à jour', 'success');
      setEditingConfig(null);
      setIsCreating(false);
      await fetchConfigurations();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (configId: string) => {
    try {
      const response = await fetchWithAuth(`/api/admin/scoring-config/${configId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur lors de la suppression');
      }

      toast('Configuration supprimée', 'success');
      setDeleteModalOpen(false);
      setConfigToDelete(null);
      await fetchConfigurations();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      toast(msg, 'error');
    }
  };

  const handlePreview = async (config: ConfigurationData) => {
    if (!sampleEvent) {
      toast('Aucun événement disponible pour la prévisualisation', 'error');
      return;
    }

    setLoadingPreview(true);
    setPreviewModalOpen(true);

    try {
      const response = await fetchWithAuth(`/api/admin/scoring-config/${config.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: sampleEvent.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la prévisualisation');
      }

      setPreviewData(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      toast(msg, 'error');
      setPreviewModalOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const updateCriterion = (index: number, updates: Partial<CriterionData>) => {
    if (!editingConfig) return;

    const newCriteria = [...editingConfig.criteria];
    newCriteria[index] = { ...newCriteria[index], ...updates };

    setEditingConfig({
      ...editingConfig,
      criteria: newCriteria,
    });
  };

  const getTotalWeight = () => {
    if (!editingConfig) return 0;
    return editingConfig.criteria.filter((c) => c.enabled).reduce((sum, c) => sum + c.weight, 0);
  };

  return (
    <div className="p-4 sm:p-6 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="mb-6 sm:mb-8 w-full">
        <h1 className="text-2xl sm:text-3xl font-poppins font-semibold mb-2">
          Configuration des critères de scoring
        </h1>
        <p className="text-sm sm:text-base text-gray-600 font-ibm">
          Gérez les configurations de tri pour les demandes d&apos;inscription
        </p>
      </div>

      {/* Liste des configurations ou éditeur */}
      {editingConfig ? (
        // === MODE ÉDITION ===
        <ConfigEditor
          config={editingConfig}
          isCreating={isCreating}
          saving={saving}
          totalWeight={getTotalWeight()}
          onCancel={() => {
            setEditingConfig(null);
            setIsCreating(false);
          }}
          onSave={handleSave}
          onUpdate={(updates) => setEditingConfig({ ...editingConfig, ...updates })}
          onUpdateCriterion={updateCriterion}
          sampleEvent={sampleEvent}
        />
      ) : (
        // === MODE LISTE ===
        <div>
          {/* Action Button */}
          <div className="mb-4">
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors font-poppins font-medium flex items-center gap-2"
            >
              <Plus size={18} />
              Nouvelle configuration
            </button>
          </div>

          {/* Configurations List */}
          <div className="space-y-4">
            {configurations.length === 0 ? (
              <div className="bg-white border border-gray-200 p-8 text-center">
                <p className="text-gray-500 font-ibm">Aucune configuration disponible</p>
              </div>
            ) : (
              configurations.map((config) => (
                <ConfigurationCard
                  key={config.id}
                  config={config}
                  expanded={expandedConfig === config.id}
                  onToggleExpand={() =>
                    setExpandedConfig(expandedConfig === config.id ? null : (config.id ?? null))
                  }
                  onEdit={() => handleEdit(config)}
                  onDuplicate={() => handleDuplicate(config)}
                  onDelete={() => {
                    setConfigToDelete(config.id ?? null);
                    setDeleteModalOpen(true);
                  }}
                  onPreview={() => handlePreview(config)}
                  sampleEventAvailable={!!sampleEvent}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={deleteModalOpen}
        title="Supprimer la configuration"
        description="Êtes-vous sûr de vouloir supprimer cette configuration ? Cette action est irréversible."
        onCancel={() => {
          setDeleteModalOpen(false);
          setConfigToDelete(null);
        }}
        onConfirm={() => configToDelete && handleDelete(configToDelete)}
      />

      {/* Preview Modal */}
      {previewModalOpen && (
        <PreviewModal
          open={previewModalOpen}
          data={previewData as unknown as React.ComponentProps<typeof PreviewModal>['data']}
          loading={loadingPreview}
          sampleEvent={sampleEvent}
          onClose={() => {
            setPreviewModalOpen(false);
            setPreviewData(null);
          }}
        />
      )}

      <HelpWidget content={HELP_CONTENTS['admin-scoring']} isAdminPage={true} />
    </div>
  );
}

// Sous-composants à créer dans des fichiers séparés
// Voici les interfaces pour référence

function ConfigurationCard({
  config,
  expanded,
  onToggleExpand,
  onEdit,
  onDuplicate,
  onDelete,
  onPreview,
  sampleEventAvailable,
}: {
  config: ConfigurationData;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPreview: () => void;
  sampleEventAvailable: boolean;
}) {
  const enabledCriteria = config.criteria.filter((c) => c.enabled);
  const totalWeight = enabledCriteria.reduce((sum, c) => sum + c.weight, 0);

  return (
    <div className="bg-white border border-gray-200 shadow-sm">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg sm:text-xl font-poppins font-semibold">{config.name}</h3>
              {config.is_default && (
                <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-poppins font-medium">
                  Par défaut
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 font-ibm">
              <span>{enabledCriteria.length} critères actifs</span>
              <span>Poids total: {totalWeight}%</span>
              {config.event && <span>Événement: {config.event.title}</span>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            {sampleEventAvailable && (
              <button
                onClick={onPreview}
                className="px-3 py-1.5 text-xs border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors font-poppins font-medium flex items-center gap-1 shrink-0"
              >
                <Eye size={14} />
                <span className="hidden sm:inline">Aperçu</span>
              </button>
            )}
            <button
              onClick={onEdit}
              className="px-3 py-1.5 text-xs border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors font-poppins font-medium flex items-center gap-1 shrink-0"
            >
              <Edit size={14} />
              <span className="hidden sm:inline">Modifier</span>
            </button>
            <button
              onClick={onDuplicate}
              className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-poppins font-medium flex items-center gap-1 shrink-0"
            >
              <Copy size={14} />
              <span className="hidden sm:inline">Dupliquer</span>
            </button>
            {!config.is_default && (
              <button
                onClick={onDelete}
                className="px-3 py-1.5 text-xs border border-red-300 text-red-600 hover:bg-red-50 transition-colors font-poppins font-medium flex items-center gap-1 shrink-0"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Supprimer</span>
              </button>
            )}
            <button
              onClick={onToggleExpand}
              className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-poppins font-medium shrink-0"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-poppins font-semibold mb-3">Critères activés :</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-w-full">
              {enabledCriteria.map((criterion) => {
                const def = CRITERIA_DEFINITIONS[criterion.type];
                return (
                  <div
                    key={criterion.type}
                    className="text-xs bg-gray-50 p-2 border border-gray-200 flex justify-between items-center min-w-0"
                  >
                    <span className="font-ibm truncate">{def?.name || criterion.type}</span>
                    <span className="font-poppins font-semibold text-gray-700 ml-2 shrink-0">
                      {criterion.weight}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
