'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import InstitutionSelector from '@/components/auth/InstitutionSelector';

import { UserPlus, Mail, Lock, User, Eye, EyeOff } from '@deemlol/next-icons';
import { useAuth } from '@/hooks/useAuth';
import { useSecureForm } from '@/hooks/useSecureForm';
import Loader from '@/components/ui/Loader';
import PasswordRequirements from '@/components/auth/PasswordRequirements';
import toast from '@/lib/utils/toast';

function RegisterForm() {
  const { register, isLoading: authLoading } = useAuth(); // Use the useAuth hook
  const router = useRouter();

  // State to manage form data and error states
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    institutionIds: [] as string[], // Changed to array for multiple institutions
  });

  const [institutionError, setInstitutionError] = useState(''); // State to manage institution selection errors
  const [isSuccess, setIsSuccess] = useState(false); // State to manage success message
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); // State for confirm password visibility
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false); // Show requirements when user focuses password field

  // Use secure form hook for validation and rate limiting
  const {
    handleSubmit: handleSecureSubmit,
    isLoading: secureFormLoading,
    error: secureFormError,
    rateLimitRemaining,
    clearError,
  } = useSecureForm({
    onSubmit: async (sanitizedData) => {
      // Validate institution selection
      if (!formData.institutionIds || formData.institutionIds.length === 0) {
        setInstitutionError('Veuillez sélectionner au moins un établissement');
        throw new Error('Veuillez sélectionner au moins un établissement');
      }

      // Validate that passwords match
      if (formData.password !== formData.confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas');
      }

      // Validate password length (useSecureForm already validates 10-128, but we can add custom validation)
      if (formData.password.length < 10) {
        throw new Error('Le mot de passe doit contenir au moins 10 caractères');
      }

      // Validate phone number
      if (!formData.phoneNumber) {
        throw new Error('Le numéro de téléphone est obligatoire');
      }

      const result = await register({
        email: sanitizedData.email,
        password: sanitizedData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phoneNumber,
        institution_ids: formData.institutionIds, // Changed to array
      });

      if (result.success) {
        // Show success message and redirect to login
        setIsSuccess(true);
        toast('Inscription réussie !', 'success');
        setTimeout(() => {
          router.push('/auth/login?message=registration-success');
        }, 2000);
      } else {
        // Show a toast and throw error to be caught by useSecureForm
        const errMsg = result.error || "Une erreur s'est produite";
        toast(errMsg, 'error');
        throw new Error(errMsg);
      }
    },
    identifier: formData.email, // Use email for rate limiting
  });

  const isLoading = authLoading || secureFormLoading;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target; // Destructure name and value from the input change event
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (secureFormError) {
      clearError();
    }
  };

  const handleInstitutionSelect = (institutionIds: string[]) => {
    setFormData((prev) => ({
      ...prev,
      institutionIds,
    }));
    setInstitutionError('');
  };

  // Function to handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission behavior
    setInstitutionError(''); // Clear institution error

    await handleSecureSubmit({
      email: formData.email,
      password: formData.password,
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}

      <div className="flex flex-col justify-center max-w-4xl mx-auto min-h-[calc(100vh-88px)] px-4 sm:px-8 py-12 sm:py-16">
        <div className="w-full">
          {/* Title Section */}

          <div className="mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-poppins text-center mb-6 sm:mb-8 leading-tight">
              <span className="font-bold border-b-4 border-black">Inscription</span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl font-ibm text-center leading-relaxed px-2">
              Créez votre compte pour accéder à votre espace personnel.
            </p>
          </div>

          {/* Registration Form */}

          {isSuccess ? (
            <div className="flex flex-col justify-center items-center text-center space-y-6 sm:space-y-8">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 sm:px-6 md:px-8 py-4 sm:py-6 font-ibm text-base sm:text-lg md:text-xl max-w-2xl">
                <div className="font-semibold mb-2 sm:mb-3">Inscription réussie !</div>
                <div>
                  Votre compte a été créé avec succès. Vous allez être redirigé vers la page de
                  connexion...
                </div>
              </div>
              <Loader />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 max-w-3xl mx-auto">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-base sm:text-lg font-poppins font-semibold mb-2 sm:mb-3"
                  >
                    Prénom
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                    </div>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={handleChange}
                      className="block w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 border border-gray-300 font-ibm text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                      placeholder="Prénom"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-base sm:text-lg font-poppins font-semibold mb-2 sm:mb-3"
                  >
                    Nom
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                    </div>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={handleChange}
                      className="block w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 border border-gray-300 font-ibm text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                      placeholder="Nom"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-base sm:text-lg font-poppins font-semibold mb-2 sm:mb-3"
                  >
                    Adresse email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="block w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 border border-gray-300 font-ibm text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                      placeholder="votre@email.com"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="phoneNumber"
                    className="block text-base sm:text-lg font-poppins font-semibold mb-2 sm:mb-3"
                  >
                    Numéro de téléphone
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                    </div>
                    <input
                      id="phoneNumber"
                      name="phoneNumber"
                      type="tel"
                      required
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      className="block w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 border border-gray-300 font-ibm text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                      placeholder="01 23 45 67 89"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-base sm:text-lg font-poppins font-semibold mb-2 sm:mb-3"
                  >
                    Mot de passe
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      onFocus={() => setShowPasswordRequirements(true)}
                      className="block w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 border border-gray-300 font-ibm text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                      placeholder="••••••••"
                      disabled={isLoading}
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                  <PasswordRequirements
                    password={formData.password}
                    showRequirements={showPasswordRequirements}
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-base sm:text-lg font-poppins font-semibold mb-2 sm:mb-3"
                  >
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="block w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 border border-gray-300 font-ibm text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                      placeholder="••••••••"
                      disabled={isLoading}
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center"
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 hover:text-gray-600" />
                      ) : (
                        <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Institution Selection */}
              <InstitutionSelector
                onInstitutionSelect={handleInstitutionSelect}
                error={institutionError}
                allowMultiple={true}
              />

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-black text-white px-8 sm:px-12 py-4 sm:py-6 font-poppins font-semibold text-base sm:text-lg md:text-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isLoading ? (
                  <>
                    <Loader />
                    <span className="hidden sm:inline">Inscription en cours...</span>
                    <span className="sm:hidden">Inscription...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={20} className="sm:w-6 sm:h-6" />
                    Créer un compte
                  </>
                )}
              </button>
            </form>
          )}

          {/* Additional Links */}

          <div className="mt-8 sm:mt-12 text-center">
            <p className="text-base sm:text-lg md:text-xl font-ibm text-gray-600">
              Déjà un compte ?{' '}
              <Link
                href="/auth/login"
                className="font-poppins font-semibold text-black hover:underline"
              >
                Se connecter
              </Link>
            </p>
            <p className="mt-3 text-sm sm:text-base font-ibm text-gray-600">
              Pour plus d&apos;informations sur la confidentialité des données, consultez nos{' '}
              <Link
                href="/legal-notices#data-protection"
                className="font-poppins font-semibold text-black hover:underline"
              >
                mentions légales
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<Loader />}>
      <RegisterForm />
    </Suspense>
  );
}
