import { createHash, randomBytes } from "node:crypto";
import { UPLOAD_FOLDER } from "./rules";

/**
 * Cloudinary's rule: sort the parameters by name, join as name=value with &, append the API secret, hash.
 * (file, cloud_name, resource_type and api_key are never part of it.) SHA-256 and SHA-1 are both accepted.
 */
export function signParams(
  params: Record<string, string | number>,
  apiSecret: string,
  algorithm: "sha256" | "sha1" = "sha256",
): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash(algorithm).update(`${toSign}${apiSecret}`).digest("hex");
}

/** A random, unguessable name chosen by US, so a browser can never pick (or overwrite) a file name. */
export function newPublicId(): string {
  return `${UPLOAD_FOLDER}/${randomBytes(12).toString("hex")}`;
}
