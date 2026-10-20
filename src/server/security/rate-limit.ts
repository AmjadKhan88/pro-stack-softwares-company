import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import { connectToDatabase } from "@/server/db/mongoose";

interface RateLimitDoc {
  key: string;
  count: number;
  expiresAt: Date;
}

const rateLimitSchema = new Schema<RateLimitDoc>({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true },
});
// MongoDB deletes expired windows automatically.
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit: Model<RateLimitDoc> =
  (models.RateLimit as Model<RateLimitDoc> | undefined) ?? model<RateLimitDoc>("RateLimit", rateLimitSchema);

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

interface ConsumeOptions {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}

/** Fixed-window limiter backed by MongoDB. Atomic via upsert + $inc. */
export async function consumeRateLimit({ scope, identifier, limit, windowSeconds }: ConsumeOptions) {
  await connectToDatabase();
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = `${scope}:${identifier}:${windowStart}`;
  const expiresAt = new Date(windowStart + windowMs);

  const run = () =>
    RateLimit.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after" },
    );

  let doc;
  try {
    doc = await run();
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    doc = await run(); // two requests raced on first insert; retry once
  }

  const count = doc?.count ?? 1;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.ceil((windowStart + windowMs - now) / 1000),
  };
}
