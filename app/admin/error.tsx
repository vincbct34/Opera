'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/middleware/logger';
import { AlertTriangle, House, RotateCcw, Sliders } from '@deemlol/next-icons';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log admin error
    logger.error('Admin error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center">
            <AlertTriangle className="text-white" size={40} />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-poppins font-bold mb-4">
          Erreur dans l&apos;espace administrateur
        </h1>

        {/* Description */}
        <p className="text-xl font-ibm text-gray-700 mb-8">
          Une erreur s&apos;est produite lors de l&apos;accès aux fonctionnalités administratives.
          Cette erreur a été signalée à notre équipe technique.
        </p>

        {/* Error details (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-red-50 border-2 border-red-300 rounded p-4 mb-8 text-left">
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
            onClick={() => router.push('/admin')}
            className="bg-white text-black border-2 border-black px-8 py-4 font-poppins font-semibold text-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Sliders size={20} />
            Dashboard
          </button>

          <button
            onClick={() => router.push('/')}
            className="bg-white text-black border-2 border-black px-8 py-4 font-poppins font-semibold text-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <House size={20} />
            Accueil
          </button>
        </div>

        {/* Security note */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded p-4 mt-8">
          <p className="font-ibm text-sm text-gray-700">
            <strong>Note de sécurité :</strong> Si vous n&apos;avez pas les permissions nécessaires
            pour accéder à cette page, veuillez contacter le super administrateur.
          </p>
        </div>
      </div>
    </div>
  );
}
