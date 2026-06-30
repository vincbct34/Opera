import HomePageClient from '@/components/misc/HomePageClient';

// Force dynamic rendering to ensure fresh config
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  return <HomePageClient />;
}
