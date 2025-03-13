import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupPairingServer } from './pairingServer.js';

const PORT = process.env.PORT || 3001;

// Create HTTP server
const httpServer = createServer((req, res) => {
  // Basic route handling
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('Server is running');
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

// Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "https://vizora.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Setup pairing functionality
setupPairingServer(io);

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
