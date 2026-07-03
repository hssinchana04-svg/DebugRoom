import { Server, Socket } from 'socket.io';
import { verifyToken } from './auth';
import prisma from './db';
import redisClient from './redis';

// Try to import node-pty safely
let pty: any;
try {
  pty = require('node-pty');
} catch (err) {
  console.warn('[Terminal] node-pty failed to load. Falling back to MockTerminal for cross-platform stability.', err);
}

// Interfaces
interface ActiveRoomState {
  ptyProcess: any;
  terminalBuffer: string[]; // Keep last 200 lines for new joiners
  recording: boolean;
  eventSequence: number;
}

// In-memory room manager for active PTYs and buffers
const activeRooms: Map<string, ActiveRoomState> = new Map();

// Mock Terminal to emulate a shell if node-pty fails to load
class MockTerminal {
  private callbacks: ((data: string) => void)[] = [];
  private currentInput = '';
  private currentDir = 'C:\\Users\\developer\\workspace';

  constructor() {
    // Print initial banner
    setTimeout(() => {
      this.emitOutput('\r\n\x1b[36mWelcome to DebugRoom Fallback Shell (node-pty mock mode)!\x1b[0m\r\n');
      this.emitOutput('\x1b[33mType "help" for a list of available command simulations.\x1b[0m\r\n\r\n');
      this.prompt();
    }, 100);
  }

  public onData(cb: (data: string) => void) {
    this.callbacks.push(cb);
  }

  public write(data: string) {
    // Convert incoming data to string
    const input = data.toString();

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (char === '\r') { // Enter
        this.emitOutput('\r\n');
        this.executeCommand(this.currentInput.trim());
        this.currentInput = '';
      } else if (char === '\x7f' || char === '\x08') { // Backspace
        if (this.currentInput.length > 0) {
          this.currentInput = this.currentInput.slice(0, -1);
          this.emitOutput('\b \b'); // erase character on screen
        }
      } else if (char.charCodeAt(0) < 32 && char !== '\n') {
        // Ignore other control characters for simplicity
      } else {
        this.currentInput += char;
        this.emitOutput(char);
      }
    }
  }

  public resize(cols: number, rows: number) {
    // No-op for mock
  }

  public kill() {
    this.callbacks = [];
  }

  private emitOutput(data: string) {
    this.callbacks.forEach(cb => cb(data));
  }

  private prompt() {
    this.emitOutput(`\r\n\x1b[32m${this.currentDir}\x1b[0m\r\n$ `);
  }

  private executeCommand(cmd: string) {
    const parts = cmd.split(' ');
    const command = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (!command) {
      this.prompt();
      return;
    }

    switch (command) {
      case 'help':
        this.emitOutput('Available command simulations:\r\n');
        this.emitOutput('  help               Show this manual\r\n');
        this.emitOutput('  clear              Clear the terminal screen\r\n');
        this.emitOutput('  pwd                Print current directory\r\n');
        this.emitOutput('  ls                 List workspace files\r\n');
        this.emitOutput('  node index.js      Execute index.js code snapshot\r\n');
        this.emitOutput('  env                Show system variables\r\n');
        this.emitOutput('  curl <url>         Simulate a web fetch request\r\n');
        break;
      case 'clear':
        this.emitOutput('\x1b[2J\x1b[H'); // ANSI code to clear screen
        break;
      case 'pwd':
        this.emitOutput(`${this.currentDir}\r\n`);
        break;
      case 'ls':
        this.emitOutput('Mode                LastWriteTime         Length Name\r\n');
        this.emitOutput('----                -------------         ------ ----\r\n');
        this.emitOutput('-a---        13-Jun-2026  09:50 AM             94 index.js\r\n');
        this.emitOutput('-a---        13-Jun-2026  09:52 AM            421 package.json\r\n');
        break;
      case 'node':
        if (arg === 'index.js') {
          this.emitOutput('\x1b[33mRunning index.js...\x1b[0m\r\n');
          this.emitOutput('Hello, world!\r\n');
          this.emitOutput('\x1b[32mProcess finished with exit code 0\x1b[0m\r\n');
        } else {
          this.emitOutput(`Error: Cannot find module '${arg}'\r\n`);
        }
        break;
      case 'env':
        this.emitOutput('PORT=4000\r\n');
        this.emitOutput('NODE_ENV=development\r\n');
        this.emitOutput('SHELL=DebugRoom_Mock_Terminal\r\n');
        break;
      case 'curl':
        this.emitOutput(`Fetching ${arg || 'http://localhost'}...\r\n`);
        this.emitOutput('HTTP/1.1 200 OK\r\n');
        this.emitOutput('Content-Type: application/json\r\n\r\n');
        this.emitOutput('{"status":"online", "message":"Welcome to DebugRoom!"}\r\n');
        break;
      default:
        this.emitOutput(`'${command}' is not recognized as an internal or external command,\r\n`);
        this.emitOutput('operable program or batch file. Type "help" for a list of commands.\r\n');
    }
    this.prompt();
  }
}

// Log an event for replay session records
async function logSessionEvent(roomId: string, type: string, data: any) {
  try {
    const roomState = activeRooms.get(roomId);
    if (!roomState || !roomState.recording) return;

    roomState.eventSequence++;
    await prisma.sessionEvent.create({
      data: {
        roomId,
        type,
        data: JSON.stringify(data),
        sequence: roomState.eventSequence
      }
    });
  } catch (error) {
    console.error('[SessionEventStore] Error logging session event:', error);
  }
}

export function setupSocket(server: any) {
  const io = new Server(server, {
    cors: {
      origin: '*', // Allow all for local dev
      methods: ['GET', 'POST']
    }
  });

  // Authenticate socket on handshake
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication failed: Token missing'));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error('Authentication failed: Token invalid'));
      }

      // Store user info in socket properties
      socket.data = {
        userId: decoded.id,
        username: decoded.username,
        isGuest: decoded.isGuest
      };

      next();
    } catch (err) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    const username = socket.data.username;
    let currentRoomId: string | null = null;
    let currentRoomSlug: string | null = null;

    console.log(`[Socket] User connected: ${username} (${userId})`);

    // Handle joining a room
    socket.on('room:join', async ({ slug }: { slug: string }) => {
      try {
        const room = await prisma.room.findUnique({
          where: { slug }
        });

        if (!room) {
          socket.emit('error', 'Room not found');
          return;
        }

        currentRoomId = room.id;
        currentRoomSlug = slug;

        socket.join(`room:${slug}`);
        console.log(`[Socket] ${username} joined room: room:${slug}`);

        // Update database participant status
        await prisma.roomParticipant.upsert({
          where: {
            roomId_userId: {
              roomId: room.id,
              userId: userId
            }
          },
          update: { isOnline: true, leftAt: null },
          create: {
            roomId: room.id,
            userId: userId,
            isOnline: true
          }
        });

        // Store user presence in Redis
        await redisClient.hSet(`room:${slug}:presence`, userId, JSON.stringify({
          userId,
          username,
          isGuest: socket.data.isGuest,
          joinedAt: new Date().toISOString()
        }));

        // Log join presence event for replay
        await logSessionEvent(room.id, 'presence', {
          action: 'join',
          userId,
          username
        });

        // Fetch other active participants
        const rawParticipants = await redisClient.hGetAll(`room:${slug}:presence`);
        const onlineParticipants = Object.values(rawParticipants).map(v => JSON.parse(v as string));

        // Notify room of presence update
        io.to(`room:${slug}`).emit('room:participants-update', onlineParticipants);

        // Initialize Room PTY terminal process if not active
        if (!activeRooms.has(room.id)) {
          let ptyProcess: any;
          if (pty) {
            try {
              // Spawn real terminal process
              const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
              ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: process.cwd(),
                env: process.env
              });
              console.log(`[Terminal] Spawned real terminal PTY (${shell}) for room ${slug}`);
            } catch (err) {
              console.error('[Terminal] Failed to spawn PTY, falling back to mock shell.', err);
              ptyProcess = new MockTerminal();
            }
          } else {
            ptyProcess = new MockTerminal();
          }

          const roomState: ActiveRoomState = {
            ptyProcess,
            terminalBuffer: [],
            recording: true, // Default to recording sessions so they are replayable
            eventSequence: 0
          };

          activeRooms.set(room.id, roomState);

          // Pipe terminal output to socket room
          ptyProcess.onData((data: string) => {
            // Log in buffer (keep last 200 outputs for new connect syncs)
            roomState.terminalBuffer.push(data);
            if (roomState.terminalBuffer.length > 200) {
              roomState.terminalBuffer.shift();
            }

            // Stream output to all participants
            io.to(`room:${slug}`).emit('terminal:output', data);

            // Log event for replay
            logSessionEvent(room.id, 'terminal_output', { output: data });
          });
        }

        const roomState = activeRooms.get(room.id)!;

        // Send historical terminal buffer to syncing user
        socket.emit('terminal:sync-buffer', roomState.terminalBuffer.join(''));

        // Load files snapshots and send to the user
        const snapshots = await prisma.codeSnapshot.findMany({
          where: { roomId: room.id }
        });
        socket.emit('editor:sync-files', snapshots);

      } catch (error) {
        console.error('[Socket] Join room error:', error);
        socket.emit('error', 'Failed to join collaboration room');
      }
    });

    // Handle terminal input keystrokes
    socket.on('terminal:input', (data: string) => {
      if (!currentRoomId) return;
      const roomState = activeRooms.get(currentRoomId);
      if (roomState && roomState.ptyProcess) {
        roomState.ptyProcess.write(data);
        // Record terminal inputs
        logSessionEvent(currentRoomId, 'terminal_input', { input: data });
      }
    });

    // Handle terminal resizing
    socket.on('terminal:resize', ({ cols, rows }: { cols: number, rows: number }) => {
      if (!currentRoomId) return;
      const roomState = activeRooms.get(currentRoomId);
      if (roomState && roomState.ptyProcess) {
        try {
          roomState.ptyProcess.resize(cols, rows);
        } catch (e) {
          // Ignore resize errors for mock shell
        }
      }
    });

    // Handle real-time code editor changes
    socket.on('editor:change', ({ filePath, changes }: { filePath: string, changes: any }) => {
      if (!currentRoomSlug || !currentRoomId) return;
      
      // Broadcast change to other sockets in room
      socket.to(`room:${currentRoomSlug}`).emit('editor:change', {
        filePath,
        changes,
        senderId: userId
      });

      // Record editor changes for replay
      logSessionEvent(currentRoomId, 'editor_change', { filePath, changes });
    });

    // Handle editor cursor position syncing
    socket.on('editor:cursor', ({ filePath, cursor }: { filePath: string, cursor: { lineNumber: number, column: number } }) => {
      if (!currentRoomSlug) return;
      socket.to(`room:${currentRoomSlug}`).emit('editor:cursor', {
        filePath,
        userId,
        username,
        cursor
      });
    });

    // Handle real-time inline annotations/comments syncing
    socket.on('annotation:create', (annotation: any) => {
      if (!currentRoomSlug || !currentRoomId) return;
      socket.to(`room:${currentRoomSlug}`).emit('annotation:create', annotation);
      
      // Log event for replay
      logSessionEvent(currentRoomId, 'annotation', { action: 'create', annotation });
    });

    socket.on('annotation:delete', ({ id }: { id: string }) => {
      if (!currentRoomSlug || !currentRoomId) return;
      socket.to(`room:${currentRoomSlug}`).emit('annotation:delete', { id });

      // Log event for replay
      logSessionEvent(currentRoomId, 'annotation', { action: 'delete', id });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`[Socket] User disconnected: ${username}`);
      if (currentRoomSlug && currentRoomId) {
        try {
          // Remove from Redis presence
          await redisClient.hDel(`room:${currentRoomSlug}:presence`, userId);

          // Update database participant status
          await prisma.roomParticipant.update({
            where: {
              roomId_userId: {
                roomId: currentRoomId,
                userId: userId
              }
            },
            data: { isOnline: false, leftAt: new Date() }
          });

          // Log leave presence event for replay
          await logSessionEvent(currentRoomId, 'presence', {
            action: 'leave',
            userId,
            username
          });

          // Get updated participants list
          const rawParticipants = await redisClient.hGetAll(`room:${currentRoomSlug}:presence`);
          const onlineParticipants = Object.values(rawParticipants).map(v => JSON.parse(v as string));

          // Notify room of presence update
          io.to(`room:${currentRoomSlug}`).emit('room:participants-update', onlineParticipants);

          // If no users are left in the room, cleanup PTY terminal process
          if (onlineParticipants.length === 0) {
            const roomState = activeRooms.get(currentRoomId);
            if (roomState) {
              if (roomState.ptyProcess) {
                roomState.ptyProcess.kill();
              }
              activeRooms.delete(currentRoomId);
              console.log(`[Terminal] Cleanup terminal shell process for empty room: ${currentRoomSlug}`);
            }
          }
        } catch (error) {
          console.error('[Socket] Disconnect cleanup error:', error);
        }
      }
    });
  });
}
