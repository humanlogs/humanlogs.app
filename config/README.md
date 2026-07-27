# Configuration Guide

This project uses the [config](https://github.com/node-config/node-config) npm package for configuration management.

## Configuration Files

Configuration is loaded from JSON files in the `/config` directory:

- **`default.json`** - Default values for all environments
- **`development.json`** - Development-specific overrides (NODE_ENV=development)
- **`production.json`** - Production-specific overrides (NODE_ENV=production) - create when deploying
- **`custom-environment-variables.json`** - Maps environment variables to config paths

## How It Works

The config library loads files in this order (later files override earlier ones):

1. `default.json`
2. `{NODE_ENV}.json` (e.g., `development.json`)
3. Environment variables (mapped via `custom-environment-variables.json`)
4. Direct `process.env` access in code

## Environment Variables

You can override any config value using environment variables. The mapping is defined in `custom-environment-variables.json`:

```json
{
  "auth0": {
    "secret": "AUTH0_SECRET",
    "baseUrl": "AUTH0_BASE_URL",
    ...
  }
}
```

This means setting `AUTH0_SECRET=xyz` in your environment will override `config.auth0.secret`.

## Setup for Development

### Option 1: Edit config/development.json (Recommended)

Edit `config/development.json` directly with your local settings:

```json
{
  "database": {
    "url": "postgresql://postgres:postgres@localhost:5432/transcriptions"
  },
  "elevenlabs": {
    "apiKey": "your-api-key"
  }
}
```

This file is gitignored (or should be) for security.

### Option 2: Use Environment Variables

Create a `.env` or `.env.local` file in the root:

```bash
AUTH0_SECRET=your-secret
DATABASE_URL=postgresql://localhost:5432/transcriptions
ELEVENLABS_API_KEY=your-api-key
```

## Usage in Code

```typescript
import config from "config";

// Get a config value
const dbUrl = config.get<string>("database.url");

// Or use the helper (which prefers env vars)
import { databaseConfig } from "@/lib/config";
const url = databaseConfig.url;
```

## Security

- **Never commit secrets** to `default.json`
- Add `development.json` and `production.json` to `.gitignore` if they contain secrets
- Use environment variables for sensitive data in production
- The `.env` file is already gitignored

## Available Configuration

See `config/default.json` for the full configuration structure:

- `auth0` - Auth0 authentication settings
- `database` - PostgreSQL connection URL
- `aws` - AWS S3 settings for file storage
- `elevenlabs` - ElevenLabs API key for transcription
- `server` - Server configuration
- `stats` - Stats export endpoint (`stats.apiToken` / `STATS_API_TOKEN`).
  Set a token to enable the token-protected `GET /api/stats` JSON export used
  by the marketing pipeline (`pipeline/stats-report.ts`). Leave it empty and
  the endpoint stays disabled (404).
- `security` - Anti-abuse settings for the free credit balance.
  - `security.emailHashSecret` / `EMAIL_HASH_SECRET`: pepper used to hash the
    email address of deleted accounts, so a user who deletes their account and
    signs up again gets their old credit balance back instead of a fresh one
    (see `lib/billing/deleted-account-credits.ts`). Defaults to
    `auth.sessionSecret` when empty; changing it invalidates existing hashes,
    which simply means past deletions stop being recognized.
  - `security.deletedAccountRetentionDays` / `DELETED_ACCOUNT_RETENTION_DAYS`:
    how long those hashes are kept (default `365`). A weekly cron job deletes
    older records; set to `0` to keep them forever.
