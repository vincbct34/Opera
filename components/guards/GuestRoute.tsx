'use client';

import { useUser } from '@/context/UserContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, ReactNode, Suspense } from 'react';
import Loader from '@/components/ui/Loader';

type GuestRouteProps = {
  children: ReactNode;
  redirectTo?: string;
};

/**
 * Component that protects routes that should only be accessible to guests (non-authenticated users).
 * Redirects authenticated users to the specified route or home page.
 */
function GuestRouteInner({ children, redirectTo = '/' }: GuestRouteProps) {
  const { user, loading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Wait for loading to complete
    if (loading) {
      return;
    }

    // If user is authenticated, redirect to the specified route or home
    if (user) {
      const redirect = searchParams.get('redirect') || redirectTo;
      router.push(redirect);
    }
  }, [user, loading, redirectTo, router, searchParams]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        <div className="flex flex-col justify-center items-center">
          <Loader />
          <p className="font-poppins text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  // Don't render if user is authenticated
  if (user) {
    return null;
  }

  return <>{children}</>;
}

/**
 * GuestRoute component
 * Wrapper for routes accessible only to unauthenticated users (e.g., login, register).
 * Redirects authenticated users to the home page or a specified redirect path.
 *
 * @param children - The content to render if the user is a guest
 * @param redirectTo - The path to redirect to if the user is authenticated (default: '/')
 */
export default function GuestRoute({ children, redirectTo = '/' }: GuestRouteProps) {
  return (
    <Suspense fallback={<Loader />}>
      <GuestRouteInner redirectTo={redirectTo}>{children}</GuestRouteInner>
    </Suspense>
  );
}
