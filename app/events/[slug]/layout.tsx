import type { Metadata } from 'next';
import ProtectedRoute from '@/components/guards/ProtectedRoute';

export const metadata: Metadata = {
  title: "Détails de l'événement - Opéra de Montpellier",
  description: "Page de détails pour un événement de l'Opéra de Montpellier",
};

export default function EventDetailLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requireAuth>{children}</ProtectedRoute>;
}
