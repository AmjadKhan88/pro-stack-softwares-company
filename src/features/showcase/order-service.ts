import "server-only";
import { randomInt } from "node:crypto";
import mongoose from "mongoose";
import { notifyNewSourceRequest } from "@/features/notifications/events";
import { paginate, type Paged } from "@/lib/list-links";
import { isObjectId } from "@/lib/object-id";
import { connectToDatabase } from "@/server/db/mongoose";
import { PaymentProof } from "./models/payment-proof";
import { SourceOrder, type SourceOrderDoc } from "./models/source-order";
import { ORDER_STATUSES, canTransition, type OrderStatus } from "./rules";
import type { OrderInput } from "./schema";
import type { OrderDetail, OrderRow } from "./types";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I, easy to read out loud

function newReference(): string {
  let code = "";
  for (let index = 0; index < 8; index += 1) code += ALPHABET.charAt(randomInt(ALPHABET.length));
  return `SC-${code}`;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

type OrderLean = SourceOrderDoc & { _id: unknown; createdAt?: Date };

function toRow(doc: OrderLean): OrderRow {
  return {
    id: String(doc._id),
    reference: doc.reference,
    buyerName: doc.buyerName,
    buyerEmail: doc.buyerEmail,
    offerTitle: doc.offerTitle,
    priceMinor: doc.priceMinor,
    paymentMethod: doc.paymentMethod,
    status: doc.status,
    createdAt: doc.createdAt ?? new Date(0),
  };
}

export type CreateOrderResult =
  { ok: true; id: string; reference: string } | { ok: false; reason: "duplicate" };

/** Saves the request, its screenshot and the staff notification together, or none of them. */
export async function createOrder(input: {
  offer: { id: string; title: string; priceMinor: number };
  data: OrderInput;
  proof: { bytes: Buffer; contentType: string };
  ipHash: string;
}): Promise<CreateOrderResult> {
  await connectToDatabase();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const open = await SourceOrder.exists({
    buyerEmail: input.data.email,
    offerId: input.offer.id,
    status: { $in: ["pending", "approved"] },
    createdAt: { $gt: since },
  });
  if (open) return { ok: false, reason: "duplicate" };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = newReference();
    const session = await mongoose.startSession();
    try {
      let id = "";
      await session.withTransaction(async () => {
        const [order] = await SourceOrder.create(
          [
            {
              reference,
              offerId: input.offer.id,
              offerTitle: input.offer.title,
              priceMinor: input.offer.priceMinor,
              buyerName: input.data.name,
              buyerEmail: input.data.email,
              buyerPhone: input.data.phone,
              paymentMethod: input.data.paymentMethod,
              transactionRef: input.data.transactionRef,
              note: input.data.note,
              status: "pending",
              history: [{ status: "pending", at: new Date(), note: "Request received" }],
              ipHash: input.ipHash,
            },
          ],
          { session },
        );
        if (!order) throw new Error("The request could not be saved");
        id = String(order._id);
        await PaymentProof.create(
          [
            {
              orderId: id,
              contentType: input.proof.contentType,
              size: input.proof.bytes.length,
              data: input.proof.bytes,
            },
          ],
          { session },
        );
        await notifyNewSourceRequest({ id, label: `${input.offer.title} · ${input.data.name}` }, session);
      });
      return { ok: true, id, reference };
    } catch (error) {
      if (isDuplicateKey(error) && attempt < 4) continue; // reference collision: try another
      throw error;
    } finally {
      await session.endSession();
    }
  }
  throw new Error("Could not allocate a unique reference");
}

export async function countByStatus(): Promise<Record<OrderStatus, number>> {
  await connectToDatabase();
  const groups = await SourceOrder.aggregate<{ _id: OrderStatus; count: number }>([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
    OrderStatus,
    number
  >;
  for (const group of groups) if (group._id in counts) counts[group._id] = group.count;
  return counts;
}

export async function listOrders(options: {
  status: OrderStatus | null;
  page: number;
}): Promise<Paged<OrderRow>> {
  await connectToDatabase();
  const query = options.status ? { status: options.status } : {};
  const total = await SourceOrder.countDocuments(query);
  const { page, pageCount, skip, limit } = paginate(total, options.page);
  const docs = await SourceOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  return { rows: docs.map((doc) => toRow(doc as OrderLean)), total, page, pageCount };
}

export async function getOrderDetail(id: string): Promise<OrderDetail | null> {
  if (!isObjectId(id)) return null;
  await connectToDatabase();
  const doc = await SourceOrder.findById(id).lean();
  if (!doc) return null;
  const hasProof = Boolean(await PaymentProof.exists({ orderId: id }));
  return {
    ...toRow(doc as OrderLean),
    offerId: doc.offerId,
    buyerPhone: doc.buyerPhone ?? null,
    transactionRef: doc.transactionRef ?? null,
    note: doc.note ?? null,
    hasProof,
    history: (doc.history ?? []).map((entry) => ({
      status: entry.status,
      at: entry.at,
      byEmail: entry.byEmail ?? null,
      note: entry.note ?? null,
    })),
  };
}

export type ChangeStatusResult =
  | { ok: true; order: { reference: string; buyerName: string; buyerEmail: string; offerTitle: string } }
  | { ok: false; error: "not-found" | "not-allowed" | "changed" };

/** Moves a request to a new status. It only succeeds if the request is still in the status it was when read. */
export async function changeOrderStatus(input: {
  id: string;
  to: OrderStatus;
  note?: string;
  actor: { id: string; email: string };
}): Promise<ChangeStatusResult> {
  if (!isObjectId(input.id)) return { ok: false, error: "not-found" };
  await connectToDatabase();
  const order = await SourceOrder.findById(input.id).lean();
  if (!order) return { ok: false, error: "not-found" };
  if (!canTransition(order.status, input.to)) return { ok: false, error: "not-allowed" };

  const updated = await SourceOrder.findOneAndUpdate(
    { _id: input.id, status: order.status },
    {
      $set: { status: input.to },
      $push: {
        history: {
          status: input.to,
          at: new Date(),
          byId: input.actor.id,
          byEmail: input.actor.email,
          note: input.note,
        },
      },
    },
    { returnDocument: "after" },
  ).lean();
  if (!updated) return { ok: false, error: "changed" }; // someone else changed it a moment ago
  return {
    ok: true,
    order: {
      reference: updated.reference,
      buyerName: updated.buyerName,
      buyerEmail: updated.buyerEmail,
      offerTitle: updated.offerTitle,
    },
  };
}

/** Deletes the screenshot once a request is finished (sent or rejected). */
export async function deleteProof(
  id: string,
  actor: { id: string; email: string },
): Promise<"deleted" | "not-found" | "not-finished"> {
  if (!isObjectId(id)) return "not-found";
  await connectToDatabase();
  const order = await SourceOrder.findById(id).lean();
  if (!order) return "not-found";
  if (order.status !== "sent" && order.status !== "rejected") return "not-finished";
  await PaymentProof.deleteOne({ orderId: id });
  await SourceOrder.updateOne(
    { _id: id },
    {
      $push: {
        history: {
          status: order.status,
          at: new Date(),
          byId: actor.id,
          byEmail: actor.email,
          note: "Screenshot deleted",
        },
      },
    },
  );
  return "deleted";
}

export async function getProofFile(id: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!isObjectId(id)) return null;
  await connectToDatabase();
  const proof = await PaymentProof.findOne({ orderId: id }); // not lean, so the data is a real Buffer
  return proof ? { bytes: Buffer.from(proof.data), contentType: proof.contentType } : null;
}
