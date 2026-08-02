import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Handle uncaught errors to prevent node-pty/ConPTY cleanup crashes on Windows
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException] Prevented server crash:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection] Prevented server crash:', reason);
});

// Import routes
import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import recordingRoutes from './routes/recordings';
import annotationRoutes from './routes/annotations';

// Import socket setup
import { setupSocket } from './socket';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors({
  origin: '*', // Allow all origins for dev simplicity
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Basic API check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/recordings', recordingRoutes);
app.use('/api/annotations', annotationRoutes);

// Setup WebSockets
setupSocket(server);

// Serve frontend in production (same-origin, single URL)
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  // Catch-all: send index.html for all non-API routes (React Router SPA)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(path.join(frontendDist, 'index.html'));
    }
  });
}

// Start Server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  DebugRoom Backend Server running on port ${PORT}`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`===============================================`);
});
