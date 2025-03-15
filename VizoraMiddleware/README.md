# Vizora Middleware

WebSocket middleware service for the Vizora application ecosystem. This service handles real-time communication between Vizora web app and VizoraTV displays.

## Features

- Display registration and management
- Secure pairing between web app and displays
- Real-time content updates
- Connection state management
- Automatic cleanup of disconnected displays

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

### Development

```bash
# Start in development mode with hot reload
npm run dev
```

## Architecture

The middleware consists of three main components:

1. **Display Manager**
   - Handles display registration
   - Generates and manages pairing codes
   - Tracks display status

2. **Pairing Manager**
   - Manages pairing process between displays and controllers
   - Handles authorization for content updates
   - Tracks controller-display relationships

3. **WebSocket Server**
   - Handles real-time communication
   - Manages socket connections
   - Routes messages between clients

## WebSocket Events

### Display Events

- `register_display`: Register a new display
- `display_registered`: Confirmation of display registration
- `paired`: Notification of successful pairing
- `content-update`: Receive content updates

### Controller Events

- `pair-request`: Request to pair with a display
- `pair-success`: Confirmation of successful pairing
- `pair-failed`: Notification of failed pairing
- `content-update`: Send content updates
- `content-update-failed`: Notification of failed content update

## Configuration

The server runs on port 3003 by default. You can modify this by setting the `PORT` environment variable.

## Error Handling

The middleware implements comprehensive error handling:
- Connection errors
- Invalid pairing attempts
- Unauthorized content updates
- Disconnection handling

## Security

- Secure WebSocket connections
- Pairing code validation
- Authorization checks for content updates
- Automatic cleanup of stale connections 