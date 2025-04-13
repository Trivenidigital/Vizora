/**
 * Content API Server
 * 
 * A simplified server that ONLY implements the content API endpoints
 * to ensure proper JSON responses.
 */

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3003;

// CORS configuration
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

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Main content endpoint
app.get('/api/content', (req, res) => {
  console.log('GET /api/content endpoint called', req.query);
  
  // Get pagination and filter parameters
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '20');
  const folderId = req.query.folder || null;
  
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
  
  // Send response with correct format
  const response = {
    content: mockContent,
    pagination: {
      page,
      limit,
      total: 100,
      pages: Math.ceil(100 / limit)
    }
  };
  
  console.log(`Sending ${mockContent.length} content items`);
  res.json(response);
});

// Content by ID endpoint
app.get('/api/content/:id', (req, res) => {
  console.log(`GET /api/content/${req.params.id} endpoint called`);
  
  // Generate a single content item
  const content = {
    id: req.params.id,
    title: `Content ${req.params.id}`,
    description: `Description for content ${req.params.id}`,
    type: 'image',
    url: `https://example.com/content/${req.params.id}`,
    thumbnail: `https://picsum.photos/id/1/300/200`,
    status: 'active',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    folder: null,
    size: 1024 * 1024 * 2
  };
  
  console.log(`Sending content ${req.params.id}`);
  res.json(content);
});

// Folder content endpoint
app.get('/api/folders/:id/content', (req, res) => {
  console.log(`GET /api/folders/${req.params.id}/content endpoint called`, req.query);
  
  // Get pagination parameters
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '20');
  
  // Generate mock content items for this folder
  const mockContent = Array(Math.min(limit, 5)).fill().map((_, index) => ({
    id: `folder-${req.params.id}-content-${index + 1}`,
    title: `Content in folder ${req.params.id} #${index + 1}`,
    description: `This is content item ${index + 1} in folder ${req.params.id}`,
    type: ['image', 'video', 'document'][index % 3],
    url: `https://example.com/folders/${req.params.id}/content/${index + 1}`,
    thumbnail: `https://picsum.photos/id/${index + 10}/300/200`,
    status: 'active',
    createdAt: new Date(Date.now() - (86400000 * index)).toISOString(),
    updatedAt: new Date().toISOString(),
    folder: req.params.id,
    size: Math.floor(Math.random() * 1000000)
  }));
  
  // Send response with correct format
  const response = {
    content: mockContent,
    pagination: {
      page,
      limit,
      total: 20,
      pages: Math.ceil(20 / limit)
    }
  };
  
  console.log(`Sending ${mockContent.length} content items for folder ${req.params.id}`);
  res.json(response);
});

// Redirects for non-prefixed routes
app.get('/content', (req, res) => {
  console.log('GET /content endpoint called - redirecting to /api/content');
  res.redirect(`/api/content?${new URLSearchParams(req.query).toString()}`);
});

app.get('/content/:id', (req, res) => {
  console.log(`GET /content/${req.params.id} endpoint called - redirecting to /api/content/${req.params.id}`);
  res.redirect(`/api/content/${req.params.id}`);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test page endpoint
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

// 404 handler - must be after all other routes
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Content API server running on http://localhost:${PORT}`);
  console.log(`Test endpoints:`);
  console.log(`- http://localhost:${PORT}/api/content`);
  console.log(`- http://localhost:${PORT}/api/content/content-1`);
  console.log(`- http://localhost:${PORT}/api/folders/folder-1/content`);
  console.log(`- http://localhost:${PORT}/test-content (HTML test page)`);
}); 