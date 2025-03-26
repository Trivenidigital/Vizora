# Vizora Platform

This is the main repository for the Vizora platform, which enables web-based control of TV displays.

## Project Structure

The project consists of multiple components:

- **VizoraMiddleware**: Socket.IO server providing real-time communication (port 3003)
- **Web App**: React-based web application for controlling displays (port 3001)
- **VizoraTV**: TV display application 

## 🚨 Important: Socket.IO Server Configuration 🚨

To avoid connection issues, please note that **only one Socket.IO server** should be running - the one in the VizoraMiddleware folder (port 3003).

The other Socket.IO instances have been disabled to prevent conflicts.

## Setup Instructions

1. Install dependencies in all projects:
   ```bash
   # Main project
   npm install
   
   # Middleware 
   cd VizoraMiddleware
   npm install
   cd ..
   
   # TV App
   cd VizoraTV
   npm install
   cd ..
   ```

2. Run the application using the provided start script:
   ```bash
   # Use the automatic startup script (recommended)
   npm run start:all
   
   # Or start manually in this order:
   # 1. First start the middleware
   npm run start:middleware
   
   # 2. Wait 5 seconds, then start the web app
   npm run start:web
   ```

3. Access the applications:
   - Web App: http://localhost:3001
   - Middleware API: http://localhost:3003

## Troubleshooting

If you encounter Socket.IO connection issues:

1. Check that only the middleware Socket.IO server is running (on port 3003)
2. Ensure no other Node.js processes are using ports 3000-3003
3. Look for CORS errors in the browser console
4. Try the test page at `socket-test.html` to verify connectivity
5. See `VIZORA_TROUBLESHOOTING.md` for detailed instructions

## Development Notes

- The startup order is important: middleware must be started before the web app
- Socket.IO connections from web app should connect to `http://localhost:3003`
- All Socket.IO code has been consolidated in the VizoraMiddleware project

## Overview
Vizora is a digital signage platform that allows you to manage content across multiple displays.

## Running the Web Application

### Development Mode
To run the web application in development mode on port 3001 (to avoid conflicts with VizoraTV):

```bash
# Install dependencies
npm install

# Start the web app on port 3001
npm run dev:web
```

The web application will be available at http://localhost:3001

### Running the Server
To run the backend server:

```bash
# In a separate terminal
npm run server
```

The server will run on port 3002.

### Running VizoraMiddleware
To run the middleware server:

```bash
# Navigate to the middleware directory
cd VizoraMiddleware

# Install dependencies
npm install

# Start the middleware server
npm run dev
```

The middleware server will run on port 3003.

## Features
- Dashboard for monitoring displays
- Content management
- Playlist creation
- Scheduling
- Analytics
- Display pairing and management

## Technologies
- React
- Vite
- Express
- Socket.IO
- Redis
- TypeScript

## License

[MIT](LICENSE)
