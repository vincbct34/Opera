import prisma from '../middleware/prismaConfig';

export type DashboardStats = {
  upcomingEvents: number;
  totalUsers: number;
  totalInstitutions: number;
  pendingRegistrations: number;
};

export type UpcomingEvent = {
  id: string;
  title: string;
  slug: string | null;
  location: string;
  nextDate: string;
  totalSeats: number;
  bookedSeats: number;
  registrationsCount: number;
};

export async function getDashboardStats(days?: number | null): Promise<DashboardStats> {
  const now = new Date();
  const startDate = days ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : null;

  // Count upcoming events (events with at least one future date)
  const eventFilter = startDate ? { created_at: { gte: startDate, lte: now } } : {};
  const allEvents = await prisma.event.findMany({
    select: { event_dates: true },
    where: eventFilter,
  });
  const upcomingEvents = allEvents.filter((e) =>
    e.event_dates.some((date) => new Date(date) > now),
  ).length;

  const userFilter = startDate ? { created_at: { gte: startDate, lte: now } } : {};
  const totalUsers = await prisma.user.count({ where: userFilter });

  const institutionFilter = startDate ? { created_at: { gte: startDate, lte: now } } : {};
  const totalInstitutions = await prisma.institution.count({ where: institutionFilter });

  const pendingFilter: Record<string, unknown> = { status: 'PENDING' };
  if (startDate) {
    pendingFilter.created_at = { gte: startDate, lte: now };
  }
  const pendingRegistrations = await prisma.registration.count({ where: pendingFilter });

  return {
    upcomingEvents,
    totalUsers,
    totalInstitutions,
    pendingRegistrations,
  };
}

export async function getUpcomingEvents(page = 1, limit = 4): Promise<UpcomingEvent[]> {
  const now = new Date();

  const events = await prisma.event.findMany({
    orderBy: { created_at: 'desc' },
    include: { registrations: true },
  });

  const upcomingEvents = events
    .map((event) => {
      const futureDates = event.event_dates
        .filter((date) => new Date(date) > now)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      if (futureDates.length === 0) return null;

      return {
        id: event.id,
        title: event.title,
        slug: event.slug,
        location: event.location ?? '',
        nextDate: new Date(futureDates[0]).toISOString(),
        totalSeats: event.total_seats ?? 0,
        bookedSeats: event.booked_seats ?? 0,
        registrationsCount: event.registrations.length,
      } as UpcomingEvent;
    })
    .filter((e) => e !== null) as UpcomingEvent[];

  const start = (page - 1) * limit;
  const end = start + limit;
  return upcomingEvents.slice(start, end);
}

export async function getTotalUpcomingEventsCount(): Promise<number> {
  const now = new Date();

  const events = await prisma.event.findMany({
    select: { event_dates: true },
  });

  const upcomingCount = events.filter((e) =>
    e.event_dates.some((date) => new Date(date) > now),
  ).length;

  return upcomingCount;
}

export type RegistrationStatsByStatus = {
  PENDING: number;
  CONFIRMED: number;
  CANCELLED: number;
  REJECTED: number;
  ATTENDED: number;
  NO_SHOW: number;
};

export async function getRegistrationStatsByStatus(
  days?: number | null,
): Promise<RegistrationStatsByStatus> {
  const now = new Date();
  const startDate = days ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : null;

  const where: Record<string, unknown> = {};
  if (startDate) {
    where.created_at = { gte: startDate, lte: now };
  }

  const stats = await prisma.registration.groupBy({
    by: ['status'],
    _count: {
      id: true,
    },
    where,
  });

  const result: RegistrationStatsByStatus = {
    PENDING: 0,
    CONFIRMED: 0,
    CANCELLED: 0,
    REJECTED: 0,
    ATTENDED: 0,
    NO_SHOW: 0,
  };

  stats.forEach((stat) => {
    if (stat.status in result) {
      result[stat.status as keyof RegistrationStatsByStatus] = stat._count.id;
    }
  });

  return result;
}

export type UserStatsByRole = {
  USER: number;
  ADMIN: number;
  SUPERADMIN: number;
};

export async function getUserStatsByRole(days?: number | null): Promise<UserStatsByRole> {
  const now = new Date();
  const startDate = days ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : null;

  const where: Record<string, unknown> = {};
  if (startDate) {
    where.created_at = { gte: startDate, lte: now };
  }

  const stats = await prisma.user.groupBy({
    by: ['role'],
    _count: {
      id: true,
    },
    where,
  });

  const result: UserStatsByRole = {
    USER: 0,
    ADMIN: 0,
    SUPERADMIN: 0,
  };

  stats.forEach((stat) => {
    if (stat.role in result) {
      result[stat.role as keyof UserStatsByRole] = stat._count.id;
    }
  });

  return result;
}

export type EventCapacityStats = {
  totalEvents: number;
  totalCapacity: number;
  totalBooked: number;
  occupancyRate: number;
  averageCapacityPerEvent: number;
};

export async function getEventCapacityStats(days?: number | null): Promise<EventCapacityStats> {
  const now = new Date();
  const startDate = days ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : null;

  const where: Record<string, unknown> = {};
  if (startDate) {
    where.created_at = { gte: startDate, lte: now };
  }

  const events = await prisma.event.findMany({
    select: {
      total_seats: true,
      booked_seats: true,
    },
    where,
  });

  const totalCapacity = events.reduce((acc, e) => acc + (e.total_seats ?? 0), 0);
  const totalBooked = events.reduce((acc, e) => acc + (e.booked_seats ?? 0), 0);

  return {
    totalEvents: events.length,
    totalCapacity,
    totalBooked,
    occupancyRate: totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0,
    averageCapacityPerEvent: events.length > 0 ? Math.round(totalCapacity / events.length) : 0,
  };
}

export type RegistrationTrendData = {
  date: string;
  count: number;
};

export async function getRegistrationTrendData(
  days?: number | null,
): Promise<RegistrationTrendData[]> {
  const now = new Date();

  // Default to 30 days if not specified and "all" is selected
  const daysToUse = days ?? 30;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - daysToUse);

  const registrations = await prisma.registration.findMany({
    where: {
      created_at: {
        gte: startDate,
        lte: now,
      },
    },
    select: {
      created_at: true,
    },
    orderBy: {
      created_at: 'asc',
    },
  });

  // Group by date
  const grouped: { [key: string]: number } = {};
  registrations.forEach((reg) => {
    const dateKey = new Date(reg.created_at).toISOString().split('T')[0];
    grouped[dateKey] = (grouped[dateKey] || 0) + 1;
  });

  // Create array with all dates in range
  const result: RegistrationTrendData[] = [];
  for (let i = 0; i < daysToUse; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    result.push({
      date: dateKey,
      count: grouped[dateKey] || 0,
    });
  }

  return result;
}

export type InstitutionRegistrationStats = {
  id: string;
  name: string;
  city: string;
  count: number;
};

export async function getTopInstitutionsByRegistrations(
  limit = 10,
  days?: number | null,
): Promise<InstitutionRegistrationStats[]> {
  const now = new Date();
  const startDate = days ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : null;

  const where: Record<string, unknown> = {};
  if (startDate) {
    where.created_at = { gte: startDate, lte: now };
  }

  // 1. Get top institution IDs and counts using groupBy
  const topStats = await prisma.registration.groupBy({
    by: ['institution_id'],
    _count: {
      institution_id: true,
    },
    where,
    orderBy: {
      _count: {
        institution_id: 'desc',
      },
    },
    take: limit,
  });

  // 2. Fetch details for these institutions including address for city
  const institutionIds = topStats.map((stat) => stat.institution_id);
  const institutions = await prisma.institution.findMany({
    where: {
      id: {
        in: institutionIds,
      },
    },
    select: {
      id: true,
      name: true,
      address: {
        select: {
          city: true,
        },
      },
    },
  });

  // 3. Map names and city back to stats
  return topStats.map((stat) => {
    const institution = institutions.find((i) => i.id === stat.institution_id);
    return {
      id: stat.institution_id,
      name: institution?.name || 'Inconnu',
      city: institution?.address?.city || '',
      count: stat._count.institution_id,
    };
  });
}

export type EventPopularityStats = {
  id: string;
  title: string;
  slug: string | null;
  registrationsCount: number;
  occupancyRate: number;
};

export async function getTopEventsByRegistrations(
  limit = 10,
  days?: number | null,
): Promise<EventPopularityStats[]> {
  const now = new Date();
  const startDate = days ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : null;

  const where: Record<string, unknown> = {};
  if (startDate) {
    where.created_at = { gte: startDate, lte: now };
  }

  // 1. Get top event IDs and counts using groupBy
  const topStats = await prisma.registration.groupBy({
    by: ['event_id'],
    _count: {
      event_id: true,
    },
    where,
    orderBy: {
      _count: {
        event_id: 'desc',
      },
    },
    take: limit,
  });

  // 2. Fetch details for these events
  const eventIds = topStats.map((stat) => stat.event_id);
  const events = await prisma.event.findMany({
    where: {
      id: {
        in: eventIds,
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      total_seats: true,
      booked_seats: true,
    },
  });

  // 3. Map details back to stats
  return topStats.map((stat) => {
    const event = events.find((e) => e.id === stat.event_id);
    const totalSeats = event?.total_seats || 0;
    const bookedSeats = event?.booked_seats || 0; // Note: this is total lifetime booked, not just in period.
    // For specific period occupancy, we might want to count registrations in period, but 'occupancy' usually refers to the event's overall status.
    // However, the original code used `e.booked_seats` which is total.
    // Let's stick to total booked_seats for occupancy rate coherence, or recalculate if needed.
    // The previous implementation used `e.booked_seats` (total) to calculate occupancy.

    return {
      id: stat.event_id,
      title: event?.title || 'Événement inconnu',
      slug: event?.slug || null,
      registrationsCount: stat._count.event_id,
      occupancyRate: totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0,
    };
  });
}
