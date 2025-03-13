// Serverless function for pairing
import { Server } from 'socket.io';
import crypto from 'crypto';

// In-memory storage for pairing sessions (will reset on cold starts)
let sessions = new Map();

// Clean up expired sessions periodically
const cleanupExpiredSessions = () => {
  const now = new Date();
  
  for (const [code, session] of sessions.entries()) {
    if (now > new Date(session.expiresAt)) {
      sessions.delete(code);
    }
  }
};

// Create a new pairing session
const createSession = () => {
  // Generate a random 6-character alphanumeric code
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  
  // Create session with 10-minute expiration
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  
  const session = {
    id: crypto.randomUUID(),
    code,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'pending'
  };
  
  sessions.set(code, session);
  
  return session;
};

// Get a session by its code
const getSession = (code) => {
  const session = sessions.get(code);
  if (!session) return null;
  
  // Check if expired
  if (new Date() > new Date(session.expiresAt)) {
    session.status = 'expired';
  }
  
  return session;
};

// Update a session with device information when paired
const pairDevice = (code, deviceInfo) => {
  const session = sessions.get(code);
  if (!session) return null;
  
  // Check if expired
  if (new Date() > new Date(session.expiresAt)) {
    session.status = 'expired';
    return session;
  }
  
  // Update session with device info and mark as paired
  session.deviceInfo = deviceInfo;
  session.status = 'paired';
  
  return session;
};

export default function handler(req, res) {
  // Run cleanup on each request
  cleanupExpiredSessions();
  
  // Handle different HTTP methods
  if (req.method === 'POST') {
    const { action, code, deviceInfo } = req.body || {};
    
    switch (action) {
      case 'createSession':
        const session = createSession();
        return res.status(200).json({ success: true, session });
        
      case 'checkStatus':
        if (!code) {
          return res.status(400).json({ success: false, error: 'No code provided' });
        }
        
        const existingSession = getSession(code);
        if (existingSession) {
          return res.status(200).json({ success: true, session: existingSession });
        } else {
          return res.status(404).json({ success: false, error: 'Invalid or expired code' });
        }
        
      case 'pairDevice':
        if (!code || !deviceInfo) {
          return res.status(400).json({ success: false, error: 'Missing code or device info' });
        }
        
        const updatedSession = pairDevice(code, deviceInfo);
        if (updatedSession) {
          return res.status(200).json({ success: true, session: updatedSession });
        } else {
          return res.status(404).json({ success: false, error: 'Invalid or expired code' });
        }
        
      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
  } else {
    // Handle GET requests (for status checks)
    return res.status(200).json({ status: 'Pairing API is running' });
  }
}
