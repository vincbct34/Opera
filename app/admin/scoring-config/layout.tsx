import ProtectedRoute from '@/components/guards/ProtectedRoute';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Configuration Admin - Opéra de Montpellier',
  description: 'Administration des configurations de scoring',
};

export default function ConfigurationLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requireAdmin>{children}</ProtectedRoute>;
}
