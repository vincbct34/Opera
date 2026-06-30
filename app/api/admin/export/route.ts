import { NextRequest, NextResponse } from 'next/server';
import {
  generateExcelReport,
  ExportType,
  ExportFilters,
  ExportOptions,
} from '@/lib/utils/excelExportService';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { logAdminAccess } from '@/lib/security/securityLogger';

/**
 * POST /api/admin/export
 * Generates an Excel export based on the specified type, filters and options.
 * @param request - The incoming request containing export type, filters and options.
 * @returns Excel file download.
 */
export async function POST(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async (req) => {
    try {
      // Parse request parameters
      const body = await req.json();
      const {
        exportType,
        filters,
        options: clientOptions,
      } = body as {
        exportType: ExportType;
        filters?: ExportFilters;
        options?: ExportOptions;
      };

      // Log admin access
      if (req.user) {
        await logAdminAccess(req.user.id, request, `Export data: ${exportType}`);
      }

      if (!exportType) {
        return NextResponse.json({ error: "Type d'export non spécifié" }, { status: 400 });
      }

      // Validate export type
      const validTypes: ExportType[] = [
        'users',
        'events',
        'registrations',
        'institutions',
        'complete',
      ];
      if (!validTypes.includes(exportType)) {
        return NextResponse.json({ error: "Type d'export invalide" }, { status: 400 });
      }

      // Generate Excel file
      const options: ExportOptions = {
        ...(clientOptions || {}),
        exporterName:
          req.user?.first_name && req.user?.last_name
            ? `${req.user.first_name} ${req.user.last_name}`
            : undefined,
        exporterEmail: req.user?.email || undefined,
      };
      const buffer = await generateExcelReport(exportType, filters || {}, options);

      // Create file name
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `export_${exportType}_${timestamp}.xlsx`;

      // Retourner le fichier
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-cache',
        },
      });
    } catch (error) {
      logger.error("Erreur lors de l'export:", ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la génération de l'export" },
        { status: 500 },
      );
    }
  });
}
