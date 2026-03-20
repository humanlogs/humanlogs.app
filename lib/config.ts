import config from "config";
import { z } from "zod";

// Define the configuration schema
const configSchema = z.object({
  auth0: z.object({
    secret: z.string(),
    baseUrl: z.string().url(),
    issuerBaseUrl: z.string().url(),
    clientId: z.string(),
    clientSecret: z.string(),
  }),
  database: z.object({
    url: z.string(),
  }),
  aws: z.object({
    region: z.string(),
    s3: z.object({
      bucketName: z.string(),
    }),
  }),
  elevenlabs: z.object({
    apiKey: z.string(),
  }),
  server: z.object({
    port: z.number(),
  }),
});

export type AppConfig = z.infer<typeof configSchema>;

// Helper to get configuration with validation
// Note: Only use this in server-side code (API routes, Server Components)
// NOT in middleware/proxy (Edge Runtime)
export function getConfig(): AppConfig {
  // In production, validate the config
  // In development, allow partial config for easier setup
  if (process.env.NODE_ENV === "production") {
    return configSchema.parse(config);
  }

  // For development, return config as-is (TypeScript will still check types)
  return config as unknown as AppConfig;
}

// Export individual config sections for convenience
// Auth0 config uses ONLY environment variables (Edge Runtime compatible)
export const auth0Config = {
  secret: config.get<string>("auth0.secret"),
  baseUrl: config.get<string>("auth0.baseUrl"),
  issuerBaseUrl: config.get<string>("auth0.issuerBaseUrl"),
  clientId: config.get<string>("auth0.clientId"),
  clientSecret: config.get<string>("auth0.clientSecret"),
};

export const databaseConfig = {
  url: config.get<string>("database.url"),
};

export const awsConfig = {
  region: config.get<string>("aws.region"),
  accessKeyId: config.get<string>("aws.accessKeyId"),
  secretAccessKey: config.get<string>("aws.accessKeySecret"),
  s3: {
    bucketName: config.get<string>("aws.s3.bucketName"),
  },
};

export const elevenlabsConfig = {
  apiKey: config.get<string>("elevenlabs.apiKey"),
};
