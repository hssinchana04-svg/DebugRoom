import { Router, Response } from 'express';
import prisma from '../db';
import { authMiddleware, AuthRequest } from '../auth';
import crypto from 'crypto';

const router = Router();

// Helper to generate a friendly, short unique room slug
function generateSlug(): string {
  return crypto.randomBytes(4).toString('hex'); // 8 character hex string
}

// Create a new room
router.post('/', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const hostId = req.user!.id;
    let slug = generateSlug();
    
    // Check if slug is unique
    let existingRoom = await prisma.room.findUnique({ where: { slug } });
    while (existingRoom) {
      slug = generateSlug();
      existingRoom = await prisma.room.findUnique({ where: { slug } });
    }

    const room = await prisma.room.create({
      data: {
        name,
        slug,
        hostId
      },
      include: {
        host: {
          select: { id: true, username: true }
        }
      }
    });

    // Automatically create index.js snapshot file as a starter file for the room
    await prisma.codeSnapshot.create({
      data: {
        roomId: room.id,
        filePath: 'index.js',
        content: `// Welcome to DebugRoom!\n// Collaborate on code here.\n\nconsole.log("Hello, world!");\n`
      }
    });

    return res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get room details by shareable slug
router.get('/:slug', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const room = await prisma.room.findUnique({
      where: { slug },
      include: {
        host: {
          select: { id: true, username: true }
        },
        participants: {
          include: {
            user: { select: { id: true, username: true, isGuest: true } }
          }
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    return res.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    return res.status(500).json({ error: 'Failed to fetch room details' });
  }
});

// Fetch code snapshots (files) in the room
router.get('/:slug/snapshots', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const room = await prisma.room.findUnique({ where: { slug } });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const snapshots = await prisma.codeSnapshot.findMany({
      where: { roomId: room.id }
    });

    return res.json(snapshots);
  } catch (error) {
    console.error('Fetch snapshots error:', error);
    return res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Update or create a file snapshot (called periodically or when closing files)
router.post('/:slug/snapshots', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { filePath, content } = req.body;
    
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'filePath and content are required' });
    }

    const room = await prisma.room.findUnique({ where: { slug } });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const snapshot = await prisma.codeSnapshot.upsert({
      where: {
        roomId_filePath: {
          roomId: room.id,
          filePath
        }
      },
      update: { content },
      create: {
        roomId: room.id,
        filePath,
        content
      }
    });

    return res.json(snapshot);
  } catch (error) {
    console.error('Upsert snapshot error:', error);
    return res.status(500).json({ error: 'Failed to save file snapshot' });
  }
});

export default router;
