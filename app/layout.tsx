import { Poppins, IBM_Plex_Serif } from 'next/font/google';
import type { Metadata } from 'next';

import { UserProvider } from '@/context/UserContext';
import { NotificationProvider } from '@/context/NotificationContext';

import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ToastContainer from '@/components/ui/Toast';

import './globals.css';

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const ibmPlexSerif = IBM_Plex_Serif({
  variable: '--font-ibm-plex-serif',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const isNoIndexEnabled = process.env.SITE_NOINDEX === 'true';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ),
  title: "Demandes d'inscription – Opéra Orchestre national Montpellier Occitanie",
  description: "Plateforme de gestion des inscriptions aux événements de l'Opéra de Montpellier",
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },

  robots: {
    index: !isNoIndexEnabled,
    follow: true,
    googleBot: {
      index: !isNoIndexEnabled,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${poppins.variable} ${ibmPlexSerif.variable} antialiased flex flex-col min-h-screen`}
        suppressHydrationWarning
      >
        <UserProvider>
          <NotificationProvider>
            <Navbar />
            <div className="flex flex-1">
              <Sidebar />
              <main className="flex-1 min-w-0 overflow-auto">{children}</main>
            </div>
            <Footer />
            <ToastContainer />
          </NotificationProvider>
        </UserProvider>
      </body>
    </html>
  );
}
