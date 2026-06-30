'use client';

import { useUser } from '@/context/UserContext';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Loader from '@/components/ui/Loader';

type ProtectedRouteProps = {
  children: ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
  redirectTo?: string;
};

/**
 * Component that protects routes that require authentication or admin access.
 * Redirects unauthenticated users to the login page or specified route.
 */
/**
 * ProtectedRoute component
 * Wrapper for routes requiring authentication or specific roles.
 * Redirects unauthenticated or unauthorized users.
 *
 * @param children - The content to render if authorized
 * @param requireAuth - Whether authentication is required (default: true)
 * @param requireAdmin - Whether ADMIN role is required (default: false)
 * @param requireSuperAdmin - Whether SUPERADMIN role is required (default: false)
 * @param redirectTo - Path to redirect to if unauthenticated (default: '/auth/login')
 */
export default function ProtectedRoute({
  children,
  requireAuth = true,
  requireAdmin = false,
  requireSuperAdmin = false,
  redirectTo = '/auth/login',
}: ProtectedRouteProps) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Wait for loading to complete
    if (loading) {
      return;
    }

    if (requireAuth && !user) {
      router.push(`${redirectTo}?redirect=${encodeURIComponent(pathname || '/')}`);
      return;
    }

    if (requireAdmin && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN'))) {
      router.push('/'); // Redirect to home if not admin
      return;
    }

    if (requireSuperAdmin && (!user || user.role !== 'SUPERADMIN')) {
      router.push('/'); // Redirect to home if not superadmin
      return;
    }
  }, [user, loading, requireAuth, requireAdmin, requireSuperAdmin, redirectTo, router, pathname]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col justify-center items-center">
          <Loader />
          <p className="font-poppins text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // Don't render if authentication requirements are not met
  if (requireAuth && !user) {
    return null;
  }
  if (requireAdmin && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN'))) {
    return null;
  }

  if (requireSuperAdmin && (!user || user.role !== 'SUPERADMIN')) {
    return null;
  }

  return <>{children}</>;
}
