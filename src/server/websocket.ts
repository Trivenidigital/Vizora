import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import express from 'express';
import helmet from 'helmet';
import crypto from 'crypto';

const app = express();

const csp = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: ["'self'", "ws:", "wss:", "http://localhost:3000", "http://localhost:3003"],
    imgSrc: ["'self'", "data:", "https:"],
    fontSrc: ["'self'", "data:"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    sandbox: ['allow-forms', 'allow-scripts', 'allow-same-origin']
  },
  reportOnly: false
};

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: csp.directives
  }
})); 