import HomePageClient from '@/components/misc/HomePageClient';
import { getConfigValue, HERO_IMAGE_KEY } from '@/lib/config/configService';

// Force dynamic rendering to ensure fresh config
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const heroImage = await getConfigValue('site_assets', HERO_IMAGE_KEY);

  return <HomePageClient heroImage={heroImage || null} />;
}
