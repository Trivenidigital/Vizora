/**
 * Direct fix for Vizora Middleware display endpoint issues
 * 
 * This script will:
 * 1. Stop the current server on port 3003 if running
 * 2. Apply targeted fixes to the display endpoints
 * 3. Start a clean server instance with proper error handling
 */

// For Windows PowerShell compatibility
const { execSync } = require('child_process');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = 3003;

// Try to stop any existing server
try {
  console.log('Checking for existing server processes...');
  const processData = execSync('netstat -ano | findstr :3003').toString();
  const pidMatches = processData.match(/LISTENING\s+(\d+)/);
  
  if (pidMatches && pidMatches[1]) {
    const pid = pidMatches[1];
    console.log(`Found process ${pid} using port 3003, attempting to stop it...`);
    execSync(`taskkill /F /PID ${pid}`);
    console.log(`Successfully stopped process ${pid}`);
  }
} catch (error) {
  console.log('No existing server process found or unable to stop it.');
}

// Enhanced error handling
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

// CORS configuration - MUST be before any route handlers
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Enhanced request logger for debugging
app.use((req, res, next) => {
  console.log('\n=== REQUEST DETAILS ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Original URL: ${req.originalUrl}`);
  console.log(`Base URL: ${req.baseUrl}`);
  console.log(`Host: ${req.headers.host}`);
  console.log(`Origin: ${req.headers.origin}`);
  console.log(`User-Agent: ${req.headers['user-agent']}`);
  console.log(`Referer: ${req.headers.referer}`);
  console.log('======================\n');
  next();
});

// Log all incoming requests with CORS headers
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  
  // Add CORS headers manually for every response as a fallback
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  
  // Response monitoring
  const originalSend = res.send;
  res.send = function(body) {
    console.log(`[RESPONSE] ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`);
    return originalSend.call(this, body);
  };
  
  next();
});

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} - ${err.message}`);
  console.error(err.stack);
  
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).json({
    success: false,
    message: 'Server error',
    error: err.message
  });
};

// FIXED: /api/displays endpoint with proper error handling
app.get('/api/displays', (req, res) => {
  console.log('[GET] /api/displays endpoint hit');
  
  try {
    const responseData = {
      success: true,
      data: [] // Empty array
    };
    
    // Using res.json() ensures proper content-type and content-length handling
    res.status(200).json(responseData);
    console.log('[SUCCESS] /api/displays response sent successfully');
  } catch (error) {
    console.error('[ERROR] /api/displays error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// FIXED: /api/displays-old endpoint
app.get('/api/displays-old', (req, res) => {
  console.log('[GET] /api/displays-old hit');
  
  try {
    // Using res.json() ensures proper content-type and content-length handling
    res.status(200).json({
      success: true,
      data: [] // Empty array
    });
    console.log('[SUCCESS] /api/displays-old response sent successfully');
  } catch (error) {
    console.error('[ERROR] /api/displays-old error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// FIXED: /displays endpoint
app.get('/displays', (req, res) => {
  console.log('[GET] /displays hit');
  
  try {
    // Using res.json() ensures proper content-type and content-length handling
    res.status(200).json({
      success: true,
      data: [] // Empty array
    });
    console.log('[SUCCESS] /displays response sent successfully');
  } catch (error) {
    console.error('[ERROR] /displays error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// FIXED: /api/folders endpoint - handle both /api/folders and /folders paths
// Register debug middleware for folders routes
app.use(['/api/folders', '/folders'], (req, res, next) => {
  console.log(`[DEBUG] Folder route requested: ${req.method} ${req.originalUrl}`);
  console.log('Request headers:', req.headers);
  next();
});

// Register the main handlers
app.get('/api/folders', handleFoldersRequest);
app.get('/folders', handleFoldersRequest);

function handleFoldersRequest(req, res) {
  console.log(`[GET] ${req.originalUrl} endpoint hit`);
  console.log(`Request URL: ${req.url}, Original URL: ${req.originalUrl}`);
  
  try {
    // Mock folders data
    const foldersData = [
      {
        id: 'folder-1',
        name: 'Marketing',
        description: 'Marketing materials and assets',
        path: '/Marketing',
        isRoot: true,
        itemCount: 12,
        createdAt: '2023-01-15T10:30:00Z',
        updatedAt: '2023-06-22T14:15:00Z'
      },
      {
        id: 'folder-2',
        name: 'Product Photos',
        description: 'Product photography and renders',
        path: '/Product Photos',
        isRoot: true,
        itemCount: 35,
        createdAt: '2023-02-20T09:45:00Z',
        updatedAt: '2023-07-10T11:30:00Z'
      },
      {
        id: 'folder-3',
        name: 'Company Events',
        description: 'Photos and videos from company events',
        path: '/Company Events',
        isRoot: true,
        itemCount: 48,
        createdAt: '2023-03-05T16:20:00Z',
        updatedAt: '2023-06-30T13:45:00Z'
      },
      {
        id: 'folder-4',
        name: 'Presentations',
        description: 'Slide decks and presentation materials',
        path: '/Presentations',
        isRoot: true,
        itemCount: 17,
        createdAt: '2023-04-12T08:15:00Z',
        updatedAt: '2023-07-05T10:20:00Z'
      }
    ];
    
    // Return success response with folders data, match the expected format from folderService.ts
    const responseData = {
      success: true,
      data: foldersData
    };
    
    console.log(`[RESPONSE] Sending ${foldersData.length} folders with status 200`);
    
    // Using res.json() ensures proper content-type and content-length handling
    res.status(200).json(responseData);
    
    console.log(`[SUCCESS] ${req.originalUrl} response sent successfully`);
  } catch (error) {
    console.error(`[ERROR] ${req.originalUrl} error:`, error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Simple auth middleware
const authMiddleware = (req, res, next) => {
  // Extract token from Authorization header or from cookie
  let token = null;
  
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  // If no token in header, check cookie
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required',
      statusCode: 401
    });
  }
  
  try {
    // For real app, you would verify the JWT here
    // Mock user
    req.user = {
      id: '1',
      email: 'admin@vizora.ai',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin'
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token',
      statusCode: 401
    });
  }
};

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  console.log('[POST] /api/auth/login endpoint hit');
  
  // Validate email and password
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Email and password are required',
      statusCode: 400
    });
  }
  
  // Mock user
  const user = {
    id: '1',
    email: 'admin@vizora.ai',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin'
  };
  
  // Mock JWT token
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJhZG1pbkB2aXpvcmEuYWkiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE2NzY5MTcyMDAsImV4cCI6MTY3NzAwMzYwMH0.vqHlp5rCmEj9K8RM2UgM5GZ60nfQZA8OMY1GyVCmQFU';
  
  // Set token as a cookie
  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    sameSite: 'lax'
  });
  
  // Return success response
  res.json({
    success: true,
    message: 'Login successful',
    user,
    token
  });
});

// Current user endpoint
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'User data retrieved successfully',
    user: req.user
  });
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// OPTIONS handler for CORS preflight requests
app.options('*', (req, res) => {
  console.log(`[OPTIONS] Preflight request for ${req.originalUrl}`);
  res.status(204).end();
});

// Add folder creation endpoint
app.post('/api/folders', (req, res) => {
  console.log('[POST] /api/folders endpoint hit', req.body);
  
  try {
    const { name, description = '', parentFolder = null } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Folder name is required'
      });
    }
    
    // Generate a unique ID for the new folder
    const folderId = `folder-${Date.now()}`;
    
    // Create a new folder object
    const newFolder = {
      id: folderId,
      name,
      description,
      path: parentFolder ? `/${name}` : `/${name}`,
      isRoot: !parentFolder,
      parentFolder,
      itemCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Return success response with the created folder
    res.status(201).json({
      success: true,
      folder: newFolder
    });
    
    console.log('[SUCCESS] Folder created successfully:', newFolder.name);
  } catch (error) {
    console.error('[ERROR] Create folder error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Add folder by ID endpoint
app.get('/api/folders/:folderId', (req, res) => {
  console.log(`[GET] /api/folders/${req.params.folderId} endpoint hit`);
  
  try {
    const { folderId } = req.params;
    
    // Mock folder data based on ID
    const folder = {
      id: folderId,
      name: `Folder ${folderId}`,
      description: 'Retrieved folder by ID',
      path: `/Folder ${folderId}`,
      isRoot: true,
      itemCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Return success response with the folder
    res.status(200).json({
      success: true,
      folder
    });
    
    console.log(`[SUCCESS] Folder ${folderId} retrieved successfully`);
  } catch (error) {
    console.error(`[ERROR] Get folder error:`, error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Add folder update endpoint
app.patch('/api/folders/:folderId', (req, res) => {
  console.log(`[PATCH] /api/folders/${req.params.folderId} endpoint hit`, req.body);
  
  try {
    const { folderId } = req.params;
    const { name, description } = req.body;
    
    // Mock updated folder
    const updatedFolder = {
      id: folderId,
      name: name || `Folder ${folderId}`,
      description: description || 'Updated folder description',
      path: `/${name || `Folder ${folderId}`}`,
      isRoot: true,
      itemCount: 0,
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: new Date().toISOString()
    };
    
    // Return success response with the updated folder
    res.status(200).json({
      success: true,
      folder: updatedFolder
    });
    
    console.log(`[SUCCESS] Folder ${folderId} updated successfully`);
  } catch (error) {
    console.error(`[ERROR] Update folder error:`, error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Add folder delete endpoint
app.delete('/api/folders/:folderId', (req, res) => {
  console.log(`[DELETE] /api/folders/${req.params.folderId} endpoint hit`);
  
  try {
    const { folderId } = req.params;
    
    // Return success response
    res.status(200).json({
      success: true,
      message: `Folder ${folderId} deleted successfully`
    });
    
    console.log(`[SUCCESS] Folder ${folderId} deleted successfully`);
  } catch (error) {
    console.error(`[ERROR] Delete folder error:`, error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Add folder content endpoint
app.get('/api/folders/:folderId/content', (req, res) => {
  console.log(`[GET] /api/folders/${req.params.folderId}/content endpoint hit`, req.query);
  
  try {
    const { folderId } = req.params;
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    
    // Generate mock content for this folder
    const mockContent = Array(Math.min(limit, 5)).fill().map((_, index) => ({
      id: `folder-${folderId}-content-${index + 1}`,
      title: `Folder ${folderId} Content ${index + 1}`,
      description: `Content item ${index + 1} in folder ${folderId}`,
      type: ['image', 'video', 'document'][index % 3],
      url: `https://example.com/folders/${folderId}/content/${index + 1}`,
      thumbnail: `https://picsum.photos/id/${(parseInt(folderId.replace(/\D/g, '')) || 1) * 10 + index}/300/200`,
      status: 'active',
      createdAt: new Date(Date.now() - (86400000 * index)).toISOString(),
      updatedAt: new Date().toISOString(),
      folder: folderId,
      size: Math.floor(Math.random() * 1000000)
    }));
    
    // Return response with pagination
    const response = {
      content: mockContent,
      pagination: {
        page,
        limit,
        total: 20, // Mock total for folder
        pages: Math.ceil(20 / limit)
      }
    };
    
    console.log(`[SUCCESS] Returning ${mockContent.length} content items for folder ${folderId}`);
    res.status(200).json(response);
  } catch (error) {
    console.error(`[ERROR] /api/folders/${req.params.folderId}/content error:`, error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// FOLDER ROUTE HANDLING - comprehensive approach to catch all possible path patterns
// Register base folder routes
app.get('/api/folders', handleFoldersRequest);
app.get('/folders', handleFoldersRequest);
app.get('/api/api/folders', handleFoldersRequest); // Double prefix case
app.get('/api/folders/', handleFoldersRequest); // Trailing slash
app.get('/folders/', handleFoldersRequest); // Trailing slash

// Handle the case where Express might be configured with a sub-app path
app.use('/api', express.Router().get('/folders', (req, res) => {
  console.log('[SUB-APP] Folders route via /api sub-app');
  handleFoldersRequest(req, res);
}));

// Handle specific folder routes
app.get('/api/folders/:folderId', handleFolderByIdRequest);
app.get('/folders/:folderId', handleFolderByIdRequest);

// Catch wildcard folder routes with regex matching
app.get(/\/.*\/folders$/, (req, res) => {
  console.log(`[REGEX-MATCH] Folders route at ${req.originalUrl}`);
  handleFoldersRequest(req, res);
});

// Add content endpoints for proper handling
app.get('/api/content', (req, res) => {
  console.log('[GET] /api/content endpoint hit', req.query);
  
  try {
    // Check for folder parameter
    const folderId = req.query.folder || null;
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '20');
    
    console.log(`Fetching content with filter: folderId=${folderId}, page=${page}, limit=${limit}`);
    
    // Generate mock content items
    const mockContent = Array(Math.min(limit, 10)).fill().map((_, index) => ({
      id: `content-${index + 1}`,
      title: `Content Item ${index + 1}`,
      description: `Description for content item ${index + 1}`,
      type: ['image', 'video', 'document'][index % 3],
      url: `https://example.com/content/${index + 1}`,
      thumbnail: `https://picsum.photos/id/${index + 1}/300/200`,
      status: 'active',
      createdAt: new Date(Date.now() - (86400000 * index)).toISOString(),
      updatedAt: new Date().toISOString(),
      folder: folderId,
      size: Math.floor(Math.random() * 1000000)
    }));
    
    // Return response with pagination
    const response = {
      content: mockContent,
      pagination: {
        page,
        limit,
        total: 100, // Mock total
        pages: Math.ceil(100 / limit)
      }
    };
    
    // Log response info
    console.log(`[SUCCESS] Returning ${mockContent.length} content items with status 200`);
    
    // Send JSON response
    res.status(200).json(response);
  } catch (error) {
    console.error('[ERROR] /api/content error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Handle content by ID endpoint
app.get('/api/content/:contentId', (req, res) => {
  const { contentId } = req.params;
  console.log(`[GET] /api/content/${contentId} endpoint hit`);
  
  try {
    // Generate mock content item
    const content = {
      id: contentId,
      title: `Content ${contentId}`,
      description: `Description for content ${contentId}`,
      type: ['image', 'video', 'document'][parseInt(contentId.replace(/\D/g, '')) % 3 || 0],
      url: `https://example.com/content/${contentId}`,
      thumbnail: `https://picsum.photos/id/${parseInt(contentId.replace(/\D/g, '')) || 1}/300/200`,
      status: 'active',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      folder: null,
      size: Math.floor(Math.random() * 1000000)
    };
    
    // Return response
    console.log(`[SUCCESS] Returning content ${contentId}`);
    res.status(200).json(content);
  } catch (error) {
    console.error(`[ERROR] /api/content/${req.params.contentId} error:`, error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Additional route handlers for non-prefixed content paths
app.get('/content', (req, res) => {
  console.log('[GET] /content endpoint hit (redirecting to /api/content)');
  return res.redirect('/api/content' + (req.query ? `?${new URLSearchParams(req.query).toString()}` : ''));
});

app.get('/content/:contentId', (req, res) => {
  console.log('[GET] /content/:contentId endpoint hit (redirecting to /api/content/:contentId)');
  return res.redirect(`/api/content/${req.params.contentId}`);
});

// Handle double-prefixed API routes
app.get('/api/api/content', (req, res) => {
  console.log('[GET] /api/api/content endpoint hit (redirecting to /api/content)');
  return res.redirect('/api/content' + (req.query ? `?${new URLSearchParams(req.query).toString()}` : ''));
});

app.get('/api/api/content/:contentId', (req, res) => {
  console.log('[GET] /api/api/content/:contentId endpoint hit (redirecting to /api/content/:contentId)');
  return res.redirect(`/api/content/${req.params.contentId}`);
});

// Add a diagnostic HTML page for testing
app.get('/test-folders', (req, res) => {
  res.set('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Folder API Test</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow: auto; }
          button { padding: 8px 16px; background: #4CAF50; color: white; border: none; cursor: pointer; margin-right: 10px; }
          .success { color: green; }
          .error { color: red; }
        </style>
      </head>
      <body>
        <h1>Folder API Test</h1>
        <div>
          <button onclick="testGetFolders()">Test GET /api/folders</button>
          <button onclick="testGetFoldersNoPrefix()">Test GET /folders</button>
        </div>
        <h2>Response:</h2>
        <pre id="response">Click a button to test the API...</pre>
        
        <script>
          async function testGetFolders() {
            document.getElementById('response').innerHTML = 'Loading...';
            try {
              const response = await fetch('/api/folders', {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                },
                credentials: 'include'
              });
              
              const data = await response.json();
              document.getElementById('response').innerHTML = 
                '<span class="success">SUCCESS!</span>\\n' + 
                'Status: ' + response.status + '\\n\\n' +
                JSON.stringify(data, null, 2);
            } catch (error) {
              document.getElementById('response').innerHTML = 
                '<span class="error">ERROR</span>\\n' + error.toString();
            }
          }
          
          async function testGetFoldersNoPrefix() {
            document.getElementById('response').innerHTML = 'Loading...';
            try {
              const response = await fetch('/folders', {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                },
                credentials: 'include'
              });
              
              const data = await response.json();
              document.getElementById('response').innerHTML = 
                '<span class="success">SUCCESS!</span>\\n' + 
                'Status: ' + response.status + '\\n\\n' +
                JSON.stringify(data, null, 2);
            } catch (error) {
              document.getElementById('response').innerHTML = 
                '<span class="error">ERROR</span>\\n' + error.toString();
            }
          }
        </script>
      </body>
    </html>
  `);
});

// Add a diagnostic HTML page for testing content endpoints
app.get('/test-content', (req, res) => {
  res.set('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Content API Test</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow: auto; }
          button { padding: 8px 16px; background: #4CAF50; color: white; border: none; cursor: pointer; margin-right: 10px; margin-bottom: 10px; }
          input, select { padding: 8px; margin-right: 10px; }
          .success { color: green; }
          .error { color: red; }
          .form-group { margin-bottom: 15px; }
          label { display: inline-block; width: 100px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Content API Test</h1>
        
        <div class="form-group">
          <button onclick="testGetContent()">Test GET /api/content</button>
          <button onclick="testGetContentNoPrefix()">Test GET /content</button>
        </div>
        
        <div class="form-group">
          <label for="contentId">Content ID:</label>
          <input type="text" id="contentId" value="content-1" />
          <button onclick="testGetContentById()">Test GET /api/content/:id</button>
        </div>
        
        <div class="form-group">
          <label for="folderId">Folder ID:</label>
          <input type="text" id="folderId" value="folder-1" />
          <button onclick="testGetFolderContent()">Test GET /api/folders/:id/content</button>
        </div>
        
        <h2>Response:</h2>
        <pre id="response">Click a button to test the API...</pre>
        
        <script>
          async function testGetContent() {
            document.getElementById('response').innerHTML = 'Loading...';
            try {
              const response = await fetch('/api/content', {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                },
                credentials: 'include'
              });
              
              if (response.headers.get('content-type')?.includes('application/json')) {
                const data = await response.json();
                document.getElementById('response').innerHTML = 
                  '<span class="success">SUCCESS!</span>\\n' + 
                  'Status: ' + response.status + '\\n' +
                  'Content-Type: ' + response.headers.get('content-type') + '\\n\\n' +
                  JSON.stringify(data, null, 2);
              } else {
                const text = await response.text();
                document.getElementById('response').innerHTML = 
                  '<span class="error">ERROR: Response is not JSON</span>\\n' + 
                  'Status: ' + response.status + '\\n' +
                  'Content-Type: ' + response.headers.get('content-type') + '\\n\\n' +
                  text.substring(0, 1000) + (text.length > 1000 ? '...' : '');
              }
            } catch (error) {
              document.getElementById('response').innerHTML = 
                '<span class="error">ERROR</span>\\n' + error.toString();
            }
          }
          
          async function testGetContentNoPrefix() {
            document.getElementById('response').innerHTML = 'Loading...';
            try {
              const response = await fetch('/content', {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                },
                credentials: 'include'
              });
              
              if (response.headers.get('content-type')?.includes('application/json')) {
                const data = await response.json();
                document.getElementById('response').innerHTML = 
                  '<span class="success">SUCCESS!</span>\\n' + 
                  'Status: ' + response.status + '\\n' +
                  'Content-Type: ' + response.headers.get('content-type') + '\\n\\n' +
                  JSON.stringify(data, null, 2);
              } else {
                const text = await response.text();
                document.getElementById('response').innerHTML = 
                  '<span class="error">ERROR: Response is not JSON</span>\\n' + 
                  'Status: ' + response.status + '\\n' +
                  'Content-Type: ' + response.headers.get('content-type') + '\\n\\n' +
                  text.substring(0, 1000) + (text.length > 1000 ? '...' : '');
              }
            } catch (error) {
              document.getElementById('response').innerHTML = 
                '<span class="error">ERROR</span>\\n' + error.toString();
            }
          }
          
          async function testGetContentById() {
            document.getElementById('response').innerHTML = 'Loading...';
            const contentId = document.getElementById('contentId').value;
            
            try {
              const response = await fetch('/api/content/' + contentId, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                },
                credentials: 'include'
              });
              
              if (response.headers.get('content-type')?.includes('application/json')) {
                const data = await response.json();
                document.getElementById('response').innerHTML = 
                  '<span class="success">SUCCESS!</span>\\n' + 
                  'Status: ' + response.status + '\\n' +
                  'Content-Type: ' + response.headers.get('content-type') + '\\n\\n' +
                  JSON.stringify(data, null, 2);
              } else {
                const text = await response.text();
                document.getElementById('response').innerHTML = 
                  '<span class="error">ERROR: Response is not JSON</span>\\n' + 
                  'Status: ' + response.status + '\\n' +
                  'Content-Type: ' + response.headers.get('content-type') + '\\n\\n' +
                  text.substring(0, 1000) + (text.length > 1000 ? '...' : '');
              }
            } catch (error) {
              document.getElementById('response').innerHTML = 
                '<span class="error">ERROR</span>\\n' + error.toString();
            }
          }
          
          async function testGetFolderContent() {
            document.getElementById('response').innerHTML = 'Loading...';
            const folderId = document.getElementById('folderId').value;
            
            try {
              const response = await fetch('/api/folders/' + folderId + '/content', {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                },
                credentials: 'include'
              });
              
              if (response.headers.get('content-type')?.includes('application/json')) {
                const data = await response.json();
                document.getElementById('response').innerHTML = 
                  '<span class="success">SUCCESS!</span>\\n' + 
                  'Status: ' + response.status + '\\n' +
                  'Content-Type: ' + response.headers.get('content-type') + '\\n\\n' +
                  JSON.stringify(data, null, 2);
              } else {
                const text = await response.text();
                document.getElementById('response').innerHTML = 
                  '<span class="error">ERROR: Response is not JSON</span>\\n' + 
                  'Status: ' + response.status + '\\n' +
                  'Content-Type: ' + response.headers.get('content-type') + '\\n\\n' +
                  text.substring(0, 1000) + (text.length > 1000 ? '...' : '');
              }
            } catch (error) {
              document.getElementById('response').innerHTML = 
                '<span class="error">ERROR</span>\\n' + error.toString();
            }
          }
        </script>
      </body>
    </html>
  `);
});

// Start the server
const server = app.listen(PORT, () => {
  console.log('\n\n===================================');
  console.log(`Fixed server running on http://localhost:${PORT}`);
  console.log(`Test displays endpoint: http://localhost:${PORT}/api/displays`);
  console.log(`Test content endpoint: http://localhost:${PORT}/api/content`);
  console.log(`Test folders endpoint: http://localhost:${PORT}/api/folders`);
  console.log(`Test diagnostic tools:`);
  console.log(`  - http://localhost:${PORT}/test-folders`);
  console.log(`  - http://localhost:${PORT}/test-content`);
  console.log('===================================\n\n');
});

// 404 handler - MUST be after all route definitions
app.use((req, res) => {
  console.log(`[404] No route handler found for: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Error handler - MUST be after the 404 handler
app.use(errorHandler);

// Handler for folder by ID
function handleFolderByIdRequest(req, res) {
  const folderId = req.params.folderId;
  console.log(`[GET] Folder by ID: ${folderId} from ${req.originalUrl}`);
  
  try {
    // Mock folder data
    const folder = {
      id: folderId,
      name: `Folder ${folderId}`,
      description: 'Retrieved folder by ID',
      path: `/Folder ${folderId}`,
      isRoot: true,
      itemCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Return success response
    res.status(200).json({
      success: true,
      folder
    });
    
    console.log(`[SUCCESS] Folder ${folderId} retrieved successfully`);
  } catch (error) {
    console.error(`[ERROR] Get folder error:`, error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
} 