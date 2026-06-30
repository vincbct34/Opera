import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import {
  getConfig,
  setConfigValues,
  resetConfigToDefaults,
  type ConfigCategory,
} from '@/lib/config/configService';

const VALID_CATEGORIES: ConfigCategory[] = [
  'accessibility_labels',
  'event_type_labels',
  'public_category_labels',
  'registration_status_labels',
  'event_status_labels',
  'school_grade_labels',
  'age_range_labels',
];

function isValidCategory(category: string): category is ConfigCategory {
  return VALID_CATEGORIES.includes(category as ConfigCategory);
}

/**
 * GET /api/admin/config
 * Retrieves configuration values for a specific category
 * Query params:
 * - category: The configuration category to retrieve
 *
 * @returns JSON response with config values
 */
export async function GET(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const category = searchParams.get('category');

      if (!category) {
        return NextResponse.json(
          { success: false, error: 'Category parameter is required' },
          { status: 400 },
        );
      }

      if (!isValidCategory(category)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid category. Valid categories are: ${VALID_CATEGORIES.join(', ')}`,
          },
          { status: 400 },
        );
      }

      const config = await getConfig(category);

      return NextResponse.json({
        success: true,
        category,
        config,
      });
    } catch (error) {
      logger.error('Error fetching config:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { success: false, error: 'Failed to fetch configuration' },
        { status: 500 },
      );
    }
  });
}

/**
 * PUT /api/admin/config
 * Updates configuration values for a specific category
 * Body:
 * - category: The configuration category to update
 * - values: Record<string, string> of key-value pairs to update
 *
 * @returns JSON response with success status
 */
export async function PUT(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async (req) => {
    try {
      const body = await req.json();
      const { category, values } = body;

      if (!category) {
        return NextResponse.json(
          { success: false, error: 'Category is required' },
          { status: 400 },
        );
      }

      if (!isValidCategory(category)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid category. Valid categories are: ${VALID_CATEGORIES.join(', ')}`,
          },
          { status: 400 },
        );
      }

      if (!values || typeof values !== 'object') {
        return NextResponse.json(
          { success: false, error: 'Values must be an object' },
          { status: 400 },
        );
      }

      // Validate all values are strings
      for (const [key, value] of Object.entries(values)) {
        if (typeof value !== 'string') {
          return NextResponse.json(
            { success: false, error: `Value for key "${key}" must be a string` },
            { status: 400 },
          );
        }
      }

      await setConfigValues(category, values as Record<string, string>);

      logger.info(`Config updated for category ${category} by admin`);

      // Invalidate Next.js Full Route Cache for the settings page
      revalidatePath('/admin/settings');

      // Return updated config
      const updatedConfig = await getConfig(category);

      return NextResponse.json({
        success: true,
        message: 'Configuration updated successfully',
        category,
        config: updatedConfig,
      });
    } catch (error) {
      logger.error('Error updating config:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { success: false, error: 'Failed to update configuration' },
        { status: 500 },
      );
    }
  });
}

/**
 * DELETE /api/admin/config
 * Resets a configuration category to default values
 * Query params:
 * - category: The configuration category to reset
 *
 * @returns JSON response with success status
 */
export async function DELETE(request: NextRequest) {
  return requireAdmin(request as AuthenticatedRequest, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const category = searchParams.get('category');

      if (!category) {
        return NextResponse.json(
          { success: false, error: 'Category parameter is required' },
          { status: 400 },
        );
      }

      if (!isValidCategory(category)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid category. Valid categories are: ${VALID_CATEGORIES.join(', ')}`,
          },
          { status: 400 },
        );
      }

      await resetConfigToDefaults(category);
      // Cache is already cleared by resetConfigToDefaults

      logger.info(`Config reset to defaults for category ${category} by admin`);

      // Invalidate Next.js Full Route Cache for the settings page
      revalidatePath('/admin/settings');

      // Return default config
      const defaultConfig = await getConfig(category);

      return NextResponse.json({
        success: true,
        message: 'Configuration reset to defaults',
        category,
        config: defaultConfig,
      });
    } catch (error) {
      logger.error('Error resetting config:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { success: false, error: 'Failed to reset configuration' },
        { status: 500 },
      );
    }
  });
}
