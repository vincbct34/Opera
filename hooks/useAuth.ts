import { useUser } from '@/context/UserContext';
import { fetchWithAuth, setCSRFToken } from '@/lib/api/fetchWithAuth';
import { setAccessToken } from '@/lib/auth/tokenStore';
import { normalizeApiError } from '@/lib/validation/errorMessages';
import { useState } from 'react';

/**
 * Credentials required for user login.
 */
export type LoginCredentials = {
  email: string;
  password: string;
};

/**
 * Data required for user registration.
 */
export type RegisterCredentials = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  institution_ids: string[]; // Changed to support multiple institutions
  email_notifications_enabled?: boolean;
  events_reminders_enabled?: boolean;
};

/**
 * Result of a login or registration attempt.
 */
export type LoginResult = {
  success: boolean;
  error?: string;
  code?: string;
  email?: string;
};

/**
 * Custom hook for handling user authentication (login and registration).
 * @returns Object containing login and register functions, and loading state.
 */
export const useAuth = () => {
  const { refreshUser } = useUser();
  const [isLoading, setIsLoading] = useState(false);

  const login = async (credentials: LoginCredentials): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const response = await fetchWithAuth('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.accessToken) {
        setAccessToken(data.accessToken);

        // Set CSRF token from response (prevents race conditions)
        // The token is also automatically extracted from headers by fetchWithAuth
        if (data.csrfToken) {
          setCSRFToken(data.csrfToken);
        }

        await refreshUser(); // Refresh user data from context
        return { success: true };
      } else {
        return {
          success: false,
          error: normalizeApiError(data, 'Connexion impossible.'),
          code: data.code,
          email: data.email,
        };
      }
    } catch {
      return {
        success: false,
        error: normalizeApiError(null, 'Erreur réseau. Vérifiez votre connexion.'),
      };
      /* c8 ignore next */
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterCredentials): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const response = await fetchWithAuth('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.user) {
        // For register, we don't get an accessToken automatically
        // User needs to login after registration
        return { success: true };
      } else {
        return {
          success: false,
          error: normalizeApiError(data, 'Inscription impossible.'),
        };
      }
    } catch {
      return {
        success: false,
        error: normalizeApiError(null, 'Erreur réseau. Vérifiez votre connexion.'),
      };
      /* c8 ignore next */
    } finally {
      setIsLoading(false);
    }
  };

  return {
    login,
    register,
    isLoading,
  };
};
