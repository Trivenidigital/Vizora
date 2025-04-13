# Database Structure Documentation

This document provides detailed information on the database structure used in the Vizora Middleware application. The application uses MongoDB with Mongoose as the ODM (Object Data Modeling) library.

## Overview

The database consists of the following main collections:

1. **Users** - Stores user account information
2. **Displays** - Stores information about display devices
3. **Controllers** - Stores information about controller devices
4. **Content** - Stores content information for displaying on displays

## Collection Schemas

### Users Collection

The Users collection stores information about user accounts in the system.

```javascript
{
  email: String,                   // User's email (unique)
  password: String,                // Hashed password (not returned in queries)
  firstName: String,               // User's first name
  lastName: String,                // User's last name
  role: String,                    // User role (user, admin, superadmin)
  isActive: Boolean,               // Whether user account is active
  lastLogin: Date,                 // Last login timestamp
  passwordResetToken: String,      // Token for password reset
  passwordResetExpires: Date,      // Expiration of password reset token
  controllers: [ObjectId],         // References to associated controllers
  settings: {                      // User preferences
    theme: String,                 // UI theme preference
    notifications: {               // Notification settings
      email: Boolean,              // Email notifications enabled
      push: Boolean                // Push notifications enabled
    },
    defaultView: String            // Default view when logging in
  },
  organization: {                  // Organization information
    name: String,                  // Organization name
    role: String                   // User's role in organization
  },
  createdAt: Date,                 // Record creation timestamp
  updatedAt: Date                  // Record update timestamp
}
```

### Displays Collection

The Displays collection stores information about display devices in the system.

```javascript
{
  deviceId: String,                // Unique device identifier
  name: String,                    // Display name
  model: String,                   // Display model information
  pairingCode: String,             // Code for pairing with controllers
  qrCode: String,                  // QR code data for pairing
  pairedControllers: [ObjectId],   // References to paired controllers
  status: String,                  // Display status (offline, online, maintenance)
  lastSeen: Date,                  // Last activity timestamp
  content: {                       // Content information
    currentContent: String,        // Currently displaying content ID
    contentHistory: [{             // History of displayed content
      contentId: String,           // Content ID
      displayedAt: Date            // When it was displayed
    }]
  },
  location: {                      // Physical location information
    description: String,           // Location description
    coordinates: {                 // Geographic coordinates
      latitude: Number,
      longitude: Number
    }
  },
  settings: {                      // Display settings
    brightness: Number,            // Screen brightness (0-100)
    orientation: String,           // Screen orientation (portrait, landscape)
    resolution: {                  // Screen resolution
      width: Number,
      height: Number
    },
    volume: Number,                // Audio volume (0-100)
    powerSchedule: {               // Power scheduling
      enabled: Boolean,            // Schedule enabled
      onTime: String,              // Time to turn on (HH:MM)
      offTime: String,             // Time to turn off (HH:MM)
      daysActive: [Number]         // Days of week active (0-6, Sunday-Saturday)
    }
  },
  metadata: Object,                // Additional custom data
  createdAt: Date,                 // Record creation timestamp
  updatedAt: Date                  // Record update timestamp
}
```

### Controllers Collection

The Controllers collection stores information about controller devices in the system.

```javascript
{
  deviceId: String,                // Unique device identifier
  name: String,                    // Controller name
  model: String,                   // Controller model information
  pairedDisplays: [ObjectId],      // References to paired displays
  activeDisplay: ObjectId,         // Currently active display
  status: String,                  // Controller status (offline, online, paired)
  lastSeen: Date,                  // Last activity timestamp
  permissions: String,             // Permission level (viewer, editor, admin)
  metadata: Object,                // Additional custom data
  settings: {                      // Controller settings
    notificationsEnabled: Boolean, // Notifications enabled
    theme: String,                 // UI theme (light, dark, system)
    layout: String,                // Layout preference (grid, list)
    defaultView: String            // Default view when starting
  },
  user: ObjectId,                  // Reference to associated user
  createdAt: Date,                 // Record creation timestamp
  updatedAt: Date                  // Record update timestamp
}
```

### Content Collection

The Content collection stores information about content that can be displayed on displays.

```javascript
{
  title: String,                   // Content title
  description: String,             // Content description
  type: String,                    // Content type (image, video, webpage, etc)
  url: String,                     // Content URL or location
  thumbnail: String,               // Thumbnail image URL
  duration: Number,                // Content duration in seconds (0 for infinite)
  status: String,                  // Content status (draft, published, archived)
  owner: ObjectId,                 // Reference to owner user
  tags: [String],                  // Content tags for categorization
  displaySettings: {               // Display-specific settings
    aspectRatio: String,           // Content aspect ratio
    resolution: {                  // Content resolution
      width: Number,
      height: Number
    },
    loop: Boolean,                 // Whether content should loop
    mute: Boolean,                 // Whether audio should be muted
    autoplay: Boolean              // Whether content autoplays
  },
  permissions: {                   // Access permissions
    public: Boolean,               // Whether content is publicly accessible
    users: [{                      // User-specific permissions
      user: ObjectId,              // Reference to user
      permission: String           // Permission level (view, edit)
    }]
  },
  metadata: Object,                // Additional custom data
  items: [{                        // For playlist type only
    contentId: ObjectId,           // Reference to content item
    duration: Number,              // Override duration for this item
    order: Number                  // Playback order in playlist
  }],
  createdAt: Date,                 // Record creation timestamp
  updatedAt: Date                  // Record update timestamp
}
```

## Relationships

### User - Controller Relationship

- One-to-many: A user can have multiple controllers
- Relationship is maintained through:
  - User document: `controllers` array with controller IDs
  - Controller document: `user` field with user ID

### Display - Controller Relationship

- Many-to-many: Displays can be paired with multiple controllers and vice versa
- Relationship is maintained through:
  - Display document: `pairedControllers` array with controller IDs
  - Controller document: `pairedDisplays` array with display IDs

### User - Content Relationship

- One-to-many: A user can own multiple content items
- Relationship is maintained through:
  - Content document: `owner` field with user ID

### Content - Display Relationship

- Many-to-many: Content can be displayed on multiple displays
- Relationship is maintained through:
  - Display document: `content.currentContent` and `content.contentHistory`

## Indexes

The following indexes are defined for performance optimization:

### User Collection
- `email`: 1 (unique)
- `role`: 1
- `isActive`: 1

### Display Collection
- `deviceId`: 1 (unique)
- `status`: 1
- `pairingCode`: 1 (sparse)
- `settings.powerSchedule.enabled`: 1

### Controller Collection
- `deviceId`: 1 (unique)
- `status`: 1
- `user`: 1 (sparse)

### Content Collection
- `owner`: 1
- `status`: 1
- `type`: 1
- `tags`: 1
- `permissions.public`: 1

## Migration

When updating the database schema, always follow these steps:

1. Run the validation script to check for compatibility issues:
   ```
   npm run validate-db
   ```

2. Run the migration script to update existing data:
   ```
   npm run migrate
   ```

3. Monitor the logs for any issues during migration

For more details on migration, see [MIGRATION.md](./MIGRATION.md). 