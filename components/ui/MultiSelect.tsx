'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from '@deemlol/next-icons';

/**
 * Option type for the MultiSelect component.
 */
export interface MultiSelectOption {
  label: string;
  value: string;
}

/**
 * Props for the MultiSelect component.
 */
interface MultiSelectProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

/**
 * A custom multi-select dropdown component.
 * Supports multiple selections, clearing selections, and custom styling.
 */
export default function MultiSelect({
  options,
  selectedValues,
  onChange,
  placeholder = 'Sélectionner...',
  label,
  className = '',
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleToggleOption = (value: string) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      return options.find((opt) => opt.value === selectedValues[0])?.label || selectedValues[0];
    }
    return `${selectedValues.length} sélectionnés`;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2 sm:py-2.5 px-3 border border-gray-300 rounded-none bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent cursor-pointer text-sm sm:text-base text-left"
      >
        <span
          className={`block truncate ${selectedValues.length === 0 ? 'text-gray-500' : 'text-black'}`}
        >
          {getDisplayText()}
        </span>
        <div className="flex items-center gap-2">
          {selectedValues.length > 0 && (
            <span
              role="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 shadow-lg max-h-60 overflow-auto">
          <ul className="py-1">
            {options.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <li
                  key={option.value}
                  onClick={() => handleToggleOption(option.value)}
                  className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div
                    className={`shrink-0 w-4 h-4 border flex items-center justify-center mr-3 transition-colors ${
                      isSelected ? 'bg-black border-black' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                  <span
                    className={`text-sm ${isSelected ? 'font-medium text-black' : 'text-gray-700'}`}
                  >
                    {option.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
