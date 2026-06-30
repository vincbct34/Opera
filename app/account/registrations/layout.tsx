import ProtectedRoute from '@/components/guards/ProtectedRoute';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vos demandes - Opéra de Montpellier',
  description: 'Gérez vos demandes de réservation.',
};

export default function RegistrationsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
