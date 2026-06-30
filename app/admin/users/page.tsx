import AdminUsersClient from '@/components/admin/users/AdminUsersClient';
import prisma from '@/lib/middleware/prismaConfig';

// Force dynamic rendering - users list changes frequently
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      role: true,
      userInstitutions: {
        select: {
          institution: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      created_at: true,
      updated_at: true,
    },
    orderBy: { created_at: 'desc' },
    take: 20,
  });

  const usersSerialized = users.map((u: (typeof users)[number]) => ({
    ...u,
    created_at: u.created_at.toISOString(),
    updated_at: u.updated_at.toISOString(),
  }));
  return <AdminUsersClient initialData={usersSerialized} />;
}
