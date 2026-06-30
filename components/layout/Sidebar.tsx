'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

import { useUser } from '@/context/UserContext';

import {
  Calendar,
  CheckSquare,
  Sliders,
  TrendingUp,
  BarChart2,
  Briefcase,
  User,
  Settings,
  Shield,
  Upload,
  Database,
} from '@deemlol/next-icons';

/**
 * Sidebar Component
 *
 * Displays the side navigation menu for desktop views.
 * Handles:
 * - Rendering navigation links based on user role (Admin vs User vs Public)
 * - Active state indication (though currently handled by simple styling)
 * - Responsive hiding (hidden on mobile)
 */
export default function Sidebar() {
  const pathname = usePathname();
  const { user, loading } = useUser(); // Get user from context

  // Navigation links for the sidebar (hidden on mobile, the links will appear in the navbar)
  const navLinks = [
    {
      href: '/events',
      label: 'Événements',
      icon: Calendar,
      adminVisible: true,
      userVisible: true,
      publicVisible: true,
      color: 'bg-white hover:bg-black hover:text-white border-b-2 border-black',
    },
    {
      href: '/account/registrations',
      label: "Demandes d'inscriptions",
      icon: CheckSquare,
      adminVisible: false,
      userVisible: true,
      publicVisible: false,
      color: 'bg-white hover:bg-black hover:text-white border-b-2 border-black',
    },
    {
      href: '/admin',
      label: 'Dashboard',
      icon: Sliders,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-white hover:bg-black hover:text-white border-b-2 border-black',
    },
    {
      href: '/admin/events',
      label: 'Événements (Gestion)',
      icon: Calendar,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-white hover:bg-black hover:text-white border-b-2 border-black',
    },
    {
      href: '/admin/statistics',
      label: 'Statistiques',
      icon: BarChart2,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-white hover:bg-black hover:text-white border-b-2 border-black',
    },
    {
      href: '/admin/institutions',
      label: 'Institutions',
      icon: Briefcase,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-white hover:bg-black hover:text-white border-b-2 border-black',
    },
    {
      href: '/admin/users',
      label: 'Utilisateurs',
      icon: User,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-white hover:bg-black hover:text-white border-b-2 border-black',
    },
    {
      href: '/admin/scoring-config',
      label: 'Scoring',
      icon: TrendingUp,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-white hover:bg-black hover:text-white border-b-2 border-black',
    },
    {
      href: '/admin/settings',
      label: 'Paramètres',
      icon: Settings,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-white hover:bg-black hover:text-white border-b-2 border-black',
    },
    {
      href: '/admin/security',
      label: 'Sécurité',
      icon: Shield,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-white hover:bg-black hover:text-white border-b-2 border-black',
    },
    {
      href: '/admin/import-existing',
      label: 'Import',
      icon: Upload,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-white hover:bg-black hover:text-white border-b-2 border-black',
    },
    {
      href: '/admin/backups',
      label: 'Backups',
      icon: Database,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-white hover:bg-black hover:text-white border-b-2 border-black',
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-1/5 sticky top-0 h-screen overflow-y-auto shadow-[4px_0_6px_1px_rgba(0,0,0,0.1)]">
      {/* Navigation links for the sidebar (hidden on mobile, the links will appear in the navbar) */}

      <nav className="flex flex-col font-poppins">
        {/* Main links */}

        {loading ? (
          <div className="p-5 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
            <div className="h-5 bg-gray-200 rounded w-2/3 animate-pulse" />
            <div className="h-5 bg-gray-200 rounded w-1/2 animate-pulse" />
          </div>
        ) : (
          // Helper to determine admin roles (kept in sync with types/role.ts)
          (() => {
            const isAdmin = (role?: string) => role === 'ADMIN' || role === 'SUPERADMIN';

            const visibleLinks = navLinks
              .filter((link) =>
                user
                  ? isAdmin(user.role)
                    ? link.adminVisible && link.userVisible
                    : link.userVisible
                  : link.publicVisible,
              )
              .filter((link) => link.userVisible || link.publicVisible || link.adminVisible);

            if (visibleLinks.length === 0) return null;

            return (
              <div>
                <h3 className="text-center bg-black text-white font-semibold uppercase tracking-wide">
                  Pages principales
                </h3>
                {visibleLinks.map((link) => {
                  // Exact match or children, except /admin which only matches exactly
                  const isActive =
                    pathname === link.href ||
                    (pathname.startsWith(`${link.href}/`) && link.href !== '/admin');
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center space-x-3 p-5 ${link.color} ${
                        isActive ? 'bg-black! text-white!' : ''
                      }`}
                    >
                      <link.icon className="w-5 h-5" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })()
        )}

        {/* Administration links */}
        {loading
          ? null
          : user &&
            (user.role === 'ADMIN' || user.role === 'SUPERADMIN') && (
              <div>
                <h3 className="text-center bg-black text-white font-semibold uppercase tracking-wide">
                  Administration
                </h3>
                {navLinks
                  .filter((link) => link.adminVisible && !link.userVisible)
                  .map((link) => {
                    const Icon = link.icon;
                    // Exact match or children, except /admin which only matches exactly
                    const isActive =
                      pathname === link.href ||
                      (pathname.startsWith(`${link.href}/`) && link.href !== '/admin');
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center space-x-3 p-5 ${link.color} ${
                          isActive ? 'bg-black! text-white!' : ''
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
              </div>
            )}
      </nav>
    </aside>
  );
}
