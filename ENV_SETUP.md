# Environment Variables Setup

Since the `config` package doesn't work in Next.js Edge Runtime (proxy/middleware), you need to set Auth0 credentials as environment variables.

## Required Environment Variables

Create a `.env.local` file (or add to your existing `.env`):

```bash
# Auth0 Configuration (REQUIRED for authentication to work)
AUTH0_SECRET=generate-with-openssl-rand-hex-32
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://YOUR_DOMAIN.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret

# AWS S3 (for file uploads)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=transcription-audio-files

# ElevenLabs (for transcription)
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# Database (can also be set in config/development.json)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/transcriptions
```

## Generate AUTH0_SECRET

```bash
openssl rand -hex 32
```

## Config Files vs Environment Variables

You can configure the app using either:

1. **Environment variables** (`.env.local`) - Takes precedence
2. **Config files** (`config/development.json`) - Fallback

For local development, using `config/development.json` for database URL and API keys is convenient, but **Auth0 credentials must be in environment variables** because they're needed in the Edge Runtime proxy.

## After Setup

Restart the dev server:

```bash
yarn dev
```
