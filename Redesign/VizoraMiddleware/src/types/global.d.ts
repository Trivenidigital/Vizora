/**
 * Global type declarations for VizoraMiddleware
 */

import { Server } from 'socket.io';

declare global {
  namespace NodeJS {
    interface Global {
      io: Server;
    }
  }
  
  // For older Node.js versions
  var io: Server;
} 