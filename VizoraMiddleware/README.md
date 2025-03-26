# Vizora Middleware

WebSocket middleware service for the Vizora application ecosystem. This service handles real-time communication between Vizora web app and VizoraTV displays.

## Features

- Display registration and management
- Secure pairing between web app and displays
- Real-time content updates
- Connection state management
- Automatic cleanup of disconnected displays
- Redis-based state persistence and scaling
- Performance monitoring and metrics

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- Docker and Docker Compose (for Redis)

### Installation

```bash
# Install dependencies
npm install

# Start Redis using Docker Compose
docker-compose up -d

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

The middleware consists of these main components:

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

4. **Redis State Manager**
   - Persists application state in Redis
   - Enables horizontal scaling
   - Provides fault tolerance

5. **Monitoring System**
   - Tracks Redis performance metrics
   - Monitors system health
   - Provides diagnostic information

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

### Environment Variables

See `.env.example` for all available configuration options. Key configurations include:

- **Server**: `PORT`, `NODE_ENV`, `HOST`
- **Redis**: Connection settings, retry policies, key prefixes
- **WebSocket**: Ping intervals, timeouts
- **Monitoring**: Metrics collection intervals, thresholds

## Redis Configuration

The middleware uses Redis for state persistence, enabling horizontal scaling and fault tolerance. The Redis configuration is optimized for performance and reliability:

### Key Features

- **Memory Management**: 512MB initial memory with volatile-lru eviction policy
- **Performance Optimization**: Lazy operations, I/O threads, connection limits
- **Persistence**: Balanced AOF persistence for durability with performance
- **Monitoring**: Redis Commander UI for real-time monitoring
- **Metrics Collection**: Performance metrics stored for analysis

### Redis Commander

A web-based Redis management UI is included and accessible at http://localhost:8081 when running with Docker Compose.

## Scaling Path

The middleware is designed to scale from personal use to enterprise deployment:

### Initial Setup (Current - Personal Use)
- Single Redis instance with 512MB memory
- Basic monitoring through Redis Commander
- Cost-effective configuration suitable for development and small production loads

### Growth Phase (100s of users)
- Increase Redis memory to 2-4GB
- Enable Redis persistence
- Implement proper monitoring and alerting
- Add Redis Sentinel for high availability

### Scale Phase (1000+ users)
- Implement Redis Cluster
- Add read replicas
- Implement proper sharding
- Consider managed Redis service (like Azure Cache for Redis or Amazon ElastiCache)

## Monitoring

The middleware includes comprehensive monitoring capabilities:

- **Health Endpoint**: `/health` provides system health information
- **Redis Metrics**: `/metrics/redis` provides detailed Redis performance metrics
- **Redis Commander**: Web UI for Redis monitoring and management
- **Logging**: Structured logging with error tracking

## Error Handling

The middleware implements comprehensive error handling:
- Connection errors
- Invalid pairing attempts
- Unauthorized content updates
- Disconnection handling
- Redis connection failures and retries

## Security

- Secure WebSocket connections
- Pairing code validation
- Authorization checks for content updates
- Automatic cleanup of stale connections
- Redis password protection

## Production Deployment and CORS Configuration

When deploying the Vizora Middleware server to production, proper configuration is essential for secure communication between the middleware and the TV app clients.

### Environment Variables

The server uses environment variables for configuration. For production, create a `.env` file based on the `.env.example` template:

```bash
cp .env.example .env
```

Then edit the `.env` file to match your production environment.

### CORS Configuration

Cross-Origin Resource Sharing (CORS) is critical for security when your TV app and middleware are deployed on different domains.

#### Setting Allowed Origins

Configure the `ALLOWED_ORIGINS` environment variable with a comma-separated list of allowed origins:

```
# Specific domains
ALLOWED_ORIGINS=https://display.example.com,https://vizora.example.org

# Allow all origins (not recommended for production)
ALLOWED_ORIGINS=*
```

#### CORS Behavior

- **Production Mode**: Only origins listed in `ALLOWED_ORIGINS` are allowed
- **Development Mode**: All origins are allowed for easier testing
- **Empty ALLOWED_ORIGINS**: If not set, defaults to allowing all origins

#### Debugging CORS Issues

Set `DEBUG_CORS=true` to enable detailed logging of CORS requests:

```
DEBUG_CORS=true
```

This will log all CORS requests with their origins to help diagnose connection issues.

### Server Ports

The WebSocket server by default runs on port 3003. To change this:

```
PORT=3003
```

Ensure your network/firewall settings allow connections to this port.

### Production Deployment Options

#### 1. Docker Deployment

A `Dockerfile` and `docker-compose.yml` are provided for containerized deployment:

```bash
# Build and start the containers
docker-compose up -d

# View logs
docker-compose logs -f
```

#### 2. Direct Node.js Deployment

For direct deployment on a server:

```bash
# Install dependencies
npm ci --production

# Build the project
npm run build

# Start the server
NODE_ENV=production npm start
```

#### 3. Using Process Manager (recommended)

Use PM2 for better process management:

```bash
# Install PM2 globally
npm install -g pm2

# Start the server with PM2
pm2 start dist/server/server.js --name vizora-middleware

# Configure PM2 to start on system boot
pm2 startup
pm2 save
```

### Monitoring

The server exposes a `/health` endpoint that returns status information about the running instance:

```
GET https://middleware.example.com/health
```

This can be used with monitoring tools to check server health.

### Security Considerations

For production environments:

1. Set up TLS/SSL for secure WebSocket connections (`wss://`)
2. Configure a reverse proxy (Nginx, Apache) in front of the Node.js server
3. Apply rate limiting to prevent abuse (already enabled by default)
4. Properly secure Redis and MongoDB with authentication and network restrictions 