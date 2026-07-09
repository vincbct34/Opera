import AdminSettingsClient from '@/components/admin/misc/AdminSettingsClient';
import { getConfig, getHeroImagePath, type ConfigCategory } from '@/lib/config/configService';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CATEGORIES: ConfigCategory[] = [
  'accessibility_labels',
  'public_category_labels',
  'event_type_labels',
  'registration_status_labels',
  'event_status_labels',
  'school_grade_labels',
  'age_range_labels',
];

export default async function AdminSettingsPage() {
  // Preload all config categories
  const configPromises = CATEGORIES.map(async (category) => ({
    category,
    config: await getConfig(category),
  }));

  const configs = await Promise.all(configPromises);
  const initialConfigs = Object.fromEntries(configs.map((c) => [c.category, c.config])) as Record<
    ConfigCategory,
    Record<string, string>
  >;

  const heroImage = await getHeroImagePath();

  return <AdminSettingsClient initialConfigs={initialConfigs} initialHeroImage={heroImage} />;
}
