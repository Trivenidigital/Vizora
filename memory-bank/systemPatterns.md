# System Patterns

## Architecture Overview
Vizora follows a microfrontend-aligned architecture that separates concerns between distinct applications:

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  VizoraWeb  │◄────┤ VizoraMiddleware │────►│  VizoraTV   │
└─────────────┘     └──────────────────┘     └─────────────┘
       ▲                     ▲                     ▲
       │                     │                     │
       └─────────────┬───────┴─────────────┬──────┘
                     │                     │
               ┌─────────────┐     ┌─────────────┐
               │   common    │     │VizoraDisplay│
               └─────────────┘     └─────────────┘
```

## Key Design Patterns

### Socket Communication Layer
- All Socket.IO connections managed through `ConnectionManager` in the common library
- Root namespace (`"/"`) used for all socket communications
- Event-based communication with clear naming conventions
- Connection state tracked via `useConnectionStatus` React hook

### Display Pairing Flow
1. VizoraTV generates a unique device ID
2. Device connects to VizoraMiddleware socket server
3. Device requests a QR code for pairing
4. Admin scans QR with VizoraWeb to complete pairing
5. Pairing confirmation flows through socket connections

### Content Management
- RESTful API for content CRUD operations
- Content metadata stored in MongoDB
- Content files stored in file system (with future cloud storage plans)
- Content delivery optimized based on display capabilities

### Scheduling System
- Priority-based scheduling engine
- Time-range validation for content display
- Support for recurring schedules (daily, weekly, monthly)
- Conflict resolution based on priority values

### State Management
- React component state for UI elements
- Socket.IO for real-time state synchronization
- Persistent state in MongoDB
- Local caching for performance optimization

## Component Relationships

### VizoraWeb Components
- Authentication services
- Display management dashboard
- Content upload and management
- Schedule creation and management
- System monitoring and alerts

### VizoraTV Components
- QR code display
- Content rendering
- Socket connection management
- Error handling and recovery
- Diagnostic information display

### VizoraMiddleware Components
- RESTful API endpoints
- Socket.IO server
- Authentication middleware
- File upload handling
- Database operations

### Common Components
- `ConnectionManager` for Socket.IO handling
- Shared TypeScript interfaces
- Utility functions
- Authentication helpers
- Logging services

## Critical Implementation Paths

### Display Registration and Pairing
```
VizoraTV → VizoraMiddleware → DB → VizoraWeb
```

### Content Delivery
```
VizoraWeb → VizoraMiddleware → VizoraTV → VizoraDisplay
```

### Real-time Status Updates
```
VizoraTV → ConnectionManager → VizoraMiddleware → VizoraWeb
```

## Error Handling Patterns
- Consistent error response structure across API
- Socket event error handling with retry mechanisms
- Client-side fallback content for connection failures
- Extensive logging with severity levels
- Recovery mechanisms for transient failures 