'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import Loader from '@/components/ui/Loader';
import { fetchJsonWithAuth, fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import { Role, UserListItemSerialized } from '@/types/api';
import toast from '@/lib/utils/toast';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import AdminUserCreateModal from '@/components/admin/users/AdminUserCreateModal';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

/**
 * AdminUsersClient component
 * Main dashboard for managing users.
 * Features:
 * - List users with pagination
 * - Live search by name and email
 * - Filter by role
 * - Create new user
 * - Edit user role (Superadmin only)
 * - Delete user
 *
 * @param initialData - Initial list of users
 */
export default function AdminUsersClient({
  initialData,
}: {
  initialData: UserListItemSerialized[];
}) {
  const [users, setUsers] = useState<UserListItemSerialized[]>(initialData || []);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const PAGE_LIMIT = 20;
  const [editing, setEditing] = useState<UserListItemSerialized | null>(null);
  const [role, setRole] = useState<Role | ''>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDeleteId, setToDeleteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  // debounce helper
  const debounceRef = useRef<number | undefined>(undefined);
  const debounce = (fn: () => void, wait = 300) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    debounceRef.current = window.setTimeout(fn, wait);
  };

  const fetchPage = async (p = 1, q = '', email = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', String(PAGE_LIMIT));
      if (q) params.set('search', q);
      if (email) params.set('email', email);
      const { data, response } = await fetchJsonWithAuth(`/api/users?${params.toString()}`);
      if (response.ok && data) {
        // @ts-expect-error - incoming API shape may not be typed
        const list = data.users || [];
        setUsers(list);
        setPage(p);
        // @ts-expect-error - incoming API shape may not be typed
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      logger.error(err);
      toast('Erreur lors du chargement des utilisateurs', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Live search: when `search` changes, perform a debounced fetchPage(1)
  useEffect(() => {
    // don't fetch if initial data provided and search/email are empty
    debounce(() => fetchPage(1, search, emailFilter), 300);
  }, [search, emailFilter]);

  const handleDelete = async (id?: string) => {
    const targetId = id || toDeleteId;
    if (!targetId) return setConfirmOpen(false);
    try {
      const res = await fetchWithAuth(`/api/users/${targetId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data && data.error) || 'Erreur');
      setUsers((prev) => prev.filter((u) => u.id !== targetId));
      toast('Utilisateur supprimé', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur';
      toast(msg, 'error');
      logger.error(error);
    } finally {
      setConfirmOpen(false);
      setToDeleteId(null);
    }
  };

  const { user } = useUser();
  const router = useRouter();

  const openEdit = (u: UserListItemSerialized) => {
    // If this is the current user, redirect to /account and don't open modal
    if (user && user.id === u.id) {
      router.push('/account');
      return;
    }
    // Redirect to the admin user detail page (server component at app/admin/users/[id]/page.tsx)
    router.push(`/admin/users/${u.id}`);
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const res = await fetchWithAuth(`/api/users/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data && data.error) || 'Erreur');
      setUsers((prev) => prev.map((u) => (u.id === editing.id ? { ...u, role: role as Role } : u)));
      setEditing(null);
      toast('Mise à jour effectuée', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
      logger.error(err);
    }
  };

  return (
    <main className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">
              Gestion des utilisateurs
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-700 font-ibm">
              Liste et administration des comptes utilisateurs.
            </p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2.5 bg-black text-white rounded-none hover:bg-gray-800 transition-colors font-medium text-sm sm:text-base whitespace-nowrap"
          >
            + Créer un utilisateur
          </button>
        </header>

        <div className="bg-white rounded-none shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPage(1, search, emailFilter)}
              placeholder="Rechercher par nom..."
              className="flex-1 py-2 sm:py-2.5 px-3 sm:px-4 border border-gray-300 rounded-none text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />

            <input
              type="text"
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchPage(1, search, emailFilter)}
              placeholder="Email"
              className="w-full sm:w-64 py-2 sm:py-2.5 px-3 sm:px-4 border border-gray-300 rounded-none text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />

            {(search || emailFilter) && (
              <button
                className="px-4 py-2 sm:py-2.5 border border-gray-300 rounded-none hover:bg-gray-50 transition-colors cursor-pointer font-medium text-sm sm:text-base"
                onClick={() => {
                  setSearch('');
                  setEmailFilter('');
                  fetchPage(1, '', '');
                }}
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-none shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500 font-ibm">Aucun utilisateur trouvé.</p>
          </div>
        ) : (
          <div className="bg-white rounded-none shadow-sm border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-200">
              {users.map((u) => (
                <div key={u.id} className="p-3 sm:p-4 md:p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1">
                        <h3 className="font-poppins font-semibold text-base sm:text-lg text-gray-900">
                          {u.first_name} {u.last_name}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-none text-xs font-medium w-fit ${
                            u.role === 'SUPERADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : u.role === 'ADMIN'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 font-ibm truncate">
                        {u.email}
                      </p>
                      <p className="text-xs text-gray-400 font-ibm mt-1">
                        Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex gap-2 sm:shrink-0 flex-wrap">
                      {user && user.role === 'SUPERADMIN' && (
                        <button
                          onClick={() => openEdit(u)}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 border border-blue-300 text-blue-600 rounded-none hover:bg-blue-50 transition-colors cursor-pointer font-medium text-xs sm:text-sm"
                        >
                          Modifier
                        </button>
                      )}
                      {!(user && user.id === u.id) && (
                        <button
                          onClick={() => {
                            setToDeleteId(u.id);
                            setConfirmOpen(true);
                          }}
                          className="px-3 sm:px-4 py-1.5 sm:py-2 border border-red-300 text-red-600 rounded-none hover:bg-red-50 transition-colors cursor-pointer font-medium text-xs sm:text-sm"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 sm:mt-8 pb-6">
          <button
            disabled={page <= 1}
            onClick={() => fetchPage(page - 1, search)}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-poppins font-semibold text-black border border-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            Page précédente
          </button>
          <span className="font-ibm text-xs sm:text-sm text-gray-600 px-2">
            Page {page} sur {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => fetchPage(page + 1, search)}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-poppins font-semibold text-black border border-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            Page suivante
          </button>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-none shadow-xl p-4 sm:p-6 w-full max-w-md">
            <h3 className="text-xl sm:text-2xl font-poppins font-semibold mb-4 sm:mb-6">
              Modifier l&#39;utilisateur
            </h3>
            {user && user.role === 'SUPERADMIN' ? (
              <>
                <label className="block mb-2 font-medium text-gray-700 text-sm sm:text-base">
                  Rôle
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full p-2 sm:p-3 border border-gray-300 rounded-none mb-4 sm:mb-6 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value={Role.USER}>USER</option>
                  <option value={Role.ADMIN}>ADMIN</option>
                  <option value={Role.SUPERADMIN}>SUPERADMIN</option>
                </select>
              </>
            ) : (
              <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6 font-ibm">
                Vous n&#39;avez pas la permission de modifier le rôle.
              </p>
            )}
            <div className="flex gap-2 sm:gap-3 justify-end">
              <button
                onClick={() => setEditing(null)}
                className="px-4 sm:px-5 py-2 sm:py-2.5 border border-gray-300 rounded-none hover:bg-gray-50 transition-colors cursor-pointer font-medium text-sm sm:text-base"
              >
                Annuler
              </button>
              <button
                onClick={saveEdit}
                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-black text-white rounded-none hover:bg-gray-800 transition-colors cursor-pointer font-medium text-sm sm:text-base"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        open={confirmOpen}
        title="Supprimer utilisateur"
        description="Confirmer la suppression de cet utilisateur ? Cette action est irréversible."
        onCancel={() => {
          setConfirmOpen(false);
          setToDeleteId(null);
        }}
        onConfirm={() => handleDelete()}
      />

      {isCreating && (
        <AdminUserCreateModal
          onClose={() => setIsCreating(false)}
          onSuccess={() => {
            setIsCreating(false);
            fetchPage(page, search, emailFilter);
          }}
          currentUserRole={user?.role as Role}
        />
      )}

      {/* Help Widget */}
      <HelpWidget content={HELP_CONTENTS['admin-users']} isAdminPage={true} />
    </main>
  );
}
