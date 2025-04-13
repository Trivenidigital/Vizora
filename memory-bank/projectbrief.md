# Vizora Digital Signage Platform

## Project Overview
Vizora is a modern digital signage platform designed for retail, restaurant, and display environments. The system enables real-time management of content across multiple displays with QR-based pairing between devices and a central management dashboard.

## Core Requirements
1. Real-time display status monitoring
2. Content management and scheduling
3. QR-based device pairing system
4. Socket.IO-based communication for live updates
5. Support for various content types (images, videos, HTML)
6. Display metrics tracking
7. Responsive web admin interface
8. TV interface for content display

## Project Goals
- Create a seamless device pairing experience
- Ensure reliable real-time updates between devices
- Develop a modern, responsive admin interface
- Build a scalable architecture that separates concerns
- Support scheduled content delivery with prioritization
- Enable detailed monitoring of display status

## Technical Stack
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Socket.IO for real-time communication
- Node.js backend (Express)
- RESTful API architecture
- MongoDB for data storage
- Microfrontend-inspired architecture with modular components

## Architecture Overview
The project follows a microfrontend-aligned architecture with distinct applications:
- **VizoraWeb**: Admin dashboard for content management
- **VizoraTV**: Display application showing content and handling pairing
- **VizoraMiddleware**: Backend services handling API requests and socket connections
- **VizoraDisplay**: Content orchestration and display management
- **common**: Shared utilities, types, and connection management

## Project Scope
The initial scope includes:
- User authentication and authorization
- Display registration and pairing
- Content upload and management
- Scheduling system for content
- Real-time status monitoring
- Basic analytics and reporting 