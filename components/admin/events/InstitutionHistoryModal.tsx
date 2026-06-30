import { useState, useEffect } from 'react';
import { X } from '@deemlol/next-icons';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import Loader from '@/components/ui/Loader';
import toast from '@/lib/utils/toast';
import type { HistoryData } from '@/types/scoring';
import {
  REGISTRATION_STATUS_LABELS as DEFAULT_REGISTRATION_STATUS_LABELS,
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  SCHOOL_GRADE_LABELS as DEFAULT_SCHOOL_GRADE_LABELS,
  AGE_RANGE_LABELS as DEFAULT_AGE_RANGE_LABELS,
} from '@/lib/config/labelMappings';
import { RegistrationStatus } from '@/app/generated/prisma/enums';

interface InstitutionHistoryModalProps {
  open: boolean;
  institutionId: string | null;
  institutionName: string;
  onClose: () => void;
  registrationStatusLabels?: Record<string, string>;
  publicCategoryLabels?: Record<string, string>;
}

/**
 * InstitutionHistoryModal component
 * Displays the detailed history of an institution's registrations.
 * Features:
 * - Health indicator (Excellent, Good, Fair, Poor)
 * - Global statistics (Total, Confirmed, Attendance rate)
 * - Recent registrations list with status
 * - AI-generated report summary
 *
 * @param open - Whether the modal is open
 * @param institutionId - ID of the institution to fetch history for
 * @param institutionName - Name of the institution
 * @param onClose - Callback to close the modal
 */
export default function InstitutionHistoryModal({
  open,
  institutionId,
  institutionName,
  onClose,
  registrationStatusLabels,
  publicCategoryLabels,
}: InstitutionHistoryModalProps) {
  // Use dynamic labels if provided, otherwise fall back to static defaults
  const REGISTRATION_STATUS_LABELS = registrationStatusLabels || DEFAULT_REGISTRATION_STATUS_LABELS;
  const PUBLIC_CATEGORY_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;
  const SCHOOL_GRADE_LABELS = DEFAULT_SCHOOL_GRADE_LABELS;
  const AGE_RANGE_LABELS = DEFAULT_AGE_RANGE_LABELS;

  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);

  useEffect(() => {
    if (open && institutionId) {
      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, institutionId]);

  const fetchHistory = async () => {
    if (!institutionId) return;

    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/institutions/${institutionId}/history`);
      const data = await response.json();

      if (response.ok && data.success) {
        setHistoryData(data);
      } else {
        throw new Error(data.error || 'Erreur lors du chargement');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const getStatusBadge = (status: RegistrationStatus) => {
    const badges: Record<RegistrationStatus, string> = {
      PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
      CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      CANCELLED: 'bg-gray-50 text-gray-700 border-gray-200',
      REJECTED: 'bg-red-50 text-red-700 border-red-200',
      ATTENDED: 'bg-blue-50 text-blue-700 border-blue-200',
      NO_SHOW: 'bg-gray-50 text-gray-500 border-gray-300',
    };
    return badges[status] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getStatusLabel = (status: RegistrationStatus) => {
    return REGISTRATION_STATUS_LABELS[status] || status;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-poppins font-semibold">Historique</h2>
            <p className="text-sm text-gray-600 font-ibm mt-1">{institutionName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader />
            </div>
          ) : historyData ? (
            <div className="space-y-6">
              {/* Health Indicator */}
              {historyData.health && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200">
                  <span className="text-3xl">{historyData.health.icon}</span>
                  <div>
                    <p className="text-sm font-poppins font-semibold">
                      {historyData.health.level === 'excellent' && 'Excellent historique'}
                      {historyData.health.level === 'good' && 'Bon historique'}
                      {historyData.health.level === 'fair' && 'Historique moyen'}
                      {historyData.health.level === 'poor' && 'Historique à améliorer'}
                      {historyData.health.level === 'new' && 'Nouveau demandeur'}
                    </p>
                    <p className="text-xs text-gray-600 font-ibm">{historyData.summary}</p>
                  </div>
                </div>
              )}

              {/* Statistics */}
              {historyData.history && (
                <div>
                  <h3 className="text-lg font-poppins font-semibold mb-3">Statistiques globales</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-gray-50 p-3 border border-gray-200">
                      <p className="text-xs text-gray-500 mb-1 font-ibm">Demandes totales</p>
                      <p className="text-xl font-bold text-gray-900 font-poppins">
                        {historyData.history.totalRegistrations}
                      </p>
                    </div>
                    <div className="bg-emerald-50 p-3 border border-emerald-200">
                      <p className="text-xs text-emerald-700 mb-1 font-ibm">
                        {REGISTRATION_STATUS_LABELS.CONFIRMED || 'Confirmées'}
                      </p>
                      <p className="text-xl font-bold text-emerald-700 font-poppins">
                        {historyData.history.confirmedCount}
                        {historyData.history.totalRegistrations > 0 && (
                          <span className="text-sm ml-1">
                            ({Math.round(historyData.history.confirmationRate)}%)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-3 border border-blue-200">
                      <p className="text-xs text-blue-700 mb-1 font-ibm">
                        {REGISTRATION_STATUS_LABELS.ATTENDED || 'Présences'}
                      </p>
                      <p className="text-xl font-bold text-blue-700 font-poppins">
                        {historyData.history.attendedCount}
                        {historyData.history.confirmedCount > 0 && (
                          <span className="text-sm ml-1">
                            ({Math.round(historyData.history.attendanceRate)}%)
                          </span>
                        )}
                      </p>
                    </div>
                    {historyData.history.noShowCount > 0 && (
                      <div className="bg-red-50 p-3 border border-red-200">
                        <p className="text-xs text-red-700 mb-1 font-ibm">
                          {REGISTRATION_STATUS_LABELS.NO_SHOW || 'Absences'}
                        </p>
                        <p className="text-xl font-bold text-red-700 font-poppins">
                          {historyData.history.noShowCount}
                        </p>
                      </div>
                    )}
                    {historyData.history.cancelledCount > 0 && (
                      <div className="bg-gray-50 p-3 border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1 font-ibm">
                          {REGISTRATION_STATUS_LABELS.CANCELLED || 'Annulations'}
                        </p>
                        <p className="text-xl font-bold text-gray-700 font-poppins">
                          {historyData.history.cancelledCount}
                        </p>
                      </div>
                    )}
                  </div>

                  {historyData.history.recentNoShow && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 text-sm font-ibm text-amber-800">
                      ⚠️ Absence récente détectée (dans les 6 derniers mois)
                    </div>
                  )}
                </div>
              )}

              {/* Recent Registrations */}
              {historyData.history?.recentRegistrations &&
                historyData.history.recentRegistrations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-poppins font-semibold mb-3">Historique détaillé</h3>
                    <div className="space-y-2">
                      {historyData.history.recentRegistrations.map(
                        (
                          reg: {
                            eventId: string;
                            eventTitle: string;
                            eventLocation?: string;
                            date: Date;
                            status: RegistrationStatus;
                            wasPresent: boolean | null;
                            comment?: string;
                            bookedSeats: number;
                            caretakerCount?: number;
                            aeshCount?: number;
                            category?: string[];
                            grades?: string[];
                            ageRanges?: string[];
                            disabilitiesCount?: number;
                            wantFormation?: boolean;
                            wantPreparation?: boolean;
                          },
                          index: number,
                        ) => (
                          <div
                            key={index}
                            className="border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                              <div className="flex-1">
                                <h4 className="font-poppins font-semibold text-sm">
                                  {reg.eventTitle}
                                </h4>
                                <p className="text-xs text-gray-600 font-ibm">
                                  {new Date(reg.date).toLocaleDateString('fr-FR', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                  })}
                                  {reg.eventLocation && ` • ${reg.eventLocation}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-xs px-2 py-0.5 border ${getStatusBadge(reg.status)}`}
                                >
                                  {getStatusLabel(reg.status)}
                                </span>
                                {reg.wasPresent === true && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200">
                                    ✓ {REGISTRATION_STATUS_LABELS.ATTENDED || 'Présent'}
                                  </span>
                                )}
                                {reg.wasPresent === false && (
                                  <span className="text-xs px-2 py-0.5 bg-gray-50 text-gray-500 border border-gray-300">
                                    ✗ {REGISTRATION_STATUS_LABELS.NO_SHOW || 'Absent'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Details grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600 font-ibm">
                              <div>
                                <span className="font-semibold">Places :</span> {reg.bookedSeats}
                              </div>
                              {(reg.caretakerCount || 0) > 0 && (
                                <div>
                                  <span className="font-semibold">Accomp. :</span>{' '}
                                  {reg.caretakerCount}
                                </div>
                              )}
                              {(reg.aeshCount || 0) > 0 && (
                                <div>
                                  <span className="font-semibold">AESH :</span> {reg.aeshCount}
                                </div>
                              )}
                              {(reg.disabilitiesCount || 0) > 0 && (
                                <div>
                                  <span className="font-semibold">Handicap :</span>{' '}
                                  {reg.disabilitiesCount}
                                </div>
                              )}
                              {reg.category && reg.category.length > 0 && (
                                <div className="col-span-1 sm:col-span-2">
                                  <span className="font-semibold">Public :</span>{' '}
                                  {reg.category.map((cat) => (
                                    <span
                                      key={cat}
                                      className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 inline-block mr-1 mb-1"
                                    >
                                      {PUBLIC_CATEGORY_LABELS[cat] || cat}
                                    </span>
                                  ))}
                                  {reg.grades &&
                                    reg.grades.length > 0 &&
                                    reg.grades.map((grade) => (
                                      <span
                                        key={grade}
                                        className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block mr-1 mb-1"
                                      >
                                        {SCHOOL_GRADE_LABELS[grade] || grade}
                                      </span>
                                    ))}
                                  {reg.ageRanges &&
                                    reg.ageRanges.length > 0 &&
                                    reg.ageRanges.map((ageRange) => (
                                      <span
                                        key={ageRange}
                                        className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block mr-1 mb-1"
                                      >
                                        {AGE_RANGE_LABELS[ageRange] || ageRange}
                                      </span>
                                    ))}
                                </div>
                              )}
                              {(reg.wantFormation || reg.wantPreparation) && (
                                <div className="col-span-1 sm:col-span-2">
                                  <span className="font-semibold">Autour du spectacle :</span>{' '}
                                  {reg.wantFormation && (
                                    <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 inline-block">
                                      🎓 Formation
                                    </span>
                                  )}
                                  {reg.wantPreparation && (
                                    <span className="text-xs px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 inline-block ml-1">
                                      🎵 Prép. musicale
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {reg.comment && (
                              <p className="text-xs text-gray-600 font-ibm mt-2 italic">
                                💬 {reg.comment}
                              </p>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              {/* Report */}
              {historyData.report && (
                <div className="p-4 bg-blue-50 border border-blue-200">
                  <p className="text-sm font-ibm whitespace-pre-line text-gray-700">
                    {historyData.report}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 font-ibm">
              Erreur lors du chargement de l&apos;historique
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-black text-white hover:bg-gray-800 transition-colors font-poppins font-medium"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
