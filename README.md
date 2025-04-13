![Architecture Locked](https://img.shields.io/badge/Architecture-Locked-4CAF50?style=for-the-badge&logo=checkmarx)

📐 [View Architecture Manifest](docs/architecture-manifest.md)

# Vizora - Digital Signage Management

Vizora is a modern web application for managing digital signage displays. It provides real-time monitoring, content management, and system diagnostics for digital displays.

## Features

- Real-time display status monitoring
- System metrics tracking (CPU, memory, storage, network)
- Content management and scheduling
- Diagnostic tools and error reporting
- WebSocket-based live updates
- Responsive and modern UI

## Tech Stack

- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Socket.IO for real-time communication
- React Query for data fetching
- React Router for navigation

## Getting Started

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Trivenidigital/Vizora.git
cd vizora
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
# or
yarn build
```

The built files will be in the `dist` directory.

## Development

### Project Structure

```
src/
  ├── components/         # React components
  │   ├── ui/            # Reusable UI components
  │   └── DisplayMonitoring/  # Display-specific components
  ├── services/          # API and WebSocket services
  ├── types/             # TypeScript type definitions
  ├── lib/               # Utility functions
  ├── App.tsx           # Main application component
  └── main.tsx          # Application entry point
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run test:coverage` - Run tests with coverage report

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
