'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InstitutionSelector from '@/components/auth/InstitutionSelector';
import { useSecureForm } from '@/hooks/useSecureForm';
import { useUser } from '@/context/UserContext';
import Loader from '@/components/ui/Loader';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import toast from '@/lib/utils/toast';
import PasswordRequirements from '@/components/auth/PasswordRequirements';
import { Eye, EyeOff } from '@deemlol/next-icons';

/**
 * AdminCreateUserClient component
 * Allows admins/superadmins to create new user accounts.
 * Features:
 * - Form validation (password match, length, phone)
 * - Institution selection
 * - Role assignment (SUPERADMIN can create SUPERADMINs)
 * - Secure submission with rate limiting
 */
export default function AdminCreateUserClient() {
  const { user } = useUser();
  const router = useRouter();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    institutionIds: [] as string[],
    role: 'ADMIN',
    skipEmailVerification: false,
  });

  const [institutionError, setInstitutionError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  const {
    handleSubmit: handleSecureSubmit,
    isLoading: secureFormLoading,
    error: secureFormError,
    rateLimitRemaining,
    clearError,
  } = useSecureForm({
    onSubmit: async (sanitizedData) => {
      // local validation
      if (!formData.institutionIds || formData.institutionIds.length === 0) {
        setInstitutionError('Veuillez sélectionner au moins un établissement');
        throw new Error('Veuillez sélectionner au moins un établissement');
      }

      if (formData.password !== formData.confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas');
      }

      if (formData.password.length < 10) {
        throw new Error('Le mot de passe doit contenir au moins 10 caractères');
      }

      if (!formData.phoneNumber) {
        throw new Error('Le numéro de téléphone est obligatoire');
      }

      // send to API
      const res = await fetchWithAuth('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sanitizedData.email,
          password: sanitizedData.password,
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone_number: formData.phoneNumber,
          institution_ids: formData.institutionIds,
          role: formData.role,
          skip_email_verification: formData.skipEmailVerification,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data && data.error) || 'Erreur lors de la création');
      toast('Utilisateur créé', 'success');
      setIsSuccess(true);
      setTimeout(() => router.push('/admin/users'), 1000);
    },
    identifier: formData.email,
  });

  const isFormLoading = secureFormLoading;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target as HTMLInputElement;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (secureFormError) clearError();
  };

  const handleInstitutionSelect = (ids: string[]) => {
    setFormData((prev) => ({ ...prev, institutionIds: ids }));
    setInstitutionError('');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInstitutionError('');
    await handleSecureSubmit({ email: formData.email, password: formData.password });
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto bg-white border border-gray-200 shadow-sm p-4 sm:p-6">
        <h2 className="text-2xl font-poppins font-semibold mb-6">Créer un administrateur</h2>

        {isSuccess ? (
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 sm:px-6 py-3 sm:py-4 font-ibm text-sm sm:text-base md:text-lg">
              Utilisateur créé avec succès.
            </div>
            <Loader />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block mb-1 font-medium text-gray-700 text-sm">Prénom</label>
                <input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium text-gray-700 text-sm">Nom</label>
                <input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block mb-1 font-medium text-gray-700 text-sm">Email</label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium text-gray-700 text-sm">
                  Numéro de téléphone
                </label>
                <input
                  name="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  required
                  className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block mb-1 font-medium text-gray-700 text-sm">Mot de passe</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    onFocus={() => setShowPasswordRequirements(true)}
                    required
                    minLength={10}
                    className="w-full p-2 pr-10 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    disabled={isFormLoading}
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
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    minLength={10}
                    className="w-full p-2 pr-10 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    disabled={isFormLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <InstitutionSelector
              onInstitutionSelect={handleInstitutionSelect}
              error={institutionError}
              allowMultiple={true}
            />

            <div>
              <label className="block mb-1 font-medium text-gray-700 text-sm">Rôle</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="USER">UTILISATEUR</option>
                <option value="ADMIN">ADMIN</option>
                {/* Only allow SUPERADMIN option if current user is SUPERADMIN */}
                {user && user.role === 'SUPERADMIN' && (
                  <option value="SUPERADMIN">SUPERADMIN</option>
                )}
              </select>
            </div>

            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded">
              <input
                type="checkbox"
                id="skipEmailVerification"
                name="skipEmailVerification"
                checked={formData.skipEmailVerification}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, skipEmailVerification: e.target.checked }))
                }
                className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
              />
              <label htmlFor="skipEmailVerification" className="text-sm text-amber-800">
                <span className="font-medium">Ne pas envoyer l&apos;email de vérification</span>
                <br />
                <span className="text-xs text-amber-600">
                  Le compte sera directement activé sans vérification par email
                </span>
              </label>
            </div>

            {secureFormError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 sm:px-6 py-3 sm:py-4 font-ibm text-sm sm:text-base md:text-lg">
                {secureFormError}
                {rateLimitRemaining > 0 && (
                  <div className="mt-2 text-xs sm:text-sm">
                    Réessayez dans {Math.ceil(rateLimitRemaining / 60000)} minute(s).
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-5 py-2.5 border border-gray-300 rounded-none hover:bg-gray-50 transition-colors font-medium text-sm"
                disabled={isFormLoading}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-black text-white rounded-none hover:bg-gray-800 transition-colors font-medium text-sm disabled:opacity-50"
                disabled={isFormLoading}
              >
                {isFormLoading ? (
                  <>
                    <Loader /> Création...
                  </>
                ) : (
                  'Créer'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
