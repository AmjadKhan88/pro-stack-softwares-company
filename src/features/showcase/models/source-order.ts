import "server-only";
import { Schema, model, models, type Model } from "mongoose";
import { ORDER_STATUSES, type OrderStatus } from "../rules";

export interface OrderHistoryEntry {
  status: OrderStatus;
  at: Date;
  byId?: string;
  byEmail?: string;
  note?: string;
}

export interface SourceOrderDoc {
  reference: string;
  offerId: string;
  /** Copied when the request is made, so later edits to the project don't change old requests. */
  offerTitle: string;
  priceMinor: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  paymentMethod: string;
  transactionRef?: string;
  note?: string;
  status: OrderStatus;
  history: OrderHistoryEntry[];
  ipHash: string;
}

const historySchema = new Schema<OrderHistoryEntry>(
  {
    status: { type: String, enum: [...ORDER_STATUSES], required: true },
    at: { type: Date, required: true },
    byId: { type: String },
    byEmail: { type: String },
    note: { type: String, maxlength: 300 },
  },
  { _id: false },
);

const orderSchema = new Schema<SourceOrderDoc>(
  {
    reference: { type: String, required: true, unique: true },
    offerId: { type: String, required: true },
    offerTitle: { type: String, required: true },
    priceMinor: { type: Number, required: true },
    buyerName: { type: String, required: true, maxlength: 100 },
    buyerEmail: { type: String, required: true, maxlength: 120 },
    buyerPhone: { type: String, maxlength: 25 },
    paymentMethod: { type: String, required: true },
    transactionRef: { type: String, maxlength: 60 },
    note: { type: String, maxlength: 500 },
    status: { type: String, enum: [...ORDER_STATUSES], default: "pending" },
    history: { type: [historySchema], default: [] },
    ipHash: { type: String, required: true },
  },
  { timestamps: true },
);
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ buyerEmail: 1, offerId: 1, createdAt: -1 });

export const SourceOrder: Model<SourceOrderDoc> =
  (models.SourceOrder as Model<SourceOrderDoc> | undefined) ??
  model<SourceOrderDoc>("SourceOrder", orderSchema);
