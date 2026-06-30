import ImportExistingClient from '@/components/admin/misc/ImportExistingClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Import d'inscriptions - Admin",
  description: 'Importer les inscriptions existantes depuis un fichier Excel',
};

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ImportExistingPage() {
  return <ImportExistingClient />;
}
