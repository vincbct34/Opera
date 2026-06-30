import AdminSecurityClient from '@/components/admin/AdminSecurityClient';

// Force dynamic rendering - security logs are fetched in real-time
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminSecurityPage() {
  return <AdminSecurityClient />;
}
