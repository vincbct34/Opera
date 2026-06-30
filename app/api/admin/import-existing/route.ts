import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { logger } from '@/lib/middleware/logger';
import {
  importExistingRegistrations,
  type ImportOptions,
} from '@/lib/import/importExistingRegistrations';

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
        'text/csv', // csv
      ];

      if (
        !allowedTypes.includes(file.type) &&
        !file.name.endsWith('.xlsx') &&
        !file.name.endsWith('.xls') &&
        !file.name.endsWith('.csv')
      ) {
        return NextResponse.json(
          {
            error:
              'Type de fichier invalide. Veuillez envoyer un fichier Excel (.xlsx, .xls) ou CSV.',
          },
          { status: 400 },
        );
      }

      // Parse import options from form data
      const sendEmails = formData.get('sendEmails') !== 'false';
      const defaultStatusRaw = formData.get('defaultStatus') as string | null;
      const validStatuses = ['PRESENT', 'ABSENT'] as const;
      const defaultStatus = validStatuses.includes(defaultStatusRaw as 'PRESENT' | 'ABSENT')
        ? (defaultStatusRaw as 'PRESENT' | 'ABSENT')
        : 'PRESENT';

      const importOptions: ImportOptions = { sendEmails, defaultStatus };

      // Parse selectedRows if provided (JSON array of row indices)
      const selectedRowsRaw = formData.get('selectedRows') as string | null;
      if (selectedRowsRaw) {
        try {
          const parsed = JSON.parse(selectedRowsRaw);
          if (Array.isArray(parsed) && parsed.every((n: unknown) => typeof n === 'number')) {
            importOptions.selectedRows = parsed;
          }
        } catch {
          return NextResponse.json(
            { error: 'Format invalide pour selectedRows (JSON array of numbers attendu)' },
            { status: 400 },
          );
        }
      }

      // Read file into buffer and pass directly to import (avoids fs issues in Next.js bundled environment)
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      logger.info(
        `Processing file: ${file.name} (${buffer.length} bytes), options:`,
        importOptions,
      );

      // Run import
      const result = await importExistingRegistrations(buffer, importOptions);

      return NextResponse.json({
        success: true,
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Import endpoint error:', errorMessage);

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
