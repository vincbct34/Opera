import AccountClient from '@/components/account/AccountClient';
import {
  getPublicCategoryLabelsMapAsync,
  getAccessibilityLabelsMapAsync,
  getRegistrationStatusLabelsMapAsync,
} from '@/lib/config/labelMappingsServer';

export default async function AccountPage() {
  // Fetch dynamic labels for display
  const [publicCategoryLabels, accessibilityLabels, registrationStatusLabels] = await Promise.all([
    getPublicCategoryLabelsMapAsync(),
    getAccessibilityLabelsMapAsync(),
    getRegistrationStatusLabelsMapAsync(),
  ]);

  return (
    <AccountClient
      publicCategoryLabels={publicCategoryLabels}
      accessibilityLabels={accessibilityLabels}
      registrationStatusLabels={registrationStatusLabels}
    />
  );
}
