import { Check, X } from '@deemlol/next-icons';
import { CRITERIA_DEFINITIONS, CRITERION_CATEGORIES } from '@/lib/scoring/criteriaDefinitions';
import type { ScoringCriterionType, ParameterValue } from '@/lib/scoring/criteriaDefinitions';
import CriterionRow from './CriterionRow';

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
}

interface ConfigEditorProps {
  config: ConfigurationData;
  isCreating: boolean;
  saving: boolean;
  totalWeight: number;
  onCancel: () => void;
  onSave: () => void;
  onUpdate: (updates: Partial<ConfigurationData>) => void;
  onUpdateCriterion: (index: number, updates: Partial<CriterionData>) => void;
  sampleEvent: { id: string; title: string } | null;
}

/**
 * ConfigEditor component
 * Form to create or edit a scoring configuration.
 * Features:
 * - Name and default status editing
 * - List of criteria grouped by category
 * - Real-time total weight calculation and validation
 * - Individual criterion weight and parameter adjustment
 *
 * @param config - The configuration data to edit
 * @param isCreating - Whether we are creating a new configuration
 * @param saving - Loading state
 * @param totalWeight - Current total weight of all enabled criteria
 * @param onCancel - Callback to cancel editing
 * @param onSave - Callback to save changes
 * @param onUpdate - Callback to update top-level config properties
 * @param onUpdateCriterion - Callback to update a specific criterion
 */
export default function ConfigEditor({
  config,
  isCreating,
  saving,
  totalWeight,
  onCancel,
  onSave,
  onUpdate,
  onUpdateCriterion,
}: ConfigEditorProps) {
  const isValid = totalWeight === 100 && config.name.trim().length > 0;

  // Grouper les critères par catégorie
  const criteriaByCategory = Object.entries(CRITERION_CATEGORIES).map(([key, category]) => {
    const criteriaDefs = Object.values(CRITERIA_DEFINITIONS).filter((def) => def.category === key);
    const criteria = config.criteria.filter((c) => criteriaDefs.some((def) => def.type === c.type));
    return { key, category, criteria };
  });

  return (
    <div className="bg-white border border-gray-200 shadow-sm w-full overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <h2 className="text-xl font-poppins font-semibold mb-4">
          {isCreating ? 'Nouvelle configuration' : 'Modifier la configuration'}
        </h2>

        {/* Name Input */}
        <div className="mb-4">
          <label className="block text-sm font-poppins font-medium mb-2">
            Nom de la configuration
          </label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-blue-500 font-ibm"
            placeholder="Ex: Configuration Standard 2025"
          />
        </div>

        {/* Default Toggle */}
        <div className="flex items-center gap-3">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.is_default}
              onChange={(e) => onUpdate({ is_default: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm font-ibm">Configuration par défaut</span>
          </label>
        </div>
      </div>

      {/* Criteria Editor */}
      <div className="p-4 sm:p-6 w-full overflow-hidden">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-lg font-poppins font-semibold">Critères de scoring</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm font-ibm text-gray-600">Poids total:</span>
            <span
              className={`text-lg font-poppins font-bold ${
                totalWeight === 100
                  ? 'text-emerald-600'
                  : totalWeight > 100
                    ? 'text-red-600'
                    : 'text-amber-600'
              }`}
            >
              {totalWeight}%
            </span>
            {totalWeight === 100 && <Check size={20} className="text-emerald-600" />}
            {totalWeight !== 100 && <X size={20} className="text-red-600" />}
          </div>
        </div>

        {/* Weight explanation */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-sm font-poppins font-semibold text-blue-900 mb-2">
            💡 Comment fonctionne le poids ?
          </h4>
          <p className="text-sm font-ibm text-blue-800 mb-2">
            Le <strong>poids</strong> représente l&apos;importance de chaque critère dans le score
            final.
          </p>
          <ul className="text-sm font-ibm text-blue-800 space-y-1 ml-4 list-disc">
            <li>Plus le poids est élevé, plus le critère a d&apos;impact sur le classement</li>
            <li>
              Le score final est calculé ainsi :{' '}
              <code className="bg-blue-100 px-1 rounded">Score = Σ(Score du critère × Poids)</code>
            </li>
            <li>
              La somme des poids de tous les critères activés doit être <strong>100%</strong>
            </li>
            <li>Exemple : avec un poids de 40%, un critère compte pour 40% du score final</li>
          </ul>
        </div>

        {totalWeight !== 100 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-sm font-ibm text-amber-800">
            ⚠️ Le poids total doit être exactement 100% pour sauvegarder la configuration.
          </div>
        )}

        {/* Criteria by Category */}
        <div className="space-y-6 w-full">
          {criteriaByCategory.map(({ key, category, criteria }) => (
            <div key={key} className="border border-gray-200 bg-gray-50 w-full overflow-hidden">
              <div className="p-3 bg-gray-100 border-b border-gray-200">
                <h4 className="text-sm font-poppins font-semibold">{category.label}</h4>
                <p className="text-xs text-gray-600 font-ibm mt-1">{category.description}</p>
              </div>
              <div className="p-3 space-y-3 w-full overflow-hidden">
                {criteria.map((criterion) => {
                  const index = config.criteria.findIndex((c) => c.type === criterion.type);
                  return (
                    <CriterionRow
                      key={criterion.type}
                      criterion={criterion}
                      onChange={(updates) => onUpdateCriterion(index, updates)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors font-poppins font-medium disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={saving || !isValid}
            className="px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors font-poppins font-medium disabled:opacity-50 flex items-center justify-center gap-2"
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
                Sauvegarde...
              </>
            ) : (
              <>
                <Check size={18} />
                Sauvegarder
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
