import NotFoundPageClient from '@/components/misc/NotFoundPageClient';

// Force dynamic rendering to ensure fresh config
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NotFound() {
  return <NotFoundPageClient />;
}
