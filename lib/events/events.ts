import prisma from '../middleware/prismaConfig';
import { EventType, PublicCategory, SchoolGrade, AgeRange, EventStatus } from '@prisma/client';
import { richTextToPlainText } from '@/lib/richText';

/**
 * Data Transfer Object for Event.
 */
export type EventDto = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  image_url: string | null;
  location: string;
  event_dates: string[];
  type: EventType[];
  category: PublicCategory[];
  grades: SchoolGrade[];
  age_ranges: AgeRange[];
  status: EventStatus;
};

/**
 * Retrieve all events ordered by creation date.
 * By default, excludes archived events unless includeArchived is true.
 * @param includeArchived - Whether to include archived events (default: false)
 * @returns A list of events formatted as EventDto.
 */
export async function getEvents(includeArchived = false): Promise<EventDto[]> {
  const events = await prisma.event.findMany({
    where: includeArchived ? {} : { status: { not: 'ARCHIVED' } },
    orderBy: { event_dates: 'asc' },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      image_url: true,
      location: true,
      event_dates: true,
      type: true,
      category: true,
      grades: true,
      age_ranges: true,
      status: true,
    },
  });

  // Normalize fields to match client expectations
  return events.map((e) => ({
    id: e.id,
    title: e.title,
    slug: e.slug ?? null,
    description: e.description ? richTextToPlainText(e.description) || null : null,
    image_url: e.image_url ?? null,
    location: e.location,
    event_dates: (e.event_dates || []).map((d) => new Date(d).toISOString()),
    type: e.type || [],
    category: e.category || [],
    grades: e.grades || [],
    age_ranges: e.age_ranges || [],
    status: e.status,
  }));
}
