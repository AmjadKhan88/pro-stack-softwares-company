import { NextResponse } from "next/server";
import { authorizeFileDownload } from "@/features/files/access";
import { contentDisposition, contentTypeForFormat, downloadFilename } from "@/features/files/rules";
import { logger } from "@/server/logger";
import { hashIdentifier } from "@/server/security/ip";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { buildPrivateDownloadUrl } from "@/server/services/cloudinary-files";

const reply = (status: number, message: string) => NextResponse.json({ error: message }, { status });

/**
 * The ONLY way to download a private file. Every request checks who is signed in and whether they may have this file.
 * Only then does the server ask Cloudinary for a link that lasts 60 seconds, fetch the file itself, and pass it on.
 * The browser never receives a Cloudinary address.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const decision = await authorizeFileDownload(id);
    if (!decision.ok) {
      return decision.reason === "unauthenticated"
        ? reply(401, "Please sign in.")
        : reply(404, "File not found.");
    }

    const limit = await consumeRateLimit({
      scope: "file-download",
      identifier: hashIdentifier(decision.userId),
      limit: 120,
      windowSeconds: 60 * 60,
    });
    if (!limit.allowed) return reply(429, "Too many downloads. Please try again later.");

    const { file } = decision;
    const upstream = await fetch(buildPrivateDownloadUrl({ publicId: file.publicId, format: file.format }), {
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!upstream.ok || !upstream.body) {
      logger.warn(
        { fileId: file.id, status: upstream.status },
        "private file could not be fetched from storage",
      );
      return reply(502, "The file couldn't be retrieved. Please try again.");
    }

    logger.info({ fileId: file.id, userId: decision.userId }, "private file downloaded");
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentTypeForFormat(file.format) ?? "application/octet-stream",
        "Content-Disposition": contentDisposition(downloadFilename(file.originalFilename, file.format)),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logger.error({ err: error }, "private file download failed");
    return reply(502, "The file couldn't be retrieved. Please try again.");
  }
}
