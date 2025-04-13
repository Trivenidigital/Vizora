# Vizora WebSocket Connectivity Troubleshooting Guide

This document provides guidance on troubleshooting WebSocket connectivity issues across the Vizora platform components.

## Architecture Overview

The Vizora platform uses Socket.IO for real-time communication between:
- **VizoraMiddleware**: Central hub managing socket connections
- **VizoraWeb**: Admin interface that sends commands
- **VizoraTV**: Display unit that receives content updates

## Socket Diagnostic Tool

A diagnostic tool is available at:
```
http://localhost:3003/socket-diagnostic.html
```

This tool allows you to:
- Test socket connections with or without auth tokens
- View active connections and their status
- Send test messages through the socket server
- Check authentication errors

## API Endpoints for Diagnostics

- **Socket Stats**: `GET /api/socket-diagnostic`  
  Returns information about active socket connections

- **Server Status**: `GET /api/status`  
  Confirms the middleware server is running

- **HTTP Connectivity Test**: `GET /api/connectivity-test`  
  Tests HTTP connectivity and returns detailed connection information

## Common Issues and Solutions

### Authentication Token Issues

**Symptoms:**
- "Socket connection error: Invalid token"
- "token: undefined" errors in console
- Disconnections shortly after connecting

**Solutions:**
1. Check that authentication tokens are being correctly:
   - Retrieved from localStorage in VizoraWeb
   - Passed in connection options (`auth: { token: authToken }`)
   - Renewed when expired
   
2. Verify token validity:
   ```js
   const token = localStorage.getItem('auth_token');
   fetch('/api/verify-token', {
     headers: { 'Authorization': `Bearer ${token}` }
   });
   ```

### CORS Issues

**Symptoms:**
- "Access-Control-Allow-Origin" errors
- Socket connections fail from specific origins

**Solutions:**
1. Ensure the middleware server's CORS configuration includes all required origins:
   ```js
   const allowedOrigins = [
     'http://localhost:3000',  // VizoraWeb
     'http://localhost:3001',  // VizoraTV
     // Add additional development/production URLs
   ];
   ```

### Connection Issues

**Symptoms:**
- Socket remains in "connecting" state
- Frequent disconnections

**Solutions:**
1. Check network connectivity between services
2. Verify proper proxy configuration in Vite apps
3. Ensure the correct socket URL is being used
4. Check for firewall or VPN issues blocking WebSocket traffic

## Checking Service Health

1. **Middleware Server**:
   ```
   GET http://localhost:3003/api/status
   GET http://localhost:3003/api/socket-diagnostic
   ```

2. **Frontend Applications**:
   - Check browser console for socket connection logs
   - Ensure the correct Socket.IO URL is configured

## Manual Testing

You can manually test socket connections using the Socket.IO client:

```javascript
const socket = io('http://localhost:3003', {
  auth: {
    token: 'your-auth-token'  // Get from localStorage
  }
});

socket.on('connect', () => console.log('Connected!'));
socket.on('connect_error', (err) => console.error('Connection error:', err));
```

## Log Monitoring

Important log messages to monitor for socket issues:
- "Socket connection error" in client
- "Auth middleware rejected token" in server
- "Socket connected successfully" (confirms successful connection)
- "Display registered with socket server" (confirms successful registration) 