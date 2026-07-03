import { Router, Response } from 'express';
import prisma from '../db';
import { authMiddleware, AuthRequest } from '../auth';

const router = Router();

// Fetch annotations for a room
router.get('/:slug', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const room = await prisma.room.findUnique({ where: { slug } });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const annotations = await prisma.annotation.findMany({
      where: { roomId: room.id },
      include: {
        user: {
          select: { id: true, username: true, isGuest: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.json(annotations);
  } catch (error) {
    console.error('Fetch annotations error:', error);
    return res.status(500).json({ error: 'Failed to fetch annotations' });
  }
});

// Create annotation
router.post('/:slug', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { filePath, lineNumber, content } = req.body;

    if (!filePath || !lineNumber || !content) {
      return res.status(400).json({ error: 'filePath, lineNumber, and content are required' });
    }

    const room = await prisma.room.findUnique({ where: { slug } });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const annotation = await prisma.annotation.create({
      data: {
        roomId: room.id,
        filePath,
        lineNumber: parseInt(lineNumber, 10),
        userId: req.user!.id,
        content
      },
      include: {
        user: {
          select: { id: true, username: true, isGuest: true }
        }
      }
    });

    return res.status(201).json(annotation);
  } catch (error) {
    console.error('Create annotation error:', error);
    return res.status(500).json({ error: 'Failed to create annotation' });
  }
});

// Delete annotation
router.delete('/:slug/:id', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check ownership
    const annotation = await prisma.annotation.findUnique({ where: { id } });
    if (!annotation) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    if (annotation.userId !== req.user!.id) {
      return res.status(403).json({ error: 'You are not authorized to delete this annotation' });
    }

    await prisma.annotation.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete annotation error:', error);
    return res.status(500).json({ error: 'Failed to delete annotation' });
  }
});

export default router;
