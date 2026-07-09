import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { getConfigValue, setConfigValue, HERO_IMAGE_KEY } from '@/lib/config/configService';

// This route writes to the filesystem, so it must run on the Node.js runtime.
export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const PUBLIC_PREFIX = '/uploads/';
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

// Allowed image MIME types mapped to their canonical file extension.
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Delete a previously uploaded hero image, if the stored path points into our
 * uploads directory. Never touches the bundled default asset. Best-effort:
 * failures are logged but not fatal.
 */
async function removePreviousUpload(storedPath: string | undefined): Promise<void> {
  if (!storedPath || !storedPath.startsWith(PUBLIC_PREFIX)) return;

  const filename = path.basename(storedPath);
  const absolute = path.join(UPLOAD_DIR, filename);

  // Ensure the resolved path stays inside the uploads directory (defence in depth).
  if (path.dirname(absolute) !== UPLOAD_DIR) return;

  try {
    await fs.unlink(absolute);
  } catch (error) {
    // ENOENT (already gone) is fine; log anything else.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error('Failed to remove previous hero image:', ...sanitizeLogArgs(error));
    }
  }
}

/**
 * POST /api/admin/hero-image
 * Uploads a new homepage hero image (multipart/form-data, field name "file").
 * Persists the file under public/uploads and records its public path in the
 * site_assets config. Replaces any previous uploaded image.
 */
export async function POST(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async (req) => {
    try {
      const formData = await req.formData();
      const file = formData.get('file');

      if (!file || typeof file === 'string') {
        return NextResponse.json(
          { success: false, error: 'Aucun fichier fourni' },
          { status: 400 },
        );
      }

      const extension = ALLOWED_TYPES[file.type];
      if (!extension) {
        return NextResponse.json(
          { success: false, error: 'Format non supporté. Utilisez JPEG, PNG ou WebP.' },
          { status: 400 },
        );
      }

      if (file.size === 0) {
        return NextResponse.json({ success: false, error: 'Fichier vide' }, { status: 400 });
      }

      if (file.size > MAX_SIZE_BYTES) {
        return NextResponse.json(
          { success: false, error: "L'image ne doit pas dépasser 8 Mo" },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      // Ensure the uploads directory exists.
      await fs.mkdir(UPLOAD_DIR, { recursive: true });

      const filename = `hero-${Date.now()}.${extension}`;
      await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

      // Remove the previously uploaded image (if any) before recording the new one.
      const previous = await getConfigValue('site_assets', HERO_IMAGE_KEY);
      const publicPath = `${PUBLIC_PREFIX}${filename}`;
      await setConfigValue('site_assets', HERO_IMAGE_KEY, publicPath);
      await removePreviousUpload(previous);

      // Refresh the homepage so the new image shows immediately.
      revalidatePath('/');

      return NextResponse.json({ success: true, url: publicPath });
    } catch (error) {
      logger.error('Error uploading hero image:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { success: false, error: "Échec de l'envoi de l'image" },
        { status: 500 },
      );
    }
  });
}

/**
 * DELETE /api/admin/hero-image
 * Removes the custom hero image and restores the bundled default.
 */
export async function DELETE(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      const previous = await getConfigValue('site_assets', HERO_IMAGE_KEY);
      await setConfigValue('site_assets', HERO_IMAGE_KEY, '');
      await removePreviousUpload(previous);

      revalidatePath('/');

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
