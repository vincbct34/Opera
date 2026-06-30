import AdminUserDetailClient from '@/components/admin/users/AdminUserDetailClient';
import prisma from '@/lib/middleware/prismaConfig';
import { notFound } from 'next/navigation';
import {
  getRegistrationStatusLabelsMapAsync,
  getPublicCategoryLabelsMapAsync,
} from '@/lib/config/labelMappingsServer';

// Force dynamic rendering - user details change frequently
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { params: Promise<{ id: string }>; searchParams?: Promise<unknown> };

export default async function UserDetailPage({ params }: Params) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
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
  });

  if (!user) {
    notFound();
  }

  // Fetch dynamic labels for display
  const [registrationStatusLabels, publicCategoryLabels] = await Promise.all([
    getRegistrationStatusLabelsMapAsync(),
    getPublicCategoryLabelsMapAsync(),
  ]);

  // stringify dates
  const userSerialized = {
    ...user,
    created_at: user.created_at.toISOString(),
    updated_at: user.updated_at.toISOString(),
  };

  return (
    <AdminUserDetailClient
      initialData={userSerialized}
      registrationStatusLabels={registrationStatusLabels}
      publicCategoryLabels={publicCategoryLabels}
    />
  );
}
