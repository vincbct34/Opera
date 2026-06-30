'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from '@deemlol/next-icons';
import Loader from '@/components/ui/Loader';
import toast from '@/lib/utils/toast';

export default function RequestResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      const msg = data.message || data.error || 'Erreur';
      setMessage(msg);
      try {
        toast(msg, res.ok ? 'success' : 'error');
      } catch {}
    } catch {
      const msg = 'Une erreur est survenue. Veuillez réessayer.';
      setMessage(msg);
      try {
        toast(msg, 'error');
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col justify-center max-w-2xl mx-auto min-h-[calc(100vh-88px)] px-4 sm:px-8 py-12 sm:py-16">
        <div className="w-full">
          <div className="mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-poppins text-center mb-6 sm:mb-8 leading-tight">
              <span className="font-bold border-b-4 border-black">
                Réinitialiser le mot de passe
              </span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl font-ibm text-center leading-relaxed">
              Entrez votre adresse email pour recevoir un lien de réinitialisation.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
            {message && (
              <div
                className={`px-4 sm:px-6 py-3 sm:py-4 font-ibm text-sm sm:text-base md:text-lg border ${message.toLowerCase().includes('envoyé') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}
              >
                {message}
              </div>
            )}
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 border border-gray-300 font-ibm text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="votre@email.com"
                  disabled={loading}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white px-8 sm:px-12 py-4 sm:py-6 font-poppins font-semibold text-base sm:text-lg md:text-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader />
                  Envoi en cours...
                </>
              ) : (
                <>Envoyer le lien de réinitialisation</>
              )}
            </button>
          </form>
          <div className="mt-8 sm:mt-12 text-center">
            <p className="text-base sm:text-lg md:text-xl font-ibm text-gray-600">
              Retour à la{' '}
              <Link
                href="/auth/login"
                className="font-poppins font-semibold text-black hover:underline"
              >
                connexion
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
