'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/middleware/logger';
import { UserX, House, RotateCcw, User } from '@deemlol/next-icons';

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log account error
    logger.error('Account error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center">
            <UserX className="text-white" size={40} />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-poppins font-bold mb-4">Erreur de compte utilisateur</h1>

        {/* Description */}
        <p className="text-xl font-ibm text-gray-700 mb-8">
          Nous n&apos;avons pas pu charger vos informations de compte. Veuillez réessayer ou vous
          reconnecter si le problème persiste.
        </p>

        {/* Error details (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-100 border-2 border-gray-300 rounded p-4 mb-8 text-left">
            <p className="font-mono text-sm text-red-600 break-all">{error.message}</p>
            {error.digest && (
              <p className="font-mono text-xs text-gray-500 mt-2">ID: {error.digest}</p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="bg-black text-white px-8 py-4 font-poppins font-semibold text-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw size={20} />
            Réessayer
          </button>

          <button
            onClick={() => router.push('/account')}
            className="bg-white text-black border-2 border-black px-8 py-4 font-poppins font-semibold text-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <User size={20} />
            Mon compte
          </button>

          <button
            onClick={() => router.push('/')}
            className="bg-white text-black border-2 border-black px-8 py-4 font-poppins font-semibold text-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <House size={20} />
            Accueil
          </button>
        </div>

        {/* Security info */}
        <div className="bg-blue-50 border-2 border-blue-300 rounded p-4 mt-8">
          <p className="font-ibm text-sm text-gray-700">
            <strong>Problème de connexion ?</strong> Si vous n&apos;arrivez pas à accéder à votre
            compte, essayez de vous{' '}
            <button
              onClick={() => router.push('/auth/login')}
              className="underline font-semibold hover:text-black transition-colors"
            >
              reconnecter
            </button>
            .
          </p>
        </div>

        {/* Support link */}
        <p className="font-ibm text-gray-600 mt-6">
          Besoin d&apos;aide ?{' '}
          <a
            href="mailto:factory404@outlook.fr"
            className="underline font-semibold hover:text-black transition-colors"
          >
            Contactez notre support
          </a>
          .
        </p>
      </div>
    </div>
  );
}
