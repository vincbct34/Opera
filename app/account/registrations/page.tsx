import RegistrationsClient from '@/components/account/RegistrationsClient';
import {
  getRegistrationStatusLabelsMapAsync,
  getAccessibilityLabelsMapAsync,
} from '@/lib/config/labelMappingsServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RegistrationsPage() {
  // Fetch dynamic labels for display
  const [registrationStatusLabels, accessibilityLabels] = await Promise.all([
    getRegistrationStatusLabelsMapAsync(),
    getAccessibilityLabelsMapAsync(),
  ]);

  return (
    <RegistrationsClient
      registrationStatusLabels={registrationStatusLabels}
      accessibilityLabels={accessibilityLabels}
    />
  );
}
