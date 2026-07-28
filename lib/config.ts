import config from "config";
import { z } from "zod";

// Custom boolean coercion that properly handles string "false", "0", etc.
const booleanSchema = z
  .union([z.boolean(), z.string(), z.number()])
  .transform((val) => {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
      const lower = val.toLowerCase().trim();
      return lower !== "false" && lower !== "0" && lower !== "";
    }
    return Boolean(val);
  });

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
        enabled: booleanSchema,
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
  stt: z.object({
    type: z.preprocess(
      (val) => {
        if (typeof val === "string" && val.includes(",")) {
          return val.split(",").map((s) => s.trim());
        }
        return val;
      },
      z.union([
        z.enum(["elevenlabs", "whisper", "gladia"]),
        z.array(z.enum(["elevenlabs", "whisper", "gladia"])),
      ]),
    ),
    elevenlabs: z.object({
      apiKey: z.string(),
      canDisableStorage: booleanSchema.optional(),
      useWebhook: booleanSchema.optional(),
      webhookSecret: z.string().optional(),
    }),
    whisper: z.object({
      apiUrl: z.string().url(),
      modelSize: z
        .enum(["tiny", "base", "small", "medium", "large"])
        .optional(),
    }),
    gladia: z.object({
      apiKey: z.string(),
      useWebhook: booleanSchema.optional(),
      webhookUrl: z.string().optional(),
    }),
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
          secure: booleanSchema,
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
    publicUrl: z.string().url().default("http://localhost:3000"),
  }),
  stats: z
    .object({
      // Bearer token protecting the /api/stats export. Empty disables the endpoint.
      apiToken: z.string().optional(),
    })
    .optional(),
  security: z
    .object({
      // Pepper used to HMAC email addresses of deleted accounts. Falls back to
      // auth.sessionSecret when empty. Changing it invalidates existing hashes.
      emailHashSecret: z.string().optional(),
      // How long deleted-account credit records are kept. 0 disables the purge.
      deletedAccountRetentionDays: z.coerce.number().int().min(0).default(365),
    })
    .optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

// Helper to get configuration with validation
// Note: Only use this in server-side code (API routes, Server Components)
// NOT in middleware/proxy (Edge Runtime)
export function getConfig(): AppConfig {
  // Always parse config to ensure proper type coercion (e.g., string "false" → boolean false)
  // In development, use safeParse to allow partial config for easier setup
  if (process.env.NODE_ENV === "production") {
    return configSchema.parse(config);
  }

  // In development, still parse to apply coercions, but don't fail on validation errors
  const result = configSchema.safeParse(config);
  if (result.success) {
    return result.data;
  }

  // If validation fails in dev, return config as-is (for easier setup)
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

export const securityConfig = {
  emailHashSecret: config.has("security.emailHashSecret")
    ? config.get<string>("security.emailHashSecret")
    : "",
  deletedAccountRetentionDays: config.has(
    "security.deletedAccountRetentionDays",
  )
    ? Number(config.get<string | number>("security.deletedAccountRetentionDays"))
    : 365,
};

export const statsConfig = {
  apiToken: config.has("stats.apiToken")
    ? config.get<string>("stats.apiToken")
    : "",
};

export const awsConfig = {
  region: config.get<string>("aws.region"),
  accessKeyId: config.get<string>("aws.accessKeyId"),
  secretAccessKey: config.get<string>("aws.secretAccessKey"),
  s3: {
    bucketName: config.get<string>("aws.s3.bucketName"),
  },
};

export const sttConfig = {
  type: config.get<
    | "elevenlabs"
    | "whisper"
    | "gladia"
    | ("elevenlabs" | "whisper" | "gladia")[]
  >("stt.type"),
  elevenlabs: {
    apiKey: config.get<string>("stt.elevenlabs.apiKey"),
    canDisableStorage:
      config.get<boolean>("stt.elevenlabs.canDisableStorage") || false,
    useWebhook: config.get<boolean>("stt.elevenlabs.useWebhook") || false,
    webhookSecret: config.get<string>("stt.elevenlabs.webhookSecret") || "",
  },
  whisper: {
    apiUrl: config.get<string>("stt.whisper.apiUrl"),
    modelSize: config.get<string>("stt.whisper.modelSize") || "base",
  },
  gladia: {
    apiKey: config.get<string>("stt.gladia.apiKey"),
    useWebhook: config.get<boolean>("stt.gladia.useWebhook") || false,
    webhookUrl: config.get<string>("stt.gladia.webhookUrl") || "",
  },
};
