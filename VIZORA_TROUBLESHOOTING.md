# Vizora Platform: Socket.IO Connection Troubleshooting

## Common Issues Identified

After a comprehensive review of the Vizora platform codebase, we've identified several issues that may cause Socket.IO connection and CORS problems:

1. **Multiple Socket.IO Server Instances**: 
   - The platform has multiple Socket.IO servers running on different ports (3000, 3001, 3003)
   - Having multiple servers can cause event handling confusion and connection issues

2. **CORS Configuration Mismatch**:
   - Server allows specific origins but client might be connecting from a different origin
   - Credentials handling must be consistent between client and server

3. **Transport Configuration**:
   - Ordering of transports (`websocket`, `polling`) must be consistent between client and server
   - Some servers use only `websocket` while others use both transports in different orders

4. **Duplicate Codebases**:
   - Having multiple projects (Vizora, VizoraMiddleware, VizoraTV, VizoraWeb) with overlapping functionality
   - Possible conflicts between different Socket.IO instances in these projects

## How to Fix Socket.IO Connection Issues

### Step 1: Run Only Essential Services

1. Use the updated `start-vizora.bat` script which:
   - Starts the middleware first (port 3003)
   - Waits for middleware to initialize
   - Then starts the web app (port 3001)
   - Does NOT start any other Socket.IO servers

2. If you need to start services manually:
   ```bash
   # Start middleware first (in one terminal)
   cd VizoraMiddleware
   npm run dev

   # Wait for middleware to start (5+ seconds)

   # Start web app (in another terminal)
   npm run dev:web
   ```

### Step 2: Verify Correct Socket.IO Configuration

1. **Client (Web App) Configuration**:
   - Must connect to `http://localhost:3003` (the middleware server)
   - Transport order should be `['websocket', 'polling']`
   - `withCredentials` must be `true`
   - Headers should include `X-Client-Type: 'controller'`

2. **Server (Middleware) Configuration**:
   - Should run on port 3003 only
   - CORS should allow origins including `http://localhost:3001`
   - Transport order should be `['websocket', 'polling']`

### Step 3: Monitor for Issues

Check the console logs for these specific issues:

1. **CORS Errors**:
   - Look for "Access-Control-Allow-Origin" errors
   - Ensure origin is explicitly allowed in server CORS config (not wildcard with credentials)

2. **Event Reception Issues**:
   - Check if `Received socket event` logs appear in the middleware console
   - If events aren't being received, there could be a transport or connection issue

3. **Registration Timeout**:
   - If you see "Controller registration timed out" errors
   - Check if the server is receiving the `register_controller` event

## Advanced Troubleshooting

If issues persist, try these steps one by one:

1. **Clear Browser Cache and Cookies**:
   - Socket.IO can cache connection issues
   - Try in incognito/private browser mode

2. **Disable Other Socket.IO Servers**:
   - Check for any Node.js processes running on ports 3000-3003
   - Kill any conflicting processes:
     ```
     # On Windows
     netstat -ano | findstr :3003
     taskkill /PID <PID> /F

     # On macOS/Linux
     lsof -i :3003
     kill -9 <PID>
     ```

3. **Simplify the Setup**:
   - Temporarily run only the middleware server
   - Test connection with a simple HTML page:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Socket.IO Test</title>
  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
</head>
<body>
  <div id="status">Disconnected</div>
  <button id="connect">Connect</button>
  <div id="logs"></div>

  <script>
    const connectBtn = document.getElementById('connect');
    const statusDiv = document.getElementById('status');
    const logsDiv = document.getElementById('logs');
    let socket;

    function log(msg) {
      const entry = document.createElement('div');
      entry.textContent = `${new Date().toISOString()}: ${msg}`;
      logsDiv.prepend(entry);
    }

    connectBtn.addEventListener('click', () => {
      if (socket && socket.connected) {
        socket.disconnect();
        return;
      }

      statusDiv.textContent = 'Connecting...';
      
      socket = io('http://localhost:3003', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        forceNew: true,
        withCredentials: true,
        auth: {
          clientType: 'controller'
        },
        extraHeaders: {
          'X-Client-Type': 'controller'
        }
      });

      socket.on('connect', () => {
        statusDiv.textContent = 'Connected';
        log(`Connected with ID: ${socket.id}`);
        
        // Register as controller
        socket.emit('register_controller', (response) => {
          log(`Callback response: ${JSON.stringify(response)}`);
        });
      });

      socket.on('controller_registered', (data) => {
        log(`Registered as controller: ${JSON.stringify(data)}`);
      });

      socket.on('connect_error', (error) => {
        statusDiv.textContent = 'Connection Error';
        log(`Connection error: ${error.message}`);
      });

      socket.on('disconnect', (reason) => {
        statusDiv.textContent = 'Disconnected';
        log(`Disconnected: ${reason}`);
      });

      socket.onAny((event, ...args) => {
        log(`Event: ${event}, Data: ${JSON.stringify(args)}`);
      });
    });
  </script>
</body>
</html>
```

## Project Structure Recommendations

For a long-term solution, consider these changes to the project structure:

1. **Consolidate Socket.IO Servers**:
   - Keep only the VizoraMiddleware Socket.IO server
   - Remove or disable any other Socket.IO servers

2. **Adopt a Monorepo Structure**:
   - Clearly separate concerns between packages
   - Use a tool like Lerna, Nx, or Turborepo to manage the monorepo

3. **Standardize Configuration**:
   - Create a shared configuration package
   - Ensure all services use the same Socket.IO configuration 