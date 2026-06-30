import { NextRequest, NextResponse } from 'next/server';

import { createAuthMiddleware, AuthenticatedRequest } from '@/app/api/middleware';

import prisma from '@/lib/middleware/prismaConfig';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs, redactEmail } from '@/lib/security/logSanitization';
import {
  sendEmail,
  generateEmailVerificationToken,
  generateVerificationUrl,
} from '@/lib/notifications/emailService';
import { getServerBaseUrl } from '@/lib/utils/getBaseUrl';
import {
  checkRateLimit,
  getClientIdentifier,
  RATE_LIMIT_CONFIGS,
} from '@/lib/middleware/serverRateLimit';
import { RegisterSchema } from '@/lib/validation/validationSchemas';
import { logRegistration, logRateLimitExceeded } from '@/lib/security/securityLogger';

import { NotificationService } from '@/lib/notifications/notificationService';

import bcrypt from 'bcrypt';
import { z } from 'zod';

// Middleware without CSRF protection for register (CSRF not needed for registration)
const registerMiddleware = createAuthMiddleware({
  requireAuth: false,
  requireCSRF: false, // Disable CSRF for registration
  enableRateLimit: false, // Rate limiting handled manually below
});

/**
 * Register route for creating a new user.
 * @param req - NextRequest object containing the request data.
 * @returns NextResponse with user information or error message.
 */
export async function POST(req: NextRequest) {
  // Use registerMiddleware to handle the request
  return registerMiddleware(req as AuthenticatedRequest, async (req: AuthenticatedRequest) => {
    // Rate limiting - prevent registration spam and email harvesting
    const clientId = getClientIdentifier(req);
    const rateLimitResult = await checkRateLimit(clientId, RATE_LIMIT_CONFIGS.auth);

    if (!rateLimitResult.success) {
      await logRateLimitExceeded(req, clientId);

      return NextResponse.json(
        {
          error: "Trop de tentatives d'inscription. Veuillez réessayer plus tard.",
          resetAt: rateLimitResult.resetAt,
        },
        { status: 429 },
      );
    }

    // Validate and parse request body
    let email: string;
    let password: string;
    let first_name: string;
    let last_name: string;
    let phone_number: string;
    let institution_ids: string[];
    let email_notifications_enabled: boolean;
    let events_reminders_enabled: boolean;

    try {
      const body = await req.json();
      const validatedData = RegisterSchema.parse(body);
      email = validatedData.email;
      password = validatedData.password;
      first_name = validatedData.first_name;
      last_name = validatedData.last_name;
      phone_number = validatedData.phone_number;
      institution_ids = validatedData.institution_ids;
      email_notifications_enabled = validatedData.email_notifications_enabled ?? true;
      events_reminders_enabled = validatedData.events_reminders_enabled ?? true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Return detailed validation errors
        const firstError = error.issues[0];
        const errorMessage = firstError.message || 'Données invalides';

        return NextResponse.json(
          {
            error: errorMessage,
            details: error.issues.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: 'Erreur lors de la validation des données' },
        { status: 400 },
      );
    }

    // Check if the email is already in use
    // Use generic error message to prevent email enumeration attacks
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Return generic error without revealing if email exists
      return NextResponse.json(
        {
          error:
            "Une erreur est survenue lors de l'inscription. Veuillez vérifier vos informations ou contacter le support.",
          code: 'REGISTRATION_FAILED',
        },
        { status: 400 },
      );
    }

    // Hash the password before storing it
    const hashed = await bcrypt.hash(password, 10);

    // Generate email verification token and expiration date
    const emailVerificationToken = generateEmailVerificationToken();
    const emailVerificationExpires = new Date();
    emailVerificationExpires.setHours(emailVerificationExpires.getHours() + 24); // Token expires in 24 hours

    // Create the new user in the database with multiple institutions
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        first_name,
        last_name,
        phone_number,
        email_verification_token: emailVerificationToken,
        email_verification_expires: emailVerificationExpires,
        ...(email_notifications_enabled !== undefined && { email_notifications_enabled }),
        ...(events_reminders_enabled !== undefined && { events_reminders_enabled }),
        userInstitutions: {
          create: institution_ids.map((id: string) => ({
            institution: { connect: { id } },
          })),
        },
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        role: true,
        email_notifications_enabled: true,
        events_reminders_enabled: true,
        created_at: true,
        userInstitutions: {
          select: {
            institution_id: true,
          },
        },
      },
    });

    // Send welcome email with verification link
    try {
      const verificationUrl = generateVerificationUrl(emailVerificationToken);
      await sendEmail({
        to: email,
        template_id: '3666105', // Welcome / Verification Template
        template_data: {
          confirm_url: verificationUrl,
          unsubscribe_url: `${getServerBaseUrl()}/account`,
          // user_role: 'USER', // Optional context
        },
      });

      // Create a welcome notification for the user
      await NotificationService.createNotification({
        userId: user.id,
        title: 'Bienvenue sur la plateforme !',
        message: `Bonjour ${first_name} ${last_name}, votre compte a été créé avec succès. N'oubliez pas de vérifier votre email pour l'activer.`,
        type: 'SYSTEM_UPDATE',
      });

      logger.info(`Email de bienvenue envoyé à ${redactEmail(email)}`);
    } catch (emailError) {
      logger.error(
        "Erreur lors de l'envoi de l'email de bienvenue:",
        ...sanitizeLogArgs(emailError),
      );
      // Don't fail registration if email can't be sent
    }

    // Log successful registration
    await logRegistration(user.id, req);

    // If user creation is successful, return the user information
    return NextResponse.json({
      user,
      message: 'Compte créé avec succès. Vérifiez votre email pour activer votre compte.',
    });
  });
}
