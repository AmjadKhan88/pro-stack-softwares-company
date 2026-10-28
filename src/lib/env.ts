import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  MONGODB_URI: z.string().min(1).optional(),
  MONGODB_DB_NAME: z.string().min(1).optional(),
  IP_HASH_SALT: z.string().min(32).optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  GMAIL_USER: z.string().email().optional(),
  GMAIL_APP_PASSWORD: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  OWNER_BOOTSTRAP_EMAIL: z.email().optional(),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_ALLOW_INDEXING: z.enum(["true", "false"]).default("false"),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

/** A blank value in .env (e.g. `GMAIL_APP_PASSWORD=`) means "not set", not "invalid". */
function withoutBlanks(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== "" && value !== undefined),
  );
}

/** Parses server env on demand (not at import) so builds never need secrets. */
export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverSchema.safeParse(withoutBlanks(source));
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment variables: ${names}. See ENVIRONMENT.md.`);
  }
  return parsed.data;
}

export function getPublicEnv(source: NodeJS.ProcessEnv = process.env): PublicEnv {
  const clean = withoutBlanks(source);
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_APP_URL: clean.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_ALLOW_INDEXING: clean.NEXT_PUBLIC_ALLOW_INDEXING,
  });
  if (!parsed.success) {
    throw new Error(
      "Invalid NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_ALLOW_INDEXING. The URL must be a full URL such as https://example.com and indexing must be 'true' or 'false'.",
    );
  }
  return parsed.data;
}

/** Returns the Mongo settings or throws a clear setup message (never pretends to succeed). */
export function requireMongoEnv(source: NodeJS.ProcessEnv = process.env) {
  const env = getServerEnv(source);
  if (!env.MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Add your MongoDB Atlas connection string to .env (see ENVIRONMENT.md).",
    );
  }
  return { uri: env.MONGODB_URI, dbName: env.MONGODB_DB_NAME };
}

/** Auth secret and the public base URL used for links in emails and cookies. */
export function requireAuthEnv(source: NodeJS.ProcessEnv = process.env) {
  const env = getServerEnv(source);
  if (!env.BETTER_AUTH_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" (see ENVIRONMENT.md).",
    );
  }
  return {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: getPublicEnv(source).NEXT_PUBLIC_APP_URL.replace(/\/+$/, ""),
  };
}
