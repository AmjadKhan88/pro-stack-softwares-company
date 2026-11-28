import { NextResponse } from "next/server";
import { canManageSales } from "@/features/showcase/access";
import { getProofFile } from "@/features/showcase/order-service";
import { detectImageType } from "@/features/showcase/rules";
import { getCurrentUser } from "@/server/auth/session";

/** The payment screenshot. Only staff who manage sales can see it. Everyone else gets "not found". */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user || !canManageSales(user.role)) return new NextResponse("Not found", { status: 404 });

  const proof = await getProofFile(id);
  if (!proof) return new NextResponse("Not found", { status: 404 });
  // The type comes from the file's real content, never from what a visitor claimed.
  const kind = detectImageType(proof.bytes);
  if (!kind) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(proof.bytes), {
    headers: {
      "Content-Type": kind.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="payment-proof.${kind.ext}"`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
