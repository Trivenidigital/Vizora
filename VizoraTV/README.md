# VizoraTV - Standalone Mode

VizoraTV is a digital signage display application that can run independently or integrated with the Vizora web app. This document describes how to run VizoraTV in standalone mode.

## Features

- Real-time content display
- Support for multiple content types:
  - Images
  - Videos
  - Text
  - HTML content
- QR code pairing
- Automatic content preloading
- Error handling and recovery
- Responsive design
- WebSocket-based communication

## Prerequisites

- Node.js v16 or higher
- npm v7 or higher

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Running in Standalone Mode

1. Start the development server and WebSocket server:
   ```bash
   npm start
   ```
   This will start both the Vite development server and the WebSocket server concurrently.

2. Open your browser to `http://localhost:5173`

3. The display will show a QR code and pairing code that can be used to connect from the Vizora web app.

## Configuration

The application can be configured through environment variables:

- `PORT`: WebSocket server port (default: 3003)
- `VITE_WS_URL`: WebSocket server URL (default: http://localhost:3003)

Create a `.env` file in the root directory to set these variables:

```env
PORT=3003
VITE_WS_URL=http://localhost:3003
```

## Project Structure

```
VizoraTV/
├── src/
│   ├── components/         # React components
│   │   ├── PairingDisplay.tsx
│   │   └── ContentDisplay.tsx
│   ├── services/          # Service classes
│   │   └── pairingService.ts
│   ├── server/           # Standalone server
│   │   └── server.ts
│   └── App.tsx           # Main application component
├── public/              # Static assets
└── package.json        # Project dependencies
```

## Available Scripts

- `npm run dev`: Start the Vite development server
- `npm run build`: Build the application for production
- `npm run preview`: Preview the production build
- `npm run server`: Start the WebSocket server
- `npm start`: Start both the development server and WebSocket server

## Testing

To test the standalone mode:

1. Start the application using `npm start`
2. Open the application in your browser
3. Use the QR code or pairing code to connect from the Vizora web app
4. Send content to the display using the Vizora web app interface

## Troubleshooting

Common issues and solutions:

1. WebSocket Connection Failed
   - Ensure the WebSocket server is running on port 3003
   - Check if the port is not being used by another application
   - Verify the WebSocket URL in the environment variables

2. Content Not Displaying
   - Check the browser console for errors
   - Verify that the content format is supported
   - Ensure the content URLs are accessible

3. Pairing Issues
   - Clear the browser cache and reload
   - Check if the QR code is readable
   - Verify the network connection between the display and the web app

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 