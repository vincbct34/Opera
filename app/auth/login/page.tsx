'use client';

import { useState, useEffect, Suspense, startTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { LogIn, Mail, Lock, Eye, EyeOff } from '@deemlol/next-icons';
import { useAuth } from '@/hooks/useAuth';
import { useSecureForm } from '@/hooks/useSecureForm';
import { logger } from '@/lib/middleware/logger';
import Loader from '@/components/ui/Loader';
import ResendVerification from '@/components/auth/ResendVerification';
import toast from '@/lib/utils/toast';

function LoginForm() {
  const { login, isLoading: authLoading } = useAuth(); // Use the useAuth hook
  const searchParams = useSearchParams();

  // State to manage form data and error states
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [successMessage, setSuccessMessage] = useState(''); // State to manage success messages
  const [emailNotVerified, setEmailNotVerified] = useState<string | null>(null); // State for unverified email
  const [showPassword, setShowPassword] = useState(false); // State for password visibility

  // Use secure form hook for validation and rate limiting
  const {
    handleSubmit: handleSecureSubmit,
    isLoading: secureFormLoading,
    error: secureFormError,
    rateLimitRemaining,
    clearError,
  } = useSecureForm({
    onSubmit: async (sanitizedData) => {
      const result = await login(sanitizedData);

      if (result.success) {
        // The GuestRoute component will handle redirection automatically
        // when the user context is updated
        try {
          toast('Connexion réussie', 'success');
        } catch {}
      } else {
        // Check if error is due to unverified email
        if (result.code === 'EMAIL_NOT_VERIFIED' && result.email) {
          setEmailNotVerified(result.email);
        } else {
          const errMsg = result.error || "Une erreur s'est produite";
          toast(errMsg, 'error');
          // Throw error to be caught by useSecureForm
          throw new Error(errMsg);
        }
      }
    },
    identifier: formData.email, // Use email for rate limiting
  });

  const isLoading = authLoading || secureFormLoading;

  // Check for success message from registration
  useEffect(() => {
    const message = searchParams.get('message');
    if (message === 'registration-success') {
      const msg =
        'Inscription réussie ! Pensez à vérifier votre adresse email avant de vous connecter. Si vous ne voyez pas l’email, vérifiez votre dossier de spam.';
      // Only run once on mount to avoid cascading renders
      startTransition(() => setSuccessMessage(msg));
      try {
        toast(msg, 'success');
      } catch (e) {
        logger.error('Toast error:', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (emailNotVerified) {
      setEmailNotVerified(null);
    }
  };

  // Function to handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission behavior
    setEmailNotVerified(null); // Clear email verification state

    await handleSecureSubmit(formData);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}

      <div className="flex flex-col justify-center max-w-2xl mx-auto min-h-[calc(100vh-88px)] px-4 sm:px-8 py-12 sm:py-16">
        <div className="w-full">
          {/* Title Section */}

          <div className="mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-poppins text-center mb-6 sm:mb-8 leading-tight">
              <span className="font-bold border-b-4 border-black">Connexion</span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl font-ibm text-center leading-relaxed px-2">
              Accédez à votre espace personnel pour gérer vos demandes d&apos;inscription.
            </p>
          </div>

          {/* Login Form */}

          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 sm:px-6 py-3 sm:py-4 font-ibm text-sm sm:text-base md:text-lg">
                {successMessage}
              </div>
            )}

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

            {emailNotVerified && <ResendVerification email={emailNotVerified} />}

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
                  className="block w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 border border-gray-300 font-ibm text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="••••••••"
                  disabled={isLoading}
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
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black text-white px-8 sm:px-12 py-4 sm:py-6 font-poppins font-semibold text-base sm:text-lg md:text-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <Loader />
                  <span className="hidden sm:inline">Connexion en cours...</span>
                  <span className="sm:hidden">Connexion...</span>
                </>
              ) : (
                <>
                  <LogIn size={20} className="sm:w-6 sm:h-6" />
                  Se connecter
                </>
              )}
            </button>
          </form>

          {/* Additional Links */}

          <div className="mt-8 sm:mt-12 text-center">
            <p className="text-base sm:text-lg md:text-xl font-ibm text-gray-600">
              Pas encore de compte ?{' '}
              <Link
                href="/auth/register"
                className="font-poppins font-semibold text-black hover:underline"
              >
                Créer un compte
              </Link>
            </p>

            <div className="mt-4 sm:mt-6 text-center">
              <Link
                href="/auth/reset-password"
                className="font-poppins font-semibold text-black hover:underline text-sm sm:text-base"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Loader />}>
      <LoginForm />
    </Suspense>
  );
}
