import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';

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

// Start Server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  DebugRoom Backend Server running on port ${PORT}`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`===============================================`);
});
