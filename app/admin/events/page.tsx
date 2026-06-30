import { Metadata } from 'next';
import AdminEventsClient from '@/components/admin/events/AdminEventsClient';
import {
  getEventTypeLabelsMapAsync,
  getPublicCategoryLabelsMapAsync,
  getEventStatusLabelsMapAsync,
  getAccessibilityLabelsMapAsync,
} from '@/lib/config/labelMappingsServer';

export const metadata: Metadata = {
  title: 'Gestion des événements | Administration',
  description: 'Gérer les événements de la plateforme',
};

export default async function AdminEventsPage() {
  // Fetch dynamic labels for display
  const [eventTypeLabels, publicCategoryLabels, eventStatusLabels, accessibilityLabels] =
    await Promise.all([
      getEventTypeLabelsMapAsync(),
      getPublicCategoryLabelsMapAsync(),
      getEventStatusLabelsMapAsync(),
      getAccessibilityLabelsMapAsync(),
    ]);

  return (
    <AdminEventsClient
      eventTypeLabels={eventTypeLabels}
      publicCategoryLabels={publicCategoryLabels}
      eventStatusLabels={eventStatusLabels}
      accessibilityLabels={accessibilityLabels}
    />
  );
}
