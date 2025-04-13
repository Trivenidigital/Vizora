# Vizora Middleware

This middleware service provides authentication and data APIs for the Vizora platform. It handles frontend requests, processes them, and manages responses with proper error handling.

## Server Implementations

There are several server implementations available:

1. **Unified Server** (Recommended): `unified-server.js`
   - Combines auth, folders, and content APIs in a single server
   - Proper CORS configuration with credentials support
   - Consistent error handling and response structure

2. **Direct Fix Server**: `direct-fix.js`
   - Fixes to the original implementation
   - API-only server for content and folders

3. **Auth Server**: `auth-server.js`
   - Authentication-specific server

## Running the Servers

To run the recommended unified server:

```bash
node unified-server.js
```

The server will start on port 3000 by default.

## Key Features

- **Proper CORS support**: Configured to work with both frontend origins
- **Authentication with JWT**: Login, register, and session management
- **Consistent API response format**: All APIs follow the same format
- **Detailed error handling**: Clear error messages for debugging
- **Test page**: Interactive HTML test page for API testing

## API Endpoints

### Authentication

| Method | Endpoint           | Description             | Request Body                                             |
|--------|-------------------|-------------------------|----------------------------------------------------------|
| POST   | /api/auth/login    | User login              | `{ "email": "user@example.com", "password": "secret" }`  |
| POST   | /api/auth/register | Register new user       | `{ "email": "...", "password": "...", "firstName": "...", "lastName": "..." }` |
| POST   | /api/auth/logout   | Logout current user     | None                                                     |
| GET    | /api/auth/me       | Get current user info   | None                                                     |

### Folders

| Method | Endpoint                  | Description                   |
|--------|--------------------------|-------------------------------|
| GET    | /api/folders              | Get all folders               |
| GET    | /api/folders/:id          | Get a specific folder         |
| GET    | /api/folders/:id/folders  | Get nested folders            |

### Content

| Method | Endpoint                  | Description                   |
|--------|--------------------------|-------------------------------|
| GET    | /api/content              | Get all content items         |
| GET    | /api/content/:id          | Get a specific content item   |
| GET    | /api/folders/:id/content  | Get content items in a folder |

### Other

| Method | Endpoint           | Description             |
|--------|-------------------|-------------------------|
| GET    | /api/health        | Health check endpoint    |
| GET    | /                  | Test page (redirects)    |
| GET    | /test-api.html     | API test page            |

## Response Format

All API responses follow a consistent format:

```json
{
  "success": true|false,
  "message": "Optional message",
  "data": [ ... ] | { ... } | null,
  "token": "JWT token" (auth endpoints only)
}
```

## Authentication Flow

1. **Login/Register**: Both return a JWT token and set a cookie
2. **Subsequent Requests**: Include the token as Authorization header or rely on the cookie
3. **Get Current User**: Use `/api/auth/me` to validate session
4. **Logout**: Clears the cookie and invalidates the token

## Debugging

- The server logs all requests with timestamp, method and URL
- POST/PUT requests also log the request body
- All responses use proper HTTP status codes
- Error responses include helpful error messages

## Testing

Use the included test page at `/test-api.html` to interactively test API endpoints directly in your browser.

## CORS Configuration

The server is configured to accept requests from:
- http://localhost:5173
- http://127.0.0.1:5173

With support for credentials (cookies) and the following headers:
- Content-Type
- Authorization
- X-Requested-With

## 📋 Overview

Vizora Middleware serves as the central communication hub between display devices and the content management system. It handles:

- Authentication and user management
- Display device registration and monitoring
- Content management and delivery
- Real-time communication via Socket.IO
- System monitoring and health checks

## 🏗️ Architecture

The application follows a modular MVC architecture:

- **Models**: MongoDB schemas for User, Display, Content
- **Controllers**: Handle business logic and API endpoints
- **Routes**: Define API routes and authentication requirements
- **Middleware**: Handle authentication, error handling, validation
- **Services**: Contain business logic for content delivery, display management
- **Socket**: Real-time communication with display devices

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- MongoDB
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/vizora/vizora-middleware.git
cd vizora-middleware
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file using the provided `.env.example` template
```bash
cp .env.example .env
```

4. Configure your environment variables in the `.env` file

5. Start the development server
```bash
npm run dev
```

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Log in an existing user
- `POST /api/auth/logout` - Log out the current user
- `POST /api/auth/refresh-token` - Refresh an expired access token
- `GET /api/auth/me` - Get the current user's profile
- `PUT /api/auth/me` - Update the current user's profile
- `POST /api/auth/change-password` - Change the current user's password
- `POST /api/auth/forgot-password` - Request a password reset
- `POST /api/auth/reset-password` - Reset a user's password with a token
- `POST /api/auth/verify-email` - Verify a user's email address
- `POST /api/auth/resend-verification` - Resend the email verification

### Display Management

- `POST /api/displays` - Register a new display
- `GET /api/displays` - Get all displays (admin only)
- `GET /api/displays/:id` - Get a specific display
- `PUT /api/displays/:id` - Update a display
- `DELETE /api/displays/:id` - Delete a display
- `POST /api/displays/pair` - Generate a pairing code
- `POST /api/displays/pair/confirm` - Confirm a pairing code
- `GET /api/displays/:id/status` - Get a display's status
- `GET /api/displays/:id/metrics` - Get a display's metrics
- `POST /api/displays/:id/command` - Send a command to a display
- `PUT /api/displays/:id/settings` - Update a display's settings
- `POST /api/displays/:id/maintenance` - Toggle maintenance mode

### Content Management

- `POST /api/content` - Create new content
- `GET /api/content` - Get all content
- `GET /api/content/:id` - Get specific content
- `PUT /api/content/:id` - Update content
- `DELETE /api/content/:id` - Delete content
- `POST /api/content/:id/assign` - Assign content to displays
- `GET /api/content/display/:id` - Get content for a specific display
- `GET /api/content/display/:id/current` - Get current content for a display
- `POST /api/content/:id/view` - Track content view
- `POST /api/content/:id/delivery-status` - Update delivery status
- `POST /api/content/:id/playback-status` - Update playback status

### System Management

- `GET /api/system/status` - Get system status
- `GET /api/system/health` - Get system health
- `GET /api/system/metrics` - Get system metrics
- `GET /api/system/logs` - Get system logs
- `POST /api/system/restart` - Restart the system

### Folder Management

The following folder management endpoints are now available:

- `GET /api/folders` - Get all folders
- `GET /api/folders/:id` - Get a specific folder
- `POST /api/folders` - Create a new folder
- `PATCH /api/folders/:id` - Update a folder
- `DELETE /api/folders/:id` - Delete a folder
- `GET /api/folders/:id/content` - Get content in a folder

The folder endpoints return standardized JSON responses:

```json
{
  "success": true,
  "data": [
    {
      "id": "folder-1",
      "name": "Marketing",
      "description": "Marketing materials and assets",
      "path": "/Marketing",
      "isRoot": true,
      "itemCount": 12,
      "createdAt": "2023-01-15T10:30:00Z",
      "updatedAt": "2023-06-22T14:15:00Z"
    },
    ...
  ]
}
```

For single folder operations, the response format is:

```json
{
  "success": true,
  "folder": {
    "id": "folder-1",
    "name": "Marketing",
    "description": "Marketing materials and assets",
    "path": "/Marketing",
    "isRoot": true,
    "itemCount": 12,
    "createdAt": "2023-01-15T10:30:00Z",
    "updatedAt": "2023-06-22T14:15:00Z"
  }
}
```

## 🔄 Socket.IO Events

### Server to Client

- `connect` - Connection established
- `content:update` - Content update available
- `display:settings` - Display settings updated
- `display:command` - Command for display
- `error` - Error message

### Client to Server

- `display:register` - Register display
- `display:status` - Display status update
- `display:heartbeat` - Regular heartbeat
- `content:delivered` - Content delivered to display
- `content:played` - Content played on display
- `content:error` - Error playing content

## 🧪 Testing

```bash
# Run all tests (standard approach)
npm test

# Run tests with coverage
npm run test:ci

# Run memory-optimized tests (with garbage collection)
npm run test:mem

# Run only critical tests (display, auth, and simple tests)
npm run test:critical

# Run tests sequentially to optimize memory usage
npm run test:optimized

# For Windows users - run tests with PowerShell optimization
npm run test:windows
```

### Memory-Optimized Testing

The project includes optimized test scripts to prevent memory issues:

- `test:mem` - Runs tests with increased heap size and garbage collection
- `test:critical` - Runs only the most important tests
- `test:optimized` - Runs each test file in sequence with memory cleanup
- `test:windows` - PowerShell-specific test runner for Windows environments

If you encounter "JavaScript heap out of memory" errors, use these optimized test runners instead.

### Troubleshooting Tests

- If tests are failing due to memory issues, try running them individually
- Use the `--detectOpenHandles` flag to identify resource leaks
- Node.js environments may need more memory: `NODE_OPTIONS="--max-old-space-size=4096"`

## 📊 Database Schema

### User
- `_id`: ObjectId
- `username`: String
- `email`: String
- `password`: String (hashed)
- `firstName`: String
- `lastName`: String
- `role`: String (admin, user)
- `status`: String (active, inactive)
- `emailVerified`: Boolean
- `refreshTokens`: Array
- `createdAt`: Date
- `updatedAt`: Date

### Display
- `_id`: ObjectId
- `name`: String
- `deviceId`: String
- `apiKey`: String
- `status`: String (active, offline, maintenance)
- `location`: Object
- `specs`: Object (resolution, orientation)
- `lastHeartbeat`: Date
- `settings`: Object
- `owner`: ObjectId (ref: User)
- `createdAt`: Date
- `updatedAt`: Date

### Content
- `_id`: ObjectId
- `title`: String
- `type`: String (image, video, webpage, etc.)
- `url`: String
- `metadata`: Object
- `settings`: Object
- `schedule`: Object
- `displays`: Array of ObjectId (ref: Display)
- `statistics`: Object
- `owner`: ObjectId (ref: User)
- `createdAt`: Date
- `updatedAt`: Date

## 🛠️ Development

### Linting

```bash
npm run lint
```

### Database Seeding

```bash
# Seed the database with sample data
npm run seed

# Remove all seeded data
npm run seed:delete
```

## 🔒 Security Considerations

- JWT authentication with refresh tokens
- Rate limiting for API endpoints
- Input validation with express-validator
- Protection against common web vulnerabilities with helmet
- Secure password hashing with bcrypt
- API key authentication for display devices

## 📦 Deployment

### Docker

A Dockerfile is provided for containerized deployment:

```bash
# Build Docker image
docker build -t vizora-middleware .

# Run container
docker run -p 5000:5000 --env-file .env vizora-middleware
```

### Environment Variables

Refer to the `.env.example` file for required environment variables.

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

# Vizora Middleware Server

## Issue Resolution: Display Endpoints

### Problem Fixed
The server was previously returning `500 Internal Server Error` with `ERR_CONTENT_LENGTH_MISMATCH` for `/api/displays` endpoints. This was caused by improper response handling that manually set content-length headers but didn't correctly match the payload size.

### Solution Implemented
We've created dedicated server implementations that properly handle responses:

1. **direct-fix.js** - A complete fixed server implementation that:
   - Uses Express's `res.json()` for automatic content-type and content-length handling
   - Implements proper error handling around endpoints
   - Sets up proper CORS configuration with preflight request support
   - Includes monitoring for response sending

2. **fixed-server.js** - An alternative implementation on port 3005

3. **fix-displays.js** - A script that patches the original app.js file to fix the display endpoints

4. **errorHandler.js** - Reusable error handling middleware

### How to Run the Server

For production use, run the fixed implementation:

```
node direct-fix.js
```

This server will:
- Run on port 3003 (the default expected by the front-end)
- Handle all the required API endpoints
- Include proper logging and error handling
- Support CORS for the front-end application

### Testing the Server

To verify the server is working correctly:

1. Check the `/api/displays` endpoint:
   ```
   curl http://localhost:3003/api/displays
   ```
   Expected response: `{"success":true,"data":[]}`

2. Check CORS preflight requests:
   ```
   Invoke-WebRequest -Method OPTIONS -Uri http://localhost:3003/api/displays -Headers @{'Origin'='http://localhost:5173'}
   ```
   Expected response: Status 204 with appropriate CORS headers

### Debugging

If you continue to encounter issues:

1. Check the server logs for detailed information
2. Ensure no other process is using port 3003
3. Verify that the front-end is connecting to the correct endpoint