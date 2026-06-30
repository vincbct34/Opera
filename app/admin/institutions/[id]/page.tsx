import AdminInstitutionDetailClient from '@/components/admin/institutions/AdminInstitutionDetailClient';
import prisma from '@/lib/middleware/prismaConfig';
import { notFound } from 'next/navigation';
import {
  getRegistrationStatusLabelsMapAsync,
  getPublicCategoryLabelsMapAsync,
} from '@/lib/config/labelMappingsServer';

// Force dynamic rendering - institution details change frequently
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { params: Promise<{ id: string }>; searchParams?: Promise<unknown> };

export default async function InstitutionDetailPage({ params }: Params) {
  const { id } = await params;

  const institution = await prisma.institution.findUnique({
    where: { id },
    include: {
      address: true,
      _count: { select: { userInstitutions: true, registrations: true } },
      userInstitutions: {
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              role: true,
              created_at: true,
            },
          },
        },
      },
    },
  });

  if (!institution) {
    notFound();
  }

  // Fetch dynamic labels for display
  const [registrationStatusLabels, publicCategoryLabels] = await Promise.all([
    getRegistrationStatusLabelsMapAsync(),
    getPublicCategoryLabelsMapAsync(),
  ]);

  return (
    <AdminInstitutionDetailClient
      initialData={institution}
      registrationStatusLabels={registrationStatusLabels}
      publicCategoryLabels={publicCategoryLabels}
    />
  );
}
