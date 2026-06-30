'use client';

import { useState } from 'react';
import { Info, Mail, RotateCw } from '@deemlol/next-icons';
import { logger } from '@/lib/middleware/logger';

interface ResendVerificationProps {
  email: string;
}

/**
 * ResendVerification component
 * UI block to request a new email verification link.
 * Displays information about the previous email sent and allows triggering a resend.
 *
 * @param email - The email address to send the verification to
 */
export default function ResendVerification({ email }: ResendVerificationProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');

  const handleResend = async () => {
    setIsLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setMessageType('success');
      } else {
        setMessage(data.error || "Erreur lors du renvoi de l'email");
        setMessageType('error');
      }
    } catch (error) {
      logger.error('Erreur:', error);
      setMessage('Erreur de connexion. Veuillez réessayer.');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 font-ibm">
      <div className="space-y-3">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-3 shrink-0" />
          <div>
            <p className="font-semibold mb-1">Email de vérification requis</p>
            <p className="text-sm text-justify">
              Un email de vérification a été envoyé à <strong>{email}</strong>. Vérifiez votre boîte
              de réception et cliquez sur le lien pour activer votre compte.
            </p>
            <p className="text-xs mt-2 text-blue-600 text-justify">
              N&apos;oubliez pas de vérifier votre dossier spam/courrier indésirable.
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`px-3 py-2 border font-ibm text-sm ${
              messageType === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {message}
          </div>
        )}

        <button
          onClick={handleResend}
          disabled={isLoading}
          className="bg-black text-white px-4 py-2 font-poppins font-medium text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <RotateCw className="animate-spin h-4 w-4" />
              Envoi en cours...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              Renvoyer l&apos;email
            </>
          )}
        </button>
      </div>
    </div>
  );
}
