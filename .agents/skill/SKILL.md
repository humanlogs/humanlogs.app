---
name: transcription-app
description: Audio HumanLogslication with ElevenLabs integration, project management, and multi-speaker support. Includes architecture, data models, and feature requirements for the transcription workflow.
---

# HumanLogs

## Overview

A Next.js application for audio transcription with project management, multi-speaker support, and vocabulary customization. Users can upload audio files, track transcription progress, and edit transcriptions through an intuitive interface.

## Tech Stack

### Frontend

- **Framework**: Next.js (App Router)
- **UI Components**: shadcn/ui (Badge, Button, Input, ScrollArea, Separator, Sheet, Sidebar, Skeleton, Tooltip)
- **Styling**: Tailwind CSS
- **TypeScript**: Strict type checking

### Backend

- **Transcription Service**: ElevenLabs API
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Auth0
- **File Storage**: AWS S3 for audio files
- **API**: Next.js API routes

## Application Structure

### Pages

#### 1. Login Page

- **Status**: Not implemented initially
- **Auth**: Auth0 integration
- **Purpose**: User authentication gateway

#### 2. New Transcription Page (Default)

- **Route**: `/` (home page)
- **Features**:
  - Audio file upload (drag & drop + file picker)
  - Optional JSON upload (pre-transcribed word-level data)
  - Language selector
  - Custom vocabulary input (for domain-specific terms)
  - Number of speakers selector
  - Start transcription button

#### 3. Transcription Editor Page

- **Route**: `/transcription/[id]`
- **States**:
  - `error`: Display error message with retry option
  - `transcribing`: Show progress indicator and status
  - `not found`: 404 state for invalid transcription IDs
  - `editor`: Rich text editor for completed transcriptions

### Sidebar Layout

Located on the left side of all pages:

1. **New Transcription Button**
   - Quick action to create new transcription
   - Always visible at top

2. **Search Bar**
   - Search across all transcriptions
   - Filter by project, date, or content

3. **Project Name Section**
   - Display current project name
   - Edit button on hover to rename project
   - Expandable/collapsible

4. **Transcription List (per project)**
   - Ordered by most recent first
   - Show transcription title/name
   - Show status badge (transcribing, completed, error)
   - Click to navigate to editor

5. **"No Project" Section**
   - At the bottom
   - Contains all unassigned transcriptions
   - Same list behavior as project transcriptions

### Main Content Area

- Right side of the application
- Currently blank (will be filled by page content)
- Responsive layout that adapts to sidebar state

## Data Model

### Database Schema (Prisma)

```prisma
model User {
  id              String          @id @default(uuid())
  auth0Id         String          @unique
  email           String          @unique
  name            String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  transcriptions  Transcription[]
  projects        Project[]
}

model Project {
  id              String          @id @default(uuid())
  name            String
  userId          String
  user            User            @relation(fields: [userId], references: [id])
  transcriptions  Transcription[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

model Transcription {
  id              String          @id @default(uuid())
  userId          String
  user            User            @relation(fields: [userId], references: [id])
  projectId       String?
  project         Project?        @relation(fields: [projectId], references: [id])

  // File storage
  audioFileKey    String          // S3 key for audio file
  audioFileName   String          // Original filename
  audioFileSize   Int             // File size in bytes

  // Transcription data
  transcription   Json?           // In-database transcription result
  language        String          // Language code (e.g., "en", "fr")
  vocabulary      String[]        // Custom vocabulary terms
  speakerCount    Int             @default(1)

  // Status tracking
  state           TranscriptionState @default(PENDING)
  errorMessage    String?

  // Timestamps
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  completedAt     DateTime?

  @@index([userId])
  @@index([projectId])
  @@index([state])
}

enum TranscriptionState {
  PENDING
  COMPLETED
  ERROR
}
```

## API Integration

### ElevenLabs API

- **Endpoint**: Speech-to-Text API
- **Features**:
  - Multi-speaker diarization
  - Custom vocabulary support
  - Language detection/specification
  - Word-level timestamps

### S3 Storage

- **Bucket**: Audio files only
- **Naming**: `{userId}/{transcriptionId}/{originalFilename}`
- **Signed URLs**: For secure upload/download

### Auth0

- **Flow**: Authorization Code Flow with PKCE
- **JWT**: Store user session
- **User Info**: Sync with database on login

## Implementation Phases

### Phase 1: Core UI (Current Focus)

- [ ] Sidebar component with navigation
- [ ] Project management UI
- [ ] Transcription list component
- [ ] Basic layout structure
- [ ] New transcription form

### Phase 2: Backend Setup

- [ ] Prisma schema definition
- [ ] Database migrations
- [ ] Auth0 integration
- [ ] S3 bucket setup
- [ ] API route structure

### Phase 3: Transcription Flow

- [ ] File upload to S3
- [ ] ElevenLabs API integration
- [ ] Transcription status polling
- [ ] Error handling
- [ ] Progress indicators

### Phase 4: Editor & Features

- [ ] Transcription editor component
- [ ] Search functionality
- [ ] Project management (create, rename, delete)
- [ ] Export functionality
- [ ] User settings

## File Structure

```
/app
  /layout.tsx              # Root layout with sidebar
  /page.tsx                # New transcription page
  /transcription/[id]/
    /page.tsx              # Transcription editor
  /api/
    /transcriptions/
      /route.ts            # CRUD operations
      /[id]/
        /route.ts          # Single transcription ops
        /status/route.ts   # Status polling
    /upload/route.ts       # S3 signed URL generation
    /auth/[...auth0]/route.ts

/components
  /sidebar/
    /app-sidebar.tsx       # Main sidebar component
    /project-list.tsx      # Project and transcription list
    /search-bar.tsx        # Search component
  /transcription/
    /upload-form.tsx       # New transcription form
    /editor.tsx            # Transcription editor
    /status-badge.tsx      # Status indicator
  /ui/                     # shadcn components

/lib
  /prisma.ts               # Prisma client
  /s3.ts                   # S3 utilities
  /elevenlabs.ts           # ElevenLabs API client
  /auth0.ts                # Auth0 utilities

/prisma
  /schema.prisma           # Database schema
  /migrations/             # Migration history
```

## Development Notes

- Use Server Components by default, Client Components only when needed (interactivity, hooks)
- Implement optimistic UI updates for better UX
- Use React Query/SWR for data fetching and caching
- Implement proper error boundaries
- Add loading skeletons for async operations
- Use Zod for runtime validation
- Implement proper TypeScript types for all API responses
