import AdminInstitutionsClient from '@/components/admin/institutions/AdminInstitutionsClient';
import prisma from '@/lib/middleware/prismaConfig';
import { getPublicCategoryLabelsMapAsync } from '@/lib/config/labelMappingsServer';

// Force dynamic rendering - institutions list changes frequently
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminInstitutionsPage() {
  // Server-side fetch first page of institutions
  const institutions = await prisma.institution.findMany({
    include: {
      address: true,
      _count: { select: { userInstitutions: true, registrations: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 20,
  });

  // Fetch dynamic labels for display
  const publicCategoryLabels = await getPublicCategoryLabelsMapAsync();

  return (
    <AdminInstitutionsClient
      initialData={institutions}
      publicCategoryLabels={publicCategoryLabels}
    />
  );
}
