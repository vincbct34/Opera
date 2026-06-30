import { X } from '@deemlol/next-icons';
import Loader from '@/components/ui/Loader';
import type { PublicCategory, RegistrationStatus } from '@/types/api';

interface PreviewModalProps {
  open: boolean;
  data: {
    stats?: {
      totalRegistrations?: number;
      scoreDistribution?: {
        excellent?: number;
        good?: number;
        fair?: number;
        poor?: number;
      };
      averageScore?: number;
    };
    configuration?: {
      id?: string;
      name: string;
      isValid: boolean;
      totalWeight: number;
    };
    preview?: Array<{
      registrationId?: string;
      institutionId?: string;
      institutionName: string;
      institutionType?: PublicCategory[];
      userFullName?: string;
      score: number;
      bookedSeats?: number;
      status?: RegistrationStatus;
      isRep?: boolean;
      history?: {
        totalRegistrations: number;
        attendanceRate: number;
        monthsSinceLastAttendance?: number;
      };
      breakdown?: Array<{
        criterion: string;
        weight: number;
        rawScore: number;
        weightedScore: number;
      }>;
    }>;
  } | null;
  loading: boolean;
  sampleEvent: { id: string; title: string } | null;
  onClose: () => void;
}

/**
 * PreviewModal component
 * Displays a simulation of scoring results based on the current configuration.
 * Features:
 * - Global statistics (distribution, average)
 * - List of registrations ranked by score
 * - Detailed breakdown of score calculation per registration
 *
 * @param open - Whether the modal is open
 * @param data - The preview data (stats, config, list)
 * @param loading - Loading state
 * @param sampleEvent - The event used for the simulation
 * @param onClose - Callback to close the modal
 */
export default function PreviewModal({
  open,
  data,
  loading,
  sampleEvent,
  onClose,
}: PreviewModalProps) {
  if (!open) return null;

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-emerald-600';
    if (score >= 50) return 'text-blue-600';
    if (score >= 25) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 75) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 50) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (score >= 25) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-700 border-red-200';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-poppins font-semibold">Aperçu des scores</h2>
            {sampleEvent && (
              <p className="text-sm text-gray-600 font-ibm mt-1">Événement: {sampleEvent.title}</p>
            )}
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
          ) : data ? (
            <div>
              {/* Stats */}
              {data.stats && (
                <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-gray-50 p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1 font-ibm">Total inscriptions</p>
                    <p className="text-xl font-bold text-gray-900 font-poppins">
                      {data.stats.totalRegistrations}
                    </p>
                  </div>
                  <div className="bg-emerald-50 p-3 border border-emerald-200">
                    <p className="text-xs text-emerald-700 mb-1 font-ibm">Score élevé (75-100)</p>
                    <p className="text-xl font-bold text-emerald-700 font-poppins">
                      {data.stats.scoreDistribution?.excellent ?? 0}
                    </p>
                  </div>
                  <div className="bg-blue-50 p-3 border border-blue-200">
                    <p className="text-xs text-blue-700 mb-1 font-ibm">Score moyen (50-74)</p>
                    <p className="text-xl font-bold text-blue-700 font-poppins">
                      {data.stats.scoreDistribution?.good ?? 0}
                    </p>
                  </div>
                  <div className="bg-amber-50 p-3 border border-amber-200">
                    <p className="text-xs text-amber-700 mb-1 font-ibm">Score bas (&lt;50)</p>
                    <p className="text-xl font-bold text-amber-700 font-poppins">
                      {(data.stats.scoreDistribution?.fair ?? 0) +
                        (data.stats.scoreDistribution?.poor ?? 0)}
                    </p>
                  </div>
                </div>
              )}

              {/* Configuration Info */}
              {data.configuration && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200">
                  <p className="text-sm font-ibm">
                    <span className="font-semibold">Configuration:</span> {data.configuration.name}
                    {data.configuration.isValid ? (
                      <span className="ml-2 text-emerald-600">✓ Valide (100%)</span>
                    ) : (
                      <span className="ml-2 text-red-600">
                        ✗ Invalide ({data.configuration.totalWeight}%)
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Preview List */}
              {data.preview && data.preview.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-lg font-poppins font-semibold">
                    Inscriptions triées par score
                  </h3>
                  {data.preview.slice(0, 10).map((item, index) => (
                    <div
                      key={item.registrationId}
                      className="border border-gray-200 bg-white p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Rank */}
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-poppins font-bold text-gray-400 min-w-[30px]">
                            #{index + 1}
                          </span>

                          {/* Score Badge */}
                          <div
                            className={`px-3 py-1 border ${getScoreBadge(item.score)} min-w-[70px] text-center`}
                          >
                            <span
                              className={`text-xl font-poppins font-bold ${getScoreColor(item.score)}`}
                            >
                              {item.score}
                            </span>
                          </div>
                        </div>

                        {/* Institution Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-poppins font-semibold text-sm truncate">
                            {item.institutionName}
                          </h4>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 font-ibm mt-1">
                            <span>{item.bookedSeats} places</span>
                            <span>Statut: {item.status}</span>
                            {item.isRep && <span className="text-emerald-600">REP+</span>}
                            {item.history && (
                              <>
                                <span>{item.history.totalRegistrations} participations</span>
                                {item.history.attendanceRate > 0 && (
                                  <span>{Math.round(item.history.attendanceRate)}% présence</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {data.preview.length > 10 && (
                    <p className="text-center text-sm text-gray-500 font-ibm py-2">
                      ... et {data.preview.length - 10} autres inscriptions
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 font-ibm">
                  Aucune inscription à afficher
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 font-ibm">
              Erreur lors du chargement de l&apos;aperçu
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
