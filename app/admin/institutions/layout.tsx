import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Établissements - Opéra de Montpellier',
  description: 'Gérez les établissements de la plateforme.',
};

export default function InstitutionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
