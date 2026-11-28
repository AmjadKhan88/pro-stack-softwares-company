import "server-only";
import { Schema, model, models, type Model } from "mongoose";

export interface PaymentProofDoc {
  orderId: string;
  contentType: string;
  size: number;
  data: Buffer;
}

const proofSchema = new Schema<PaymentProofDoc>(
  {
    orderId: { type: String, required: true, unique: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export const PaymentProof: Model<PaymentProofDoc> =
  (models.PaymentProof as Model<PaymentProofDoc> | undefined) ??
  model<PaymentProofDoc>("PaymentProof", proofSchema);
