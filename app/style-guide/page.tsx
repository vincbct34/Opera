'use client';

import { useState, useRef, useEffect } from 'react';

const StyleGuidePage = () => {
  // Colors actually used in the project
  const [sliderValue, setSliderValue] = useState(50);
  const [multiSelectOpen, setMultiSelectOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const multiSelectRef = useRef<HTMLDivElement>(null);

  // Options pour le multi-select
  const multiSelectOptions = [
    { label: 'Maternelle', value: 'maternelle' },
    { label: 'Élémentaire', value: 'elementaire' },
    { label: 'Collège', value: 'college' },
    { label: 'Lycée', value: 'lycee' },
  ];

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (multiSelectRef.current && !multiSelectRef.current.contains(event.target as Node)) {
        setMultiSelectOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    setSelectedOptions((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };
  const colors = {
    black: '#000000',
    white: '#ffffff',
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    red: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
    },
    emerald: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
    },
    blue: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
    },
    amber: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      600: '#d97706',
      700: '#b45309',
    },
  };

  return (
    <main className="w-full max-w-full overflow-x-hidden p-4 sm:p-6 lg:p-8">
      {/* Title */}
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">Style Guide</h1>
      </header>

      {/* Colors Section */}
      <section className="mb-8 sm:mb-12">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Colors</h2>
        <p className="text-sm text-gray-600 mb-4 font-ibm">
          Palette de couleurs Tailwind actuellement utilisées dans le projet (34 variantes).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {Object.entries(colors).map(([name, value]) => {
            if (typeof value === 'string') {
              return (
                <div key={name} className="flex flex-col items-center">
                  <div
                    className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-lg shadow-md mb-2"
                    style={{ backgroundColor: value }}
                  ></div>
                  <span className="font-semibold text-xs sm:text-sm">{name}</span>
                  <span className="text-xs sm:text-sm">{value}</span>
                </div>
              );
            }
            return Object.entries(value).map(([shade, hex]) => (
              <div key={`${name}-${shade}`} className="flex flex-col items-center">
                <div
                  className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-lg shadow-md mb-2"
                  style={{ backgroundColor: hex }}
                ></div>
                <span className="font-semibold text-xs sm:text-sm">{`${name}-${shade}`}</span>
                <span className="text-xs sm:text-sm">{hex}</span>
              </div>
            ));
          })}
        </div>
      </section>

      {/* Typography Section */}
      <section className="mb-8 sm:mb-12">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Typography</h2>
        <div>
          <h3 className="text-lg sm:text-xl font-semibold mb-2 font-poppins">
            Poppins (Sans-serif)
          </h3>
          <p className="font-poppins text-base sm:text-lg">
            The quick brown fox jumps over the lazy dog.
          </p>
          <p className="font-poppins text-base sm:text-lg font-bold">
            The quick brown fox jumps over the lazy dog.
          </p>
        </div>
        <div className="mt-4">
          <h3 className="text-lg sm:text-xl font-semibold mb-2 font-ibm">IBM Plex Serif (Serif)</h3>
          <p className="font-ibm text-base sm:text-lg">
            The quick brown fox jumps over the lazy dog.
          </p>
          <p className="font-ibm text-base sm:text-lg font-bold">
            The quick brown fox jumps over the lazy dog.
          </p>
        </div>
        <div className="mt-6 sm:mt-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Headings</h3>
          <h1 className="text-3xl sm:text-4xl font-bold">Heading 1</h1>
          <h2 className="text-2xl sm:text-3xl font-bold">Heading 2</h2>
          <h3 className="text-xl sm:text-2xl font-bold">Heading 3</h3>
          <h4 className="text-lg sm:text-xl font-bold">Heading 4</h4>
          <h5 className="text-base sm:text-lg font-bold">Heading 5</h5>
          <h6 className="text-sm sm:text-base font-bold">Heading 6</h6>
        </div>
      </section>

      {/* Components Section */}
      <section>
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Components</h2>
        <div>
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Buttons</h3>
          <p className="text-sm text-gray-600 mb-4 font-ibm">
            Convention standardisée pour tous les boutons d&apos;action dans l&apos;application
          </p>

          {/* Action buttons grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-4 border border-gray-200 rounded">
              <p className="text-xs sm:text-sm mb-2 font-semibold text-gray-700">Modifier / Edit</p>
              <button className="w-full px-3 sm:px-4 py-2 border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors text-sm sm:text-base font-poppins font-semibold">
                Modifier
              </button>
              <pre className="mt-3 text-xs bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                {`border-blue-300
text-blue-600
hover:bg-blue-50`}
              </pre>
            </div>

            <div className="bg-white p-4 border border-gray-200 rounded">
              <p className="text-xs sm:text-sm mb-2 font-semibold text-gray-700">
                Enregistrer / Save
              </p>
              <button className="w-full px-3 sm:px-4 py-2 border border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm sm:text-base font-poppins font-semibold">
                Enregistrer
              </button>
              <pre className="mt-3 text-xs bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                {`border-emerald-300
bg-emerald-600
text-white
hover:bg-emerald-700`}
              </pre>
            </div>

            <div className="bg-white p-4 border border-gray-200 rounded">
              <p className="text-xs sm:text-sm mb-2 font-semibold text-gray-700">
                Annuler / Cancel
              </p>
              <button className="w-full px-3 sm:px-4 py-2 border border-gray-300 hover:bg-gray-100 transition-colors text-sm sm:text-base font-poppins font-semibold">
                Annuler
              </button>
              <pre className="mt-3 text-xs bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                {`border-gray-300
hover:bg-gray-100`}
              </pre>
            </div>

            <div className="bg-white p-4 border border-gray-200 rounded">
              <p className="text-xs sm:text-sm mb-2 font-semibold text-gray-700">
                Supprimer / Delete
              </p>
              <button className="w-full px-3 sm:px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 transition-colors text-sm sm:text-base font-poppins font-semibold">
                Supprimer
              </button>
              <pre className="mt-3 text-xs bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                {`border-red-300
text-red-600
hover:bg-red-50`}
              </pre>
            </div>
          </div>

          {/* Additional button variants */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-4 border border-gray-200 rounded">
              <p className="text-xs sm:text-sm mb-2 font-semibold text-gray-700">
                Confirmer / Validate
              </p>
              <button className="w-full px-3 sm:px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm sm:text-base font-poppins font-semibold">
                Confirmer
              </button>
              <pre className="mt-3 text-xs bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                {`bg-blue-600
text-white
hover:bg-blue-700`}
              </pre>
            </div>

            <div className="bg-white p-4 border border-gray-200 rounded">
              <p className="text-xs sm:text-sm mb-2 font-semibold text-gray-700">
                Présent / Mark Present
              </p>
              <button className="w-full px-3 sm:px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm sm:text-base font-poppins font-semibold">
                Présent
              </button>
              <pre className="mt-3 text-xs bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                {`bg-blue-600
text-white
hover:bg-blue-700`}
              </pre>
            </div>

            <div className="bg-white p-4 border border-gray-200 rounded">
              <p className="text-xs sm:text-sm mb-2 font-semibold text-gray-700">
                Absent / Mark Absent
              </p>
              <button className="w-full px-3 sm:px-4 py-2 border border-gray-400 text-gray-700 hover:bg-gray-100 transition-colors text-sm sm:text-base font-poppins font-semibold">
                Absent
              </button>
              <pre className="mt-3 text-xs bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                {`border-gray-400
text-gray-700
hover:bg-gray-100`}
              </pre>
            </div>
          </div>

          {/* Status badges */}
          <div className="mt-8">
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Status Badges</h3>
            <p className="text-sm text-gray-600 mb-4 font-ibm">
              Badges de statut utilisés pour les demandes d&apos;inscription
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="inline-block text-xs font-semibold rounded-full border px-3 py-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                Confirmée
              </span>
              <span className="inline-block text-xs font-semibold rounded-full border px-3 py-1 bg-amber-50 text-amber-700 border-amber-200">
                En attente
              </span>
              <span className="inline-block text-xs font-semibold rounded-full border px-3 py-1 bg-gray-50 text-gray-700 border-gray-200">
                Annulée
              </span>
              <span className="inline-block text-xs font-semibold rounded-full border px-3 py-1 bg-red-50 text-red-700 border-red-200">
                Rejetée
              </span>
              <span className="inline-block text-xs font-semibold rounded-full border px-3 py-1 bg-blue-50 text-blue-700 border-blue-200">
                Présent
              </span>
              <span className="inline-block text-xs font-semibold rounded-full border px-3 py-1 bg-gray-50 text-gray-500 border-gray-300">
                Absent
              </span>
            </div>
          </div>

          {/* Score badges */}
          <div className="mt-8">
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Score Badges</h3>
            <p className="text-sm text-gray-600 mb-4 font-ibm">
              Badges de score avec code couleur et icônes pour l&apos;évaluation des demandes
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="px-3 py-2 border bg-emerald-50 text-emerald-700 border-emerald-200 min-w-20 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-lg">🟢</span>
                </div>
                <div className="text-2xl font-poppins font-bold text-emerald-600">85</div>
                <div className="text-xs text-gray-600 font-ibm">score</div>
              </div>
              <div className="px-3 py-2 border bg-blue-50 text-blue-700 border-blue-200 min-w-20 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-lg">🔵</span>
                </div>
                <div className="text-2xl font-poppins font-bold text-blue-600">60</div>
                <div className="text-xs text-gray-600 font-ibm">score</div>
              </div>
              <div className="px-3 py-2 border bg-amber-50 text-amber-700 border-amber-200 min-w-20 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-lg">🟡</span>
                </div>
                <div className="text-2xl font-poppins font-bold text-amber-600">35</div>
                <div className="text-xs text-gray-600 font-ibm">score</div>
              </div>
              <div className="px-3 py-2 border bg-red-50 text-red-700 border-red-200 min-w-20 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-lg">🔴</span>
                </div>
                <div className="text-2xl font-poppins font-bold text-red-600">15</div>
                <div className="text-xs text-gray-600 font-ibm">score</div>
              </div>
            </div>
            <pre className="mt-3 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
              {`const getScoreBadge = (score: number) => {
  if (score >= 75) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (score >= 50) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (score >= 25) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-red-50 text-red-700 border-red-200';
};

const getScoreIcon = (score: number) => {
  if (score >= 75) return '🟢';
  if (score >= 50) return '🔵';
  if (score >= 25) return '🟡';
  return '🔴';
};`}
            </pre>
          </div>

          {/* Special badges */}
          <div className="mt-8">
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Special Badges</h3>
            <p className="text-sm text-gray-600 mb-4 font-ibm">
              Badges spéciaux pour indicateurs et accessibilité
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-poppins font-medium">
                REP+
              </span>
              <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 font-ibm">
                Malvoyant: 3
              </span>
              <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 font-ibm">
                Moteur (PMR): 2
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Forms Section */}
      <section className="mb-8 sm:mb-12">
        <h2 className="mt-6 sm:mt-8 text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Forms</h2>
        <div className="space-y-4 max-w-2xl">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Input with Icon</h3>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search"
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 border text-sm sm:text-base"
              />
            </div>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Simple Input</h3>
            <input
              type="text"
              placeholder="Enter your name"
              className="w-full px-3 sm:px-4 py-2 border text-sm sm:text-base"
            />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Select Dropdown</h3>
            <select className="w-full px-3 sm:px-4 py-2 border text-sm sm:text-base">
              <option>Maternelle</option>
              <option>École</option>
              <option>Collège</option>
              <option>Lycée</option>
            </select>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Checkbox</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm font-ibm">Accepter les conditions</span>
            </label>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Radio Buttons (Grouped)</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
                <input
                  type="radio"
                  name="example"
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-ibm">Option 1</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
                <input
                  type="radio"
                  name="example"
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-ibm">Option 2</span>
              </label>
            </div>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Textarea</h3>
            <textarea
              rows={3}
              placeholder="Votre message..."
              className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-blue-500 font-ibm resize-none"
            />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Date Input</h3>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">
              Numeric Input with Increment/Decrement
            </h3>
            <p className="text-sm text-gray-600 mb-3 font-ibm">
              Input numérique avec boutons +/- pour faciliter l&apos;ajustement des valeurs
            </p>
            <div className="flex items-center gap-2 max-w-xs">
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
              >
                −
              </button>
              <input
                type="number"
                min="0"
                defaultValue="25"
                className="flex-1 text-center p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm font-medium"
              />
              <button
                type="button"
                className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
              >
                +
              </button>
            </div>
            <pre className="mt-3 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
              {`<div className="flex items-center gap-2">
  <button
    type="button"
    onClick={() => setValue(Math.max(0, value - 1))}
    className="w-8 h-8 flex items-center justify-center
      border border-gray-400 bg-white hover:bg-gray-100
      transition-colors rounded-none font-poppins
      font-bold text-gray-700"
  >
    −
  </button>
  <input
    type="number"
    min="0"
    value={value}
    onChange={(e) => setValue(Number(e.target.value))}
    className="flex-1 text-center p-2 border border-gray-300
      rounded-none text-sm focus:outline-none focus:ring-2
      focus:ring-black font-ibm font-medium"
  />
  <button
    type="button"
    onClick={() => setValue(value + 1)}
    className="w-8 h-8 flex items-center justify-center
      border border-gray-400 bg-white hover:bg-gray-100
      transition-colors rounded-none font-poppins
      font-bold text-gray-700"
  >
    +
  </button>
</div>`}
            </pre>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">
              Numeric Input with Label (Boxed)
            </h3>
            <p className="text-sm text-gray-600 mb-3 font-ibm">
              Variante encadrée avec label pour les sections de handicaps/déficiences
            </p>
            <div className="bg-gray-50 border border-gray-300 p-3 rounded-none max-w-xs">
              <label className="block text-xs text-gray-600 mb-2 font-ibm font-medium">
                Déficience visuelle
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                >
                  −
                </button>
                <input
                  type="number"
                  min="0"
                  defaultValue="3"
                  className="flex-1 text-center p-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-black font-ibm font-medium"
                />
                <button
                  type="button"
                  className="w-8 h-8 flex items-center justify-center border border-gray-400 bg-white hover:bg-gray-100 transition-colors rounded-none font-poppins font-bold text-gray-700"
                >
                  +
                </button>
              </div>
            </div>
            <pre className="mt-3 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
              {`<div className="bg-gray-50 border border-gray-300 p-3 rounded-none">
  <label className="block text-xs text-gray-600 mb-2
    font-ibm font-medium">
    Déficience visuelle
  </label>
  <div className="flex items-center gap-2">
    {/* Boutons +/- comme ci-dessus */}
  </div>
</div>`}
            </pre>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Slider / Range Input</h3>
            <p className="text-sm text-gray-600 mb-3 font-ibm">
              Slider pour ajustement de poids dans configuration scoring
            </p>
            <div className="flex items-center gap-3 w-full max-w-sm">
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={sliderValue}
                onChange={(e) => setSliderValue(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="min-w-[60px] text-right">
                <span
                  className={`text-sm font-poppins font-semibold ${sliderValue < 0 ? 'text-red-600' : 'text-gray-900'}`}
                >
                  {sliderValue > 0 ? '+' : ''}
                  {sliderValue}%
                </span>
              </div>
            </div>
            <pre className="mt-3 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
              {`<input
  type="range"
  min="-100"
  max="100"
  step="1"
  value={value}
  onChange={(e) => setValue(parseInt(e.target.value))}
  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none
    cursor-pointer accent-blue-600"
/>`}
            </pre>
          </div>
        </div>
      </section>

      {/* UI Components Section */}
      <section className="mb-8 sm:mb-12">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">UI Components</h2>

        {/* Loader */}
        <div className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Loader</h3>
          <p className="text-sm text-gray-600 mb-3">
            Spinner de chargement utilisé pour indiquer les états de chargement
          </p>
          <div className="p-6 bg-gray-50 rounded">
            <div className="flex justify-center">
              <div className="w-10 h-10 border-4 border-t-black border-gray-300 rounded-full animate-spin" />
            </div>
          </div>
          <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
            {`<Loader />`}
          </pre>
        </div>

        {/* Button Loading State */}
        <div className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Button Loading State</h3>
          <p className="text-sm text-gray-600 mb-3">
            Bouton avec spinner intégré pour les actions en cours
          </p>
          <button
            disabled
            className="px-4 py-2 bg-black text-white disabled:opacity-50 font-medium flex items-center gap-2"
          >
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
            Chargement...
          </button>
          <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
            {`<button disabled className="px-4 py-2 bg-black text-white
  disabled:opacity-50 font-medium flex items-center gap-2">
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10"
      stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
  Chargement...
</button>`}
          </pre>
        </div>

        {/* Toast */}
        <div className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Toast Notifications</h3>
          <p className="text-sm text-gray-600 mb-3">
            Notifications temporaires affichées en bas à droite de l&apos;écran
          </p>
          <div className="space-y-3">
            <div className="px-4 py-2 rounded shadow bg-gray-800 text-white inline-block">
              Info Toast Message
            </div>
            <div className="px-4 py-2 rounded shadow bg-green-600 text-white inline-block">
              Success Toast Message
            </div>
            <div className="px-4 py-2 rounded shadow bg-red-500 text-white inline-block">
              Error Toast Message
            </div>
          </div>
          <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
            {`import { showToast } from '@/lib/utils/toast';
showToast('Message', 'info');
showToast('Success!', 'success');
showToast('Error!', 'error');`}
          </pre>
        </div>

        {/* Alert / Info Boxes */}
        <div className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Alert / Info Boxes</h3>
          <p className="text-sm text-gray-600 mb-3">
            Boîtes d&apos;information pour afficher des messages importants
          </p>
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 px-4 py-3 text-sm font-ibm text-blue-800">
              <p className="font-semibold mb-1">Information importante</p>
              <p className="text-xs">Du lundi au vendredi | 9h - 12h et 14h - 17h</p>
            </div>
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 text-xs font-ibm text-blue-800">
              📊 Historique: 12 demande(s) · 85% présence · Dernière: il y a 2 mois
            </div>
          </div>
          <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
            {`{/* Info box principale */}
<div className="bg-blue-50 border border-blue-200 px-4 py-3
  text-sm font-ibm text-blue-800">
  <p className="font-semibold mb-1">Information importante</p>
  <p className="text-xs">Détails...</p>
</div>

{/* History summary box */}
<div className="p-2 bg-blue-50 border border-blue-200
  text-xs font-ibm text-blue-800">
  📊 Historique: 12 demande(s) · 85% présence
</div>`}
          </pre>
        </div>

        {/* Modal Structure */}
        <div className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Modal Structure</h3>
          <p className="text-sm text-gray-600 mb-3">
            Structure générique pour les modales avec header, content et footer sticky
          </p>
          <div className="p-6 bg-gray-50 rounded">
            <div className="bg-white w-full max-w-lg mx-auto border shadow-lg">
              {/* Sticky Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-poppins font-semibold">Titre de la modale</h2>
                  <p className="text-sm text-gray-600 font-ibm mt-1">Description</p>
                </div>
                <button className="p-2 hover:bg-gray-100 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <p className="text-sm text-gray-700 font-ibm">Contenu de la modale...</p>
              </div>

              {/* Sticky Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                <button className="px-4 py-2 border border-gray-300 hover:bg-gray-50 font-medium">
                  Annuler
                </button>
                <button className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 font-medium">
                  Confirmer
                </button>
              </div>
            </div>
          </div>
          <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
            {`<div className="fixed inset-0 bg-black/50 z-50
  flex items-center justify-center p-4">
  <div className="bg-white w-full max-w-lg">
    {/* Header */}
    <div className="sticky top-0 bg-white border-b
      border-gray-200 px-6 py-4">
      <h2 className="text-xl font-poppins font-semibold">
        Titre
      </h2>
    </div>
    {/* Content */}
    <div className="px-6 py-6">
      ...
    </div>
    {/* Footer */}
    <div className="sticky bottom-0 bg-white border-t
      border-gray-200 px-6 py-4">
      <button>Annuler</button>
      <button>Confirmer</button>
    </div>
  </div>
</div>`}
          </pre>
        </div>

        {/* Confirmation Modal */}
        <div className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Confirmation Modal</h3>
          <p className="text-sm text-gray-600 mb-3">
            Modale de confirmation pour les actions destructives
          </p>
          <div className="p-6 bg-gray-50 rounded">
            <div className="bg-white p-4 sm:p-6 w-full max-w-md rounded border mx-auto">
              <h3 className="text-xl font-semibold mb-2">Confirmer</h3>
              <p className="text-sm text-gray-700 mb-4">Êtes-vous sûr ?</p>
              <div className="flex gap-2 justify-end">
                <button className="px-4 py-2 cursor-pointer">Annuler</button>
                <button className="px-4 py-2 bg-red-600 text-white cursor-pointer">
                  Confirmer
                </button>
              </div>
            </div>
          </div>
          <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
            {`<ConfirmationModal
  open={isOpen}
  title="Confirmer"
  description="Êtes-vous sûr ?"
  onCancel={() => setIsOpen(false)}
  onConfirm={handleConfirm}
/>`}
          </pre>
        </div>

        {/* Notification Dropdown */}
        <div className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Notification Dropdown</h3>
          <p className="text-sm text-gray-600 mb-3">
            Menu déroulant affichant les notifications utilisateur
          </p>
          <div className="p-6 bg-gray-50 rounded">
            <div className="bg-white border shadow-lg w-full max-w-80 p-6 mx-auto">
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-poppins font-semibold text-lg text-black">Notifications</h3>
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                    3
                  </span>
                </div>
                <button className="text-sm font-ibm text-gray-600 cursor-pointer">
                  Tout marquer comme lu
                </button>
              </div>
              <div className="text-center py-4">
                <p className="text-gray-500 font-ibm text-sm">Aperçu des notifications</p>
              </div>
            </div>
          </div>
          <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
            {`<NotificationDropdown
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  buttonRef={buttonRef}
/>`}
          </pre>
        </div>

        {/* Multi-Select */}
        <div className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Multi-Select Dropdown</h3>
          <p className="text-sm text-gray-600 mb-3">
            Dropdown avec sélection multiple et cases à cocher
          </p>
          <div className="relative max-w-sm" ref={multiSelectRef}>
            <button
              onClick={() => setMultiSelectOpen(!multiSelectOpen)}
              className="w-full flex items-center justify-between py-2.5 px-3 border border-gray-300 bg-white text-left text-sm"
            >
              <span className={selectedOptions.length === 0 ? 'text-gray-500' : 'text-black'}>
                {selectedOptions.length === 0
                  ? 'Sélectionner...'
                  : selectedOptions.length === 1
                    ? multiSelectOptions.find((o) => o.value === selectedOptions[0])?.label
                    : `${selectedOptions.length} sélectionnés`}
              </span>
              <div className="flex items-center gap-2">
                {selectedOptions.length > 0 && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOptions([]);
                    }}
                    className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors cursor-pointer"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </span>
                )}
                <svg
                  className={`w-4 h-4 text-gray-500 transition-transform ${multiSelectOpen ? 'transform rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {multiSelectOpen && (
              <div className="absolute z-100 w-full mt-1 bg-white border border-gray-200 shadow-lg max-h-60 overflow-auto rounded">
                <ul className="py-1">
                  {multiSelectOptions.map((option) => {
                    const isSelected = selectedOptions.includes(option.value);
                    return (
                      <li
                        key={option.value}
                        onClick={() => toggleOption(option.value)}
                        className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <div
                          className={`shrink-0 w-4 h-4 border flex items-center justify-center mr-3 transition-colors ${isSelected ? 'bg-black border-black' : 'border-gray-300 bg-white'}`}
                        >
                          {isSelected && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
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
          <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
            {`import MultiSelect from '@/components/ui/MultiSelect';

<MultiSelect
  options={[
    { label: 'Option 1', value: 'opt1' },
    { label: 'Option 2', value: 'opt2' },
  ]}
  selectedValues={selected}
  onChange={setSelected}
  placeholder="Sélectionner..."
  label="Label optionnel"
/>`}
          </pre>
        </div>
      </section>

      {/* Cards Section */}
      <section className="mb-8 sm:mb-12">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Cards</h2>

        {/* Registration Card */}
        <div className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Registration Card</h3>
          <p className="text-sm text-gray-600 mb-3">
            Carte extensible pour afficher une inscription avec actions
          </p>
          <div className="border border-gray-200 bg-white hover:bg-gray-50 transition-colors max-w-3xl">
            <div className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="font-poppins font-semibold text-gray-900">Jean Dupont</h3>
                    <span className="text-xs px-2 py-0.5 border bg-amber-50 text-amber-700 border-amber-200">
                      En attente
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 font-ibm">
                    <div className="flex items-center gap-2">
                      <span>École Primaire Paris</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>25 places</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-xs border border-blue-300 text-blue-600 hover:bg-blue-50 font-medium">
                    Détails
                  </button>
                  <button className="px-3 py-1.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700 font-medium">
                    Confirmer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
            {`<div className="border border-gray-200 bg-white
  hover:bg-gray-50 transition-colors">
  <div className="p-4">
    {/* Header with status badge */}
    <div className="flex items-center gap-2">
      <h3 className="font-poppins font-semibold">
        Nom
      </h3>
      <span className="text-xs px-2 py-0.5 border
        bg-amber-50 text-amber-700 border-amber-200">
        En attente
      </span>
    </div>
    {/* Actions */}
    <div className="flex gap-2 mt-3">
      <button className="border-blue-300 text-blue-600">
        Détails
      </button>
      <button className="bg-emerald-600 text-white">
        Confirmer
      </button>
    </div>
  </div>
  {/* Expanded content */}
  {expanded && (
    <div className="border-t border-gray-200 p-4">
      Détails supplémentaires...
    </div>
  )}
</div>`}
          </pre>
        </div>

        {/* Contact Card */}
        <div className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Contact Card</h3>
          <p className="text-sm text-gray-600 mb-3">
            Carte de contact avec informations et effet hover
          </p>
          <div className="border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all max-w-sm">
            <h3 className="font-poppins font-semibold text-base text-gray-900 mb-1">
              Caroline Maby
            </h3>
            <p className="text-sm text-gray-600 font-ibm mb-3">Responsable</p>
            <div className="space-y-2">
              <a
                href="tel:0430781799"
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-black font-ibm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <span>04 30 78 17 99</span>
              </a>
              <a
                href="mailto:caroline.maby@oonm.fr"
                className="flex items-center gap-2 text-sm text-gray-700 hover:text-black font-ibm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span>caroline.maby@oonm.fr</span>
              </a>
            </div>
          </div>
          <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
            {`<div className="border border-gray-200 p-4
  hover:border-gray-300 hover:shadow-sm transition-all">
  <h3 className="font-poppins font-semibold">Nom</h3>
  <p className="text-sm text-gray-600 font-ibm">Rôle</p>
  <a href="tel:..." className="flex items-center gap-2
    text-sm text-gray-700 hover:text-black font-ibm">
    <Phone size={16} />
    <span>Numéro</span>
  </a>
</div>`}
          </pre>
        </div>
      </section>

      {/* Navigation Section */}
      <section className="mb-8 sm:mb-12">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Navigation</h2>

        {/* Sidebar */}
        <div className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Sidebar Navigation</h3>
          <p className="text-sm text-gray-600 mb-3">
            Navigation latérale pour desktop avec effet hover
          </p>
          <div className="border border-gray-200 max-w-xs">
            <div className="bg-black text-white text-center py-2 px-5 font-semibold uppercase tracking-wide text-sm">
              Pages principales
            </div>
            <a className="flex items-center gap-3 p-5 bg-white hover:bg-black hover:text-white border-b-2 border-black transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="font-poppins">Événements</span>
            </a>
            <a className="flex items-center gap-3 p-5 bg-white hover:bg-black hover:text-white border-b-2 border-black transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <span className="font-poppins">Demandes</span>
            </a>
          </div>
          <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
            {`<Link href="/events" className="flex items-center gap-3 p-5
  bg-white hover:bg-black hover:text-white
  border-b-2 border-black transition-colors">
  <Icon className="w-5 h-5" />
  <span className="font-poppins">Label</span>
</Link>`}
          </pre>
        </div>

        {/* Calendar Navigation */}
        <div className="mb-8">
          <h3 className="text-lg sm:text-xl font-semibold mb-2">Calendar Navigation</h3>
          <p className="text-sm text-gray-600 mb-3">
            Navigation de mois avec boutons précédent/suivant
          </p>
          <div className="border border-gray-200 p-4 max-w-sm">
            <div className="flex items-center justify-between">
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <h2 className="text-xl font-poppins font-semibold capitalize">janvier 2026</h2>
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
          <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
            {`<button onClick={goToPrevious}
  className="p-2 hover:bg-gray-100 rounded-full
  transition-colors">
  <ChevronLeft size={20} />
</button>
<h2 className="text-xl font-poppins font-semibold">
  {formatMonthYear(currentMonth)}
</h2>
<button onClick={goToNext}
  className="p-2 hover:bg-gray-100 rounded-full
  transition-colors">
  <ChevronRight size={20} />
</button>`}
          </pre>
        </div>
      </section>

      {/* Calendar Section */}
      <section className="mb-8 sm:mb-12">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Calendar Grid</h2>
        <p className="text-sm text-gray-600 mb-4">
          Grille calendrier avec indicateurs visuels pour événements passés/futurs
        </p>
        <div className="border border-gray-200 rounded max-w-2xl">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
              <div key={day} className="p-3 text-center text-sm font-medium text-gray-600">
                {day}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className={`min-h-20 p-2 border-r border-b ${
                  i < 3 ? 'bg-gray-50 text-gray-400' : 'bg-white'
                }`}
              >
                <div className="flex flex-col h-full">
                  <span className="text-sm font-medium">{i > 0 ? i : ''}</span>
                  {i === 15 && (
                    <div className="mt-1 text-xs px-2 py-1 bg-white border border-gray-300 text-gray-900 truncate">
                      Événement exemple
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
          {`<div className="grid grid-cols-7">
  {calendarDays.map((day) => (
    <div className={\`min-h-[100px] p-2 border-r border-b
      \${!day.isCurrentMonth ? 'bg-gray-50' : 'bg-white'}\`}>
      <span className="text-sm font-medium">
        {day.date.getDate()}
      </span>
      {dayEvents.map((event) => (
        <div className={\`text-xs px-2 py-1
          \${isPast
            ? 'bg-gray-100 text-gray-500'
            : 'bg-white text-gray-900'}\`}>
          {event.title}
        </div>
      ))}
    </div>
  ))}
</div>`}
        </pre>
      </section>

      {/* Empty State */}
      <section className="mb-8 sm:mb-12">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Empty States</h2>
        <p className="text-sm text-gray-600 mb-4">
          Messages affichés lorsqu&apos;il n&apos;y a pas de données
        </p>
        <div className="space-y-3">
          <div className="p-6 bg-gray-50 border border-gray-200 text-center max-w-sm">
            <p className="text-gray-500 font-ibm">Aucune donnée disponible</p>
          </div>
          <div className="p-6 bg-gray-50 border border-gray-200 text-center max-w-sm">
            <p className="text-gray-500 font-ibm">Aucune notification</p>
          </div>
        </div>
        <pre className="mt-2 text-xs bg-gray-800 text-white p-3 rounded overflow-x-auto whitespace-pre-wrap wrap-break-word">
          {`<div className="p-6 bg-gray-50 border border-gray-200
  text-center">
  <p className="text-gray-500 font-ibm">
    Aucune donnée disponible
  </p>
</div>`}
        </pre>
      </section>
    </main>
  );
};

export default StyleGuidePage;
