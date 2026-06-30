import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Utilisateurs - Opéra de Montpellier',
  description: 'Gérez les utilisateurs de la plateforme.',
};

export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
