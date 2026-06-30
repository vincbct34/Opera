import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Vérification Email - Plateforme de l'Opéra",
  description: "Vérifiez votre adresse email pour activer votre compte Plateforme de l'Opéra",
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
