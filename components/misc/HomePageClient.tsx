'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { UserPlus, Save } from '@deemlol/next-icons';

import Hero from '@/assets/hero.jpg';
import { useUser } from '@/context/UserContext';
import Loader from '@/components/ui/Loader';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

export default function HomePageClient() {
  const { user, loading } = useUser();
  const router = useRouter();

  return (
    <main>
      {/* Header Section */}

      <div className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h2 className="text-center font-bold text-3xl font-poppins tracking-wide">
            Opéra Orchestre National Montpellier Occitanie
          </h2>
        </div>
      </div>

      {/* Main Content */}

      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
        {/* Left Content */}

        <div className="flex-1 flex flex-col justify-center px-8 py-16 lg:py-24">
          <div className="max-w-2xl mx-auto lg:mx-0">
            {/* Main Title */}

            <h1 className="text-4xl lg:text-5xl font-poppins text-center lg:text-left mb-8 leading-tight">
              Demandes d&apos;inscription{' '}
              <span className="font-bold border-b-4 border-black">associatives</span> et{' '}
              <span className="font-bold border-b-4 border-black">scolaires</span>
            </h1>

            {/* Subtitle */}

            <p className="text-xl font-ibm text-center lg:text-left mb-12 leading-relaxed">
              Déposez vos demandes d&apos;inscription et suivez leur traitement en toute simplicité.
              Participez à une programmation culturelle exceptionnelle proposée par l&apos;Opéra
              Orchestre national de Montpellier.
            </p>
            {/* CTA Section */}

            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                {!user?.role.includes('ADMIN') ? (
                  <button
                    className="bg-black text-white px-8 py-4 font-poppins font-semibold text-lg cursor-pointer"
                    onClick={() => router.push('/events')}
                  >
                    Voir les événements
                  </button>
                ) : (
                  <button
                    className="bg-black text-white px-8 py-4 font-poppins font-semibold text-lg cursor-pointer"
                    onClick={() => router.push('/admin')}
                  >
                    Voir le dashboard
                  </button>
                )}

                {!loading ? (
                  user ? (
                    <button
                      className="bg-white text-black border-2 border-black px-8 py-4 font-poppins font-semibold text-lg cursor-pointer"
                      onClick={() => router.push('/account')}
                    >
                      Accéder à vos informations
                    </button>
                  ) : (
                    <button
                      className="bg-white text-black border-2 border-black px-8 py-4 font-poppins font-semibold text-lg cursor-pointer"
                      onClick={() => router.push('/auth/login')}
                    >
                      Se connecter
                    </button>
                  )
                ) : (
                  <div className="flex justify-center items-center">
                    <Loader />
                  </div>
                )}
              </div>

              {/* Features */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12">
                <div className="text-center lg:text-left">
                  <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mx-auto lg:mx-0 mb-3">
                    <UserPlus className="text-white" size={24} />
                  </div>
                  <h3 className="font-poppins font-semibold text-lg mb-2">
                    Demandes d&apos;inscription simplifiées
                  </h3>
                  <p className="font-ibm">
                    Système de demandes d&apos;inscription intuitif et rapide
                  </p>
                </div>
                <div className="text-center lg:text-left">
                  <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mx-auto lg:mx-0 mb-3">
                    <Save className="text-white" size={24} />
                  </div>
                  <h3 className="font-poppins font-semibold text-lg mb-2">Création de compte</h3>
                  <p className="font-ibm">Sauvegardez les informations de votre établissement</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Image */}

        <div className="flex-1 relative">
          <div className="relative h-64 lg:h-full min-h-96">
            <Image
              src={Hero}
              alt="Opéra de Montpellier - Salle de spectacle"
              className="object-cover w-full h-full"
              fill
              priority
            />

            {/* Decorative element */}

            <div className="absolute bottom-8 left-8 right-8">
              <div className="bg-opacity-95 p-6 backdrop-blur-sm">
                <p className="font-ibm text-white text-center italic text-2xl">
                  Ici ce qui nous unit se fait entendre.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help Widget */}
      <HelpWidget content={HELP_CONTENTS.home} />
    </main>
  );
}
