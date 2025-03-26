# Vizora - Digital Signage Management System

Vizora is a modern digital signage management system that allows users to manage and control displays remotely.

## Project Structure

```
Vizora/
├── VizoraWeb/          # Frontend React application
└── VizoraMiddleware/   # Backend Node.js server
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Redis (optional)

## Setup Instructions

1. Clone the repository:
```bash
git clone https://github.com/yourusername/vizora.git
cd vizora
```

2. Set up the backend:
```bash
cd VizoraMiddleware
npm install
cp .env.example .env  # Create and configure your environment variables
```

3. Set up the frontend:
```bash
cd ../VizoraWeb
npm install
cp .env.example .env  # Create and configure your environment variables
```

4. Start the development servers:

For backend:
```bash
cd VizoraMiddleware
npm start
```

For frontend:
```bash
cd VizoraWeb
npm run dev
```

## Environment Variables

### Backend (.env)
```
PORT=3003
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
ALLOWED_ORIGINS=http://localhost:5174
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3003/api
```

## Features

- User authentication and authorization
- Display management
- Real-time communication using Socket.IO
- QR code-based display pairing
- Responsive web interface

## Development

- Frontend runs on: http://localhost:5174
- Backend runs on: http://localhost:3003

## License

MIT License - see LICENSE file for details
