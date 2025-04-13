# Vizora Middleware Testing Guide

## Socket.IO Communication Tests

This document describes the tests created to validate the Socket.IO communication between the Vizora Middleware server and client applications.

### Test Scripts

We have created the following test scripts to verify different aspects of the socket communication and pairing process:

1. **Direct Pairing Test** (`src/tests/direct-pairing-test.js`)
   - Tests socket connection and the direct broadcast of pairing notifications
   - Verifies that the system can send pairing events to all connected clients

2. **HTTP Register and Pair Test** (`src/tests/http-register-and-pair-test.js`)
   - Tests HTTP registration endpoint and socket pairing notifications
   - Creates a display via HTTP API and then verifies pairing notification via socket

3. **Real Pairing Flow Test** (`src/tests/real-pairing-flow-test.js`)
   - Simulates a complete real-world pairing flow
   - Connects as a display, registers via socket, and then handles a pairing request from web
   - Validates the end-to-end integration of socket registration and pairing

### Running Tests

To run the tests, start the Vizora Middleware server and then execute:

```
cd Redesign/VizoraMiddleware
node src/tests/direct-pairing-test.js
node src/tests/http-register-and-pair-test.js
node src/tests/real-pairing-flow-test.js
```

### Debug Endpoints

We've added several debug endpoints to facilitate testing:

1. **Register Display** (`POST /api/displays/debug/register`)
   - Creates or updates a display without authentication
   - Requires `deviceId` or `qrCode` in the request body

2. **Trigger Pairing** (`POST /api/displays/debug/trigger-pairing/:qrCode`)
   - Simulates a pairing event for a specific QR code
   - Broadcasts pairing notification to connected displays

3. **Connected Displays** (`GET /api/displays/debug/connected`)
   - Returns information about currently connected displays
   - Shows socket rooms and connections for debugging

4. **Socket Details** (`POST /api/displays/debug/sockets`)
   - Returns information about all socket connections
   - Shows connection status and rooms

### Troubleshooting Issues

Common issues and their solutions:

1. **Socket registration failures:**
   - Ensure the display provides required fields (deviceId, name, location)
   - Check the server logs for validation errors
   - Verify the display can connect to the Socket.IO server

2. **Pairing notification not received:**
   - Make sure the display is properly registered and in the correct rooms
   - Verify the display is listening for both `display:paired` and `display:paired:broadcast` events
   - Check that socket rooms are correctly assigned during registration

3. **Connection issues:**
   - Ensure the server is running
   - Check for CORS issues or transport compatibility
   - Try different transport methods if websocket fails

### Implementation Notes

The tests use these libraries:
- `socket.io-client` for Socket.IO connections
- `axios` for HTTP requests

Important socket events:
- `register:display` - For registering a display
- `display:paired` - For receiving pairing notifications
- `display:registered` - Confirmation of successful registration 