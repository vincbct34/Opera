import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/middleware/cronAuth';
import { UnifiedNotificationService } from '@/lib/notifications/unifiedNotificationService';
import { logger } from '@/lib/middleware/logger';

/**
 * Cron endpoint for sending event reminders
 * Schedule: Run daily to send reminders for events happening in 7 days, 1 day, and today
 *
 * Example cron schedule (vercel.json or similar):
 * "crons": [{
 *   "path": "/api/cron/events/reminders",
 *   "schedule": "0 9 * * *" // Every day at 9:00 AM
 * }]
 *
 * Manual trigger (requires CRON_SECRET):
 * curl -X POST http://localhost:3000/api/cron/events/reminders \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 *
 * @param req - The incoming request.
 * @returns JSON response with status of reminder operations.
 */
export async function POST(req: NextRequest) {
  return requireCronAuth(req, async () => {
    try {
      logger.info('Starting event reminders cron job');

      // Send reminders for events happening in 7 days
      logger.info('Sending 7-day reminders');
      await UnifiedNotificationService.sendUpcomingEventReminders(7);

      // Send reminders for events happening tomorrow
      logger.info('Sending 1-day reminders');
      await UnifiedNotificationService.sendUpcomingEventReminders(1);

      // Send reminders for events happening today
      logger.info('Sending same-day reminders');
      await UnifiedNotificationService.sendUpcomingEventReminders(0);

      logger.info('Event reminders cron job completed successfully');

      return NextResponse.json({
        success: true,
        message: 'Event reminders sent successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Event reminders cron job failed:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send event reminders',
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      );
    }
  });
}

// Also support GET for easier testing/manual triggering
export async function GET(req: NextRequest) {
  return POST(req);
}
