import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sendWelcomeEmailWithResetLink } from '@/lib/import/importExistingRegistrations';

// GET: Get count of users needing welcome emails
export const GET = async (req: NextRequest) => {
  return await requireAdmin(req, async () => {
    try {
      const count = await prisma.user.count({
        where: {
          need_welcome_email: true,
          registrations: {
            some: {}, // Has at least one registration
          },
        },
      });

      return NextResponse.json({ count });
    } catch (error) {
      logger.error('Error counting users needing welcome emails:', error);
      return NextResponse.json({ error: 'Failed to count users' }, { status: 500 });
    }
  });
};

// POST: Send welcome emails to all users with need_welcome_email: true
export const POST = async (req: NextRequest) => {
  return await requireAdmin(req, async () => {
    try {
      logger.info('=== Sending pending welcome emails ===');

      // Get all users needing welcome emails who have registrations
      const usersNeedingEmail = await prisma.user.findMany({
        where: {
          need_welcome_email: true,
          registrations: {
            some: {},
          },
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          _count: {
            select: { registrations: true },
          },
        },
      });

      logger.info(`Found ${usersNeedingEmail.length} users needing welcome emails`);

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const user of usersNeedingEmail) {
        try {
          logger.info(
            `[Email] Sending to ${user.email} (${user._count.registrations} registrations)...`,
          );

          await sendWelcomeEmailWithResetLink(
            user.email,
            user.first_name,
            user.last_name || '',
            user._count.registrations,
          );

          // Mark as sent
          await prisma.user.update({
            where: { id: user.id },
            data: { need_welcome_email: false },
          });

          successCount++;
          logger.info(`[Email] Sent successfully to ${user.email}`);
        } catch (error) {
          const errorMessage = (error as Error).message;
          errorCount++;
          errors.push(`${user.email}: ${errorMessage}`);
          logger.error(`[Email] Failed for ${user.email}: ${errorMessage}`);
        }
      }

      logger.info(`=== Sending welcome emails completed ===`);
      logger.info(`Success: ${successCount}, Errors: ${errorCount}`);

      return NextResponse.json({
        success: true,
        total: usersNeedingEmail.length,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error('Error sending welcome emails:', error);
      return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  });
};
