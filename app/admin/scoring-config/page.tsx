import ScoringConfigClient from '@/components/admin/scoring/ScoringConfigClient';
import prisma from '@/lib/middleware/prismaConfig';

// Force dynamic rendering - scoring configurations change frequently
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ScoringConfigPage() {
  // Fetch all scoring configurations with their criteria
  const configurations = await prisma.scoringConfiguration.findMany({
    include: {
      criteria: {
        orderBy: {
          order: 'asc',
        },
      },
      event: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
  });

  // Fetch a sample event for preview functionality
  const sampleEvent = await prisma.event.findFirst({
    where: {
      status: 'OPEN',
      registrations: {
        some: {},
      },
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  return (
    <ScoringConfigClient
      initialConfigurations={
        configurations as unknown as React.ComponentProps<
          typeof ScoringConfigClient
        >['initialConfigurations']
      }
      sampleEvent={sampleEvent}
    />
  );
}
