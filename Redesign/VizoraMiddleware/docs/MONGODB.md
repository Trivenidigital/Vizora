# MongoDB Integration Guide

This document provides detailed information on how MongoDB Atlas is integrated and used in the Vizora Middleware application.

## Overview

Vizora uses MongoDB Atlas for persistent storage of:
- User accounts and authentication data
- Display device information and status
- Controller device information and status
- Pairing information between displays and controllers
- Content and scheduling data

## Connection Configuration

### Connection String

The MongoDB connection is configured via the `MONGO_URI` environment variable and must use MongoDB Atlas:

- **MongoDB Atlas**: `mongodb+srv://<username>:<password>@<cluster>.<id>.mongodb.net/<database>?retryWrites=true&w=majority&appName=<AppName>`

Example:
```
MONGO_URI=mongodb+srv://VizoraAdmin:sm5TkhjCxzCZDO6a@cluster0.6dmkg.mongodb.net/vizora?retryWrites=true&w=majority&appName=Cluster0
```

The connection code in `src/server.js` is specifically configured for MongoDB Atlas and will validate that the connection string uses the correct format.

### Connection Options

The following connection options are applied:

```javascript
const mongooseOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000
};
```

## Setting Up MongoDB Atlas

1. **Create an Atlas Account**:
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create an account or sign in

2. **Create a Cluster**:
   - Select the free tier for development or an appropriate paid tier for production
   - Choose your preferred cloud provider and region (ideally close to your application servers)
   - Create the cluster

3. **Configure Network Access**:
   - Navigate to "Network Access" in the Security section
   - Add IP addresses that need access (your server IP or 0.0.0.0/0 for public access)

4. **Create Database User**:
   - Navigate to "Database Access" in the Security section
   - Create a new database user with appropriate read/write permissions
   - Use a strong, unique password

5. **Get Connection String**:
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Select Node.js as your driver and appropriate version
   - Copy the connection string
   - Replace `<password>` with your database user's password
   - Replace `<dbname>` with `vizora`

6. **Set Environment Variable**:
   - Add the connection string to your `.env` file:
     ```
     MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.<id>.mongodb.net/vizora?retryWrites=true&w=majority&appName=<AppName>
     ```

## MongoDB Schema Design

Vizora uses Mongoose for MongoDB schema management. The primary models include:

### User Model
```javascript
const UserSchema = new Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  // Additional fields...
});
```

### Display Model
```javascript
const DisplaySchema = new Schema({
  deviceId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['online', 'offline', 'maintenance'], default: 'offline' },
  // Additional fields...
});
```

### Controller Model
```javascript
const ControllerSchema = new Schema({
  deviceId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['online', 'offline'], default: 'offline' },
  // Additional fields...
});
```

## Indexes

To optimize query performance, several indexes are defined:

```javascript
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });

DisplaySchema.index({ deviceId: 1 });
DisplaySchema.index({ status: 1 });
DisplaySchema.index({ 'pairing.code': 1 });

ControllerSchema.index({ deviceId: 1 });
ControllerSchema.index({ status: 1 });
```

## Data Backup and Restore

### Atlas Backup

MongoDB Atlas provides automated backups:
1. Navigate to your Atlas cluster
2. Go to the "Backup" tab
3. Configure automated backup schedule
4. On-demand backups can also be created

### Manual Backup and Restore

Using `mongodump` and `mongorestore`:

```bash
# Backup
mongodump --uri="mongodb+srv://<username>:<password>@<cluster>.<id>.mongodb.net/vizora" --out=./backup

# Restore
mongorestore --uri="mongodb+srv://<username>:<password>@<cluster>.<id>.mongodb.net/vizora" ./backup
```

## Monitoring and Maintenance

### Atlas Monitoring

MongoDB Atlas provides monitoring tools:
1. Navigate to your Atlas cluster
2. Go to the "Metrics" tab for real-time monitoring
3. Check the "Alerts" section to set up notifications

### Database Maintenance

Regular maintenance tasks:

1. **Index Management**:
   ```javascript
   // Check index sizes and statistics
   db.displays.stats();
   
   // Find unused indexes
   db.displays.aggregate([{$indexStats:{}}]);
   ```

2. **Data Validation**:
   ```javascript
   db.runCommand({validate: "displays"});
   ```

## Best Practices

1. **Connection Management**:
   - Use connection pooling (built into the Mongoose connector)
   - Handle connection errors and reconnection
   - Close connections when the application shuts down

2. **Query Optimization**:
   - Use appropriate indexes for frequent queries
   - Use projection to limit returned fields
   - Use pagination for large result sets

3. **Security**:
   - Store connection strings in environment variables
   - Use separate database users with appropriate permissions
   - Sanitize all user inputs to prevent injection attacks

4. **Data Modeling**:
   - Use embedded documents for related data that is always accessed together
   - Use references for data that can change independently
   - Use schema validation to ensure data integrity

## Troubleshooting

### Common Connection Issues

1. **Connection Refused**:
   - Check network access settings in Atlas
   - Verify IP whitelist includes your server's IP
   - Check firewall settings

2. **Authentication Failed**:
   - Verify username and password in connection string
   - Check if the user has appropriate permissions

3. **Timeout Errors**:
   - Check network latency between your app and MongoDB
   - Increase the `serverSelectionTimeoutMS` option

### Logging and Debugging

The middleware logs MongoDB connection events:

```javascript
mongoose.connection.on('error', (err) => {
  console.error('MongoDB Atlas connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB Atlas disconnected. Attempting to reconnect...');
});
```

To enable more verbose Mongoose debugging:

```javascript
mongoose.set('debug', true);
``` 