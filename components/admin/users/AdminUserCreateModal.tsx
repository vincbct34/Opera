'use client';

import { useState, useEffect } from 'react';
import { Search, MapPin, X, Eye, EyeOff } from '@deemlol/next-icons';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { logger } from '@/lib/middleware/logger';
import toast from '@/lib/utils/toast';
import { InstitutionSearchResult, Role } from '@/types/api';
import Loader from '@/components/ui/Loader';
import PasswordRequirements from '@/components/auth/PasswordRequirements';

interface AdminUserCreateModalProps {
  onClose: () => void;
  onSuccess: () => void;
  /** Role of the current user performing the creation */
  currentUserRole: Role;
}

/**
 * AdminUserCreateModal component
 * Modal for creating a new user.
 * Features:
 * - Basic info (name, email, phone)
 * - Password setting with requirements indicator
 * - Confirm password
 * - Role selection (adapted to the current user's permissions)
 * - Institution search by name and city
 * - Skip email verification option
 *
 * Behavior:
 * - ADMIN: can only create USER accounts
 * - SUPERADMIN: can create USER, ADMIN, or SUPERADMIN accounts
 *
 * @param onClose - Callback to close the modal
 * @param onSuccess - Callback when creation is successful
 * @param currentUserRole - Role of the admin performing the action
 */
export default function AdminUserCreateModal({
  onClose,
  onSuccess,
  currentUserRole,
}: AdminUserCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  // Institution search states
  const [nameSearch, setNameSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [searchResults, setSearchResults] = useState<InstitutionSearchResult[]>([]);
  const [selectedInstitutions, setSelectedInstitutions] = useState<InstitutionSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const isSuperAdmin = currentUserRole === 'SUPERADMIN';

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    role: 'USER' as string,
    skip_email_verification: false,
  });

  // Debounced institution search
  useEffect(() => {
    if (nameSearch.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams({ name: nameSearch, limit: '20' });
        if (citySearch.trim().length >= 2) {
          params.append('city', citySearch);
        }

        const response = await fetchWithAuth(`/api/institutions/search?${params.toString()}`);
        const data = await response.json();

        if (response.ok) {
          setSearchResults(data.institutions || []);
        } else {
          logger.error('Error searching institutions:', data.error);
          setSearchResults([]);
        }
      } catch (err) {
        logger.error('Error searching institutions:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [nameSearch, citySearch]);

  const handleSelectInstitution = (institution: InstitutionSearchResult) => {
    if (selectedInstitutions.some((i) => i.id === institution.id)) {
      setSelectedInstitutions(selectedInstitutions.filter((i) => i.id !== institution.id));
    } else {
      setSelectedInstitutions([...selectedInstitutions, institution]);
    }
  };

  const handleRemoveInstitution = (institutionId: string) => {
    setSelectedInstitutions(selectedInstitutions.filter((i) => i.id !== institutionId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate at least one institution is selected
    if (selectedInstitutions.length === 0) {
      toast('Veuillez sélectionner au moins une institution', 'error');
      return;
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      toast('Les mots de passe ne correspondent pas', 'error');
      return;
    }

    // Validate password length
    if (formData.password.length < 10) {
      toast('Le mot de passe doit contenir au moins 10 caractères', 'error');
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number,
        role: formData.role,
        skip_email_verification: formData.skip_email_verification,
        institution_ids: selectedInstitutions.map((i) => i.id),
      };

      const res = await fetchWithAuth('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la création');
      }

      toast('Utilisateur créé avec succès', 'success');
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast(msg, 'error');
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-none shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-poppins font-semibold mb-6">Créer un utilisateur</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium text-gray-700 text-sm">Prénom</label>
              <input
                required
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-700 text-sm">Nom</label>
              <input
                required
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium text-gray-700 text-sm">Email</label>
              <input
                required
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-700 text-sm">Téléphone</label>
              <input
                required
                type="tel"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>

          {/* Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium text-gray-700 text-sm">Mot de passe</label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onFocus={() => setShowPasswordRequirements(true)}
                  className="w-full p-2 pr-10 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                  minLength={10}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              <PasswordRequirements
                password={formData.password}
                showRequirements={showPasswordRequirements}
              />
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-700 text-sm">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <input
                  required
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full p-2 pr-10 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                  minLength={10}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
              )}
            </div>
          </div>

          {/* Role (SUPERADMIN sees all options, ADMIN only creates USERs) */}
          {isSuperAdmin ? (
            <div>
              <label className="block mb-1 font-medium text-gray-700 text-sm">Rôle</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="USER">Utilisateur</option>
                <option value="ADMIN">Administrateur</option>
                <option value="SUPERADMIN">Super-administrateur</option>
              </select>
            </div>
          ) : (
            <p className="text-xs text-gray-500 font-ibm">
              Le compte sera créé avec le rôle <strong>Utilisateur</strong>.
            </p>
          )}

          {/* Institutions */}
          <div>
            <label className="block mb-1 font-medium text-gray-700 text-sm">
              Institutions rattachées <span className="text-red-500">*</span>
            </label>

            {/* Selected institutions */}
            {selectedInstitutions.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {selectedInstitutions.map((inst) => (
                  <div
                    key={inst.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-sm rounded"
                  >
                    <span>{inst.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveInstitution(inst.id)}
                      className="hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Name search */}
            <div className="relative mb-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                className="w-full pl-9 p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Rechercher par nom..."
              />
            </div>

            {/* City search */}
            <div className="relative mb-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                className="w-full pl-9 p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Filtrer par ville (optionnel)..."
              />
            </div>

            {/* Search results */}
            {isSearching && (
              <div className="flex items-center gap-2 py-2">
                <Loader />
                <span className="text-sm text-gray-500">Recherche...</span>
              </div>
            )}

            {!isSearching && nameSearch.length >= 2 && searchResults.length === 0 && (
              <p className="text-sm text-gray-500 py-2">Aucun résultat trouvé</p>
            )}

            {searchResults.length > 0 && (
              <div className="border border-gray-300 max-h-40 overflow-y-auto">
                {searchResults.map((inst) => {
                  const isSelected = selectedInstitutions.some((s) => s.id === inst.id);
                  return (
                    <button
                      key={inst.id}
                      type="button"
                      onClick={() => handleSelectInstitution(inst)}
                      className={`w-full p-2 text-left text-sm border-b border-gray-200 last:border-b-0 hover:bg-gray-50 ${
                        isSelected ? 'bg-green-50' : ''
                      }`}
                    >
                      <div className="font-medium">{inst.name}</div>
                      <div className="text-xs text-gray-500">{inst.address.city}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Skip email verification */}
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded">
            <input
              type="checkbox"
              id="skip_email_verification"
              checked={formData.skip_email_verification}
              onChange={(e) =>
                setFormData({ ...formData, skip_email_verification: e.target.checked })
              }
              className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
            />
            <label htmlFor="skip_email_verification" className="text-sm text-amber-800">
              <span className="font-medium">Ne pas envoyer l&apos;email de vérification</span>
              <br />
              <span className="text-xs text-amber-600">
                Le compte sera directement activé sans vérification par email
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 rounded-none hover:bg-gray-50 transition-colors font-medium text-sm"
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-black text-white rounded-none hover:bg-gray-800 transition-colors font-medium text-sm disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
