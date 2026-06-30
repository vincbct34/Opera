import AdminStatisticsClient from '@/components/admin/misc/AdminStatisticsClient';
import {
  getRegistrationStatusLabelsMapAsync,
  getEventStatusLabelsMapAsync,
  getPublicCategoryLabelsMapAsync,
} from '@/lib/config/labelMappingsServer';

// Force dynamic rendering - statistics are fetched client-side but page structure shouldn't cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminDashboardPage() {
  // Fetch dynamic labels for display
  const [registrationStatusLabels, eventStatusLabels, publicCategoryLabels] = await Promise.all([
    getRegistrationStatusLabelsMapAsync(),
    getEventStatusLabelsMapAsync(),
    getPublicCategoryLabelsMapAsync(),
  ]);

  return (
    <AdminStatisticsClient
      registrationStatusLabels={registrationStatusLabels}
      eventStatusLabels={eventStatusLabels}
      publicCategoryLabels={publicCategoryLabels}
    />
  );
}
