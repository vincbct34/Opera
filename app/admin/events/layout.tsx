import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gestion des événements - Opéra de Montpellier',
  description: 'Gérez les événements de la plateforme.',
};

export default function InstitutionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
