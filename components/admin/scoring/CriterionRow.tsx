import { useState } from 'react';
import { ChevronDown, ChevronUp } from '@deemlol/next-icons';
import { CRITERIA_DEFINITIONS } from '@/lib/scoring/criteriaDefinitions';
import type {
  ScoringCriterionType,
  ParameterValue,
  ParameterDefinition,
} from '@/lib/scoring/criteriaDefinitions';

interface CriterionData {
  type: ScoringCriterionType;
  enabled: boolean;
  weight: number;
  parameters?: Record<string, ParameterValue>;
  order: number;
}

interface CriterionRowProps {
  criterion: CriterionData;
  onChange: (updates: Partial<CriterionData>) => void;
}

/**
 * CriterionRow component
 * Displays a single scoring criterion within the editor.
 * Features:
 * - Enable/Disable toggle
 * - Weight slider
 * - Expandable parameters section (if applicable)
 *
 * @param criterion - The criterion data
 * @param onChange - Callback to update the criterion
 */
export default function CriterionRow({ criterion, onChange }: CriterionRowProps) {
  const [showParams, setShowParams] = useState(false);
  const definition = CRITERIA_DEFINITIONS[criterion.type];

  if (!definition) return null;

  const hasParameters = definition.parameterDefinitions.length > 0;

  return (
    <div className="border border-gray-200 bg-white w-full overflow-hidden">
      {/* Main Row */}
      <div className="p-3 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
          {/* Enable Toggle */}
          <div className="flex items-center min-w-10 shrink-0">
            <input
              type="checkbox"
              checked={criterion.enabled}
              onChange={(e) => onChange({ enabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
          </div>

          {/* Criterion Info */}
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-1">
              <h5 className="text-sm font-poppins font-semibold truncate">{definition.name}</h5>
              {!criterion.enabled && (
                <span className="text-xs text-gray-400 font-ibm shrink-0">(désactivé)</span>
              )}
            </div>
            <p className="text-xs text-gray-600 font-ibm">{definition.description}</p>
          </div>

          {/* Weight Slider + Parameters Toggle */}
          <div className="flex items-center gap-3 w-full sm:w-auto sm:min-w-[280px] sm:max-w-[330px] shrink-0">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-ibm">Impact dans le score final</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={definition.defaultWeight < 0 ? '-100' : '0'}
                  max="100"
                  step="1"
                  value={criterion.weight}
                  onChange={(e) => onChange({ weight: parseInt(e.target.value) })}
                  disabled={!criterion.enabled}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed accent-blue-600"
                />
                <span
                  className={`text-sm font-poppins font-semibold whitespace-nowrap ${criterion.weight < 0 ? 'text-red-600' : 'text-gray-900'}`}
                >
                  {criterion.weight > 0 ? '+' : ''}
                  {criterion.weight}%
                </span>
              </div>
            </div>
            {hasParameters && criterion.enabled && (
              <button
                onClick={() => setShowParams(!showParams)}
                className="w-auto px-2 py-1 text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-poppins flex items-center gap-1 shrink-0"
              >
                {showParams ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>Paramètres</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Parameters Panel */}
      {showParams && hasParameters && criterion.enabled && (
        <div className="p-3 bg-gray-50 border-t border-gray-200">
          <div className="space-y-3">
            {definition.parameterDefinitions.map((paramDef) => (
              <ParameterInput
                key={paramDef.key}
                paramDef={paramDef}
                value={criterion.parameters?.[paramDef.key] ?? paramDef.defaultValue}
                onChange={(value) =>
                  onChange({
                    parameters: {
                      ...criterion.parameters,
                      [paramDef.key]: value,
                    },
                  })
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ParameterInput({
  paramDef,
  value,
  onChange,
}: {
  paramDef: ParameterDefinition;
  value: ParameterValue;
  onChange: (value: ParameterValue) => void;
}) {
  if (paramDef.type === 'number') {
    return (
      <div>
        <label className="block text-xs font-poppins font-medium mb-1">{paramDef.label}</label>
        {paramDef.description && (
          <p className="text-xs text-gray-500 font-ibm mb-2">{paramDef.description}</p>
        )}
        <input
          type="number"
          min={paramDef.min}
          max={paramDef.max}
          value={typeof value === 'number' ? value : undefined}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full px-2 py-1 text-sm border border-gray-300 focus:outline-none focus:border-blue-500 font-ibm"
        />
      </div>
    );
  }

  if (paramDef.type === 'boolean') {
    return (
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={typeof value === 'boolean' ? value : false}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
        />
        <div className="flex-1">
          <label className="text-xs font-poppins font-medium block">{paramDef.label}</label>
          {paramDef.description && (
            <p className="text-xs text-gray-500 font-ibm mt-1">{paramDef.description}</p>
          )}
        </div>
      </div>
    );
  }

  if (paramDef.type === 'select') {
    return (
      <div>
        <label className="block text-xs font-poppins font-medium mb-1">{paramDef.label}</label>
        {paramDef.description && (
          <p className="text-xs text-gray-500 font-ibm mb-2">{paramDef.description}</p>
        )}
        <select
          value={typeof value === 'string' || typeof value === 'number' ? value : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1 text-sm border border-gray-300 focus:outline-none focus:border-blue-500 font-ibm"
        >
          {paramDef.options?.map((opt: { value: string | number; label: string }) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (paramDef.type === 'multiselect') {
    const selectedValues = Array.isArray(value) ? value : [];

    return (
      <div>
        <label className="block text-xs font-poppins font-medium mb-1">{paramDef.label}</label>
        {paramDef.description && (
          <p className="text-xs text-gray-500 font-ibm mb-2">{paramDef.description}</p>
        )}
        <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 p-2 bg-white">
          {paramDef.options?.map((opt: { value: string | number; label: string }) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedValues.includes(opt.value as string)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...selectedValues, opt.value as string]);
                  } else {
                    onChange(selectedValues.filter((v: string) => v !== (opt.value as string)));
                  }
                }}
                className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-xs font-ibm">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
