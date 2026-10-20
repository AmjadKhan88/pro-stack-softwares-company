import "server-only";
import mongoose from "mongoose";
import { requireMongoEnv } from "@/lib/env";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalCache = globalThis as unknown as { __mongoose?: Cache };
const cache: Cache = (globalCache.__mongoose ??= { conn: null, promise: null });

/** Connects lazily and reuses one connection (important for dev hot reload and serverless). */
export async function connectToDatabase() {
  if (cache.conn) return cache.conn;
  const { uri, dbName } = requireMongoEnv();
  cache.promise ??= mongoose.connect(uri, { dbName, bufferCommands: false });
  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
