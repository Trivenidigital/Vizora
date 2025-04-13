const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { errorHandler, ApiError } = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');
const mongoose = require('mongoose');

// Import routes
const displayRoutes = require('./routes/display.routes');
const contentRoutes = require('./routes/content.routes');
const statusRoutes = require('./routes/status');

// Replace problematic auth routes import
console.log('Importing direct auth routes...');
const authRoutes = require('./routes/direct-auth');
console.log('Auth routes successfully imported:', typeof authRoutes);

const systemRoutes = require('./routes/system.routes');
const deviceRoutes = require('./routes/device.routes');
const folderRoutes = require('./routes/folders');
const userRoutes = require('./routes/user.routes');

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS setup - Development configuration with specific allowed origins
const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));

// Add CORS headers to all responses in case the middleware doesn't catch everything
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // In development, we can be more permissive
    res.header('Access-Control-Allow-Origin', origin || 'http://localhost:3000');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// Security headers - Configured to allow CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
  strictTransportSecurity: false,
  referrerPolicy: { policy: "no-referrer-when-downgrade" }
}));

// Compression
app.use(compression());

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve thumbnail files
app.use('/thumbnails', express.static(path.join(__dirname, '../public/thumbnails')));

// Logging
app.use(morgan('dev'));

// MongoDB connection handling with fallback
mongoose.set('strictQuery', false);
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  // Prevent app crash - the app will continue to run but DB-dependent routes will return errors
  console.warn('⚠️ MongoDB connection failed, app will run in degraded mode with limited functionality');
});

// Connect to MongoDB in the background
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 20000, // Increase timeout for server selection to 20s
    connectTimeoutMS: 20000, // Increase connection timeout to 20s
  })
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });
} else {
  console.warn('⚠️ No MONGODB_URI provided, database features will not work');
}

// Routes
console.log('Mounting routes...');
app.use('/api/auth', authRoutes);
app.use('/api/displays', displayRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/users', userRoutes);
app.use('/api', statusRoutes);

// Debug route - log all requests that made it to here
app.use('/api/*', (req, res, next) => {
  console.log(`⚠️ Unhandled API request: ${req.method} ${req.originalUrl}`);
  console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  console.log('🔑 Headers:', JSON.stringify({
    authorization: req.headers.authorization ? '[PRESENT]' : '[MISSING]',
    'content-type': req.headers['content-type'],
    'cookie': req.headers.cookie ? '[PRESENT]' : '[MISSING]'
  }, null, 2));
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket diagnostic API endpoint
app.get('/api/socket-diagnostic', (req, res) => {
  res.status(503).json({
    success: false,
    message: 'Socket service not initialized'
  });
});

// Socket diagnostic HTML page
app.get('/socket-diagnostic.html', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Vizora Socket Diagnostic</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .status { font-weight: bold; margin: 10px 0; color: red; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Vizora Socket.IO Diagnostic Tool</h1>
        <div class="status">Socket service not initialized</div>
      </div>
    </body>
    </html>
  `);
});

// 404 handler
app.use((req, res, next) => {
  const error = new ApiError(`Route not found: ${req.originalUrl}`, 404);
  next(error);
});

// Error handler
app.use(errorHandler);

// Ensure directories exist at startup
const contentService = require('./services/contentService');
contentService.ensureDirectoriesExist();

// Add health check route for root path
app.get('/', (req, res) => {
  res.status(200).send('Vizora Middleware: Root is healthy');
});

module.exports = { app }; 