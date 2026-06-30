import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de Confidentialité - Opéra de Montpellier',
  description:
    "Consultez la politique de confidentialité de l'Opéra de Montpellier concernant la gestion des données personnelles",
};

export default function LegalNoticesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
