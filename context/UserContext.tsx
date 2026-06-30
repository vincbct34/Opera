'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
  startTransition,
} from 'react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import toast from '@/lib/utils/toast';
import {
  getAccessToken,
  clearAccessToken,
  setAccessToken,
  getCachedUser,
  setCachedUser,
  hasPotentialCache,
} from '@/lib/auth/tokenStore';
import type { Role } from '@/app/generated/prisma/enums';

// Type definition for user
/**
 * Represents a user in the system.
 */
export type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  institution_ids?: string[]; // Changed to support multiple institutions
};

// Type definition for the context
/**
 * Interface defining the shape of the UserContext.
 */
type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
};

// Create the context
const UserContext = createContext<UserContextType | undefined>(undefined);

// Custom hook to use the user context
/**
 * Custom hook to access the UserContext.
 * @returns The user context value.
 * @throws Error if used outside of a UserProvider.
 */
export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// Provider component
/**
 * Provider component for the UserContext.
 * Manages user authentication state, token refreshing, and caching.
 * @param children - The child components to render.
 */
export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isRefreshing = useRef(false); // Empêche les appels multiples simultanés
  const hasInitialized = useRef(false); // Empêche le double refresh initial

  // Function to refresh user data - MÉMOÏSÉE pour éviter les re-renders inutiles
  const refreshUser = useCallback(async () => {
    // Empêcher les appels simultanés multiples
    if (isRefreshing.current) {
      return;
    }

    isRefreshing.current = true;

    try {
      // Only set loading to true if we don't have a cached user
      if (!getCachedUser()) {
        setLoading(true);
      }

      let token = getAccessToken();

      // If we have a token, try to use it directly first
      if (token) {
        const response = await fetchWithAuth('/api/users/me');
        if (response.ok) {
          const data = await response.json();
          if (data?.user) {
            setUser(data.user);
            setCachedUser(data.user);
            setLoading(false);
            return;
          }
        }
        // If the token is invalid, clear it and continue with refresh
        clearAccessToken();
        token = null;
      }

      // If no valid access token, try to refresh
      try {
        const refreshRes = await fetch('/api/auth/refresh', { method: 'POST' });
        if (refreshRes.ok) {
          const { accessToken: newToken } = await refreshRes.json();
          if (newToken) {
            setAccessToken(newToken);
            token = newToken;

            // Now try to get user with the new token
            const response = await fetchWithAuth('/api/users/me');
            if (response.ok) {
              const data = await response.json();
              if (data?.user) {
                setUser(data.user);
                setCachedUser(data.user);
              } else {
                setUser(null);
                clearAccessToken();
              }
            } else {
              clearAccessToken();
              setUser(null);
            }
          }
        } else {
          // No valid refresh -> ensure clean state
          clearAccessToken();
          setUser(null);
        }
      } catch {
        clearAccessToken();
        setUser(null);
      }
    } catch (error) {
      logger.error('Error fetching user:', error);
      setUser(null);
      clearAccessToken();
      // Notify user that their session could not be restored
      try {
        toast('Impossible de récupérer votre session. Veuillez vous reconnecter.', 'error');
      } catch {
        // swallow - toast may not be available during SSR hydration
      }
    } finally {
      setLoading(false);
      isRefreshing.current = false;
    }
  }, []); // Pas de dépendances - la fonction est stable

  // Initialize with cached user if available - SEULEMENT UNE FOIS
  useEffect(() => {
    if (hasInitialized.current) {
      return; // Déjà initialisé, on ne fait rien
    }

    hasInitialized.current = true;

    const cached = getCachedUser();
    startTransition(() => {
      if (cached) {
        setUser(cached);
        setLoading(false);
        // Still refresh in background to ensure data is up to date
        refreshUser();
      } else if (hasPotentialCache()) {
        // Il pourrait y avoir un cache, mais il a expiré
        // Tenter un refresh sans loading pour une UX plus fluide
        refreshUser();
      } else {
        // Pas de cache du tout, loading normal
        refreshUser();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Vraiment vide - on ne veut s'exécuter qu'une seule fois

  // Function to logout user
  const logout = useCallback(() => {
    clearAccessToken(); // This now also clears the cached user
    setUser(null);
  }, []);

  // Get user on mount
  // (Removed useEffect as initialization is now handled above)

  const value = {
    user,
    setUser,
    loading,
    refreshUser,
    logout,
    isAuthenticated: !!user,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
