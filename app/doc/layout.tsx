import ProtectedRoute from '@/components/guards/ProtectedRoute';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation API - Opéra de Montpellier',
  description: "Découvrez la documentation de l'API de l'Opéra de Montpellier",
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requireAdmin>{children}</ProtectedRoute>;
}
