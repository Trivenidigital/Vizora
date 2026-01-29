# VIZORA - API SPECIFICATIONS
## Complete Endpoint Documentation with Examples

**Version:** 2.0  
**Last Updated:** January 26, 2026  
**Document:** 2 of 5  
**Status:** Ready for Implementation

---

## TABLE OF CONTENTS

1. [API Overview](#1-api-overview)
2. [Authentication Endpoints](#2-authentication-endpoints)
3. [Device Management Endpoints](#3-device-management-endpoints)
4. [Content Management Endpoints](#4-content-management-endpoints)
5. [Playlist Endpoints](#5-playlist-endpoints)
6. [Schedule Endpoints](#6-schedule-endpoints)
7. [Analytics Endpoints](#7-analytics-endpoints)
8. [Organization & User Endpoints](#8-organization--user-endpoints)
9. [Billing Endpoints](#9-billing-endpoints)
10. [Error Codes Reference](#10-error-codes-reference)

---

## 1. API OVERVIEW

### 1.1 Base URLs

```
Development:  http://localhost:3000/api
Staging:      https://api-staging.vizora.com/api
Production:   https://api.vizora.com/api
```

### 1.2 Response Format

**Success Response:**
```json
{
  "success": true,
  "data": {
    // Response payload
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}, // Optional additional context
    "timestamp": "2026-01-26T20:00:00Z",
    "requestId": "abc-123" // For support/debugging
  }
}
```

### 1.3 Authentication

**Header:**
```
Authorization: Bearer {jwt_token}
```

**Device Authentication:**
```
Authorization: Bearer {device_jwt_token}
```

### 1.4 Rate Limiting

**Global Limits:**
- `/api/auth/*`: 10 requests per 15 minutes per IP
- `/api/*`: 100 requests per minute per user
- `/api/content/upload`: 10 uploads per hour per user

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### 1.5 Pagination

**Query Parameters:**
```
?page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    }
  }
}
```

---

## 2. AUTHENTICATION ENDPOINTS

### 2.1 POST /auth/register

Register new user and organization.

**Request:**
```json
{
  "email": "admin@company.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "organizationName": "Acme Corp",
  "organizationSlug": "acme-corp" // Optional, auto-generated if not provided
}
```

**Validation Rules:**
- Email: Valid email format, unique
- Password: Min 8 chars, 1 uppercase, 1 lowercase, 1 number
- Names: 2-100 characters
- Organization name: 2-255 characters
- Slug: 2-255 characters, lowercase, hyphens only

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admin"
    },
    "organization": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "subscriptionTier": "free",
      "screenQuota": 5,
      "trialEndsAt": "2026-02-02T20:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 604800
  }
}
```

**Errors:**
```json
// 400 Bad Request
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "email": "Email already exists",
      "password": "Password must contain at least one uppercase letter"
    }
  }
}

// 409 Conflict
{
  "success": false,
  "error": {
    "code": "ORGANIZATION_EXISTS",
    "message": "Organization slug already taken",
    "details": {
      "slug": "acme-corp"
    }
  }
}
```

### 2.2 POST /auth/login

Authenticate user and receive JWT token.

**Request:**
```json
{
  "email": "admin@company.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admin",
      "organizationId": "660e8400-e29b-41d4-a716-446655440001",
      "organization": {
        "name": "Acme Corp",
        "subscriptionTier": "free"
      }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 604800
  }
}
```

**Errors:**
```json
// 401 Unauthorized
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Invalid email or password"
  }
}

// 403 Forbidden
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "Account is inactive. Contact support."
  }
}
```

### 2.3 POST /auth/refresh

Refresh expired JWT token.

**Headers:**
```
Authorization: Bearer {expired_token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 604800
  }
}
```

### 2.4 POST /auth/logout

Invalidate current session.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 2.5 POST /auth/forgot-password

Request password reset email.

**Request:**
```json
{
  "email": "admin@company.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset email sent if account exists"
}
```

**Note:** Always returns success to prevent email enumeration.

### 2.6 POST /auth/reset-password

Reset password with token from email.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

---

## 3. DEVICE MANAGEMENT ENDPOINTS

### 3.1 POST /devices/pairing-code

Generate pairing code for new device.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "deviceIdentifier": "tv-mac-00:1B:44:11:3A:B7", // Optional
  "nickname": "Reception TV", // Optional
  "location": "Main Office" // Optional
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "code": "A1B2C3",
    "deviceId": "770e8400-e29b-41d4-a716-446655440002",
    "expiresAt": "2026-01-26T21:05:00Z",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
  }
}
```

**Errors:**
```json
// 403 Forbidden - Quota exceeded
{
  "success": false,
  "error": {
    "code": "DEVICE_003",
    "message": "Screen quota exceeded. Upgrade to add more devices.",
    "details": {
      "currentDevices": 5,
      "quota": 5,
      "subscriptionTier": "free",
      "upgradeUrl": "https://app.vizora.com/billing"
    }
  }
}
```

### 3.2 POST /devices/confirm-pairing

Confirm device pairing with code.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "code": "A1B2C3",
  "nickname": "Reception TV" // Optional, overrides initial nickname
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "device": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "organizationId": "660e8400-e29b-41d4-a716-446655440001",
      "deviceIdentifier": "tv-mac-00:1B:44:11:3A:B7",
      "nickname": "Reception TV",
      "status": "online",
      "pairedAt": "2026-01-26T21:00:00Z"
    },
    "deviceToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "socketUrl": "wss://realtime.vizora.com",
    "config": {
      "heartbeatInterval": 15000, // milliseconds
      "cacheSize": 524288000, // 500MB in bytes
      "autoUpdate": true
    }
  }
}
```

**Errors:**
```json
// 404 Not Found
{
  "success": false,
  "error": {
    "code": "DEVICE_001",
    "message": "Invalid or expired pairing code"
  }
}

// 403 Forbidden
{
  "success": false,
  "error": {
    "code": "DEVICE_003",
    "message": "Screen quota exceeded"
  }
}
```

### 3.3 GET /devices

List all devices for organization.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
```
?status=online&location=Main Office&page=1&limit=20&sortBy=nickname&sortOrder=asc
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "nickname": "Reception TV",
        "deviceIdentifier": "tv-mac-00:1B:44:11:3A:B7",
        "status": "online",
        "lastHeartbeat": "2026-01-26T20:59:45Z",
        "location": "Main Office",
        "timezone": "America/New_York",
        "metadata": {
          "os": "Android TV 12",
          "resolution": "1920x1080",
          "model": "Samsung QN55Q60A",
          "appVersion": "1.0.5"
        },
        "currentPlaylist": {
          "id": "abc123",
          "name": "Morning Promotions",
          "currentItemIndex": 2,
          "totalItems": 5
        },
        "pairedAt": "2026-01-26T21:00:00Z",
        "createdAt": "2026-01-26T20:55:00Z"
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

### 3.4 GET /devices/:deviceId

Get single device details with analytics.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "device": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "nickname": "Reception TV",
      "deviceIdentifier": "tv-mac-00:1B:44:11:3A:B7",
      "status": "online",
      "lastHeartbeat": "2026-01-26T20:59:45Z",
      "location": "Main Office",
      "timezone": "America/New_York",
      "metadata": {
        "os": "Android TV 12",
        "resolution": "1920x1080",
        "model": "Samsung QN55Q60A",
        "appVersion": "1.0.5",
        "cpuUsage": 45.2,
        "memoryUsage": 62.8,
        "storageUsed": 1024000000,
        "storageTotal": 8589934592
      },
      "currentPlaylist": {
        "id": "abc123",
        "name": "Morning Promotions",
        "currentItemIndex": 3,
        "totalItems": 10,
        "playingSince": "2026-01-26T09:00:00Z"
      },
      "uptime": {
        "currentSession": 86400, // seconds
        "last24Hours": 99.8, // percentage
        "last7Days": 99.2,
        "last30Days": 98.5
      },
      "analytics": {
        "impressionsToday": 120,
        "errorsToday": 2,
        "avgContentLoadTime": 1.2 // seconds
      },
      "pairedAt": "2026-01-26T21:00:00Z",
      "createdAt": "2026-01-26T20:55:00Z",
      "updatedAt": "2026-01-26T20:59:45Z"
    }
  }
}
```

### 3.5 PATCH /devices/:deviceId

Update device details.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "nickname": "Updated Reception TV",
  "location": "Building A - Lobby",
  "timezone": "America/Los_Angeles"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "device": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "nickname": "Updated Reception TV",
      "location": "Building A - Lobby",
      "timezone": "America/Los_Angeles",
      "updatedAt": "2026-01-26T21:05:00Z"
    }
  }
}
```

### 3.6 DELETE /devices/:deviceId

Unpair and remove device.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Device unpaired successfully",
  "data": {
    "unpairedAt": "2026-01-26T21:10:00Z"
  }
}
```

### 3.7 POST /devices/:deviceId/heartbeat

Device heartbeat endpoint (called by TV client every 15s).

**Headers:**
```
Authorization: Bearer {device_token}
```

**Request:**
```json
{
  "timestamp": "2026-01-26T21:00:00Z",
  "status": "online",
  "metrics": {
    "cpuUsage": 45.2,
    "memoryUsage": 62.8,
    "storageUsed": 1024000000,
    "storageTotal": 8589934592,
    "socketLatency": 45 // milliseconds
  },
  "currentContent": {
    "playlistId": "abc123",
    "contentId": "xyz789",
    "playbackPosition": 15.5, // seconds
    "itemIndex": 3
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "nextHeartbeatIn": 15000, // milliseconds
    "commands": [
      {
        "type": "UPDATE_PLAYLIST",
        "playlistId": "abc124",
        "priority": "immediate"
      },
      {
        "type": "CLEAR_CACHE",
        "contentIds": ["old-content-1", "old-content-2"]
      }
    ],
    "serverTime": "2026-01-26T21:00:00Z"
  }
}
```

---

## 4. CONTENT MANAGEMENT ENDPOINTS

### 4.1 POST /content/upload

Upload media file to storage.

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request (multipart form):**
```
file: [binary file data]
title: "Summer Sale Banner"
description: "Promotional banner for summer 2026 sale"
type: "image"
tags: ["sale", "summer", "promotion"]
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "content": {
      "id": "abc123def456",
      "organizationId": "660e8400-e29b-41d4-a716-446655440001",
      "type": "image",
      "title": "Summer Sale Banner",
      "description": "Promotional banner for summer 2026 sale",
      "source": "https://storage.vizora.com/org-660e8400/abc123def456.jpg",
      "thumbnail": "https://storage.vizora.com/org-660e8400/abc123def456_thumb.jpg",
      "metadata": {
        "size": 2048576,
        "mimeType": "image/jpeg",
        "width": 1920,
        "height": 1080
      },
      "tags": ["sale", "summer", "promotion"],
      "uploadStatus": "ready",
      "createdBy": "550e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2026-01-26T21:00:00Z"
    }
  }
}
```

**Errors:**
```json
// 413 Payload Too Large
{
  "success": false,
  "error": {
    "code": "CONTENT_002",
    "message": "File size exceeds maximum allowed (100MB)",
    "details": {
      "fileSize": 150000000,
      "maxSize": 104857600
    }
  }
}

// 415 Unsupported Media Type
{
  "success": false,
  "error": {
    "code": "CONTENT_003",
    "message": "File type not supported",
    "details": {
      "mimeType": "application/exe",
      "supportedTypes": [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "video/mp4", "video/webm", "video/quicktime",
        "application/pdf"
      ]
    }
  }
}
```

### 4.2 POST /content/external

Add external/embedded content (webpages, dashboards, etc.).

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "type": "webpage",
  "title": "Grafana Dashboard",
  "description": "Real-time metrics dashboard",
  "embedUrl": "https://grafana.company.com/d/abc123/dashboard",
  "metadata": {
    "refreshInterval": 300 // seconds
  },
  "tags": ["dashboard", "metrics"]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "content": {
      "id": "xyz789",
      "type": "webpage",
      "title": "Grafana Dashboard",
      "description": "Real-time metrics dashboard",
      "source": "https://grafana.company.com/d/abc123/dashboard",
      "thumbnail": "https://storage.vizora.com/placeholders/webpage.png",
      "metadata": {
        "embedUrl": "https://grafana.company.com/d/abc123/dashboard",
        "iframeSafe": true,
        "corsEnabled": true,
        "refreshInterval": 300
      },
      "tags": ["dashboard", "metrics"],
      "uploadStatus": "ready",
      "createdAt": "2026-01-26T21:00:00Z"
    }
  }
}
```

**Errors:**
```json
// 400 Bad Request - CORS check failed
{
  "success": false,
  "error": {
    "code": "CONTENT_005",
    "message": "URL cannot be embedded due to CORS restrictions",
    "details": {
      "url": "https://example.com",
      "corsCheck": "failed",
      "xFrameOptions": "DENY"
    }
  }
}
```

### 4.3 GET /content

List all content for organization.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
```
?type=image&tags=sale&search=summer&page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": "abc123",
        "type": "image",
        "title": "Summer Sale Banner",
        "description": "Promotional banner",
        "thumbnail": "https://storage.vizora.com/.../thumb.jpg",
        "tags": ["sale", "summer"],
        "uploadStatus": "ready",
        "metadata": {
          "size": 2048576,
          "width": 1920,
          "height": 1080
        },
        "createdBy": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "name": "John Doe"
        },
        "createdAt": "2026-01-26T21:00:00Z"
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    }
  }
}
```

### 4.4 GET /content/:contentId

Get single content with analytics.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "content": {
      "id": "abc123",
      "organizationId": "660e8400-e29b-41d4-a716-446655440001",
      "type": "image",
      "title": "Summer Sale Banner",
      "description": "Promotional banner for summer 2026 sale",
      "source": "https://storage.vizora.com/org-660e8400/abc123.jpg",
      "thumbnail": "https://storage.vizora.com/org-660e8400/abc123_thumb.jpg",
      "metadata": {
        "size": 2048576,
        "mimeType": "image/jpeg",
        "width": 1920,
        "height": 1080
      },
      "tags": ["sale", "summer", "promotion"],
      "uploadStatus": "ready",
      "analytics": {
        "totalImpressions": 1250,
        "uniqueDevices": 15,
        "avgDisplayDuration": 12.5,
        "completionRate": 98.4,
        "last7Days": {
          "impressions": 350,
          "devices": 12
        }
      },
      "usedInPlaylists": [
        {
          "id": "playlist-001",
          "name": "Morning Promotions"
        }
      ],
      "createdBy": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "John Doe",
        "email": "john@acme.com"
      },
      "createdAt": "2026-01-26T21:00:00Z",
      "updatedAt": "2026-01-26T21:00:00Z"
    }
  }
}
```

### 4.5 PATCH /content/:contentId

Update content metadata.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "title": "Updated Summer Sale Banner",
  "description": "New description",
  "tags": ["sale", "summer", "2026", "clearance"]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "content": {
      "id": "abc123",
      "title": "Updated Summer Sale Banner",
      "description": "New description",
      "tags": ["sale", "summer", "2026", "clearance"],
      "updatedAt": "2026-01-26T21:10:00Z"
    }
  }
}
```

### 4.6 DELETE /content/:contentId

Delete content (soft delete).

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Content deleted successfully",
  "data": {
    "deletedAt": "2026-01-26T21:15:00Z"
  }
}
```

**Errors:**
```json
// 409 Conflict - Content in use
{
  "success": false,
  "error": {
    "code": "CONTENT_006",
    "message": "Cannot delete content that is used in active playlists",
    "details": {
      "usedInPlaylists": [
        {"id": "playlist-001", "name": "Morning Promotions"}
      ]
    }
  }
}
```

---

## 5. PLAYLIST ENDPOINTS

### 5.1 POST /playlists

Create new playlist.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "name": "Morning Promotions",
  "description": "Promotional content for morning hours (6am-12pm)",
  "items": [
    {
      "contentId": "abc123",
      "duration": 10,
      "transition": "fade",
      "transitionDuration": 500,
      "order": 0
    },
    {
      "contentId": "xyz789",
      "duration": 15,
      "transition": "slide",
      "transitionDuration": 300,
      "order": 1
    }
  ],
  "loopPlaylist": true
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "playlist": {
      "id": "playlist-001",
      "organizationId": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Morning Promotions",
      "description": "Promotional content for morning hours",
      "items": [
        {
          "contentId": "abc123",
          "duration": 10,
          "transition": "fade",
          "transitionDuration": 500,
          "order": 0,
          "content": {
            "id": "abc123",
            "title": "Summer Sale Banner",
            "type": "image",
            "thumbnail": "https://storage.vizora.com/.../thumb.jpg"
          }
        },
        {
          "contentId": "xyz789",
          "duration": 15,
          "transition": "slide",
          "transitionDuration": 300,
          "order": 1,
          "content": {
            "id": "xyz789",
            "title": "Grafana Dashboard",
            "type": "webpage",
            "thumbnail": "https://storage.vizora.com/.../placeholder.png"
          }
        }
      ],
      "totalDuration": 25,
      "loopPlaylist": true,
      "thumbnail": "https://storage.vizora.com/.../thumb.jpg",
      "createdBy": "550e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2026-01-26T21:00:00Z"
    }
  }
}
```

**Errors:**
```json
// 400 Bad Request - Invalid content
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid content items",
    "details": {
      "errors": [
        {
          "contentId": "invalid-id",
          "message": "Content not found"
        }
      ]
    }
  }
}
```

### 5.2 GET /playlists

List all playlists.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
```
?search=morning&page=1&limit=20&sortBy=updatedAt&sortOrder=desc
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "playlists": [
      {
        "id": "playlist-001",
        "name": "Morning Promotions",
        "description": "Promotional content for morning hours",
        "totalDuration": 25,
        "itemCount": 2,
        "thumbnail": "https://storage.vizora.com/.../thumb.jpg",
        "assignedDevices": 5,
        "usedInSchedules": 3,
        "createdBy": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "name": "John Doe"
        },
        "createdAt": "2026-01-26T21:00:00Z",
        "updatedAt": "2026-01-26T21:05:00Z"
      }
    ],
    "pagination": {
      "total": 20,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

### 5.3 GET /playlists/:playlistId

Get playlist details with populated content.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "playlist": {
      "id": "playlist-001",
      "name": "Morning Promotions",
      "description": "Promotional content for morning hours",
      "items": [
        {
          "contentId": "abc123",
          "duration": 10,
          "transition": "fade",
          "transitionDuration": 500,
          "order": 0,
          "content": {
            "id": "abc123",
            "title": "Summer Sale Banner",
            "type": "image",
            "source": "https://storage.vizora.com/.../image.jpg",
            "thumbnail": "https://storage.vizora.com/.../thumb.jpg",
            "metadata": {
              "width": 1920,
              "height": 1080
            }
          }
        }
      ],
      "totalDuration": 25,
      "loopPlaylist": true,
      "analytics": {
        "totalPlays": 450,
        "activeDevices": 5,
        "last7Days": {
          "plays": 150,
          "devices": 5
        }
      },
      "assignedTo": [
        {
          "type": "schedule",
          "id": "schedule-001",
          "name": "Weekday Morning",
          "devices": 3
        },
        {
          "type": "instant",
          "deviceId": "device-001",
          "deviceName": "Reception TV",
          "expiresAt": "2026-01-26T22:00:00Z"
        }
      ],
      "createdBy": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "John Doe"
      },
      "createdAt": "2026-01-26T21:00:00Z",
      "updatedAt": "2026-01-26T21:05:00Z"
    }
  }
}
```

### 5.4 PATCH /playlists/:playlistId

Update playlist.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "name": "Updated Morning Promotions",
  "description": "Updated description",
  "items": [
    {
      "contentId": "abc123",
      "duration": 12,
      "transition": "fade",
      "order": 0
    },
    {
      "contentId": "new456",
      "duration": 8,
      "transition": "zoom",
      "order": 1
    }
  ],
  "loopPlaylist": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "playlist": {
      "id": "playlist-001",
      "name": "Updated Morning Promotions",
      "description": "Updated description",
      "items": [...],
      "totalDuration": 20,
      "updatedAt": "2026-01-26T21:10:00Z"
    }
  }
}
```

### 5.5 DELETE /playlists/:playlistId

Delete playlist.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Playlist deleted successfully"
}
```

**Errors:**
```json
// 409 Conflict
{
  "success": false,
  "error": {
    "code": "PLAYLIST_IN_USE",
    "message": "Cannot delete playlist that is used in active schedules",
    "details": {
      "schedules": [
        {"id": "schedule-001", "name": "Weekday Morning"}
      ]
    }
  }
}
```

### 5.6 POST /playlists/:playlistId/instant-publish

Instantly publish playlist to device(s).

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "deviceIds": ["device-001", "device-002"],
  "duration": 3600, // seconds, optional
  "overrideSchedule": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "publishedTo": ["device-001", "device-002"],
    "expiresAt": "2026-01-26T22:00:00Z",
    "overridesSchedule": true,
    "message": "Playlist published instantly to 2 devices"
  }
}
```

---

## 6. SCHEDULE ENDPOINTS

### 6.1 POST /schedules

Create new schedule.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "name": "Weekday Morning Schedule",
  "description": "Play morning promotions on weekdays",
  "deviceId": "device-001",
  "playlistId": "playlist-001",
  "cronExpression": "0 9 * * 1-5",
  "timezone": "America/New_York",
  "startDate": "2026-01-27T00:00:00Z",
  "endDate": "2026-12-31T23:59:59Z",
  "priority": 50,
  "isActive": true
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "schedule": {
      "id": "schedule-001",
      "name": "Weekday Morning Schedule",
      "description": "Play morning promotions on weekdays",
      "deviceId": "device-001",
      "playlistId": "playlist-001",
      "device": {
        "id": "device-001",
        "nickname": "Reception TV"
      },
      "playlist": {
        "id": "playlist-001",
        "name": "Morning Promotions",
        "itemCount": 5
      },
      "cronExpression": "0 9 * * 1-5",
      "cronReadable": "At 09:00 AM, Monday through Friday",
      "timezone": "America/New_York",
      "startDate": "2026-01-27T00:00:00Z",
      "endDate": "2026-12-31T23:59:59Z",
      "nextExecutionAt": "2026-01-27T14:00:00Z", // UTC
      "priority": 50,
      "isActive": true,
      "createdAt": "2026-01-26T21:00:00Z"
    }
  }
}
```

**Errors:**
```json
// 400 Bad Request - Invalid CRON
{
  "success": false,
  "error": {
    "code": "SCHEDULE_001",
    "message": "Invalid CRON expression",
    "details": {
      "cronExpression": "invalid expression",
      "error": "Expected 5 fields, got 4"
    }
  }
}
```

### 6.2 GET /schedules

List all schedules.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
```
?deviceId=device-001&isActive=true&page=1&limit=20
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "schedules": [
      {
        "id": "schedule-001",
        "name": "Weekday Morning Schedule",
        "device": {
          "id": "device-001",
          "nickname": "Reception TV",
          "status": "online"
        },
        "playlist": {
          "id": "playlist-001",
          "name": "Morning Promotions",
          "itemCount": 5
        },
        "cronReadable": "At 09:00 AM, Monday through Friday",
        "nextExecutionAt": "2026-01-27T14:00:00Z",
        "lastExecutedAt": "2026-01-26T14:00:00Z",
        "executionCount": 5,
        "isActive": true,
        "priority": 50,
        "createdAt": "2026-01-26T21:00:00Z"
      }
    ],
    "pagination": {
      "total": 35,
      "page": 1,
      "limit": 20,
      "totalPages": 2
    }
  }
}
```

### 6.3 GET /schedules/:scheduleId

Get schedule details.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "schedule": {
      "id": "schedule-001",
      "name": "Weekday Morning Schedule",
      "description": "Play morning promotions on weekdays",
      "deviceId": "device-001",
      "playlistId": "playlist-001",
      "device": {
        "id": "device-001",
        "nickname": "Reception TV",
        "status": "online",
        "location": "Main Office"
      },
      "playlist": {
        "id": "playlist-001",
        "name": "Morning Promotions",
        "itemCount": 5,
        "totalDuration": 60
      },
      "cronExpression": "0 9 * * 1-5",
      "cronReadable": "At 09:00 AM, Monday through Friday",
      "timezone": "America/New_York",
      "startDate": "2026-01-27T00:00:00Z",
      "endDate": "2026-12-31T23:59:59Z",
      "nextExecutionAt": "2026-01-27T14:00:00Z",
      "lastExecutedAt": "2026-01-26T14:00:00Z",
      "executionCount": 5,
      "priority": 50,
      "isActive": true,
      "executionHistory": [
        {
          "executedAt": "2026-01-26T14:00:00Z",
          "success": true,
          "duration": 60000 // milliseconds
        },
        {
          "executedAt": "2026-01-25T14:00:00Z",
          "success": true,
          "duration": 60000
        }
      ],
      "createdBy": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "John Doe"
      },
      "createdAt": "2026-01-26T21:00:00Z",
      "updatedAt": "2026-01-26T21:00:00Z"
    }
  }
}
```

### 6.4 PATCH /schedules/:scheduleId

Update schedule.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "name": "Updated Schedule",
  "cronExpression": "0 8 * * 1-5",
  "priority": 60,
  "isActive": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "schedule": {
      "id": "schedule-001",
      "name": "Updated Schedule",
      "cronExpression": "0 8 * * 1-5",
      "cronReadable": "At 08:00 AM, Monday through Friday",
      "nextExecutionAt": "2026-01-27T13:00:00Z",
      "priority": 60,
      "isActive": false,
      "updatedAt": "2026-01-26T21:10:00Z"
    }
  }
}
```

### 6.5 DELETE /schedules/:scheduleId

Delete schedule.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Schedule deleted successfully"
}
```

---

## 7. ANALYTICS ENDPOINTS

### 7.1 GET /analytics/overview

Get organization-wide analytics.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
```
?startDate=2026-01-01&endDate=2026-01-26&timezone=America/New_York
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2026-01-01T00:00:00Z",
      "endDate": "2026-01-26T23:59:59Z",
      "timezone": "America/New_York"
    },
    "metrics": {
      "totalDevices": 45,
      "activeDevices": 42,
      "offlineDevices": 3,
      "averageUptime": 99.2,
      "totalImpressions": 125000,
      "totalContentItems": 250,
      "totalPlaylists": 35,
      "totalSchedules": 120
    },
    "deviceStatus": {
      "online": 42,
      "offline": 2,
      "error": 1
    },
    "topContent": [
      {
        "contentId": "abc123",
        "title": "Summer Sale Banner",
        "type": "image",
        "impressions": 5000,
        "avgDuration": 12.5,
        "devices": 15,
        "completionRate": 98.5
      }
    ],
    "impressionsTrend": [
      {"date": "2026-01-20", "impressions": 4500},
      {"date": "2026-01-21", "impressions": 4800},
      {"date": "2026-01-22", "impressions": 5200}
    ],
    "uptime": {
      "current": 99.2,
      "last7Days": 99.5,
      "last30Days": 98.8
    },
    "errors": {
      "total": 150,
      "byType": {
        "load_failed": 80,
        "timeout": 50,
        "cors": 20
      }
    }
  }
}
```

### 7.2 GET /analytics/devices/:deviceId

Get device-specific analytics.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
```
?startDate=2026-01-01&endDate=2026-01-26
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "device": {
      "id": "device-001",
      "nickname": "Reception TV"
    },
    "period": {
      "startDate": "2026-01-01T00:00:00Z",
      "endDate": "2026-01-26T23:59:59Z"
    },
    "metrics": {
      "uptime": 99.8,
      "totalImpressions": 3500,
      "uniqueContent": 25,
      "avgCpuUsage": 45.2,
      "avgMemoryUsage": 62.5,
      "avgStorageUsed": 1024000000,
      "totalPlaybackErrors": 5
    },
    "impressionsTrend": [
      {"date": "2026-01-26", "impressions": 150}
    ],
    "topContent": [
      {
        "contentId": "abc123",
        "title": "Summer Sale Banner",
        "impressions": 250,
        "avgDuration": 12.5
      }
    ],
    "errors": [
      {
        "timestamp": "2026-01-26T15:30:00Z",
        "type": "LOAD_FAILED",
        "contentId": "xyz789",
        "contentTitle": "Broken Image",
        "message": "Failed to load content"
      }
    ],
    "performanceTrend": {
      "cpuUsage": [
        {"timestamp": "2026-01-26T20:00:00Z", "value": 45.2},
        {"timestamp": "2026-01-26T20:15:00Z", "value": 46.1}
      ],
      "memoryUsage": [...]
    }
  }
}
```

### 7.3 GET /analytics/content/:contentId

Get content-specific analytics.

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
```
?startDate=2026-01-01&endDate=2026-01-26
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "content": {
      "id": "abc123",
      "title": "Summer Sale Banner",
      "type": "image"
    },
    "period": {
      "startDate": "2026-01-01T00:00:00Z",
      "endDate": "2026-01-26T23:59:59Z"
    },
    "metrics": {
      "totalImpressions": 5000,
      "uniqueDevices": 15,
      "avgDisplayDuration": 12.5,
      "completionRate": 98.5,
      "errorRate": 0.2
    },
    "impressionsByDay": [
      {
        "date": "2026-01-26",
        "impressions": 200,
        "devices": 15,
        "avgDuration": 12.5
      }
    ],
    "deviceBreakdown": [
      {
        "deviceId": "device-001",
        "deviceName": "Reception TV",
        "impressions": 250,
        "avgDuration": 13.2
      }
    ],
    "timeOfDayDistribution": [
      {"hour": 9, "impressions": 500},
      {"hour": 10, "impressions": 450},
      {"hour": 11, "impressions": 400}
    ]
  }
}
```

### 7.4 POST /analytics/export

Export analytics data.

**Headers:**
```
Authorization: Bearer {token}
```

**Request:**
```json
{
  "format": "csv", // or "pdf"
  "type": "devices", // or "content", "playlists", "overview"
  "startDate": "2026-01-01",
  "endDate": "2026-01-26",
  "filters": {
    "deviceIds": ["device-001", "device-002"],
    "contentIds": ["abc123"]
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "exportId": "export-001",
    "downloadUrl": "https://storage.vizora.com/exports/org-xxx/export-001.csv",
    "expiresAt": "2026-01-27T21:00:00Z",
    "fileSize": 2048576
  }
}
```

---

## 8. ORGANIZATION & USER ENDPOINTS

### 8.1 GET /organizations/current

Get current organization details.

**Headers:**
```
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "organization": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "subscriptionTier": "pro",
      "screenQuota": 50,
      "usedScreens": 45,
      "billingEmail": "billing@acme.com",
      "subscriptionStatus": "active",
      "trialEndsAt": null,
      "currentPeriodStart": "2026-01-01T00:00:00Z",
      "currentPeriodEnd": "2026-02-01T00:00:00Z",
      "features": [
        "unlimited_content",
        "advanced_scheduling",
        "analytics_export",
        "priority_support",
        "white_label"
      ],
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-26T21:00:00Z"
    }
  }
}
```

### 8.2 PATCH /organizations/current

Update organization details.

**Headers:**
```
Authorization: Bearer {token}
```

**Permissions:** Admin only

**Request:**
```json
{
  "name": "Acme Corporation",
  "billingEmail": "newbilling@acme.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "organization": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Acme Corporation",
      "billingEmail": "newbilling@acme.com",
      "updatedAt": "2026-01-26T21:00:00Z"
    }
  }
}
```

### 8.3 GET /users

List organization users.

**Headers:**
```
Authorization: Bearer {token}
```

**Permissions:** Admin, Manager

**Query Parameters:**
```
?role=manager&isActive=true&page=1&limit=20
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "admin@acme.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "admin",
        "isActive": true,
        "lastLoginAt": "2026-01-26T20:00:00Z",
        "createdAt": "2026-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

### 8.4 POST /users/invite

Invite new user to organization.

**Headers:**
```
Authorization: Bearer {token}
```

**Permissions:** Admin only

**Request:**
```json
{
  "email": "newuser@acme.com",
  "role": "manager",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "email": "newuser@acme.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "role": "manager",
      "isActive": false,
      "invitedAt": "2026-01-26T21:00:00Z"
    },
    "inviteLink": "https://app.vizora.com/accept-invite/abc123xyz",
    "inviteExpiresAt": "2026-02-02T21:00:00Z"
  }
}
```

### 8.5 PATCH /users/:userId

Update user details.

**Headers:**
```
Authorization: Bearer {token}
```

**Permissions:** Admin only

**Request:**
```json
{
  "role": "admin",
  "isActive": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "role": "admin",
      "isActive": true,
      "updatedAt": "2026-01-26T21:05:00Z"
    }
  }
}
```

### 8.6 DELETE /users/:userId

Remove user from organization.

**Headers:**
```
Authorization: Bearer {token}
```

**Permissions:** Admin only

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User removed successfully"
}
```

---

## 9. BILLING ENDPOINTS

### 9.1 GET /billing/subscription

Get current subscription details.

**Headers:**
```
Authorization: Bearer {token}
```

**Permissions:** Admin only

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_abc123",
      "status": "active",
      "tier": "pro",
      "screenQuota": 50,
      "price": 99.00,
      "currency": "usd",
      "interval": "month",
      "currentPeriodStart": "2026-01-01T00:00:00Z",
      "currentPeriodEnd": "2026-02-01T00:00:00Z",
      "cancelAtPeriodEnd": false,
      "canceledAt": null
    },
    "usage": {
      "screens": 45,
      "quota": 50,
      "utilizationPercent": 90
    },
    "upcomingInvoice": {
      "amount": 99.00,
      "currency": "usd",
      "date": "2026-02-01T00:00:00Z"
    }
  }
}
```

### 9.2 POST /billing/checkout

Create Stripe checkout session.

**Headers:**
```
Authorization: Bearer {token}
```

**Permissions:** Admin only

**Request:**
```json
{
  "tier": "enterprise",
  "screenQuota": 200,
  "billingInterval": "yearly"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_abc123",
    "sessionId": "cs_test_abc123"
  }
}
```

### 9.3 POST /billing/portal

Get Stripe customer portal link.

**Headers:**
```
Authorization: Bearer {token}
```

**Permissions:** Admin only

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "portalUrl": "https://billing.stripe.com/p/session/cs_test_abc123"
  }
}
```

### 9.4 GET /billing/invoices

List billing invoices.

**Headers:**
```
Authorization: Bearer {token}
```

**Permissions:** Admin only

**Query Parameters:**
```
?page=1&limit=10
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "in_abc123",
        "amount": 99.00,
        "currency": "usd",
        "status": "paid",
        "periodStart": "2026-01-01T00:00:00Z",
        "periodEnd": "2026-02-01T00:00:00Z",
        "invoicePdf": "https://stripe.com/invoices/in_abc123.pdf",
        "createdAt": "2026-01-01T00:00:00Z",
        "paidAt": "2026-01-01T00:05:00Z"
      }
    ],
    "pagination": {
      "total": 12,
      "page": 1,
      "limit": 10,
      "totalPages": 2
    }
  }
}
```

---

## 10. ERROR CODES REFERENCE

### Authentication Errors (AUTH_*)
- **AUTH_001**: Invalid credentials
- **AUTH_002**: Token expired
- **AUTH_003**: Invalid token
- **AUTH_004**: Account inactive
- **AUTH_005**: Account locked

### Authorization Errors (AUTHZ_*)
- **AUTHZ_001**: Insufficient permissions
- **AUTHZ_002**: Resource not found
- **AUTHZ_003**: Organization mismatch

### Device Errors (DEVICE_*)
- **DEVICE_001**: Invalid pairing code
- **DEVICE_002**: Pairing code expired
- **DEVICE_003**: Screen quota exceeded
- **DEVICE_004**: Device offline
- **DEVICE_005**: Device already paired

### Content Errors (CONTENT_*)
- **CONTENT_001**: Upload failed
- **CONTENT_002**: File too large
- **CONTENT_003**: Unsupported file type
- **CONTENT_004**: Processing failed
- **CONTENT_005**: CORS check failed
- **CONTENT_006**: Content in use (cannot delete)

### Playlist Errors (PLAYLIST_*)
- **PLAYLIST_001**: Invalid content items
- **PLAYLIST_002**: Playlist in use (cannot delete)

### Schedule Errors (SCHEDULE_*)
- **SCHEDULE_001**: Invalid CRON expression
- **SCHEDULE_002**: Schedule conflict

### Validation Errors (VALIDATION_*)
- **VALIDATION_001**: Required field missing
- **VALIDATION_002**: Invalid format
- **VALIDATION_003**: Value out of range

### System Errors (SYSTEM_*)
- **SYSTEM_001**: Database error
- **SYSTEM_002**: External service unavailable
- **SYSTEM_003**: Internal server error

---

## APPENDIX: API Testing Examples

### cURL Examples

**Login:**
```bash
curl -X POST https://api.vizora.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"SecurePass123!"}'
```

**List Devices:**
```bash
curl -X GET "https://api.vizora.com/api/devices?status=online" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Upload Content:**
```bash
curl -X POST https://api.vizora.com/api/content/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpg" \
  -F "title=My Image" \
  -F "type=image"
```

---

**Document End**

*This is a living document. Last updated: January 26, 2026*
