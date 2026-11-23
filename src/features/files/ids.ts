import { randomBytes } from "node:crypto";
import { FILE_FOLDER } from "./rules";

/** A random, unguessable name chosen by US, so a browser can never pick (or overwrite) a file name. */
export function newFilePublicId(): string {
  return `${FILE_FOLDER}/${randomBytes(12).toString("hex")}`;
}
