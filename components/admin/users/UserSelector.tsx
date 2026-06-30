'use client';

import { useState, useEffect, startTransition } from 'react';
import { Search, Mail, User, X } from '@deemlol/next-icons';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import Loader from '@/components/ui/Loader';

interface UserOption {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface UserSelectorProps {
  onUserSelect: (user: UserOption | null) => void;
  initialUser?: UserOption | null;
  disabled?: boolean;
}

/**
 * UserSelector component
 * Allows admins to search and select a user by email or name.
 *
 * @param onUserSelect - Callback when a user is selected
 * @param initialUser - Initially selected user (optional)
 * @param disabled - Whether the selector is disabled
 */
export default function UserSelector({
  onUserSelect,
  initialUser = null,
  disabled = false,
}: UserSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(initialUser);
  const [isSearching, setIsSearching] = useState(false);

  // Load initial user if provided
  useEffect(() => {
    if (initialUser) {
      startTransition(() => setSelectedUser(initialUser));
    }
  }, [initialUser]);

  // Search users with debounce
  useEffect(() => {
    // Require at least 2 characters
    if (searchQuery.length < 2) {
      startTransition(() => setUsers([]));
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          q: searchQuery,
          limit: '10',
        });

        const response = await fetchWithAuth(`/api/admin/users/search?${params.toString()}`);

        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        } else {
          setUsers([]);
        }
      } catch (error) {
        logger.error('Error searching users:', error);
        setUsers([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleUserSelect = (user: UserOption) => {
    setSelectedUser(user);
    onUserSelect(user);
    setSearchQuery('');
    setUsers([]);
  };

  const handleClearSelection = () => {
    setSelectedUser(null);
    onUserSelect(null);
  };

  return (
    <div>
      {selectedUser ? (
        // Selected user display
        <div className="p-3 bg-blue-50 border border-blue-300 rounded">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <User size={20} className="text-white" />
              </div>
              <div>
                <div className="font-poppins font-semibold text-sm">
                  {selectedUser.first_name} {selectedUser.last_name}
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-600 font-ibm">
                  <Mail size={12} />
                  {selectedUser.email}
                </div>
              </div>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="p-1 hover:bg-blue-100 rounded transition-colors text-blue-600"
                title="Désélectionner"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      ) : (
        // Search mode
        <div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={disabled}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 font-ibm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Rechercher par email ou nom..."
            />
          </div>

          {isSearching && (
            <div className="flex justify-center items-center gap-2 py-3">
              <Loader />
              <p className="text-sm font-ibm text-gray-600">Recherche en cours...</p>
            </div>
          )}

          {!isSearching && users.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleUserSelect(user)}
                  disabled={disabled}
                  className="w-full text-left p-3 border-b border-gray-100 last:border-b-0 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <User size={16} className="text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-poppins font-medium text-sm truncate">
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 font-ibm truncate">
                        <Mail size={12} />
                        {user.email}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isSearching && searchQuery.length >= 2 && users.length === 0 && (
            <div className="mt-2 text-center py-2 text-gray-500 text-sm font-ibm">
              Aucun utilisateur trouvé
            </div>
          )}
        </div>
      )}
    </div>
  );
}
