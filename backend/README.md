# Backend - TypeScript Express Server

A TypeScript backend application built with Express.js.

## Features

- TypeScript for type safety
- Express.js web framework
- CORS enabled for cross-origin requests
- Environment variables support with dotenv
- Development server with hot reload using nodemon

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The server will start on http://localhost:3001

### Production

```bash
npm run build
npm start
```

## API Endpoints

- `GET /` - Health check endpoint
- `GET /api/health` - API health status

## Project Structure

```
backend/
├── src/
│   └── index.ts      # Main application file
├── dist/             # Compiled JavaScript files
├── package.json
├── tsconfig.json
└── .env              # Environment variables
```

## Environment Variables

Create a `.env` file in the root directory:

```
PORT=3001
NODE_ENV=development
```
