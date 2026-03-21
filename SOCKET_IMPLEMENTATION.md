# Socket.io + React Query Real-Time Updates

## Overview

This implementation provides real-time database updates using Socket.io and TanStack Query.

## Architecture

### Backend (Socket.io Server)

- **File**: `server.ts` - Custom Next.js server with Socket.io integration
- **File**: `lib/socket-server.ts` - Socket.io initialization and event emission
- **File**: `lib/prisma.ts` - Prisma middleware to detect database changes

### Frontend (React Query + Socket.io Client)

- **File**: `lib/socket-client.ts` - Socket.io client with automatic query invalidation
- **File**: `components/socket-provider.tsx` - Provider that initializes socket connection
- **File**: `components/query-provider.tsx` - TanStack Query setup
- **File**: `hooks/use-api.ts` - React Query hooks for all API calls

## How It Works

1. **Database Changes**: When a Transcription, Project, or User is created/updated/deleted
2. **Prisma Middleware**: Detects the change using `$extends` API
3. **Socket Emission**: Emits `db:change` event to user-specific room (`user:${userId}`)
4. **Client Reception**: Socket client receives event
5. **Query Invalidation**: Automatically invalidates matching React Query caches
6. **UI Update**: Components re-fetch data and update automatically

## Query Keys

Query keys match table names for automatic invalidation:

- `["projects"]` - All projects
- `["transcriptions"]` - All transcriptions
- `["user"]` - User profile

## Starting the Server

```bash
npm run dev
```

This runs `tsx watch server.ts` which starts the custom server with Socket.io support.

## User Rooms

Each user joins a room based on their ID (`user:${userId}`), ensuring they only receive updates for their own data.

## Security Note

⚠️ The current implementation passes `userId` via query parameter for development. In production, you should:

1. Pass JWT token from client
2. Verify token on server
3. Extract userId from verified token
4. Join user to their room

## Testing

1. Start the server: `npm run dev`
2. Open the application in browser
3. Check console for "Socket connected" message
4. Create/update a transcription
5. Watch the sidebar update automatically without manual refresh
