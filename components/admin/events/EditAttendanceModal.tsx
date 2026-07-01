import { useState } from 'react';
import { X } from '@deemlol/next-icons';
import { RegistrationStatus } from '@prisma/client';

type AttendanceStatus = Extract<RegistrationStatus, 'ATTENDED' | 'NO_SHOW'>;

interface EditAttendanceModalProps {
  open: boolean;
  institutionName: string;
  eventTitle: string;
  currentStatus: AttendanceStatus;
  currentComment?: string;
  onCancel: () => void;
  onConfirm: (status: AttendanceStatus, comment?: string) => void;
  saving: boolean;
  registrationStatusLabels?: Record<string, string>;
}

const ABSENCE_REASONS = [
  { value: 'last_minute_cancellation', label: 'Annulation de dernière minute' },
  { value: 'transport_issue', label: 'Problème de transport' },
  { value: 'institution_closed', label: 'Établissement fermé' },
  { value: 'illness', label: 'Maladie/Cas de force majeure' },
  { value: 'no_reason', label: 'Aucune raison donnée' },
  { value: 'other', label: 'Autre' },
];

/**
 * EditAttendanceModal component
 * Modal to modify the attendance status of a registration.
 * Allows switching between 'ATTENDED' and 'NO_SHOW' and updating comments.
 *
 * @param open - Whether the modal is open
 * @param institutionName - Name of the institution
 * @param eventTitle - Title of the event
 * @param currentStatus - Current attendance status
 * @param currentComment - Current comment (optional)
 * @param onCancel - Callback to cancel
 * @param onConfirm - Callback to confirm changes
 * @param saving - Loading state
 */
export default function EditAttendanceModal({
  open,
  institutionName,
  eventTitle,
  currentStatus,
  currentComment,
  onCancel,
  onConfirm,
  saving,
  registrationStatusLabels,
}: EditAttendanceModalProps) {
  const [status, setStatus] = useState<AttendanceStatus>(currentStatus);
  const [comment, setComment] = useState(currentComment || '');
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  if (!open) return null;

  const handleConfirm = () => {
    let finalComment = comment;

    // Si le statut est NO_SHOW et qu'une raison pré-définie est sélectionnée
    if (status === 'NO_SHOW' && selectedReason) {
      if (selectedReason === 'other') {
        finalComment = customReason || 'Autre';
      } else {
        const reason = ABSENCE_REASONS.find((r) => r.value === selectedReason);
        finalComment = reason?.label || '';
      }
    }

    onConfirm(status, finalComment || undefined);
  };

  const isValid = status === 'ATTENDED' || (status === 'NO_SHOW' && (comment || selectedReason));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-poppins font-semibold">Modifier la présence</h2>
            <p className="text-sm text-gray-600 font-ibm mt-1">{institutionName}</p>
            <p className="text-xs text-gray-500 font-ibm">{eventTitle}</p>
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
        <div className="p-4 sm:p-6 space-y-4">
          {/* Status Selection */}
          <div>
            <label className="block text-sm font-poppins font-medium mb-3">Statut</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="ATTENDED"
                  checked={status === 'ATTENDED'}
                  onChange={() => setStatus('ATTENDED')}
                  disabled={saving}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-ibm">
                  {registrationStatusLabels?.ATTENDED || 'Présent'}
                </span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="NO_SHOW"
                  checked={status === 'NO_SHOW'}
                  onChange={() => setStatus('NO_SHOW')}
                  disabled={saving}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-ibm">
                  {registrationStatusLabels?.NO_SHOW || 'Absent'}
                </span>
              </label>
            </div>
          </div>

          {/* Absence Reason (only if NO_SHOW) */}
          {status === 'NO_SHOW' && (
            <>
              <div>
                <label className="block text-sm font-poppins font-medium mb-3">
                  Raison de l&apos;absence
                </label>
                <div className="space-y-2">
                  {ABSENCE_REASONS.map((reason) => (
                    <label
                      key={reason.value}
                      className="flex items-center gap-3 p-3 border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="absence_reason"
                        value={reason.value}
                        checked={selectedReason === reason.value}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        disabled={saving}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm font-ibm">{reason.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Custom Reason Input */}
              {selectedReason === 'other' && (
                <div>
                  <label className="block text-sm font-poppins font-medium mb-2">
                    Précisez la raison
                  </label>
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    disabled={saving}
                    className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-blue-500 font-ibm"
                    placeholder="Ex: Grève des transports"
                  />
                </div>
              )}
            </>
          )}

          {/* Comment field (for ATTENDED or manual NO_SHOW comment) */}
          {(status === 'ATTENDED' || (status === 'NO_SHOW' && !selectedReason)) && (
            <div>
              <label className="block text-sm font-poppins font-medium mb-2">
                Commentaire {status === 'NO_SHOW' ? '(obligatoire)' : '(optionnel)'}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={saving}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:border-blue-500 font-ibm resize-none"
                placeholder={
                  status === 'ATTENDED'
                    ? 'Informations complémentaires...'
                    : "Raison de l'absence..."
                }
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors font-poppins font-medium disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || !isValid}
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
              'Enregistrer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
