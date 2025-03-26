# VizoraTV Display Application

This application serves as the display client for the Vizora platform. It connects to the Vizora middleware server, registers as a display, and shows a QR code for pairing with the Vizora web application.

## Features

- Automatic connection to middleware server
- Display registration and pairing
- QR code generation for easy pairing
- Persistent registration data across page reloads
- Fallback standalone QR code page

## Deployment Instructions

### Prerequisites

- Node.js 16+ and npm
- Vizora Middleware server running and accessible

### Configuration

1. Create a `.env` file in the root directory with the following variables:

```
VITE_WEBSOCKET_URL=http://your-middleware-server:3003
```

Replace `your-middleware-server` with the IP address or hostname of your middleware server.

### Quick Deployment (Recommended)

We've added simplified deployment scripts to make the process easier:

1. Install dependencies:

```bash
npm install
```

2. Run the deployment script:

```bash
npm run deploy
```

This will:
- Build the application (bypassing TypeScript errors)
- Serve the built files locally for testing
- Provide instructions for deploying to your production server

### Manual Building for Production

If you prefer to build manually:

1. For a quick build that bypasses TypeScript errors (recommended for deployment):

```bash
npm run quick-build
```

2. For a full build with type checking (may fail due to test files):

```bash
npm run build
```

3. The built application will be in the `dist` directory.

### Deployment Options

#### Option 1: Serve with a static file server

You can serve the built application with any static file server:

```bash
# Using serve (install globally first: npm install -g serve)
serve -s dist
```

#### Option 2: Deploy to a web server

Copy the contents of the `dist` directory to your web server's document root.

#### Option 3: Deploy to a CDN

Upload the contents of the `dist` directory to your CDN.

### Troubleshooting

If you encounter issues with the display registration:

1. Check the browser console for error messages
2. Verify that the middleware server is running and accessible
3. Try the debug page at `/debug-registration.html`
4. Try the standalone QR page at `/standalone-qr.html`
5. Clear browser cache and local storage

## Development

### Running Locally

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production with type checking
- `npm run quick-build` - Build for production bypassing type checking
- `npm run deploy` - Build and serve for deployment
- `npm run preview` - Preview the production build locally

## License

Proprietary - All rights reserved

## Production Deployment and Server URL Configuration

When deploying the Vizora TV application to production, you need to properly configure the WebSocket server URLs to ensure connectivity between the TV app and the middleware server.

### Environment Variables

The following environment variables can be set to control how the TV app connects to the middleware:

- `VITE_WEBSOCKET_URL`: Explicitly set the middleware server URL (e.g., `https://middleware.example.com`)
- `VITE_MIDDLEWARE_PORT`: Set the port for the middleware server (default: `3003`)
- `VITE_ENVIRONMENT`: Set to `production` for production deployments

### Automatic URL Resolution

If `VITE_WEBSOCKET_URL` is not explicitly set, the application will automatically determine the server URL based on:

1. The current hostname (same domain deployment)
2. The environment settings
3. The configured port

This automatic resolution works well when:
- Both the TV app and middleware are deployed behind the same domain or subdomain
- The middleware is accessible via the configured port

### Deployment Scenarios

#### 1. Same Domain Deployment

If both the TV app and middleware server are deployed on the same domain:

```
TV App: https://vizora.example.com
Middleware: https://vizora.example.com:3003
```

The app will automatically connect to the middleware on the same domain.

#### 2. Subdomain Deployment

If using separate subdomains:

```
TV App: https://display.example.com
Middleware: https://middleware.example.com
```

Set `VITE_WEBSOCKET_URL=https://middleware.example.com` in your deployment.

#### 3. Different Domain Deployment

If deploying on completely different domains:

```
TV App: https://display.example.org
Middleware: https://middleware.example.com
```

Set `VITE_WEBSOCKET_URL=https://middleware.example.com` in your deployment.

### CORS Configuration

For cross-origin deployments, ensure the middleware CORS settings include all domains where the TV app is hosted:

1. Set the `ALLOWED_ORIGINS` environment variable in the middleware server:

```
ALLOWED_ORIGINS=https://display.example.com,https://vizora.example.org
```

2. For debugging CORS issues, temporarily enable CORS debugging:

```
DEBUG_CORS=true
```

### Production Build

To build the application for production:

```bash
# Set environment variables in .env file
echo "VITE_ENVIRONMENT=production" > .env
echo "VITE_WEBSOCKET_URL=https://middleware.example.com" >> .env

# Build the application
npm run build
```

The built files will be in the `dist` directory, ready for deployment. 