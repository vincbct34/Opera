import { useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import { fetchWithAuth, clearCSRFToken } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import toast from '@/lib/utils/toast';

/**
 * Custom hook for handling user logout.
 * Handles server-side logout, local state cleanup, and CSRF token clearing.
 * @returns The logout function.
 */
export const useLogout = () => {
  const { logout: logoutFromContext } = useUser();

  const logout = useCallback(async () => {
    try {
      // Call the API to logout on the server side
      await fetchWithAuth('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      logger.error('Error during logout:', error);
      try {
        toast('Erreur lors de la déconnexion.', 'error');
      } catch {}
    } finally {
      // Clear CSRF token cache
      clearCSRFToken();
      // Use the context logout function to clean up local state
      logoutFromContext();
    }
  }, [logoutFromContext]);

  return logout;
};
