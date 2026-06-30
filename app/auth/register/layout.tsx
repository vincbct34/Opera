import GuestRoute from '@/components/guards/GuestRoute';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inscription - Opéra de Montpellier',
  description: 'Créez votre compte pour accéder à la plateforme',
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <GuestRoute>{children}</GuestRoute>;
}
