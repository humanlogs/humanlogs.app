# Transcription Project

A full-stack application with TypeScript backend and React frontend.

## Project Structure

```
transcription/
├── backend/          # TypeScript Express.js server
└── frontend/         # React + TypeScript + Vite + shadcn/ui
```

## Getting Started

### Backend Setup

```bash
cd backend
npm install
npm run dev
```

The backend server will start on http://localhost:3001

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend application will start on http://localhost:5173

## Development Workflow

1. Start the backend server first:
   ```bash
   cd backend && npm run dev
   ```

2. In a new terminal, start the frontend:
   ```bash
   cd frontend && npm run dev
   ```

3. Open http://localhost:5173 in your browser

## Features

### Backend
- TypeScript with Express.js
- CORS enabled for frontend communication
- Environment variables support
- Hot reload with nodemon
- Health check endpoints

### Frontend
- React 18 with TypeScript
- Vite for fast development
- Tailwind CSS for styling
- shadcn/ui component library
- Path aliases configured (@/* imports)
- Backend API integration example

## Available Scripts

### Backend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## VS Code Integration

Both projects include:
- Copilot instructions for better code suggestions
- TypeScript configuration
- Proper linting and formatting setup

The projects are ready for development and can communicate with each other via the configured CORS settings.