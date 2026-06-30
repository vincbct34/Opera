import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { logger } from '@/lib/middleware/logger';
import { previewImport } from '@/lib/import/importExistingRegistrations';

export async function POST(req: NextRequest) {
  return requireAdmin(req as AuthenticatedRequest, async (): Promise<NextResponse> => {
    try {
      // Parse multipart form data
      const formData = await req.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      // Validate file type
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
        'application/vnd.ms-excel', // xls
      ];

      if (
        !allowedTypes.includes(file.type) &&
        !file.name.endsWith('.xlsx') &&
        !file.name.endsWith('.xls')
      ) {
        return NextResponse.json(
          {
            error: 'Type de fichier invalide. Veuillez envoyer un fichier Excel (.xlsx, .xls).',
          },
          { status: 400 },
        );
      }

      // Read file into buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      logger.info(`Preview file: ${file.name} (${buffer.length} bytes)`);

      // Run preview
      const result = await previewImport(buffer);

      return NextResponse.json({
        success: true,
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Preview endpoint error:', errorMessage);

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 500 },
      );
    }
  });
}
