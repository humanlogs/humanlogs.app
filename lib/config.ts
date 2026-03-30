import config from "config";
import { z } from "zod";

// Define the configuration schema
const configSchema = z.object({
  auth: z.object({
    mode: z.enum(["auth0", "local"]),
    sessionSecret: z.string().optional(),
    auth0: z.object({
      secret: z.string(),
      baseUrl: z.string().url(),
      issuerBaseUrl: z.string().url(),
      clientId: z.string(),
      clientSecret: z.string(),
    }),
    ldap: z
      .object({
        enabled: z.boolean(),
        url: z.string(),
        bindDN: z.string(),
        bindPassword: z.string(),
        searchBase: z.string(),
        searchFilter: z.string(),
      })
      .optional(),
  }),
  database: z.object({
    url: z.string(),
  }),
  aws: z.object({
    region: z.string(),
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
    s3: z.object({
      bucketName: z.string(),
    }),
  }),
  elevenlabs: z.object({
    apiKey: z.string(),
    canDisableStorage: z.boolean().optional(),
  }),
  email: z
    .object({
      provider: z.enum(["smtp", "ses"]).optional(),
      from: z
        .object({
          name: z.string(),
          address: z.string().email(),
        })
        .optional(),
      smtp: z
        .object({
          host: z.string(),
          port: z.number(),
          secure: z.boolean(),
          auth: z.object({
            user: z.string(),
            pass: z.string(),
          }),
        })
        .optional(),
      ses: z
        .object({
          region: z.string(),
        })
        .optional(),
    })
    .optional(),
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
export const authConfig = {
  mode: config.get<"auth0" | "local">("auth.mode"),
  sessionSecret: config.get<string>("auth.sessionSecret"),
};

// Auth0 config uses ONLY environment variables (Edge Runtime compatible)
export const auth0Config = {
  secret: config.get<string>("auth.auth0.secret"),
  baseUrl: config.get<string>("auth.auth0.baseUrl"),
  issuerBaseUrl: config.get<string>("auth.auth0.issuerBaseUrl"),
  clientId: config.get<string>("auth.auth0.clientId"),
  clientSecret: config.get<string>("auth.auth0.clientSecret"),
};

export const ldapConfig = {
  enabled: config.get<boolean>("auth.ldap.enabled"),
  url: config.get<string>("auth.ldap.url"),
  bindDN: config.get<string>("auth.ldap.bindDN"),
  bindPassword: config.get<string>("auth.ldap.bindPassword"),
  searchBase: config.get<string>("auth.ldap.searchBase"),
  searchFilter: config.get<string>("auth.ldap.searchFilter"),
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
  canDisableStorage:
    config.get<boolean>("elevenlabs.canDisableStorage") || false,
};
