import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Style Guide - Opéra de Montpellier',
  description:
    "Guide des styles et composants réutilisables pour l'application de gestion des inscriptions aux événements de l'Opéra de Montpellier",
};

export default function StyleGuideLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
