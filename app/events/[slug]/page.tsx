import EventDetailClient from '@/components/events/EventDetailClient';
import prisma from '@/lib/middleware/prismaConfig';
import { notFound } from 'next/navigation';
import {
  getPublicCategoryLabelsMapAsync,
  getAccessibilityLabelsMapAsync,
  getRegistrationStatusLabelsMapAsync,
  getEventStatusLabelsMapAsync,
} from '@/lib/config/labelMappingsServer';

// Force dynamic rendering - don't cache event details
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { params: Promise<{ slug: string }>; searchParams?: Promise<unknown> };

export default async function EventDetailPage({ params }: Params) {
  const { slug } = await params;

  // Try to find event by slug first, fallback to ID for backwards compatibility
  let event = await prisma.event.findFirst({
    where: { slug },
    include: {
      accessibility: true,
      registrationBlocks: { orderBy: { order: 'asc' } },
      sessions: { orderBy: { date: 'asc' } },
    },
    omit: {
      booked_seats: true,
      total_seats: true,
    },
  });

  // Fallback: if no event found by slug, try by ID (for backwards compatibility)
  if (!event) {
    event = await prisma.event.findUnique({
      where: { id: slug },
      include: {
        accessibility: true,
        registrationBlocks: { orderBy: { order: 'asc' } },
        sessions: { orderBy: { date: 'asc' } },
      },
    });
  }

  if (!event) {
    notFound();
  }

  // Fetch dynamic labels for display
  const [publicCategoryLabels, accessibilityLabels, registrationStatusLabels, eventStatusLabels] =
    await Promise.all([
      getPublicCategoryLabelsMapAsync(),
      getAccessibilityLabelsMapAsync(),
      getRegistrationStatusLabelsMapAsync(),
      getEventStatusLabelsMapAsync(),
    ]);

  return (
    <EventDetailClient
      initialData={event}
      publicCategoryLabels={publicCategoryLabels}
      accessibilityLabels={accessibilityLabels}
      registrationStatusLabels={registrationStatusLabels}
      eventStatusLabels={eventStatusLabels}
    />
  );
}
