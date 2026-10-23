import { MongoClient } from "mongodb";
import { requireMongoEnv } from "@/lib/env";

const globalForMongo = globalThis as unknown as { __pscMongoClient?: MongoClient };

/** One shared MongoClient (also reused across dev hot reloads). Connects lazily on first use. */
export function getMongoClient(): MongoClient {
  globalForMongo.__pscMongoClient ??= new MongoClient(requireMongoEnv().uri);
  return globalForMongo.__pscMongoClient;
}

export function getMongoDb() {
  return getMongoClient().db(requireMongoEnv().dbName);
}

/** Closes the shared client if one was ever created (used by one-off scripts). */
export async function closeMongoClient(): Promise<void> {
  await globalForMongo.__pscMongoClient?.close();
}
