'use client';

import { useState, useRef, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import toast from '@/lib/utils/toast';
import Loader from '@/components/ui/Loader';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import {
  Upload,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Mail,
  FileText,
  Users,
  Briefcase,
  CheckSquare,
  AlertCircle,
  Search,
  Eye,
} from '@deemlol/next-icons';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

// Types matching backend PreviewRow/PreviewResult
interface PreviewRow {
  rowIndex: number;
  raw: {
    institution: string;
    city: string;
    address?: string;
    institutionEmail?: string;
    publicType?: string;
    referentLastName: string;
    referentFirstName: string;
    email: string;
    eventTitle: string;
    eventDate: string;
    seats: number;
  };
  institutionStatus: 'existing' | 'new' | 'error';
  institutionName: string;
  institutionId?: string;
  userStatus: 'existing' | 'new';
  userId?: string;
  userFullName?: string;
  eventStatus: 'found' | 'not_found';
  eventId?: string;
  eventName?: string;
  eventDates?: string[];
  error?: string;
  canImport: boolean;
  isDuplicate?: boolean;
}

interface PreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  newUsers: number;
  existingUsers: number;
  newInstitutions: number;
  existingInstitutions: number;
  eventsFound: number;
  eventsNotFound: number;
  totalSeats: number;
  rows: PreviewRow[];
}

interface ImportResult {
  totalRows: number;
  processed: number;
  errors: string[];
  createdUsers: number;
  createdInstitutions: number;
  createdRegistrations: number;
  emailsSent: number;
}

type RegistrationStatus = 'PRESENT' | 'ABSENT';
type ImportStep = 'upload' | 'preview' | 'result';

const STATUS_OPTIONS: { value: RegistrationStatus; label: string; description: string }[] = [
  {
    value: 'PRESENT',
    label: 'Présent',
    description: "Les participants étaient présents à l'événement",
  },
  {
    value: 'ABSENT',
    label: 'Absent',
    description: 'Les participants ne se sont pas présentés',
  },
];

const REQUIRED_COLUMNS = [
  { name: 'Ecole / Association', description: "Nom de l'établissement" },
  { name: 'Ville', description: "Ville de l'établissement" },
  { name: 'Effectifs', description: "Nombre d'élèves / participants" },
  { name: 'Date de venue', description: 'Format JJ/MM/AAAA' },
  { name: 'Nom spectacle', description: "Titre de l'événement correspondant" },
  { name: 'Nom référent', description: 'Nom du référent' },
  { name: 'Prénom référent', description: 'Prénom du référent' },
  { name: 'Mail', description: 'Email du référent (identifiant de connexion)' },
];

const OPTIONAL_COLUMNS = [
  {
    name: 'Adresse Etablissement',
    description: 'Adresse complète (déclenche la création automatique)',
  },
  { name: 'Mail établissement', description: "Email de l'établissement" },
  {
    name: 'Type de public (peut en avoir plusieurs si séparés par +)',
    description: 'Maternelle, Élémentaire, Collège, etc.',
  },
];

/**
 * ImportExistingClient - Admin component for importing existing registrations from Excel.
 * Follows a 2-step flow: preview (analyze file) -> selective confirmation -> import.
 */
export default function ImportExistingClient() {
  const { user, loading } = useUser();
  const router = useRouter();

  // Step state
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');

  // Import state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selection state
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Configuration options
  const [sendEmails, setSendEmails] = useState(true);
  const [defaultStatus, setDefaultStatus] = useState<RegistrationStatus>('PRESENT');

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Define handleFileSelect before useCallback hooks that reference it
  const handleFileSelect = (file: File) => {
    const validExtensions = ['.xlsx'];
    const hasValidExtension = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExtension) {
      toast('Format de fichier invalide. Utilisez .xlsx', 'error');
      return;
    }

    setSelectedFile(file);
    setPreviewResult(null);
    setImportResult(null);
    setCurrentStep('upload');
  };

  // Define useCallback hooks before any early returns
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  // Redirect non-admin users (after all hooks are declared)
  if (!loading && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN'))) {
    router.push('/');
    return null;
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  // Step 1: Analyze file (preview)
  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setPreviewResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetchWithAuth('/api/admin/import-existing/preview', {
        method: 'POST',
        body: formData,
        _contentType: null,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de l'analyse");
      }

      const result = data.result as PreviewResult;
      setPreviewResult(result);

      // Auto-select all importable rows
      const importableRows = new Set(result.rows.filter((r) => r.canImport).map((r) => r.rowIndex));
      setSelectedRows(importableRows);

      setCurrentStep('preview');
      toast('Analyse terminée', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erreur lors de l'analyse";
      toast(errorMessage, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 2: Confirm and run import
  const handleImport = () => {
    if (selectedRows.size === 0) {
      toast('Veuillez sélectionner au moins une ligne à importer', 'error');
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmImport = async () => {
    setShowConfirmModal(false);
    if (!selectedFile) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('sendEmails', String(sendEmails));
      formData.append('defaultStatus', defaultStatus);
      formData.append('selectedRows', JSON.stringify(Array.from(selectedRows)));

      const response = await fetchWithAuth('/api/admin/import-existing', {
        method: 'POST',
        body: formData,
        _contentType: null,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de l'import");
      }

      setImportResult(data.result || null);
      setCurrentStep('result');
      toast('Import terminé avec succès', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erreur lors de l'import";
      toast(errorMessage, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewResult(null);
    setImportResult(null);
    setSelectedRows(new Set());
    setCurrentStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Selection helpers
  const toggleRow = (rowIndex: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (previewResult) {
      const importable = previewResult.rows.filter((r) => r.canImport).map((r) => r.rowIndex);
      setSelectedRows(new Set(importable));
    }
  };

  const deselectAll = () => {
    setSelectedRows(new Set());
  };

  if (loading) {
    return (
      <main className="flex justify-center items-center h-[90vh]">
        <Loader />
      </main>
    );
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  // Compute selection stats
  const selectedCount = selectedRows.size;
  const selectedNewUsers = previewResult
    ? previewResult.rows.filter((r) => selectedRows.has(r.rowIndex) && r.userStatus === 'new')
        .length
    : 0;
  const selectedNewInstitutions = previewResult
    ? previewResult.rows.filter(
        (r) => selectedRows.has(r.rowIndex) && r.institutionStatus === 'new',
      ).length
    : 0;
  const selectedSeats = previewResult
    ? previewResult.rows
        .filter((r) => selectedRows.has(r.rowIndex))
        .reduce((sum, r) => sum + r.raw.seats, 0)
    : 0;

  return (
    <main className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">
            Import d&apos;inscriptions
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-700 font-ibm">
            Importez des inscriptions existantes depuis un fichier Excel pour migrer les données
            vers la plateforme.
          </p>
        </header>

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2 text-sm font-ibm">
          <StepBadge
            step={1}
            label="Upload & Options"
            active={currentStep === 'upload'}
            done={currentStep !== 'upload'}
          />
          <span className="text-gray-300">→</span>
          <StepBadge
            step={2}
            label="Prévisualisation"
            active={currentStep === 'preview'}
            done={currentStep === 'result'}
          />
          <span className="text-gray-300">→</span>
          <StepBadge step={3} label="Résultat" active={currentStep === 'result'} done={false} />
        </div>

        {/* Warning banner */}
        <div className="mb-6 bg-amber-50 border border-amber-200 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 font-ibm">
            <p className="font-semibold mb-1">Action irréversible</p>
            <p>
              L&apos;import crée des utilisateurs, des institutions et des inscriptions en base de
              données. Vous pourrez vérifier le contenu du fichier avant de confirmer l&apos;import.
            </p>
          </div>
        </div>

        {/* File naming warning */}
        {currentStep === 'upload' && (
          <div className="mb-6 bg-blue-50 border border-blue-200 p-4 flex gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 font-ibm">
              <p className="font-semibold mb-1">Nom de fichier sans espaces</p>
              <p>
                Pour éviter les erreurs d&apos;import sous Windows, renommez votre fichier pour
                supprimer les espaces et caractères spéciaux (ex: utilisez des tirets:
                &quot;import-existant.xlsx&quot;).
              </p>
            </div>
          </div>
        )}

        {/* ===== STEP 1: Upload & Options ===== */}
        {currentStep === 'upload' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: file upload + options */}
            <div className="lg:col-span-2 space-y-6">
              {/* File upload zone */}
              <section className="bg-white border border-gray-200 p-6">
                <h2 className="text-lg font-poppins font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Fichier source
                </h2>

                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragOver
                      ? 'border-black bg-gray-50'
                      : selectedFile
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    onChange={handleInputChange}
                    className="hidden"
                    disabled={isAnalyzing}
                  />

                  {selectedFile ? (
                    <div className="space-y-2">
                      <CheckCircle className="w-10 h-10 text-green-600 mx-auto" />
                      <p className="font-semibold text-gray-900 font-poppins">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-gray-500 font-ibm">
                        {formatFileSize(selectedFile.size)}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetForm();
                        }}
                        className="text-sm text-red-600 hover:text-red-800 underline font-ibm"
                      >
                        Supprimer le fichier
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-10 h-10 text-gray-400 mx-auto" />
                      <p className="font-semibold text-gray-700 font-poppins">
                        Glissez-déposez votre fichier ici
                      </p>
                      <p className="text-sm text-gray-500 font-ibm">
                        ou cliquez pour sélectionner — formats acceptés : .xlsx
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Configuration options */}
              <section className="bg-white border border-gray-200 p-6">
                <h2 className="text-lg font-poppins font-semibold mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Options d&apos;import
                </h2>

                <div className="space-y-5">
                  {/* Email toggle */}
                  <div className="flex items-start justify-between gap-4 pb-5 border-b border-gray-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-600" />
                        <label
                          htmlFor="sendEmails"
                          className="font-semibold text-gray-900 font-poppins"
                        >
                          Envoyer les emails de bienvenue
                        </label>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 font-ibm ml-6">
                        Envoie un email aux nouveaux utilisateurs créés avec leurs identifiants de
                        connexion (email + mot de passe généré). Les utilisateurs existants ne sont
                        pas notifiés.
                      </p>
                    </div>
                    <button
                      id="sendEmails"
                      type="button"
                      role="switch"
                      aria-checked={sendEmails}
                      onClick={() => setSendEmails(!sendEmails)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        sendEmails ? 'bg-black' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          sendEmails ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Default status */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckSquare className="w-4 h-4 text-gray-600" />
                      <label className="font-semibold text-gray-900 font-poppins">
                        Statut par défaut des inscriptions
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-6">
                      {STATUS_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDefaultStatus(option.value)}
                          className={`p-3 border rounded-lg text-left transition-colors ${
                            defaultStatus === option.value
                              ? 'border-black bg-gray-50 ring-1 ring-black'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <p className="font-semibold text-gray-900 text-sm font-poppins">
                            {option.label}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 font-ibm">
                            {option.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Analyze button */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!selectedFile || isAnalyzing}
                  className="flex items-center gap-2 bg-black text-white px-6 py-3 font-poppins font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Analyser le fichier
                    </>
                  )}
                </button>

                {selectedFile && !isAnalyzing && (
                  <p className="text-sm text-gray-500 font-ibm">
                    Fichier sélectionné : <span className="font-medium">{selectedFile.name}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Right column: instructions */}
            <div className="space-y-6">
              {/* Required columns */}
              <section className="bg-white border border-gray-200 p-5">
                <h3 className="font-poppins font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">
                  Colonnes requises
                </h3>
                <ul className="space-y-2.5">
                  {REQUIRED_COLUMNS.map((col) => (
                    <li key={col.name} className="text-sm font-ibm">
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">
                        {col.name}
                      </span>
                      <p className="text-gray-500 mt-0.5 ml-0.5">{col.description}</p>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Optional columns */}
              <section className="bg-white border border-gray-200 p-5">
                <h3 className="font-poppins font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">
                  Colonnes optionnelles (si l&apos;établissement n&apos;existe pas, il sera créé
                  automatiquement)
                </h3>
                <ul className="space-y-2.5">
                  {OPTIONAL_COLUMNS.map((col) => (
                    <li key={col.name} className="text-sm font-ibm">
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">
                        {col.name}
                      </span>
                      <p className="text-gray-500 mt-0.5 ml-0.5">{col.description}</p>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Behavior notes */}
              <section className="bg-white border border-gray-200 p-5">
                <h3 className="font-poppins font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">
                  Comportement
                </h3>
                <ul className="space-y-2 text-sm text-gray-600 font-ibm">
                  <li className="flex gap-2">
                    <Users className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span>
                      Si l&apos;email existe déjà, l&apos;utilisateur existant est réutilisé (pas de
                      doublon)
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Briefcase className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span>
                      Les institutions sont recherchées par nom. Si l&apos;adresse est fournie et
                      que l&apos;institution n&apos;existe pas, elle est créée automatiquement
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <CheckSquare className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span>
                      Les inscriptions en doublon (même utilisateur/événement/date) sont ignorées
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <AlertCircle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span>
                      Les événements doivent déjà exister dans la base de données (correspondance
                      par titre)
                    </span>
                  </li>
                </ul>
              </section>
            </div>
          </div>
        )}

        {/* ===== STEP 2: Preview ===== */}
        {currentStep === 'preview' && previewResult && (
          <div className="space-y-6">
            {/* Preview summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard
                label="Lignes totales"
                value={previewResult.totalRows}
                icon={<FileText className="w-4 h-4" />}
              />
              <StatCard
                label="Lignes valides"
                value={previewResult.validRows}
                icon={<CheckCircle className="w-4 h-4" />}
                variant={previewResult.validRows > 0 ? 'success' : 'default'}
              />
              <StatCard
                label="Lignes invalides"
                value={previewResult.invalidRows}
                icon={<XCircle className="w-4 h-4" />}
                variant={previewResult.invalidRows > 0 ? 'error' : 'default'}
              />
              <StatCard
                label="Doublons"
                value={previewResult.duplicateRows}
                icon={<AlertCircle className="w-4 h-4" />}
                variant={previewResult.duplicateRows > 0 ? 'warning' : 'default'}
              />
              <StatCard
                label="Nouveaux utilisateurs"
                value={previewResult.newUsers}
                icon={<Users className="w-4 h-4" />}
              />
              <StatCard
                label="Nouveaux établissements"
                value={previewResult.newInstitutions}
                icon={<Briefcase className="w-4 h-4" />}
              />
            </div>

            {/* Extra info row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat label="Utilisateurs existants" value={previewResult.existingUsers} />
              <MiniStat
                label="Établissements existants"
                value={previewResult.existingInstitutions}
              />
              <MiniStat label="Événements trouvés" value={previewResult.eventsFound} />
              <MiniStat label="Places totales" value={previewResult.totalSeats} />
            </div>

            {/* Errors summary section */}
            {previewResult.invalidRows > 0 && (
              <div className="bg-red-50 border border-red-200 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-900 font-poppins text-lg">
                      {previewResult.invalidRows} erreur(s) détectée(s)
                    </h3>
                    <p className="text-sm text-red-700 font-ibm mt-0.5">
                      Ces lignes ne peuvent pas être importées. Veuillez corriger le fichier Excel
                      avant de réessayer.
                    </p>
                  </div>
                </div>

                {/* Grouped errors by category */}
                <div className="ml-9 space-y-4">
                  {(() => {
                    const errorsByCategory = new Map<
                      string,
                      { rowIndex: number; message: string }[]
                    >();

                    previewResult.rows.forEach((row) => {
                      if (row.error) {
                        // Determine error category
                        let category = 'Autres erreurs';
                        if (row.error.includes('Email')) {
                          category = "Erreurs d'email";
                        } else if (
                          row.error.includes('établissement') ||
                          row.error.includes('Ecole')
                        ) {
                          category = "Erreurs d'établissement";
                        } else if (
                          row.error.includes('spectacle') ||
                          row.error.includes('Événement')
                        ) {
                          category = "Erreurs d'événement";
                        } else if (row.error.includes('Date')) {
                          category = 'Erreurs de date';
                        } else if (row.error.includes('Inscription déjà existante')) {
                          category = 'Doublons';
                        }

                        if (!errorsByCategory.has(category)) {
                          errorsByCategory.set(category, []);
                        }
                        errorsByCategory.get(category)!.push({
                          rowIndex: row.rowIndex,
                          message: row.error,
                        });
                      }
                    });

                    return Array.from(errorsByCategory.entries()).map(([category, errors]) => (
                      <div
                        key={category}
                        className="bg-white/60 border border-red-200 rounded-lg p-3"
                      >
                        <h4 className="font-semibold text-red-800 font-poppins text-sm mb-2">
                          {category} ({errors.length})
                        </h4>
                        <ul className="text-sm text-red-700 space-y-1.5 font-ibm">
                          {errors.map(({ rowIndex, message }) => (
                            <li key={rowIndex} className="flex gap-2">
                              <span className="font-mono text-xs bg-red-100 px-1.5 py-0.5 rounded text-red-800 shrink-0">
                                L{rowIndex + 1}
                              </span>
                              <span className="wrap-break-word">{message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* Duplicate warnings section */}
            {previewResult.duplicateRows > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 font-ibm">
                  <p className="font-semibold mb-1">
                    {previewResult.duplicateRows} inscription(s) déjà existante(s)
                  </p>
                  <p>
                    Ces lignes ont été identifiées comme des doublons (même utilisateur, événement
                    et date) et ne seront pas importées.
                  </p>
                </div>
              </div>
            )}

            {/* Selection toolbar */}
            <div className="bg-white border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-ibm text-gray-600">
                  <span className="font-semibold text-gray-900">{selectedCount}</span> ligne(s)
                  sélectionnée(s) sur {previewResult.validRows} importable(s)
                </span>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs font-ibm text-blue-600 hover:text-blue-800 underline"
                >
                  Tout sélectionner
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-xs font-ibm text-blue-600 hover:text-blue-800 underline"
                >
                  Tout désélectionner
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs font-ibm text-gray-500">
                <span>{selectedNewUsers} nouv. utilisateur(s)</span>
                <span>•</span>
                <span>{selectedNewInstitutions} nouv. établissement(s)</span>
                <span>•</span>
                <span>{selectedSeats} places</span>
              </div>
            </div>

            {/* Preview table */}
            <div className="bg-white border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm font-ibm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={
                          selectedCount === previewResult.validRows && previewResult.validRows > 0
                        }
                        onChange={(e) => (e.target.checked ? selectAll() : deselectAll())}
                        className="rounded"
                      />
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      #
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Établissement
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Ville
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Référent
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Email
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Spectacle
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Places
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {previewResult.rows.map((row) => (
                    <tr
                      key={row.rowIndex}
                      className={`transition-colors ${
                        row.isDuplicate
                          ? 'bg-amber-50/50'
                          : !row.canImport
                            ? 'bg-red-50/50'
                            : selectedRows.has(row.rowIndex)
                              ? 'bg-blue-50/30'
                              : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.rowIndex)}
                          disabled={!row.canImport}
                          onChange={() => toggleRow(row.rowIndex)}
                          className="rounded disabled:opacity-30"
                        />
                      </td>
                      <td className="p-3 text-gray-400 text-xs">{row.rowIndex + 1}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-45" title={row.raw.institution}>
                            {row.raw.institution}
                          </span>
                          <StatusBadge
                            status={row.institutionStatus}
                            label={
                              row.institutionStatus === 'existing'
                                ? 'existant'
                                : row.institutionStatus === 'new'
                                  ? 'nouveau'
                                  : 'erreur'
                            }
                          />
                        </div>
                      </td>
                      <td className="p-3 text-gray-600">{row.raw.city}</td>
                      <td className="p-3">
                        <span
                          className="truncate max-w-35"
                          title={`${row.raw.referentFirstName} ${row.raw.referentLastName}`}
                        >
                          {row.raw.referentFirstName} {row.raw.referentLastName}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-45 text-gray-600" title={row.raw.email}>
                            {row.raw.email}
                          </span>
                          <StatusBadge
                            status={row.userStatus === 'existing' ? 'existing' : 'new'}
                            label={row.userStatus === 'existing' ? 'existant' : 'nouveau'}
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="truncate max-w-40"
                            title={row.eventName || row.raw.eventTitle}
                          >
                            {row.eventName || row.raw.eventTitle}
                          </span>
                          <StatusBadge
                            status={row.eventStatus === 'found' ? 'existing' : 'error'}
                            label={row.eventStatus === 'found' ? 'trouvé' : 'introuvable'}
                          />
                        </div>
                      </td>
                      <td className="p-3 text-gray-600 whitespace-nowrap">{row.raw.eventDate}</td>
                      <td className="p-3 text-gray-900 font-medium">{row.raw.seats}</td>
                      <td className="p-3">
                        {row.isDuplicate ? (
                          <span className="text-xs text-amber-600 font-medium">🔄 Doublon</span>
                        ) : row.error ? (
                          <span
                            className="text-xs text-red-600 truncate max-w-50 block"
                            title={row.error}
                          >
                            ⚠ {row.error}
                          </span>
                        ) : (
                          <span className="text-xs text-green-600">✓ Prêt</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleImport}
                disabled={selectedCount === 0 || isImporting}
                className="flex items-center gap-2 bg-black text-white px-6 py-3 font-poppins font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <Loader />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Confirmer l&apos;import ({selectedCount} ligne{selectedCount > 1 ? 's' : ''})
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep('upload')}
                className="px-6 py-3 font-poppins font-semibold text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 transition-colors cursor-pointer"
              >
                ← Retour
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 3: Results ===== */}
        {currentStep === 'result' && importResult && (
          <section className="space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard
                label="Lignes traitées"
                value={importResult.processed}
                total={importResult.totalRows}
              />
              <StatCard
                label="Utilisateurs créés"
                value={importResult.createdUsers}
                icon={<Users className="w-4 h-4" />}
              />
              <StatCard
                label="Établissements créés"
                value={importResult.createdInstitutions}
                icon={<Briefcase className="w-4 h-4" />}
              />
              <StatCard
                label="Inscriptions créées"
                value={importResult.createdRegistrations}
                icon={<CheckSquare className="w-4 h-4" />}
              />
              <StatCard
                label="Emails envoyés"
                value={importResult.emailsSent}
                icon={<Mail className="w-4 h-4" />}
              />
              <StatCard
                label="Erreurs"
                value={importResult.errors.length}
                icon={<XCircle className="w-4 h-4" />}
                variant={importResult.errors.length > 0 ? 'error' : 'default'}
              />
            </div>

            {/* Success message */}
            {importResult.errors.length === 0 && (
              <div className="bg-green-50 border border-green-200 p-4 flex gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <p className="text-sm text-green-800 font-ibm">
                  L&apos;import s&apos;est terminé sans erreur.{' '}
                  {importResult.createdUsers > 0 && sendEmails && (
                    <span>
                      {importResult.emailsSent} email(s) de bienvenue ont été envoyés aux nouveaux
                      utilisateurs.
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Errors list */}
            {importResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 p-4">
                <div className="flex gap-3 mb-3">
                  <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <h3 className="font-semibold text-red-900 font-poppins">
                    {importResult.errors.length} erreur(s) rencontrée(s)
                  </h3>
                </div>
                <div className="max-h-60 overflow-y-auto ml-8">
                  <ul className="text-sm text-red-700 space-y-1 font-ibm">
                    {importResult.errors.map((error, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="text-red-400">&bull;</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Reset button */}
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-2 px-6 py-3 font-poppins font-semibold text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              Nouvel import
            </button>
          </section>
        )}
      </div>

      {/* Confirmation modal */}
      <ConfirmationModal
        open={showConfirmModal}
        onCancel={() => setShowConfirmModal(false)}
        onConfirm={confirmImport}
        title="Confirmer l'import"
        description={`Vous allez importer ${selectedCount} ligne(s) sélectionnée(s). ${selectedNewUsers > 0 ? `${selectedNewUsers} nouveau(x) utilisateur(s) seront créés. ` : ''}${selectedNewInstitutions > 0 ? `${selectedNewInstitutions} nouvel(aux) établissement(s) seront créés. ` : ''}${sendEmails ? 'Les nouveaux utilisateurs recevront un email avec leurs identifiants.' : 'Aucun email ne sera envoyé.'} Les inscriptions seront créées avec le statut "${defaultStatus === 'PRESENT' ? 'Présent' : 'Absent'}". Cette action est irréversible.`}
      />

      <HelpWidget content={HELP_CONTENTS['admin-import']} isAdminPage={true} />
    </main>
  );
}

// Step badge component
function StepBadge({
  step,
  label,
  active,
  done,
}: {
  step: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-black text-white'
          : done
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-500'
      }`}
    >
      {done ? <CheckCircle className="w-3 h-3" /> : <span>{step}</span>}
      <span>{label}</span>
    </div>
  );
}

// Status badge for preview table
function StatusBadge({ status, label }: { status: 'existing' | 'new' | 'error'; label: string }) {
  const styles = {
    existing: 'bg-gray-100 text-gray-600',
    new: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${styles[status]}`}
    >
      {label}
    </span>
  );
}

// Mini stat for secondary info row
function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 p-3 flex items-center justify-between">
      <span className="text-xs text-gray-500 font-ibm">{label}</span>
      <span className="text-sm font-semibold text-gray-900 font-poppins">{value}</span>
    </div>
  );
}

// Stat card sub-component
function StatCard({
  label,
  value,
  total,
  icon,
  variant = 'default',
}: {
  label: string;
  value: number;
  total?: number;
  icon?: React.ReactNode;
  variant?: 'default' | 'error' | 'success' | 'warning';
}) {
  const bgClass =
    variant === 'error' && value > 0
      ? 'bg-red-50 border-red-200'
      : variant === 'success' && value > 0
        ? 'bg-green-50 border-green-200'
        : variant === 'warning' && value > 0
          ? 'bg-amber-50 border-amber-200'
          : 'bg-white border-gray-200';

  const textClass =
    variant === 'error' && value > 0
      ? 'text-red-700'
      : variant === 'success' && value > 0
        ? 'text-green-700'
        : variant === 'warning' && value > 0
          ? 'text-amber-700'
          : 'text-gray-900';

  return (
    <div className={`p-4 border ${bgClass}`}>
      <div className="flex items-center justify-between mb-1">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span className={`text-2xl font-poppins font-bold ${textClass}`}>
          {value}
          {total !== undefined && (
            <span className="text-sm font-normal text-gray-400">/{total}</span>
          )}
        </span>
      </div>
      <p className="text-xs text-gray-500 font-ibm">{label}</p>
    </div>
  );
}
