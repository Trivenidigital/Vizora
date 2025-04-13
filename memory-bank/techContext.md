# Technical Context

## Technologies Used

### Frontend
- **React 18**: Core UI framework
- **TypeScript**: Type safety and development experience
- **Vite**: Fast build tooling and development server
- **TailwindCSS**: Utility-first CSS framework
- **Shadcn/UI**: Component primitives built on Radix UI
- **Socket.IO Client**: Real-time communication
- **React Router**: Client-side routing
- **Lucide Icons**: Modern iconography

### Backend
- **Node.js**: Runtime environment
- **Express**: Web server framework
- **Socket.IO**: WebSocket server for real-time updates
- **MongoDB**: Database for persistent storage
- **Zod**: Runtime type validation
- **JWT**: Authentication token system

### Development Tools
- **ESLint**: Code quality and consistency
- **Vitest/Jest**: Testing frameworks
- **Playwright**: End-to-end testing

## Development Setup

### Environment Setup
- Node.js 16+ required
- MongoDB instance (local or cloud)
- CORS properly configured for local development
- Environment variables (.env files) for configuration

### Project Structure
```
Redesign/
  ├── VizoraWeb/        # Admin interface
  ├── VizoraTV/         # Display application
  ├── VizoraMiddleware/ # Backend services
  ├── VizoraDisplay/    # Content orchestration
  └── common/           # Shared utilities and types
```

### Running the Applications
1. Start the middleware server: `cd Redesign/VizoraMiddleware && npm run dev`
2. Start the web admin: `cd Redesign/VizoraWeb && npm run dev`
3. Start the TV application: `cd Redesign/VizoraTV && npm run dev`

### Socket.IO Connection
All applications connect to the Socket.IO server through the `ConnectionManager` in the common package:
```typescript
const connectionManager = getConnectionManager();
connectionManager.connect({
  auth: { token: authToken }
});
```

## Technical Constraints

### Performance
- Content delivery optimized for various network conditions
- Socket.IO connection with exponential backoff for reliability
- Component lazy-loading for faster initial loads
- Efficient state management to avoid unnecessary re-renders

### Security
- JWT-based authentication for all connections
- Token validation on both client and server
- Socket connections authenticated via token
- Content validation to prevent malicious uploads
- HTTPS required for production

### Compatibility
- Browser support: Latest 2 versions of major browsers
- TV platforms: Modern smart TVs with web browsers
- Mobile support for admin interface
- Responsive design for various screen sizes

## Dependencies
- Socket.IO v4.x used for WebSocket communication
- TailwindCSS v3.x for styling
- MongoDB v5+ for data storage
- React v18+ for UI development
- TypeScript v4.5+ for type safety

## Tool Usage Patterns

### Socket.IO
- Root namespace (`"/"`) for all connections
- Connection manager as singleton instance
- Event-based communication with standardized naming
- Authentication via token in connection options
- Reconnection handling with exponential backoff

### Testing
- Unit tests with Vitest/Jest
- UI component testing with Testing Library
- End-to-end testing with Playwright
- Socket communication mocking for reliable tests

### Deployment
- Docker containers for each application
- Environment-specific configuration via .env files
- CI/CD pipeline for automated testing and deployment 