import { Router, Response } from 'express';
import prisma from '../db';
import { generateToken, hashPassword, comparePassword, authMiddleware, AuthRequest } from '../auth';

const router = Router();

// Guest user endpoint (enables instant join without signup)
router.post('/guest', async (req, res) => {
  try {
    const { username } = req.body;
    
    // Fallback if no username provided
    const guestUsername = username || `guest_${Math.floor(1000 + Math.random() * 9000)}`;

    // Ensure uniqueness
    let finalUsername = guestUsername;
    let userExists = await prisma.user.findUnique({ where: { username: finalUsername } });
    let counter = 1;
    while (userExists) {
      finalUsername = `${guestUsername}_${counter}`;
      userExists = await prisma.user.findUnique({ where: { username: finalUsername } });
      counter++;
    }

    const user = await prisma.user.create({
      data: {
        username: finalUsername,
        isGuest: true
      }
    });

    const token = generateToken({ id: user.id, username: user.username, isGuest: user.isGuest });
    return res.status(201).json({ token, user: { id: user.id, username: user.username, isGuest: true } });
  } catch (error: any) {
    console.error('Guest login error:', error);
    return res.status(500).json({ error: 'Failed to create guest session' });
  }
});

// Normal Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if username exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          email ? { email } : {}
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        email: email || null,
        passwordHash,
        isGuest: false
      }
    });

    const token = generateToken({ id: user.id, username: user.username, isGuest: false });
    return res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email, isGuest: false } });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

// Normal Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = generateToken({ id: user.id, username: user.username, isGuest: user.isGuest });
    return res.json({ token, user: { id: user.id, username: user.username, email: user.email, isGuest: user.isGuest } });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

// Get profile
router.get('/me', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id }
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ id: user.id, username: user.username, email: user.email, isGuest: user.isGuest });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
