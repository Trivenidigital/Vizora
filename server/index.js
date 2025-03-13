import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { NetworkScanner } from './networkScanner.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Store active pairing sessions
const pairingSessions = new Map();

// Generate a random 6-digit code
function generatePairingCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Clean up expired sessions
function cleanupExpiredSessions() {
  const now = new Date();
  for (const [id, session] of pairingSessions.entries()) {
    if (session.expiresAt < now) {
      pairingSessions.delete(id);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupExpiredSessions, 60000);

// Middleware
app.use(cors());
app.use(express.json());

// Initialize network scanner
const networkScanner = new NetworkScanner();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('startScan', () => {
    networkScanner.startScan();
  });

  socket.on('stopScan', () => {
    networkScanner.stopScan();
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    networkScanner.stopScan();
  });
});

// API Routes
app.post('/api/pairing/start', (req, res) => {
  const { useQRCode, manualIP } = req.body;
  
  const session = {
    id: Math.random().toString(36).substring(7),
    status: 'pending',
    pairingCode: generatePairingCode(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes expiry
  };

  pairingSessions.set(session.id, session);
  res.json(session);
});

app.get('/api/pairing/status/:sessionId', (req, res) => {
  const session = pairingSessions.get(req.params.sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (session.expiresAt < new Date()) {
    session.status = 'expired';
    return res.json(session);
  }

  res.json(session);
});

app.post('/api/pairing/pair', (req, res) => {
  const { sessionId, code } = req.body;
  const session = pairingSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (session.expiresAt < new Date()) {
    session.status = 'expired';
    return res.json(session);
  }

  if (session.pairingCode !== code) {
    return res.status(400).json({ error: 'Invalid pairing code' });
  }

  // Get device info from network scanner
  const device = networkScanner.getLastDiscoveredDevice();
  if (device) {
    session.deviceName = device.name;
    session.deviceIP = device.ip;
    session.status = 'paired';
  }

  res.json(session);
});

// Start server
const PORT = process.env.PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
