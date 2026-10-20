import { randomInt } from "node:crypto";

// No 0/O/1/I/L so codes are easy to read aloud or type.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateReferenceCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `PSC-${code}`;
}