import { Router, Response } from 'express';
import prisma from '../db';
import { authMiddleware, AuthRequest } from '../auth';

const router = Router();

// Retrieve all events for replaying a session
router.get('/:slug/events', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const room = await prisma.room.findUnique({ where: { slug } });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const events = await prisma.sessionEvent.findMany({
      where: { roomId: room.id },
      orderBy: { sequence: 'asc' }
    });

    // Parse the data field for all events
    const parsedEvents = events.map(e => ({
      ...e,
      data: JSON.parse(e.data)
    }));

    return res.json(parsedEvents);
  } catch (error) {
    console.error('Fetch session events error:', error);
    return res.status(500).json({ error: 'Failed to retrieve session recording events' });
  }
});

export default router;
