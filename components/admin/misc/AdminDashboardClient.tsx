'use client';

import { useUser } from '@/context/UserContext';
import Loader from '@/components/ui/Loader';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardStats, UpcomingEvent } from '@/lib/middleware/admin';
import { fetchJsonWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import { getEventUrl } from '@/lib/events/eventUrl';
import toast from '@/lib/utils/toast';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

import {
  TrendingUp,
  Briefcase,
  Users,
  Calendar,
  CheckSquare,
  MapPin,
  Settings,
  BarChart,
  Shield,
  Upload,
  Database,
  Mail,
  X,
  Loader as LoaderIcon,
} from '@deemlol/next-icons';

type AdminDashboardClientProps = {
  stats: DashboardStats;
  upcomingEvents: UpcomingEvent[];
};

/**
 * AdminDashboardClient component to display admin dashboard with stats and upcoming events
 * @param props - The props object containing stats and upcomingEvents
 * @returns The rendered component
 */
export default function AdminDashboardClient({ stats, upcomingEvents }: AdminDashboardClientProps) {
  const { user, loading } = useUser();
  const router = useRouter();
  const [events, setEvents] = useState<UpcomingEvent[]>(upcomingEvents);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const PAGE_LIMIT = 4;

  // Welcome emails pending state
  const [pendingEmailsCount, setPendingEmailsCount] = useState<number>(0);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [dismissedWelcomeAlert, setDismissedWelcomeAlert] = useState(false);

  // Redirect non-admin users
  useEffect(() => {
    if (!loading && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN'))) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Fetch events for a specific page
  const fetchEventsPage = async (page: number) => {
    setLoadingEvents(true);
    try {
      const { data, response } = await fetchJsonWithAuth(
        `/api/admin/upcoming-events?page=${page}&limit=${PAGE_LIMIT}`,
      );
      if (response.ok && data) {
        // @ts-expect-error - incoming API shape is dynamic
        setEvents(data.events || []);
        // @ts-expect-error - incoming API shape is dynamic
        setTotalEvents(data.total || 0);
        setCurrentPage(page);
      }
    } catch (err) {
      logger.error('Error fetching events:', err);
      toast('Erreur lors du chargement des événements', 'error');
    } finally {
      setLoadingEvents(false);
    }
  };

  // Calculate total pages
  const totalPages = Math.ceil(totalEvents / PAGE_LIMIT);

  // Fetch pending welcome emails count
  const fetchPendingEmailsCount = async () => {
    try {
      const { data, response } = await fetchJsonWithAuth('/api/admin/users/send-welcome-emails');
      if (response.ok && data) {
        // @ts-expect-error - incoming API shape is dynamic
        setPendingEmailsCount(data.count || 0);
      }
    } catch (err) {
      logger.error('Error fetching pending emails count:', err);
    }
  };

  // Send pending welcome emails
  const sendPendingWelcomeEmails = async () => {
    setSendingEmails(true);
    try {
      const { data, response } = await fetchJsonWithAuth('/api/admin/users/send-welcome-emails', {
        method: 'POST',
      });
      if (response.ok && data) {
        // @ts-expect-error - incoming API shape is dynamic
        const { successCount, errorCount, errors } = data;
        if (successCount > 0) {
          const message = `${successCount} email(s) envoyé(s) avec succès${
            errorCount > 0 ? `, ${errorCount} erreur(s)` : ''
          }`;
          toast(message, errorCount > 0 ? 'info' : 'success');
        }
        if (errors && errors.length > 0) {
          logger.error('Email errors:', errors);
        }
        setPendingEmailsCount(0);
      } else {
        toast('Erreur lors de l&apos;envoi des emails', 'error');
      }
    } catch (err) {
      logger.error('Error sending welcome emails:', err);
      toast('Erreur lors de l&apos;envoi des emails', 'error');
    } finally {
      setSendingEmails(false);
    }
  };

  // Initialize on mount
  useEffect(() => {
    const initializeTotalCount = async () => {
      try {
        const { data, response } = await fetchJsonWithAuth(
          `/api/admin/upcoming-events?page=1&limit=${PAGE_LIMIT}`,
        );
        if (response.ok && data) {
          // @ts-expect-error - incoming API shape is dynamic
          setTotalEvents(data.total || 0);
        }
      } catch (err) {
        logger.error('Error fetching total events:', err);
        // Silent error for total count to avoid spamming if main fetch fails too
      }
    };
    initializeTotalCount();
  }, []);

  // Fetch pending welcome emails count on mount
  useEffect(() => {
    fetchPendingEmailsCount();
  }, []);

  if (loading) {
    return (
      <main className="flex justify-center items-center h-[90vh]">
        <Loader />
      </main>
    );
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    return null;
  }

  // Admin navigation links
  const adminLinks = [
    {
      href: '/admin/statistics',
      title: 'Statistiques',
      description:
        'Consultez les statistiques détaillées des inscriptions, événements et utilisateurs',
      icon: BarChart,
    },
    {
      href: '/admin/institutions',
      title: 'Institutions',
      description: 'Gérez les institutions partenaires et leurs informations',
      icon: Briefcase,
    },
    {
      href: '/admin/users',
      title: 'Utilisateurs',
      description: 'Administrez les comptes utilisateurs et leurs permissions',
      icon: Users,
    },
    {
      href: '/admin/scoring-config',
      title: 'Scoring',
      description: "Configurez les critères de notation pour le tri des demandes d'inscription",
      icon: TrendingUp,
    },
    {
      href: '/admin/events',
      title: 'Événements',
      description: 'Gérez les événements et leurs informations',
      icon: Calendar,
    },
    {
      href: '/admin/settings',
      title: 'Paramètres',
      description: "Personnalisez les labels et textes affichés dans l'application",
      icon: Settings,
    },
    {
      href: '/admin/security',
      title: 'Sécurité',
      description: 'Consultez les logs de sécurité et détectez les activités suspectes',
      icon: Shield,
    },
    {
      href: '/admin/import-existing',
      title: 'Import',
      description: 'Importez des inscriptions existantes depuis un fichier Excel ou CSV',
      icon: Upload,
    },
    {
      href: '/admin/backups',
      title: 'Backups',
      description: 'Gérez les sauvegardes de la base de données, comparez et restaurez les données',
      icon: Database,
    },
  ];

  // Format date
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Date invalide';
    return d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  };

  // Calculate percentage
  const getPercentage = (booked: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((booked / total) * 100);
  };

  return (
    <main className="p-4 sm:p-6">
      {/* Header */}
      <header className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">
            Dashboard Administration
          </h1>
        </div>
        <p className="mt-2 text-sm sm:text-base text-gray-700 font-ibm">
          Bienvenue {user.first_name} {user.last_name}. Gérez l&#39;ensemble de la plateforme depuis
          cette interface.
        </p>
      </header>

      {/* Pending Welcome Emails Alert */}
      {pendingEmailsCount > 0 && !dismissedWelcomeAlert && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <Mail size={20} className="text-amber-600 mt-0.5" />
            </div>
            <div>
              <p className="font-ibm font-medium text-amber-900">
                {pendingEmailsCount} utilisateur(s) attendent un email de bienvenue
              </p>
              <p className="font-ibm text-sm text-amber-700 mt-1">
                Ces utilisateurs ont été importés mais n&apos;ont pas reçu leur email de bienvenue
                avec leur lien de connexion.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={sendPendingWelcomeEmails}
              disabled={sendingEmails}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-ibm text-sm font-medium rounded-md transition-colors flex items-center gap-2"
            >
              {sendingEmails ? (
                <>
                  <LoaderIcon size={16} />
                  <span>Envoi en cours...</span>
                </>
              ) : (
                <>
                  <Mail size={16} />
                  <span>Envoyer les emails</span>
                </>
              )}
            </button>
            <button
              onClick={() => setDismissedWelcomeAlert(true)}
              className="p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-md transition-colors"
              aria-label="Masquer l'alerte"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Statistics Boxes */}
      <section className="mb-6 sm:mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Upcoming Events */}
          <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full flex items-center justify-center">
                <Calendar size={18} color="#ffffff" className="sm:hidden" />
                <Calendar size={20} color="#ffffff" className="hidden sm:block" />
              </div>
              <span className="text-2xl sm:text-3xl font-poppins font-bold">
                {stats.upcomingEvents}
              </span>
            </div>
            <p className="font-ibm text-xs sm:text-sm text-gray-600">Événements à venir</p>
          </div>

          {/* Pending Registrations */}
          <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full flex items-center justify-center">
                <CheckSquare size={18} color="#ffffff" className="sm:hidden" />
                <CheckSquare size={20} color="#ffffff" className="hidden sm:block" />
              </div>
              <span className="text-2xl sm:text-3xl font-poppins font-bold">
                {stats.pendingRegistrations}
              </span>
            </div>
            <p className="font-ibm text-xs sm:text-sm text-gray-600">Inscriptions en attente</p>
          </div>

          {/* Total Users */}
          <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full flex items-center justify-center">
                <Users size={18} color="#ffffff" className="sm:hidden" />
                <Users size={20} color="#ffffff" className="hidden sm:block" />
              </div>
              <span className="text-2xl sm:text-3xl font-poppins font-bold">
                {stats.totalUsers}
              </span>
            </div>
            <p className="font-ibm text-xs sm:text-sm text-gray-600">Utilisateurs inscrits</p>
          </div>

          {/* Total Institutions */}
          <div className="bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full flex items-center justify-center">
                <Briefcase size={18} color="#ffffff" className="sm:hidden" />
                <Briefcase size={20} color="#ffffff" className="hidden sm:block" />
              </div>
              <span className="text-2xl sm:text-3xl font-poppins font-bold">
                {stats.totalInstitutions}
              </span>
            </div>
            <p className="font-ibm text-xs sm:text-sm text-gray-600">Institutions partenaires</p>
          </div>
        </div>
      </section>

      {/* Administration Section */}
      <section className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-poppins font-semibold mb-4 sm:mb-6">
          Administration
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4 sm:p-6 group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full flex items-center justify-center group-hover:bg-gray-800 transition-colors shrink-0">
                    <Icon size={18} color="#ffffff" className="sm:hidden" />
                    <Icon size={20} color="#ffffff" className="hidden sm:block" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-poppins font-semibold">{link.title}</h3>
                </div>
                <p className="font-ibm text-xs sm:text-sm text-gray-600 leading-relaxed">
                  {link.description}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-poppins font-semibold">
            Prochains événements avec des demandes d&apos;inscription
          </h2>
          <Link
            href="/events"
            className="text-xs sm:text-sm font-poppins font-semibold text-black border-b-2 border-black hover:text-gray-700 hover:border-gray-700 transition-colors w-fit"
          >
            Voir tous les événements
          </Link>
        </div>

        {loadingEvents ? (
          <div className="flex justify-center items-center py-12">
            <Loader />
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white border border-gray-200 shadow-sm p-6 sm:p-8 text-center">
            <p className="font-ibm text-sm sm:text-base text-gray-600">
              Aucun événement à venir pour le moment.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 sm:space-y-4">
              {events.map((event) => {
                const percentage = getPercentage(event.bookedSeats, event.totalSeats);
                const isAlmostFull = percentage >= 80;

                return (
                  <div
                    key={event.id}
                    className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4 sm:p-6"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Event Info */}
                      <div className="flex-1">
                        <h3 className="text-base sm:text-lg font-poppins font-semibold mb-2">
                          {event.title}
                        </h3>
                        <div className="flex flex-wrap gap-3 sm:gap-4 font-ibm text-xs sm:text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="sm:hidden" />
                            <Calendar size={16} className="hidden sm:block" />
                            <span className="text-xs sm:text-sm">{formatDate(event.nextDate)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="sm:hidden" />
                            <MapPin size={16} className="hidden sm:block" />
                            <span className="text-xs sm:text-sm">{event.location}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-3 sm:gap-4 items-center">
                        <div className="text-center">
                          <p className="text-xl sm:text-2xl font-poppins font-bold">
                            {event.registrationsCount}
                          </p>
                          <p className="font-ibm text-[10px] sm:text-xs text-gray-600">Demandes</p>
                        </div>
                        <div className="text-center">
                          <p
                            className={`text-xl sm:text-2xl font-poppins font-bold ${isAlmostFull ? 'text-red-600' : 'text-black'}`}
                          >
                            {event.totalSeats === 0
                              ? 'N/A'
                              : `${event.bookedSeats} / ${event.totalSeats}`}
                          </p>
                          <p className="font-ibm text-[10px] sm:text-xs text-gray-600">Places</p>
                        </div>
                        <div className="text-center min-w-12.5 sm:min-w-15">
                          <p
                            className={`text-xl sm:text-2xl font-poppins font-bold ${isAlmostFull ? 'text-red-600' : 'text-black'}`}
                          >
                            {percentage}%
                          </p>
                          <p className="font-ibm text-[10px] sm:text-xs text-gray-600">Rempli</p>
                        </div>
                        <Link
                          href={getEventUrl(event)}
                          className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-poppins font-semibold text-black border border-black hover:bg-gray-50 transition-colors whitespace-nowrap"
                        >
                          Voir détails
                        </Link>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 sm:mt-4">
                      <div className="w-full h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${isAlmostFull ? 'bg-red-600' : 'bg-black'}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 sm:mt-8">
                <button
                  onClick={() => fetchEventsPage(currentPage - 1)}
                  disabled={currentPage === 1 || loadingEvents}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-poppins font-semibold text-black border border-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Page précédente
                </button>
                <span className="font-ibm text-xs sm:text-sm text-gray-600 px-2">
                  Page {currentPage} sur {totalPages}
                </span>
                <button
                  onClick={() => fetchEventsPage(currentPage + 1)}
                  disabled={currentPage === totalPages || loadingEvents}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-poppins font-semibold text-black border border-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Page suivante
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Help Widget */}
      <HelpWidget content={HELP_CONTENTS['admin-dashboard']} isAdminPage={true} />
    </main>
  );
}
