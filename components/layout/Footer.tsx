'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { Facebook, Instagram, Youtube, Phone, MapPin, Clock } from '@deemlol/next-icons';

import Logo from '@/assets/logo.svg';
import FooterImage from '@/assets/footer.png';
import ContactModal from '@/components/ui/ContactModal';

/**
 * Footer component
 * Displays the site footer with contact info, links, and social media.
 * Features:
 * - Contact information section
 * - Quick navigation links
 * - Social media icons
 * - Contact modal trigger
 * - Copyright and legal notices
 */
export default function Footer() {
  const [contactModalOpen, setContactModalOpen] = useState(false);

  return (
    <footer className="bg-black text-white mt-auto">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Top Row - Contact, Links, Social Media on same line */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 mb-12">
          {/* Contact Information */}
          <div className="space-y-4 flex flex-col items-center">
            <h3 className="text-lg font-poppins font-bold mb-6 border-b-2 border-white pb-2">
              Contact
            </h3>
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-3 text-center md:text-left">
                <MapPin size={20} className="shrink-0 text-gray-300" />
                <div className="text-sm font-ibm text-gray-300">
                  <p className="font-semibold text-white">Service développement culturel</p>
                  <p>Le Corum</p>
                  <p>34967 Montpellier</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center md:items-start gap-3 text-center md:text-left">
                <Clock size={20} className="shrink-0 text-gray-300" />
                <div className="text-sm font-ibm text-gray-300">
                  <p>Du mardi au samedi</p>
                  <p>9h - 12h et 14h - 17h</p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-3">
                <Phone size={20} className="shrink-0 text-gray-300" />
                <button
                  onClick={() => setContactModalOpen(true)}
                  className="text-sm font-ibm text-gray-300 hover:text-white underline decoration-dotted underline-offset-2"
                >
                  Nous contacter
                </button>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4 flex flex-col items-center">
            <h3 className="text-lg font-poppins font-bold mb-6 border-b-2 border-white pb-2">
              Liens utiles
            </h3>
            <nav className="space-y-2 text-center">
              <Link
                href="/events"
                className="block text-sm font-ibm text-gray-300 hover:text-white"
              >
                Événements
              </Link>
              <Link
                href="/legal-notices"
                className="block text-sm font-ibm text-gray-300 hover:text-white"
              >
                Mentions légales
              </Link>
              <Link
                href="/account"
                className="block text-sm font-ibm text-gray-300 hover:text-white"
              >
                Mon compte
              </Link>
              <Link
                href="/auth/register"
                className="block text-sm font-ibm text-gray-300 hover:text-white"
              >
                Inscription
              </Link>
              <a
                href="https://www.opera-orchestre-montpellier.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-ibm text-gray-300 hover:text-white"
              >
                Site de l&apos;Opéra Orchestre national Montpellier Occitanie ↗
              </a>
            </nav>
          </div>

          {/* Social Media */}
          <div className="space-y-4 flex flex-col items-center">
            <h3 className="text-lg font-poppins font-bold mb-6 border-b-2 border-white pb-2">
              Suivez-nous
            </h3>
            <div className="flex gap-4">
              <a
                href="https://www.facebook.com/OperaOrchestreMontpellier"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white"
                aria-label="Facebook"
              >
                <Facebook size={24} />
              </a>
              <a
                href="https://x.com/OONMLR"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white"
                aria-label="Twitter"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  stroke="none"
                >
                  <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/opera_orchestre_montpellier/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white"
                aria-label="Instagram"
              >
                <Instagram size={24} />
              </a>
              <a
                href="https://www.youtube.com/channel/UCoJSVStg3c8Juo2RqW_wEew"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white"
                aria-label="YouTube"
              >
                <Youtube size={24} />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Row - Logo and Footer Image */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 pt-8 border-t border-gray-800">
          <Link href="/" className="inline-block">
            <Image
              src={Logo}
              alt="Opéra Orchestre National Montpellier"
              width={200}
              height={80}
              className="brightness-0 invert w-auto h-auto max-w-[300px]"
            />
          </Link>
          <div className="flex justify-center w-1/3 md:w-1/3">
            <Image
              src={FooterImage}
              alt="Footer decorative image"
              width={600}
              height={200}
              className="h-auto w-full max-w-full md:max-w-2xl object-contain"
            />
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm font-ibm text-gray-400 text-center md:text-left">
              © {new Date().getFullYear()} Opéra Orchestre National Montpellier Occitanie. Tous
              droits réservés.
            </p>
            <div className="flex gap-6">
              <Link
                href="/legal-notices"
                className="text-sm font-ibm text-gray-400 hover:text-white"
              >
                Mentions légales
              </Link>
            </div>
          </div>
        </div>
      </div>

      <ContactModal isOpen={contactModalOpen} onClose={() => setContactModalOpen(false)} />
    </footer>
  );
}
