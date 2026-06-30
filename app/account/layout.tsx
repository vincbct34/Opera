import ProtectedRoute from '@/components/guards/ProtectedRoute';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mon compte - Opéra de Montpellier',
  description: 'Gérez vos informations personnelles.',
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
