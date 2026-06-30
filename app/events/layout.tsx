import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Événements - Opéra de Montpellier',
  description: "Découvrez les événements à venir de l'Opéra de Montpellier",
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
