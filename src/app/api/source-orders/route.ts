import { NextResponse, after } from "next/server";
import { PAYMENT_METHOD_IDS } from "@/config/payments";
import { sendBuyerEmail } from "@/features/showcase/emails";
import { findActiveOfferById } from "@/features/showcase/offer-service";
import { createOrder } from "@/features/showcase/order-service";
import { MAX_PROOF_BYTES, detectImageType } from "@/features/showcase/rules";
import { ORDER_FIELDS, firstErrors, orderSchema } from "@/features/showcase/schema";
import { logger } from "@/server/logger";
import { hashIdentifier } from "@/server/security/ip";
import { consumeRateLimit } from "@/server/security/rate-limit";

const NO_STORE = { "Cache-Control": "private, no-store" };

function fail(status: number, message: string, fieldErrors?: Record<string, string>) {
  return NextResponse.json({ ok: false, message, fieldErrors }, { status, headers: NO_STORE });
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** A buyer sends a source code request with a payment screenshot. No sign-in needed. */
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_PROOF_BYTES + 100_000) {
    return fail(413, "That upload is too big. Please use an image under 3 MB.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "We couldn't read that form. Please try again.");
  }

  // A hidden field real people never fill in.
  if (typeof form.get("website") === "string" && form.get("website") !== "") {
    return fail(400, "Something went wrong. Please try again.");
  }

  const ipLimit = await consumeRateLimit({
    scope: "source-order",
    identifier: hashIdentifier(clientIp(request)),
    limit: 5,
    windowSeconds: 3600,
  });
  if (!ipLimit.allowed) return fail(429, "You've sent several requests. Please wait a while and try again.");

  const raw = Object.fromEntries(
    ORDER_FIELDS.map((field) => {
      const value = form.get(field);
      return [field, typeof value === "string" ? value : undefined];
    }),
  );
  const parsed = orderSchema.safeParse(raw);
  const errors = parsed.success ? {} : firstErrors(parsed.error);

  // The screenshot: present, not too big, and really an image (checked by its content, not its name).
  const file = form.get("screenshot");
  let proof: { bytes: Buffer; contentType: string } | null = null;
  if (!(file instanceof Blob) || file.size === 0) {
    errors.screenshot = "Please attach your payment screenshot.";
  } else if (file.size > MAX_PROOF_BYTES) {
    errors.screenshot = "That image is too big. Please upload one under 3 MB.";
  } else {
    const bytes = Buffer.from(await file.arrayBuffer());
    const kind = detectImageType(bytes);
    if (!kind) errors.screenshot = "Please upload a JPG, PNG or WebP image.";
    else proof = { bytes, contentType: kind.type };
  }

  if (!parsed.success || !proof || Object.keys(errors).length > 0) {
    return fail(400, "Please check the highlighted fields.", errors);
  }

  try {
    const emailLimit = await consumeRateLimit({
      scope: "source-order-email",
      identifier: hashIdentifier(parsed.data.email),
      limit: 3,
      windowSeconds: 86_400,
    });
    if (!emailLimit.allowed)
      return fail(429, "Too many requests for this email address today. Please contact us on WhatsApp.");

    // Price and title come from our database, never from the form.
    const offer = await findActiveOfferById(parsed.data.offerId);
    if (!offer) return fail(404, "This project isn't available any more.");
    if (!(PAYMENT_METHOD_IDS as readonly string[]).includes(parsed.data.paymentMethod)) {
      return fail(400, "Please choose how you paid.", { paymentMethod: "Please choose how you paid." });
    }

    const result = await createOrder({
      offer,
      data: parsed.data,
      proof,
      ipHash: hashIdentifier(clientIp(request)),
    });
    if (!result.ok) {
      return fail(
        409,
        "You already sent a request for this project. We're checking your payment and will email you.",
      );
    }

    after(() =>
      sendBuyerEmail("received", {
        buyerEmail: parsed.data.email,
        buyerName: parsed.data.name,
        reference: result.reference,
        offerTitle: offer.title,
      }),
    );
    return NextResponse.json({ ok: true, reference: result.reference }, { headers: NO_STORE });
  } catch (error) {
    logger.error({ err: error }, "saving a source code request failed");
    return fail(500, "We couldn't save your request. Please try again, or contact us on WhatsApp.");
  }
}
