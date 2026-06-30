'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/middleware/logger';
import { AlertTriangle, House, RotateCcw } from '@deemlol/next-icons';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log error
    logger.error('Error caught by error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center">
            <AlertTriangle className="text-white" size={40} />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-poppins font-bold mb-4">Une erreur s&apos;est produite</h1>

        {/* Description */}
        <p className="text-xl font-ibm text-gray-700 mb-8">
          Nous sommes désolés, quelque chose s&apos;est mal passé. Notre équipe a été notifiée et
          nous travaillons sur une solution.
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
            onClick={() => router.push('/')}
            className="bg-white text-black border-2 border-black px-8 py-4 font-poppins font-semibold text-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <House size={20} />
            Retour à l&apos;accueil
          </button>
        </div>

        {/* Support link */}
        <p className="font-ibm text-gray-600 mt-8">
          Si le problème persiste, veuillez nous contacter.
        </p>
      </div>
    </div>
  );
}
