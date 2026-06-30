import AdminDashboardClient from '@/components/admin/misc/AdminDashboardClient';
import { getDashboardStats, getUpcomingEvents } from '@/lib/middleware/admin';

// Force dynamic rendering - admin dashboard shows real-time stats
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();
  const upcomingEvents = await getUpcomingEvents(1, 4);

  return <AdminDashboardClient stats={stats} upcomingEvents={upcomingEvents} />;
}
