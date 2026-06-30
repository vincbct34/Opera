import ClientEvents from '@/components/events/ClientEvents';
import { getEvents, type EventDto } from '@/lib/events/events';
import {
  getEventTypeLabelsMapAsync,
  getPublicCategoryLabelsMapAsync,
} from '@/lib/config/labelMappingsServer';

// Force dynamic rendering - don't cache this page
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EventsPage() {
  let events: EventDto[] = [];

  try {
    events = await getEvents();
  } catch {
    // events will remain empty array
  }

  // Fetch dynamic labels for display
  const [eventTypeLabels, publicCategoryLabels] = await Promise.all([
    getEventTypeLabelsMapAsync(),
    getPublicCategoryLabelsMapAsync(),
  ]);

  return (
    <ClientEvents
      events={events}
      eventTypeLabels={eventTypeLabels}
      publicCategoryLabels={publicCategoryLabels}
    />
  );
}
