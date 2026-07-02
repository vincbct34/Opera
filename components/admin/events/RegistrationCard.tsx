import {
  Users,
  Briefcase,
  Calendar,
  Mail,
  Phone,
  TrendingUp,
  Eye,
  Check,
  X,
  Trash2,
  Edit,
} from '@deemlol/next-icons';
import {
  REGISTRATION_STATUS_LABELS as DEFAULT_REGISTRATION_STATUS_LABELS,
  ACCESSIBILITY_LABELS as DEFAULT_ACCESSIBILITY_LABELS,
  PUBLIC_CATEGORY_LABELS as DEFAULT_PUBLIC_CATEGORY_LABELS,
  SCHOOL_GRADE_LABELS,
  AGE_RANGE_LABELS,
} from '@/lib/config/labelMappings';
import {
  RegistrationStatus,
  Accessibility,
  PublicCategory,
  SchoolGrade,
  AgeRange,
} from '@/types/api';

interface RegistrationData {
  id: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
  };
  institution: {
    id: string;
    name: string;
    type: PublicCategory[];
    is_rep: boolean;
  };
  date: string;
  booked_seats: number;
  caretaker_count?: number;
  aesh_count?: number;
  status: RegistrationStatus;
  manager_first_name?: string;
  manager_last_name?: string;
  manager_email?: string;
  manager_phone_number?: string;
  comments?: string;
  disabilities?: Array<{ type: Accessibility; count: number; details?: string | null }>;
  was_present_comment?: string;
  created_at: string;
  updated_at?: string;
  score?: number;
  scoreBreakdown?: Array<{
    type: string;
    weight: number;
    rawScore: number;
    weightedScore: number;
    details?: string;
  }>;
  history?: {
    totalRegistrations: number;
    attendanceRate: number;
    monthsSinceLastAttendance: number | null;
    recentNoShow: boolean;
  };
  category?: PublicCategory[];
  grades?: SchoolGrade[];
  age_ranges?: AgeRange[];
  want_formation?: boolean;
  want_preparation?: boolean;
  blockSelections?: Array<{
    id: string;
    wants_to_attend: boolean;
    selected_date?: string | null;
    block: {
      id: string;
      title: string;
      mandatory?: boolean;
    };
  }>;
}

interface RegistrationCardProps {
  registration: RegistrationData;
  eventDate: Date;
  expanded: boolean;
  updating: boolean;
  isArchived?: boolean;
  onToggleExpand: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onDelete: () => void;
  onMarkAttended: () => void;
  onMarkNoShow: () => void;
  onEditAttendance: () => void;
  onViewHistory: () => void;
  onEditRegistration: () => void;
  registrationStatusLabels?: Record<string, string>;
  accessibilityLabels?: Record<string, string>;
  publicCategoryLabels?: Record<string, string>;
}

const STATUS_COLORS: Record<RegistrationStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-gray-50 text-gray-700 border-gray-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  ATTENDED: 'bg-blue-50 text-blue-700 border-blue-200',
  NO_SHOW: 'bg-gray-50 text-gray-500 border-gray-300',
};

const CRITERION_TYPE_LABELS: Record<string, string> = {
  ATTENDANCE_RATE: 'Présence',
  MONTHS_SINCE_LAST: 'Ancienneté',
  TOTAL_PARTICIPATIONS: 'Participations',
  RECENT_NO_SHOW: 'Absence récente',
  IS_REP_INSTITUTION: 'REP/REP+',
  FIRST_TIME_APPLICANT: '1ère demande',
  ACCESSIBILITY_NEEDS: 'Accessibilité',
  EARLY_REGISTRATION: 'Demande précoce',
  INSTITUTION_TYPE: 'Type établissement',
  REQUESTED_SEATS_COUNT: 'Taille groupe',
  CARETAKER_RATIO: 'Accompagnateurs',
  GEOGRAPHIC_ZONE: 'Zone géo.',
  EVENT_CATEGORY_MATCH: 'Corresp. public',
  AESH_COUNT: 'AESH',
};

/**
 * RegistrationCard component
 * Detailed card displaying a single registration in the admin list.
 * Features:
 * - Status badges and color coding
 * - Expandable details (manager info, comments, accessibility)
 * - Action buttons based on status (Confirm, Reject, Mark Present/Absent)
 * - Score display if available
 * - History summary
 *
 * @param registration - The registration data object
 * @param eventDate - Date of the event (for determining past/future actions)
 * @param expanded - Whether the card details are expanded
 * @param updating - Whether an action is currently in progress
 * @param onToggleExpand - Handler to toggle expansion
 * @param onConfirm - Handler to confirm registration
 * @param onReject - Handler to reject registration
 * @param onDelete - Handler to delete registration
 * @param onMarkAttended - Handler to mark as present
 * @param onMarkNoShow - Handler to mark as absent
 * @param onEditAttendance - Handler to edit attendance
 * @param onViewHistory - Handler to view institution history
 */
export default function RegistrationCard({
  registration,
  eventDate,
  expanded,
  updating,
  isArchived = false,
  onToggleExpand,
  onConfirm,
  onReject,
  onDelete,
  onMarkAttended,
  onMarkNoShow,
  onEditAttendance,
  onViewHistory,
  onEditRegistration,
  registrationStatusLabels,
  accessibilityLabels,
  publicCategoryLabels,
}: RegistrationCardProps) {
  // Use dynamic labels if provided, otherwise fall back to static defaults
  const REGISTRATION_STATUS_LABELS = registrationStatusLabels || DEFAULT_REGISTRATION_STATUS_LABELS;
  const ACCESSIBILITY_LABELS = accessibilityLabels || DEFAULT_ACCESSIBILITY_LABELS;
  const PUBLIC_CATEGORY_LABELS = publicCategoryLabels || DEFAULT_PUBLIC_CATEGORY_LABELS;
  const STATUS_LABELS = REGISTRATION_STATUS_LABELS;
  const isEventPast = new Date(eventDate) < new Date();
  const hasScore = registration.score !== null && registration.score !== undefined;

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

  const getScoreIcon = (score: number) => {
    if (score >= 75) return '🟢';
    if (score >= 50) return '🔵';
    if (score >= 25) return '🟡';
    return '🔴';
  };

  return (
    <div className="border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Score Badge (si disponible) */}
          {hasScore && (
            <div className="flex items-center gap-3">
              <div
                className={`px-3 py-2 border ${getScoreBadge(registration.score ?? 0)} min-w-20 text-center`}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-lg">{getScoreIcon(registration.score ?? 0)}</span>
                  <TrendingUp size={14} className={getScoreColor(registration.score ?? 0)} />
                </div>
                <div
                  className={`text-2xl font-poppins font-bold ${getScoreColor(registration.score ?? 0)}`}
                >
                  {registration.score}
                </div>
                <div className="text-xs text-gray-600 font-ibm">score</div>
              </div>
            </div>
          )}

          {/* Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="font-poppins font-semibold text-gray-900">
                {registration.user.first_name} {registration.user.last_name}
              </h3>
              <span className={`text-xs px-2 py-0.5 border ${STATUS_COLORS[registration.status]}`}>
                {STATUS_LABELS[registration.status]}
              </span>
              {registration.institution.is_rep && (
                <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-poppins font-medium">
                  REP+
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 font-ibm">
              <div className="flex items-center gap-2">
                <Briefcase size={14} className="shrink-0" />
                <span className="truncate">{registration.institution.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={14} className="shrink-0" />
                <span>{registration.booked_seats} places</span>
                {(registration.caretaker_count ?? 0) > 0 && (
                  <span className="text-gray-400">avec {registration.caretaker_count} accomp.</span>
                )}
                {(registration.aesh_count ?? 0) > 0 && (
                  <span className="text-gray-400">+ {registration.aesh_count} AESH</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="shrink-0" />
                <span>
                  {new Date(registration.date).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={14} className="shrink-0" />
                <span className="truncate">{registration.user.email}</span>
              </div>
            </div>

            {/* History Summary */}
            {registration.history && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 text-xs font-ibm text-blue-800">
                📊 Historique: {registration.history.totalRegistrations} demande(s)
                {registration.history.attendanceRate > 0 && (
                  <> · {Math.round(registration.history.attendanceRate)}% présence</>
                )}
                {registration.history.monthsSinceLastAttendance !== null && (
                  <> · Dernière: il y a {registration.history.monthsSinceLastAttendance} mois</>
                )}
                {registration.history.recentNoShow && (
                  <span className="ml-2 text-red-600">⚠️ Absence récente</span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap lg:flex-col gap-2 lg:min-w-35">
            <button
              onClick={onToggleExpand}
              className="flex-1 lg:flex-none px-3 py-1.5 text-xs border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors font-poppins font-medium"
            >
              {expanded ? 'Réduire' : 'Détails'}
            </button>

            <button
              onClick={onViewHistory}
              className="flex-1 lg:flex-none px-3 py-1.5 text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-poppins font-medium flex items-center justify-center gap-1"
            >
              <Eye size={14} />
              Historique
            </button>

            {/* Pending Actions */}
            {registration.status === 'PENDING' && !isArchived && (
              <>
                <button
                  onClick={onConfirm}
                  disabled={updating}
                  className="flex-1 lg:flex-none px-3 py-1.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 font-poppins font-medium flex items-center justify-center gap-1"
                >
                  <Check size={14} />
                  Confirmer
                </button>
                <button
                  onClick={onReject}
                  disabled={updating}
                  className="flex-1 lg:flex-none px-3 py-1.5 text-xs border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 font-poppins font-medium flex items-center justify-center gap-1"
                >
                  <X size={14} />
                  Rejeter
                </button>
              </>
            )}

            {/* Attendance Marking (for past events with CONFIRMED status) */}
            {isEventPast && registration.status === 'CONFIRMED' && !isArchived && (
              <>
                <button
                  onClick={onMarkAttended}
                  disabled={updating}
                  className="flex-1 lg:flex-none px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 font-poppins font-medium flex items-center justify-center gap-1"
                >
                  <Check size={14} />
                  {REGISTRATION_STATUS_LABELS.ATTENDED || 'Présent'}
                </button>
                <button
                  onClick={onMarkNoShow}
                  disabled={updating}
                  className="flex-1 lg:flex-none px-3 py-1.5 text-xs border border-gray-400 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 font-poppins font-medium flex items-center justify-center gap-1"
                >
                  <X size={14} />
                  {REGISTRATION_STATUS_LABELS.NO_SHOW || 'Absent'}
                </button>
              </>
            )}

            {/* Edit Attendance (for past events with ATTENDED or NO_SHOW status) */}
            {isEventPast &&
              !isArchived &&
              (registration.status === 'ATTENDED' || registration.status === 'NO_SHOW') && (
                <button
                  onClick={onEditAttendance}
                  disabled={updating}
                  className="flex-1 lg:flex-none px-3 py-1.5 text-xs bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50 font-poppins font-medium flex items-center justify-center gap-1"
                >
                  <Edit size={14} />
                  Modifier présence
                </button>
              )}

            {/* Edit Registration (full edit) */}
            {!isArchived && (
              <button
                onClick={onEditRegistration}
                disabled={updating}
                className="flex-1 lg:flex-none px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 font-poppins font-medium flex items-center justify-center gap-1"
              >
                <Edit size={14} />
                Modifier
              </button>
            )}

            {/* Delete - Hidden for archived events */}
            {!isArchived && (
              <button
                onClick={onDelete}
                disabled={updating}
                className="flex-1 lg:flex-none px-3 py-1.5 text-xs border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 font-poppins font-medium flex items-center justify-center gap-1"
              >
                <Trash2 size={14} />
                Supprimer
              </button>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3 text-sm font-ibm">
            {(registration.manager_first_name || registration.manager_last_name) && (
              <div>
                <p className="text-xs text-gray-500 mb-1 font-ibm">Responsable</p>
                <p className="font-medium font-poppins">
                  {registration.manager_first_name} {registration.manager_last_name}
                </p>
                {registration.manager_email && (
                  <div className="flex items-center gap-2 text-gray-600 mt-1">
                    <Mail size={14} />
                    <span>{registration.manager_email}</span>
                  </div>
                )}
                {registration.manager_phone_number && (
                  <div className="flex items-center gap-2 text-gray-600 mt-1">
                    <Phone size={14} />
                    <span>{registration.manager_phone_number}</span>
                  </div>
                )}
              </div>
            )}

            {/* Score Breakdown */}
            {hasScore && registration.scoreBreakdown && registration.scoreBreakdown.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1 font-ibm">Détail du score</p>
                <div className="bg-gray-50 p-3 border border-gray-200">
                  <div className="space-y-1">
                    {registration.scoreBreakdown.map((criterion) => (
                      <div
                        key={criterion.type}
                        className="flex items-center justify-between text-xs font-ibm"
                      >
                        <span className="text-gray-700">
                          {CRITERION_TYPE_LABELS[criterion.type] || criterion.type}
                          <span className="text-gray-400 ml-1">({criterion.weight}%)</span>
                        </span>
                        <span
                          className={`font-medium ${
                            criterion.rawScore >= 70
                              ? 'text-emerald-600'
                              : criterion.rawScore >= 40
                                ? 'text-amber-600'
                                : criterion.rawScore < 0
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                          }`}
                        >
                          {criterion.rawScore >= 0 ? criterion.rawScore : criterion.rawScore}
                          <span className="text-gray-400 ml-1">
                            → {criterion.weightedScore > 0 ? '+' : ''}
                            {Number(criterion.weightedScore.toFixed(1))}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {registration.comments && (
              <div>
                <p className="text-xs text-gray-500 mb-1 font-ibm">Commentaires</p>
                <div className="bg-gray-50 p-3">
                  <p className="text-gray-700 whitespace-pre-line font-ibm">
                    {registration.comments}
                  </p>
                </div>
              </div>
            )}

            {registration.disabilities && registration.disabilities.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1 font-ibm">Accessibilité</p>
                <div className="flex gap-2 flex-wrap">
                  {registration.disabilities.map(
                    (
                      d: { type: Accessibility; count: number; details?: string | null },
                      idx: number,
                    ) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 font-ibm"
                        title={d.type === 'OTHER' && d.details ? d.details : undefined}
                      >
                        {ACCESSIBILITY_LABELS[d.type]}: {d.count}
                        {d.type === 'OTHER' && d.details && ` (${d.details})`}
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}

            {registration.was_present_comment && (
              <div>
                <p className="text-xs text-gray-500 mb-1 font-ibm">Commentaire présence/absence</p>
                <div className="bg-amber-50 p-3 border border-amber-200">
                  <p className="text-gray-700 font-ibm">{registration.was_present_comment}</p>
                </div>
              </div>
            )}

            {/* Category and Sub-category */}
            {(registration.category && registration.category.length > 0) ||
            (registration.grades && registration.grades.length > 0) ||
            (registration.age_ranges && registration.age_ranges.length > 0) ? (
              <div>
                <p className="text-xs text-gray-500 mb-1 font-ibm">Public</p>
                <div className="flex flex-wrap gap-2">
                  {registration.category && registration.category.length > 0 && (
                    <>
                      {registration.category.map((cat) => (
                        <span
                          key={cat}
                          className="text-xs px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 font-ibm"
                        >
                          {PUBLIC_CATEGORY_LABELS[cat] || cat}
                        </span>
                      ))}
                    </>
                  )}
                  {registration.grades && registration.grades.length > 0 && (
                    <>
                      {registration.grades.map((grade) => (
                        <span
                          key={grade}
                          className="text-xs px-2 py-1 bg-pink-50 text-pink-700 border border-pink-200 font-ibm"
                        >
                          {SCHOOL_GRADE_LABELS[grade] || grade}
                        </span>
                      ))}
                    </>
                  )}
                  {registration.age_ranges && registration.age_ranges.length > 0 && (
                    <>
                      {registration.age_ranges.map((ageRange) => (
                        <span
                          key={ageRange}
                          className="text-xs px-2 py-1 bg-orange-50 text-orange-700 border border-orange-200 font-ibm"
                        >
                          {AGE_RANGE_LABELS[ageRange] || ageRange}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {/* Formation and Preparation flags */}
            {registration.blockSelections && registration.blockSelections.length > 0 ? (
              <div>
                <p className="text-xs text-gray-500 mb-1 font-ibm">Autour du spectacle</p>
                <div className="flex flex-wrap gap-2">
                  {registration.blockSelections.map((selection) => (
                    <span
                      key={selection.id}
                      className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-ibm"
                    >
                      {selection.wants_to_attend ? '✓' : 'Non'} {selection.block.title}
                      {selection.selected_date
                        ? ` - ${new Date(selection.selected_date).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : ''}
                    </span>
                  ))}
                </div>
              </div>
            ) : (registration.want_formation !== null &&
                registration.want_formation !== undefined) ||
              (registration.want_preparation !== null &&
                registration.want_preparation !== undefined) ? (
              <div>
                <p className="text-xs text-gray-500 mb-1 font-ibm">Autour du spectacle</p>
                <div className="flex flex-wrap gap-2">
                  {registration.want_formation && (
                    <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-ibm">
                      🎓 Formation souhaitée
                    </span>
                  )}
                  {registration.want_preparation && (
                    <span className="text-xs px-2 py-1 bg-teal-50 text-teal-700 border border-teal-200 font-ibm">
                      🎵 Préparation musicale souhaitée
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 font-ibm">
              <span>
                Créée le {new Date(registration.created_at).toLocaleDateString('fr-FR')} à{' '}
                {new Date(registration.created_at).toLocaleTimeString('fr-FR')}
              </span>
              {registration.updated_at && (
                <span>
                  Modifiée le {new Date(registration.updated_at).toLocaleDateString('fr-FR')} à{' '}
                  {new Date(registration.updated_at).toLocaleTimeString('fr-FR')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
