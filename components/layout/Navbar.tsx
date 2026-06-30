'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useUser } from '@/context/UserContext';
import { useNotificationContext } from '@/context/NotificationContext';
import { useLogout } from '@/hooks/useLogout';

import {
  Bell,
  User,
  Calendar,
  CheckSquare,
  Sliders,
  TrendingUp,
  BarChart2,
  Briefcase,
  Settings,
  Shield,
  Upload,
  Database,
} from '@deemlol/next-icons';

import CroppedLogo from '@/assets/cropped-logo.svg';
import Logo from '@/assets/logo.svg';
import Loader from '@/components/ui/Loader';
import NotificationDropdown from '@/components/ui/NotificationDropdown';

/**
 * Navbar Component
 *
 * Displays the main navigation bar of the application.
 * Handles:
 * - Responsive mobile menu toggling
 * - User authentication state display (Login/Register vs Profile)
 * - Notification dropdown
 * - Navigation links based on user role (Admin, User, Public)
 * - Scroll-based menu closing
 */
export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State to manage mobile links menu visibility
  const [isMenuClosing, setIsMenuClosing] = useState(false); // State to manage closing animation
  const [showProfileMenu, setShowProfileMenu] = useState(false); // State to manage profile menu visibility
  const [showNotifications, setShowNotifications] = useState(false); // State to manage notifications dropdown
  const { user, loading } = useUser(); // Get user from context
  const { unreadCount } = useNotificationContext(); // Get notifications data from context
  const logout = useLogout(); // Get logout function from custom hook
  const pathname = usePathname(); // Get current pathname to detect route changes

  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  /**
   * Effect to close menus when the route changes.
   * Ensures that navigating to a new page resets the navbar state.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowProfileMenu(false);
    setShowNotifications(false);
  }, [pathname]);

  /**
   * Effect to close the mobile menu when the user scrolls.
   * Provides a smooth closing animation.
   */
  useEffect(() => {
    const handleScroll = () => {
      if (isMenuOpen && !isMenuClosing) {
        setIsMenuClosing(true);
        setTimeout(() => {
          setIsMenuOpen(false);
          setIsMenuClosing(false);
        }, 300); // Match animation duration
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMenuOpen, isMenuClosing]);

  /**
   * Effect to close profile menu when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedOutsideMenu = profileMenuRef.current && !profileMenuRef.current.contains(target);
      const clickedOnButton = profileButtonRef.current && profileButtonRef.current.contains(target);

      if (clickedOutsideMenu && !clickedOnButton) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProfileMenu]);

  // Navigation links for the navbar
  const navLinks = [
    {
      href: '/events',
      label: 'Événements',
      icon: Calendar,
      adminVisible: true,
      userVisible: true,
      publicVisible: true,
      color: 'bg-black',
    },
    {
      href: '/account/registrations',
      label: "Demandes d'inscriptions",
      icon: CheckSquare,
      adminVisible: false,
      userVisible: true,
      publicVisible: false,
      color: 'bg-black',
    },
    {
      href: '/admin',
      label: 'Dashboard',
      icon: Sliders,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-black',
    },
    {
      href: '/admin/events',
      label: 'Événements (Gestion)',
      icon: Calendar,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-black',
    },
    {
      href: '/admin/statistics',
      label: 'Statistiques',
      icon: BarChart2,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-black',
    },
    {
      href: '/admin/institutions',
      label: 'Institutions',
      icon: Briefcase,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-black',
    },
    {
      href: '/admin/users',
      label: 'Utilisateurs',
      icon: User,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-black',
    },
    {
      href: '/admin/scoring-config',
      label: 'Scoring',
      icon: TrendingUp,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-black',
    },
    {
      href: '/admin/settings',
      label: 'Paramètres',
      icon: Settings,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-black',
    },
    {
      href: '/admin/security',
      label: 'Sécurité',
      icon: Shield,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-black',
    },
    {
      href: '/admin/import-existing',
      label: 'Import',
      icon: Upload,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-black',
    },
    {
      href: '/admin/backups',
      label: 'Backups',
      icon: Database,
      adminVisible: true,
      userVisible: false,
      publicVisible: false,
      color: 'bg-black',
    },
  ];

  // Helper to determine admin roles (kept in sync with types/role.ts)
  const isAdminRole = (role: string | undefined) => role === 'ADMIN' || role === 'SUPERADMIN';

  /**
   * Handle user logout by clearing the access token and resetting user state.
   */
  const handleLogout = async () => {
    await logout();
    setShowProfileMenu(false);
  };

  /**
   * Handle notifications display.
   */
  const handleNotifications = () => {
    setShowNotifications((prev) => !prev);
    setShowProfileMenu(false); // Close profile menu if open
  };

  return (
    <header className="flex flex-col w-full bg-white relative">
      {/* Navbar */}

      <div className="flex max-h-1/3 items-center py-5 px-8 shadow-md z-10 relative">
        {/* Logo */}

        <Link href="/" className="md:flex-none">
          <Image src={CroppedLogo} alt="Logo" className="md:hidden" priority />
          <Image src={Logo} alt="Logo" className="hidden md:block" priority />
        </Link>

        {/* Button to toggle mobile menu - centered on mobile */}

        <button
          className="md:hidden cursor-pointer absolute left-1/2 -translate-x-1/2 w-6 h-6 flex flex-col justify-center items-center"
          onClick={() => {
            if (isMenuOpen) {
              setIsMenuClosing(true);
              setTimeout(() => {
                setIsMenuOpen(false);
                setIsMenuClosing(false);
              }, 300);
            } else {
              setIsMenuOpen(true);
            }
          }}
        >
          <div className="relative w-6 h-5 flex items-center justify-center">
            <span
              className={`block h-0.5 w-full bg-black transition-all duration-300 ease-in-out absolute ${
                isMenuOpen ? 'rotate-45' : 'rotate-0 -translate-y-2'
              }`}
            />
            <span
              className={`block h-0.5 w-full bg-black transition-all duration-300 ease-in-out absolute ${
                isMenuOpen ? 'opacity-0 scale-0' : 'opacity-100 scale-100'
              }`}
            />
            <span
              className={`block h-0.5 w-full bg-black transition-all duration-300 ease-in-out absolute ${
                isMenuOpen ? '-rotate-45' : 'rotate-0 translate-y-2'
              }`}
            />
          </div>
        </button>

        {/* Notification and Profile Menu */}

        <div className="flex justify-center items-center gap-6 relative ml-auto">
          {loading ? (
            <>
              <Loader />
            </>
          ) : (
            <>
              {user && (
                <div className="relative">
                  <button
                    ref={notificationButtonRef}
                    onClick={handleNotifications}
                    className="relative p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <Bell size={24} color="#000000" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <NotificationDropdown
                    isOpen={showNotifications}
                    onClose={() => setShowNotifications(false)}
                    buttonRef={notificationButtonRef as React.RefObject<HTMLButtonElement>}
                  />
                </div>
              )}
              <button
                ref={profileButtonRef}
                className="cursor-pointer"
                onClick={() => {
                  setShowProfileMenu((prev) => !prev);
                  setShowNotifications(false); // Close notifications if open
                }}
              >
                <User size={24} color="#000000" />
              </button>
            </>
          )}

          {showProfileMenu && (
            <div
              ref={profileMenuRef}
              className="absolute top-12 right-0 bg-white border shadow-lg w-64 z-50 p-6"
            >
              {loading ? (
                <Loader />
              ) : user ? (
                <>
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <p className="font-poppins font-semibold text-lg text-black">Bonjour</p>
                    <p className="font-ibm text-sm text-gray-600">{user.email}</p>
                  </div>
                  <div className="space-y-3">
                    <Link
                      href="/account"
                      className="block font-poppins font-medium text-black px-3 py-2 rounded"
                    >
                      Mon compte
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left font-poppins font-medium text-black px-3 py-2 rounded cursor-pointer"
                    >
                      Se déconnecter
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <h3 className="font-poppins font-semibold text-lg text-black mb-2">
                      Accès compte
                    </h3>
                    <p className="font-ibm text-sm text-gray-600">
                      Connectez-vous pour accéder à vos demandes d&apos;inscription
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Link
                      href={`/auth/login?redirect=${encodeURIComponent(pathname)}`}
                      className="block bg-black text-white px-4 py-3 font-poppins font-semibold text-center"
                    >
                      Se connecter
                    </Link>
                    <Link
                      href={`/auth/register?redirect=${encodeURIComponent(pathname)}`}
                      className="block border border-black text-black px-4 py-3 font-poppins font-semibold text-center"
                    >
                      Créer un compte
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation (mobile) */}

      <div
        className={`md:hidden font-poppins z-0 transition-all duration-300 ease-in-out overflow-hidden ${
          isMenuOpen
            ? isMenuClosing
              ? 'max-h-0 opacity-0'
              : 'max-h-96 opacity-100'
            : 'max-h-0 opacity-0'
        }`}
        style={{
          transitionProperty: 'max-height, opacity',
        }}
      >
        <div className="grid grid-cols-2">
          {navLinks
            .filter((link) =>
              user
                ? isAdminRole(user.role)
                  ? link.adminVisible
                  : link.userVisible
                : link.publicVisible,
            )
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
                  className={`flex flex-col items-center p-3 border border-white ${link.color} ${
                    isActive ? 'bg-white text-black!' : ''
                  }`}
                >
                  <Icon size={24} color={isActive ? '#000000' : '#ffffff'} />
                  <span
                    className={`text-sm mt-2 text-center ${isActive ? 'text-black' : 'text-white'}`}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}
        </div>
      </div>
    </header>
  );
}
