import "server-only";
import pino from "pino";
import { getServerEnv } from "@/lib/env";

export const logger = pino({
  level: getServerEnv().LOG_LEVEL,
  redact: {
    paths: [
      "password",
      "token",
      "authorization",
      "cookie",
      "*.password",
      "*.token",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[redacted]",
  },
});
