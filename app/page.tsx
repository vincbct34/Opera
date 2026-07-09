import HomePageClient from '@/components/misc/HomePageClient';
import { getHeroImagePath } from '@/lib/config/configService';

// Force dynamic rendering to ensure fresh config
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  // Read directly from the DB (not the cache) so a fresh upload shows immediately
  // even when Redis is down. See getHeroImagePath for the rationale.
  const heroImage = await getHeroImagePath();

  return <HomePageClient heroImage={heroImage} />;
}
