import { connection } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth/auth";

// Created per request from the lazily-built auth instance; `connection()` keeps these handlers dynamic.
export async function GET(request: Request) {
  await connection();
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  await connection();
  return toNextJsHandler(getAuth()).POST(request);
}
