# Vizora MongoDB Integration

This document outlines the MongoDB integration implemented for the Vizora application to support user authentication and display management.

## Architecture

- **Backend**: The VizoraMiddleware now includes MongoDB support for user and display persistence.
- **Frontend**: The frontend application has been updated to support authentication and user-specific display management.

## Components Implemented

### Backend (VizoraMiddleware)

1. **MongoDB Connection**
   - Setup of MongoDB configuration in `config/db.ts`
   - Connection management with error handling

2. **Models**
   - `User` model with password hashing and authentication methods
   - `Display` model with user association for ownership tracking

3. **Authentication Controllers**
   - User registration (signup)
   - User login with JWT token generation
   - Protected route middleware
   - User profile retrieval

4. **Display Controllers**
   - List user's displays
   - Get display details
   - Claim a display (associate with a user)
   - Update display information
   - Release a display (remove user association)

5. **API Routes**
   - Authentication routes
   - Display management routes
   - Protected route middleware integration

6. **Display Database Service**
   - Synchronization between Redis (real-time state) and MongoDB (persistence)
   - Methods to save, retrieve, and manage displays

### Frontend

1. **Authentication Components**
   - Login form with API integration
   - Registration form with API integration
   - Protected route component to secure app routes

2. **Authentication Utilities**
   - JWT token management
   - User state management
   - Authenticated API request helpers

3. **Display Management**
   - User displays listing component
   - Display claiming interface
   - Display management functions (release, update)

## Features

- **User Registration**: Users can sign up with name, email, and password
- **User Authentication**: Secure login with JWT tokens
- **Display Ownership**: Displays can be claimed by users and tied to their accounts
- **Display Management**: Users can manage only their own displays
- **Persistence**: All user and display data is persistently stored in MongoDB

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/login` - Authenticate a user and get JWT token
- `GET /api/auth/me` - Get current user profile (protected)

### Displays

- `GET /api/displays` - Get all displays owned by the current user (protected)
- `GET /api/displays/:id` - Get a specific display by ID (protected)
- `POST /api/displays/claim` - Claim a display using a pairing code (protected)
- `PATCH /api/displays/:id` - Update a display's information (protected)
- `POST /api/displays/:id/release` - Release a display (protected)

## Getting Started

1. Make sure MongoDB is installed and running
2. Set the MongoDB connection string in environment variables or use the default `mongodb://localhost:27017/vizora`
3. Start the middleware server which will connect to MongoDB
4. Access the frontend application and register a new user
5. Login and start managing your displays

## Technical Notes

- Password hashing is handled using bcrypt
- Authentication uses JWT tokens stored in localStorage
- The middleware serves as both the WebSocket server and REST API server
- Redis is still used for real-time state, while MongoDB provides persistence 