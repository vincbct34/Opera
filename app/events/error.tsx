'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/middleware/logger';
import { Calendar, House, RotateCcw, Search } from '@deemlol/next-icons';

export default function EventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log events error
    logger.error('Events error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center">
            <Calendar className="text-white" size={40} />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-poppins font-bold mb-4">
          Impossible de charger les événements
        </h1>

        {/* Description */}
        <p className="text-xl font-ibm text-gray-700 mb-8">
          Nous n&apos;avons pas pu afficher les événements demandés. Il se peut que l&apos;événement
          n&apos;existe plus ou qu&apos;un problème technique soit survenu.
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
            onClick={() => router.push('/events')}
            className="bg-white text-black border-2 border-black px-8 py-4 font-poppins font-semibold text-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Search size={20} />
            Tous les événements
          </button>

          <button
            onClick={() => router.push('/')}
            className="bg-white text-black border-2 border-black px-8 py-4 font-poppins font-semibold text-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <House size={20} />
            Accueil
          </button>
        </div>

        {/* Help text */}
        <p className="font-ibm text-gray-600 mt-8">
          Si vous cherchez un événement spécifique, essayez de retourner à la liste complète des
          événements ou contactez-nous.
        </p>
      </div>
    </div>
  );
}
