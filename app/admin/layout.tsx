import ProtectedRoute from '@/components/guards/ProtectedRoute';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard Admin - Opéra de Montpellier',
  description: 'Administration de la plateforme de gestion des inscriptions',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requireAdmin>{children}</ProtectedRoute>;
}
