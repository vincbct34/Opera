'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { CheckCircle, XCircle, LogIn, UserPlus } from '@deemlol/next-icons';
import { logger } from '@/lib/middleware/logger';
import Loader from '@/components/ui/Loader';
import toast from '@/lib/utils/toast';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const error = searchParams.get('error');
    const success = searchParams.get('success');
    const token = searchParams.get('token');

    if (success === 'true') {
      const successMessage = 'Votre compte a été activé avec succès !';
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('success');
      setMessage(successMessage);
      try {
        toast(successMessage, 'success');
      } catch {}
    } else if (error) {
      let computedMessage = '';
      switch (error) {
        case 'missing_token':
          computedMessage = 'Lien de vérification invalide - token manquant.';
          break;
        case 'invalid_token':
          computedMessage = 'Lien de vérification invalide ou déjà utilisé.';
          break;
        case 'expired_token':
          computedMessage = 'Le lien de vérification a expiré. Veuillez demander un nouveau lien.';
          break;
        case 'server_error':
          computedMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
          break;
        default:
          computedMessage = 'Une erreur est survenue lors de la vérification.';
      }
      setStatus('error');
      setMessage(computedMessage);
      try {
        toast(computedMessage || 'Erreur lors de la vérification', 'error');
      } catch {}
    } else if (token) {
      // Call API to verify the token - declare function first to avoid accessing before declaration
      const verify = async (verifyToken: string) => {
        try {
          setStatus('loading');
          setMessage('Vérification de votre email en cours...');

          const response = await fetch('/api/auth/verify-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: verifyToken }),
          });

          const data = await response.json();

          if (response.ok) {
            setStatus('success');
            setMessage('Votre compte a été activé avec succès !');
            try {
              toast('Votre compte a été activé avec succès !', 'success');
            } catch {}
          } else {
            setStatus('error');
            setMessage(data.error || 'Une erreur est survenue lors de la vérification.');
            try {
              toast(data.error || 'Une erreur est survenue lors de la vérification.', 'error');
            } catch {}
          }
        } catch (err) {
          logger.error('Erreur lors de la vérification:', err);
          setStatus('error');
          setMessage('Erreur de connexion. Veuillez réessayer.');
        }
      };
      verify(token);
    } else {
      setStatus('error');
      setMessage('Aucun token de vérification fourni.');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-white">
      {/* Main Content */}
      <div className="flex flex-col justify-center max-w-2xl mx-auto min-h-[calc(100vh-88px)] px-4 sm:px-8 py-12 sm:py-16">
        <div className="w-full">
          {/* Title Section */}
          <div className="mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-poppins text-center mb-6 sm:mb-8 leading-tight">
              <span className="font-bold border-b-4 border-black">Vérification d&apos;email</span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl font-ibm text-center leading-relaxed">
              Activation de votre compte en cours...
            </p>
          </div>

          {/* Content based on status */}
          {status === 'loading' && (
            <div className="text-center space-y-6 sm:space-y-8">
              <Loader />
              <p className="text-lg sm:text-xl md:text-2xl font-ibm text-gray-600">{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-8 sm:space-y-12">
              <div className="flex justify-center">
                <CheckCircle className="h-20 w-20 sm:h-24 sm:w-24 md:h-32 md:w-32 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-bold text-green-800 mb-4 sm:mb-6">
                  Compte activé !
                </h2>
                <p className="text-lg sm:text-xl md:text-2xl font-ibm text-gray-700 mb-8 sm:mb-12">
                  {message}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center">
                <Link
                  href="/auth/login"
                  className="bg-black text-white px-8 sm:px-12 py-4 sm:py-6 font-poppins font-semibold text-base sm:text-lg md:text-xl cursor-pointer flex items-center justify-center gap-3 min-w-full sm:min-w-[200px]"
                >
                  <LogIn size={20} className="sm:w-6 sm:h-6" />
                  Se connecter
                </Link>
                <Link
                  href="/"
                  className="bg-white text-black border-2 border-gray-300 px-8 sm:px-12 py-4 sm:py-6 font-poppins font-semibold text-base sm:text-lg md:text-xl cursor-pointer flex items-center justify-center gap-3 hover:bg-gray-50 min-w-full sm:min-w-[200px]"
                >
                  ← Retour à l&apos;accueil
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-8 sm:space-y-12">
              <div className="flex justify-center">
                <XCircle className="h-20 w-20 sm:h-24 sm:w-24 md:h-32 md:w-32 text-red-600" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-bold text-red-800 mb-4 sm:mb-6">
                  Erreur de vérification
                </h2>
                <p className="text-lg sm:text-xl md:text-2xl font-ibm text-gray-700 mb-8 sm:mb-12">
                  {message}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center">
                <Link
                  href="/auth/register"
                  className="bg-black text-white px-8 sm:px-12 py-4 sm:py-6 font-poppins font-semibold text-base sm:text-lg md:text-xl cursor-pointer flex items-center justify-center gap-3 min-w-full sm:min-w-[200px]"
                >
                  <UserPlus size={20} className="sm:w-6 sm:h-6" />
                  Créer un nouveau compte
                </Link>
                <Link
                  href="/auth/login"
                  className="bg-white text-black border-2 border-gray-300 px-8 sm:px-12 py-4 sm:py-6 font-poppins font-semibold text-base sm:text-lg md:text-xl cursor-pointer flex items-center justify-center gap-3 hover:bg-gray-50 min-w-full sm:min-w-[200px]"
                >
                  <LogIn size={20} className="sm:w-6 sm:h-6" />
                  Se connecter
                </Link>
                <Link
                  href="/"
                  className="bg-white text-black border-2 border-gray-300 px-8 sm:px-12 py-4 sm:py-6 font-poppins font-semibold text-base sm:text-lg md:text-xl cursor-pointer flex items-center justify-center gap-3 hover:bg-gray-50 min-w-full sm:min-w-[200px]"
                >
                  ← Retour à l&apos;accueil
                </Link>
              </div>
            </div>
          )}

          {/* Support Link */}
          <div className="mt-12 sm:mt-16 text-center">
            <p className="text-base sm:text-lg md:text-xl font-ibm text-gray-600">
              Problème avec votre compte ?{' '}
              <a
                href="mailto:support@opera-platform.com"
                className="font-poppins font-semibold text-black hover:underline"
              >
                Contactez le support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Loader />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
