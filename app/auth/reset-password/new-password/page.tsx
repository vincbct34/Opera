'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Loader from '@/components/ui/Loader';
import Link from 'next/link';
import { Lock, Eye, EyeOff } from '@deemlol/next-icons';
import PasswordRequirements from '@/components/auth/PasswordRequirements';
import toast from '@/lib/utils/toast';

function NewPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!token) {
      setMessage('Lien invalide.');
      return;
    }
    if (password !== confirm) {
      setMessage('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    const res = await fetch('/api/auth/reset-password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setMessage('Mot de passe réinitialisé. Redirection...');
      try {
        toast('Mot de passe réinitialisé.', 'success');
      } catch {}
      setTimeout(() => router.push('/auth/login'), 2000);
    } else {
      const msg = data.error || 'Erreur.';
      setMessage(msg);
      try {
        toast(msg, 'error');
      } catch {}
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex flex-col justify-center max-w-2xl mx-auto min-h-[calc(100vh-88px)] px-4 sm:px-8 py-12 sm:py-16">
        <div className="w-full">
          <div className="mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-poppins text-center mb-6 sm:mb-8 leading-tight">
              <span className="font-bold border-b-4 border-black">Nouveau mot de passe</span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl font-ibm text-center leading-relaxed">
              Choisissez un nouveau mot de passe pour accéder à votre compte.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
            {message && (
              <div
                className={`px-4 sm:px-6 py-3 sm:py-4 font-ibm text-sm sm:text-base md:text-lg border ${message.toLowerCase().includes('réinitialisé') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}
              >
                {message}
              </div>
            )}
            <div>
              <label
                htmlFor="password"
                className="block text-base sm:text-lg font-poppins font-semibold mb-2 sm:mb-3"
              >
                Nouveau mot de passe
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setShowPasswordRequirements(true)}
                  className="block w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 border border-gray-300 font-ibm text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="Nouveau mot de passe"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              <PasswordRequirements
                password={password}
                showRequirements={showPasswordRequirements}
              />
            </div>
            <div>
              <label
                htmlFor="confirm"
                className="block text-base sm:text-lg font-poppins font-semibold mb-2 sm:mb-3"
              >
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                </div>
                <input
                  id="confirm"
                  name="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="block w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 border border-gray-300 font-ibm text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                  placeholder="Confirmer le mot de passe"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center"
                  disabled={loading}
                >
                  {showConfirm ? (
                    <EyeOff className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
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
                  Réinitialisation...
                </>
              ) : (
                <>Réinitialiser</>
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

export default function NewPasswordPageWithSuspense() {
  return (
    <Suspense fallback={<Loader />}>
      <NewPasswordPage />
    </Suspense>
  );
}
