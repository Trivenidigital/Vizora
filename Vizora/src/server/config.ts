export const config = {
  server: {
    port: process.env.PORT || 3000,
    wsPort: process.env.WS_PORT || 3001,
  },
  cors: {
    origin: [
      'http://localhost:5173',  // VizoraTV development
      'http://localhost:3001',  // Vizora web app development
      'http://10.5.0.2:5173',
      'http://172.16.0.11:5173',
      'http://172.31.64.1:5173'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  websocket: {
    pingTimeout: 10000,
    pingInterval: 5000,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  },
  security: {
    pairingCodeLength: 6,
    pairingCodeExpiry: 5 * 60 * 1000, // 5 minutes
    maxConnectionsPerIP: 5,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  }
}; 