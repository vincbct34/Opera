import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';
import { Role } from '@/app/generated/prisma/enums';
import { Prisma } from '@/app/generated/prisma/client';
import bcrypt from 'bcrypt';
import { logger } from '@/lib/middleware/logger';
import { sanitizeLogArgs } from '@/lib/security/logSanitization';
import { logAdminAccess, logDataModification } from '@/lib/security/securityLogger';
import { z } from 'zod';
import { PasswordSchema } from '@/lib/validation/validationSchemas';
import {
  sendEmail,
  generateEmailVerificationToken,
  generateVerificationUrl,
} from '@/lib/notifications/emailService';

import { NotificationService } from '@/lib/notifications/notificationService';

/**
 * GET /api/users
 * Admin-only: list users with pagination and optional search by name or email.
 * @param req - The incoming request.
 * @returns JSON response with users list and pagination info.
 */
export async function GET(req: NextRequest) {
  return requireAdmin(req as AuthenticatedRequest, async (authReq) => {
    try {
      // Log admin access
      if (authReq.user) {
        await logAdminAccess(authReq.user.id, req, 'List users');
      }
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const search = (searchParams.get('search') || '').trim();
      const email = (searchParams.get('email') || '').trim();

      const offset = (page - 1) * limit;

      const where: Prisma.UserWhereInput = {};
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { first_name: { contains: search, mode: 'insensitive' } },
          { last_name: { contains: search, mode: 'insensitive' } },
        ];
      }
      // If an explicit email filter is provided, apply it as a contains filter (case-insensitive).
      if (email) {
        // If search already exists, combine with AND so both filters apply.
        if (where.OR) {
          where.AND = [{ OR: where.OR }, { email: { contains: email, mode: 'insensitive' } }];
          // remove top-level OR since we've moved it into AND
          delete where.OR;
        } else {
          where.email = { contains: email, mode: 'insensitive' };
        }
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            phone_number: true,
            role: true,
            userInstitutions: {
              select: {
                institution: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            created_at: true,
            updated_at: true,
          },
          orderBy: { created_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.user.count({ where }),
      ]);

      return NextResponse.json({
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Error listing users:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des utilisateurs' },
        { status: 500 },
      );
    }
  });
}

/**
 * POST /api/users
 * Create a new user (SUPERADMIN only).
 * @param req - The incoming request containing user data.
 * @returns JSON response with the created user.
 */
export async function POST(req: NextRequest) {
  return requireAdmin(req as AuthenticatedRequest, async (authReq) => {
    try {
      const body = await req.json().catch(() => ({}));

      const {
        email,
        password,
        first_name,
        last_name,
        phone_number,
        institution_ids,
        role,
        skip_email_verification,
        email_notifications_enabled,
        events_reminders_enabled,
      } = body;

      if (
        !email ||
        !password ||
        !first_name ||
        !last_name ||
        !phone_number ||
        !institution_ids ||
        !Array.isArray(institution_ids) ||
        institution_ids.length === 0
      ) {
        return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
      }

      // Validate password with the same rules as registration
      try {
        PasswordSchema.parse(password);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const firstError = error.issues[0];
          return NextResponse.json({ error: firstError.message }, { status: 400 });
        }
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: 'Email déjà utilisé' }, { status: 400 });
      }

      // Role assignment logic
      // SUPERADMIN can assign any role
      // ADMIN can only assign USER role
      const allowedRoles = Object.values(Role) as string[];
      let assignedRole: Role = Role.USER; // Default to USER

      if (typeof role === 'string') {
        if (!allowedRoles.includes(role)) {
          return NextResponse.json({ error: 'Valeur de rôle invalide' }, { status: 400 });
        }

        // Check permissions for role assignment
        if (authReq.user?.role !== Role.SUPERADMIN) {
          // Regular ADMIN trying to assign a role
          if (role === Role.ADMIN || role === Role.SUPERADMIN) {
            return NextResponse.json(
              { error: 'Permission refusée : vous ne pouvez créer que des utilisateurs standard' },
              { status: 403 },
            );
          }
        }

        assignedRole = role as Role;
      } else {
        // If no role specified, default is USER (already set)
        // But if the code previously defaulted to ADMIN for SUPERADMINs, we should be careful.
        // The previous code defaulted to ADMIN. Let's keep it safe: default to USER.
        assignedRole = Role.USER;
      }

      const hashed = await bcrypt.hash(password, 10);

      // Generate email verification token only if not skipping verification
      let emailVerificationToken: string | null = null;
      let emailVerificationExpires: Date | null = null;

      if (!skip_email_verification) {
        emailVerificationToken = generateEmailVerificationToken();
        emailVerificationExpires = new Date();
        emailVerificationExpires.setHours(emailVerificationExpires.getHours() + 24);
      }

      const user = await prisma.user.create({
        data: {
          email,
          password: hashed,
          first_name,
          last_name,
          phone_number,
          role: assignedRole,
          // email_verification_token being null means email is verified
          email_verification_token: emailVerificationToken,
          email_verification_expires: emailVerificationExpires,
          ...(typeof email_notifications_enabled === 'boolean' && { email_notifications_enabled }),
          ...(typeof events_reminders_enabled === 'boolean' && { events_reminders_enabled }),
          userInstitutions: {
            create: institution_ids.map((id: string) => ({ institution: { connect: { id } } })),
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

      // Send welcome email (non-blocking failures) - only if not skipping verification
      try {
        if (!skip_email_verification && emailVerificationToken) {
          const verificationUrl = generateVerificationUrl(emailVerificationToken);
          await sendEmail({
            to: email,
            template_id: '3666105', // Welcome / Verification Template
            template_data: {
              first_name: first_name,
              last_name: last_name,
              confirm_url: verificationUrl,
            },
          });

          await NotificationService.createNotification({
            userId: user.id,
            title: 'Bienvenue sur la plateforme !',
            message: `Bonjour ${first_name} ${last_name}, votre compte a été créé avec succès. N'oubliez pas de vérifier votre email pour l'activer.`,
            type: 'SYSTEM_UPDATE',
          });
        } else {
          // User is pre-verified, send a simpler welcome notification
          await NotificationService.createNotification({
            userId: user.id,
            title: 'Bienvenue sur la plateforme !',
            message: `Bonjour ${first_name} ${last_name}, votre compte a été créé avec succès et est déjà activé.`,
            type: 'SYSTEM_UPDATE',
          });
        }
      } catch (emailError) {
        logger.error(
          "Erreur lors de l'envoi de l'email de bienvenue:",
          ...sanitizeLogArgs(emailError),
        );
      }

      // Log data modification
      if (authReq.user) {
        await logDataModification(authReq.user.id, req, 'User', user.id, 'create');
      }

      return NextResponse.json({ user, message: 'Compte créé avec succès.' });
    } catch (error) {
      logger.error('Error creating user:', ...sanitizeLogArgs(error));
      return NextResponse.json(
        { error: "Erreur lors de la création de l'utilisateur" },
        { status: 500 },
      );
    }
  });
}
