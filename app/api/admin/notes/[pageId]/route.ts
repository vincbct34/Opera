import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthenticatedRequest } from '@/app/api/middleware';
import prisma from '@/lib/middleware/prismaConfig';

// GET /api/admin/notes/[pageId] - Get admin notes for a specific page
export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) => {
  return await requireAdmin(req, async () => {
    try {
      const { pageId } = await params;

      if (!pageId) {
        return NextResponse.json({ success: false, error: 'Page ID requis' }, { status: 400 });
      }

      const note = await prisma.adminNote.findUnique({
        where: { page_id: pageId },
        select: {
          id: true,
          page_id: true,
          content: true,
          updated_at: true,
          created_at: true,
          author: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        note: note || null,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Erreur lors de la récupération de la note : ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        },
        { status: 500 },
      );
    }
  });
};

// PUT /api/admin/notes/[pageId] - Create or update admin notes for a specific page
export const PUT = async (
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) => {
  return await requireAdmin(req, async (authReq: AuthenticatedRequest) => {
    try {
      const { pageId } = await params;
      const { content } = await req.json();

      if (!pageId) {
        return NextResponse.json({ success: false, error: 'Page ID requis' }, { status: 400 });
      }

      if (typeof content !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Le contenu doit être une chaîne de caractères' },
          { status: 400 },
        );
      }

      if (authReq.user === undefined) {
        return NextResponse.json(
          { success: false, error: 'Utilisateur non authentifié' },
          { status: 401 },
        );
      }
      const userId = authReq.user.id;

      // Upsert the note
      const note = await prisma.adminNote.upsert({
        where: { page_id: pageId },
        create: {
          page_id: pageId,
          content,
          author_id: userId,
        },
        update: {
          content,
          author_id: userId, // Update author to whoever last modified
        },
        select: {
          id: true,
          page_id: true,
          content: true,
          updated_at: true,
          created_at: true,
          author: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        note,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Erreur lors de la sauvegarde de la note : ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        },
        { status: 500 },
      );
    }
  });
};
