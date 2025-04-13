# Vizora Architecture Manifest

## Overview
Vizora is a multi-app digital signage platform designed for modern retail, restaurant, and display environments. It supports real-time pairing of TV devices with a central admin dashboard, and allows for automated display of content fetched from Google Drive and future integrations (e.g., social media).

## Core Apps

### 1. VizoraWeb (`Redesign/VizoraWeb`)
- Admin interface
- Built in React + TypeScript
- TailwindCSS + Shadcn UI
- Manages pairing, scheduling, and content targeting
- Uses VITE_API_URL to talk to middleware

### 2. VizoraTV (`Redesign/VizoraTV`)
- QR-based TV display app
- Socket.IO for real-time updates
- Displays scheduled or fallback content
- Uses shared connection layer via `ConnectionManager`

### 3. VizoraMiddleware (`Redesign/VizoraMiddleware`)
- Node.js backend (Express)
- Handles REST endpoints and Socket.IO
- Routes: `/api/devices/pair`, `/api/displays`, `/api/devices/register`, etc.
- Maintains device pairing sessions and socket state

### 4. VizoraDisplay (`Redesign/VizoraDisplay`)
- Content orchestration engine
- Manages playback queue, transitions, screen zones

### 5. Common (`Redesign/common`)
- Shared modules, types, socket logic
- `ConnectionManager.ts` (centralized Socket.IO wrapper)
- Enums: `ConnectionState`, etc.
- Shared services and logger utilities

## Architecture Principles
- Microfrontend-aligned modularity
- No duplicate logic between apps
- Strict socket state management
- All socket activity routed through root namespace (`/`)
- Socket events logged clearly for debugging
- Use `ConnectionManager` everywhere to avoid manual socket handling

## Dev Guidelines
- Use `;` for command chaining in PowerShell
- VITE_API_URL must point to `http://localhost:3003`
- No inline styles or CSS files — Tailwind only
- Avoid re-creating existing components

## Quality
- Real-time logging with emojis
- Diagnostic screen at startup
- Robust state persistence in localStorage
- Fully typed interfaces for all API responses
- Each device must pass validation before requesting QR code

## Deployment
- Local: Run `npm install ; npm run dev` in each subfolder
- Hosting strategy: TBD based on scalability goals (e.g., Vercel for Web, custom node for Middleware)

## Notes
- TV app must not show spinner infinitely — fallback if API fails
- Pairing only valid after admin confirmation
- App uses `deviceId` and `socket.id` to validate state before generating pairing codes

---
