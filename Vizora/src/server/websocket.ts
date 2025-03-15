import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import express, { RequestHandler } from 'express';
import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import crypto from 'crypto';
import fetch from 'node-fetch';

// Add monitoring interfaces
interface ServerStats {
  startTime: Date;
  totalConnections: number;
  activeConnections: number;
  failedAttempts: number;
  lastError?: {
    message: string;
    timestamp: Date;
  };
  network: NetworkMetrics;
  errors: ErrorMetrics;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

interface SecurityMetrics {
  blockedIPs: Set<string>;
  suspiciousActivities: Map<string, number>;
  lastViolation?: {
    ip: string;
    reason: string;
    timestamp: Date;
  };
}

interface NetworkMetrics {
  bytesReceived: number;
  bytesSent: number;
  messageRate: number;
  lastMessageTimestamp: number;
  bandwidthUsage: {
    current: number;
    average: number;
    peak: number;
  };
}

interface ErrorMetrics {
  count: number;
  lastError?: {
    type: string;
    message: string;
    timestamp: Date;
    clientInfo?: {
      ip: string;
      userAgent: string;
    };
  };
}

interface GeoLocation {
  country: string;
  city: string;
  latitude: number;
  longitude: number;
}

const serverStats: ServerStats = {
  startTime: new Date(),
  totalConnections: 0,
  activeConnections: 0,
  failedAttempts: 0,
  network: {
    bytesReceived: 0,
    bytesSent: 0,
    messageRate: 0,
    lastMessageTimestamp: Date.now(),
    bandwidthUsage: {
      current: 0,
      average: 0,
      peak: 0
    }
  },
  errors: {
    count: 0,
    lastError: undefined
  },
  memoryUsage: {
    heapUsed: 0,
    heapTotal: 0,
    external: 0
  }
};

const securityMetrics: SecurityMetrics = {
  blockedIPs: new Set<string>(),
  suspiciousActivities: new Map<string, number>()
};

const app: Express = express();

// Enhanced security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-site" }
}));

// Enhanced rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return crypto.createHash('sha256')
      .update(ip + userAgent)
      .digest('hex');
  }
}));

const httpServer = new HttpServer(app);

let io: SocketIOServer | null = null;

// Initialize io before using it in middleware
const initializeMiddleware = () => {
  if (!io) return;
  
  io.use((socket: CustomSocket, next) => {
    console.log('Connection attempt:', {
      id: socket.id,
      address: socket.handshake.address,
      headers: socket.handshake.headers,
      timestamp: new Date().toISOString(),
      transport: socket.conn.transport.name
    });

    // Rest of middleware logic
    next();
  });
};

export function initializeWebSocketServer(httpServer: HttpServer) {
  if (io) {
    io.close();
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://10.5.0.2:5173',
        'http://172.16.0.11:5173',
        'http://172.31.64.1:5173'
      ],
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['X-Client-Type', 'Content-Type']
    },
    pingTimeout: 10000,
    pingInterval: 5000,
    transports: ['websocket'],
    connectTimeout: 10000,
    maxHttpBufferSize: 1e6,
    path: '/socket.io'
  });

  // Debug middleware for connection attempts
  io.use((socket: CustomSocket, next) => {
    console.log('Connection attempt:', {
      id: socket.id,
      address: socket.handshake.address,
      headers: socket.handshake.headers,
      timestamp: new Date().toISOString(),
      transport: socket.conn.transport.name
    });

    // Validate client type
    const clientType = socket.handshake.headers['x-client-type'];
    if (!clientType) {
      console.warn('Missing client type header:', {
        id: socket.id,
        headers: socket.handshake.headers
      });
    }

    // For development, skip auth validation
    next();
  });

  // Initialize middleware after io is created
  initializeMiddleware();

  // Connection event handler
  io.on('connection', async (socket: CustomSocket) => {
    const clientIp = socket.handshake.address;
    console.log('New connection from:', clientIp);

    // Increment connection metrics
    serverStats.totalConnections++;
    serverStats.activeConnections++;

    // Handle display registration
    socket.on('request-pairing-code', () => {
      const pairingCode = generatePairingCode();
      const displayId = generateDisplayId();
      
      activeDisplays.set(displayId, {
        pairingCode,
        displayId,
        socket,
        lastUpdated: new Date(),
        connectionAttempts: 0
      });
      
      pendingPairings.set(pairingCode, displayId);
      socket.emit('pairing-code', pairingCode);
      
      // Set timeout for pairing code
      setTimeout(() => {
        if (pendingPairings.has(pairingCode)) {
          pendingPairings.delete(pairingCode);
          socket.emit('pair-timeout', { pairingCode });
        }
      }, PAIRING_TIMEOUT);
    });

    // Handle pairing requests from web app
    socket.on('pair-request', async ({ pairingCode }) => {
      const displayId = pendingPairings.get(pairingCode);
      if (!displayId) {
        socket.emit('pair-failed', 'Invalid or expired pairing code');
        return;
      }

      const display = activeDisplays.get(displayId);
      if (!display) {
        socket.emit('pair-failed', 'Display not found');
        pendingPairings.delete(pairingCode);
        return;
      }

      // Successful pairing
      pendingPairings.delete(pairingCode);
      display.socket.emit('paired', displayId);
      socket.emit('pair-success', displayId);
    });

    // Handle content sending
    socket.on('send-content', ({ displayId, content }) => {
      const display = activeDisplays.get(displayId);
      if (!display) {
        socket.emit('error', 'Display not found');
        return;
      }

      display.socket.emit('content-update', content);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      serverStats.activeConnections--;

      // Clean up display if it was one
      const displayId = Array.from(activeDisplays.entries())
        .find(([_, info]) => info.socket.id === socket.id)?.[0];
      
      if (displayId) {
        const display = activeDisplays.get(displayId);
        if (display) {
          const pairingCode = display.pairingCode;
          activeDisplays.delete(displayId);
          pendingPairings.delete(pairingCode);
          io?.emit('display-disconnected', displayId);
        }
      }
    });
  });

  // Enhanced graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Initiating graceful shutdown...');
    
    if (io) {
      // Notify all connected clients
      io.emit('server-shutdown', { message: 'Server is shutting down' });

      // Close all connections gracefully
      io.close(() => {
        console.log('Socket.IO server closed');
        
        // Close HTTP server
        httpServer.close(() => {
          console.log('HTTP server closed');
          process.exit(0);
        });
      });
    }
  });

  return io;
}

// Update socket type definition
interface CustomSocket extends Socket {
  handshake: Socket['handshake'] & {
    address: string;
    headers: {
      'user-agent'?: string;
      origin?: string;
    };
  };
}

// Update DisplayInfo interface with proper socket type
interface DisplayInfo {
  pairingCode: string;
  displayId: string;
  socket: CustomSocket;
  lastUpdated: Date;
  connectionAttempts: number;
  lastError?: string;
}

const activeDisplays = new Map<string, DisplayInfo>();
const pendingPairings = new Map<string, string>();
const connectionAttempts = new Map<string, number>();

const PAIRING_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const MAX_CONNECTION_ATTEMPTS = 5;
const CONNECTION_RESET_TIME = 15 * 60 * 1000; // 15 minutes

// Clean up expired pairing codes and reset connection attempts
setInterval(() => {
  const now = new Date();
  
  // Clean up expired pairings
  activeDisplays.forEach((display, displayId) => {
    if (now.getTime() - display.lastUpdated.getTime() > PAIRING_TIMEOUT) {
      display.socket.emit('pair-timeout', { pairingCode: display.pairingCode });
      activeDisplays.delete(displayId);
      pendingPairings.delete(display.pairingCode);
    }
  });

  // Reset connection attempts after timeout
  connectionAttempts.forEach((attempts, ip) => {
    if (now.getTime() - attempts > CONNECTION_RESET_TIME) {
      connectionAttempts.delete(ip);
    }
  });
}, 60000);

// Add memory monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  serverStats.memoryUsage = {
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    external: memUsage.external
  };

  // Alert if memory usage is high
  if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
    console.warn('High memory usage detected:', {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      timestamp: new Date().toISOString()
    });
  }
}, 30000);

interface SecurityConfig {
  maxConnectionsPerIP: number;
  maxEventsPerMinute: number;
  maxPayloadSize: number;
  connectionTimeout: number;
  validationTimeout: number;
  bannedIPs: Set<string>;
  suspiciousPatterns: RegExp[];
  allowedOrigins: string[];
  allowedCountries: Set<string>;
  maxDistanceKm: number;
  trustedCertificates: Set<string>;
  referenceLocation: GeoLocation;
}

const securityConfig: SecurityConfig = {
  maxConnectionsPerIP: 5,
  maxEventsPerMinute: 60,
  maxPayloadSize: 10 * 1024 * 1024, // 10MB
  connectionTimeout: 30000, // 30 seconds
  validationTimeout: 5000, // 5 seconds
  bannedIPs: new Set<string>(),
  suspiciousPatterns: [
    /script/i,
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i
  ],
  allowedOrigins: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  allowedCountries: new Set(['US', 'CA', 'GB', 'DE', 'FR', 'JP']),
  maxDistanceKm: 5000,
  trustedCertificates: new Set([
    // Add your trusted certificate fingerprints here
    'sha256/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'sha256/YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY'
  ]),
  referenceLocation: {
    country: 'US',
    city: 'San Francisco',
    latitude: 37.7749,
    longitude: -122.4194
  }
};

// Update ConnectionManager with proper socket type
class ConnectionManager {
  private ipConnections: Map<string, number> = new Map();
  private eventCounts: Map<string, number> = new Map();
  private lastCleanup: number = Date.now();

  validateConnection(socket: CustomSocket): boolean {
    const ip = socket.handshake.address;
    const currentConnections = this.ipConnections.get(ip) || 0;

    if (securityConfig.bannedIPs.has(ip)) {
      return false;
    }

    if (currentConnections >= securityConfig.maxConnectionsPerIP) {
      return false;
    }

    this.ipConnections.set(ip, currentConnections + 1);
    return true;
  }

  validateEvent(socket: CustomSocket): boolean {
    const ip = socket.handshake.address;
    const count = this.eventCounts.get(ip) || 0;
    
    if (count >= securityConfig.maxEventsPerMinute) {
      return false;
    }

    this.eventCounts.set(ip, count + 1);
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup >= 60000) {
      this.eventCounts.clear();
      this.lastCleanup = now;
    }
  }

  removeConnection(socket: CustomSocket): void {
    const ip = socket.handshake.address;
    const count = this.ipConnections.get(ip) || 0;
    if (count > 0) {
      this.ipConnections.set(ip, count - 1);
    }
  }
}

const connectionManager = new ConnectionManager();

interface IPAPIResponse {
  country_code: string;
  city: string;
  latitude: number;
  longitude: number;
}

// Update certificate pinning middleware to return void
const certificatePinningMiddleware: RequestHandler = (req, res, next): void => {
  try {
    const socket = req.socket as unknown as { getPeerCertificate?: () => { fingerprint?: string } };
    const cert = socket.getPeerCertificate?.();
    
    if (cert?.fingerprint) {
      if (!securityConfig.trustedCertificates.has(cert.fingerprint)) {
        console.error('Invalid certificate:', {
          fingerprint: cert.fingerprint,
          ip: req.ip,
          timestamp: new Date().toISOString()
        });
        res.status(403).send('Invalid certificate');
        return;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

app.use(certificatePinningMiddleware);

// Enhanced IP validation with geolocation
async function validateIPLocation(ip: string): Promise<boolean> {
  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await response.json() as IPAPIResponse;
    
    // Check if country is allowed
    if (!securityConfig.allowedCountries.has(data.country_code)) {
      console.warn('Connection attempt from blocked country:', {
        ip,
        country: data.country_code,
        timestamp: new Date().toISOString()
      });
      return false;
    }

    // Calculate distance from reference location
    const distance = calculateDistance(
      data.latitude,
      data.longitude,
      securityConfig.referenceLocation.latitude,
      securityConfig.referenceLocation.longitude
    );

    if (distance > securityConfig.maxDistanceKm) {
      console.warn('Connection attempt from suspicious location:', {
        ip,
        distance,
        location: `${data.city}, ${data.country_code}`,
        timestamp: new Date().toISOString()
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to validate IP location:', {
      ip,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    return false;
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(value: number): number {
  return value * Math.PI / 180;
}

// Helper functions
function generatePairingCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateDisplayId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Start the server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

// Enhanced error handling for HTTP server
httpServer.on('error', (error: Error) => {
  console.error('HTTP Server error:', {
    error: error.message,
    timestamp: new Date().toISOString(),
    stats: serverStats
  });

  serverStats.lastError = {
    message: error.message,
    timestamp: new Date()
  };

  if ((error as any).code === 'EADDRINUSE') {
    console.log('Port in use, trying another one...');
    setTimeout(() => {
      httpServer.close();
      const newPort = parseInt(process.env.WS_PORT || '3000') + 1;
      process.env.WS_PORT = newPort.toString();
      httpServer.listen(newPort);
    }, 1000);
  }
});

// Enhanced health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    stats: {
      totalConnections: serverStats.totalConnections,
      activeConnections: serverStats.activeConnections,
      failedAttempts: serverStats.failedAttempts,
      errors: {
        count: serverStats.errors.count,
        lastError: serverStats.errors.lastError
      },
      network: serverStats.network,
      memoryUsage: serverStats.memoryUsage,
      security: {
        blockedIPs: Array.from(securityMetrics.blockedIPs),
        suspiciousActivities: Object.fromEntries(securityMetrics.suspiciousActivities)
      }
    }
  };

  // Check system health
  if (serverStats.errors.count > 1000 ||
      serverStats.memoryUsage.heapUsed / serverStats.memoryUsage.heapTotal > 0.9) {
    health.status = 'degraded';
  }

  res.json(health);
});

function validateConnectionSignature(signature: string, timestamp: number): boolean {
  if (!signature || !timestamp) return false;
  
  const now = Date.now();
  if (now - timestamp > securityConfig.validationTimeout) return false;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBSOCKET_SECRET || 'default-secret')
    .update(timestamp.toString())
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function validateContent(content: any): boolean {
  if (!content || typeof content !== 'object') return false;

  // Check for suspicious patterns in content
  const contentStr = JSON.stringify(content);
  for (const pattern of securityConfig.suspiciousPatterns) {
    if (pattern.test(contentStr)) return false;
  }

  // Validate content size
  if (Buffer.from(contentStr).length > securityConfig.maxPayloadSize) {
    return false;
  }

  return true;
}

// Periodic cleanup
setInterval(() => {
  connectionManager.cleanup();
}, 60000);

// Error tracking function
function trackError(error: Error, clientInfo?: { ip: string; userAgent: string }) {
  serverStats.errors.count++;
  serverStats.errors.lastError = {
    type: error.name || 'UnknownError',
    message: error.message,
    timestamp: new Date(),
    clientInfo
  };

  // Log the error for monitoring
  console.error('Error tracked:', {
    type: error.name,
    message: error.message,
    stack: error.stack,
    clientInfo,
    timestamp: new Date().toISOString()
  });
}

// Input validation function
function validateInput(data: any): boolean {
  if (!data || typeof data !== 'object') return false;

  // Check for suspicious patterns
  const jsonStr = JSON.stringify(data);
  return !securityConfig.suspiciousPatterns.some(pattern => pattern.test(jsonStr));
} 