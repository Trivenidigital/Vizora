# MongoDB Connection Troubleshooting

This document provides guidance on diagnosing and fixing MongoDB connection issues in the Vizora Middleware application.

## Connection Requirements

Vizora Middleware requires a stable connection to MongoDB Atlas to function properly. The connection is managed by the following components:

- `src/config/db.js`: Main MongoDB connection manager
- `src/middleware/dbMiddleware.js`: Express middleware for checking MongoDB readiness
- `src/utils/db-diagnostics.js`: Diagnostic utilities for connection issues

## Common Issues and Solutions

### 1. Unsupported Connection Options

**Symptoms:**
```
[ERROR]: MongoDB Atlas connection error: {"error":"options keepalive, keepaliveinitialdelay are not supported","name":"MongoParseError"}
```

**Solution:**
The MongoDB driver version being used doesn't support certain connection options. We've implemented automatic fallback to minimal options, but you can manually fix this by:

1. Editing `src/config/db.js`
2. Removing unsupported options from the `getConnectionOptions()` function
3. Using only these core options:
   ```javascript
   {
     serverSelectionTimeoutMS: 30000,
     socketTimeoutMS: 60000,
     family: 4
   }
   ```

### 2. Immediate Disconnection After Connection

**Symptoms:**
```
[INFO]: MongoDB Atlas Connected: cluster0-shard-00-02.6dmkg.mongodb.net
[INFO]: MongoDB Atlas connection: Disconnected
```

**Solution:**
This is often caused by a timing issue with connection event listeners. We've addressed this by:

1. Adding a delay before checking the connection status
2. Setting up proper event listeners for reconnection
3. Implementing the database readiness middleware

### 3. Authentication Failures

**Symptoms:**
- 401 Unauthorized errors when trying to log in
- "Invalid credentials" errors even with correct credentials

**Solution:**
These issues are often caused by the database being disconnected during login attempts. We've implemented:

1. Database readiness middleware that returns 503 errors when the database is unavailable
2. Clearer error messages in the API responses
3. Frontend handling of database connection errors

## Testing Your Connection

You can use our test script to verify your MongoDB connection:

```bash
node src/test-db-connection.js
```

This script will:
1. Attempt to connect using our enhanced connection manager
2. Fall back to minimal options if the initial connection fails
3. Test query functionality by listing collections
4. Provide detailed error information if the connection fails

## Monitoring Connection Health

We've implemented several endpoints for monitoring MongoDB connection health:

- `/api/health`: Basic health check with database connection status
- `/api/health/db`: Detailed database connection diagnostics

The detailed diagnostics endpoint provides:
- Current connection state
- Network diagnostics if disconnected
- Connection options being used
- Last error information

## Environment Variables

Make sure your `.env` file has the correct MongoDB connection string:

```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

## Version Compatibility

Different versions of MongoDB drivers support different connection options. Our current implementation is resilient to these differences by:

1. Implementing automatic fallback to minimal options
2. Providing detailed error logging
3. Using the most widely supported connection options by default 