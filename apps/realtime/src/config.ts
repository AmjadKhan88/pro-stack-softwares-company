export interface Config {
  port: number;
  tokenSecret: string;
  emitSecret: string;
  origins: string[];
}

/** Reads the settings and refuses to start (with a plain message) if any are wrong. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = [];
  const tokenSecret = env.REALTIME_TOKEN_SECRET ?? "";
  const emitSecret = env.REALTIME_EMIT_SECRET ?? "";
  if (tokenSecret.length < 32) problems.push("REALTIME_TOKEN_SECRET must be at least 32 characters.");
  if (emitSecret.length < 32) problems.push("REALTIME_EMIT_SECRET must be at least 32 characters.");
  if (tokenSecret && tokenSecret === emitSecret) problems.push("The two secrets must be different.");

  const origins = (env.WEB_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0)
    problems.push("WEB_ORIGINS must list your website address, e.g. https://example.com");
  for (const origin of origins) {
    if (!/^https?:\/\/[^/\s]+$/.test(origin))
      problems.push(
        `WEB_ORIGINS entry "${origin}" must look like https://example.com (no slash at the end).`,
      );
  }

  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push("PORT must be a number.");

  if (problems.length > 0)
    throw new Error(`The live service is not set up correctly:\n- ${problems.join("\n- ")}`);
  return { port, tokenSecret, emitSecret, origins };
}
