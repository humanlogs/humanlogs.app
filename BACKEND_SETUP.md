# Backend Setup Guide

## Prerequisites

- Node.js 20+ installed
- PostgreSQL database (local or cloud)
- Auth0 account
- AWS S3 bucket
- ElevenLabs API key

## Initial Setup

### 1. Configuration

The application uses the `config` npm package for configuration management. Configuration is loaded from JSON files in the `/config` directory:

- `default.json` - Default values for all environments
- `development.json` - Development-specific overrides
- `production.json` - Production-specific overrides (create when needed)
- `custom-environment-variables.json` - Maps environment variables to config paths

You can override any config value using environment variables. Create a `.env.local` file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your credentials:

```env
# Auth0 Configuration
AUTH0_SECRET=<generate-with: openssl rand -hex 32>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://YOUR_DOMAIN.auth0.com
AUTH0_CLIENT_ID=<your-auth0-client-id>
AUTH0_CLIENT_SECRET=<your-auth0-client-secret>

# AWS S3
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
AWS_REGION=us-east-1
S3_BUCKET_NAME=transcription-audio-files

# ElevenLabs
ELEVENLABS_API_KEY=<your-elevenlabs-api-key>

# Database (optional - can be set in config/development.json instead)
DATABASE_URL=postgresql://user:password@localhost:5432/transcription_db
```

Alternatively, you can edit `config/development.json` directly for local development settings.

### 2. Auth0 Setup

1. Create an Auth0 application (Regular Web Application)
2. Configure Allowed Callback URLs: `http://localhost:3000/api/auth/callback`
3. Configure Allowed Logout URLs: `http://localhost:3000`
4. Copy your Domain, Client ID, and Client Secret to `.env.local`

### 3. Database Setup

#### Option A: Local PostgreSQL

Install PostgreSQL and create a database:

```bash
# Create database
createdb transcription_db

# Update DATABASE_URL in .env.local
DATABASE_URL=postgresql://localhost:5432/transcription_db
```

#### Option B: Cloud Database (Recommended)

Use a cloud provider like:

- [Supabase](https://supabase.com) (Free tier available)
- [Neon](https://neon.tech) (Free tier available)
- [Railway](https://railway.app)

Copy the connection string to `.env.local`

### 4. Run Migrations

Generate Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Install Dependencies

```bash
npm install
```

## Running the Application

### Development

```bash
npm run dev
```

Visit http://localhost:3000

### Database Management

View database in Prisma Studio:

```bash
npx prisma studio
```

Create a new migration after schema changes:

```bash
npx prisma migrate dev --name describe_your_change
```

Reset database (WARNING: deletes all data):

```bash
npx prisma migrate reset
```

## Project Structure

```
/app
  /api/auth/[auth0]/    # Auth0 routes
  /login/               # Login page
  /page.tsx             # Home/New transcription page

/lib
  /auth0.ts             # Auth0 configuration
  /auth-helpers.ts      # Auth helpers
  /config.ts            # Config management
  /prisma.ts            # Prisma client

/prisma
  /schema.prisma        # Database schema
  /migrations/          # Migration history

/config
  /default.json         # Default configuration
```

## Troubleshooting

### Auth0 Issues

- Ensure callback URLs match exactly
- Check that AUTH0_SECRET is set (generate with `openssl rand -hex 32`)
- Verify domain format: `https://YOUR_DOMAIN.auth0.com` (no trailing slash)

### Database Issues

- Check DATABASE_URL format
- Ensure PostgreSQL is running
- Run `npx prisma generate` after schema changes
- Check Prisma logs with `DEBUG=prisma:* npm run dev`

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

## Next Steps

1. ✅ Auth0 login working
2. ✅ Database schema created
3. 🚧 Build sidebar navigation
4. 🚧 Create transcription upload form
5. 🚧 Integrate ElevenLabs API
6. 🚧 Implement S3 file upload
