'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

import { Calendar, User } from '@deemlol/next-icons';

import Hero404 from '@/assets/hero.jpg';

export default function NotFoundPageClient() {
  const router = useRouter();

  return (
    <div>
      {/* Header Section */}

      <div className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h2 className="text-center font-bold text-3xl font-poppins tracking-wide">
            Opéra de Montpellier
          </h2>
        </div>
      </div>

      {/* Main Content */}

      <div className="flex flex-col lg:flex-row max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
        {/* Left Content */}

        <div className="flex-1 flex flex-col justify-center px-8 py-16 lg:py-24">
          <div className="max-w-2xl mx-auto lg:mx-0">
            {/* Error Code */}

            <div className="text-center lg:text-left mb-6">
              <span className="text-6xl lg:text-8xl font-poppins font-bold text-gray-300">404</span>
            </div>

            {/* Main Title */}

            <h1 className="text-4xl lg:text-5xl font-poppins text-center lg:text-left mb-8 leading-tight">
              Page <span className="font-bold border-b-4 border-black">introuvable</span>
            </h1>

            {/* Subtitle */}

            <p className="text-xl font-ibm text-center lg:text-left mb-12 leading-relaxed">
              La page que vous recherchez n&apos;existe pas ou a été déplacée. Retournez à
              l&apos;accueil pour découvrir notre programmation.
            </p>

            {/* CTA Section */}

            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button
                  className="bg-black text-white px-8 py-4 font-poppins font-semibold text-lg cursor-pointer"
                  onClick={() => router.push('/')}
                >
                  Retour à l&apos;accueil
                </button>
                <button
                  className="border-2 border-black text-black px-8 py-4 font-poppins font-semibold text-lg cursor-pointer"
                  onClick={() => router.push('/events')}
                >
                  Voir les événements
                </button>
              </div>

              {/* Help Options */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12">
                <div className="text-center lg:text-left">
                  <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mx-auto lg:mx-0 mb-3">
                    <User className="text-white" size={24} />
                  </div>
                  <h3 className="font-poppins font-semibold text-lg mb-2">Page d&apos;accueil</h3>
                  <p className="font-ibm">Retournez à la page principale</p>
                </div>
                <div className="text-center lg:text-left">
                  <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mx-auto lg:mx-0 mb-3">
                    <Calendar className="text-white" size={24} />
                  </div>
                  <h3 className="font-poppins font-semibold text-lg mb-2">Événements</h3>
                  <p className="font-ibm">Explorez nos événements et spectacles</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Image */}

        <div className="flex-1 relative">
          <div className="relative h-64 lg:h-full min-h-96">
            <Image
              src={Hero404}
              alt="Opéra de Montpellier - Salle de spectacle"
              className="object-cover w-full h-full grayscale"
              fill
              priority
            />

            {/* Decorative element */}

            <div className="absolute bottom-8 left-8 right-8">
              <div className="bg-black bg-opacity-80 p-6 backdrop-blur-sm">
                <p className="font-ibm text-white text-center italic text-2xl">
                  Ici ce qui nous unit se fait entendre.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
