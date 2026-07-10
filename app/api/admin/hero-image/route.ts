import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { getConfigValue, setConfigValue, HERO_IMAGE_KEY } from '@/lib/config/configService';
import { validateHeroImageUrl } from '@/lib/config/heroImageUrl';

/**
 * POST /api/admin/hero-image
 * Sets the homepage hero image to an external URL (JSON body { url }).
 * The URL must be HTTPS and hosted on the Opera domain or a subdomain
 * (see validateHeroImageUrl). The URL is stored in the site_assets config.
 */
export async function POST(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async (req) => {
    try {
      const body = await req.json().catch(() => null);
      const result = validateHeroImageUrl(body?.url);

      if ('error' in result) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }

      await setConfigValue('site_assets', HERO_IMAGE_KEY, result.url);

      // Refresh the homepage so the new image shows immediately.
      revalidatePath('/');

      return NextResponse.json({ success: true, url: result.url });
    } catch (error) {
      logger.error('Error setting hero image:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { success: false, error: "Échec de l'enregistrement de l'image" },
        { status: 500 },
      );
    }
  });
}

/**
 * DELETE /api/admin/hero-image
 * Removes the custom hero image URL and restores the bundled default.
 */
export async function DELETE(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      // Read first so a missing entry is a no-op rather than creating an empty one needlessly.
      const previous = await getConfigValue('site_assets', HERO_IMAGE_KEY);
      if (previous) {
        await setConfigValue('site_assets', HERO_IMAGE_KEY, '');
        revalidatePath('/');
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error('Error resetting hero image:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { success: false, error: "Échec de la réinitialisation de l'image" },
        { status: 500 },
      );
    }
  });
}
