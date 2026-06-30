import GuestRoute from '@/components/guards/GuestRoute';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexion - Opéra de Montpellier',
  description: 'Connectez-vous à votre compte pour accéder à la plateforme',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <GuestRoute>{children}</GuestRoute>;
}
